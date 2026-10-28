/* =====================================================================
   GLACIER · Security & Governance
   window.TRACKS.sec — modules: access / policies / perimeter

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Block grammar: see docs/ENGINE_SPEC.md.
   ===================================================================== */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var PINK = "#f472b6";

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
  function svg(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    if (text != null) el.textContent = text;
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
  function selectField(label, pairs, initial, onPick) {
    var sel = h("select", {});
    for (var i = 0; i < pairs.length; i++) {
      var o = h("option", { value: pairs[i][0] }, pairs[i][1]);
      if (pairs[i][0] === initial) o.setAttribute("selected", "selected");
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () { onPick(sel.value || initial); });
    return h("label", { class: "w-field" }, label + " ", sel);
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }

  var Widgets = {};

  /* rbacGraph — walk the role graph to find which grant (if any) lets a role do something */
  Widgets.rbacGraph = function (mount) {
    shell(mount, "explorer", "Grant-graph explorer",
      "Pick the acting role and a privilege. The explorer walks the inheritance graph downward (a role inherits every role granted to it) and highlights the first chain that reaches a holder of that privilege. Flip future grants to see what happens to a table created after the grant script ran.");

    var NODES = {
      ACCOUNTADMIN: { x: 320, y: 25, kind: "system" },
      SECURITYADMIN: { x: 150, y: 85, kind: "system" },
      SYSADMIN: { x: 460, y: 85, kind: "system" },
      USERADMIN: { x: 90, y: 150, kind: "system" },
      ANALYST: { x: 300, y: 150, kind: "functional" },
      ENGINEER: { x: 440, y: 150, kind: "functional" },
      DEPLOY_ROLE: { x: 575, y: 150, kind: "functional" },
      SALES_RW: { x: 440, y: 212, kind: "access" },
      SALES_RO: { x: 300, y: 268, kind: "access" },
      ACCOUNT: { x: 90, y: 325, kind: "object" },
      ORDERS: { x: 420, y: 325, kind: "object" },
      NEW_TABLE: { x: 565, y: 325, kind: "object" }
    };
    /* [child, parent]: child role is granted to parent role, so parent inherits child */
    var EDGES = [
      ["SECURITYADMIN", "ACCOUNTADMIN"], ["SYSADMIN", "ACCOUNTADMIN"], ["USERADMIN", "SECURITYADMIN"],
      ["ANALYST", "SYSADMIN"], ["ENGINEER", "SYSADMIN"], ["DEPLOY_ROLE", "SYSADMIN"],
      ["SALES_RW", "ENGINEER"], ["SALES_RO", "SALES_RW"], ["SALES_RO", "ANALYST"]
    ];
    var PRIVS = {
      sel_orders: { label: "SELECT on SALES.CORE.ORDERS", obj: "ORDERS" },
      ins_orders: { label: "INSERT on SALES.CORE.ORDERS", obj: "ORDERS" },
      sel_new: { label: "SELECT on SALES.CORE.NEW_TABLE (created later)", obj: "NEW_TABLE" },
      create_user: { label: "CREATE USER on ACCOUNT", obj: "ACCOUNT" },
      manage_grants: { label: "MANAGE GRANTS on ACCOUNT", obj: "ACCOUNT" }
    };
    function holders(priv, fut) {
      if (priv === "sel_orders") return { SALES_RO: "SELECT grant", DEPLOY_ROLE: "OWNERSHIP" };
      if (priv === "ins_orders") return { SALES_RW: "INSERT grant", DEPLOY_ROLE: "OWNERSHIP" };
      if (priv === "sel_new") return fut ? { SALES_RO: "SELECT via FUTURE grant", DEPLOY_ROLE: "OWNERSHIP" } : { DEPLOY_ROLE: "OWNERSHIP" };
      if (priv === "create_user") return { USERADMIN: "CREATE USER grant" };
      return { SECURITYADMIN: "MANAGE GRANTS grant" };
    }
    function privEdges(fut) {
      var e = [
        ["USERADMIN", "ACCOUNT", 0], ["SECURITYADMIN", "ACCOUNT", 45],
        ["SALES_RO", "ORDERS", 0], ["SALES_RW", "ORDERS", 0], ["DEPLOY_ROLE", "ORDERS", 0], ["DEPLOY_ROLE", "NEW_TABLE", 0]
      ];
      if (fut) e.push(["SALES_RO", "NEW_TABLE", 30]);
      return e;
    }
    function inherited(role) {
      var out = [];
      for (var i = 0; i < EDGES.length; i++) if (EDGES[i][1] === role) out.push(EDGES[i][0]);
      return out;
    }
    function findPath(start, hold) {
      var queue = [[start]], seen = {};
      seen[start] = true;
      while (queue.length) {
        var p = queue.shift();
        var last = p[p.length - 1];
        if (hold[last]) return p;
        var kids = inherited(last);
        for (var i = 0; i < kids.length; i++) {
          if (!seen[kids[i]]) { seen[kids[i]] = true; queue.push(p.concat([kids[i]])); }
        }
      }
      return null;
    }
    function scopeSize(start) {
      var seen = {}, stack = [start], n = 0;
      while (stack.length) {
        var r = stack.pop();
        if (seen[r]) continue;
        seen[r] = true; n++;
        var kids = inherited(r);
        for (var i = 0; i < kids.length; i++) stack.push(kids[i]);
      }
      return n;
    }

    var role = "ANALYST", priv = "sel_orders", fut = false;
    var stage = h("div", { class: "w-stage" });
    var msg = h("p", { style: "font-size:0.86rem;line-height:1.55;margin:10px 0 0;color:var(--text)" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var hold = holders(priv, fut);
      var path = findPath(role, hold);
      var onPath = {}, pathEdge = {};
      if (path) {
        for (var i = 0; i < path.length; i++) onPath[path[i]] = true;
        for (var j = 0; j + 1 < path.length; j++) pathEdge[path[j + 1] + ">" + path[j]] = true;
      }
      var holder = path ? path[path.length - 1] : null;
      var target = PRIVS[priv].obj;

      clear(stage);
      var s = svg("svg", { viewBox: "0 0 640 350", width: "100%", role: "img", "aria-label": "Role graph from ACCOUNTADMIN down to access roles and objects" });
      for (var e = 0; e < EDGES.length; e++) {
        var c = NODES[EDGES[e][0]], p = NODES[EDGES[e][1]];
        var hot = pathEdge[EDGES[e][0] + ">" + EDGES[e][1]];
        s.appendChild(svg("line", { x1: p.x, y1: p.y + 15, x2: c.x, y2: c.y - 15,
          style: hot ? "stroke:" + PINK + ";stroke-width:3" : "stroke:var(--line);stroke-width:1.5" }));
      }
      var pe = privEdges(fut);
      for (var q = 0; q < pe.length; q++) {
        var from = NODES[pe[q][0]], to = NODES[pe[q][1]];
        var live = holder === pe[q][0] && target === pe[q][1];
        var isFuture = pe[q][0] === "SALES_RO" && pe[q][1] === "NEW_TABLE";
        s.appendChild(svg("line", { x1: from.x + pe[q][2], y1: from.y + 15, x2: to.x, y2: to.y - 15,
          style: (live ? "stroke:" + PINK + ";stroke-width:3" : "stroke:var(--line);stroke-width:1.2") + (isFuture || !live ? ";stroke-dasharray:5 4" : "") }));
      }
      for (var name in NODES) {
        if (!Object.prototype.hasOwnProperty.call(NODES, name)) continue;
        var n = NODES[name];
        var lit = onPath[name] || (path && name === target);
        var fill = lit ? "color-mix(in srgb, " + PINK + " 22%, transparent)" : "var(--surface-2)";
        var stroke = lit ? PINK : "var(--line)";
        var sw = name === role ? 3 : 1.2;
        var dash = n.kind === "object" ? ";stroke-dasharray:4 3" : "";
        s.appendChild(svg("rect", { x: n.x - 58, y: n.y - 15, width: 116, height: 30, rx: n.kind === "object" ? 2 : 7,
          style: "fill:" + fill + ";stroke:" + stroke + ";stroke-width:" + sw + dash }));
        s.appendChild(svg("text", { x: n.x, y: n.y + 4, "text-anchor": "middle",
          style: "fill:var(--text);font-size:11px;font-family:var(--font-mono);font-weight:" + (name === role ? "700" : "500") }, name));
      }
      stage.appendChild(s);

      var chain, verdict, via;
      if (path) {
        verdict = "ALLOWED";
        chain = path.join(" inherits ");
        via = hold[holder];
        msg.textContent = path.length === 1
          ? role + " holds " + PRIVS[priv].label + " directly (" + via + ")."
          : role + " reaches " + holder + " through " + (path.length - 1) + " inherited role grant(s); " + holder + " holds " + PRIVS[priv].label + " (" + via + ").";
      } else {
        verdict = "DENIED";
        chain = "no path";
        via = "none";
        if (priv === "sel_new" && !fut && (role === "ANALYST" || role === "SALES_RO" || role === "SALES_RW" || role === "ENGINEER")) {
          msg.textContent = role + " inherits SALES_RO, but its grant ran ON ALL TABLES before NEW_TABLE existed. ALL is a snapshot; only a FUTURE grant (or re-running the grant) covers tables created later.";
        } else {
          msg.textContent = "None of the " + scopeSize(role) + " role(s) in " + role + "'s inherited set hold " + PRIVS[priv].label + ". Inheritance only flows upward: a child role never sees what its parent holds.";
        }
      }
      clear(readout);
      readout.appendChild(ro("verdict", verdict));
      readout.appendChild(ro("chain", chain));
      readout.appendChild(ro("granted via", via));
      readout.appendChild(ro("roles in scope", scopeSize(role)));
      readout.appendChild(ro("future grants", fut ? "on" : "off"));
    }

    var rolePairs = [];
    for (var nm in NODES) if (Object.prototype.hasOwnProperty.call(NODES, nm) && NODES[nm].kind !== "object") rolePairs.push([nm, nm]);
    var privPairs = [];
    for (var pk in PRIVS) if (Object.prototype.hasOwnProperty.call(PRIVS, pk)) privPairs.push([pk, PRIVS[pk].label]);

    mount.appendChild(h("div", { class: "widget-controls" },
      selectField("Acting role", rolePairs, role, function (v) { role = v; paint(); }),
      selectField("Privilege", privPairs, priv, function (v) { priv = v; paint(); }),
      segment([["off", "Future grants off"], ["on", "GRANT ... ON FUTURE TABLES"]], 0, function (v) { fut = v === "on"; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(msg);
    mount.appendChild(readout);
    paint();
  };

  /* policyLab — the same table seen through a masking policy and a row access policy */
  Widgets.policyLab = function (mount) {
    shell(mount, "simulator", "Policy lab: masking + row access",
      "One EMPLOYEES table, one query. Change the role running it and the policies attached. Row access is evaluated first, then masking runs on the rows that survive. Hash values are illustrative, not real SHA-2 output.");

    var ROWS = [
      { id: 101, name: "Asha Rao", email: "asha.rao@acme.example", region: "EMEA", salary: 142000 },
      { id: 102, name: "Ben Okafor", email: "ben.okafor@acme.example", region: "AMER", salary: 128000 },
      { id: 103, name: "Chen Wei", email: "chen.wei@globex.example", region: "APAC", salary: 135000 },
      { id: 104, name: "Dana Fox", email: "dana.fox@acme.example", region: "EMEA", salary: 119000 },
      { id: 105, name: "Eli Park", email: "eli.park@initech.example", region: "AMER", salary: 151000 },
      { id: 106, name: "Femi Ade", email: "femi.ade@acme.example", region: "APAC", salary: 124000 }
    ];
    /* the row access policy's mapping table: role -> regions it may see */
    var MAPPING = { SUPPORT_EMEA: ["EMEA"], SUPPORT_AMER: ["AMER"], ANALYST: ["EMEA", "AMER", "APAC"] };
    var role = "SUPPORT_EMEA", emailMode = "partial", rowOn = true, salMode = "null";

    function fakeHash(str) {
      var x = 2166136261;
      for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
      return ("00000000" + x.toString(16)).slice(-8);
    }
    function isHr() { return role === "HR_ADMIN"; }
    function maskEmail(v) {
      if (emailMode === "none" || isHr()) return { v: v, m: false };
      if (emailMode === "full") return { v: "***MASKED***", m: true };
      if (emailMode === "partial") return { v: "*****" + v.slice(v.indexOf("@")), m: true };
      return { v: "sha2:" + fakeHash(v) + "...", m: true };
    }
    function maskSalary(v) {
      if (salMode === "off" || isHr()) return { v: String(v), m: false };
      if (salMode === "null") return { v: "NULL", m: true };
      var lo = Math.floor(v / 25000) * 25;
      return { v: lo + "k-" + (lo + 25) + "k", m: true };
    }
    function rowVisible(r) {
      if (!rowOn || isHr()) return true;
      var regions = MAPPING[role] || [];
      return regions.indexOf(r.region) >= 0;
    }
    function policySql() {
      var lines = [];
      if (rowOn) {
        lines.push("CREATE ROW ACCESS POLICY gov.policies.rap_region AS (row_region VARCHAR) RETURNS BOOLEAN ->");
        lines.push("  IS_ROLE_IN_SESSION('HR_ADMIN')");
        lines.push("  OR EXISTS (SELECT 1 FROM gov.policies.region_map m");
        lines.push("            WHERE m.role_name = CURRENT_ROLE() AND m.region = row_region);");
      }
      if (emailMode !== "none") {
        var body = emailMode === "full" ? "'***MASKED***'" : emailMode === "partial" ? "REGEXP_REPLACE(val, '^[^@]+', '*****')" : "SHA2(val, 256)";
        lines.push("CREATE MASKING POLICY gov.policies.mp_email AS (val VARCHAR) RETURNS VARCHAR ->");
        lines.push("  CASE WHEN IS_ROLE_IN_SESSION('HR_ADMIN') THEN val ELSE " + body + " END;");
      }
      if (salMode !== "off") {
        var sb = salMode === "null" ? "NULL" : "FLOOR(val / 25000) * 25000";
        lines.push("CREATE MASKING POLICY gov.policies.mp_salary AS (val NUMBER) RETURNS NUMBER ->");
        lines.push("  CASE WHEN IS_ROLE_IN_SESSION('HR_ADMIN') THEN val ELSE " + sb + " END;");
      }
      if (!lines.length) lines.push("-- no policies attached: every role with SELECT sees every row in clear text");
      return lines.join("\n");
    }

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      clear(stage);
      var cellCss = "padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;";
      var table = h("table", { style: "width:100%;border-collapse:collapse;font-size:0.8rem;font-family:var(--font-mono);color:var(--text)" });
      var head = h("tr", {});
      var cols = ["ID", "NAME", "EMAIL", "REGION", "SALARY"];
      for (var c = 0; c < cols.length; c++) head.appendChild(h("th", { style: cellCss + "color:var(--text-dim);font-weight:600" }, cols[c]));
      table.appendChild(head);
      var shown = 0, masked = 0;
      for (var i = 0; i < ROWS.length; i++) {
        var r = ROWS[i];
        if (!rowVisible(r)) continue;
        shown++;
        var em = maskEmail(r.email), sa = maskSalary(r.salary);
        if (em.m) masked++;
        if (sa.m) masked++;
        var dimCss = "color:var(--text-dim);font-style:italic;";
        table.appendChild(h("tr", {},
          h("td", { style: cellCss }, String(r.id)),
          h("td", { style: cellCss }, r.name),
          h("td", { style: cellCss + (em.m ? dimCss : "") }, em.v),
          h("td", { style: cellCss }, r.region),
          h("td", { style: cellCss + (sa.m ? dimCss : "") }, sa.v)));
      }
      if (!shown) {
        table.appendChild(h("tr", {}, h("td", { colspan: "5", style: cellCss + "color:var(--text-dim)" },
          "0 rows. " + role + " has no row in the mapping table, so the policy returns FALSE for every row - no error, just an empty result.")));
      }
      stage.appendChild(table);
      stage.appendChild(h("pre", { style: "margin:12px 0 0;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);font-size:0.74rem;white-space:pre-wrap;font-family:var(--font-mono)" }, policySql()));

      var filter;
      if (!rowOn) filter = "no row policy";
      else if (isHr()) filter = "HR_ADMIN bypass";
      else filter = MAPPING[role] ? "map -> " + MAPPING[role].join(",") : "no mapping";
      clear(readout);
      readout.appendChild(ro("role", role));
      readout.appendChild(ro("rows visible", shown + " / " + ROWS.length));
      readout.appendChild(ro("masked cells", masked));
      readout.appendChild(ro("row filter", filter));
      readout.appendChild(ro("evaluation", rowOn ? "row access, then masking" : "masking only"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      selectField("Current role", [["SUPPORT_EMEA", "SUPPORT_EMEA"], ["SUPPORT_AMER", "SUPPORT_AMER"], ["ANALYST", "ANALYST"], ["HR_ADMIN", "HR_ADMIN"], ["ACCOUNTADMIN", "ACCOUNTADMIN"]], role, function (v) { role = v; paint(); }),
      segment([["none", "EMAIL clear"], ["full", "Redact"], ["partial", "Keep domain"], ["hash", "Hash"]], 2, function (v) { emailMode = v; paint(); }),
      segment([["null", "SALARY NULL"], ["band", "SALARY band"], ["off", "SALARY clear"]], 0, function (v) { salMode = v; paint(); }),
      segment([["on", "Row policy on"], ["off", "Row policy off"]], 0, function (v) { rowOn = v === "on"; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sec-access": {
      title: "Access control checkpoint",
      sub: "Role hierarchy, grants and ownership, future grants, managed access, database and secondary roles.",
      questions: [
        { q: "A team creates role ETL_OWNER, uses it to create dozens of tables, and never grants ETL_OWNER to any other role. What is the practical consequence?",
          options: ["Objects owned by ETL_OWNER sit outside SYSADMIN's and ACCOUNTADMIN's inherited reach, so admins cannot manage them without being granted the role", "Snowflake refuses to create tables with a role that is not in the hierarchy", "ETL_OWNER automatically inherits SYSADMIN's privileges", "The tables become read-only until the role is attached to SYSADMIN"],
          answer: 0,
          explain: "Privileges flow upward through role grants. A custom role that is never granted to SYSADMIN (directly or via a parent) forms an orphan branch: ACCOUNTADMIN does not automatically inherit it. The fix is GRANT ROLE etl_owner TO ROLE sysadmin, which is why every custom role should roll up to SYSADMIN." },
        { q: "You ran GRANT SELECT ON ALL TABLES IN SCHEMA sales.core TO ROLE sales_ro. Tomorrow a pipeline creates sales.core.returns. Can sales_ro read it?",
          options: ["Yes, ALL TABLES covers tables created later", "No: ALL is a one-time snapshot of existing tables; you also need GRANT SELECT ON FUTURE TABLES IN SCHEMA sales.core", "Yes, but only after the warehouse is resumed", "Only if the new table is transient"],
          answer: 1,
          explain: "ON ALL expands to the tables that exist at the moment the grant runs. ON FUTURE registers a rule that fires when a new object of that type is created in the container. Production grant scripts pair both so existing and new objects are covered." },
        { q: "A database has future grants on tables, and one of its schemas also has its own future grants on tables. A new table is created in that schema. Which future grants apply?",
          options: ["Both sets are applied and unioned", "Only the database-level grants", "Whichever set was defined most recently", "The schema-level grants; database-level future grants for that object type are ignored in that schema"],
          answer: 3,
          explain: "When future grants for the same object type exist at both levels, the schema-level definition wins and the database-level one is ignored for that schema. Teams are often surprised when a database-wide read grant silently stops applying after someone adds a schema-level future grant for a different role." },
        { q: "In a managed access schema, who can grant SELECT on a table in that schema to another role?",
          options: ["Only the role that owns the table", "Any role that already holds SELECT on the table", "The schema owner, or a role holding the global MANAGE GRANTS privilege", "Only ACCOUNTADMIN"],
          answer: 2,
          explain: "Managed access removes grant decisions from individual object owners and centralises them with the schema owner (or MANAGE GRANTS holders). Object owners can still create and alter objects, but they cannot hand out access on their own, which stops privilege sprawl." },
        { q: "Which statement about database roles is true?",
          options: ["They can be activated with USE ROLE exactly like account roles", "They are scoped to one database, can be granted to account roles or to shares, but cannot be a session's primary role", "They can hold privileges on objects in any database in the account", "They remove the need for account roles entirely"],
          answer: 1,
          explain: "A database role lives inside one database and can only hold privileges on objects in that database. Users get its privileges by being granted an account role that holds the database role. Because they travel with the database, they are the right unit for granular access in shares." },
        { q: "With USE SECONDARY ROLES ALL active, a user runs CREATE TABLE. Which role owns the new table?",
          options: ["The primary role", "The most privileged of the secondary roles", "PUBLIC", "All active roles share ownership"],
          answer: 0,
          explain: "Secondary roles add their privileges to queries and DML (the union of all active roles is checked), but CREATE statements are authorised by, and assign ownership to, the primary role only. That keeps ownership deterministic even when a user has many roles active." }
      ]
    },
    "sec-policies": {
      title: "Data protection policies checkpoint",
      sub: "Masking, row access, tag-based masking and secure views.",
      questions: [
        { q: "A masking policy reveals email when CURRENT_ROLE() = 'PII_READER'. An analyst's primary role DATA_SCIENTIST has been granted PII_READER. What does the analyst see?",
          options: ["Clear text, because DATA_SCIENTIST inherits PII_READER", "Masked values: CURRENT_ROLE() compares only the primary role's name; IS_ROLE_IN_SESSION('PII_READER') would honour the hierarchy", "A permissions error", "NULL for every row"],
          answer: 1,
          explain: "CURRENT_ROLE() returns exactly one name, the primary role, so a string comparison ignores inheritance and secondary roles. IS_ROLE_IN_SESSION checks whether the named role is active or inherited in the session, which is almost always the intent when writing policies against a role hierarchy." },
        { q: "A table has both a row access policy and a masking policy attached. In what order are they applied?",
          options: ["Masking first, then row filtering on the masked values", "In parallel with an undefined order", "In the order the policies were attached", "Row access first, then masking on the rows that survive"],
          answer: 3,
          explain: "Snowflake evaluates the row access policy first to decide which rows exist for this role, then applies masking to the columns of the remaining rows. That means the row policy sees unmasked values, so you can filter on a column that is also masked for the querying role." },
        { q: "A column inherits a tag-based masking policy from its PII tag, and someone has also set a masking policy directly on that column. Which one applies?",
          options: ["The tag-based policy", "Both, applied in sequence", "The policy set directly on the column", "Neither: the query fails until one is removed"],
          answer: 2,
          explain: "A directly assigned masking policy takes precedence over a tag-based one. That is useful for deliberate exceptions, but it also means a stale direct assignment can silently override your central tag strategy, so audit POLICY_REFERENCES for direct assignments." },
        { q: "Why can a secure view be slower than the same definition as a standard view?",
          options: ["The optimizer avoids some rewrites, such as evaluating user predicates or functions before the view's own filters, so hidden rows cannot leak", "Secure views are always fully materialised on every query", "Secure views run on a dedicated serverless warehouse", "Secure views disable micro-partition pruning entirely"],
          answer: 0,
          explain: "A standard view lets the optimizer push and reorder predicates freely, which is fast but can let a crafted expression observe rows the view would filter out (for example through errors). Secure views give up some of those reorderings to close that channel. Pruning still works for predicates inside the view; the cost is lost optimisations, not a full scan by definition." },
        { q: "ACCOUNTADMIN queries a table whose row access policy returns TRUE only for roles listed in a mapping table. ACCOUNTADMIN is not listed. What is returned?",
          options: ["All rows, because ACCOUNTADMIN bypasses policies", "An insufficient privileges error", "Zero rows, because policies apply to every role including ACCOUNTADMIN", "Only rows that ACCOUNTADMIN inserted"],
          answer: 2,
          explain: "Policies have no built-in admin bypass. If the body does not return TRUE for a role, that role sees nothing, with no error. If administrators genuinely need full access, encode it explicitly in the policy and govern who holds that role." },
        { q: "CREATE MASKING POLICY mp_amt AS (val NUMBER) RETURNS VARCHAR -> ... is rejected. Why?",
          options: ["NUMBER columns cannot be masked", "Every masking policy needs a USING clause", "Masking policies must return VARIANT", "The return type must match the input type, so a NUMBER column needs a policy that returns NUMBER"],
          answer: 3,
          explain: "A masking policy substitutes a value in place of the column, so the output must have the same data type as the input. To show a placeholder string for a numeric column, mask to NULL or a sentinel number, or expose a separate VARCHAR column through a view." }
      ]
    },
    "sec-perimeter": {
      title: "Perimeter, auth & sharing checkpoint",
      sub: "Network policies, key-pair rotation, SSO, shares, listings and reader accounts.",
      questions: [
        { q: "The account-level network policy allows only the corporate range. A user-level policy on service user SVC_ETL allows a cloud NAT address. SVC_ETL connects from that NAT address. What happens?",
          options: ["Blocked, because the account policy always applies", "Allowed: a user-level network policy replaces the account-level policy for that user", "Allowed only if both policies list the address", "It depends on which warehouse the session uses"],
          answer: 1,
          explain: "The most specific network policy wins: a policy on the user overrides the account-level policy rather than being combined with it. That is how you carve out a narrow path for one service identity without widening the account perimeter." },
        { q: "What is the zero-downtime way to rotate a service user's key pair?",
          options: ["Set the new public key in RSA_PUBLIC_KEY_2, move every client to the new private key, then unset the old RSA_PUBLIC_KEY", "Overwrite RSA_PUBLIC_KEY with the new key, then redeploy clients as fast as possible", "Create a new user for every rotation", "Temporarily switch the user to password authentication"],
          answer: 0,
          explain: "Snowflake accepts either of two registered public keys, so you can stage the new one in the second slot while the old one keeps working. Once DESC USER and LOGIN_HISTORY confirm all clients use the new fingerprint, you remove the old key. Overwriting the only slot breaks every client still holding the old private key." },
        { q: "An interactive script uses authenticator='externalbrowser' with user='jdoe'. The browser login succeeds but the connector reports that the user differs from the IdP user. Your IdP signs you in as jdoe@acme.example. What fixes it?",
          options: ["Switch the script to password authentication", "Pass the user exactly as the IdP login name (here the email form) so it matches the Snowflake LOGIN_NAME the SAML assertion maps to", "Add your IP address to the network policy", "Use the account locator instead of orgname-accountname"],
          answer: 1,
          explain: "With browser SSO the connector compares the user it was given with the identity the IdP asserted. If the IdP asserts the email form, the connector must be given that same string. The account identifier format is a separate concern and produces a different error." },
        { q: "Which of these can be granted to a share for consumers to query?",
          options: ["A standard (non-secure) view", "A temporary table", "An internal stage", "A secure view"],
          answer: 3,
          explain: "Shares expose tables, secure views, secure materialized views and secure UDFs. A standard view is rejected because its definition and optimizer behaviour could reveal more than intended. Temporary objects and stages are not shareable." },
        { q: "A provider creates a reader account for a partner without their own Snowflake account. Who pays for the compute that partner's queries use?",
          options: ["The partner, through a separate invoice", "Snowflake absorbs it", "The provider, because the reader account and its warehouses belong to the provider", "It is split evenly by default"],
          answer: 2,
          explain: "A reader account is created and managed by the provider, so its warehouse credits are billed to the provider. That makes reader accounts convenient for small consumers, but you should put a resource monitor on their warehouses." },
        { q: "The consumer account is in a different cloud region from the provider. What does a direct share require?",
          options: ["Nothing extra: direct shares work across regions", "Replication: for example a listing with cross-cloud auto-fulfillment, or replicating the database to a provider account in the consumer's region and sharing from there", "It is impossible; the consumer must migrate regions", "A reader account in the provider's region"],
          answer: 1,
          explain: "Direct shares are metadata pointers to the same storage, so provider and consumer must be in the same region. Crossing regions means the data has to be replicated, which listings with auto-fulfillment automate. Replication adds storage and transfer cost, so it is a real trade-off." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sec = {
    id: "sec",
    name: "Security & Governance",
    short: "SEC",
    tagline: "Least privilege, enforced by policy",
    color: "#f472b6",
    blurb: "Design a role hierarchy that survives growth, grant with ownership and future grants in mind, and push data protection into policies instead of views: masking, row access, tag-based masking and secure views. Then lock the perimeter with network rules, key-pair and SSO authentication, and share data with other accounts without copying it.",
    modules: [
      {
        id: "access",
        name: "Access Control",
        icon: "shield",
        lessons: [
          {
            id: "rbac-hierarchy",
            title: "The RBAC hierarchy and system roles",
            summary: "Privileges go to roles, roles go to users and other roles, and inheritance flows upward toward ACCOUNTADMIN.",
            minutes: 11,
            tags: ["rbac", "roles", "least-privilege"],
            blocks: [
              { t: "p", html: "Hold one picture: <strong>privileges are granted to roles, and roles are granted to users or to other roles</strong>. When role A is granted to role B, B inherits everything A can do. Every authorization question in Snowflake reduces to a walk down that graph from the roles active in your session." },
              { t: "diagram", id: "sf-rbac-hierarchy", caption: "ACCOUNTADMIN sits on top of SECURITYADMIN and SYSADMIN; custom functional roles roll up to SYSADMIN and inherit narrow access roles that hold the object privileges." },
              { t: "h", text: "The system roles" },
              { t: "table", headers: ["Role", "Owns the job of", "Daily use?"], rows: [
                ["ORGADMIN", "Organization-level operations: creating accounts, viewing org usage", "Rarely; a handful of platform owners"],
                ["ACCOUNTADMIN", "Everything in the account, including billing and account parameters; inherits SECURITYADMIN and SYSADMIN", "No. Break-glass only, MFA enforced, at least two named holders"],
                ["SECURITYADMIN", "Global MANAGE GRANTS; inherits USERADMIN", "Platform security team, through automation where possible"],
                ["USERADMIN", "CREATE USER and CREATE ROLE", "Identity provisioning (often driven by SCIM)"],
                ["SYSADMIN", "Warehouses and databases; the intended parent of every custom role", "Platform engineers, for container-level work"],
                ["PUBLIC", "Granted to every user automatically", "Never grant data privileges to it"]
              ] },
              { t: "note", variant: "warn", html: "Never set ACCOUNTADMIN as anyone's <code class='tok'>DEFAULT_ROLE</code>. Objects created while it is the primary role are owned by ACCOUNTADMIN, and SYSADMIN cannot manage them until ownership is transferred." },
              { t: "h", text: "Inheritance flows upward, and orphans are invisible" },
              { t: "p", html: "If you create a custom role and never grant it to SYSADMIN (directly or through a parent), it forms an <strong>orphan branch</strong>. The objects it owns sit outside the inherited reach of SYSADMIN and ACCOUNTADMIN, so administrators cannot manage or even see them without being granted that role. Wire every custom role into the tree the moment you create it." },
              { t: "code", lang: "sql", code:
                "USE ROLE USERADMIN;\n" +
                "CREATE ROLE IF NOT EXISTS sales_ro   COMMENT = 'access role: read SALES';\n" +
                "CREATE ROLE IF NOT EXISTS sales_rw   COMMENT = 'access role: write SALES';\n" +
                "CREATE ROLE IF NOT EXISTS analyst    COMMENT = 'functional role: BI analysts';\n" +
                "CREATE ROLE IF NOT EXISTS engineer   COMMENT = 'functional role: data engineers';\n\n" +
                "USE ROLE SECURITYADMIN;\n" +
                "GRANT ROLE sales_ro TO ROLE sales_rw;   -- RW inherits RO\n" +
                "GRANT ROLE sales_ro TO ROLE analyst;\n" +
                "GRANT ROLE sales_rw TO ROLE engineer;\n" +
                "GRANT ROLE analyst  TO ROLE sysadmin;   -- no orphans\n" +
                "GRANT ROLE engineer TO ROLE sysadmin;\n" +
                "GRANT ROLE analyst  TO USER jdoe;"
              },
              { t: "h", text: "Functional roles over access roles" },
              { t: "p", html: "The pattern that scales separates <strong>access roles</strong> (hold object privileges for one data domain at one level, such as <code class='tok'>SALES_RO</code>) from <strong>functional roles</strong> (represent a job, such as <code class='tok'>ANALYST</code>, and hold only other roles). Users get functional roles; functional roles get access roles. Adding a new dataset to every analyst becomes one grant." },
              { t: "table", headers: ["Tier", "Design", "What breaks"], rows: [
                ["Naive", "Grant object privileges straight to roles named after people or teams", "Hundreds of overlapping grants; nobody can answer who can read PII"],
                ["Solid", "Access roles per domain and level, functional roles per job, everything rolls up to SYSADMIN", "Grant scripts still drift if run by hand"],
                ["Standout", "Same model, declared in code (Terraform or schemachange), provisioned from the IdP via SCIM, with a scheduled diff against ACCOUNT_USAGE.GRANTS_TO_ROLES", "Takes upfront design; pays back at the first audit"]
              ] },
              { t: "widget", id: "rbacGraph" },
              { t: "code", lang: "sql", code:
                "SHOW GRANTS TO ROLE analyst;          -- what analyst holds directly\n" +
                "SHOW GRANTS OF ROLE sales_ro;         -- who has been granted sales_ro\n\n" +
                "-- account-wide audit (ACCOUNT_USAGE lags, typically up to a couple of hours)\n" +
                "SELECT grantee_name, privilege, granted_on, name\n" +
                "FROM snowflake.account_usage.grants_to_roles\n" +
                "WHERE deleted_on IS NULL AND grantee_name = 'SALES_RO'\n" +
                "ORDER BY granted_on, name;"
              },
              { t: "note", variant: "trap", html: "SECURITYADMIN holds MANAGE GRANTS, which means it can grant <em>itself</em> almost anything. Treat it as a privileged role on par with ACCOUNTADMIN, not as a junior admin." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"who can read this table\", \"the admin cannot see the objects\", \"new team needs the same access as analysts\", \"roles are a mess\", \"set up least privilege\". Answer with the graph: access roles, functional roles, everything rolls up to SYSADMIN." },
              { t: "note", variant: "key", html: "<strong>Privileges go to roles, roles go up the tree.</strong> Separate access roles from functional roles, wire every custom role under SYSADMIN, and keep ACCOUNTADMIN for break-glass." }
            ]
          },
          {
            id: "grants",
            title: "Privileges, ownership and future grants",
            summary: "Reading a table needs a chain of USAGE privileges plus SELECT, ownership is singular, and future grants are how new objects stay covered.",
            minutes: 10,
            tags: ["grants", "ownership", "future-grants"],
            blocks: [
              { t: "p", html: "Think of a privilege check as a <strong>chain of doors</strong>. To select from <code class='tok'>sales.core.orders</code> your session needs USAGE on a warehouse, USAGE on the database, USAGE on the schema, and SELECT on the table. Missing any link and the error is usually \"does not exist or not authorized\", deliberately indistinguishable from a typo." },
              { t: "table", headers: ["Object", "Common privileges", "Notes"], rows: [
                ["Warehouse", "USAGE, OPERATE, MONITOR, MODIFY", "USAGE to run queries; OPERATE to resume or suspend"],
                ["Database", "USAGE, CREATE SCHEMA, MONITOR", "USAGE is only a door, it grants no data"],
                ["Schema", "USAGE, CREATE TABLE, CREATE VIEW, CREATE STAGE", "CREATE privileges decide who can add objects"],
                ["Table / view", "SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES", "REFERENCES lets a role see structure without reading rows"],
                ["Any object", "OWNERSHIP", "Exactly one owner role; full control including grants"]
              ] },
              { t: "code", lang: "sql", code:
                "-- a complete read-only access role for one schema\n" +
                "USE ROLE SECURITYADMIN;\n" +
                "GRANT USAGE ON DATABASE sales                      TO ROLE sales_ro;\n" +
                "GRANT USAGE ON SCHEMA   sales.core                 TO ROLE sales_ro;\n" +
                "GRANT SELECT ON ALL TABLES    IN SCHEMA sales.core TO ROLE sales_ro;\n" +
                "GRANT SELECT ON ALL VIEWS     IN SCHEMA sales.core TO ROLE sales_ro;\n" +
                "GRANT SELECT ON FUTURE TABLES IN SCHEMA sales.core TO ROLE sales_ro;\n" +
                "GRANT SELECT ON FUTURE VIEWS  IN SCHEMA sales.core TO ROLE sales_ro;\n" +
                "GRANT USAGE ON WAREHOUSE bi_wh                     TO ROLE analyst;"
              },
              { t: "h", text: "Ownership" },
              { t: "p", html: "Every object has exactly one owning role, normally the primary role that created it. The owner can alter, drop and grant on the object. Transfer it with <code class='tok'>GRANT OWNERSHIP</code>, and decide explicitly what happens to the grants already on it." },
              { t: "code", lang: "sql", code:
                "-- hand a table to the deploy role but keep everyone's existing access\n" +
                "GRANT OWNERSHIP ON TABLE sales.core.orders TO ROLE deploy_role COPY CURRENT GRANTS;\n\n" +
                "-- bulk transfer, dropping old grants (they must then be re-granted)\n" +
                "GRANT OWNERSHIP ON ALL TABLES IN SCHEMA sales.core TO ROLE deploy_role REVOKE CURRENT GRANTS;"
              },
              { t: "h", text: "Future grants" },
              { t: "p", html: "<code class='tok'>ON ALL</code> is a snapshot of objects that exist when the statement runs. <code class='tok'>ON FUTURE</code> registers a rule that fires every time a new object of that type appears in the container. When the same object type has future grants at both the database and the schema level, <strong>the schema-level ones win and the database-level ones are ignored for that schema</strong>." },
              { t: "compare",
                bad: { title: "ON ALL only", items: ["Covers what exists today", "Every new table needs someone to re-run the script", "Pipelines break the morning after a new table lands"] },
                good: { title: "ON ALL + ON FUTURE", items: ["Existing objects covered once", "New objects inherit grants at creation", "Audit with SHOW FUTURE GRANTS IN SCHEMA"] } },
              { t: "note", variant: "trap", html: "<code class='tok'>CREATE OR REPLACE TABLE</code> creates a <em>new</em> object: direct grants on the old one are gone. Future grants will re-apply, but one-off grants will not. Add <code class='tok'>COPY GRANTS</code> when replacing objects that carry hand-made grants." },
              { t: "code", lang: "sql", code:
                "CREATE OR REPLACE TABLE sales.core.orders COPY GRANTS AS\n" +
                "SELECT * FROM sales.staging.orders_clean;\n\n" +
                "SHOW FUTURE GRANTS IN SCHEMA sales.core;\n" +
                "SHOW GRANTS ON TABLE sales.core.orders;"
              },
              { t: "table", headers: ["Tier", "Grant strategy", "Outcome"], rows: [
                ["Naive", "GRANT SELECT on individual tables as tickets arrive", "Access depends on who asked; new tables invisible"],
                ["Solid", "ON ALL plus ON FUTURE per schema, to access roles only", "New objects covered automatically"],
                ["Standout", "Solid, plus objects owned by a dedicated deploy role and grants declared in version control", "Ownership is predictable, drift is detectable, replacement is safe"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"the new table is not visible\", \"it worked yesterday\", \"object does not exist or not authorized\", \"we replaced the table and lost access\". Check the USAGE chain, ON FUTURE coverage, schema-versus-database future grant precedence, and COPY GRANTS." },
              { t: "note", variant: "key", html: "<strong>USAGE chain + SELECT, one owner, and FUTURE grants for what does not exist yet.</strong> Most \"access disappeared\" incidents are a missing future grant or a CREATE OR REPLACE without COPY GRANTS." }
            ]
          },
          {
            id: "database-roles",
            title: "Managed access schemas, database roles and secondary roles",
            summary: "Centralise grant decisions, scope roles to a database, and understand how secondary roles change what a session can do.",
            minutes: 10,
            tags: ["managed-access", "database-roles", "secondary-roles"],
            blocks: [
              { t: "p", html: "Three features refine the basic model. <strong>Managed access</strong> moves grant decisions from object owners to the schema owner. <strong>Database roles</strong> are roles that live inside one database. <strong>Secondary roles</strong> let a session use the union of several roles' privileges at once." },
              { t: "h", text: "Managed access schemas" },
              { t: "p", html: "In a regular schema, whoever owns a table can grant on it, so a pipeline role can quietly share data with anyone. In a <strong>managed access</strong> schema only the schema owner or a role with MANAGE GRANTS can grant privileges on contained objects. Owners still create and alter; they just cannot hand out access." },
              { t: "code", lang: "sql", code:
                "CREATE SCHEMA IF NOT EXISTS finance.ledger WITH MANAGED ACCESS;\n" +
                "-- or convert an existing schema\n" +
                "ALTER SCHEMA finance.ledger ENABLE MANAGED ACCESS;"
              },
              { t: "h", text: "Database roles" },
              { t: "p", html: "A database role holds privileges on objects in its own database only, and it travels with the database: clone or replicate the database and the role comes along. It cannot be a session's primary role; users get it through an account role. That makes it the natural unit for granular access inside a <strong>share</strong>." },
              { t: "code", lang: "sql", code:
                "USE ROLE SYSADMIN;\n" +
                "CREATE DATABASE ROLE IF NOT EXISTS sales.reader;\n" +
                "GRANT USAGE ON SCHEMA sales.core TO DATABASE ROLE sales.reader;\n" +
                "GRANT SELECT ON ALL TABLES IN SCHEMA sales.core TO DATABASE ROLE sales.reader;\n" +
                "GRANT SELECT ON FUTURE TABLES IN SCHEMA sales.core TO DATABASE ROLE sales.reader;\n\n" +
                "GRANT DATABASE ROLE sales.reader TO ROLE analyst;      -- to an account role\n" +
                "GRANT DATABASE ROLE sales.reader TO SHARE sales_share; -- or into a share"
              },
              { t: "table", headers: ["", "Account role", "Database role"], rows: [
                ["Scope of privileges", "Any object in the account", "Objects in its own database"],
                ["USE ROLE / primary role", "Yes", "No"],
                ["Granted to", "Users, other account roles", "Account roles, other database roles in the same database, shares"],
                ["Survives clone / replication of the database", "No (lives at account level)", "Yes"]
              ] },
              { t: "h", text: "Secondary roles" },
              { t: "p", html: "<code class='tok'>USE SECONDARY ROLES ALL</code> (or a user's <code class='tok'>DEFAULT_SECONDARY_ROLES</code>) activates every role granted to the user alongside the primary role. Queries and DML are authorised against the <strong>union</strong> of privileges. CREATE statements are authorised by, and owned by, the <strong>primary role only</strong>. Newer accounts may default users to all secondary roles, so check before assuming a single-role session." },
              { t: "code", lang: "sql", code:
                "USE ROLE analyst;\n" +
                "USE SECONDARY ROLES ALL;\n" +
                "SELECT CURRENT_ROLE(), CURRENT_SECONDARY_ROLES(), IS_ROLE_IN_SESSION('SALES_RO');\n\n" +
                "-- reproduce exactly what a service sees: one role, nothing else\n" +
                "USE SECONDARY ROLES NONE;"
              },
              { t: "note", variant: "trap", html: "\"It works for me\" is unreliable with secondary roles on: your query may succeed through a role the service account does not have. Debug access with <code class='tok'>USE SECONDARY ROLES NONE</code> and the service's exact primary role." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"owners keep granting access to their own tables\", \"share only part of a database\", \"roles should move with the cloned database\", \"works in my session but not in the job\". Reach for managed access, database roles, and a secondary-roles check." },
              { t: "quiz", id: "sec-access" },
              { t: "note", variant: "key", html: "<strong>Managed access centralises grants, database roles scope them to a database, secondary roles union them per session.</strong> Ownership always follows the primary role." }
            ]
          }
        ]
      },
      {
        id: "policies",
        name: "Data Protection Policies",
        icon: "diamond",
        lessons: [
          {
            id: "masking",
            title: "Dynamic data masking policies",
            summary: "Attach one schema-level policy to a column and Snowflake rewrites its value at query time based on who is asking.",
            minutes: 11,
            tags: ["masking", "pii", "policies"],
            blocks: [
              { t: "p", html: "A masking policy is a <strong>function stored as a schema-level object</strong> and attached to a column. At query time Snowflake substitutes <code class='tok'>policy(column)</code> wherever the column appears, so the same <code class='tok'>SELECT</code> returns clear text for one role and a masked value for another. No duplicate views, no per-role tables. It needs Enterprise edition or higher." },
              { t: "code", lang: "sql", code:
                "USE ROLE governance_admin;\n" +
                "CREATE MASKING POLICY IF NOT EXISTS gov.policies.mp_email\n" +
                "  AS (val VARCHAR) RETURNS VARCHAR ->\n" +
                "  CASE\n" +
                "    WHEN IS_ROLE_IN_SESSION('PII_READER') THEN val\n" +
                "    WHEN IS_ROLE_IN_SESSION('SUPPORT')    THEN REGEXP_REPLACE(val, '^[^@]+', '*****')\n" +
                "    ELSE '***MASKED***'\n" +
                "  END\n" +
                "  COMMENT = 'email: clear for PII_READER, domain-only for SUPPORT';\n\n" +
                "ALTER TABLE hr.core.employees MODIFY COLUMN email\n" +
                "  SET MASKING POLICY gov.policies.mp_email;"
              },
              { t: "h", text: "CURRENT_ROLE versus IS_ROLE_IN_SESSION" },
              { t: "p", html: "<code class='tok'>CURRENT_ROLE() = 'PII_READER'</code> matches only when that exact role is primary, ignoring inheritance and secondary roles. <code class='tok'>IS_ROLE_IN_SESSION('PII_READER')</code> is true when the role is active or inherited. Use the latter almost always: the policy then respects your role hierarchy instead of fighting it." },
              { t: "table", headers: ["Technique", "Example output", "Use when"], rows: [
                ["Full redaction", "***MASKED***", "Value is never needed by the role"],
                ["Partial", "*****@acme.example", "Support needs the domain, not the person"],
                ["Deterministic hash", "SHA2(val, 256)", "Joins and distinct counts without exposure"],
                ["NULL / sentinel", "NULL", "Numeric or date columns; type must match"],
                ["Conditional (USING)", "Clear only where consent_flag = TRUE", "Masking depends on another column in the row"]
              ] },
              { t: "code", lang: "sql", code:
                "-- conditional masking: the second argument comes from the same row\n" +
                "CREATE MASKING POLICY IF NOT EXISTS gov.policies.mp_phone_consent\n" +
                "  AS (val VARCHAR, consent BOOLEAN) RETURNS VARCHAR ->\n" +
                "  CASE WHEN consent OR IS_ROLE_IN_SESSION('PII_READER') THEN val ELSE NULL END;\n\n" +
                "ALTER TABLE crm.core.contacts MODIFY COLUMN phone\n" +
                "  SET MASKING POLICY gov.policies.mp_phone_consent USING (phone, marketing_consent);"
              },
              { t: "note", variant: "warn", html: "The return type must equal the input type. A <code class='tok'>NUMBER</code> column needs a policy that returns <code class='tok'>NUMBER</code>; you cannot mask a salary to the string 'hidden'." },
              { t: "note", variant: "trap", html: "The policy applies wherever the column is referenced, including <code class='tok'>WHERE</code> and <code class='tok'>JOIN</code>. A role that sees a redacted email cannot filter on the real value; with a deterministic hash it can still join consistently across tables masked the same way." },
              { t: "h", text: "Who may create and attach policies" },
              { t: "p", html: "Separate duties: a governance role gets <code class='tok'>CREATE MASKING POLICY</code> on a dedicated policy schema and the account-level <code class='tok'>APPLY MASKING POLICY</code>. Table owners should not be able to unset policies on their own columns, which is what that separation buys you." },
              { t: "table", headers: ["Tier", "Approach", "Cost"], rows: [
                ["Naive", "One view per audience with hand-written CASE expressions", "Views multiply; someone queries the base table directly"],
                ["Solid", "Masking policies on sensitive columns, IS_ROLE_IN_SESSION checks, owned by a governance role", "Each new PII column must be remembered and attached"],
                ["Standout", "Tag-based masking: classify columns with a tag, attach policies to the tag, audit coverage from POLICY_REFERENCES and TAG_REFERENCES", "Needs tagging discipline and classification upfront"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"analysts must not see emails\", \"support sees partial card numbers\", \"same table, different audiences\", \"we have five copies of the customer view\". Masking policy on the column, keyed on IS_ROLE_IN_SESSION." },
              { t: "note", variant: "key", html: "<strong>Masking is a column-level function evaluated per query.</strong> Use IS_ROLE_IN_SESSION, match the return type, and keep policy ownership away from data owners." }
            ]
          },
          {
            id: "row-access",
            title: "Row access policies",
            summary: "A boolean policy attached to a table filters rows per query, usually by looking the caller up in a mapping table.",
            minutes: 10,
            tags: ["row-access", "rls", "policies"],
            blocks: [
              { t: "p", html: "A row access policy is a <strong>boolean function Snowflake adds as an invisible WHERE clause</strong>. For every row it answers: may the current session see this? Returning FALSE is silent: no error, just fewer rows. Like masking, it requires Enterprise edition or higher." },
              { t: "code", lang: "sql", code:
                "CREATE TABLE IF NOT EXISTS gov.policies.region_map (\n" +
                "  role_name VARCHAR NOT NULL,\n" +
                "  region    VARCHAR NOT NULL\n" +
                ");\n" +
                "INSERT INTO gov.policies.region_map VALUES\n" +
                "  ('SUPPORT_EMEA', 'EMEA'), ('SUPPORT_AMER', 'AMER'),\n" +
                "  ('ANALYST', 'EMEA'), ('ANALYST', 'AMER'), ('ANALYST', 'APAC');\n\n" +
                "-- name the argument differently from the mapping column, or the subquery\n" +
                "-- resolves it to m.region and the filter becomes always-true\n" +
                "CREATE ROW ACCESS POLICY IF NOT EXISTS gov.policies.rap_region\n" +
                "  AS (row_region VARCHAR) RETURNS BOOLEAN ->\n" +
                "  IS_ROLE_IN_SESSION('HR_ADMIN')\n" +
                "  OR EXISTS (\n" +
                "    SELECT 1 FROM gov.policies.region_map m\n" +
                "    WHERE m.role_name = CURRENT_ROLE()\n" +
                "      AND m.region = row_region\n" +
                "  );\n\n" +
                "ALTER TABLE hr.core.employees ADD ROW ACCESS POLICY gov.policies.rap_region ON (region);"
              },
              { t: "h", text: "How it is evaluated" },
              { t: "ul", items: [
                "<strong>Row access first, masking second.</strong> The row policy sees unmasked values, then masking runs on surviving rows.",
                "<strong>One row access policy per table or view</strong> at a time; combine rules inside a single body.",
                "<strong>No admin bypass.</strong> ACCOUNTADMIN sees zero rows unless the body says otherwise.",
                "<strong>Mapping tables are read with the policy owner's privileges</strong>, so querying roles do not need SELECT on them."
              ] },
              { t: "widget", id: "policyLab" },
              { t: "note", variant: "tip", html: "Keep mapping lookups cheap: a small table keyed on role name, or a memoizable function that returns the caller's entitlements once per query. A correlated lookup against a large table on every row shows up quickly in the Query Profile." },
              { t: "compare",
                bad: { title: "Secure view per region", items: ["One view per audience, logic duplicated", "Base table must be locked down separately", "New region means new view, new grants"] },
                good: { title: "Row access policy + mapping table", items: ["One policy on the base table, every access path covered", "New entitlement is an INSERT into the mapping table", "Policy owned by governance, not by the data team"] } },
              { t: "code", lang: "sql", code:
                "-- test as the affected role, with nothing else active\n" +
                "USE ROLE support_emea;\n" +
                "USE SECONDARY ROLES NONE;\n" +
                "SELECT region, COUNT(*) FROM hr.core.employees GROUP BY region;\n\n" +
                "-- find every object a policy protects\n" +
                "SELECT ref_database_name, ref_schema_name, ref_entity_name, ref_column_name\n" +
                "FROM TABLE(hr.information_schema.policy_references(\n" +
                "  policy_name => 'gov.policies.rap_region'));"
              },
              { t: "table", headers: ["Symptom", "Likely cause", "Check"], rows: [
                ["Query returns 0 rows, no error", "Role missing from the mapping table, or the policy compares the wrong role", "Run as that role with secondary roles off; inspect the mapping rows"],
                ["Every role sees every row", "Policy argument shadowed by a mapping column of the same name", "GET_DDL on the policy; rename the argument"],
                ["Queries got slow after attaching", "Per-row lookup against a large or unclustered mapping table", "Query Profile; shrink or memoize the entitlement lookup"],
                ["Admin cannot see data", "No explicit admin branch in the body", "Add a governed bypass role, not ACCOUNTADMIN"]
              ] },
              { t: "note", variant: "trap", html: "The example body mixes <code class='tok'>IS_ROLE_IN_SESSION</code> (hierarchy-aware) with <code class='tok'>CURRENT_ROLE()</code> in the lookup (exact primary role). That is deliberate only if you want mapping rows per primary role. If users activate secondary roles, decide which semantics you mean and test both paths." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"each region sees only its customers\", \"multi-tenant table\", \"partners must see only their rows\", \"the admin query returns nothing\". Row access policy with a mapping table, evaluated before masking." },
              { t: "note", variant: "key", html: "<strong>A row access policy is a governed, invisible WHERE clause.</strong> Drive it from a mapping table, remember there is no admin bypass, and test with secondary roles off." }
            ]
          },
          {
            id: "tags",
            title: "Object tagging and tag-based masking",
            summary: "Tags classify objects and columns; attach masking policies to a tag and every tagged column is protected automatically.",
            minutes: 10,
            tags: ["tags", "classification", "tag-based-masking"],
            blocks: [
              { t: "p", html: "A tag is a <strong>schema-level key with a string value</strong> that you set on accounts, warehouses, databases, schemas, tables and columns. On its own it is metadata for discovery and cost attribution. Attach a masking policy to it and it becomes <strong>enforcement</strong>: any column carrying the tag is masked by that policy." },
              { t: "code", lang: "sql", code:
                "CREATE TAG IF NOT EXISTS gov.tags.pii_type\n" +
                "  ALLOWED_VALUES 'email', 'phone', 'national_id', 'name'\n" +
                "  COMMENT = 'personal data category';\n\n" +
                "ALTER TABLE hr.core.employees MODIFY\n" +
                "  COLUMN email SET TAG gov.tags.pii_type = 'email',\n" +
                "  COLUMN phone SET TAG gov.tags.pii_type = 'phone';\n\n" +
                "-- cost attribution uses the same mechanism\n" +
                "CREATE TAG IF NOT EXISTS gov.tags.cost_center;\n" +
                "ALTER WAREHOUSE bi_wh SET TAG gov.tags.cost_center = 'analytics';"
              },
              { t: "h", text: "Tag-based masking" },
              { t: "p", html: "Attach one masking policy per data type to a tag. Inside the policy, <code class='tok'>SYSTEM$GET_TAG_VALUE</code> or <code class='tok'>SYSTEM$GET_TAG_ON_CURRENT_COLUMN</code> lets the body branch on the tag value, so one policy can treat emails and national ids differently." },
              { t: "code", lang: "sql", code:
                "CREATE MASKING POLICY IF NOT EXISTS gov.policies.mp_pii_string\n" +
                "  AS (val VARCHAR) RETURNS VARCHAR ->\n" +
                "  CASE\n" +
                "    WHEN IS_ROLE_IN_SESSION('PII_READER') THEN val\n" +
                "    WHEN SYSTEM$GET_TAG_ON_CURRENT_COLUMN('gov.tags.pii_type') = 'email'\n" +
                "      THEN REGEXP_REPLACE(val, '^[^@]+', '*****')\n" +
                "    ELSE '***MASKED***'\n" +
                "  END;\n\n" +
                "ALTER TAG gov.tags.pii_type SET MASKING POLICY gov.policies.mp_pii_string;"
              },
              { t: "ul", items: [
                "<strong>Inheritance:</strong> a tag set on a schema or table is inherited by the objects and columns beneath it unless overridden lower down.",
                "<strong>Precedence:</strong> a masking policy set directly on a column wins over a tag-based policy.",
                "<strong>Classification:</strong> Snowflake's built-in sensitive-data classification can suggest or apply semantic and privacy category tags, which you can map to your own tags.",
                "<strong>Edition:</strong> tag-based masking needs Enterprise edition or higher."
              ] },
              { t: "h", text: "Auditing coverage" },
              { t: "code", lang: "sql", code:
                "-- real-time, one object\n" +
                "SELECT * FROM TABLE(hr.information_schema.tag_references_all_columns(\n" +
                "  'hr.core.employees', 'table'));\n\n" +
                "-- account-wide coverage (ACCOUNT_USAGE lags by up to a couple of hours)\n" +
                "SELECT tag_name, tag_value, object_database, object_name, column_name\n" +
                "FROM snowflake.account_usage.tag_references\n" +
                "WHERE tag_name = 'PII_TYPE' AND object_deleted IS NULL;"
              },
              { t: "note", variant: "trap", html: "Coverage reports built on <code class='tok'>ACCOUNT_USAGE.TAG_REFERENCES</code> lag behind reality. Run post-deploy checks with the INFORMATION_SCHEMA table functions, and use ACCOUNT_USAGE for scheduled audits." },
              { t: "table", headers: ["Tier", "Governance model", "Failure mode"], rows: [
                ["Naive", "Policies attached column by column during code review", "A new PII column ships unmasked because nobody remembered"],
                ["Solid", "Tag-based masking; ingestion templates set tags on new columns", "Tags depend on the template being used"],
                ["Standout", "Tags plus scheduled classification, plus an alert on untagged columns that classification flags as sensitive", "Classification can misfire; needs a human review queue"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"hundreds of PII columns\", \"new columns must be protected by default\", \"find every sensitive column\", \"charge back by team\". Tags for discovery and attribution, tag-based masking for enforcement." },
              { t: "note", variant: "key", html: "<strong>Tag the data, attach the policy to the tag.</strong> Protection then follows classification instead of developer memory; direct column policies are the explicit exception." }
            ]
          },
          {
            id: "secure-views",
            title: "Secure views and secure functions",
            summary: "Secure views hide their definition and block optimizer shortcuts that could leak filtered rows, at some performance cost.",
            minutes: 9,
            tags: ["secure-views", "secure-udf", "sharing"],
            blocks: [
              { t: "p", html: "A standard view is a saved query: the optimizer may inline it, push your predicates into it, and reorder evaluation. That is fast, but a cleverly written predicate or UDF could run <em>before</em> the view's own filter and observe rows the view was meant to hide, for example by raising an error that includes a value. A <strong>secure view</strong> closes those channels and hides its definition from non-owners." },
              { t: "code", lang: "sql", code:
                "CREATE OR REPLACE SECURE VIEW sales.share.v_orders_by_partner COPY GRANTS AS\n" +
                "SELECT o.order_id, o.order_date, o.amount, o.partner_id\n" +
                "FROM sales.core.orders o\n" +
                "JOIN sales.share.partner_entitlements e\n" +
                "  ON e.partner_id = o.partner_id\n" +
                " AND e.consumer_account = CURRENT_ACCOUNT();\n\n" +
                "SHOW VIEWS LIKE 'V_ORDERS_BY_PARTNER' IN SCHEMA sales.share;  -- is_secure = true\n" +
                "SELECT GET_DDL('VIEW', 'sales.share.v_orders_by_partner');   -- owner only"
              },
              { t: "compare",
                bad: { title: "Standard view", items: ["Definition visible to anyone with access", "Full optimizer freedom: fastest", "Cannot be added to a share"] },
                good: { title: "Secure view", items: ["Definition hidden from non-owners", "Some rewrites disabled so filters run first", "Required for exposing views through shares"] } },
              { t: "h", text: "Secure UDFs" },
              { t: "p", html: "<code class='tok'>CREATE SECURE FUNCTION</code> does the same for functions: the body is hidden and the optimizer treats it as opaque. Use it when the logic itself is sensitive (a scoring formula) or when the function is shared with other accounts." },
              { t: "code", lang: "sql", code:
                "CREATE OR REPLACE SECURE FUNCTION sales.share.risk_band(amount NUMBER)\n" +
                "RETURNS VARCHAR\n" +
                "AS $$\n" +
                "  CASE WHEN amount >= 100000 THEN 'high'\n" +
                "       WHEN amount >= 10000  THEN 'medium'\n" +
                "       ELSE 'low' END\n" +
                "$$;"
              },
              { t: "table", headers: ["Need", "Reach for", "Why"], rows: [
                ["Hide columns or values from some roles", "Masking policy", "Applies to every access path, including the base table"],
                ["Hide rows from some roles", "Row access policy", "Same: enforced on the table, not on one view"],
                ["Expose a curated projection to another account", "Secure view in a share", "Shares require secure objects; CURRENT_ACCOUNT() filters per consumer"],
                ["Hide business logic", "Secure view or secure UDF", "Definition invisible to non-owners"]
              ] },
              { t: "note", variant: "warn", html: "Secure views are not free. Expect some queries to run slower than the standard-view equivalent because certain predicate pushdowns are blocked. Make views secure when they are a boundary, not by reflex on every internal view." },
              { t: "note", variant: "trap", html: "A secure view is only a boundary if the base table is locked down. If the consumer role can also select from the underlying table, the view protects nothing; policies on the table are the stronger control." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"share a view with a partner\", \"hide how the metric is computed\", \"definition must not be visible\", \"consumers must only see their own rows\". Secure view, filtered by CURRENT_ACCOUNT() or a role mapping." },
              { t: "quiz", id: "sec-policies" },
              { t: "note", variant: "key", html: "<strong>Secure views trade some optimizer freedom for a real boundary.</strong> Use them for shares and sensitive logic; use policies when the protection must cover the base table." }
            ]
          }
        ]
      },
      {
        id: "perimeter",
        name: "Perimeter, Auth & Sharing",
        icon: "globe",
        lessons: [
          {
            id: "network-policies",
            title: "Network policies and network rules",
            summary: "Network rules describe addresses and endpoints; network policies combine them to allow or block access at account, user or integration level.",
            minutes: 10,
            tags: ["network-policy", "network-rules", "perimeter"],
            blocks: [
              { t: "p", html: "Separate <strong>what</strong> from <strong>where it applies</strong>. A <strong>network rule</strong> is a schema-level object listing identifiers of one type: IPv4 ranges, private endpoint ids, or host:port pairs for egress. A <strong>network policy</strong> references allowed and blocked rules and is then attached to the account, a user, or a security integration." },
              { t: "code", lang: "sql", code:
                "USE ROLE SECURITYADMIN;\n" +
                "CREATE NETWORK RULE IF NOT EXISTS gov.net.corp_egress_ips\n" +
                "  MODE = INGRESS TYPE = IPV4\n" +
                "  VALUE_LIST = ('203.0.113.0/24', '198.51.100.10');\n\n" +
                "CREATE NETWORK RULE IF NOT EXISTS gov.net.etl_vpce\n" +
                "  MODE = INGRESS TYPE = AWSVPCEID\n" +
                "  VALUE_LIST = ('vpce-0abc1234def567890');\n\n" +
                "CREATE NETWORK POLICY IF NOT EXISTS np_corporate\n" +
                "  ALLOWED_NETWORK_RULE_LIST = ('gov.net.corp_egress_ips', 'gov.net.etl_vpce')\n" +
                "  COMMENT = 'corporate VPN egress + ETL private endpoint';"
              },
              { t: "h", text: "Precedence: most specific wins" },
              { t: "table", headers: ["Level", "Attach with", "Effect"], rows: [
                ["Account", "ALTER ACCOUNT SET NETWORK_POLICY = np_corporate", "Default for every user"],
                ["Security integration", "ALTER SECURITY INTEGRATION ... SET NETWORK_POLICY", "Applies to OAuth or SCIM traffic through that integration"],
                ["User", "ALTER USER svc_etl SET NETWORK_POLICY = np_etl", "Replaces the account policy for that user; it does not add to it"]
              ] },
              { t: "note", variant: "warn", html: "Roll out on one test user first, then the account. Snowflake guards against activating an account-level policy that blocks your current address, but a later change can still lock out service users you forgot about. Keep a documented break-glass path." },
              { t: "code", lang: "sql", code:
                "SELECT CURRENT_IP_ADDRESS();   -- what Snowflake sees for this session\n\n" +
                "ALTER USER test_user SET NETWORK_POLICY = np_corporate;  -- trial\n" +
                "ALTER ACCOUNT SET NETWORK_POLICY = np_corporate;         -- then everyone\n\n" +
                "-- who is being rejected, and from where\n" +
                "SELECT event_timestamp, user_name, client_ip, error_code, error_message\n" +
                "FROM snowflake.account_usage.login_history\n" +
                "WHERE is_success = 'NO'\n" +
                "  AND event_timestamp > DATEADD('day', -1, CURRENT_TIMESTAMP())\n" +
                "ORDER BY event_timestamp DESC;"
              },
              { t: "h", text: "Reading \"IP not allowed\" errors" },
              { t: "p", html: "A client error along the lines of <code class='tok'>250001 ... IP ... is not allowed to access Snowflake</code> means authentication never got a chance: a network policy rejected the source address. The usual causes are being off the corporate VPN, a CI runner with a new NAT address, or traffic leaving through a different egress than the rule lists. Check <code class='tok'>CURRENT_IP_ADDRESS()</code> from a session that works, and compare with the rule." },
              { t: "h", text: "Egress rules for external access" },
              { t: "p", html: "Network rules with <code class='tok'>MODE = EGRESS TYPE = HOST_PORT</code> are the allow-list for code running inside Snowflake (UDFs and procedures) that calls out to external APIs, wired in through an external access integration. Same object type, opposite direction." },
              { t: "code", lang: "sql", code:
                "CREATE NETWORK RULE IF NOT EXISTS gov.net.fx_api\n" +
                "  MODE = EGRESS TYPE = HOST_PORT VALUE_LIST = ('api.fx-rates.example:443');\n\n" +
                "CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS fx_api_access\n" +
                "  ALLOWED_NETWORK_RULES = (gov.net.fx_api)\n" +
                "  ALLOWED_AUTHENTICATION_SECRETS = (gov.secrets.fx_api_key)\n" +
                "  ENABLED = TRUE;"
              },
              { t: "table", headers: ["Tier", "Perimeter", "Gap"], rows: [
                ["Naive", "No network policy; rely on passwords", "Leaked credentials work from anywhere"],
                ["Solid", "Account policy for corporate ranges; user-level policies for each service identity", "Lists drift as NAT addresses change"],
                ["Standout", "Private connectivity for pipelines, network rules managed in code, failed-login alerting on LOGIN_HISTORY", "More moving parts in the network layer"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"only from the office or VPN\", \"lock down service accounts\", \"IP not allowed\", \"private link\", \"UDF needs to call an API\". Network rules + policy at the most specific level that fits; egress rules for outbound calls." },
              { t: "note", variant: "key", html: "<strong>Rules describe addresses, policies decide, the most specific attachment wins.</strong> A user-level policy replaces the account policy; test on one user before switching the account." }
            ]
          },
          {
            id: "auth",
            title: "Authentication: key-pair, SSO, OAuth and MFA",
            summary: "Humans use SSO with MFA, services use key-pair or OAuth, and keys rotate through two public-key slots with no downtime.",
            minutes: 12,
            tags: ["authentication", "key-pair", "sso", "mfa"],
            blocks: [
              { t: "p", html: "Pick the method by <strong>who is logging in</strong>. People should come through your identity provider with MFA. Services should never have a human password: give them a key pair or an OAuth flow, and mark them as service users so password and MFA prompts do not apply. Snowflake has been phasing out single-factor password sign-in, so plan as if passwords alone will stop working." },
              { t: "table", headers: ["Method", "Best for", "Watch out for"], rows: [
                ["SSO (SAML security integration)", "People, through the corporate IdP", "Snowflake login name must match what the IdP asserts"],
                ["External or Snowflake OAuth", "BI tools and apps acting on behalf of a user", "Token lifetimes, role scoping, refresh handling"],
                ["Key-pair (RSA)", "Pipelines, CI, service users", "Private key storage and rotation"],
                ["Programmatic access tokens", "Tools that only accept a token-style secret", "Treat as a secret with an expiry; scope with a role restriction"],
                ["Password + MFA", "Legacy fallback for people", "Being phased out for single-factor use"]
              ] },
              { t: "code", lang: "sql", code:
                "USE ROLE USERADMIN;\n" +
                "CREATE USER IF NOT EXISTS svc_etl\n" +
                "  TYPE = SERVICE                       -- no password, no MFA prompts\n" +
                "  DEFAULT_ROLE = etl_role\n" +
                "  DEFAULT_WAREHOUSE = etl_wh\n" +
                "  RSA_PUBLIC_KEY = '<rsa_public_key_body>'\n" +
                "  COMMENT = 'nightly ingestion';\n" +
                "GRANT ROLE etl_role TO USER svc_etl;"
              },
              { t: "h", text: "Generating a key pair" },
              { t: "code", lang: "bash", code:
                "# private key: PKCS#8, protected by a passphrase you store in your vault\n" +
                "openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8\n" +
                "# public key: the body between the BEGIN/END lines goes into RSA_PUBLIC_KEY\n" +
                "openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub\n" +
                "chmod 600 rsa_key.p8   # never commit it; load it from the vault at runtime"
              },
              { t: "code", lang: "python", code:
                "import os\n" +
                "import snowflake.connector\n\n" +
                "conn = snowflake.connector.connect(\n" +
                "    account=os.environ['SNOWFLAKE_ACCOUNT'],          # e.g. acme-prod (orgname-accountname)\n" +
                "    user=os.environ['SNOWFLAKE_USER'],                # svc_etl\n" +
                "    private_key_file=os.environ['SNOWFLAKE_PRIVATE_KEY_PATH'],\n" +
                "    private_key_file_pwd=os.environ.get('SNOWFLAKE_PRIVATE_KEY_PASSPHRASE'),\n" +
                "    role=os.environ.get('SNOWFLAKE_ROLE', 'ETL_ROLE'),\n" +
                "    warehouse=os.environ.get('SNOWFLAKE_WAREHOUSE', 'ETL_WH'),\n" +
                ")"
              },
              { t: "h", text: "Rotation through two slots" },
              { t: "p", html: "A user can hold two public keys, <code class='tok'>RSA_PUBLIC_KEY</code> and <code class='tok'>RSA_PUBLIC_KEY_2</code>, and either one authenticates. Stage the new key in the empty slot, move clients, confirm, then remove the old one." },
              { t: "code", lang: "sql", code:
                "ALTER USER svc_etl SET RSA_PUBLIC_KEY_2 = '<new_rsa_public_key_body>';\n" +
                "DESC USER svc_etl;   -- note RSA_PUBLIC_KEY_FP and RSA_PUBLIC_KEY_2_FP\n" +
                "-- ...deploy the new private key to every client, then confirm logins...\n" +
                "ALTER USER svc_etl UNSET RSA_PUBLIC_KEY;   -- retire the old key"
              },
              { t: "h", text: "SSO from scripts" },
              { t: "p", html: "Interactive tools use <code class='tok'>authenticator='externalbrowser'</code>, which opens the IdP login in a browser. Two details cause most failures: the <strong>account identifier</strong> (<code class='tok'>orgname-accountname</code>, or a locator with region such as <code class='tok'>xy12345.us-east-1</code>) and the <strong>user</strong>, which must be the login name the IdP asserts, often the email form. Passing a short username when the IdP asserts an email produces a \"user differs from IdP user\" style error after a successful browser login." },
              { t: "code", lang: "python", code:
                "conn = snowflake.connector.connect(\n" +
                "    account=os.environ['SNOWFLAKE_ACCOUNT'],   # acme-prod, not acme_prod\n" +
                "    user=os.environ['SNOWFLAKE_USER'],         # jdoe@acme.example, as the IdP asserts it\n" +
                "    authenticator='externalbrowser',\n" +
                "    login_timeout=120,\n" +
                ")"
              },
              { t: "h", text: "Enforcing MFA and methods with authentication policies" },
              { t: "code", lang: "sql", code:
                "CREATE AUTHENTICATION POLICY IF NOT EXISTS gov.policies.ap_humans\n" +
                "  AUTHENTICATION_METHODS = ('SAML', 'PASSWORD')\n" +
                "  MFA_ENROLLMENT = REQUIRED\n" +
                "  CLIENT_TYPES = ('SNOWFLAKE_UI', 'DRIVERS', 'SNOWSQL');\n\n" +
                "ALTER ACCOUNT SET AUTHENTICATION POLICY gov.policies.ap_humans;"
              },
              { t: "note", variant: "trap", html: "Private keys, passphrases and tokens never belong in code, notebooks or connection strings. Load them at runtime from a vault or secret manager, pass paths and env var names in config, and rotate on a schedule and on every suspected exposure." },
              { t: "table", headers: ["Tier", "Service authentication", "Risk left"], rows: [
                ["Naive", "Shared human account with a password in a config file", "One leak exposes everything; no attribution"],
                ["Solid", "TYPE = SERVICE user per pipeline, key-pair from a vault, user-level network policy", "Rotation depends on someone remembering"],
                ["Standout", "Solid, plus scheduled two-slot rotation and alerting on LOGIN_HISTORY for unexpected clients or addresses", "Operational overhead of the rotation job"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"service account\", \"CI connects to Snowflake\", \"rotate keys without downtime\", \"SSO login fails from Python\", \"enforce MFA\". SSO + MFA for people, service users with key-pair for machines, two-slot rotation." },
              { t: "note", variant: "key", html: "<strong>People through the IdP with MFA, machines through keys or OAuth.</strong> Rotate with RSA_PUBLIC_KEY_2, keep secrets in a vault, and match the user to the IdP login name." }
            ]
          },
          {
            id: "sharing",
            title: "Secure data sharing, listings and reader accounts",
            summary: "Shares give other accounts live, read-only access to your data without copying it; listings and reader accounts extend that reach.",
            minutes: 11,
            tags: ["data-sharing", "listings", "reader-accounts"],
            blocks: [
              { t: "p", html: "A share is a <strong>grant to another account, not a copy</strong>. The provider grants privileges on objects to a share and adds consumer accounts; the consumer creates a read-only database from it and queries live data with its own warehouse. Storage stays with the provider; compute is paid by whoever runs the query." },
              { t: "code", lang: "sql", code:
                "-- provider\n" +
                "USE ROLE ACCOUNTADMIN;   -- or a role granted CREATE SHARE\n" +
                "CREATE SHARE IF NOT EXISTS sales_share COMMENT = 'partner order feed';\n" +
                "GRANT USAGE ON DATABASE sales TO SHARE sales_share;\n" +
                "GRANT USAGE ON SCHEMA sales.share TO SHARE sales_share;\n" +
                "GRANT SELECT ON VIEW sales.share.v_orders_by_partner TO SHARE sales_share;\n" +
                "ALTER SHARE sales_share ADD ACCOUNTS = partnerorg.partner_prod;"
              },
              { t: "code", lang: "sql", code:
                "-- consumer\n" +
                "CREATE DATABASE acme_sales FROM SHARE acmeorg.acme_prod.sales_share;\n" +
                "GRANT IMPORTED PRIVILEGES ON DATABASE acme_sales TO ROLE analyst;\n" +
                "SELECT COUNT(*) FROM acme_sales.share.v_orders_by_partner;"
              },
              { t: "h", text: "One share, many consumers, different rows" },
              { t: "p", html: "Put a secure view over the data and join to an entitlement table on <code class='tok'>CURRENT_ACCOUNT()</code>, which evaluates to the consumer's account when they query. Every consumer gets the same share and sees only their rows. For finer cuts inside a share, grant database roles to it and let the consumer map them to their own roles." },
              { t: "table", headers: ["Mechanism", "Consumer", "Who pays compute", "Cross-region"], rows: [
                ["Direct share", "Another Snowflake account you name", "Consumer", "Same region only"],
                ["Listing (private or marketplace)", "Named accounts or discoverable", "Consumer", "Yes, via auto-fulfillment replication"],
                ["Reader account", "A party with no Snowflake account", "Provider", "Created in the provider's region"]
              ] },
              { t: "note", variant: "warn", html: "Direct shares only work within one region because they point at the provider's storage. Crossing regions or clouds means replication, typically through listing auto-fulfillment, which adds storage and transfer cost on the provider side." },
              { t: "h", text: "Reader accounts" },
              { t: "p", html: "A reader account is a lightweight account the provider creates and manages for a consumer with no Snowflake contract. It can only query what is shared into it. Because the provider owns its warehouses, put a resource monitor on them before handing over credentials." },
              { t: "code", lang: "sql", code:
                "CREATE MANAGED ACCOUNT partner_reader\n" +
                "  ADMIN_NAME = 'partner_admin',\n" +
                "  ADMIN_PASSWORD = '<READER_ADMIN_PASSWORD>',\n" +
                "  TYPE = READER;\n" +
                "-- then ALTER SHARE ... ADD ACCOUNTS = <reader_account_locator>"
              },
              { t: "note", variant: "trap", html: "Only secure objects can go into a share: tables, secure views, secure materialized views and secure UDFs. A standard view is rejected, and a secure view that references objects in another database also needs <code class='tok'>GRANT REFERENCE_USAGE ON DATABASE</code> to the share." },
              { t: "compare",
                bad: { title: "Nightly extract to files", items: ["Copies drift and go stale", "Every consumer gets its own pipeline", "Revoking access means chasing files"] },
                good: { title: "Secure share", items: ["Live data, no copies", "One share, rows filtered by CURRENT_ACCOUNT()", "Revoke with ALTER SHARE ... REMOVE ACCOUNTS"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"give a partner access to our data\", \"stop emailing CSVs\", \"each customer sees only their rows\", \"they do not have Snowflake\", \"consumer is in another region\". Share + secure view + CURRENT_ACCOUNT(), reader account or listing as needed." },
              { t: "quiz", id: "sec-perimeter" },
              { t: "note", variant: "key", html: "<strong>Sharing grants access instead of copying data.</strong> Expose secure objects, filter by CURRENT_ACCOUNT(), replicate for other regions, and remember the provider pays for reader accounts." }
            ]
          }
        ]
      }
    ]
  };
})();
