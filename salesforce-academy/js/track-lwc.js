/* =====================================================================
   ORBIT · Lightning Web Components
   window.TRACKS.lwc — modules: model / data / comm / ux
   Self-contained: registers its own widgets, quizzes and track data.
   ===================================================================== */
(function () {
  "use strict";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function checkbox(label, initial, onChange) {
    var input = h("input", { type: "checkbox" });
    input.checked = !!initial;
    input.addEventListener("change", function () { onChange(input.checked); });
    return h("label", { class: "w-field" }, input, " " + label);
  }

  var Widgets = {};

  /* obDataPathPicker — which LWC data path fits this need? */
  Widgets.obDataPathPicker = function (mount) {
    shell(mount, "decision", "LWC data path picker",
      "Say what the component needs and whether other components on the page show the same data. The picker names the data path and how caching, reactivity, security and refresh behave on it.");
    var need = "readOne", shared = "yes";
    var NEED_LABEL = {
      readOne: "read one record's fields",
      list: "read a filtered list (SOQL)",
      write: "write / DML",
      click: "call on a user click",
      reactive: "react to a changing parameter"
    };
    var CARDS = [
      ["lds", "LDS / UI API", "base components, getRecord, updateRecord, GraphQL"],
      ["wire", "@wire cacheable Apex", "read-only, cached, reactive"],
      ["imp", "Imperative Apex", "on demand; may write"]
    ];
    var LDS_SEC = "LDS enforces CRUD, FLS and sharing for you";
    var APEX_SEC = "your job: with sharing class + WITH USER_MODE SOQL";
    var D = {
      readOne: {
        yes: { card: "lds", path: "LDS base component or getRecord (UI API)",
          why: "Every component showing this record reads one shared LDS cache entry, so a single fetch serves them all and an edit anywhere repaints everywhere.",
          caching: "shared LDS record cache", reactivity: "re-provisions when $recordId changes or LDS sees a newer version",
          security: LDS_SEC, refresh: "automatic after LDS writes; notifyRecordUpdateAvailable(recordIds) after Apex writes" },
        no: { card: "lds", path: "lightning-record-view-form or getRecord with schema field imports",
          why: "Even with one consumer, LDS beats Apex: no controller to write or test, security is built in, and the cache is ready if a sibling component arrives later.",
          caching: "LDS record cache (one consumer today)", reactivity: "re-provisions when $recordId changes",
          security: LDS_SEC, refresh: "automatic after LDS writes; notifyRecordUpdateAvailable after Apex writes" }
      },
      list: {
        yes: { card: "lds", path: "GraphQL wire adapter; fall back to @wire on a cacheable=true Apex method",
          why: "GraphQL results normalise into the LDS cache, so a record edited elsewhere refreshes inside your list. Fall back to cacheable Apex for aggregates or logic GraphQL cannot express.",
          caching: "LDS cache (GraphQL) or Apex wire cache keyed by method + params", reactivity: "re-runs when a $variable changes",
          security: "UI API enforces FLS + sharing; an Apex fallback must be with sharing + WITH USER_MODE", refresh: "refreshGraphQL or refreshApex on the stored wire result" },
        no: { card: "wire", path: "@wire to a cacheable=true Apex method",
          why: "A filtered list nobody else shows is the classic cacheable Apex read: the selector owns the SOQL, the controller stays thin, and the wire caches by parameters.",
          caching: "client wire cache keyed by method + parameters", reactivity: "re-runs when a $param changes",
          security: APEX_SEC, refresh: "refreshApex(this.wiredResult) after related DML" }
      },
      write: {
        yes: { card: "lds", path: "updateRecord / createRecord (UI API) or lightning-record-edit-form",
          why: "Writing through LDS updates the shared cache in place, so every component showing that record repaints without any extra code.",
          caching: "LDS cache updated in place", reactivity: "wired LDS readers repaint automatically",
          security: "LDS enforces CRUD, FLS and sharing; validation rules and automation still run", refresh: "none for LDS readers; refreshApex any Apex wire that depends on it" },
        no: { card: "imp", path: "imperative Apex to a non-cacheable @AuraEnabled method",
          why: "Multi-record DML, cross-object logic or callouts belong in a service behind a thin controller. cacheable=true is not allowed for DML, so this call is imperative by necessity.",
          caching: "none (non-cacheable)", reactivity: "none; you await the promise",
          security: "with sharing + AccessLevel.USER_MODE DML in the service", refresh: "refreshApex(wiredResult) for your own list" }
      },
      click: {
        yes: { card: "imp", path: "imperative Apex in the click handler, then notify LDS",
          why: "User-triggered calls run on demand with your own spinner. If the result changes records that other components show, tell LDS so they do not go stale.",
          caching: "cacheable=true reads may return the client cache; non-cacheable always hit the server", reactivity: "none; runs only when the handler fires",
          security: APEX_SEC, refresh: "notifyRecordUpdateAvailable(recordIds) for records shown through LDS" },
        no: { card: "imp", path: "imperative Apex inside an async handler with try / catch / finally",
          why: "Nothing else depends on the result, so update local state from the returned value and reset the loading flag in finally.",
          caching: "only if the method is cacheable=true", reactivity: "none; runs only when the handler fires",
          security: APEX_SEC, refresh: "assign the returned value; no page-wide refresh needed" }
      },
      reactive: {
        yes: { card: "lds", path: "@wire getRecord with '$recordId' (LDS)",
          why: "A '$' parameter re-provisions the wire whenever the parent changes the @api value, and LDS keeps every sibling that shows the record consistent.",
          caching: "shared LDS record cache", reactivity: "'$recordId' re-provisions on every change",
          security: LDS_SEC, refresh: "automatic after LDS writes; notifyRecordUpdateAvailable after Apex writes" },
        no: { card: "wire", path: "@wire to a cacheable=true Apex method with '$param'",
          why: "The wire service re-invokes the method whenever a reactive parameter changes, with no imperative plumbing in connectedCallback or a setter.",
          caching: "client wire cache keyed by method + parameters", reactivity: "'$param' re-runs the method on change",
          security: APEX_SEC, refresh: "refreshApex(this.wiredResult) after related DML" }
      }
    };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var d = (D[need] || D.readOne)[shared] || D.readOne.yes;
      clear(stage);
      var grid = h("div", { class: "ob-grid" });
      for (var i = 0; i < CARDS.length; i++) {
        var c = CARDS[i];
        var on = c[0] === d.card;
        grid.appendChild(h("div", { class: "ob-card " + (on ? "is-on" : "is-dim") },
          h("h4", {}, c[1]), h("div", { class: "ob-dim" }, on ? "recommended" : c[2])));
      }
      stage.appendChild(grid);
      stage.appendChild(h("p", { style: "margin:10px 0 0;font-size:0.88rem;line-height:1.55" }, d.path + ". " + d.why));
      clear(readout);
      readout.appendChild(ro("need", NEED_LABEL[need]));
      readout.appendChild(ro("shared on page", shared === "yes" ? "yes" : "no"));
      readout.appendChild(ro("path", d.path));
      readout.appendChild(ro("caching", d.caching));
      readout.appendChild(ro("reactivity", d.reactivity));
      readout.appendChild(ro("security", d.security));
      readout.appendChild(ro("refresh", d.refresh));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["readOne", "Read one record"], ["list", "Filtered list (SOQL)"], ["write", "Write / DML"], ["click", "On user click"], ["reactive", "Changing parameter"]], 0, function (v) { need = v; paint(); }),
      h("div", { class: "ob-dim", style: "font-size:0.8rem;margin-top:6px" }, "Is the data shared with other components on the page?"),
      segment([["yes", "Shared"], ["no", "Only this component"]], 0, function (v) { shared = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* obEventLab — where does a CustomEvent from c-child actually go? */
  Widgets.obEventLab = function (mount) {
    shell(mount, "simulator", "Event propagation lab",
      "Tree: c-grandparent renders c-parent, whose template renders c-child. c-child calls this.dispatchEvent(new CustomEvent('select', ...)). Toggle bubbles and composed, choose where the listener lives, and trace the nodes the event reaches.");
    var bubbles = false, composed = false, where = "child";
    var LISTENER = {
      child: { node: "child", label: "onselect on c-child in c-parent's template" },
      root: { node: "root", label: "this.template.addEventListener in c-parent" },
      gp: { node: "phost", label: "onselect on c-parent in c-grandparent's template" },
      doc: { node: "doc", label: "document.addEventListener" }
    };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function nodes() {
      var both = bubbles && composed;
      return [
        { id: "child", label: "c-child host (dispatch target, inside c-parent's shadow tree)", reach: true,
          why: "the target is always invoked" },
        { id: "wrap", label: "div.list wrapping c-child in c-parent's template", reach: bubbles,
          why: bubbles ? "bubbled to the parent element" : "bubbles:false, so no bubbling past the target" },
        { id: "root", label: "c-parent shadow root (this.template)", reach: bubbles,
          why: bubbles ? "bubbled to the top of c-parent's shadow tree" : "bubbles:false" },
        { id: "phost", label: "c-parent host, as seen from c-grandparent's template", reach: composed,
          why: composed ? "composed:true crosses the boundary; the event is retargeted to this host" : "composed:false keeps the event inside c-parent's shadow tree" },
        { id: "gwrap", label: "div.panel in c-grandparent's template", reach: both,
          why: both ? "bubbling continues in c-grandparent's tree" : (composed ? "not a host, and bubbles:false" : "event never left c-parent") },
        { id: "groot", label: "c-grandparent shadow root", reach: both,
          why: both ? "top of c-grandparent's shadow tree" : (composed ? "not a host, and bubbles:false" : "event never left c-parent") },
        { id: "ghost", label: "c-grandparent host (in the page)", reach: composed,
          why: composed ? "next host: retargeted again" : "event never left c-parent" },
        { id: "doc", label: "body, then document", reach: both,
          why: both ? "bubbles + composed reach the document" : (composed ? "composed without bubbles reaches only hosts" : "event never left c-parent") }
      ];
    }
    function paint() {
      var list = nodes();
      var target = LISTENER[where] || LISTENER.child;
      var reached = false, count = 0;
      clear(stage);
      var ol = h("ol", { class: "ob-steps" });
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        var isListener = n.id === target.node;
        if (n.reach) count++;
        if (isListener) reached = n.reach;
        var cls = "ob-step " + (n.reach ? "is-done" : "is-skip") + (isListener && n.reach ? " is-active" : "");
        ol.appendChild(h("li", { class: cls },
          h("span", { class: "ob-num" }, String(i + 1)),
          h("span", {}, n.label + " — " + (n.reach ? "reached: " : "skipped: ") + n.why + (isListener ? " [listener here]" : ""))));
      }
      stage.appendChild(ol);
      var rec;
      if (!bubbles && !composed) rec = "This is the recommended default: the parent handles the event on c-child in its own template, and nothing leaks.";
      else if (bubbles && !composed) rec = "Acceptable for delegation inside one template; the event stays private to c-parent. Prefer the default unless you need it.";
      else if (!bubbles && composed) rec = "Reaches every ancestor host and makes the event name public API. Prefer bubbles:false, composed:false and let c-parent re-dispatch, or use LMS.";
      else rec = "Reaches the whole page and every ancestor tree. Avoid: a parent-mediated re-dispatch or Lightning Message Service is safer for across-DOM communication.";
      clear(readout);
      readout.appendChild(ro("options", "bubbles:" + bubbles + ", composed:" + composed));
      readout.appendChild(ro("listener", target.label));
      readout.appendChild(ro("reached the listener", reached ? "yes" : "no"));
      readout.appendChild(ro("crossed a shadow boundary", composed ? "yes" : "no"));
      readout.appendChild(ro("nodes reached", count + " of " + list.length));
      readout.appendChild(ro("advice", rec));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      checkbox("bubbles", bubbles, function (v) { bubbles = v; paint(); }),
      checkbox("composed", composed, function (v) { composed = v; paint(); }),
      segment([["child", "On c-child (parent template)"], ["root", "Parent this.template"], ["gp", "On c-parent (grandparent template)"], ["doc", "document"]], 0, function (v) { where = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "lwc-model": {
      title: "Component model checkpoint",
      sub: "Bundle, lifecycle order, reactivity and template directives.",
      questions: [
        { q: "A parent component renders one child. In what order do the lifecycle hooks run on first render?",
          options: ["Parent renderedCallback, then child connectedCallback", "Child constructor, then parent constructor, then both connectedCallbacks", "Parent connectedCallback, child connectedCallback, child renderedCallback, parent renderedCallback", "Every connectedCallback runs after every renderedCallback"],
          answer: 2,
          explain: "Connection flows top-down and rendering completes bottom-up. The parent connects first, then renders its template which creates and connects the child; the child finishes rendering before the parent's renderedCallback fires, because the parent is not rendered until its children are." },
        { q: "Your component calls this.items.push(newItem) on a plain array field and the list on screen does not change. What is the idiomatic fix?",
          options: ["Assign a new array: this.items = [...this.items, newItem]", "Call this.render() after the push", "Move the push into renderedCallback", "Decorate the field with @api so the parent re-renders it"],
          answer: 0,
          explain: "LWC re-renders when a field the template reads is reassigned. An in-place push keeps the same array reference, so nothing is observed. Creating a new array is explicit, cheap at UI sizes, and is the house standard over reaching for @track." },
        { q: "The compiler rejects @api showHeader = true; in a component. Why?",
          options: ["Public properties cannot have default values", "Boolean public properties must be declared with @track", "Only string values can be public", "Boolean public properties must default to false, so the presence of the attribute in markup is what means true"],
          answer: 3,
          explain: "HTML boolean attributes are true when present and false when absent. A public boolean defaulting to true could never be switched off from markup, so the compiler refuses it. Invert the name (hideHeader) and default it to false." },
        { q: "Where should a component start a Lightning Message Service subscription and where should it release it?",
          options: ["constructor and renderedCallback", "connectedCallback and disconnectedCallback", "renderedCallback and errorCallback", "constructor, with no cleanup needed"],
          answer: 1,
          explain: "connectedCallback runs once the component is in the DOM and its wired MessageContext is usable; renderedCallback runs on every render and would subscribe repeatedly. Pairing it with unsubscribe in disconnectedCallback makes the lifetime explicit and is the house standard." },
        { q: "You render records with for:each. What should the key directive be bound to?",
          options: ["The loop index", "A value computed in the template from the item's position", "A stable unique value from the data, such as the record Id", "Nothing; LWC tracks list items automatically"],
          answer: 2,
          explain: "The key tells the diffing engine which DOM node belongs to which item. An index changes meaning whenever the list is sorted, filtered or prepended, so nodes get reused for the wrong record. A stable Id keeps focus, input state and animations attached to the right row." }
      ]
    },
    "lwc-data": {
      title: "Data access checkpoint",
      sub: "LDS first, cacheable wires, imperative writes and keeping caches honest.",
      questions: [
        { q: "A record page component shows four fields of the current Account. What is the simplest secure option?",
          options: ["Imperative Apex in connectedCallback", "Lightning Data Service: a record view form or the getRecord wire adapter with schema field imports", "A cacheable Apex method using WITH SECURITY_ENFORCED", "fetch() to the REST API from the component"],
          answer: 1,
          explain: "Single-record reads are exactly what LDS is for. It needs no Apex, enforces CRUD, FLS and sharing, and shares one cache entry with every other component showing that Account. Apex is for queries and logic LDS cannot express." },
        { q: "An imperative Apex call updates records that a wired Apex list on the same component displays, but the list stays stale. What fixes it?",
          options: ["Mark the update method cacheable=true", "Call refreshApex(this.wiredResult.data)", "Reload the page through window.location", "Keep the full object the wire provisioned and call refreshApex on it after the update resolves"],
          answer: 3,
          explain: "The wire cache does not know that imperative DML happened. refreshApex re-queries the server, but it needs the exact object the wire service provisioned, not its data property. Await the update, then await refreshApex(this.wiredResult)." },
        { q: "Why is DML not allowed in an @AuraEnabled(cacheable=true) method?",
          options: ["Cacheable results can be served from the client cache without calling the server, so the platform forbids side effects in those methods", "DML requires the class to be without sharing", "It is allowed if the DML is inside try/catch", "Cacheable methods execute in a separate read-only org"],
          answer: 0,
          explain: "If a call can be answered from cache, any write inside it might silently not happen. The platform therefore treats cacheable methods as pure reads and rejects DML in them. Writes go through a non-cacheable method called imperatively." },
        { q: "Apex updates an Account that a separate LDS-based component on the same page is displaying. How do you make that component show the new values?",
          options: ["Call refreshApex on the LDS component's record", "Dispatch a CustomEvent named refresh from the Apex caller", "Call notifyRecordUpdateAvailable with the updated record ids", "Nothing; LDS polls the server for changes every few seconds"],
          answer: 2,
          explain: "LDS only knows about writes that went through it. notifyRecordUpdateAvailable tells LDS that those records changed on the server, so it re-fetches them and every component reading them repaints. refreshApex applies to Apex wires, not LDS records." },
        { q: "What is the house standard for the SOQL behind an @AuraEnabled read method?",
          options: ["A with sharing controller delegating to a selector whose query uses WITH USER_MODE", "A without sharing class so every user sees the same list", "WITH SECURITY_ENFORCED and WITH USER_MODE together for double protection", "No security clause, because LWC already enforces FLS on Apex results"],
          answer: 0,
          explain: "Apex runs in system mode for object and field access unless you ask otherwise, and LWC does not filter what Apex returns. with sharing enforces record access; WITH USER_MODE enforces CRUD and FLS and reports all violations. The two USER_MODE and SECURITY_ENFORCED clauses are never combined." }
      ]
    },
    "lwc-comm": {
      title: "Communication checkpoint",
      sub: "Events, bubbling, composition and Lightning Message Service.",
      questions: [
        { q: "A child calls this.dispatchEvent(new CustomEvent('select')) with default options. Who can hear it?",
          options: ["Every ancestor up to document", "Any component on the page that subscribes through LMS", "Only elements inside the child's own shadow tree", "A listener attached to the c-child element in the parent's template"],
          answer: 3,
          explain: "With bubbles and composed both false, the event is dispatched on the child's host element and goes nowhere else. The host lives in the parent's template, so an onselect handler on that element is the one place it can be caught. That contained default is what you want for most child-to-parent events." },
        { q: "The child dispatches with bubbles:true and composed:false. Where can the event be caught?",
          options: ["Only in the grandparent's template", "Anywhere up the parent's shadow tree, including a listener on the parent's this.template", "On document", "Nowhere, because LWC disables bubbling"],
          answer: 1,
          explain: "Bubbling walks up the ancestors of the host inside the tree it lives in, which is the parent's shadow tree, ending at that shadow root. composed:false stops it at the boundary, so the grandparent and the document never see it." },
        { q: "The child dispatches with bubbles:false and composed:true. Which nodes are invoked?",
          options: ["Every node up to document", "Only the dispatching element", "The dispatching host and each ancestor shadow host, but not the ordinary elements between them", "Only the elements inside the parent's shadow tree"],
          answer: 2,
          explain: "composed lets the event cross shadow boundaries, where it is retargeted to each host. Without bubbling, only the target in each tree is invoked, and in outer trees the target is the host. Intermediate wrapper elements and the document are skipped." },
        { q: "Two components sit in different regions of a Lightning page with no DOM relationship. One must tell the other which record was selected. Which pattern fits?",
          options: ["Lightning Message Service on a shared message channel", "A CustomEvent with bubbles:true and composed:true", "A shared @api property", "A variable on window"],
          answer: 0,
          explain: "Events travel along the DOM, so components with no common ancestor you own cannot rely on them. LMS publishes on a named channel to any subscriber on the page, across LWC, Aura and Visualforce. A composed event would leak through every tree and still may not reach a sibling region." },
        { q: "A batch job finishes on the server and any open record page showing the affected records should react. What fits?",
          options: ["Publish on an LMS channel from the batch finish method", "Dispatch a composed CustomEvent from Apex", "Call refreshApex from the batch class", "Publish a platform event and subscribe in the component with lightning/empApi"],
          answer: 3,
          explain: "LMS and DOM events live entirely in the browser; server code cannot use them. A platform event is a server-side message that an empApi subscription in the browser receives in near real time, so the component can refresh itself." }
      ]
    },
    "lwc-ux": {
      title: "UX and accessibility checkpoint",
      sub: "SLDS, styling hooks, shadow DOM styling and accessible components.",
      questions: [
        { q: "You need a different brand-button background in one component without breaking when base components change internally. What do you do?",
          options: ["Set the base component's documented styling hook custom property on the host or a wrapping class", "Target the button's internal element with a descendant selector", "Add an !important rule in a static resource", "Put an inline style attribute on lightning-button"],
          answer: 0,
          explain: "Shadow DOM hides base component internals from your selectors, and their markup can change between releases. Styling hooks are CSS custom properties the component deliberately reads, so they cross the boundary and are the supported customisation surface. Inline styles are banned by the house standard." },
        { q: "A parent's CSS rule .card p has no effect on paragraphs inside a child component. Why?",
          options: ["SLDS overrides all custom CSS", "Component CSS only loads in production orgs", "Shadow DOM scopes each component's styles, so parent selectors cannot reach into a child's template", "Paragraph elements cannot be styled in LWC"],
          answer: 2,
          explain: "Each component's CSS applies only to its own template. The child's paragraphs are in a different shadow tree, so the parent's selector never matches them. Pass a variant through @api or expose custom properties if the parent must influence the child." },
        { q: "A search box shows only a magnifier icon and placeholder text. What is the accessibility fix?",
          options: ["Make the placeholder longer and more descriptive", "Give the input a real label, visually hidden with variant label-hidden if the design needs it", "Add a title tooltip to the icon", "Turn the border red while the field is empty"],
          answer: 1,
          explain: "Placeholders disappear on input and are not a reliable accessible name. lightning-input requires a label; variant label-hidden keeps it available to screen readers while hiding it visually. Tooltips and colour do not name the field." },
        { q: "After a save, a short status such as Saved should be announced politely to screen reader users. What is the house pattern?",
          options: ["Change a span's text with no live-region semantics", "Show a browser alert dialog", "Turn the save button green", "Render the message in a native output element so assistive technology announces it politely"],
          answer: 3,
          explain: "Text that silently changes is invisible to screen reader users unless it sits in a live region. The output element is an implicit polite live region, and the house standard prefers it over a div or span with role status. Urgent errors use role alert instead." },
        { q: "What minimum touch target size does the house standard require for clickable elements?",
          options: ["16 by 16 pixels", "44 by 44 pixels", "100 by 100 pixels", "No minimum when SLDS classes are used"],
          answer: 1,
          explain: "44 by 44 pixels matches the enhanced WCAG target-size guidance and comfortably fits a fingertip on the Salesforce mobile app. Icon-only buttons are the usual offenders, so check them with padding, not just the glyph size." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.lwc = {
    id: "lwc",
    name: "Lightning Web Components",
    short: "LWC",
    tagline: "Fast, secure UI on the platform's own data layer",
    color: "#f472b6",
    blurb: "Build Lightning Web Components the way enterprise teams review them: a clean bundle and lifecycle, honest reactivity, Lightning Data Service before Apex, cacheable wires and imperative writes, contained events and Lightning Message Service, SLDS styling hooks instead of inline styles, and components that keyboard and screen reader users can actually operate.",
    modules: [
      {
        id: "model",
        name: "Component Model",
        icon: "cube",
        lessons: [
          {
            id: "lwc-basics",
            title: "Component anatomy and lifecycle",
            summary: "The four files in a bundle, how a component is named and placed, and the order its lifecycle hooks fire.",
            minutes: 9,
            tags: ["lwc", "lifecycle", "bundle"],
            blocks: [
              { t: "p", html: "A Lightning web component is a standard web component with a thin platform layer on top: a JavaScript class that extends <code class='tok'>LightningElement</code>, an HTML template, optional CSS, and a metadata file that tells the platform where the component may be placed. Hold this picture: <strong>the engine owns rendering, you own state</strong>. You change fields; the engine decides when the DOM catches up." },
              { t: "h", text: "The bundle" },
              { t: "table", headers: ["File", "Role", "Rule worth remembering"], rows: [
                ["<code class='tok'>accountCard.js</code>", "Class extending LightningElement; state, getters, handlers", "JSDoc on the class and every <code class='tok'>@api</code> member"],
                ["<code class='tok'>accountCard.html</code>", "One root &lt;template&gt;; declarative bindings only", "No logic beyond property access; use getters"],
                ["<code class='tok'>accountCard.css</code>", "Styles scoped to this component by shadow DOM", "SLDS classes first; theme tokens for colour"],
                ["<code class='tok'>accountCard.js-meta.xml</code>", "API version, exposure, targets, form factors", "Include the Small form factor for mobile record pages"]
              ] },
              { t: "code", lang: "javascript", code:
                "import { LightningElement, api } from 'lwc';\n\n" +
                "/** @description Compact summary card for an Account record page. */\n" +
                "export default class AccountCard extends LightningElement {\n" +
                "    /** @type {string} Record Id supplied by the record page. */\n" +
                "    @api recordId;\n\n" +
                "    /** @type {boolean} Hides the header when set; defaults to false. */\n" +
                "    @api hideHeader = false;\n\n" +
                "    connectedCallback() {\n" +
                "        this.columns = this.buildColumns();\n" +
                "    }\n\n" +
                "    buildColumns() {\n" +
                "        return [{ label: 'Name', fieldName: 'Name' }];\n" +
                "    }\n" +
                "}"
              },
              { t: "code", lang: "text", code:
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<!-- metadata namespace attribute omitted for brevity -->\n' +
                '<LightningComponentBundle>\n' +
                '    <apiVersion>62.0</apiVersion>\n' +
                '    <isExposed>true</isExposed>\n' +
                '    <targets>\n' +
                '        <target>lightning__RecordPage</target>\n' +
                '    </targets>\n' +
                '    <targetConfigs>\n' +
                '        <targetConfig targets="lightning__RecordPage">\n' +
                '            <objects><object>Account</object></objects>\n' +
                '            <supportedFormFactors>\n' +
                '                <supportedFormFactor type="Large" />\n' +
                '                <supportedFormFactor type="Small" />\n' +
                '            </supportedFormFactors>\n' +
                '        </targetConfig>\n' +
                '    </targetConfigs>\n' +
                '</LightningComponentBundle>'
              },
              { t: "note", variant: "tip", html: "The folder is camelCase and the markup tag is kebab-case in the <code class='tok'>c</code> namespace: <code class='tok'>accountCard</code> is used as <code class='tok'>&lt;c-account-card&gt;</code>. A capital letter in the folder becomes a hyphen in the tag, which is why two adjacent capitals produce surprising tag names." },
              { t: "h", text: "Lifecycle, in the order it fires" },
              { t: "table", headers: ["Hook", "What exists", "Use it for"], rows: [
                ["<code class='tok'>constructor()</code>", "The instance; no attributes, no DOM", "Almost nothing; call super() and initialise plain fields"],
                ["<code class='tok'>connectedCallback()</code>", "Public properties set; the element is in the DOM; children not rendered", "Subscriptions, one-time setup, async config loads with try/catch"],
                ["<code class='tok'>renderedCallback()</code>", "Rendered DOM; fires after every render", "Guarded, one-time DOM work such as initialising a chart"],
                ["<code class='tok'>disconnectedCallback()</code>", "Element being removed", "Unsubscribe, clear timers, remove listeners"],
                ["<code class='tok'>errorCallback(error, stack)</code>", "A descendant threw during lifecycle or render", "Error boundary: show a fallback for that section"]
              ] },
              { t: "code", lang: "text", code:
                "First render of a parent with one child\n" +
                "  parent constructor\n" +
                "  parent connectedCallback\n" +
                "    child constructor\n" +
                "    child connectedCallback\n" +
                "    child renderedCallback\n" +
                "  parent renderedCallback      (parent is rendered only once its children are)"
              },
              { t: "note", variant: "trap", html: "<code class='tok'>renderedCallback</code> runs on every re-render. Setting a reactive field inside it without a guard flag schedules another render, which runs the hook again: an infinite loop that freezes the tab." },
              { t: "compare",
                bad: { title: "Lifecycle misuse", items: ["Fetching data in the constructor", "Querying child DOM in connectedCallback", "Subscribing in renderedCallback without a guard", "Leaving subscriptions and timers running after removal"] },
                good: { title: "Lifecycle discipline", items: ["Wire or connectedCallback for data", "Guarded renderedCallback for DOM-only work", "Subscribe once in connectedCallback", "Release everything in disconnectedCallback"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a component that flickers or freezes after load, a chart initialised twice, a handler that keeps firing after navigating away, or a question about what <code class='tok'>this.template.querySelector</code> returns in connectedCallback (children are not rendered yet)." },
              { t: "note", variant: "key", html: "<strong>Connect top-down, render bottom-up, clean up on disconnect.</strong> Put setup in connectedCallback, DOM-only work in a guarded renderedCallback, and say out loud that the parent is not rendered until its children are." }
            ]
          },
          {
            id: "reactivity",
            title: "Reactivity, decorators and templates",
            summary: "What triggers a re-render, what @api, @track and @wire are for, and the template directives that keep logic out of markup.",
            minutes: 10,
            tags: ["reactivity", "decorators", "templates"],
            blocks: [
              { t: "p", html: "Treat the template as a pure function of the component's fields. The engine re-renders when a field the template reads is <strong>reassigned</strong>. Primitives are easy; objects and arrays are where teams get bitten, because mutating them in place keeps the same reference and nothing is observed." },
              { t: "table", headers: ["Operation", "Re-render?", "Why"], rows: [
                ["<code class='tok'>this.status = 'Closed'</code>", "Yes", "Field reassigned"],
                ["<code class='tok'>this.items.push(x)</code>", "No", "Same array reference"],
                ["<code class='tok'>this.items = [...this.items, x]</code>", "Yes", "New reference"],
                ["<code class='tok'>this.filter.stage = 'Won'</code>", "No", "Property of a plain object mutated in place"],
                ["<code class='tok'>this.filter = { ...this.filter, stage: 'Won' }</code>", "Yes", "New object"],
                ["Same mutation on a <code class='tok'>@track</code> field", "Yes", "@track observes nested changes, at extra cost"]
              ] },
              { t: "h", text: "The three decorators" },
              { t: "table", headers: ["Decorator", "Direction", "Use it for"], rows: [
                ["<code class='tok'>@api</code>", "Parent to child", "Public properties and methods; the parent owns the value, the child treats it as read-only"],
                ["<code class='tok'>@track</code>", "Internal", "Rarely needed now; deep observation of an object or array you must mutate in place"],
                ["<code class='tok'>@wire</code>", "Platform to component", "Declarative data from LDS or cacheable Apex; '$' parameters re-provision on change"]
              ] },
              { t: "code", lang: "javascript", code:
                "import { LightningElement, api, wire } from 'lwc';\n" +
                "import getOpenCases from '@salesforce/apex/CaseController.getOpenCases';\n\n" +
                "/** @description Lists open cases for the current account. */\n" +
                "export default class OpenCases extends LightningElement {\n" +
                "    /** @type {string} */\n" +
                "    @api recordId;\n" +
                "    cases = [];\n" +
                "    error;\n\n" +
                "    @wire(getOpenCases, { accountId: '$recordId' })\n" +
                "    wiredCases({ data, error }) {\n" +
                "        if (data) {\n" +
                "            // derive once when data arrives, not on every render\n" +
                "            this.cases = [...data].sort((a, b) => a.CaseNumber.localeCompare(b.CaseNumber));\n" +
                "            this.error = undefined;\n" +
                "        } else if (error) {\n" +
                "            this.error = error;\n" +
                "        }\n" +
                "    }\n\n" +
                "    get hasCases() { return this.cases.length > 0; }\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "A public boolean must default to <code class='tok'>false</code>: <code class='tok'>@api hideHeader = false</code>, never <code class='tok'>= true</code>, which the compiler rejects. In markup, the attribute's presence means true, so name the flag for the non-default behaviour." },
              { t: "h", text: "Templates: directives, not expressions" },
              { t: "code", lang: "text", code:
                '<template>\n' +
                '    <template lwc:if={isLoading}>\n' +
                '        <lightning-spinner alternative-text="Loading cases"></lightning-spinner>\n' +
                '    </template>\n' +
                '    <template lwc:elseif={hasCases}>\n' +
                '        <ul class="slds-has-dividers_bottom-space">\n' +
                '            <template for:each={cases} for:item="c">\n' +
                '                <li key={c.Id} class="slds-item">{c.CaseNumber} {c.Subject}</li>\n' +
                '            </template>\n' +
                '        </ul>\n' +
                '    </template>\n' +
                '    <template lwc:else>\n' +
                '        <p class="slds-text-color_weak">No open cases.</p>\n' +
                '    </template>\n' +
                '    <lightning-button label="Refresh" lwc:ref="refreshBtn" onclick={handleRefresh}></lightning-button>\n' +
                '</template>'
              },
              { t: "note", variant: "trap", html: "Bind <code class='tok'>key</code> to a stable value from the data such as the record Id. A loop index changes meaning on every sort or filter, so the engine reuses DOM nodes for the wrong rows and focus or typed input jumps between records." },
              { t: "table", headers: ["Tier", "Derived state", "What it costs"], rows: [
                ["Naive", "A getter that filters and sorts the full list on every render", "Runs on each render cycle; slow on big lists"],
                ["Solid", "Compute the derived list once when the wire or call returns", "One pass per data change; cheap getters for flags"],
                ["Standout", "Immutable updates, stable keys, and small presentational children fed by @api", "Fewer re-renders, predictable diffs, easy Jest tests"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> the data changed but the screen did not (in-place mutation), typed input jumps to another row (index keys), a child that tries to change its own <code class='tok'>@api</code> value, or a template that needs a ternary (move it to a getter)." },
              { t: "quiz", id: "lwc-model" },
              { t: "note", variant: "key", html: "<strong>Reassign, do not mutate; derive once, not per render.</strong> Use <code class='tok'>@api</code> for inputs, <code class='tok'>@wire</code> for platform data, getters for flags, <code class='tok'>lwc:if</code> for branches, and stable record Ids as keys." }
            ]
          }
        ]
      },
      {
        id: "data",
        name: "Data Access",
        icon: "database",
        lessons: [
          {
            id: "lds",
            title: "Lightning Data Service and the UI API",
            summary: "Why LDS is the first choice for record data, which tool fits which job, and how to keep its cache honest after Apex writes.",
            minutes: 10,
            tags: ["lds", "ui-api", "graphql"],
            blocks: [
              { t: "p", html: "Lightning Data Service is a <strong>client-side record cache in front of the UI API</strong>. Every component on the page that asks for the same record shares one cache entry, so one fetch serves them all and a save through LDS repaints all of them. The UI API enforces CRUD, field-level security and sharing on the server, so you write no Apex and no security checks for single-record work." },
              { t: "diagram", id: "lwc-data-paths", caption: "Three data paths from a component: LDS through the UI API into a shared cache, a wired cacheable Apex method, or an imperative Apex call that may write." },
              { t: "table", headers: ["Need", "LDS tool"], rows: [
                ["Standard form, no custom layout", "<code class='tok'>lightning-record-form</code>"],
                ["Custom read layout", "<code class='tok'>lightning-record-view-form</code> with <code class='tok'>lightning-output-field</code>"],
                ["Custom edit layout", "<code class='tok'>lightning-record-edit-form</code> with <code class='tok'>lightning-input-field</code>"],
                ["Field values in JavaScript", "<code class='tok'>getRecord</code> wire plus <code class='tok'>getFieldValue</code>"],
                ["Create, update, delete from JavaScript", "<code class='tok'>createRecord</code>, <code class='tok'>updateRecord</code>, <code class='tok'>deleteRecord</code>"],
                ["Record types, picklists, field describe", "<code class='tok'>getObjectInfo</code>, <code class='tok'>getPicklistValuesByRecordType</code>"],
                ["Filtered multi-record reads without Apex", "GraphQL wire adapter in <code class='tok'>lightning/uiGraphQLApi</code>"]
              ] },
              { t: "code", lang: "javascript", code:
                "import { LightningElement, api, wire } from 'lwc';\n" +
                "import { getRecord, getFieldValue, updateRecord } from 'lightning/uiRecordApi';\n" +
                "import NAME from '@salesforce/schema/Account.Name';\n" +
                "import RATING from '@salesforce/schema/Account.Rating';\n" +
                "import ID from '@salesforce/schema/Account.Id';\n\n" +
                "/** @description Shows and updates an Account rating through LDS. */\n" +
                "export default class AccountRating extends LightningElement {\n" +
                "    /** @type {string} */\n" +
                "    @api recordId;\n\n" +
                "    @wire(getRecord, { recordId: '$recordId', fields: [NAME, RATING] })\n" +
                "    account;\n\n" +
                "    get name() { return getFieldValue(this.account.data, NAME); }\n" +
                "    get rating() { return getFieldValue(this.account.data, RATING); }\n\n" +
                "    async handleHot() {\n" +
                "        const fields = { [ID.fieldApiName]: this.recordId, [RATING.fieldApiName]: 'Hot' };\n" +
                "        await updateRecord({ fields });   // every LDS reader of this record repaints\n" +
                "    }\n" +
                "}"
              },
              { t: "note", variant: "tip", html: "Import fields from <code class='tok'>@salesforce/schema</code> instead of writing strings. The platform then knows the component depends on <code class='tok'>Account.Rating</code>, blocks deleting the field while it is referenced, and a typo fails at deploy instead of at runtime." },
              { t: "h", text: "Keeping LDS honest after Apex writes" },
              { t: "code", lang: "javascript", code:
                "import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';\n" +
                "import closeCases from '@salesforce/apex/CaseController.closeCases';\n\n" +
                "async handleCloseAll() {\n" +
                "    this.isLoading = true;\n" +
                "    try {\n" +
                "        const updatedIds = await closeCases({ accountId: this.recordId });\n" +
                "        await notifyRecordUpdateAvailable(updatedIds.map((id) => ({ recordId: id })));\n" +
                "    } catch (error) {\n" +
                "        this.error = error;\n" +
                "    } finally {\n" +
                "        this.isLoading = false;\n" +
                "    }\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "LDS only knows about writes that went through it. Apex, Flow, integrations and other users change records behind its back. After your own Apex write, call <code class='tok'>notifyRecordUpdateAvailable</code> (the successor to the older notify-change helper); for changes made elsewhere, refresh on a user action or subscribe to events." },
              { t: "table", headers: ["Tier", "Single-record UI", "Trade-off"], rows: [
                ["Naive", "Apex controller that queries the record and returns it", "A class and test to maintain, security on you, no shared cache"],
                ["Solid", "Record forms or <code class='tok'>getRecord</code> with schema imports", "No Apex; layout flexibility bounded by the base components"],
                ["Standout", "LDS for records, GraphQL for read-only lists, Apex only for logic, plus notify after Apex writes", "One consistent cache across the page; Apex shrinks to real business logic"]
              ] },
              { t: "stat", items: [
                { v: "0", k: "Apex classes for single-record CRUD" },
                { v: "1", k: "shared cache entry per record per page" },
                { v: "CRUD + FLS + sharing", k: "enforced by the UI API" }
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a component that shows or edits fields of the record on the current page, two components that disagree after a save, a request to read picklist values by record type, or an Apex controller whose only job is to return one record." },
              { t: "note", variant: "key", html: "<strong>LDS first, Apex when you need logic.</strong> LDS gives you a shared cache and built-in security for free; the price is that it only sees its own writes, so notify it after Apex changes records." }
            ]
          },
          {
            id: "wire-vs-imperative",
            title: "Wire vs imperative Apex",
            summary: "When to wire a cacheable method, when to call Apex imperatively, and how to refresh without stale screens.",
            minutes: 11,
            tags: ["apex", "wire", "refreshapex"],
            blocks: [
              { t: "p", html: "When LDS cannot express the query or the logic, you call Apex, and there are two ways to do it. <strong>Wire</strong> is declarative: the platform calls a read-only, cacheable method when the component loads and again whenever a reactive parameter changes. <strong>Imperative</strong> is a promise you call yourself, when you choose, and the only option for DML." },
              { t: "table", headers: ["Criterion", "@wire", "Imperative"], rows: [
                ["Who triggers it", "The platform, on load and on '$param' change", "Your code, usually a user action"],
                ["Caching", "Requires <code class='tok'>cacheable=true</code>; cached on the client", "None unless the method is cacheable"],
                ["DML allowed", "No", "Yes, in a non-cacheable method"],
                ["Loading state", "Implicit; data or error arrives", "You own an isLoading flag with finally"],
                ["Refresh", "<code class='tok'>refreshApex(wiredResult)</code>", "Call again, then refresh related wires"]
              ] },
              { t: "widget", id: "obDataPathPicker" },
              { t: "h", text: "The controller behind it" },
              { t: "code", lang: "java", code:
                "/**\n" +
                " * @description Controller for the openOpportunities LWC. LAYER: Controller. SHARING: with sharing.\n" +
                " */\n" +
                "public with sharing class OpportunityController {\n" +
                "    private static final String CLS = 'OpportunityController';\n\n" +
                "    @AuraEnabled(cacheable=true)\n" +
                "    public static List<Opportunity> getOpen(Id accountId) {\n" +
                "        try {\n" +
                "            if (accountId == null) { return new List<Opportunity>(); }\n" +
                "            return OpportunitySelector.newInstance().selectOpenByAccount(accountId); // WITH USER_MODE inside\n" +
                "        } catch (Exception ex) {\n" +
                "            throw new AuraHandledException(ex.getMessage());\n" +
                "        }\n" +
                "    }\n\n" +
                "    @AuraEnabled\n" +
                "    public static void closeLost(List<Id> opportunityIds) {\n" +
                "        try {\n" +
                "            OpportunityService.getInstance().closeLost(opportunityIds); // AccessLevel.USER_MODE DML\n" +
                "        } catch (Exception ex) {\n" +
                "            throw new AuraHandledException(ex.getMessage());\n" +
                "        }\n" +
                "    }\n" +
                "}"
              },
              { t: "code", lang: "javascript", code:
                "import { LightningElement, api, wire } from 'lwc';\n" +
                "import { refreshApex } from '@salesforce/apex';\n" +
                "import getOpen from '@salesforce/apex/OpportunityController.getOpen';\n" +
                "import closeLost from '@salesforce/apex/OpportunityController.closeLost';\n\n" +
                "/** @description Open opportunities with a bulk close-lost action. */\n" +
                "export default class OpenOpportunities extends LightningElement {\n" +
                "    /** @type {string} */\n" +
                "    @api recordId;\n" +
                "    wiredResult;\n" +
                "    rows = [];\n" +
                "    isLoading = false;\n\n" +
                "    @wire(getOpen, { accountId: '$recordId' })\n" +
                "    wiredOpen(result) {\n" +
                "        this.wiredResult = result;            // keep the whole provisioned object\n" +
                "        if (result.data) { this.rows = result.data; }\n" +
                "    }\n\n" +
                "    async handleCloseLost() {\n" +
                "        this.isLoading = true;\n" +
                "        try {\n" +
                "            await closeLost({ opportunityIds: this.selectedIds });\n" +
                "            await refreshApex(this.wiredResult);\n" +
                "        } catch (error) {\n" +
                "            this.error = error;\n" +
                "        } finally {\n" +
                "            this.isLoading = false;\n" +
                "        }\n" +
                "    }\n" +
                "}"
              },
              { t: "note", variant: "trap", html: "<code class='tok'>refreshApex</code> needs the exact object the wire service provisioned. Passing <code class='tok'>this.wiredResult.data</code> or a copy you built does nothing useful. Wire to a function, store <code class='tok'>result</code>, and refresh that." },
              { t: "note", variant: "warn", html: "LWC does not filter what Apex returns. The Apex itself must be <code class='tok'>with sharing</code> and its SOQL <code class='tok'>WITH USER_MODE</code> (see <code class='tok'>#/sec/code/user-mode</code>); never mix a user-mode read with a system-mode write in the same flow." },
              { t: "table", headers: ["Tier", "Approach", "Why it scores that way"], rows: [
                ["Naive", "Imperative Apex in connectedCallback for every read, no refresh after writes", "No caching, no reactivity, stale lists after saves"],
                ["Solid", "Wire cacheable reads, imperative writes, refreshApex on the stored result", "Correct data flow; one component stays consistent"],
                ["Standout", "LDS or GraphQL first, thin controllers with AuraHandledException, user-mode selectors, refreshApex plus notifyRecordUpdateAvailable", "Consistent across the whole page, secure by construction, easy to test"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a list that does not update after a button saves, an attempt to put DML in a cacheable method, a spinner that never stops (missing finally), or a question about why a wire did not re-run (the parameter was not prefixed with '$')." },
              { t: "quiz", id: "lwc-data" },
              { t: "note", variant: "key", html: "<strong>Wire reads, call writes, then refresh what you broke.</strong> Cacheable methods are pure reads; DML goes through an imperative non-cacheable call, followed by <code class='tok'>refreshApex</code> for your wires and <code class='tok'>notifyRecordUpdateAvailable</code> for LDS." }
            ]
          }
        ]
      },
      {
        id: "comm",
        name: "Communication",
        icon: "share",
        lessons: [
          {
            id: "events",
            title: "Component events: up, down and across",
            summary: "Data down through @api, notifications up through CustomEvent, and exactly what bubbles and composed change.",
            minutes: 11,
            tags: ["events", "shadow-dom", "customevent"],
            blocks: [
              { t: "p", html: "The communication rule is short: <strong>properties go down, events go up</strong>. A parent sets a child's <code class='tok'>@api</code> properties or calls its <code class='tok'>@api</code> methods; a child announces that something happened by dispatching a <code class='tok'>CustomEvent</code>. An event is a notification, not a command, and the child should not care who listens." },
              { t: "code", lang: "javascript", code:
                "// c-child: announce a selection; keep the payload small and immutable\n" +
                "handleRowClick(event) {\n" +
                "    const recordId = event.currentTarget.dataset.id;\n" +
                "    this.dispatchEvent(new CustomEvent('select', {\n" +
                "        detail: { recordId },\n" +
                "        bubbles: false,\n" +
                "        composed: false\n" +
                "    }));\n" +
                "}"
              },
              { t: "code", lang: "text", code:
                '<!-- c-parent template: listen on the child element itself -->\n' +
                '<template>\n' +
                '    <div class="list">\n' +
                '        <c-child records={records} onselect={handleSelect}></c-child>\n' +
                '    </div>\n' +
                '</template>'
              },
              { t: "table", headers: ["bubbles", "composed", "Where it goes"], rows: [
                ["false", "false", "Only the child's host element, in the parent's template. The default and the recommendation"],
                ["true", "false", "Up through the parent's shadow tree to its shadow root; never leaves the parent"],
                ["false", "true", "Crosses shadow boundaries but only invokes hosts: c-child, then c-parent, then c-grandparent"],
                ["true", "true", "Every ancestor in every tree up to the document. Public API for the whole page"]
              ] },
              { t: "widget", id: "obEventLab" },
              { t: "note", variant: "trap", html: "An event that is <code class='tok'>composed:true</code> leaks its name and payload into every ancestor's tree, including components you do not own. It becomes part of your public API and collides with anyone else's event of the same name. Reach for it only when you are building a deliberate cross-boundary contract." },
              { t: "h", text: "Payload and naming rules" },
              { t: "ul", items: [
                "Event names are lowercase with no spaces and no <code class='tok'>on</code> prefix: dispatch <code class='tok'>select</code>, listen with <code class='tok'>onselect</code>.",
                "Put primitives or fresh copies in <code class='tok'>detail</code>; never hand a listener a live reference to your internal state.",
                "Use <code class='tok'>event.currentTarget.dataset</code> to read ids set through <code class='tok'>data-id</code> on the clicked element.",
                "To command a child, call an <code class='tok'>@api</code> method on it via <code class='tok'>lwc:ref</code>; do not dispatch events downward.",
                "Siblings talk through their shared parent: one emits up, the parent sets the other's <code class='tok'>@api</code> property."
              ] },
              { t: "table", headers: ["Tier", "Reaching a distant component", "Trade-off"], rows: [
                ["Naive", "bubbles:true, composed:true and listen on document", "Works until two components pick the same name; couples you to the page shape"],
                ["Solid", "Default event to the parent, parent re-dispatches or sets @api state", "Explicit contract at each level; a little more wiring"],
                ["Standout", "Parent-mediated inside a feature, Lightning Message Service between unrelated regions", "Each boundary is deliberate; no hidden global event names"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a handler on a grandparent that never fires, an event caught in two places at once, a sibling that needs to react to another sibling, or a question about what <code class='tok'>composed</code> actually does." },
              { t: "note", variant: "key", html: "<strong>Default to bubbles:false, composed:false and listen on the child element.</strong> composed crosses boundaries and only invokes hosts unless it also bubbles; for anything beyond one parent, mediate through the parent or use LMS." }
            ]
          },
          {
            id: "lms",
            title: "Lightning Message Service",
            summary: "Publish and subscribe across unrelated components on a page with message channels, scopes and clean subscriptions.",
            minutes: 9,
            tags: ["lms", "message-channel", "pub-sub"],
            blocks: [
              { t: "p", html: "Lightning Message Service is a <strong>page-level bus with named, typed channels</strong>. A publisher sends a small message on a channel; any subscriber on the page receives it, whether it is an LWC, an Aura component or a Visualforce page. No DOM relationship is needed, which is precisely why it suits components dropped into different regions of a Lightning page." },
              { t: "code", lang: "text", code:
                '<!-- force-app/main/default/messageChannels/Record_Selected.messageChannel-meta.xml -->\n' +
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<!-- metadata namespace attribute omitted for brevity -->\n' +
                '<LightningMessageChannel>\n' +
                '    <masterLabel>Record Selected</masterLabel>\n' +
                '    <isExposed>true</isExposed>\n' +
                '    <description>Published when a user selects a record in a list region.</description>\n' +
                '    <lightningMessageFields>\n' +
                '        <fieldName>recordId</fieldName>\n' +
                '        <description>Id of the selected record</description>\n' +
                '    </lightningMessageFields>\n' +
                '</LightningMessageChannel>'
              },
              { t: "code", lang: "javascript", code:
                "import { LightningElement, wire } from 'lwc';\n" +
                "import { subscribe, unsubscribe, publish, MessageContext, APPLICATION_SCOPE } from 'lightning/messageService';\n" +
                "import RECORD_SELECTED from '@salesforce/messageChannel/Record_Selected__c';\n\n" +
                "/** @description Detail panel that follows the selection made in another region. */\n" +
                "export default class DetailPanel extends LightningElement {\n" +
                "    @wire(MessageContext) messageContext;\n" +
                "    subscription = null;\n" +
                "    selectedId;\n\n" +
                "    connectedCallback() {\n" +
                "        if (!this.subscription) {\n" +
                "            this.subscription = subscribe(this.messageContext, RECORD_SELECTED,\n" +
                "                (message) => { this.selectedId = message.recordId; },\n" +
                "                { scope: APPLICATION_SCOPE });\n" +
                "        }\n" +
                "    }\n\n" +
                "    disconnectedCallback() {\n" +
                "        unsubscribe(this.subscription);\n" +
                "        this.subscription = null;\n" +
                "    }\n" +
                "}\n\n" +
                "// publisher, in any other component:\n" +
                "// publish(this.messageContext, RECORD_SELECTED, { recordId: id });"
              },
              { t: "table", headers: ["Scope", "Who receives", "Use it when"], rows: [
                ["Default (active area)", "Subscribers in the active area of the app, such as the current tab", "Most record-page coordination"],
                ["<code class='tok'>APPLICATION_SCOPE</code>", "Subscribers anywhere in the application, including background tabs and the utility bar", "A utility bar component must follow every selection"]
              ] },
              { t: "note", variant: "warn", html: "LMS lives in the browser page. Messages are not stored, not replayed to late subscribers, and never reach another browser, another user or Apex. For server-to-browser notifications, publish a platform event and subscribe with <code class='tok'>lightning/empApi</code> (see <code class='tok'>#/apex/async/platform-events</code>)." },
              { t: "table", headers: ["Relationship", "Pattern", "Why"], rows: [
                ["Parent to child", "<code class='tok'>@api</code> property or method", "Explicit, typed, testable"],
                ["Child to parent", "<code class='tok'>CustomEvent</code>, default options", "Contained, no leakage"],
                ["Siblings under your parent", "Event up, property down", "The parent owns shared state"],
                ["Unrelated regions on a page", "Lightning Message Service", "No DOM path needed; works across LWC, Aura, Visualforce"],
                ["Server to open pages", "Platform events plus empApi", "Only server-side messaging can reach browsers"]
              ] },
              { t: "note", variant: "tip", html: "The old <code class='tok'>pubsub</code> helper module from early samples is legacy; the house standard is LMS. Keep messages tiny (ids and flags) and let subscribers load data through LDS, so the bus never becomes a second data layer." },
              { t: "compare",
                bad: { title: "Bus misuse", items: ["Publishing whole records with every field", "Subscribing in renderedCallback", "One generic channel carrying many message shapes", "Using LMS to talk between a parent and its own child"] },
                good: { title: "Bus discipline", items: ["Publish ids; subscribers read via LDS", "Subscribe once in connectedCallback, release in disconnectedCallback", "One channel per intent with declared fields", "Events and @api inside a component tree"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> two components in different page regions or the utility bar that must stay in step, an Aura or Visualforce page that must talk to an LWC, or a team still using a pubsub module." },
              { t: "quiz", id: "lwc-comm" },
              { t: "note", variant: "key", html: "<strong>LMS is for unrelated components on one page; events and @api are for a tree; platform events are for the server.</strong> Publish small messages on intent-named channels and release subscriptions in disconnectedCallback." }
            ]
          }
        ]
      },
      {
        id: "ux",
        name: "UX & Accessibility",
        icon: "diamond",
        lessons: [
          {
            id: "slds-styling",
            title: "Styling with SLDS and styling hooks",
            summary: "Base components first, SLDS utilities second, and CSS custom properties instead of selectors that fight shadow DOM.",
            minutes: 9,
            tags: ["slds", "styling-hooks", "css"],
            blocks: [
              { t: "p", html: "Style in three layers and stop at the first one that works: <strong>base components</strong>, then <strong>SLDS utility classes</strong>, then a small component CSS file that sets <strong>styling hooks</strong> and theme tokens. Every layer you skip is code you maintain against a design system that keeps moving." },
              { t: "table", headers: ["Layer", "What it gives you", "Example"], rows: [
                ["Base components", "Markup, accessibility and theming already done", "<code class='tok'>lightning-card</code>, <code class='tok'>lightning-datatable</code>, <code class='tok'>lightning-layout</code>"],
                ["SLDS utilities", "Spacing, grid, text and visibility without custom CSS", "<code class='tok'>slds-p-around_medium</code>, <code class='tok'>slds-truncate</code>"],
                ["Styling hooks", "Supported CSS custom properties that cross the shadow boundary", "A component-level hook such as a brand button background"],
                ["Theme tokens", "Colours that follow light and dark themes", "<code class='tok'>var(--lwc-colorTextWeak)</code> with a fallback"]
              ] },
              { t: "code", lang: "text", code:
                '<template>\n' +
                '    <lightning-card title="Renewal risk" icon-name="standard:opportunity">\n' +
                '        <lightning-layout multiple-rows>\n' +
                '            <lightning-layout-item size="12" medium-device-size="6" padding="around-small">\n' +
                '                <p class="slds-text-heading_small slds-truncate">{accountName}</p>\n' +
                '            </lightning-layout-item>\n' +
                '            <lightning-layout-item size="12" medium-device-size="6" padding="around-small">\n' +
                '                <lightning-button class="renew" variant="brand" label="Start renewal" onclick={handleRenew}></lightning-button>\n' +
                '            </lightning-layout-item>\n' +
                '        </lightning-layout>\n' +
                '    </lightning-card>\n' +
                '</template>'
              },
              { t: "code", lang: "text", code:
                "/* renewalRisk.css */\n" +
                ":host {\n" +
                "    display: block;\n" +
                "}\n\n" +
                "/* set the documented hook; never select the button's internals */\n" +
                ".renew {\n" +
                "    --slds-c-button-brand-color-background: var(--lwc-brandAccessible, #0b5cab);\n" +
                "    --slds-c-button-brand-color-border: var(--lwc-brandAccessible, #0b5cab);\n" +
                "}\n\n" +
                ".muted {\n" +
                "    color: var(--lwc-colorTextWeak, #5c5c5c);\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "Styling hook names differ between SLDS generations: component hooks use <code class='tok'>--slds-c-</code> (the early <code class='tok'>--sds-c-</code> prefix is legacy), and SLDS 2 adds global hooks under <code class='tok'>--slds-g-</code>. Check the hooks a base component documents for your org's release rather than copying a name from memory." },
              { t: "p", html: "Shadow DOM is why hooks exist. Your CSS applies only to your own template, a parent cannot reach into a child, and nobody can reliably select a base component's internal markup. Custom properties are inherited through the boundary, so a component that reads a hook can be themed from outside without exposing its structure." },
              { t: "compare",
                bad: { title: "Fighting the system", items: ["Inline style attributes in templates", "Hard-coded hex colours that break dark themes", "Descendant selectors aimed at base component internals", "!important to win specificity wars", "Fixed pixel widths that scroll sideways on phones"] },
                good: { title: "Working with it", items: ["SLDS utilities and lightning-layout for structure", "Theme tokens with sensible fallbacks", "Documented styling hooks on the host or a class", "Variants passed through @api for child appearance", "Percentages and layout sizes per form factor"] } },
              { t: "table", headers: ["Tier", "Theming a component", "Cost"], rows: [
                ["Naive", "Custom div markup with hex colours and inline styles", "Breaks on theme changes and fails security and code review"],
                ["Solid", "Base components plus SLDS utilities, colours from tokens", "Consistent and theme-safe; limited to what the system offers"],
                ["Standout", "Expose your own custom properties and @api variants, set base component hooks, test light and dark themes", "Reusable components others can theme without forking"]
              ] },
              { t: "note", variant: "tip", html: "Preview every component in both light and dark themes and at phone width before review. Most styling defects are a hard-coded colour or a fixed width that only shows up in the other theme or the Small form factor." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> a parent's CSS that does not affect a child, a request to recolour a base component, a component unreadable in dark mode, or a reviewer flagging inline style attributes in a template." },
              { t: "note", variant: "key", html: "<strong>Base components, then SLDS utilities, then hooks and tokens.</strong> Never inline styles, never hex colours, never selectors into someone else's shadow tree: custom properties are the only supported way across the boundary." }
            ]
          },
          {
            id: "a11y",
            title: "Accessible components",
            summary: "Labels, keyboard paths, focus management and live regions that make a component usable without a mouse or eyes.",
            minutes: 10,
            tags: ["accessibility", "aria", "keyboard"],
            blocks: [
              { t: "p", html: "An accessible component answers three questions for every user: <strong>what is this, can I reach it, and did anything happen</strong>. Base components answer most of them for you when you give them labels; custom markup makes all three your job." },
              { t: "table", headers: ["Problem", "Fix"], rows: [
                ["Input named only by a placeholder", "A real <code class='tok'>label</code>; <code class='tok'>variant=\"label-hidden\"</code> if it must be invisible"],
                ["Icon-only button", "<code class='tok'>lightning-button-icon</code> with <code class='tok'>alternative-text</code>"],
                ["Clickable div", "A real <code class='tok'>button</code> element: focusable and Enter or Space activate it"],
                ["Silent status change", "Native <code class='tok'>output</code> element as a polite live region"],
                ["Error far from the field", "<code class='tok'>setCustomValidity</code> and <code class='tok'>reportValidity</code>, or <code class='tok'>aria-describedby</code>"],
                ["State shown by colour alone", "Add text or an icon with alternative text"]
              ] },
              { t: "code", lang: "text", code:
                '<template>\n' +
                '    <h2 class="slds-text-heading_medium" tabindex="-1" lwc:ref="heading">Payment details</h2>\n' +
                '    <lightning-input label="Search invoices" type="search" variant="label-hidden"\n' +
                '        placeholder="Invoice number" onchange={handleSearch}></lightning-input>\n' +
                '    <lightning-input label="Amount" type="number" lwc:ref="amount" required></lightning-input>\n' +
                '    <lightning-button-icon icon-name="utility:refresh" alternative-text="Refresh invoices"\n' +
                '        onclick={handleRefresh}></lightning-button-icon>\n' +
                '    <output class="slds-assistive-text">{statusMessage}</output>\n' +
                '    <template lwc:if={errorMessage}>\n' +
                '        <div class="slds-notify slds-notify_alert slds-alert_error" role="alert">\n' +
                '            <h2>{errorMessage}</h2>\n' +
                '        </div>\n' +
                '    </template>\n' +
                '</template>'
              },
              { t: "code", lang: "javascript", code:
                "async handleSave() {\n" +
                "    const amount = this.refs.amount;\n" +
                "    if (!amount.reportValidity()) { return; }      // error shown and announced on the field\n" +
                "    try {\n" +
                "        await savePayment({ amount: amount.value });\n" +
                "        this.statusMessage = 'Payment saved';         // polite announcement via output\n" +
                "        this.refs.heading.focus();                    // move focus somewhere meaningful\n" +
                "    } catch (error) {\n" +
                "        this.errorMessage = 'The payment could not be saved.';\n" +
                "    }\n" +
                "}"
              },
              { t: "note", variant: "trap", html: "A placeholder is not a label. It vanishes as soon as the user types, many screen readers treat it inconsistently, and its low contrast fails sighted users too. Every input needs a label even when the design hides it." },
              { t: "h", text: "Keyboard and focus checklist" },
              { t: "ul", items: [
                "Tab reaches every control in a logical order; nothing focusable is hidden, nothing interactive is unreachable.",
                "Enter and Space activate buttons; Escape closes dialogs. Use <code class='tok'>lightning-modal</code>, which traps and restores focus for you.",
                "After an async action, move focus to the result or heading so keyboard users are not stranded at the top of the page.",
                "Use <code class='tok'>tabindex=\"-1\"</code> only to make a heading programmatically focusable; avoid positive tabindex values.",
                "Touch targets are at least 44 by 44 pixels, including padding on icon buttons."
              ] },
              { t: "table", headers: ["Tier", "Accessibility practice", "What reviewers see"], rows: [
                ["Naive", "Mouse-only testing; placeholders as labels; colour-coded status", "Unusable with a keyboard or screen reader"],
                ["Solid", "Base components with labels and alternative text, output for status, role alert for errors", "Meets the common checks with little custom work"],
                ["Standout", "Keyboard-only and screen reader passes per release, focus managed after async work, automated accessibility assertions in Jest", "Regressions caught in CI, not by users"]
              ] },
              { t: "note", variant: "tip", html: "Automated checks catch missing names and roles but not a confusing focus order. Pair an accessibility assertion library in your Jest suite with a five-minute keyboard-only walkthrough of every new component." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> icon-only buttons, a custom dropdown built from divs, a toast as the only feedback, a modal that loses focus on close, or status that changes colour without text." },
              { t: "quiz", id: "lwc-ux" },
              { t: "note", variant: "key", html: "<strong>Name it, reach it, announce it.</strong> Label every control, make every action keyboard-operable with managed focus, and announce outcomes through output for status and role alert for errors." }
            ]
          }
        ]
      }
    ]
  };
})();
