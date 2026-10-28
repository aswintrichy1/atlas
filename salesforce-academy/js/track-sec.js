/* =====================================================================
   ORBIT · Security & Sharing
   window.TRACKS.sec — modules: access / records / code
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
  function labelled(text, control) {
    return h("div", { class: "ob-stack" }, h("span", { class: "ob-dim", style: "font-size:0.78rem" }, text), control);
  }
  function checkbox(text, initial, onChange) {
    var input = h("input", { type: "checkbox" });
    input.checked = !!initial;
    input.addEventListener("change", function () { onChange(input.checked); });
    return h("label", { class: "w-field" }, input, h("span", {}, " " + text));
  }
  /* items: [{ name, state: "ok" | "bad" | "win" | "skip", chip, text }] */
  function stepList(items) {
    var ol = h("ol", { class: "ob-steps" });
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var cls = it.state === "ok" ? " is-done" : (it.state === "bad" || it.state === "win") ? " is-active" : " is-skip";
      var chipCls = it.state === "bad" ? " bad" : (it.state === "ok" || it.state === "win") ? " ok" : " warn";
      ol.appendChild(h("li", { class: "ob-step" + cls },
        h("span", { class: "ob-num" }, String(i + 1)),
        h("div", {},
          h("strong", {}, it.name), " ",
          h("span", { class: "ob-chip" + chipCls }, it.chip),
          h("div", { style: "font-size:0.84rem;line-height:1.5;margin-top:0.2rem" }, it.text))));
    }
    return ol;
  }

  var Widgets = {};

  /* obAccessLayers — walk org, object, field and record access for one action */
  Widgets.obAccessLayers = function (mount) {
    shell(mount, "simulator", "Access layer walk-through",
      "A user wants to act on an Employee record and its Salary field. Set the object permissions, field-level security and record access, pick the action, and see which layer blocks first.");
    var st = { read: true, edit: false, fls: "ro", rec: "read", act: "editf" };
    var FLS = { hidden: "hidden", ro: "read-only", rw: "editable" };
    var REC = { none: "no access", read: "Read", rw: "Read/Write" };
    var ACT = { viewr: "view the record", viewf: "view Salary", editf: "edit Salary" };
    var FIX = {
      "Object permission": "Grant the object permission in a permission set assigned to the user.",
      "Field-level security": "Change Salary's field permissions in a permission set; a page layout cannot do this.",
      "Record access": "Open record access with a sharing rule, team, manual share or the role hierarchy, or reconsider the org-wide default."
    };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var steps = [];
      var blocked = null;
      var effRead = st.read || st.edit;
      steps.push({ name: "Org access", state: "ok", chip: "pass", text: "Active user inside login hours and trusted IP ranges, so a session exists." });

      var objTxt = "Employee object: Read " + (st.read ? "granted" : "not granted") + ", Edit " + (st.edit ? "granted" : "not granted") +
        (st.edit && !st.read ? " (Edit implies Read; Setup turns Read on with it)." : ".");
      var objOk = st.act === "editf" ? st.edit : effRead;
      if (objOk) steps.push({ name: "Object permission", state: "ok", chip: "pass", text: objTxt });
      else {
        blocked = "Object permission";
        steps.push({ name: "Object permission", state: "bad", chip: "blocks", text: objTxt + " To " + ACT[st.act] + " the user needs " + (st.act === "editf" ? "Edit" : "Read") + " on the object." });
      }

      if (st.act === "viewr") {
        steps.push({ name: "Field-level security", state: "skip", chip: "not needed", text: "Viewing the record does not require Salary. Its FLS is " + FLS[st.fls] + (st.fls === "hidden" ? ", so the field simply drops off the page." : ".") });
      } else if (blocked) {
        steps.push({ name: "Field-level security", state: "skip", chip: "not reached", text: "Not evaluated because an earlier layer blocked. Salary FLS is " + FLS[st.fls] + "." });
      } else {
        var flsOk = st.act === "editf" ? st.fls === "rw" : st.fls !== "hidden";
        if (flsOk) steps.push({ name: "Field-level security", state: "ok", chip: "pass", text: "Salary is " + FLS[st.fls] + " for this user, which allows them to " + ACT[st.act] + "." });
        else {
          blocked = "Field-level security";
          steps.push({ name: "Field-level security", state: "bad", chip: "blocks", text: "Salary is " + FLS[st.fls] + "; to " + ACT[st.act] + " it must be " + (st.act === "editf" ? "editable" : "at least read-only") + "." });
        }
      }

      if (blocked) {
        steps.push({ name: "Record access", state: "skip", chip: "not reached", text: "Not evaluated. Sharing would give " + REC[st.rec] + " on this record." });
      } else {
        var recOk = st.act === "editf" ? st.rec === "rw" : st.rec !== "none";
        if (recOk) steps.push({ name: "Record access", state: "ok", chip: "pass", text: "Sharing gives " + REC[st.rec] + " on this record, enough to " + ACT[st.act] + "." });
        else {
          blocked = "Record access";
          steps.push({ name: "Record access", state: "bad", chip: "blocks", text: "Sharing gives " + REC[st.rec] + " on this record; to " + ACT[st.act] + " the user needs " + (st.act === "editf" ? "Read/Write" : "at least Read") + "." });
        }
      }

      clear(stage);
      stage.appendChild(stepList(steps));
      clear(readout);
      readout.appendChild(ro("action", ACT[st.act]));
      readout.appendChild(ro("result", blocked ? "Blocked" : "Allowed"));
      readout.appendChild(ro("first block", blocked || "none"));
      readout.appendChild(ro("fix", blocked ? FIX[blocked] : "Every layer agrees."));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      checkbox("Object Read", st.read, function (v) { st.read = v; paint(); }),
      checkbox("Object Edit", st.edit, function (v) { st.edit = v; paint(); }),
      labelled("Salary FLS", segment([["ro", "Read-only"], ["hidden", "Hidden"], ["rw", "Editable"]], 0, function (v) { st.fls = v; paint(); })),
      labelled("Record access", segment([["read", "Read"], ["none", "None"], ["rw", "Read/Write"]], 0, function (v) { st.rec = v; paint(); })),
      labelled("Action", segment([["editf", "Edit Salary"], ["viewr", "View record"], ["viewf", "View Salary"]], 0, function (v) { st.act = v; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* obSharingCalc — effective record access from OWD, hierarchy, rules, manual shares and View All */
  Widgets.obSharingCalc = function (mount) {
    shell(mount, "calculator", "Record access calculator",
      "Set the org-wide default and every way a viewer might gain access to one record. Effective access is the most permissive grant; nothing can take access below the default.");
    var s = { owd: "private", rel: "peer", hier: true, rule: "none", manual: "none", viewAll: false };
    var LV = ["None", "Read", "Read/Write"];
    var OWD_TEXT = {
      "private": "Private: the baseline is no access except for the owner and users above them.",
      "pro": "Public Read Only: every internal user starts with Read.",
      "prw": "Public Read/Write: every internal user starts with Read/Write."
    };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function evaluate() {
      var g = [];
      var hs = s.hier ? "hierarchies on" : "hierarchies off";
      if (s.rel === "same") g.push({ layer: "Ownership", lv: 2, text: "The viewer owns the record: full access, including edit, delete, transfer and share." });
      else g.push({ layer: "Ownership", lv: 0, text: "The viewer is not the owner, so ownership grants nothing." });

      var owdLv = s.owd === "private" ? 0 : s.owd === "pro" ? 1 : 2;
      g.push({ layer: "Org-wide default", lv: owdLv, text: OWD_TEXT[s.owd] });

      var hLv = 0, hText;
      if (s.rel === "above") {
        if (s.hier) { hLv = 2; hText = "The viewer's role is above the owner's and Grant Access Using Hierarchies is on, so they can view and edit what their subordinate owns."; }
        else hText = "The viewer's role is above the owner's, but Grant Access Using Hierarchies is off (possible on custom objects only), so the hierarchy grants nothing.";
      } else if (s.rel === "same") hText = "Not needed: the viewer is the owner (" + hs + ").";
      else if (s.rel === "peer") hText = "Peers share no path up the hierarchy, so it grants nothing (" + hs + ").";
      else hText = "The viewer is below the owner, and the hierarchy only opens access upward (" + hs + ").";
      g.push({ layer: "Role hierarchy", lv: hLv, text: hText });

      var rLv = s.rule === "none" ? 0 : s.rule === "read" ? 1 : 2;
      var rText = rLv === 0 ? "No sharing rule targets a group the viewer belongs to." :
        "A sharing rule grants " + LV[rLv] + " to a group containing the viewer" + (rLv <= owdLv ? ", which adds nothing over the org-wide default." : ".");
      g.push({ layer: "Sharing rule", lv: rLv, text: rText });

      var mLv = 0, mText;
      if (s.owd === "prw") {
        mText = "Manual sharing is not offered at Public Read/Write" + (s.manual === "none" ? "." : ", so the selected " + (s.manual === "read" ? "Read Only" : "Read/Write") + " share cannot exist.");
      } else if (s.manual === "none") {
        mText = "No one has shared this record with the viewer by hand.";
      } else {
        mLv = s.manual === "read" ? 1 : 2;
        mText = "The owner or someone above them shared the record as " + (mLv === 1 ? "Read Only" : "Read/Write") + "; the share is removed if ownership changes.";
      }
      g.push({ layer: "Manual share", lv: mLv, text: mText });

      g.push({ layer: "View All (object)", lv: s.viewAll ? 1 : 0, text: s.viewAll ? "View All on this object grants Read on every record, ignoring sharing. It never grants edit; that needs Modify All." : "The viewer has no View All permission on the object." });
      return g;
    }
    function paint() {
      var g = evaluate();
      var max = 0, i;
      for (i = 0; i < g.length; i++) if (g[i].lv > max) max = g[i].lv;
      var winner = null, also = [];
      for (i = 0; i < g.length; i++) {
        if (max > 0 && g[i].lv === max) {
          if (!winner) winner = g[i].layer;
          else also.push(g[i].layer);
        }
      }
      var items = [];
      for (i = 0; i < g.length; i++) {
        var state = g[i].lv === 0 ? "skip" : (g[i].layer === winner ? "win" : "ok");
        var chip = g[i].lv === 0 ? "grants none" : (g[i].layer === winner ? "decides: " : "grants ") + LV[g[i].lv];
        items.push({ name: g[i].layer, state: state, chip: chip, text: g[i].text });
      }
      clear(stage);
      stage.appendChild(stepList(items));
      var verdict = max === 0 ? "Nothing opened access and the default is Private, so the record is invisible to this viewer." :
        "Effective access is the most permissive grant: " + LV[max] + ", first granted by " + winner + ".";
      stage.appendChild(h("p", { style: "font-size:0.88rem;line-height:1.55;margin:0.5rem 0 0" }, verdict));
      clear(readout);
      readout.appendChild(ro("effective", s.rel === "same" ? "Read/Write (owner, full)" : LV[max]));
      readout.appendChild(ro("granted by", winner || "nothing"));
      readout.appendChild(ro("also at this level", also.length ? also.join(", ") : "none"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      labelled("Org-wide default", segment([["private", "Private"], ["pro", "Public Read Only"], ["prw", "Public Read/Write"]], 0, function (v) { s.owd = v; paint(); })),
      labelled("Viewer vs owner in roles", segment([["peer", "Peer"], ["same", "Same user"], ["above", "Above owner"], ["below", "Below owner"]], 0, function (v) { s.rel = v; paint(); })),
      labelled("Grant Access Using Hierarchies", segment([["on", "On"], ["off", "Off"]], 0, function (v) { s.hier = v === "on"; paint(); })),
      labelled("Sharing rule to viewer's group", segment([["none", "None"], ["read", "Read Only"], ["rw", "Read/Write"]], 0, function (v) { s.rule = v; paint(); })),
      labelled("Manual share", segment([["none", "None"], ["read", "Read"], ["edit", "Edit"]], 0, function (v) { s.manual = v; paint(); })),
      labelled("View All on object", segment([["off", "Off"], ["on", "On"]], 0, function (v) { s.viewAll = v === "on"; paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sec-access": {
      title: "Object and field access checkpoint",
      sub: "Access layers, profiles, permission sets and CRUD/FLS.",
      questions: [
        { q: "A user has Read on an Account record through a sharing rule, but no permission set or profile gives them Read on the Account object. Can they open the record?",
          options: ["No: object permission is checked first, and sharing cannot grant what the object layer denies", "Yes: sharing overrides object permissions", "Only through reports", "Only through the API"],
          answer: 0,
          explain: "Access is layered. Object permissions decide whether the user can touch the object at all; sharing only decides which records they reach within it. A record share without object Read gives nothing." },
        { q: "Why does the recommended model put most permissions in permission sets rather than profiles?",
          options: ["Profiles are deprecated and can no longer be assigned", "Permission sets evaluate faster at runtime", "A user has exactly one profile but can hold many permission sets, so capabilities compose per persona without cloning profiles", "Permission sets bypass sharing"],
          answer: 2,
          explain: "With one profile per user, every combination of needs becomes another cloned profile. Permission sets, bundled into permission set groups, let you grant each capability once and assign combinations freely. Profiles shrink to a minimal baseline." },
        { q: "How should Apex check whether the running user may use a gated feature?",
          options: ["Query PermissionSetAssignment for a permission set by name", "Call FeatureManagement.checkPermission with a custom permission", "Compare the profile name to a string", "Keep a list of allowed user Ids in code"],
          answer: 1,
          explain: "A custom permission names the capability, and any permission set can carry it. checkPermission needs no setup-object query and keeps working when admins restructure permission sets. Querying assignments by name couples code to admin configuration and can return nothing in user mode." },
        { q: "What is the key difference between WITH SECURITY_ENFORCED and WITH USER_MODE?",
          options: ["They are identical", "SECURITY_ENFORCED also enforces sharing", "USER_MODE checks objects but not fields", "USER_MODE enforces CRUD, FLS and sharing, including fields in the WHERE clause, and reports every inaccessible field; SECURITY_ENFORCED checks CRUD and FLS on selected fields only and ignores sharing"],
          answer: 3,
          explain: "USER_MODE runs the query exactly as the user would, covering object, field and record access across the whole statement. SECURITY_ENFORCED is narrower and stops at the first violation. Prefer USER_MODE for new code." },
        { q: "A field is read-only on the page layout but editable in the user's field permissions. The user updates it through the REST API. What happens?",
          options: ["The update is blocked because page layouts apply to the API", "The update succeeds: page layout settings are presentation only, and FLS is what secures a field", "Only administrators can call the API", "The field is hidden from the API"],
          answer: 1,
          explain: "Page layouts control what the standard UI shows, not what the user is allowed to do. FLS is enforced across the UI and the APIs, so it is the only setting that actually protects a field." }
      ]
    },
    "sec-records": {
      title: "Record access checkpoint",
      sub: "Org-wide defaults, role hierarchy, sharing rules and Apex managed sharing.",
      questions: [
        { q: "OWD is Private. The viewer is a peer of the owner, a sharing rule gives their group Read Only, and they have no View All. What is their access?",
          options: ["None", "Read/Write", "Read", "Read/Write through the hierarchy"],
          answer: 2,
          explain: "Private starts at no access, a peer gains nothing from the hierarchy, and the sharing rule opens Read. Effective access is the most permissive grant, so the answer is Read." },
        { q: "Why can you not use sharing to give a user less access than the org-wide default?",
          options: ["Sharing only widens access; the default is the floor, so it must be set to the most restrictive level any user needs", "You can, with a negative sharing rule", "Set a manual share to None", "Remove the user from the role hierarchy"],
          answer: 0,
          explain: "Every sharing mechanism adds access; none subtracts. Set the default to what the most restricted user should see, then open access upward with hierarchy, rules, teams and shares. Restriction rules on certain objects are the only filter-style exception." },
        { q: "A record's owner changes. What happens to shares on it?",
          options: ["All shares are kept", "Manual shares become sharing rules", "Manual shares are upgraded to Edit", "Manual shares are removed, while Apex shares with a custom sharing reason survive"],
          answer: 3,
          explain: "Manual shares belong to the old ownership and are cleared on transfer. Shares written with a custom Apex sharing reason are kept, which is one reason to use a custom reason rather than the Manual row cause." },
        { q: "Which row cause should Apex managed sharing use so shares survive owner changes and can be recalculated?",
          options: ["Manual", "A custom Apex sharing reason defined on the custom object", "Owner", "Rule"],
          answer: 1,
          explain: "Custom sharing reasons identify shares your code owns. You can delete and rebuild exactly those rows, register a recalculation batch against the reason, and owner changes leave them intact." },
        { q: "For which objects can Grant Access Using Hierarchies be turned off?",
          options: ["Custom objects only; standard objects always grant access up the hierarchy", "All objects", "Standard objects only", "No objects"],
          answer: 0,
          explain: "The checkbox is editable only for custom objects. On standard objects, users above the owner in the role hierarchy always inherit access, so plan the role tree with that in mind." }
      ]
    },
    "sec-code": {
      title: "Security in code checkpoint",
      sub: "Sharing keywords, user mode, stripInaccessible and injection-safe SOQL.",
      questions: [
        { q: "A class with no sharing keyword is called from a with sharing class. How does it run?",
          options: ["Always without sharing", "Always with sharing, in every context", "It fails to compile", "In the caller's sharing context, which here is with sharing"],
          answer: 3,
          explain: "Omitting the keyword means the class takes the sharing mode of whoever called it. As an entry point it would usually run without sharing, which is why the house rule is to declare a keyword on every class." },
        { q: "Which sharing keyword is recommended for a selector class?",
          options: ["without sharing", "inherited sharing", "with sharing", "No keyword"],
          answer: 1,
          explain: "Selectors are called from many contexts. inherited sharing honours the caller's mode explicitly and defaults to with sharing when it is the entry point, so a selector never silently widens access." },
        { q: "A method reads records WITH USER_MODE and then saves them with a plain update statement. What is wrong?",
          options: ["Nothing", "The update does not compile", "The write runs in system mode and bypasses the CRUD, FLS and sharing the read enforced; use Database.update(records, AccessLevel.USER_MODE)", "A plain update already runs in user mode"],
          answer: 2,
          explain: "Plain DML runs in system mode. Mixing a user-mode read with a system-mode write lets the user change fields or records they could not edit themselves. Keep both sides in the same mode, or document why system mode is needed." },
        { q: "Partial access is acceptable: show users whatever fields they can see. Which tool fits?",
          options: ["Security.stripInaccessible(AccessType.READABLE, records)", "WITH SECURITY_ENFORCED", "Declare the class without sharing", "Catch the exception and return an empty list"],
          answer: 0,
          explain: "stripInaccessible removes fields the user cannot read and reports which were removed, so the page degrades gracefully. SECURITY_ENFORCED would throw instead, and the other two either widen access or hide the problem." },
        { q: "You must build SOQL from user input. What is the safe pattern?",
          options: ["Always concatenate, then escapeSingleQuotes", "Build the string with String.format", "Database.queryWithBinds with a bind map and AccessLevel.USER_MODE, allow-listing any dynamic field names", "Strip spaces from the input"],
          answer: 2,
          explain: "Bind variables keep user values as data, never syntax. Field and sort names cannot be bound, so check them against an allow-list. escapeSingleQuotes is a last resort when binding is impossible." }
      ]
    }
  });

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sec-protect": {
      title: "Data protection checkpoint",
      sub: "Platform Encryption, field history, Field Audit Trail and Event Monitoring.",
      questions: [
        { q: "Support must look up Contacts by an encrypted national ID number with an exact-match filter. Which encryption scheme allows that?",
          options: ["Probabilistic encryption", "Deterministic encryption", "Classic encrypted text fields", "Hashing the value with MD5 in a trigger"], answer: 1,
          explain: "Deterministic encryption produces the same ciphertext for the same input, so exact-match filters can work. Probabilistic encryption is stronger but cannot be filtered. Classic encrypted fields only mask display, and MD5 is a broken hash that the house crypto rules ban." },
        { q: "Compliance needs field changes on Account kept for seven years. Standard field history is enabled. What else is needed?",
          options: ["Nothing; standard history keeps data indefinitely", "A nightly report export", "Field Audit Trail, which extends retention with a policy of up to about ten years", "A big object you populate from a trigger"], answer: 2,
          explain: "Standard field history tracks a limited number of fields and keeps data for about 18 months in the UI (24 via the API). Field Audit Trail, part of Shield, raises the field count and retains history under a policy for up to roughly ten years, archiving older rows to a big object for you." },
        { q: "Security wants to block report exports above 10,000 rows in real time and know who tried. Which Shield feature fits?",
          options: ["Event Monitoring with a Transaction Security policy", "Platform Encryption", "Field Audit Trail", "Sharing rules"], answer: 0,
          explain: "Event Monitoring records user activity such as report exports, logins and API calls. Transaction Security policies evaluate those events as they happen and can block, require MFA or notify. Encryption and audit history do not act on user behaviour." },
        { q: "What does turning on Platform Encryption NOT do?",
          options: ["Encrypt data at rest for the selected fields and files", "Let you manage and rotate tenant secrets or bring your own key", "Hide the field from users who have field-level read access", "Change which features can use the field, such as some sorting and formula use"], answer: 2,
          explain: "Encryption protects data at rest; users with access still see plaintext. Who sees a field is still decided by field-level security and sharing. Encryption does restrict some features, so test reports, formulas and filters before enabling it." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sec = {
    id: "sec",
    name: "Security & Sharing",
    short: "SEC",
    tagline: "Who can see what, and why",
    color: "#818cf8",
    blurb: "The layered access model from the org down to a single field on a single record, and how code respects it. Covers object and field permissions, profiles, permission sets and groups, org-wide defaults, the role hierarchy, sharing rules, teams, manual and Apex managed sharing, then sharing keywords, user mode, stripInaccessible and injection-safe SOQL.",
    modules: [
      {
        id: "access",
        name: "Object & Field Access",
        icon: "shield",
        lessons: [
          {
            id: "layers",
            title: "The access layers: org, object, field, record",
            summary: "Four gates in order; each can only block, and record access starts locked and opens layer by layer.",
            minutes: 10,
            tags: ["security", "access-model", "sharing"],
            blocks: [
              { t: "p", html: "Picture four gates in a row. The <strong>org</strong> gate decides whether you can log in at all. The <strong>object</strong> gate decides whether you can read, create, edit or delete a kind of record. The <strong>field</strong> gate decides which columns you see or change. The <strong>record</strong> gate decides which rows you reach. You need to pass every gate, and the first one that says no wins." },
              { t: "diagram", id: "sharing-layers", caption: "Object and field permissions gate first. Record access then starts at the org-wide default and is widened by hierarchy, rules, teams, manual and Apex shares." },
              { t: "table", headers: ["Layer", "Question", "Configured with"], rows: [
                ["Org", "Can this person get a session?", "User activation, login hours, IP ranges, MFA, SSO"],
                ["Object", "Can they read, create, edit or delete this object?", "Object permissions in permission sets and profiles"],
                ["Field", "Can they see or change this field?", "Field-level security in permission sets and profiles"],
                ["Record", "Which records of this object can they reach?", "Org-wide default, role hierarchy, sharing rules, teams, manual and Apex shares"]
              ] },
              { t: "widget", id: "obAccessLayers" },
              { t: "h", text: "How the layers interact" },
              { t: "ul", items: [
                "Object and field layers are <strong>restrictive</strong>: a gap there cannot be fixed by sharing.",
                "The record layer is <strong>additive</strong>: it starts at the org-wide default and each mechanism can only widen it.",
                "<strong>View All</strong> and <strong>Modify All</strong> on an object, and the View All Data and Modify All Data system permissions, skip the record layer entirely.",
                "Restriction rules on certain objects are the one filter-style exception: they narrow what users see even when sharing grants it.",
                "Edit on an object needs Read on it too; Setup turns Read on when you grant Edit."
              ] },
              { t: "note", variant: "trap", html: "A field marked read-only on a page layout is still editable through the API, list views, Flow and Apex if FLS allows it. Layouts are presentation. Only FLS secures a field." },
              { t: "compare",
                bad: { title: "Hiding in the UI", items: ["Remove the field from the layout", "Hide the tab", "Assume users only use the standard pages"] },
                good: { title: "Securing in the layers", items: ["FLS removes the field for that user everywhere", "Object permission removes the object everywhere", "Sharing limits records everywhere, APIs included"] } },
              { t: "table", headers: ["Tier", "Designing access for a sensitive field", "Why"], rows: [
                ["Naive", "Take it off the page layout", "Still readable through reports, APIs and list views"],
                ["Solid", "FLS hidden by default, editable through one permission set", "Enforced across every channel"],
                ["Standout", "Solid plus record access sized to the need, Apex in user mode, and a test that runs as a user without the permission set", "Every layer and every code path agrees, and CI proves it"]
              ] },
              { t: "cue", html: "<strong>Reach for the layer model when you hear:</strong> the user can see the record but not the field, they can open it but not save, I hid it on the layout but they still changed it, why does sharing not fix this error." },
              { t: "note", variant: "key", html: "<strong>Four gates, first no wins.</strong> Org, object and field permissions block; record access starts at the org-wide default and only widens. Debug by naming the layer, not by adding more sharing." }
            ]
          },
          {
            id: "profiles-permsets",
            title: "Profiles, permission sets and permission set groups",
            summary: "Keep profiles minimal, grant capabilities in permission sets, bundle them per persona, and gate features with custom permissions.",
            minutes: 9,
            tags: ["permission-sets", "profiles", "custom-permissions"],
            blocks: [
              { t: "p", html: "Every user has exactly <strong>one profile</strong> and any number of <strong>permission sets</strong>. If permissions live in profiles, each new mix of responsibilities needs a cloned profile, and after a few years nobody knows which clone does what. Permission sets turn access into building blocks you combine per person." },
              { t: "table", headers: ["Container", "Per user", "Holds", "Use it for"], rows: [
                ["Profile", "Exactly one", "Login hours, IP ranges, default app and record types, page layout assignment, plus any permissions", "A minimal baseline"],
                ["Permission set", "Many", "Object, field, system, app and custom permissions", "One capability each: Invoice Approver, Case Escalation"],
                ["Permission set group", "Many", "A bundle of permission sets, with an optional muting permission set", "A persona: Finance Analyst, Support Lead"]
              ] },
              { t: "h", text: "The recommended model" },
              { t: "ol", items: [
                "One or a few minimal profiles that grant almost nothing beyond login and defaults.",
                "One permission set per capability, named for the job it enables.",
                "Permission set groups per persona; use a muting permission set to remove a permission inside one group without editing the shared sets.",
                "<strong>Custom permissions</strong> for feature gates, carried by the relevant permission set and checked in code and Flow.",
                "Permission sets and groups live in source control and deploy like any other metadata."
              ] },
              { t: "code", lang: "java", code:
                "/**\n" +
                " * @description Approves an invoice if the running user holds the approval capability.\n" +
                " */\n" +
                "public void approve(Id invoiceId) {\n" +
                "    if (!FeatureManagement.checkPermission('Approve_Invoices')) {\n" +
                "        throw new InvoiceException('You do not have permission to approve invoices.');\n" +
                "    }\n" +
                "    InvoiceApprovalService.getInstance().approve(new Set<Id>{ invoiceId });\n" +
                "}"
              },
              { t: "code", lang: "text", code:
                "<!-- permissionsets/Invoice_Approver.permissionset-meta.xml (xmlns omitted) -->\n" +
                "<PermissionSet>\n" +
                "    <label>Invoice Approver</label>\n" +
                "    <customPermissions>\n" +
                "        <name>Approve_Invoices</name>\n" +
                "        <enabled>true</enabled>\n" +
                "    </customPermissions>\n" +
                "    <objectPermissions>\n" +
                "        <object>Invoice__c</object>\n" +
                "        <allowRead>true</allowRead>\n" +
                "        <allowEdit>true</allowEdit>\n" +
                "        <allowCreate>false</allowCreate>\n" +
                "        <allowDelete>false</allowDelete>\n" +
                "        <viewAllRecords>false</viewAllRecords>\n" +
                "        <modifyAllRecords>false</modifyAllRecords>\n" +
                "    </objectPermissions>\n" +
                "    <fieldPermissions>\n" +
                "        <field>Invoice__c.Approved_Amount__c</field>\n" +
                "        <readable>true</readable>\n" +
                "        <editable>true</editable>\n" +
                "    </fieldPermissions>\n" +
                "</PermissionSet>"
              },
              { t: "note", variant: "warn", html: "Do not gate features by querying <code class='tok'>PermissionSetAssignment</code> for a permission set name. It couples code to how admins happen to package access, and setup-object queries can return nothing for ordinary users in user mode. A custom permission states the capability directly." },
              { t: "table", headers: ["Tier", "Access design", "Cost"], rows: [
                ["Naive", "A cloned profile per team, edited by hand in production", "Dozens of near-identical profiles, no audit trail"],
                ["Solid", "Minimal profile plus capability permission sets", "More assignments to manage"],
                ["Standout", "Solid plus persona groups with muting, custom permissions for every feature gate, all in source and assigned through automation", "Upfront design; afterwards a new role is a new group, not new code"]
              ] },
              { t: "note", variant: "tip", html: "Some permission sets need a matching permission set licence before they can be assigned. Check licence requirements when a deploy succeeds but assignments fail." },
              { t: "cue", html: "<strong>Reach for permission set design when you hear:</strong> we have forty profiles, we need a role that is like Sales but can also approve, how should Apex check whether a user can do this, give this team one extra field." },
              { t: "note", variant: "key", html: "<strong>Profiles are a baseline; permission sets are the capabilities.</strong> Bundle them into groups per persona, gate features with custom permissions and FeatureManagement.checkPermission, and keep it all in source." }
            ]
          },
          {
            id: "crud-fls",
            title: "CRUD and field-level security",
            summary: "Where the platform enforces object and field permissions for you, where it does not, and how Apex closes the gap.",
            minutes: 10,
            tags: ["crud", "fls", "user-mode"],
            blocks: [
              { t: "p", html: "CRUD means the object permissions: create, read, update, delete. FLS means field-level security. The standard UI and APIs enforce both automatically. Apex, by default, does <strong>not</strong>: it runs in system mode, and a class can read and write any field unless you tell it to act as the user." },
              { t: "table", headers: ["Context", "CRUD", "FLS", "Sharing"], rows: [
                ["Lightning UI, Lightning Data Service, standard APIs", "Enforced", "Enforced", "Enforced"],
                ["Apex, default system mode", "Not enforced", "Not enforced", "Decided by the class sharing keyword"],
                ["Apex with <code class='tok'>WITH USER_MODE</code> / <code class='tok'>AccessLevel.USER_MODE</code>", "Enforced", "Enforced", "Enforced"],
                ["Apex with <code class='tok'>WITH SECURITY_ENFORCED</code>", "Selected fields only", "Selected fields only", "Decided by the class keyword"],
                ["Record-triggered flow", "Not enforced", "Not enforced", "Not enforced (system context)"],
                ["Screen flow", "Configurable run mode", "Configurable", "Configurable"]
              ] },
              { t: "h", text: "Enforcing CRUD and FLS in Apex" },
              { t: "code", lang: "java", code:
                "/** @description Selector for Employee__c; honours the caller's sharing mode. */\n" +
                "public inherited sharing class EmployeeSelector implements IEmployeeSelector {\n" +
                "    /** @description Employees for a department, as the running user may see them. */\n" +
                "    public List<Employee__c> selectByDepartment(Id departmentId) {\n" +
                "        return [\n" +
                "            SELECT Id, Name, Title__c, Salary__c\n" +
                "            FROM Employee__c\n" +
                "            WHERE Department__c = :departmentId\n" +
                "            WITH USER_MODE\n" +
                "        ];\n" +
                "    }\n" +
                "}\n" +
                "\n" +
                "// Writes in the same mode as the read\n" +
                "Database.update(changedEmployees, false, AccessLevel.USER_MODE);\n" +
                "\n" +
                "// Field-level check when you need a yes/no answer for the UI\n" +
                "Boolean canSeeSalary = Schema.SObjectType.Employee__c.fields.Salary__c.isAccessible();"
              },
              { t: "compare",
                bad: { title: "WITH SECURITY_ENFORCED", items: ["Checks CRUD and FLS on fields in SELECT and FROM, not WHERE or ORDER BY", "Throws on the first inaccessible field", "Leaves sharing to the class keyword"] },
                good: { title: "WITH USER_MODE", items: ["Checks CRUD, FLS and sharing across the whole statement", "Reports every inaccessible field on the exception", "Pairs with <code class='tok'>AccessLevel.USER_MODE</code> for DML"] } },
              { t: "note", variant: "trap", html: "When a user-mode query fails, the cause is often a field in the WHERE clause the user cannot read. That is correct behaviour: filtering on a hidden field leaks its values. Fix the permission or the query, not the access mode." },
              { t: "table", headers: ["Tier", "FLS in a controller", "Why"], rows: [
                ["Naive", "Plain SOQL and DML in system mode", "Any user who can call the method reads and writes every field"],
                ["Solid", "<code class='tok'>WITH USER_MODE</code> reads and <code class='tok'>AccessLevel.USER_MODE</code> writes", "The method behaves like the UI for that user"],
                ["Standout", "Solid plus <code class='tok'>stripInaccessible</code> where partial access is acceptable, and tests run as a user without the field permission", "Graceful degradation, and CI proves the field stays protected"]
              ] },
              { t: "cue", html: "<strong>Reach for CRUD and FLS enforcement when you hear:</strong> this Apex method is called from an LWC, a community user can see salary through our component, the security review flagged FLS, the query works for admins but not for users." },
              { t: "quiz", id: "sec-access" },
              { t: "note", variant: "key", html: "<strong>The UI enforces CRUD and FLS; Apex does not unless you ask.</strong> Read with WITH USER_MODE, write with AccessLevel.USER_MODE, and use stripInaccessible where partial access is fine." }
            ]
          }
        ]
      },
      {
        id: "records",
        name: "Record Access",
        icon: "share",
        lessons: [
          {
            id: "owd",
            title: "Org-wide defaults",
            summary: "The org-wide default is the floor of record access; set it for the most restricted user and open upward.",
            minutes: 8,
            tags: ["owd", "sharing", "record-access"],
            blocks: [
              { t: "p", html: "The <strong>org-wide default</strong> (OWD) is the access every internal user has to records they do not own, before anything else is considered. It is the floor of the record layer: every other mechanism can only raise access above it, so it must be set for the user who should see the least." },
              { t: "table", headers: ["Setting", "Non-owners get", "Typical for"], rows: [
                ["Private", "No access", "Opportunities, compensation, anything competitive or personal"],
                ["Public Read Only", "Read", "Reference data most people need to see but few should change"],
                ["Public Read/Write", "Read and edit", "Collaborative, low-sensitivity data"],
                ["Public Read/Write/Transfer", "Read, edit and change owner", "Leads and cases, where queues and reassignment are routine"],
                ["Controlled by Parent", "Whatever they have on the parent", "Detail objects in master-detail, and Contact by default"]
              ] },
              { t: "ul", items: [
                "<strong>Internal and external defaults</strong> are set separately; the external one cannot be more open than the internal one.",
                "<strong>Grant Access Using Hierarchies</strong> sits beside the default. It can be turned off only on custom objects.",
                "Custom objects get a share table only when the default is Private or Public Read Only; at Public Read/Write there is nothing to share.",
                "Owners always have full access to their own records regardless of the default."
              ] },
              { t: "h", text: "Choosing the default" },
              { t: "code", lang: "text", code:
                "for each object:\n" +
                "  who is the most restricted user who still needs the object at all?\n" +
                "  what is the least they may see on records they do not own?\n" +
                "    nothing        -> Private\n" +
                "    read           -> Public Read Only\n" +
                "    read and edit  -> Public Read/Write\n" +
                "  then list every group that needs more, and pick the mechanism that opens it"
              },
              { t: "table", headers: ["Tier", "Approach", "Consequence"], rows: [
                ["Naive", "Public Read/Write everywhere, tighten later", "Tightening later means a sharing recalculation, angry users and a data-exposure window"],
                ["Solid", "Private or Read Only for sensitive objects, opened with hierarchy and rules", "Least privilege with manageable configuration"],
                ["Standout", "Solid plus a written access matrix per object and persona, reviewed before go-live and turned into permission set and sharing metadata", "Access is designed, reviewable and testable rather than accumulated"]
              ] },
              { t: "note", variant: "warn", html: "Changing a default on a large object triggers a sharing recalculation that can take a long time and lock configuration while it runs. Treat OWD changes as architectural decisions with a planned window, not quick fixes." },
              { t: "p", html: "In an interview, state the order out loud: default first for the most restricted user, then the hierarchy, then rules and shares for everyone who needs more. Candidates who start from <em>who needs to see it</em> instead of <em>who must not</em> usually end up with an open default they cannot close later." },
              { t: "cue", html: "<strong>Reach for the org-wide default when you hear:</strong> users should only see their own records, everyone can see everything, we need to lock this object down, contacts follow their accounts." },
              { t: "note", variant: "key", html: "<strong>The OWD is the floor.</strong> Set it for the most restricted user, then open access upward. Nothing in sharing can take a user below it." }
            ]
          },
          {
            id: "role-hierarchy",
            title: "The role hierarchy",
            summary: "Roles open record access upward: managers see and edit what their subordinates own when hierarchies are on.",
            minutes: 8,
            tags: ["roles", "hierarchy", "sharing"],
            blocks: [
              { t: "p", html: "The role hierarchy is a tree of data-access levels, not an HR chart. Its one rule is that access flows <strong>upward</strong>: users in a role can reach the records owned by, or shared with, users in roles beneath them, provided the object grants access using hierarchies." },
              { t: "table", headers: ["Viewer's position", "Access to a record owned by a sales rep (Private OWD)"], rows: [
                ["The rep (owner)", "Full: edit, delete, transfer, share"],
                ["Sales manager above the rep", "Read and edit, through the hierarchy"],
                ["VP above the manager", "Read and edit, through the hierarchy"],
                ["Another rep in a sibling role", "None, unless a rule, team or share opens it"],
                ["Rep's peer in the same role", "None; a shared role is not a shared path upward"]
              ] },
              { t: "ul", items: [
                "Sharing rules and public groups can target <em>roles</em> or <em>roles and subordinates</em>, which makes the tree reusable beyond the upward rule.",
                "Access granted to a subordinate by a rule or share also rolls up to their managers.",
                "Some standard objects have extra role-level settings, such as what an account owner's role can see on related opportunities and cases.",
                "Users without a role own records nobody else reaches through the hierarchy."
              ] },
              { t: "note", variant: "trap", html: "Copying the org chart into roles produces a deep tree where every reorganisation becomes a sharing recalculation. Model the levels of data access you actually need; several job titles can share one role." },
              { t: "h", text: "Hierarchy and data volume" },
              { t: "p", html: "When one user owns a very large number of records of an object (tens of thousands), every role change for that user recalculates access across all of them. Integration and queue-owner users are the usual culprits. Give such users no role, or a role at the top with no subordinates." },
              { t: "table", headers: ["Tier", "Role design", "Why"], rows: [
                ["Naive", "Mirror the org chart, one role per title", "Deep tree, frequent recalculation, accidental access through reorganisations"],
                ["Solid", "Roles per level of data access, kept shallow", "Predictable upward access with fewer moves"],
                ["Standout", "Solid plus explicit handling of high-volume owners and a rule of thumb that access between siblings goes through sharing rules, never through extra roles", "Scales with data volume and survives reorganisations"]
              ] },
              { t: "compare",
                bad: { title: "Roles used for permissions", items: ["Create a role so a team can edit a field", "Mix capability and visibility in one tree"] },
                good: { title: "Roles for visibility only", items: ["Roles decide whose records flow upward", "Permission sets decide what users can do with them"] } },
              { t: "cue", html: "<strong>Reach for the role hierarchy when you hear:</strong> managers must see their team's pipeline, regional leads see all their region's deals, the integration user owns two million records, a reorganisation broke visibility." },
              { t: "note", variant: "key", html: "<strong>Roles open access upward, and only upward.</strong> Keep the tree shallow and visibility-focused; use sharing rules for sideways access and permission sets for capabilities." }
            ]
          },
          {
            id: "sharing-rules",
            title: "Sharing rules, teams and manual sharing",
            summary: "Rules open access to groups by ownership or criteria; teams and manual shares open it record by record.",
            minutes: 10,
            tags: ["sharing-rules", "teams", "manual-sharing"],
            blocks: [
              { t: "p", html: "Once the default and the hierarchy are set, the remaining mechanisms open access <strong>sideways</strong>: to groups, territories, teams or individuals who are not above the owner. Each is additive, and the user's effective access is the most permissive grant from any of them." },
              { t: "table", headers: ["Mechanism", "Grants to", "Driven by", "Survives owner change"], rows: [
                ["Owner-based sharing rule", "Public groups, roles, roles and subordinates", "Who owns the record", "Yes, re-evaluated"],
                ["Criteria-based sharing rule", "Same targets", "Field values on the record", "Yes, re-evaluated"],
                ["Account, opportunity or case team", "Named users on the record", "Team membership", "Usually kept, depending on transfer settings"],
                ["Manual share", "A user or group, chosen by hand", "The owner or someone above them", "No: removed on transfer"],
                ["Apex managed share", "A user or group, chosen by code", "Your logic", "Yes, with a custom sharing reason"]
              ] },
              { t: "widget", id: "obSharingCalc" },
              { t: "h", text: "Rule types and limits" },
              { t: "ul", items: [
                "Rules grant <strong>Read Only</strong> or <strong>Read/Write</strong>, never less than the default and never delete or transfer.",
                "Owner-based rules suit org-structure sharing: all records owned by the EMEA role are readable by EMEA Support.",
                "Criteria-based rules suit attribute sharing: every case where Product Line is Payments is editable by the Payments group.",
                "Each object allows a few hundred rules, with a lower cap on criteria-based ones; prefer a few broad rules on well-designed groups.",
                "Guest users have their own sharing rule type and should be granted the minimum."
              ] },
              { t: "h", text: "Teams and manual sharing" },
              { t: "ul", items: [
                "Teams add named collaborators per record, with their own access level and team role.",
                "Manual sharing is available when the default is Private or Public Read Only, and disappears when the owner changes.",
                "Implicit sharing also exists: access to a child contact, opportunity or case gives read access to its parent account."
              ] },
              { t: "table", headers: ["Tier", "Opening access to a support team", "Why"], rows: [
                ["Naive", "Ask owners to share manually", "Lost on every reassignment, impossible to audit"],
                ["Solid", "Criteria-based rule to a public group", "Declarative, consistent, re-evaluated on change"],
                ["Standout", "Solid plus groups built from roles, not individual users, and Apex managed sharing only where the rule cannot be expressed as criteria", "Membership changes are cheap, and code is reserved for real exceptions"]
              ] },
              { t: "note", variant: "tip", html: "Reason about access by walking the layers in the calculator: start at the default, add the hierarchy, then rules, teams, manual and Apex shares, and finally View All. The answer is the highest grant you reached." },
              { t: "cue", html: "<strong>Reach for sharing rules when you hear:</strong> support needs to see all high-priority cases, regions must collaborate on shared accounts, give this group read on records matching a field value, my manual shares keep vanishing." },
              { t: "note", variant: "key", html: "<strong>Effective access is the most permissive grant.</strong> Rules open access to groups by owner or criteria, teams and manual shares open it per record, and manual shares die with an ownership change." }
            ]
          },
          {
            id: "apex-managed-sharing",
            title: "Apex managed sharing",
            summary: "When rules cannot express who should see a record, write share rows from code with a custom sharing reason and a recalculation batch.",
            minutes: 11,
            tags: ["apex-sharing", "share-objects", "recalculation"],
            blocks: [
              { t: "p", html: "Every object with a Private or Public Read Only default has a <strong>share table</strong>: rows that say which user or group can reach which record, at what level, and why. Sharing rules, teams and manual shares all write rows there. Apex managed sharing writes rows there too, for cases where only code knows who should see the record." },
              { t: "ul", items: [
                "Access depends on a lookup to a user, such as a reviewer or an assigned partner contact.",
                "Access follows a junction: users on a project should see every deliverable linked to it.",
                "Access depends on logic too complex for criteria-based rules, such as computed eligibility."
              ] },
              { t: "h", text: "The share row" },
              { t: "table", headers: ["Field", "Meaning"], rows: [
                ["ParentId", "The record being shared"],
                ["UserOrGroupId", "Who gets access: a user or a public group"],
                ["AccessLevel", "<code class='tok'>Read</code> or <code class='tok'>Edit</code>"],
                ["RowCause", "Why the row exists; use a custom Apex sharing reason on custom objects"]
              ] },
              { t: "code", lang: "java", code:
                "/**\n" +
                " * @description Grants project reviewers Read access.\n" +
                " *              without sharing: the running user may not have the right to share records they do not own.\n" +
                " */\n" +
                "public without sharing class ProjectShareService {\n" +
                "    private static final String CLS = 'ProjectShareService';\n" +
                "    private static ProjectShareService instance;\n" +
                "    /** @description Singleton accessor. */\n" +
                "    public static ProjectShareService getInstance() {\n" +
                "        if (instance == null) { instance = new ProjectShareService(); }\n" +
                "        return instance;\n" +
                "    }\n" +
                "    private ProjectShareService() {}\n" +
                "\n" +
                "    /** @description Inserts one share per project for its reviewer. */\n" +
                "    public void shareWithReviewers(List<Project__c> projects) {\n" +
                "        List<Project__Share> shares = new List<Project__Share>();\n" +
                "        for (Project__c p : projects) {\n" +
                "            if (p.Reviewer__c != null && p.Reviewer__c != p.OwnerId) {\n" +
                "                shares.add(new Project__Share(\n" +
                "                    ParentId = p.Id,\n" +
                "                    UserOrGroupId = p.Reviewer__c,\n" +
                "                    AccessLevel = 'Read',\n" +
                "                    RowCause = Schema.Project__Share.RowCause.Reviewer_Access__c\n" +
                "                ));\n" +
                "            }\n" +
                "        }\n" +
                "        if (shares.isEmpty()) { return; }\n" +
                "        List<Database.SaveResult> results = Database.insert(shares, false);\n" +
                "        for (Database.SaveResult sr : results) {\n" +
                "            if (!sr.isSuccess()) {\n" +
                "                Logger.publish(LogEntry.newDmlLog(results, shares).withClassName(CLS).withMethodName('shareWithReviewers'));\n" +
                "                break;\n" +
                "            }\n" +
                "        }\n" +
                "    }\n" +
                "\n" +
                "    /** @description Removes this reason's shares only; manual and rule shares are untouched. */\n" +
                "    public void revokeReviewerShares(Set<Id> projectIds) {\n" +
                "        IProjectShareSelector selector = ProjectShareSelector.newInstance();\n" +
                "        List<Project__Share> stale = selector.selectByParentAndCause(\n" +
                "            projectIds, Schema.Project__Share.RowCause.Reviewer_Access__c);\n" +
                "        if (!stale.isEmpty()) { delete stale; }\n" +
                "    }\n" +
                "}"
              },
              { t: "p", html: "Register a <strong>recalculation class</strong> against the sharing reason so an admin, or the platform after a default change, can rebuild every row your code owns. It is ordinary batch Apex whose <code class='tok'>start()</code> selects only records that need a share." },
              { t: "code", lang: "java", code:
                "/** @description Rebuilds Reviewer_Access__c shares. without sharing: must see every project. */\n" +
                "public without sharing class ProjectReviewerShareRecalc implements Database.Batchable<SObject> {\n" +
                "    private static final String CLS = 'ProjectReviewerShareRecalc';\n" +
                "    /** @description Projects that have a reviewer; nothing else needs a share. */\n" +
                "    public Database.QueryLocator start(Database.BatchableContext ctx) {\n" +
                "        IProjectSelector selector = ProjectSelector.newInstance();\n" +
                "        return selector.locateWithReviewer();\n" +
                "    }\n" +
                "    /** @description Deletes this reason's shares for the chunk, then re-inserts them. */\n" +
                "    public void execute(Database.BatchableContext ctx, List<Project__c> scope) {\n" +
                "        try {\n" +
                "            ProjectShareService svc = ProjectShareService.getInstance();\n" +
                "            svc.revokeReviewerShares(new Map<Id, Project__c>(scope).keySet());\n" +
                "            svc.shareWithReviewers(scope);\n" +
                "        } catch (Exception ex) {\n" +
                "            Logger.publish(LogEntry.newExceptionLog(ex).withClassName(CLS).withMethodName('execute'));\n" +
                "        }\n" +
                "    }\n" +
                "    /** @description No follow-up work. */\n" +
                "    public void finish(Database.BatchableContext ctx) {}\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "Custom sharing reasons exist only on custom objects. On standard objects, Apex shares use the Manual row cause and are removed when the owner changes, so code must re-create them on transfer. And a share to the record's current owner fails, which is why the service skips it." },
              { t: "table", headers: ["Tier", "Programmatic sharing", "Why"], rows: [
                ["Naive", "Insert shares with RowCause Manual from a trigger, one DML per record", "Lost on owner change, breaks bulk loads, impossible to rebuild"],
                ["Solid", "Custom sharing reason, bulk insert with partial success, revoke on reassignment", "Owned, cleanable rows that survive transfers"],
                ["Standout", "Solid plus a registered recalculation batch, logging of failed share rows, and tests that query as the reviewer to prove access", "Self-healing after default changes, and proven in CI"]
              ] },
              { t: "note", variant: "trap", html: "Share helpers are one of the few places where <code class='tok'>without sharing</code> is justified. Keep that class tiny and write the reason in its ApexDoc, so the exception does not spread to the business logic around it." },
              { t: "cue", html: "<strong>Reach for Apex managed sharing when you hear:</strong> the assigned reviewer must see the record, partners should see projects they are linked to, access depends on a junction, no sharing rule can express this." },
              { t: "quiz", id: "sec-records" },
              { t: "note", variant: "key", html: "<strong>Code-owned share rows need a custom reason.</strong> Insert in bulk with a custom RowCause, revoke on reassignment, register a recalculation batch, and keep the without sharing class small and justified." }
            ]
          }
        ]
      },
      {
        id: "code",
        name: "Security in Code",
        icon: "wrench",
        lessons: [
          {
            id: "sharing-keywords",
            title: "with, without and inherited sharing",
            summary: "The sharing keyword decides whether a class respects record access; declare one on every class, and know what it does not cover.",
            minutes: 9,
            tags: ["apex", "sharing-keywords", "security"],
            blocks: [
              { t: "p", html: "Apex runs in system mode, but a class can opt into the running user's <strong>record</strong> access with a sharing keyword. The keyword answers one question only: does this class see every record, or only the records the user could reach? It says nothing about object or field permissions." },
              { t: "table", headers: ["Keyword", "Behaviour", "Use it for"], rows: [
                ["<code class='tok'>with sharing</code>", "Enforces the running user's record access", "The default: controllers, services, handlers"],
                ["<code class='tok'>inherited sharing</code>", "Takes the caller's mode; with sharing when it is the entry point", "Selectors and utilities called from many contexts"],
                ["<code class='tok'>without sharing</code>", "Ignores record access", "Narrow, documented exceptions such as share helpers or audit writers"],
                ["No keyword", "Takes the caller's mode, but usually runs without sharing as an entry point", "Nothing: always declare one"]
              ] },
              { t: "ul", items: [
                "The mode belongs to the class where a method is <strong>defined</strong>, not where it is called from.",
                "Inner classes do not inherit the outer class's keyword; declare it on each.",
                "Triggers run in system context; the handler and service classes they call decide sharing.",
                "Classes serving Lightning components without a keyword are treated as with sharing, but relying on that default hides intent."
              ] },
              { t: "code", lang: "java", code:
                "/** @description Thin controller for the escalation component. */\n" +
                "public with sharing class CaseEscalationController {\n" +
                "    private static final String CLS = 'CaseEscalationController';\n" +
                "    /** @description Escalates the given cases the user can see. */\n" +
                "    @AuraEnabled\n" +
                "    public static void escalate(List<Id> caseIds) {\n" +
                "        try {\n" +
                "            CaseEscalationService.getInstance().escalate(new Set<Id>(caseIds));\n" +
                "        } catch (Exception ex) {\n" +
                "            Logger.publish(LogEntry.newExceptionLog(ex).withClassName(CLS).withMethodName('escalate'));\n" +
                "            throw new AuraHandledException(ex.getMessage());\n" +
                "        }\n" +
                "    }\n" +
                "}\n" +
                "\n" +
                "/** @description All Case SOQL; runs in whatever mode the caller uses. */\n" +
                "public inherited sharing class CaseSelector implements ICaseSelector { /* queries */ }\n" +
                "\n" +
                "/**\n" +
                " * @description Writes escalation audit rows.\n" +
                " *              without sharing: audit records are owned by an integration user and are Private.\n" +
                " */\n" +
                "public without sharing class EscalationAuditWriter { /* insert only */ }"
              },
              { t: "note", variant: "trap", html: "<code class='tok'>with sharing</code> does not enforce CRUD or FLS. A with sharing class can still read a salary field the user cannot see. Combine the keyword with user-mode queries and DML." },
              { t: "table", headers: ["Tier", "Sharing declarations", "Why"], rows: [
                ["Naive", "No keyword anywhere, or without sharing to make errors go away", "Users reach records the UI would hide"],
                ["Solid", "with sharing by default, inherited sharing on selectors", "Record access matches the UI along every path"],
                ["Standout", "Solid plus every without sharing class small, single-purpose and justified in ApexDoc, with a static-analysis rule that flags missing keywords", "Exceptions are visible, reviewed and rare"]
              ] },
              { t: "compare",
                bad: { title: "Widening to fix a bug", items: ["Query returns nothing for a user, so switch the class to without sharing", "Now every caller sees every record"] },
                good: { title: "Widening on purpose", items: ["Find which layer denies access and whether it should", "If code truly needs more, isolate it in a tiny without sharing class with a written reason"] } },
              { t: "p", html: "In an interview, separate the two questions every Apex class must answer: which <em>records</em> may it reach (the sharing keyword) and which <em>objects and fields</em> may it touch (user mode or stripInaccessible). Naming both, and saying that the keyword covers only the first, is the answer reviewers listen for." },
              { t: "cue", html: "<strong>Reach for sharing keywords when you hear:</strong> the component shows records the user should not see, it works for admins but not for users, should this selector be with sharing, the security review flagged a class without a keyword." },
              { t: "note", variant: "key", html: "<strong>Declare a keyword on every class.</strong> with sharing by default, inherited sharing for selectors, without sharing only with a written reason. Sharing keywords cover records, not fields." }
            ]
          },
          {
            id: "user-mode",
            title: "User mode, stripInaccessible and secure SOQL",
            summary: "Run queries and DML as the user, degrade gracefully where partial access is fine, and keep user input out of query syntax.",
            minutes: 11,
            tags: ["user-mode", "strip-inaccessible", "soql-injection"],
            blocks: [
              { t: "p", html: "User mode makes a query or DML statement behave as if the user did it through the UI: object permissions, field-level security and sharing all apply. It is the single most useful security switch in modern Apex, and it removes most of the hand-written permission checks older code carried." },
              { t: "table", headers: ["Tool", "Enforces", "When access is missing"], rows: [
                ["<code class='tok'>WITH USER_MODE</code> / <code class='tok'>AccessLevel.USER_MODE</code>", "CRUD, FLS and sharing across the statement", "Throws; the exception lists inaccessible fields"],
                ["<code class='tok'>Security.stripInaccessible</code>", "FLS (and CRUD) on records you already hold", "Removes fields and reports which"],
                ["<code class='tok'>WITH SECURITY_ENFORCED</code>", "CRUD and FLS on selected fields", "Throws on the first violation"],
                ["Describe checks such as <code class='tok'>isAccessible()</code>", "One field or object at a time", "Returns false; you decide what to do"]
              ] },
              { t: "code", lang: "java", code:
                "// Read and write in the same mode\n" +
                "List<Invoice__c> open = [\n" +
                "    SELECT Id, Amount__c, Status__c FROM Invoice__c\n" +
                "    WHERE Account__c IN :accountIds AND Status__c = 'Open'\n" +
                "    WITH USER_MODE\n" +
                "];\n" +
                "for (Invoice__c inv : open) { inv.Status__c = 'Sent'; }\n" +
                "Database.update(open, false, AccessLevel.USER_MODE);"
              },
              { t: "h", text: "stripInaccessible for partial access" },
              { t: "code", lang: "java", code:
                "SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, employees);\n" +
                "List<Employee__c> visible = (List<Employee__c>) decision.getRecords();\n" +
                "Set<String> removed = decision.getRemovedFields().get('Employee__c');\n" +
                "// return visible to the component; removed tells the UI which columns to hide"
              },
              { t: "note", variant: "warn", html: "Never mix a user-mode read with a system-mode write. A plain <code class='tok'>update</code> after a <code class='tok'>WITH USER_MODE</code> query lets the user change fields and records the UI would have refused. Keep both sides in user mode, or move both to system mode and write down why." },
              { t: "note", variant: "trap", html: "Setup objects such as <code class='tok'>PermissionSetAssignment</code>, <code class='tok'>UserRole</code> and <code class='tok'>GroupMember</code> are the known exception. Ordinary users lack read access to them, so user-mode queries quietly return nothing in production while working for admins in testing. Prefer custom permissions; if you must query them, use system mode with a documented reason." },
              { t: "h", text: "Keeping input out of query syntax" },
              { t: "code", lang: "java", code:
                "// Injectable: user text becomes part of the query\n" +
                "String soql = 'SELECT Id FROM Account WHERE Name LIKE \\'%' + searchTerm + '%\\'';\n" +
                "\n" +
                "// Safe: values bound, identifiers allow-listed, user mode\n" +
                "private static final Set<String> SORTABLE = new Set<String>{ 'Name', 'CreatedDate', 'Industry' };\n" +
                "String sortField = SORTABLE.contains(requestedSort) ? requestedSort : 'Name';\n" +
                "Map<String, Object> binds = new Map<String, Object>{ 'term' => '%' + searchTerm + '%' };\n" +
                "List<Account> rows = Database.queryWithBinds(\n" +
                "    'SELECT Id, Name FROM Account WHERE Name LIKE :term ORDER BY ' + sortField + ' LIMIT 50',\n" +
                "    binds,\n" +
                "    AccessLevel.USER_MODE\n" +
                ");"
              },
              { t: "table", headers: ["Tier", "Securing a search endpoint", "Why"], rows: [
                ["Naive", "Concatenate the term into dynamic SOQL in system mode", "Injection plus full data exposure"],
                ["Solid", "Bind variables and user mode", "User text can only ever be data, and access matches the UI"],
                ["Standout", "Solid plus allow-listed sort and filter fields, stripInaccessible on the response, and a test that runs as a restricted user and asserts a hidden field never comes back", "Every path is enforced and proven; escapeSingleQuotes is not needed"]
              ] },
              { t: "cue", html: "<strong>Reach for user mode and binds when you hear:</strong> dynamic search, user-selected sort column, security review findings on CRUD, FLS or SOQL injection, an LWC calling Apex with filters, the query works for admins only." },
              { t: "quiz", id: "sec-code" },
              { t: "note", variant: "key", html: "<strong>Act as the user, on both sides.</strong> WITH USER_MODE reads, AccessLevel.USER_MODE writes, stripInaccessible where partial access is fine, bind variables for every value, and allow-lists for every identifier. Setup objects are the exception." }
            ]
          }
        ]
      },
      {
        id: "protect",
        name: "Data Protection",
        icon: "shield",
        lessons: [
          {
            id: "shield",
            title: "Shield: encryption, audit trail and event monitoring",
            summary: "The three Shield capabilities, what each one does and does not protect, and the feature trade-offs to test before switching them on.",
            minutes: 11,
            tags: ["shield", "encryption", "audit"],
            blocks: [
              { t: "p", html: "Sharing and field-level security decide <em>who</em> may see data. Shield answers three different questions: <strong>what if the storage is stolen</strong> (Platform Encryption), <strong>what did this field say last year</strong> (Field Audit Trail), and <strong>who did what, and can we stop it as it happens</strong> (Event Monitoring). Think of a bank: the vault door, the ledger archive and the CCTV with a guard." },
              { t: "table", headers: ["Capability", "Protects against", "Does not do"], rows: [
                ["Platform Encryption", "Exposure of data at rest in storage, backups and files", "Hide data from users who have access; it is not a sharing control"],
                ["Field Audit Trail", "Losing the history of field changes needed for compliance", "Track every field automatically; you choose fields and retention policy"],
                ["Event Monitoring", "Unnoticed misuse: mass exports, unusual logins, API abuse", "Block anything unless you add Transaction Security policies"]
              ] },
              { t: "h", text: "Platform Encryption" },
              { t: "table", headers: ["Scheme", "Strength", "Filtering"], rows: [
                ["Probabilistic", "Same value encrypts differently each time", "No filtering or matching on the field"],
                ["Deterministic", "Same value always yields the same ciphertext", "Exact-match filters, with case-sensitive or case-insensitive options"]
              ] },
              { t: "ul", items: [
                "Keys derive from <strong>tenant secrets</strong> you generate and rotate; Bring Your Own Key and cache-only keys suit stricter policies.",
                "Encryption uses AES with 256-bit keys; you manage policy, not algorithms.",
                "Some features change for encrypted fields, such as sorting, certain formula functions and some report filters. Run the encryption policy's impact checks and test in a full sandbox first.",
                "Classic encrypted text fields only mask display and are limited in length; they are not a substitute for Shield."
              ] },
              { t: "note", variant: "trap", html: "Encryption is invisible to authorised users: they see plaintext. If the problem is \"interns can see salaries\", the fix is field-level security and sharing, not encryption." },
              { t: "h", text: "Field history and Field Audit Trail" },
              { t: "table", headers: ["", "Standard field history", "Field Audit Trail"], rows: [
                ["Fields per object", "Up to 20", "Up to 60"],
                ["Retention", "About 18 months in the UI, 24 via the API", "Policy-based, up to about 10 years"],
                ["Storage", "History related list", "Archived to the FieldHistoryArchive big object"]
              ] },
              { t: "h", text: "Event Monitoring and Transaction Security" },
              { t: "ul", items: [
                "Event log files cover logins, API calls, report exports, Lightning page views, Apex execution and more; without the add-on only a few event types with short retention are available.",
                "Real-time events can feed Transaction Security policies that block, require multi-factor authentication or notify.",
                "Feed the logs into your security monitoring rather than reading them by hand."
              ] },
              { t: "compare",
                bad: { title: "Checkbox compliance", items: ["Encrypt every field on day one", "Discover broken reports and filters in production", "Collect event logs nobody reviews"] },
                good: { title: "Risk-led rollout", items: ["Classify data and encrypt only what policy requires", "Test encryption impact in a full sandbox with real reports", "Alert on exports and logins with Transaction Security"] } },
              { t: "cue", html: "Think Shield when you hear <em>\"encrypt PII at rest\"</em>, <em>\"auditors want seven years of field changes\"</em>, or <em>\"who exported the whole customer list?\"</em>" },
              { t: "quiz", id: "sec-protect" },
              { t: "note", variant: "key", html: "<strong>Shield adds encryption at rest, long-term field history and activity monitoring on top of the access model, never instead of it.</strong> Encrypt by policy, test feature impact first, and act on events with Transaction Security." }
            ]
          }
        ]
      }
    ]
  };
})();
