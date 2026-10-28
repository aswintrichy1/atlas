/* =====================================================================
   LEDGER · Engine Lab  (route: #/lab)
   window.LedgerLab = { mount(main) }

   One bench for the flagship simulators. The widgets themselves are owned
   and registered by the track files; this page only picks one to mount and
   lists every lab in the atlas with a link to the lesson that teaches it.
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
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  var BENCH = [
    { id: "storeBtree", label: "B+tree splits", blurb: "Insert keys into a B+tree of a chosen order and watch leaf and inner pages split and the tree grow from the root." },
    { id: "storeLsm", label: "LSM compaction", blurb: "Fill the memtable, flush SSTables into level 0, then compact with a leveled or size-tiered policy and compare amplification." },
    { id: "txnIsolation", label: "Isolation anomalies", blurb: "Step two concurrent transactions through dirty reads, lost updates, phantoms and write skew under each isolation level." },
    { id: "qpJoinCost", label: "Join cost", blurb: "Size two relations and a memory budget, then compare nested-loop, index, hash and sort-merge join I/O side by side." }
  ];

  var ORDER = ["store", "idx", "qp", "txn", "dist", "pg", "col", "sql"];

  function catalog() {
    var T = window.TRACKS || {};
    var rows = [];
    ORDER.forEach(function (tid) {
      var tr = T[tid];
      if (!tr || !tr.modules) return;
      tr.modules.forEach(function (mod) {
        (mod.lessons || []).forEach(function (ls) {
          (ls.blocks || []).forEach(function (b) {
            if (b && b.t === "widget") rows.push({ track: tr, mod: mod, lesson: ls, id: b.id });
          });
        });
      });
    });
    return rows;
  }

  function mount(main) {
    var W = window.Widgets || {};
    var bench = BENCH.filter(function (b) { return typeof W[b.id] === "function"; });
    clear(main);

    var art = h("article", { class: "lesson" });
    art.appendChild(h("nav", { class: "crumbs" },
      h("a", { href: "#/" }, "Home"), h("span", { class: "sep" }, "/"), h("span", {}, "Engine Lab")));
    art.appendChild(h("header", { class: "lesson-head reveal in" },
      h("p", { class: "path-kicker" }, "Interactive"),
      h("h1", {}, "Engine Lab"),
      h("p", { class: "summary" }, "The four flagship simulators on one bench. Everything runs locally in your browser and is deterministic, so you can repeat an experiment and get the same answer.")));

    var body = h("div", { class: "lesson-body" });
    if (!bench.length) {
      body.appendChild(h("div", { class: "empty-state" }, h("h3", {}, "No simulators loaded"), h("p", {}, "The track files that register the lab widgets did not load.")));
      art.appendChild(body);
      main.appendChild(art);
      return;
    }

    var desc = h("p", { class: "widget-desc" }, "");
    var slotWrap = h("div", {});
    var seg = h("div", { class: "w-seg", role: "tablist", "aria-label": "Choose a simulator" });
    var btns = [];
    function pick(i) {
      btns.forEach(function (b, j) {
        b.classList.toggle("active", j === i);
        b.setAttribute("aria-selected", j === i ? "true" : "false");
      });
      desc.textContent = bench[i].blurb;
      clear(slotWrap);
      var slot = h("div", { class: "widget-mount", "data-widget": bench[i].id });
      slotWrap.appendChild(slot);
      try { W[bench[i].id](slot); }
      catch (e) { clear(slot); slot.appendChild(h("div", { class: "note warn" }, h("div", { class: "note-body" }, "This simulator failed to load."))); }
    }
    bench.forEach(function (b, i) {
      var btn = h("button", { type: "button", class: "w-seg-btn", role: "tab" }, b.label);
      btn.addEventListener("click", function () { pick(i); });
      btns.push(btn);
      seg.appendChild(btn);
    });
    body.appendChild(h("div", { class: "widget-controls" }, seg));
    body.appendChild(desc);
    body.appendChild(slotWrap);

    var rows = catalog();
    if (rows.length) {
      body.appendChild(h("h2", { class: "block-h", id: "every-lab" }, "Every lab in the atlas"));
      var tbody = h("tbody", {});
      rows.forEach(function (r) {
        var route = "#/" + r.track.id + "/" + r.mod.id + "/" + r.lesson.id;
        tbody.appendChild(h("tr", {},
          h("td", {}, r.track.short),
          h("td", {}, h("a", { class: "inline", href: route }, r.lesson.title)),
          h("td", {}, h("code", { class: "tok" }, r.id))));
      });
      body.appendChild(h("div", { class: "table-wrap" },
        h("table", { class: "data" },
          h("thead", {}, h("tr", {}, h("th", {}, "Track"), h("th", {}, "Lesson"), h("th", {}, "Lab"))),
          tbody)));
    }

    art.appendChild(body);
    main.appendChild(art);
    pick(0);
    try { window.scrollTo(0, 0); main.scrollTop = 0; } catch (e) {}
  }

  window.LedgerLab = { mount: mount };
})();
