/* =====================================================================
   CASCADE · Data Modeling & Warehousing track  (curriculum + quizzes + widgets)
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var h = WK.h, svgEl = WK.svgEl, shell = WK.shell;

  function seg(opts, getCur, onPick) {
    var s = h("div", { class: "w-seg" });
    opts.forEach(function (o) {
      var b = h("button", { class: o.v === getCur() ? "active" : "" }, o.label);
      b.addEventListener("click", function () {
        onPick(o.v);
        s.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
      });
      s.appendChild(b);
    });
    return s;
  }
  function ro(label, value, accent) {
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent)" } : {}, value));
  }
  function smallGrid(title, cols, rows, opt) {
    opt = opt || {};
    var wrap = h("div", { style: "margin:6px 0" });
    if (title) wrap.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.64rem;color:var(--text-faint);margin-bottom:4px" }, title));
    var board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(" + cols.length + ",minmax(56px,1fr));gap:3px" });
    cols.forEach(function (c) { board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:5px;font-family:var(--font-mono);font-size:.6rem;color:var(--text-dim)" }, c)); });
    rows.forEach(function (r, ri) {
      r.forEach(function (cell) {
        board.appendChild(h("div", { class: "grid-cell" + (opt.fillRow === ri ? " dp-fill" : ""), style: "width:auto;height:auto;padding:6px 4px;font-size:.7rem" }, String(cell)));
      });
    });
    wrap.appendChild(board);
    return wrap;
  }

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  window.Widgets = window.Widgets || {};

  /* 1 — Normalization stepper */
  window.Widgets["de-model-normalize"] = function (mount) {
    shell(mount, "visualizer", "Normalization Lab",
      "Step from a redundant table to 3NF and watch each normal form factor out a class of duplication.");
    var nf = "0";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      stage.innerHTML = "";
      var removed = 0;
      if (nf === "0") {
        stage.appendChild(smallGrid("orders (unnormalized \u2014 products jammed in one cell)",
          ["order_id", "customer", "city", "products"],
          [["1", "Ava", "NYC", "Pen; Pad"], ["2", "Ava", "NYC", "Mug"]]));
      } else if (nf === "1") {
        removed = 0;
        stage.appendChild(smallGrid("orders \u2014 1NF (atomic rows; customer & price still repeat)",
          ["order_id", "customer", "city", "product", "price"],
          [["1", "Ava", "NYC", "Pen", "2"], ["1", "Ava", "NYC", "Pad", "5"], ["2", "Ava", "NYC", "Mug", "8"]]));
      } else if (nf === "2") {
        removed = 3;
        stage.appendChild(smallGrid("order_lines \u2014 2NF (price moved out: it depends on product, not the order)",
          ["order_id", "product"],
          [["1", "Pen"], ["1", "Pad"], ["2", "Mug"]]));
        stage.appendChild(smallGrid("products", ["product", "price"], [["Pen", "2"], ["Pad", "5"], ["Mug", "8"]]));
        stage.appendChild(smallGrid("orders", ["order_id", "customer", "city"], [["1", "Ava", "NYC"], ["2", "Ava", "NYC"]]));
      } else {
        removed = 5;
        stage.appendChild(smallGrid("order_lines", ["order_id", "product"], [["1", "Pen"], ["1", "Pad"], ["2", "Mug"]]));
        stage.appendChild(smallGrid("products", ["product", "price"], [["Pen", "2"], ["Pad", "5"], ["Mug", "8"]]));
        stage.appendChild(smallGrid("orders \u2014 3NF (city moved out: it depends on customer, not the order)", ["order_id", "customer_id"], [["1", "c1"], ["2", "c1"]]));
        stage.appendChild(smallGrid("customers", ["customer_id", "customer", "city"], [["c1", "Ava", "NYC"]], { fillRow: 0 }));
      }
      readout.innerHTML = "";
      readout.appendChild(ro("normal form", nf === "0" ? "unnormalized" : nf + "NF", true));
      readout.appendChild(ro("redundant cells removed", String(removed)));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "0", label: "Unnormalized" }, { v: "1", label: "1NF" }, { v: "2", label: "2NF" }, { v: "3", label: "3NF" }],
        function () { return nf; }, function (v) { nf = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 2 — Star schema explorer */
  window.Widgets["de-model-star"] = function (mount) {
    shell(mount, "explorer", "Star Schema Explorer",
      "A central fact surrounded by dimensions. Click a dimension to see its attributes and the join.");
    var dims = [
      { id: "date", label: "dim_date", x: 90, y: 60, attrs: ["date_key", "day", "month", "quarter", "year"] },
      { id: "cust", label: "dim_customer", x: 370, y: 60, attrs: ["customer_key", "name", "segment", "country"] },
      { id: "prod", label: "dim_product", x: 90, y: 240, attrs: ["product_key", "name", "category", "brand"] },
      { id: "store", label: "dim_store", x: 370, y: 240, attrs: ["store_key", "name", "region"] }
    ];
    var sel = "cust";
    var svg = svgEl("svg", { class: "graph-svg", viewBox: "0 0 460 300", role: "img" });
    var panel = h("div", { class: "w-stage" });
    function paint() {
      svg.innerHTML = "";
      dims.forEach(function (d) {
        svg.appendChild(svgEl("path", { class: "gt-edge" + (d.id === sel ? " tree" : ""), d: "M230 150 L" + d.x + " " + d.y }));
      });
      // fact
      var f = svgEl("g", { class: "gt-node current" });
      f.appendChild(svgEl("circle", { cx: 230, cy: 150, r: 30 }));
      var ft = svgEl("text", { x: 230, y: 150 }); ft.textContent = "fact_sales"; f.appendChild(ft);
      svg.appendChild(f);
      dims.forEach(function (d) {
        var g = svgEl("g", { class: "gt-node" + (d.id === sel ? " visited" : " frontier"), style: "cursor:pointer" });
        g.appendChild(svgEl("circle", { cx: d.x, cy: d.y, r: 26 }));
        var t = svgEl("text", { x: d.x, y: d.y }); t.textContent = d.label.replace("dim_", ""); g.appendChild(t);
        g.addEventListener("click", function () { sel = d.id; paint(); });
        svg.appendChild(g);
      });
      var d = dims.filter(function (x) { return x.id === sel; })[0];
      panel.innerHTML = "";
      panel.appendChild(h("div", { class: "w-readout" }, ro("grain", "one row per sale line", true)));
      panel.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:.66rem;color:var(--text-faint);margin:10px 0 4px" }, d.label + " attributes"));
      var chips = h("div", { class: "w-seg" });
      d.attrs.forEach(function (a, i) { chips.appendChild(h("button", { class: i === 0 ? "active" : "" }, a)); });
      panel.appendChild(chips);
      panel.appendChild(h("div", { class: "code-card", style: "margin-top:10px" },
        h("pre", {}, h("code", { style: "font-size:.72rem" },
          "SELECT d." + d.attrs[1] + ", SUM(f.amount)\nFROM fact_sales f\nJOIN " + d.label + " d ON d." + d.attrs[0] + " = f." + d.attrs[0] + "\nGROUP BY 1"))));
    }
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(panel);
    paint();
  };

  /* 3 — SCD Type-2 stepper */
  window.Widgets["de-model-scd2"] = function (mount) {
    shell(mount, "simulator", "SCD Type-2 History",
      "Apply a change to a customer and watch a new versioned row open while the old one closes.");
    var sk = 100;
    var rows = [{ sk: sk, city: "NYC", segment: "SMB", eff: "2024-01-01", end: "\u2014", cur: "Y" }];
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function change(field, val) {
      var open = rows[rows.length - 1];
      open.end = "2024-06-01"; open.cur = "N";
      sk += 1;
      var nr = { sk: sk, city: open.city, segment: open.segment, eff: "2024-06-01", end: "\u2014", cur: "Y" };
      nr[field] = val;
      rows.push(nr);
      paint();
    }
    function paint() {
      stage.innerHTML = "";
      var board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(6,minmax(52px,1fr));gap:3px" });
      ["cust_sk", "city", "segment", "eff_date", "end_date", "is_current"].forEach(function (c) {
        board.appendChild(h("div", { class: "grid-cell", style: "width:auto;height:auto;padding:5px;font-family:var(--font-mono);font-size:.58rem;color:var(--text-dim)" }, c));
      });
      rows.forEach(function (r, i) {
        var newest = i === rows.length - 1;
        [r.sk, r.city, r.segment, r.eff, r.end, r.cur].forEach(function (v) {
          board.appendChild(h("div", { class: "grid-cell" + (newest ? " dp-cur" : ""), style: "width:auto;height:auto;padding:6px 4px;font-size:.68rem" + (r.cur === "N" ? ";opacity:.55" : "") }, String(v)));
        });
      });
      stage.appendChild(board);
      readout.innerHTML = "";
      readout.appendChild(ro("versions of this customer", String(rows.length), true));
      readout.appendChild(ro("current row", "cust_sk " + rows[rows.length - 1].sk));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { class: "w-btn primary", onclick: function () { change("city", rows[rows.length - 1].city === "NYC" ? "SF" : "NYC"); } }, "Change city"),
      h("button", { class: "w-btn", onclick: function () { change("segment", rows[rows.length - 1].segment === "SMB" ? "ENT" : "SMB"); } }, "Change segment"),
      h("button", { class: "w-btn ghost", onclick: function () { sk = 100; rows = [{ sk: sk, city: "NYC", segment: "SMB", eff: "2024-01-01", end: "\u2014", cur: "Y" }]; paint(); } }, "Reset")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* 4 — SCD Type 1 vs Type 2 walkthrough (overwrite loses history vs versioned) */
  window.Widgets["scd"] = function (mount) {
    shell(mount, "walkthrough", "SCD Type 1 vs Type 2",
      "Change a customer\u2019s city and watch each strategy treat history differently \u2014 Type 1 overwrites in place; Type 2 opens a new versioned row.");

    var COLS = ["sk", "customer_id", "name", "city", "valid_from", "valid_to", "is_current"];
    var CITY_CYCLE = ["Austin", "Denver", "Seattle", "Boston", "Portland"];
    var TODAY = new Date().toISOString().slice(0, 10); // a real, offline "today"

    function initialRows() {
      return [{
        sk: 1, customer_id: "C1", name: "Ada Lovelace", city: "Austin",
        valid_from: "2024-01-01", valid_to: null, is_current: true, _new: false, _changed: false
      }];
    }
    // Function-scoped state — a fresh copy per mount, so re-mounting is always clean.
    var rows = initialRows(), nextSk = 2, mode = "type2";

    function currentRow() {
      for (var i = rows.length - 1; i >= 0; i--) { if (rows[i].is_current) return rows[i]; }
      return rows[rows.length - 1];
    }
    function nextCity(city) {
      var i = CITY_CYCLE.indexOf(city);
      return CITY_CYCLE[(i + 1) % CITY_CYCLE.length];
    }
    function clearFlags() { rows.forEach(function (r) { r._new = false; r._changed = false; }); }
    function setText(node, str) { while (node.firstChild) node.removeChild(node.firstChild); node.appendChild(document.createTextNode(str)); }
    function bold(str) { return h("b", {}, str); }

    /* ---- DOM scaffold (built once; repainted in place, never via innerHTML of data) ---- */
    var board = h("div", { class: "grid-board scd-board" });
    var stage = h("div", { class: "w-stage" }, h("div", { class: "scd-board-wrap" }, board));
    var hint = h("p", { class: "scd-mode-hint" });
    var explain = h("p", { class: "scd-explain" });
    var readout = h("div", { class: "w-readout" });
    var changeBtn = h("button", { class: "w-btn primary", onclick: apply }, "Change city");

    function buildBoard() {
      while (board.firstChild) board.removeChild(board.firstChild);
      COLS.forEach(function (c) { board.appendChild(h("div", { class: "grid-cell scd-th" }, c)); });
      rows.forEach(function (r) {
        var expired = !r.is_current;
        var cells = [
          ["sk", String(r.sk)], ["customer_id", r.customer_id], ["name", r.name], ["city", r.city],
          ["valid_from", r.valid_from], ["valid_to", r.valid_to == null ? "NULL" : r.valid_to],
          ["is_current", r.is_current ? "\u2713" : "\u2717"]
        ];
        cells.forEach(function (pair) {
          var key = pair[0], val = pair[1], cls = "grid-cell scd-cell";
          if (r._new) cls += " dp-cur";
          else if (expired) cls += " scd-expired";
          if (r._changed && key === "city") cls += " scd-changed";
          var cell = h("div", { class: cls });
          if (key === "is_current" && !r._new) {
            cell.appendChild(h("b", { class: r.is_current ? "scd-yes" : "scd-no" }, val));
          } else {
            cell.appendChild(document.createTextNode(val));
          }
          board.appendChild(cell);
        });
      });
    }
    function paintReadout() {
      while (readout.firstChild) readout.removeChild(readout.firstChild);
      readout.appendChild(ro("versions of C1", String(rows.length), true));
      readout.appendChild(ro("strategy", mode === "type1" ? "Type 1 \u00b7 overwrite" : "Type 2 \u00b7 versioned"));
    }
    function syncHint() {
      setText(hint, mode === "type1"
        ? "Type 1 will overwrite the city in place \u2014 one row stays, the old value is lost."
        : "Type 2 will expire the current row and insert a new version \u2014 more rows, full history kept.");
    }
    function syncBtn() { setText(changeBtn, "Change city \u2192 " + nextCity(currentRow().city)); }
    function paint() { buildBoard(); paintReadout(); syncHint(); syncBtn(); }
    function explainNodes(nodes) {
      while (explain.firstChild) explain.removeChild(explain.firstChild);
      nodes.forEach(function (n) { explain.appendChild(typeof n === "string" ? document.createTextNode(n) : n); });
    }
    function showInitialExplain() {
      explainNodes(["One current version of ", bold("C1"), ". Pick a strategy, then change the city to see how history is handled."]);
    }
    function apply() {
      clearFlags();
      var cur = currentRow(), from = cur.city, to = nextCity(cur.city);
      if (mode === "type1") {
        cur.city = to; cur._changed = true; paint();
        explainNodes(["Type 1 ", bold("overwrote"), " city ", bold(from + " \u2192 " + to),
          " in place. The prior value (", bold(from), ") is gone \u2014 any history of where ", bold("C1"),
          " used to live is lost. Still ", bold("1"), " row."]);
      } else {
        cur.valid_to = TODAY; cur.is_current = false;
        rows.push({ sk: nextSk++, customer_id: cur.customer_id, name: cur.name, city: to,
          valid_from: TODAY, valid_to: null, is_current: true, _new: true, _changed: false });
        paint();
        explainNodes(["Type 2 ", bold("expired"), " the " + from + " row (valid_to=" + TODAY + ", is_current \u2717) and ",
          bold("inserted"), " a new version (sk=" + (nextSk - 1) + ", city=" + to + ", is_current \u2713). ",
          "Full history is preserved \u2014 old facts still join to the ", bold(from), " version."]);
      }
    }
    function onMode(v) {
      mode = v; syncHint(); paintReadout(); syncBtn();
      explainNodes(["Strategy set to ", bold(v === "type1" ? "Type 1 (overwrite)" : "Type 2 (versioned)"),
        ". Change the city to see it in action."]);
    }
    function reset() { rows = initialRows(); nextSk = 2; paint(); showInitialExplain(); }

    /* ---- assemble ---- */
    mount.appendChild(h("div", { class: "widget-controls" },
      seg([{ v: "type1", label: "Type 1 \u00b7 overwrite" }, { v: "type2", label: "Type 2 \u00b7 new version" }],
        function () { return mode; }, onMode),
      changeBtn,
      h("button", { class: "w-btn ghost", onclick: reset }, "Reset")
    ));
    mount.appendChild(hint);
    mount.appendChild(stage);
    mount.appendChild(explain);
    mount.appendChild(readout);

    paint();
    showInitialExplain();
  };

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = window.QUIZZES || {};
  Object.assign(window.QUIZZES, {
    "de-modeling-relational": {
      title: "Relational foundations checkpoint",
      sub: "Normalization, keys and denormalization.",
      questions: [
        {
          q: "Third normal form (3NF) primarily removes\u2026",
          options: ["All redundancy of any kind", "Transitive dependencies (non-key attributes depending on other non-key attributes)", "Foreign keys", "Indexes"],
          answer: 1,
          explain: "3NF says non-key columns must depend on the key, the whole key, and nothing but the key \u2014 it factors out transitive dependencies like city depending on customer rather than on the order."
        },
        {
          q: "A surrogate key is\u2026",
          options: ["A natural business identifier like an email", "A system-generated key with no business meaning", "Always a composite of several columns", "The same as a foreign key"],
          answer: 1,
          explain: "A surrogate key (e.g. an auto-increment or hash) is meaningless outside the system, which makes it stable even when business attributes change \u2014 essential for SCD-2 history."
        },
        {
          q: "Why might an analytical model deliberately denormalize?",
          options: ["To enforce constraints", "To trade some redundancy for far fewer joins on big scans", "To save storage", "To prevent updates"],
          answer: 1,
          explain: "Columnar engines scan and compress well but pay for joins; pre-joining (denormalizing) into wider tables removes join cost at query time, accepting controlled redundancy."
        }
      ]
    },
    "de-modeling-dimensional": {
      title: "Dimensional modeling checkpoint",
      sub: "Stars, grain and fact types.",
      questions: [
        {
          q: "In a star schema, measures (like amount) live in the\u2026",
          options: ["Dimension tables", "Fact table", "Bridge table", "Index"],
          answer: 1,
          explain: "Facts hold the numeric measures plus foreign keys to dimensions; dimensions hold the descriptive attributes you filter and group by."
        },
        {
          q: "The first thing you should declare when designing a fact table is its\u2026",
          options: ["Indexes", "Grain (what one row represents)", "Partition key", "Compression codec"],
          answer: 1,
          explain: "Declaring the grain \u2014 e.g. 'one row per order line' \u2014 fixes what every measure means and prevents the classic bug of mixing grains in one table."
        },
        {
          q: "A measure like 'account balance' that you can add across accounts but not across time is\u2026",
          options: ["Additive", "Semi-additive", "Non-additive", "A degenerate dimension"],
          answer: 1,
          explain: "Semi-additive measures (balances, inventory levels) sum across some dimensions but not time; ratios and percentages are non-additive."
        },
        {
          q: "A periodic snapshot fact table is best for\u2026",
          options: ["Every individual transaction", "Regular status at fixed intervals (e.g. daily balances)", "A process with a clear start and end", "Storing dimension attributes"],
          answer: 1,
          explain: "Periodic snapshots capture state at regular intervals; transaction facts capture each event, and accumulating snapshots track a process with milestones (order \u2192 ship \u2192 deliver)."
        }
      ]
    },
    "de-modeling-scd": {
      title: "Slowly Changing Dimensions checkpoint",
      sub: "Tracking history correctly.",
      questions: [
        {
          q: "SCD Type 2 handles a changed attribute by\u2026",
          options: ["Overwriting the old value", "Inserting a new versioned row and closing the old one", "Adding a 'previous value' column", "Ignoring the change"],
          answer: 1,
          explain: "Type 2 preserves history: it closes the current row (end date, is_current=false) and inserts a new version with a new surrogate key \u2014 so facts can join to the value that was true at the time."
        },
        {
          q: "SCD Type 1 is appropriate when you\u2026",
          options: ["Must keep full history", "Only ever care about the latest value (overwrite)", "Need a previous-value column", "Are modeling a fact"],
          answer: 1,
          explain: "Type 1 overwrites in place \u2014 simple and history-free \u2014 which is fine for corrections or attributes whose past values nobody needs."
        },
        {
          q: "A 'late-arriving dimension' problem is when\u2026",
          options: ["A fact references a dimension member that hasn\u2019t loaded yet", "A dimension is too large", "Two facts share a key", "A column is added"],
          answer: 0,
          explain: "If a fact arrives referencing a customer the dimension hasn\u2019t seen, you insert an inferred (placeholder) member now and enrich it when the real record arrives."
        }
      ]
    },
    "de-modeling-methodology": {
      title: "Methodology checkpoint",
      sub: "Kimball, Inmon, Data Vault and the modern stack.",
      questions: [
        {
          q: "Kimball\u2019s approach is characterized as\u2026",
          options: ["Top-down, fully normalized enterprise model first", "Bottom-up dimensional marts unified by conformed dimensions", "Hubs, links and satellites", "One big denormalized table"],
          answer: 1,
          explain: "Kimball builds business-process star-schema marts that integrate through conformed dimensions; Inmon builds a normalized enterprise warehouse first, then derives marts."
        },
        {
          q: "Data Vault\u2019s hubs, links and satellites are designed to optimize for\u2026",
          options: ["Query simplicity for analysts", "Auditability, history and parallel loading", "Minimal storage", "Avoiding surrogate keys"],
          answer: 1,
          explain: "Data Vault separates business keys (hubs), relationships (links) and descriptive history (satellites) for traceability and scalable loads \u2014 usually with a star-schema layer on top for consumption."
        },
        {
          q: "A semantic layer exists mainly to\u2026",
          options: ["Store raw files", "Define metrics once so every tool computes them consistently", "Replace the warehouse", "Encrypt data"],
          answer: 1,
          explain: "A semantic/metrics layer centralizes metric definitions (e.g. 'active user') so dashboards and queries don\u2019t drift into conflicting numbers."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  var tok = function (s) { return "<code class='tok'>" + s + "</code>"; };

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.modeling = {
    id: "modeling", name: "Data Modeling & Warehousing", short: "MODEL",
    tagline: "Shape data so questions are easy", color: "#a78bfa",
    blurb: "From normalization to the star schema: facts and dimensions, grain, slowly changing dimensions, surrogate keys, and the great methodology debate \u2014 Kimball vs Inmon vs Data Vault \u2014 plus wide tables and the semantic layer of the modern stack.",
    modules: [
      {
        id: "relational", name: "Relational Foundations", icon: "blocks",
        lessons: [
          {
            id: "normalization", title: "Normalization: 1NF to 3NF",
            summary: "Factor out redundancy step by step so the same fact is stored exactly once.",
            minutes: 8, tags: ["normalization", "3nf"],
            blocks: [
              { t: "p", html: "<strong>Normalization</strong> organizes columns so each fact is stored in exactly one place. The enemy is redundancy, which causes <strong>anomalies</strong>: update a customer\u2019s city in one row but not the others (update anomaly), or lose a product\u2019s price when its last order is deleted (delete anomaly)." },
              { t: "ul", items: [
                "<strong>1NF</strong> \u2014 atomic values, no repeating groups; one value per cell.",
                "<strong>2NF</strong> \u2014 no partial dependency on part of a composite key.",
                "<strong>3NF</strong> \u2014 no transitive dependency; non-key columns depend only on the key."
              ] },
              { t: "widget", id: "de-model-normalize" },
              { t: "note", variant: "key", html: "The mnemonic for 3NF: every non-key column depends on <strong>the key, the whole key, and nothing but the key</strong>. Each normal form removes one way the same fact could be duplicated." },
              { t: "note", variant: "tip", html: "Normalization is the right default for OLTP, where writes must stay consistent. Analytics later deliberately <em>de</em>normalizes for read speed \u2014 a tension we resolve in the dimensional module." }
            ]
          },
          {
            id: "keys-relationships", title: "Keys, constraints & relationships",
            summary: "Primary, foreign and unique keys, cardinality, and the ER diagram that ties them together.",
            minutes: 6, tags: ["keys", "erd"],
            blocks: [
              { t: "p", html: "A <strong>primary key</strong> uniquely identifies a row; a <strong>foreign key</strong> references a primary key in another table, encoding a relationship; a <strong>unique</strong> constraint forbids duplicates in a column. Together with <strong>referential integrity</strong> they keep relationships valid." },
              { t: "table", headers: ["Relationship", "Meaning", "Example"], rows: [
                ["1:1", "Each side has at most one", "User \u2194 Profile"],
                ["1:N", "One parent, many children", "Customer \u2192 Orders"],
                ["N:M", "Many to many (needs a bridge)", "Students \u2194 Courses"]
              ] },
              { t: "note", variant: "key", html: "An <strong>ER diagram</strong> is the shared language of modeling: boxes are entities, lines are relationships, and the crow\u2019s-foot notation shows cardinality. Sketch it before you write DDL." },
              { t: "note", variant: "tip", html: "Analytical warehouses often don\u2019t <em>enforce</em> foreign keys (they slow loads), but you still model and test them \u2014 a broken FK is a data-quality bug whether or not the engine checks it." }
            ]
          },
          {
            id: "denormalization", title: "Denormalization & trade-offs",
            summary: "Trade controlled redundancy for fewer joins when reads dominate.",
            minutes: 6, tags: ["denormalization"],
            blocks: [
              { t: "p", html: "<strong>Denormalization</strong> deliberately stores redundant data \u2014 pre-joining or duplicating columns \u2014 to make reads faster. It\u2019s the opposite move from normalization, and it\u2019s correct precisely when reads vastly outnumber writes, as in analytics." },
              { t: "compare",
                bad: { title: "Over-normalized for analytics", items: ["Every query joins 8 tables", "Star queries get slow & complex", "Hard for analysts to use"] },
                good: { title: "Thoughtful denormalization", items: ["Wide, pre-joined tables", "Few or no joins at query time", "Redundancy is managed by the pipeline"] }
              },
              { t: "note", variant: "trap", html: "Denormalization\u2019s cost is consistency: a duplicated value must be updated everywhere. In a warehouse the pipeline owns that (it rebuilds the table), so the risk is controlled \u2014 unlike in a write-heavy OLTP system." },
              { t: "note", variant: "key", html: "Normalize to protect writes; denormalize to accelerate reads. Knowing <em>which</em> world you\u2019re in is the whole skill." },
              { t: "quiz", id: "de-modeling-relational" }
            ]
          }
        ]
      },
      {
        id: "dimensional", name: "Dimensional Modeling", icon: "cube",
        lessons: [
          {
            id: "star-schema", title: "Star schemas: facts & dimensions",
            summary: "The analytical workhorse: a central fact of measures surrounded by descriptive dimensions.",
            minutes: 7, tags: ["star", "facts", "dimensions"],
            blocks: [
              { t: "p", html: "The <strong>star schema</strong> is the dominant analytical model. A central <strong>fact table</strong> holds the numeric <strong>measures</strong> (amount, quantity) and foreign keys; surrounding <strong>dimension tables</strong> hold the descriptive <strong>attributes</strong> you slice by (date, customer, product). Drawn out, it looks like a star." },
              { t: "widget", id: "de-model-star" },
              { t: "p", html: "Analysts love it because questions map directly onto it: \u201crevenue (fact measure) by category (product dim) per month (date dim)\u201d is one fact joined to two dimensions \u2014 fast on a columnar engine and easy to read." },
              { t: "note", variant: "key", html: "Facts = measurements (long, narrow, growing); dimensions = context (short, wide, descriptive). Keep that split clean and most modeling decisions follow." }
            ]
          },
          {
            id: "snowflake-conformed", title: "Snowflaking & conformed dimensions",
            summary: "Normalized dimensions, and dimensions shared consistently across many facts.",
            minutes: 6, tags: ["snowflake", "conformed"],
            blocks: [
              { t: "p", html: "A <strong>snowflake schema</strong> normalizes dimensions into sub-tables (product \u2192 category \u2192 department). It saves a little space and reduces some redundancy, at the cost of more joins. Most teams prefer flat <strong>star</strong> dimensions for simplicity and speed." },
              { t: "p", html: "<strong>Conformed dimensions</strong> are the real prize: a single " + tok("dim_date") + " or " + tok("dim_customer") + " shared by many fact tables, with identical keys and meaning. They let you compare across business processes \u2014 \u201csales vs returns by customer\u201d \u2014 because both facts speak the same dimension." },
              { t: "note", variant: "key", html: "Kimball\u2019s <strong>bus matrix</strong> maps business processes (rows) to conformed dimensions (columns). It\u2019s how you plan a warehouse that integrates instead of fragmenting into silos." },
              { t: "note", variant: "tip", html: "Prefer star over snowflake unless a dimension is enormous and genuinely benefits from normalization. Columnar storage already compresses repeated dimension values cheaply." }
            ]
          },
          {
            id: "grain", title: "Choosing the grain",
            summary: "Declare what one fact row represents before anything else \u2014 it fixes every measure.",
            minutes: 5, tags: ["grain"],
            blocks: [
              { t: "p", html: "The <strong>grain</strong> is the precise meaning of a single fact row: \u201cone row per order line,\u201d \u201cone row per daily account balance.\u201d Declaring it first is the most important step in dimensional design \u2014 it determines which dimensions apply and what each measure means." },
              { t: "note", variant: "trap", html: "Mixing grains in one table is a classic, painful bug: if some rows are per-order and some per-line, " + tok("SUM(amount)") + " double-counts. One table, one grain \u2014 always." },
              { t: "ol", items: [
                "Pick the business process (sales, shipments).",
                "Declare the grain (one row per ___).",
                "Choose the dimensions that fit that grain.",
                "Choose the measures that are true at that grain."
              ] },
              { t: "note", variant: "key", html: "Grain first, then dimensions, then facts. Get the grain right and the rest of the model almost designs itself." }
            ]
          },
          {
            id: "fact-types", title: "Fact table types",
            summary: "Transaction, periodic snapshot and accumulating snapshot \u2014 and additivity.",
            minutes: 6, tags: ["facts", "additivity"],
            blocks: [
              { t: "table", headers: ["Fact type", "Captures", "Example"], rows: [
                ["Transaction", "One row per event", "Each sale line"],
                ["Periodic snapshot", "State at fixed intervals", "Daily account balance"],
                ["Accumulating snapshot", "A process with milestones", "Order \u2192 ship \u2192 deliver"]
              ] },
              { t: "p", html: "Measures differ in <strong>additivity</strong>: <strong>additive</strong> sums across all dimensions (amount), <strong>semi-additive</strong> sums across some but not time (balance, inventory), and <strong>non-additive</strong> can\u2019t be summed at all (ratios, percentages \u2014 store the components instead)." },
              { t: "note", variant: "tip", html: "A <strong>factless fact</strong> records that an event happened with no measure (a student attending a class) \u2014 you count rows. A <strong>degenerate dimension</strong> is a dimension key (like an order number) that lives in the fact with no separate table." },
              { t: "note", variant: "key", html: "Pick the fact type from the question: per-event detail \u2192 transaction; regular status \u2192 periodic snapshot; pipeline with stages \u2192 accumulating snapshot." },
              { t: "quiz", id: "de-modeling-dimensional" }
            ]
          }
        ]
      },
      {
        id: "scd", name: "Slowly Changing Dimensions", icon: "map",
        lessons: [
          {
            id: "scd-types", title: "Slowly Changing Dimensions 0 to 6",
            summary: "How to handle a dimension attribute that changes over time \u2014 overwrite or keep history.",
            minutes: 7, tags: ["scd"],
            blocks: [
              { t: "p", html: "Dimension attributes drift: a customer moves city, a product changes category. <strong>Slowly Changing Dimension</strong> (SCD) techniques decide what happens to history when they do." },
              { t: "table", headers: ["Type", "Strategy"], rows: [
                ["0", "Never change (retain original)"],
                ["1", "Overwrite \u2014 no history"],
                ["2", "New versioned row + effective/end dates + is_current"],
                ["3", "Add a 'previous value' column (limited history)"],
                ["4 / 6", "Mini-dimension / hybrid combinations"]
              ] },
              { t: "widget", id: "scd" },
              { t: "widget", id: "de-model-scd2" },
              { t: "note", variant: "key", html: "<strong>Type 2 is the workhorse.</strong> By versioning rows, a fact joins to the dimension value that was true <em>at the time of the event</em> \u2014 so last year\u2019s sales still roll up to the customer\u2019s segment as it was last year." },
              { t: "note", variant: "trap", html: "Type 2 only works with <strong>surrogate keys</strong>: the natural key repeats across versions, so facts must reference the surrogate to pin a specific version. That\u2019s the next lesson." }
            ]
          },
          {
            id: "surrogate-keys", title: "Surrogate keys & history",
            summary: "Why versioned dimensions need a meaningless, stable key of their own.",
            minutes: 5, tags: ["surrogate-keys"],
            blocks: [
              { t: "p", html: "A <strong>surrogate key</strong> is a system-generated identifier (an integer or hash) with no business meaning. Dimensions use it as the primary key; the <strong>natural key</strong> (e.g. customer id) becomes just an attribute." },
              { t: "p", html: "This is what makes SCD-2 possible: each version of a customer gets its own surrogate key, so a fact row carries the surrogate of the version that was current when the event happened. Change the customer\u2019s city tomorrow and old facts still point at the old version." },
              { t: "note", variant: "key", html: "Surrogates also insulate the warehouse from source-system churn: if a source re-keys its data, only the natural-key attribute changes, not your fact foreign keys." },
              { t: "note", variant: "tip", html: "Generate surrogates in the load (sequence, identity, or a deterministic hash of natural-key + version). Hash keys are handy because they\u2019re reproducible across reloads." }
            ]
          },
          {
            id: "late-arriving", title: "Late-arriving data",
            summary: "Handle facts that beat their dimension, and dimension updates that arrive out of order.",
            minutes: 6, tags: ["late-arriving"],
            blocks: [
              { t: "p", html: "Data rarely arrives in order. A <strong>late-arriving fact</strong> references a dimension member you haven\u2019t loaded yet; a <strong>late-arriving dimension</strong> update lands after facts that should have used it." },
              { t: "ul", items: [
                "<strong>Late fact, missing dim</strong> \u2014 insert an <em>inferred member</em> (placeholder row keyed by the natural key) now, and enrich it when the real dimension record arrives.",
                "<strong>Late dimension update</strong> \u2014 with SCD-2 you may need to insert a version with a back-dated effective date and re-point affected facts."
              ] },
              { t: "note", variant: "key", html: "The goal is never to drop or block a fact because its context is late. Park it against a placeholder, and reconcile when the rest catches up." },
              { t: "note", variant: "trap", html: "Inferred members are easy to create and easy to forget \u2014 monitor for dimension rows that never got enriched, or your reports will quietly attribute sales to \u201cUnknown.\u201d" },
              { t: "quiz", id: "de-modeling-scd" }
            ]
          }
        ]
      },
      {
        id: "methodology", name: "Modeling Methodologies", icon: "grid",
        lessons: [
          {
            id: "kimball-inmon", title: "Kimball vs Inmon",
            summary: "Bottom-up dimensional marts versus a top-down normalized enterprise warehouse.",
            minutes: 6, tags: ["kimball", "inmon"],
            blocks: [
              { t: "p", html: "The two classic warehouse philosophies. <strong>Kimball</strong> builds dimensional star-schema <em>marts</em> per business process, integrated through conformed dimensions \u2014 fast to deliver, analyst-friendly. <strong>Inmon</strong> builds a normalized, enterprise-wide <em>Corporate Information Factory</em> first, then derives marts \u2014 more upfront rigor and integration." },
              { t: "compare",
                bad: { title: "Inmon (top-down)", items: ["Normalized enterprise model first", "Slower initial delivery", "Strong single source of truth", "More upfront design"] },
                good: { title: "Kimball (bottom-up)", items: ["Dimensional marts first", "Fast time-to-value", "Conformed dimensions integrate marts", "Analyst-friendly stars"] }
              },
              { t: "note", variant: "key", html: "Most modern teams lean Kimball (stars are easy to consume) while borrowing Inmon\u2019s discipline for integration. They\u2019re less rivals than two ends of a spectrum." }
            ]
          },
          {
            id: "data-vault", title: "Data Vault 2.0",
            summary: "Hubs, links and satellites \u2014 a pattern built for auditability and scale.",
            minutes: 6, tags: ["data-vault"],
            blocks: [
              { t: "p", html: "<strong>Data Vault</strong> models the warehouse in three parts: <strong>hubs</strong> (unique business keys), <strong>links</strong> (relationships between hubs), and <strong>satellites</strong> (descriptive attributes and their history). It separates the stable (keys, relationships) from the volatile (descriptions)." },
              { t: "ul", items: [
                "<strong>Auditability</strong> \u2014 every satellite is timestamped and append-only.",
                "<strong>Parallel loads</strong> \u2014 hubs/links/satellites load independently.",
                "<strong>Resilience</strong> \u2014 new sources add satellites without reworking the core."
              ] },
              { t: "note", variant: "tip", html: "Data Vault is a <em>raw/integration</em> layer optimized for loading and traceability, not for analysts. You almost always build a Kimball star layer on top of it for consumption." },
              { t: "note", variant: "key", html: "Reach for Data Vault when auditability, many changing sources, and parallel loading matter more than query simplicity \u2014 common in regulated enterprises." }
            ]
          },
          {
            id: "obt-modern", title: "Wide tables, OBT & the modern stack",
            summary: "When columnar engines make one big denormalized table the pragmatic choice.",
            minutes: 6, tags: ["obt", "modern-stack"],
            blocks: [
              { t: "p", html: "On cloud columnar warehouses, joins are relatively expensive and storage is cheap, so a <strong>one big table</strong> (OBT) \u2014 a wide, pre-joined, denormalized table \u2014 is often the fastest and simplest thing to query. The modern stack (ELT + <strong>dbt</strong>) makes building and rebuilding such tables easy." },
              { t: "compare",
                bad: { title: "OBT downsides", items: ["Redundant, larger storage", "Rebuild on any dimension change", "Less reusable than conformed dims"] },
                good: { title: "OBT upsides", items: ["No joins at query time", "Dead simple for BI tools", "Great on columnar + compression"] }
              },
              { t: "note", variant: "key", html: "Star schema and OBT aren\u2019t enemies: many teams keep conformed dimensions and facts as the trusted core, then materialize OBTs as consumption-layer marts. Pick per use case." }
            ]
          },
          {
            id: "semantic-layer", title: "Metrics & the semantic layer",
            summary: "Define each metric once so every dashboard computes the same number.",
            minutes: 6, tags: ["semantic-layer", "metrics"],
            blocks: [
              { t: "p", html: "A <strong>semantic layer</strong> (or metrics layer) centralizes the definition of business metrics \u2014 \u201cactive user,\u201d \u201cnet revenue\u201d \u2014 as governed objects, so every tool computes them identically. It sits between the warehouse and BI, often as <em>headless BI</em>." },
              { t: "note", variant: "trap", html: "Without it, every dashboard re-implements \u201crevenue\u201d slightly differently and the numbers drift \u2014 the dreaded \u201cwhy do these two reports disagree?\u201d meeting. One definition, queried everywhere, is the cure." },
              { t: "code", lang: "yaml", code:
                "# A metric defined once, reused everywhere\n" +
                "metric:\n" +
                "  name: net_revenue\n" +
                "  expression: SUM(amount) - SUM(refunds)\n" +
                "  dimensions: [date, region, product_category]" },
              { t: "note", variant: "key", html: "The semantic layer is where data modeling meets governance: it turns your facts and dimensions into a trustworthy, shared vocabulary of metrics." },
              { t: "quiz", id: "de-modeling-methodology" }
            ]
          }
        ]
      }
    ]
  };
})();
