/* =====================================================================
   NIMBUS · IAM & Workload Identity
   window.TRACKS.iam — modules: policies / roles / guardrails

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.

   Block grammar (rendered by app.js):
     {t:'p', html}              paragraph (inline HTML allowed)
     {t:'h', text}              section heading
     {t:'h2', text}             sub heading
     {t:'ul'|'ol', items:[]}    list (items are inline HTML)
     {t:'code', lang, code}     code card
     {t:'note', variant, html}  callout: tip|key|warn|trap
     {t:'table', headers, rows} data table
     {t:'compare', bad, good}   two-column contrast
     {t:'stat', items}          metric row [{v,k}]
     {t:'cue', html}            "spotting it" callout
     {t:'diagram', id}          inline SVG from app.js DIAGRAMS
     {t:'widget', id}           interactive widget
     {t:'quiz', id}             quiz
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
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
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }

  /* A .w-seg group. `pairs` is [[value, label], ...]; onPick gets the value. */
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

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  /* An on/off .w-btn. Keeps its own node reference; never re-queries. */
  function toggle(label, initial, onChange) {
    var on = !!initial;
    var b = h("button", { type: "button", class: "w-btn" }, "");
    function sync() {
      b.className = "w-btn " + (on ? "primary" : "ghost");
      b.textContent = label + ": " + (on ? "yes" : "no");
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    b.addEventListener("click", function () { on = !on; sync(); onChange(on); });
    sync();
    return b;
  }

  var Widgets = {};

  /* ==================================================================
     1. iamPolicyEval — AWS allow / deny precedence simulator
     Simplified model of one API call by an IAM role session:
       - RCPs are folded into the "SCP allows" toggle
       - KMS key policies, VPC endpoint policies and trust policies are
         not modelled
       - same account: a resource policy can grant on its own; if it
         names the role ARN, boundary and session policy still limit it;
         if it names the role session ARN (or an IAM user), they do not
       - cross account: caller identity policy AND resource policy must
         both allow
  ================================================================== */
  function iamEvaluate(s) {
    var steps = [];
    function step(layer, status, text) { steps.push({ layer: layer, status: status, text: text }); }
    function finish(decision, by) {
      var order = ["Explicit deny check", "SCPs / RCPs", "Resource-based policy", "Identity-based policy", "Permission boundary", "Session policy"];
      for (var i = steps.length; i < order.length; i++) steps.push({ layer: order[i], status: "skip", text: "Not reached — a decision was already made." });
      return { decision: decision, by: by, steps: steps };
    }
    var cross = s.scope === "cross";

    if (s.deny) { step("Explicit deny check", "deny", "A Deny statement matches this request. Nothing can override it."); return finish("Explicit deny", "Explicit deny"); }
    step("Explicit deny check", "pass", "No Deny statement matches in any applicable policy" + (cross ? " in either account." : "."));

    if (!s.scp) { step("SCPs / RCPs", "deny", "The organisation policies do not allow this action, so it is capped regardless of IAM grants."); return finish("Implicit deny", "SCP / RCP"); }
    step("SCPs / RCPs", "pass", cross ? "The caller's SCPs and the resource account's RCPs both allow the action." : "Organisation policies allow the action (they never grant it by themselves).");

    if (!cross) {
      if (s.res && s.resNames === "session") {
        step("Resource-based policy", "allow", "The resource policy names the role session (or an IAM user) directly. In the same account that grant stands on its own, and implicit denies from a boundary or session policy do not cut it back.");
        return finish("Allow", "Resource-based policy");
      }
      if (s.res) step("Resource-based policy", "pass", "The resource policy grants the role ARN. That is enough to grant in the same account, but boundary and session policy still apply.");
      else step("Resource-based policy", "pass", "No resource-policy grant, so an identity policy must provide the Allow.");

      if (s.idp) step("Identity-based policy", "pass", "The role's identity policy allows the action.");
      else if (s.res) step("Identity-based policy", "pass", "No identity Allow, and none is needed: in the same account the resource-policy grant is sufficient.");
      else { step("Identity-based policy", "deny", "Neither an identity policy nor a resource policy grants the action. Default is deny."); return finish("Implicit deny", "No policy grants it"); }
    } else {
      if (!s.res && !s.idp) { step("Resource-based policy", "deny", "Neither side grants the action. Cross-account access needs both the caller's identity policy and the resource account's policy."); return finish("Implicit deny", "Neither account grants it"); }
      if (!s.res) { step("Resource-based policy", "deny", "The resource account has not granted the caller. An identity Allow alone cannot reach into another account."); return finish("Implicit deny", "Resource-based policy (missing)"); }
      step("Resource-based policy", "pass", "The resource account's policy grants the caller's role.");
      if (!s.idp) { step("Identity-based policy", "deny", "The caller's identity policy does not allow the action. The resource account's grant is necessary but not sufficient across accounts."); return finish("Implicit deny", "Identity-based policy (missing)"); }
      step("Identity-based policy", "pass", "The caller's identity policy also allows it, so both sides agree.");
    }

    if (s.boundary === "none") step("Permission boundary", "skip", "No permission boundary is attached to this role.");
    else if (s.boundary === "allow") step("Permission boundary", "pass", "The boundary includes the action, so the grant survives.");
    else { step("Permission boundary", "deny", "A boundary is attached and does not include the action. The boundary is a ceiling; outside it there is an implicit deny."); return finish("Implicit deny", "Permission boundary"); }

    if (s.session === "none") step("Session policy", "skip", "The session was created without a session policy.");
    else if (s.session === "allow") step("Session policy", "pass", "The session policy includes the action.");
    else { step("Session policy", "deny", "A session policy was passed at AssumeRole and does not include the action, so the session cannot use it."); return finish("Implicit deny", "Session policy"); }

    return finish("Allow", s.res && !s.idp ? "Resource-based policy" : (s.res ? "Identity + resource policy" : "Identity-based policy"));
  }

  var IAM_STATUS = {
    pass: { label: "pass", fill: "var(--cyan)" },
    skip: { label: "n/a", fill: "var(--line-strong)" },
    deny: { label: "decides: deny", fill: "var(--rose)" },
    allow: { label: "decides: allow", fill: "var(--lime)" }
  };

  Widgets.iamPolicyEval = function (mount) {
    shell(mount, "simulator", "Allow or deny? Walk the evaluation",
      "One role session calls one action on one resource. Flip the layers and watch which one decides. Simplified: RCPs are folded into the SCP toggle, and KMS key policies, endpoint policies and trust policies are left out.");

    var s = { deny: false, scp: true, res: false, idp: true, boundary: "none", session: "none", scope: "same", resNames: "role" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var r = iamEvaluate(s);
      clear(stage);
      for (var i = 0; i < r.steps.length; i++) {
        var st = r.steps[i];
        var meta = IAM_STATUS[st.status] || IAM_STATUS.skip;
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:26px minmax(140px,0.9fr) 116px minmax(160px,2fr);gap:10px;align-items:start;padding:8px 10px;margin:4px 0;border-radius:8px;" +
            "border-left:4px solid " + meta.fill + ";background:color-mix(in srgb, " + meta.fill + " " + (st.status === "skip" ? "6" : "16") + "%, transparent)"
        },
          h("b", { style: "font-family:var(--font-mono);color:var(--text-dim)" }, String(i + 1)),
          h("span", { style: "font-size:0.86rem;font-weight:600;color:var(--text)" }, st.layer),
          h("span", { style: "font-family:var(--font-mono);font-size:0.74rem;color:var(--text)" }, meta.label),
          h("span", { style: "font-size:0.84rem;color:var(--text-dim);line-height:1.45" }, st.text)));
      }
      var fill = r.decision === "Allow" ? "var(--lime)" : "var(--rose)";
      stage.appendChild(h("div", {
        style: "margin-top:12px;padding:10px 14px;border-radius:10px;font-weight:700;color:var(--text);border:1px solid " + fill + ";background:color-mix(in srgb, " + fill + " 22%, transparent)"
      }, "Result: " + r.decision + " — decided by " + r.by));

      clear(readout);
      readout.appendChild(ro("result", r.decision));
      readout.appendChild(ro("decided by", r.by));
      readout.appendChild(ro("scope", s.scope === "cross" ? "cross-account" : "same account"));
      var evaluated = 0;
      for (var j = 0; j < r.steps.length; j++) if (r.steps[j].status !== "skip") evaluated++;
      readout.appendChild(ro("layers that mattered", evaluated + " of " + r.steps.length));
      if (s.scope === "cross" && s.res) readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%" }, "Across accounts the 'names role vs session' choice does not change the outcome here: both sides must allow, and the caller's boundary and session policy still apply."));
    }

    var row1 = h("div", { class: "widget-controls" },
      toggle("Explicit deny anywhere", s.deny, function (v) { s.deny = v; paint(); }),
      toggle("SCP allows", s.scp, function (v) { s.scp = v; paint(); }),
      toggle("Resource policy allows", s.res, function (v) { s.res = v; paint(); }),
      toggle("Identity policy allows", s.idp, function (v) { s.idp = v; paint(); })
    );
    var row2 = h("div", { class: "widget-controls" },
      h("span", { class: "w-field" }, "Boundary"),
      segment([["none", "none"], ["allow", "allows"], ["omit", "omits action"]], 0, function (v) { s.boundary = v; paint(); }),
      h("span", { class: "w-field" }, "Session policy"),
      segment([["none", "none"], ["allow", "allows"], ["omit", "omits action"]], 0, function (v) { s.session = v; paint(); })
    );
    var row3 = h("div", { class: "widget-controls" },
      segment([["same", "Same account"], ["cross", "Cross-account"]], 0, function (v) { s.scope = v; paint(); }),
      h("span", { class: "w-field" }, "Resource policy names"),
      segment([["role", "role ARN"], ["session", "session ARN / IAM user"]], 0, function (v) { s.resNames = v; paint(); })
    );
    mount.appendChild(row1);
    mount.appendChild(row2);
    mount.appendChild(row3);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. iamOidcTrust — GitHub Actions OIDC trust policy checker
     Claim values are plain strings (not URLs). StringLike supports
     * and ? wildcards; StringEquals is exact.
  ================================================================== */
  var OIDC_VARIANTS = {
    branch: { label: "Exact branch", op: "StringEquals", sub: "repo:acme/payments:ref:refs/heads/main", risk: "tight", note: "Only workflows running on main in acme/payments can assume the role." },
    env: { label: "Exact environment", op: "StringEquals", sub: "repo:acme/payments:environment:production", risk: "tight", note: "Only jobs that target the production environment, which can carry required reviewers and branch rules, can assume the role." },
    repo: { label: "Repo wildcard", op: "StringLike", sub: "repo:acme/payments:*", risk: "broad", note: "Any branch, tag, pull request or environment in this repo — a contributor's feature branch can deploy." },
    org: { label: "Org wildcard", op: "StringLike", sub: "repo:acme/*", risk: "dangerous", note: "Any repository in the acme organisation, including sandboxes and repos created next year." },
    nosub: { label: "No sub condition", op: "", sub: "", risk: "critical", note: "Only the audience is checked. Any GitHub repository anywhere can request a token with that audience and assume this role." }
  };

  var OIDC_REFS = {
    main: { label: "branch main", sub: function (r) { return "repo:" + r + ":ref:refs/heads/main"; } },
    feature: { label: "branch feature/login", sub: function (r) { return "repo:" + r + ":ref:refs/heads/feature/login"; } },
    tag: { label: "tag v1.4.0", sub: function (r) { return "repo:" + r + ":ref:refs/tags/v1.4.0"; } },
    pr: { label: "pull_request", sub: function (r) { return "repo:" + r + ":pull_request"; } },
    env: { label: "environment production", sub: function (r) { return "repo:" + r + ":environment:production"; } }
  };

  function oidcGlob(pattern, value) {
    var re = "^";
    for (var i = 0; i < pattern.length; i++) {
      var c = pattern.charAt(i);
      if (c === "*") re += ".*";
      else if (c === "?") re += ".";
      else re += c.replace(/[\\^$.|+()[\]{}]/g, "\\$&");
    }
    re += "$";
    try { return new RegExp(re).test(value); } catch (e) { return false; }
  }

  Widgets.iamOidcTrust = function (mount) {
    shell(mount, "checker", "Would this GitHub job get the role?",
      "The role trusts GitHub's OIDC provider. Pick a trust-policy variant, then the repo, the trigger and the audience a workflow presents. The claim values are plain strings, not web addresses.");

    var variant = "branch", repo = "acme/payments", ref = "main", aud = "sts.amazonaws.com";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var repoSel = h("select", { "aria-label": "Repository" },
      h("option", { value: "acme/payments" }, "acme/payments"),
      h("option", { value: "acme/payments-sandbox" }, "acme/payments-sandbox"),
      h("option", { value: "acme/frontend" }, "acme/frontend"),
      h("option", { value: "other-org/payments" }, "other-org/payments"));
    var audSel = h("select", { "aria-label": "Audience" },
      h("option", { value: "sts.amazonaws.com" }, "sts.amazonaws.com"),
      h("option", { value: "api://AzureADTokenExchange" }, "api://AzureADTokenExchange"),
      h("option", { value: "payments-deployer" }, "payments-deployer"));
    repoSel.addEventListener("change", function () { repo = repoSel.value || "acme/payments"; paint(); });
    audSel.addEventListener("change", function () { aud = audSel.value || "sts.amazonaws.com"; paint(); });

    function policyText(v) {
      var lines = [
        "\"Condition\": {",
        "  \"StringEquals\": {",
        "    \"token.actions.githubusercontent.com:aud\": \"sts.amazonaws.com\"" + (v.op === "StringEquals" ? "," : "")
      ];
      if (v.op === "StringEquals") lines.push("    \"token.actions.githubusercontent.com:sub\": \"" + v.sub + "\"");
      lines.push(v.op === "StringLike" ? "  }," : "  }");
      if (v.op === "StringLike") {
        lines.push("  \"StringLike\": {");
        lines.push("    \"token.actions.githubusercontent.com:sub\": \"" + v.sub + "\"");
        lines.push("  }");
      }
      lines.push("}");
      return lines.join("\n");
    }

    function paint() {
      var v = OIDC_VARIANTS[variant] || OIDC_VARIANTS.branch;
      var rf = OIDC_REFS[ref] || OIDC_REFS.main;
      var subClaim = rf.sub(repo);
      var audOk = aud === "sts.amazonaws.com";
      var subOk = !v.op ? true : (v.op === "StringEquals" ? subClaim === v.sub : oidcGlob(v.sub, subClaim));
      var ok = audOk && subOk;
      var reason;
      if (!audOk) reason = "The token's aud claim is " + aud + ", but the policy requires sts.amazonaws.com.";
      else if (!subOk) reason = "The sub claim " + subClaim + " does not match " + (v.op === "StringLike" ? "the pattern " : "") + v.sub + ".";
      else if (!v.op) reason = "Audience matches and there is no sub check at all — the request succeeds for any repository.";
      else reason = "Audience matches and the sub claim satisfies " + v.op + ".";

      clear(stage);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-bottom:6px" }, "Trust policy condition (variant: " + v.label + ")"));
      stage.appendChild(h("pre", { style: "margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);font-family:var(--font-mono);font-size:0.78rem;color:var(--text);white-space:pre-wrap;overflow-x:auto" }, policyText(v)));
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-bottom:6px" }, "Token presented by the workflow"));
      stage.appendChild(h("pre", { style: "margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);font-family:var(--font-mono);font-size:0.78rem;color:var(--text);white-space:pre-wrap" },
        "sub: " + subClaim + "\naud: " + aud + "\nrepository: " + repo));
      var fill = ok ? (v.risk === "tight" ? "var(--lime)" : "var(--amber)") : "var(--rose)";
      stage.appendChild(h("div", {
        style: "padding:10px 14px;border-radius:10px;font-weight:700;color:var(--text);border:1px solid " + fill + ";background:color-mix(in srgb, " + fill + " 22%, transparent)"
      }, ok ? "AssumeRoleWithWebIdentity succeeds" : "AssumeRoleWithWebIdentity fails (AccessDenied)"));
      if (v.risk !== "tight") {
        stage.appendChild(h("div", {
          style: "margin-top:10px;padding:10px 14px;border-radius:10px;color:var(--text);border:1px solid var(--rose);background:color-mix(in srgb, var(--rose) 14%, transparent);font-size:0.86rem;line-height:1.5"
        }, "Risk: " + v.risk.toUpperCase() + " — " + v.note));
      }

      clear(readout);
      readout.appendChild(ro("result", ok ? "role assumed" : "denied"));
      readout.appendChild(ro("aud check", audOk ? "match" : "mismatch"));
      readout.appendChild(ro("sub check", !v.op ? "none (unchecked)" : (subOk ? "match" : "mismatch")));
      readout.appendChild(ro("trust breadth", v.risk));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, "Why: " + reason));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["branch", "Exact branch"], ["env", "Exact environment"], ["repo", "Repo wildcard"], ["org", "Org wildcard"], ["nosub", "No sub"]], 0,
        function (v) { variant = v; paint(); })
    ));
    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "Repo", repoSel),
      segment([["main", "main"], ["feature", "feature/login"], ["tag", "tag v1.4.0"], ["pr", "pull_request"], ["env", "env: production"]], 0,
        function (v) { ref = v; paint(); }),
      h("label", { class: "w-field" }, "Audience", audSel)
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. iamKmsAccess — who may call kms:Decrypt on a customer managed key
     Simplified model:
       - same account: allowed if the key policy names the role, or the
         key policy delegates to IAM (account root statement) and an IAM
         policy allows the call, or a grant covers the role
       - other account: the key policy must name the caller AND the
         caller's IAM policy must allow it, or a grant covers the role
       - an SCP explicit deny beats everything
  ================================================================== */
  function kmsEvaluate(s) {
    if (s.scpDeny) return { ok: false, path: "SCP explicit deny", why: "An explicit deny in an SCP on the caller's account wins over every allow, including grants." };
    if (s.grant) return { ok: true, path: "grant", why: "A grant gives the named grantee the listed operations on this key without editing the key policy. Services such as EBS use grants for exactly this." };
    if (s.caller === "same") {
      if (s.names) return { ok: true, path: "key policy names the role", why: "The key policy allows the role directly, so no IAM policy is needed in the key's own account." };
      if (s.root && s.iam) return { ok: true, path: "key policy delegates to IAM + IAM allow", why: "The account-root statement in the key policy lets IAM policies in this account grant access, and the role's IAM policy allows kms:Decrypt." };
      if (s.root && !s.iam) return { ok: false, path: "no IAM allow", why: "The key policy delegates to IAM, but no IAM policy on the role allows kms:Decrypt." };
      return { ok: false, path: "key policy does not allow", why: "Without the account-root statement, IAM policies alone grant nothing on this key. The key policy is the root of all access." };
    }
    if (s.names && s.iam) return { ok: true, path: "key policy + caller IAM policy", why: "Cross-account use needs both: the key policy allows the external role, and that role's own IAM policy allows kms:Decrypt on the key ARN." };
    if (s.names) return { ok: false, path: "caller IAM missing", why: "The key policy names the external role, but cross-account calls also need an IAM policy in the caller's account." };
    return { ok: false, path: "key policy does not allow", why: "The account-root statement only enables IAM in the key's own account. An external account must be named in the key policy itself." };
  }

  Widgets.iamKmsAccess = function (mount) {
    shell(mount, "evaluator", "KMS access: key policy, IAM and grants",
      "A role calls kms:Decrypt on a customer managed key. Toggle the key policy statements, the role's IAM policy, a grant and an SCP, and switch the caller between the key's own account and another account.");

    var s = { caller: "same", root: true, names: false, iam: true, grant: false, scpDeny: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var r = kmsEvaluate(s);
      clear(stage);
      var rows = [
        ["Key policy: account-root statement (enable IAM policies)", s.root, s.caller === "same" ? "applies" : "ignored for external callers"],
        ["Key policy: names the calling role", s.names, ""],
        ["Role's IAM policy allows kms:Decrypt", s.iam, ""],
        ["Grant for the role", s.grant, ""],
        ["SCP denies kms:Decrypt", s.scpDeny, ""]
      ];
      var list = h("div", { style: "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;font-size:0.84rem;color:var(--text)" });
      for (var i = 0; i < rows.length; i++) {
        list.appendChild(h("span", {}, rows[i][0] + (rows[i][2] ? " (" + rows[i][2] + ")" : "")));
        list.appendChild(h("b", { style: "font-family:var(--font-mono);color:" + (rows[i][1] ? "var(--accent-ink)" : "var(--text-dim)") }, rows[i][1] ? "yes" : "no"));
      }
      stage.appendChild(list);
      var fill = r.ok ? "var(--lime)" : "var(--rose)";
      stage.appendChild(h("div", {
        style: "margin-top:12px;padding:10px 14px;border-radius:10px;font-weight:700;color:var(--text);border:1px solid " + fill + ";background:color-mix(in srgb, " + fill + " 22%, transparent)"
      }, r.ok ? "kms:Decrypt allowed" : "kms:Decrypt denied (AccessDeniedException)"));
      clear(readout);
      readout.appendChild(ro("caller", s.caller === "same" ? "key's own account" : "another account"));
      readout.appendChild(ro("decision", r.ok ? "allow" : "deny"));
      readout.appendChild(ro("path", r.path));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, "Why: " + r.why));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["same", "Caller in key's account"], ["other", "Caller in another account"]], 0, function (v) { s.caller = v; paint(); })));
    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap" },
      toggle("root statement", s.root, function (v) { s.root = v; paint(); }),
      toggle("names role", s.names, function (v) { s.names = v; paint(); }),
      toggle("IAM allow", s.iam, function (v) { s.iam = v; paint(); }),
      toggle("grant", s.grant, function (v) { s.grant = v; paint(); }),
      toggle("SCP deny", s.scpDeny, function (v) { s.scpDeny = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "iam-chaining": {
      title: "Role chaining and access at scale checkpoint",
      sub: "Chained sessions, source identity, session tags and multi-account access models.",
      questions: [
        {
          q: "A pipeline assumes role A with a 12-hour maximum session, then uses those credentials to assume role B. What is the longest session it can get for role B?",
          options: ["12 hours", "1 hour", "36 hours", "Unlimited while role A is valid"],
          answer: 1,
          explain: "Role chaining, meaning assuming a role with credentials that came from another role, caps the new session at one hour regardless of either role's maximum session setting. Long jobs should re-assume from the original identity rather than chain."
        },
        {
          q: "Why set sts:SourceIdentity when a human assumes a role?",
          options: ["It extends the session", "It records who started the session, persists through every chained role, and cannot be changed later in the chain, so CloudTrail shows the human behind each call", "It replaces MFA", "It encrypts the session token"],
          answer: 1,
          explain: "Session names can be set freely at each hop. Source identity is set once, carried through the chain and logged on every call, which makes it the right attribution field for audits. A trust policy can require it with sts:SetSourceIdentity and a condition."
        },
        {
          q: "What does marking a session tag as transitive do?",
          options: ["Makes the tag apply to every account in the organization", "Carries the tag into the next session when the role chains to another role", "Copies the tag onto every resource the session creates", "Makes the tag immutable on the role"],
          answer: 1,
          explain: "Session tags are attributes passed at AssumeRole time, used for ABAC conditions such as aws:PrincipalTag/team. Transitive tags survive role chaining, so a later role in the chain cannot shed or override them."
        },
        {
          q: "A company with 200 accounts wants engineers to reach any account with one sign-in and per-account permissions managed centrally. What is the usual AWS answer?",
          options: ["An IAM user per engineer in every account", "IAM Identity Center permission sets assigned to groups per account, backed by the corporate identity provider", "One shared admin role with the password in a vault", "Resource-based policies on every resource"],
          answer: 1,
          explain: "Identity Center provisions a role per permission set into each assigned account and federates sign-in from the identity provider. Custom cross-account roles remain the pattern for automation, such as a security account scanning every account."
        }
      ]
    },
    "iam-protect": {
      title: "Keys and secrets checkpoint",
      sub: "KMS key policies, grants, envelope encryption, rotation, and secret stores on three clouds.",
      questions: [
        {
          q: "A role in account A has an IAM policy allowing kms:Decrypt on a key in account B. The key policy only contains the account-root statement for account B. What happens?",
          options: ["Allowed, because the IAM policy allows it", "Denied, because the key policy must name account A or its role for cross-account use", "Allowed only from the console", "Allowed if the role has MFA"],
          answer: 1,
          explain: "The account-root statement only enables IAM policies inside the key's own account. Cross-account use needs the key policy to allow the external principal and an IAM policy in the caller's account. A grant is the other route."
        },
        {
          q: "What happens to existing ciphertext when automatic rotation creates new key material for a customer managed KMS key?",
          options: ["It must all be re-encrypted immediately", "It stays readable: KMS keeps older key material for decryption, uses the newest for new encryption, and the key ID and ARN do not change", "It becomes unreadable after 30 days", "Rotation is only possible for AWS managed keys"],
          answer: 1,
          explain: "Rotation adds key material behind the same key ID; decrypt picks the right version from metadata in the ciphertext. That is why rotation is cheap to switch on. It does not help if the key itself is exposed through a bad policy."
        },
        {
          q: "You need database credentials that rotate automatically every 30 days and are replicated to a DR region. Which AWS store fits best?",
          options: ["Parameter Store standard SecureString", "Secrets Manager, with managed or Lambda-based rotation and replica secrets", "An environment variable in the task definition", "An S3 object encrypted with SSE-S3"],
          answer: 1,
          explain: "Secrets Manager has built-in rotation and cross-region replication. Parameter Store SecureString is cheap and fine for configuration and secrets you rotate yourself, but it has no native rotation. Plain environment variables leak into consoles and logs."
        },
        {
          q: "What does an encryption context add when a service calls KMS?",
          options: ["Faster encryption", "Non-secret key-value pairs bound to the ciphertext as additional authenticated data, which must match on decrypt and appear in CloudTrail", "A second key", "Compression"],
          answer: 1,
          explain: "Encryption context ties a ciphertext to its purpose, for example the table or tenant it belongs to. Decrypt fails if the context differs, policies can require specific context values, and audit logs show what was decrypted."
        },
        {
          q: "Which pair is the closest Azure and Google Cloud equivalent of AWS KMS plus Secrets Manager?",
          options: ["Azure Key Vault (keys and secrets) and Google Cloud KMS plus Secret Manager", "Entra ID and Cloud Identity", "Azure Policy and Organization Policy", "Defender for Cloud and Security Command Center"],
          answer: 0,
          explain: "Key Vault holds keys, secrets and certificates in one service, with Managed HSM for dedicated hardware. Google splits key management (Cloud KMS, Cloud HSM) from secret storage (Secret Manager), much like AWS."
        }
      ]
    },
    "iam-policies": {
      title: "Policies and evaluation checkpoint",
      sub: "Principals, policy anatomy, identity versus resource policies, and how AWS decides.",
      questions: [
        {
          q: "A role's identity policy allows s3:GetObject on a bucket. The bucket policy, in the same account, has a Deny for that role on s3:GetObject. What happens?",
          options: [
            "Allowed, because identity policies are evaluated first",
            "Allowed, because the account owns both",
            "Denied, because an explicit deny in any applicable policy overrides every allow",
            "It depends on which policy was attached most recently"
          ],
          answer: 2,
          explain: "AWS checks for a matching explicit Deny across every applicable policy before it looks at allows. If one exists the request is denied, whatever grants exist elsewhere. Attachment order and policy type do not matter for a Deny."
        },
        {
          q: "Same account, no boundary, no session policy: a role has no identity policy for sqs:SendMessage, but the queue's resource policy allows that role's ARN. Result?",
          options: [
            "Implicit deny, because identity policies are mandatory",
            "Allowed, because within one account a resource-based policy grant is sufficient on its own",
            "Explicit deny",
            "Allowed only if an SCP explicitly grants SendMessage"
          ],
          answer: 1,
          explain: "Inside a single account the effective permission is the union of identity and resource-based grants, so either one can provide the Allow. SCPs must permit the action but never grant it. Across accounts the rule changes and both sides must allow."
        },
        {
          q: "A bucket policy in account B grants s3:GetObject to a role in account A. The role's identity policy has no S3 permissions. Result?",
          options: [
            "Allowed, because the resource owner granted it",
            "Implicit deny, because cross-account access needs both the caller's identity policy and the resource policy to allow",
            "Explicit deny",
            "Allowed only for public objects"
          ],
          answer: 1,
          explain: "Across accounts each account controls its own side: B decides who may touch its bucket, A decides what its role may do. The request succeeds only when both agree. A missing identity Allow in A is an implicit deny."
        },
        {
          q: "Which policy element appears in resource-based policies but not in identity-based policies?",
          options: ["Effect", "Condition", "Principal", "Resource"],
          answer: 2,
          explain: "An identity-based policy is attached to a principal, so the principal is implied. A resource-based policy is attached to the resource and must say who it grants to, which is what Principal does. Effect, Action and Condition appear in both."
        },
        {
          q: "Which ARN covers every object inside the S3 bucket named reports?",
          options: [
            "arn:aws:s3:::reports",
            "arn:aws:s3:::reports/*",
            "arn:aws:s3:us-east-1:<ACCOUNT_ID>:reports/*",
            "arn:aws:s3:::*"
          ],
          answer: 1,
          explain: "S3 ARNs omit region and account. The bucket itself is arn:aws:s3:::reports, used for actions like ListBucket, while objects are under arn:aws:s3:::reports/*. Mixing the two is the classic reason a read policy 'does not work'."
        }
      ]
    },
    "iam-roles": {
      title: "Roles, trust and federation checkpoint",
      sub: "AssumeRole, cross-account access, confused deputy, OIDC for CI and human SSO.",
      questions: [
        {
          q: "What does a role's trust policy control?",
          options: [
            "Which actions the role may perform",
            "Which principals are allowed to assume the role",
            "Which regions the role may operate in",
            "How long CloudTrail keeps the role's events"
          ],
          answer: 1,
          explain: "A role has two halves: the trust policy (a resource-based policy on the role) says who may call AssumeRole on it, and the permission policies say what the resulting session may do. Confusing the two is how roles end up assumable by far more principals than intended."
        },
        {
          q: "A SaaS vendor asks you to create a role it can assume, and requires an ExternalId condition. What problem does the ExternalId solve?",
          options: [
            "It encrypts the temporary credentials",
            "It stops the vendor from being tricked into using its access to your role on behalf of a different customer",
            "It replaces MFA for the vendor's employees",
            "It lets the role be assumed without a trust policy"
          ],
          answer: 1,
          explain: "This is the confused-deputy problem: the vendor's account is trusted by many customers, so a malicious customer could give the vendor your role ARN. A unique ExternalId per customer, stored by the vendor and required in your trust policy, means only requests made for your tenant succeed. It is not a secret credential, just a disambiguator."
        },
        {
          q: "You want only workflows on the main branch of acme/payments to assume a deploy role through GitHub OIDC. Which sub condition is correct?",
          options: [
            "StringEquals repo:acme/payments:ref:refs/heads/main",
            "StringLike repo:acme/*",
            "StringEquals acme/payments",
            "No sub condition; checking aud is enough"
          ],
          answer: 0,
          explain: "GitHub's sub claim for a branch run has the form repo:OWNER/REPO:ref:refs/heads/BRANCH, so an exact StringEquals on that value pins it to one repo and branch. An org wildcard admits every repo in the organisation, and checking only aud lets any GitHub repository in. The audience check stays as well."
        },
        {
          q: "Your deploy job adds 'environment: production'. The trust policy pins sub to repo:acme/payments:ref:refs/heads/main. What happens, and why?",
          options: [
            "It still works, because the branch is still main",
            "It fails, because when a job targets an environment the sub claim becomes repo:acme/payments:environment:production",
            "It works, because environments bypass trust policies",
            "It fails, because environments change the audience"
          ],
          answer: 1,
          explain: "GitHub puts the environment in the sub claim instead of the ref when a job uses one. The trust policy must match that form. Pinning to an environment is often the better design, because environments can require reviewers and restrict which branches deploy."
        },
        {
          q: "In IAM Identity Center, what happens when you assign a permission set to a group for three accounts?",
          options: [
            "Long-lived IAM users are created for every group member",
            "A matching IAM role is provisioned in each account, and members sign in to get short-lived credentials for it",
            "The permission set becomes an SCP",
            "Access keys are emailed to each member"
          ],
          answer: 1,
          explain: "Identity Center provisions a role from the permission set in each assigned account and federates users into it with temporary credentials. Nobody gets an IAM user or a long-lived key. Group membership usually syncs from your identity provider through SCIM."
        }
      ]
    },
    "iam-guardrails": {
      title: "Guardrails and multi-cloud identity checkpoint",
      sub: "Boundaries, session policies, ABAC, Azure RBAC and managed identities, Google Cloud IAM and least privilege.",
      questions: [
        {
          q: "What problem are permission boundaries mainly used to solve?",
          options: [
            "Encrypting IAM policies at rest",
            "Letting developers create roles for their apps without being able to create a role more powerful than allowed",
            "Replacing SCPs across the organisation",
            "Rotating access keys automatically"
          ],
          answer: 1,
          explain: "A boundary is a ceiling on what a user or role can ever do, regardless of its policies. Platform teams allow iam:CreateRole only when the new role carries a specific boundary, so delegated role creation cannot escalate privilege. SCPs do a similar job at account level, not per principal."
        },
        {
          q: "Several Azure VMs and a Function App must share one identity that survives if any of them is deleted. Which do you use?",
          options: [
            "A system-assigned managed identity on each resource",
            "A user-assigned managed identity attached to all of them",
            "A service principal with a client secret in app settings",
            "The subscription owner's account"
          ],
          answer: 1,
          explain: "A user-assigned managed identity is a standalone resource you can attach to many resources, and its lifecycle is independent of them. A system-assigned identity is tied one-to-one to its resource and deleted with it. A client secret reintroduces a long-lived credential you must rotate."
        },
        {
          q: "A CI pipeline running outside Google Cloud needs to deploy to a project. What is the recommended way to authenticate?",
          options: [
            "Download a service account JSON key and store it as a CI secret",
            "Use Workload Identity Federation so the pipeline's OIDC token is exchanged for short-lived Google credentials",
            "Grant allUsers the Editor role temporarily",
            "Share a human user's password with the pipeline"
          ],
          answer: 1,
          explain: "Workload Identity Federation trusts the CI provider's OIDC tokens, maps their claims to attributes, and issues short-lived credentials, optionally by impersonating a service account. A JSON key is a long-lived secret that leaks and rarely gets rotated, which is why many organisations block key creation with an org policy."
        },
        {
          q: "You assign the Reader role to a group at an Azure subscription scope. What can the group read?",
          options: [
            "Only the subscription's billing data",
            "Everything in the subscription, because role assignments inherit to resource groups and resources below",
            "Nothing until you also assign it on each resource group",
            "All subscriptions in the tenant"
          ],
          answer: 1,
          explain: "Azure RBAC scopes form a hierarchy: management group, subscription, resource group, resource. An assignment applies at its scope and everything beneath it. That makes high-scope assignments powerful, so prefer the narrowest scope that does the job."
        },
        {
          q: "Forty teams each need access only to resources tagged with their own team. Which AWS approach scales without forty policies?",
          options: [
            "One IAM user per team with an inline policy each",
            "ABAC: one policy whose condition requires aws:PrincipalTag/team to equal aws:ResourceTag/team",
            "An SCP per team",
            "A wildcard policy with Action * and Resource *"
          ],
          answer: 1,
          explain: "Attribute-based access control compares tags on the caller with tags on the resource, so one policy covers every team, including new ones. It only holds if tags are governed: restrict who can set or change the team tag, or anyone can retag their way into another team's resources."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.iam = {
    id: "iam",
    name: "IAM & Workload Identity",
    short: "IAM",
    tagline: "Who can do what, and how to prove it — on three clouds",
    color: "#f59e0b",
    blurb: "Identity is the real perimeter in the cloud. Learn how AWS policies are written and evaluated (explicit deny, SCPs, resource policies, boundaries, session policies), how roles, trust policies and OIDC federation replace long-lived keys, and how the same ideas look in Azure Entra ID, RBAC and managed identities, and in Google Cloud IAM, service accounts and Workload Identity Federation. Finish with a least-privilege workflow you can actually run.",
    modules: [
      {
        id: "policies",
        name: "Principals, Policies & Evaluation",
        icon: "shield",
        lessons: [
          {
            id: "principals-policies",
            title: "Principals and the anatomy of a policy",
            summary: "Who can make a request, and how a JSON policy says what they may do.",
            minutes: 9,
            tags: ["principals", "policy-json", "arn"],
            blocks: [
              { t: "p", html: "Every cloud API call carries four things: a <strong>principal</strong> (who), an <strong>action</strong> (what), a <strong>resource</strong> (on what) and <strong>context</strong> (from where, when, with MFA or not). IAM's only job is to answer yes or no to that tuple. Everything in this track is about writing the rules that produce the right answer." },
              { t: "h", text: "The principals on AWS" },
              { t: "table", headers: ["Principal", "What it is", "Use it for", "Avoid"], rows: [
                ["Root user", "The identity created with the account; full control, cannot be limited by IAM policies", "A handful of account-level tasks", "Daily use, access keys, sharing; SCPs do restrict it in member accounts"],
                ["IAM user", "A long-lived identity with a password and/or access keys", "Rare legacy integrations that cannot federate", "Humans (use SSO) and workloads (use roles)"],
                ["IAM group", "A bag of users for attaching policies", "Grouping the few IAM users you keep", "Expecting it to be a principal — groups cannot be named in a policy's Principal"],
                ["IAM role", "An identity with no long-lived credentials; assumed to get a temporary session", "Workloads, humans via SSO, cross-account access", "Trust policies that let too many principals assume it"],
                ["Federated identity", "A user or workload from an external IdP mapped onto a role", "Workforce SSO, CI pipelines, mobile apps", "Mapping everyone to one broad role"],
                ["Service principal", "An AWS service acting for you, e.g. <code class='tok'>lambda.amazonaws.com</code>", "Letting a service assume your role or write to your bucket", "Granting without <code class='tok'>aws:SourceArn</code> / <code class='tok'>aws:SourceAccount</code> conditions"]
              ] },
              { t: "note", variant: "warn", html: "Protect the root user with phishing-resistant MFA and never create access keys for it. In an organisation you can go further and centrally remove root credentials from member accounts, using privileged root actions from the management side only when needed." },
              { t: "h", text: "Policy JSON anatomy" },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [\n" +
                "    {\n" +
                "      \"Sid\": \"ReadTeamReports\",\n" +
                "      \"Effect\": \"Allow\",\n" +
                "      \"Action\": [\"s3:GetObject\"],\n" +
                "      \"Resource\": \"arn:aws:s3:::acme-reports/finance/*\",\n" +
                "      \"Condition\": {\n" +
                "        \"Bool\": { \"aws:SecureTransport\": \"true\" },\n" +
                "        \"StringEquals\": { \"aws:PrincipalTag/team\": \"finance\" }\n" +
                "      }\n" +
                "    },\n" +
                "    {\n" +
                "      \"Sid\": \"ListOnlyOwnPrefix\",\n" +
                "      \"Effect\": \"Allow\",\n" +
                "      \"Action\": \"s3:ListBucket\",\n" +
                "      \"Resource\": \"arn:aws:s3:::acme-reports\",\n" +
                "      \"Condition\": { \"StringLike\": { \"s3:prefix\": [\"finance/*\"] } }\n" +
                "    }\n" +
                "  ]\n" +
                "}"
              },
              { t: "table", headers: ["Element", "Meaning", "Notes"], rows: [
                ["<code class='tok'>Version</code>", "Policy language version", "Always <code class='tok'>2012-10-17</code>; older versions lack policy variables"],
                ["<code class='tok'>Effect</code>", "Allow or Deny", "Default for anything unmatched is an implicit deny"],
                ["<code class='tok'>Action</code> / <code class='tok'>NotAction</code>", "API operations, <code class='tok'>service:Operation</code>", "Wildcards like <code class='tok'>s3:Get*</code> are allowed; be careful with <code class='tok'>NotAction</code> plus Allow"],
                ["<code class='tok'>Resource</code>", "ARNs the statement applies to", "Some actions only support <code class='tok'>*</code>"],
                ["<code class='tok'>Condition</code>", "Extra tests on request context", "Operators like <code class='tok'>StringEquals</code>, <code class='tok'>ArnLike</code>, <code class='tok'>Bool</code>, <code class='tok'>IpAddress</code>"],
                ["<code class='tok'>Principal</code>", "Who the statement grants to", "Only in resource-based policies (and trust policies)"]
              ] },
              { t: "h", text: "ARNs" },
              { t: "code", lang: "text", code:
                "arn:PARTITION:SERVICE:REGION:ACCOUNT:RESOURCE\n\n" +
                "arn:aws:iam::<ACCOUNT_ID>:role/deploy-payments        # IAM is global: no region\n" +
                "arn:aws:sts::<ACCOUNT_ID>:assumed-role/deploy-payments/gh-run-123   # a role SESSION\n" +
                "arn:aws:s3:::acme-reports                             # bucket: no region, no account\n" +
                "arn:aws:s3:::acme-reports/finance/*                   # objects under a prefix\n" +
                "arn:aws:dynamodb:eu-west-1:<ACCOUNT_ID>:table/orders"
              },
              { t: "note", variant: "trap", html: "Bucket-level actions (<code class='tok'>s3:ListBucket</code>) need the bucket ARN; object actions (<code class='tok'>s3:GetObject</code>) need the <code class='tok'>bucket/*</code> ARN. Putting both actions on only one of the ARNs is the most common 'my policy does not work' bug." },
              { t: "h", text: "The same principals elsewhere" },
              { t: "table", headers: ["Kind", "AWS", "Azure", "Google Cloud"], rows: [
                ["Human", "Identity Center user (or legacy IAM user)", "Entra ID user", "Google account in Cloud Identity / Workspace"],
                ["Group", "Identity Center group (IAM groups are not principals)", "Entra ID security group", "Google group"],
                ["Workload on the platform", "IAM role via instance profile or execution role", "Managed identity", "Service account attached to the resource"],
                ["App registration / external workload", "IAM role trusted via an OIDC or SAML provider", "Service principal (app registration) with federated credential", "Workload identity pool principal"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'access keys in a config file', 'shared admin user', 'the CI has an IAM user' — the fix is almost always a role with temporary credentials, assumed by a federated or platform identity." },
              { t: "note", variant: "key", html: "<strong>Principal, action, resource, context — IAM answers yes or no.</strong> Prefer roles over users, read every statement as Effect + Action + Resource + Condition, and get the ARN shape right." }
            ]
          },
          {
            id: "identity-vs-resource",
            title: "Identity-based versus resource-based policies",
            summary: "Policies attached to who, policies attached to what, and why cross-account access needs both.",
            minutes: 9,
            tags: ["identity-policy", "resource-policy", "cross-account"],
            blocks: [
              { t: "p", html: "There are two places to write a grant. An <strong>identity-based policy</strong> hangs on a principal and says 'this role may do X to Y'. A <strong>resource-based policy</strong> hangs on a resource and says 'principal P may do X to me'. Same language, opposite attachment point — and that difference decides how cross-account access works." },
              { t: "table", headers: ["", "Identity-based", "Resource-based"], rows: [
                ["Attached to", "User, group or role", "Bucket, queue, topic, key, function, secret, role (trust policy)"],
                ["<code class='tok'>Principal</code> element", "Implied (the holder)", "Required"],
                ["Can grant across accounts?", "Only for the caller's side", "Yes — names principals in other accounts"],
                ["Forms", "AWS managed, customer managed, inline", "Inline on the resource only"],
                ["Examples", "Role policy allowing <code class='tok'>dynamodb:PutItem</code>", "Bucket policy, KMS key policy, SQS queue policy, Lambda permission"]
              ] },
              { t: "code", lang: "javascript", code:
                "// Bucket policy in account B: let one role in account A read one prefix\n" +
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [{\n" +
                "    \"Sid\": \"AnalyticsReadsExports\",\n" +
                "    \"Effect\": \"Allow\",\n" +
                "    \"Principal\": { \"AWS\": \"arn:aws:iam::<ACCOUNT_A_ID>:role/analytics-reader\" },\n" +
                "    \"Action\": \"s3:GetObject\",\n" +
                "    \"Resource\": \"arn:aws:s3:::acme-exports/daily/*\"\n" +
                "  }]\n" +
                "}\n" +
                "// ...and account A must ALSO allow s3:GetObject on that ARN in the role's identity policy"
              },
              { t: "h", text: "Managed versus inline" },
              { t: "table", headers: ["Type", "Owned by", "Good for", "Watch for"], rows: [
                ["AWS managed", "AWS", "Quick starts, job-function baselines", "Broad by design; AWS updates them under you"],
                ["Customer managed", "You", "Reusable, versioned, least-privilege policies", "Five versions kept per policy; manage them in IaC"],
                ["Inline", "Embedded in one principal or resource", "Strict one-to-one grants", "Hard to audit at scale"]
              ] },
              { t: "note", variant: "warn", html: "KMS is stricter than most services: a key's <strong>key policy</strong> must allow access (or delegate to IAM via the account principal) even within the same account. An identity policy alone cannot use a key whose policy does not let IAM grant it." },
              { t: "note", variant: "trap", html: "A role's <strong>trust policy</strong> is a resource-based policy whose resource is the role. Its <code class='tok'>Principal</code> decides who can assume the role; its permissions policies decide what the session can do. Review them separately." },
              { t: "h", text: "How the other clouds attach grants" },
              { t: "table", headers: ["Idea", "AWS", "Azure", "Google Cloud"], rows: [
                ["Grant on the principal", "Identity-based policy", "(not the model) — role assignments link principal and scope", "(not the model)"],
                ["Grant on the resource", "Resource-based policy", "Role assignment at the resource scope", "IAM allow policy set on the resource — every Google grant is resource-attached"],
                ["Cross-tenant / cross-org", "Resource policy plus caller identity policy", "Guest users (B2B) or multi-tenant apps in your tenant", "Bind an outside principal directly in your resource's policy (subject to org policy domain restrictions)"]
              ] },
              { t: "table", headers: ["Tier", "Sharing a bucket with another team's account", "Why"], rows: [
                ["Naive", "Make the bucket public 'temporarily'", "Exposes data to the internet; temporary becomes permanent"],
                ["Solid", "Bucket policy naming the other account's role plus that role's identity policy", "Least privilege on both sides, auditable"],
                ["Standout", "As Solid, plus <code class='tok'>aws:PrincipalOrgID</code> conditions, Block Public Access on, and an RCP keeping all buckets inside the organisation's data perimeter", "Even a future policy mistake cannot leak outside the org"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'another account needs to read our bucket', 'a vendor must write to our queue', 'the Lambda must be invoked by S3' — these are resource-policy answers, and cross-account ones need the caller's identity policy too." },
              { t: "note", variant: "key", html: "<strong>Identity policies say what I can do; resource policies say who can touch me.</strong> In one account either can grant; across accounts both must." }
            ]
          },
          {
            id: "evaluation-logic",
            title: "How AWS evaluates a request: explicit deny wins",
            summary: "The order AWS checks deny, organisation policies, resource policies, identity policies, boundaries and session policies.",
            minutes: 11,
            tags: ["policy-evaluation", "explicit-deny", "scp", "boundaries"],
            blocks: [
              { t: "p", html: "Hold three rules and you can work out almost any case: <strong>everything starts denied</strong>; <strong>an explicit Deny anywhere ends the discussion</strong>; and an Allow must exist and then survive every ceiling that applies (SCPs, RCPs, boundaries, session policies). Ceilings never grant — they only cut." },
              { t: "diagram", id: "iam-eval", caption: "AWS policy evaluation: explicit deny, then organisation policies, then resource, boundary, session and identity policies, ending in allow or implicit deny." },
              { t: "ol", items: [
                "<strong>Explicit deny</strong> — any matching Deny in any applicable policy type: final deny.",
                "<strong>RCPs and SCPs</strong> — organisation ceilings on the resource's and the caller's accounts. If they do not allow the action: implicit deny.",
                "<strong>Resource-based policy</strong> — in the same account, a grant here can allow by itself (subject to the nuance below).",
                "<strong>Identity-based policy</strong> — otherwise, an identity Allow is required.",
                "<strong>Permission boundary</strong> — if one is attached, the action must be inside it.",
                "<strong>Session policy</strong> — if one was passed at AssumeRole or federation, the action must be inside it.",
                "Survived everything: <strong>Allow</strong>. Otherwise: <strong>implicit deny</strong>."
              ] },
              { t: "widget", id: "iamPolicyEval" },
              { t: "table", headers: ["Policy type", "Can grant?", "Can limit?", "Applies to"], rows: [
                ["Identity-based", "Yes", "Yes (Deny)", "The principal it is attached to"],
                ["Resource-based", "Yes", "Yes (Deny)", "Principals it names"],
                ["SCP", "No", "Yes — ceiling", "Principals in member accounts (not the management account, not service-linked roles)"],
                ["RCP", "No", "Yes — ceiling", "Resources in member accounts, for supported services"],
                ["Permission boundary", "No", "Yes — ceiling", "One user or role"],
                ["Session policy", "No", "Yes — ceiling", "One session"]
              ] },
              { t: "note", variant: "trap", html: "The same-account nuance: if a resource policy names the <strong>role ARN</strong>, the role's boundary and any session policy still limit it. If it names the <strong>role session ARN</strong> or an <strong>IAM user</strong> directly, an implicit deny in the boundary or session policy does not remove that grant. Most policies name the role ARN, so assume boundaries apply unless you checked." },
              { t: "code", lang: "bash", code:
                "# test a decision before you ship the policy\n" +
                "aws iam simulate-principal-policy \\\n" +
                "  --policy-source-arn arn:aws:iam::<ACCOUNT_ID>:role/deploy-payments \\\n" +
                "  --action-names s3:GetObject \\\n" +
                "  --resource-arns arn:aws:s3:::acme-reports/finance/q3.csv\n\n" +
                "# the simulator covers identity policies and boundaries; it does not model\n" +
                "# every resource policy or SCP, so confirm critical paths with a real call"
              },
              { t: "h", text: "Same idea, different rules elsewhere" },
              { t: "table", headers: ["Question", "AWS", "Azure", "Google Cloud"], rows: [
                ["Default", "Implicit deny", "No access without a role assignment", "No access without a binding"],
                ["Explicit deny", "Deny statements in ordinary policies", "Deny assignments exist but are created by specific features (for example deployment stacks), not by you in custom roles", "IAM deny policies, evaluated before allow policies"],
                ["Inheritance", "SCPs inherit down OUs", "Assignments inherit down scopes", "Allow and deny policies inherit down org, folders, projects"],
                ["Org ceiling", "SCPs / RCPs", "Azure Policy (resource properties), not permissions", "Organization Policy constraints (resource properties) plus deny policies"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'admin can't do X in this account', 'the policy allows it but the call fails' — walk the chain out loud: explicit deny, SCP or RCP, resource policy, identity policy, boundary, session. The first layer that fails is your answer." },
              { t: "quiz", id: "iam-policies" },
              { t: "note", variant: "key", html: "<strong>Start denied, Deny always wins, and an Allow must survive every ceiling.</strong> In one account a resource policy or an identity policy can grant; across accounts both must; SCPs, RCPs, boundaries and session policies only ever cut." }
            ]
          }
        ]
      },
      {
        id: "roles",
        name: "Roles, Trust & Federation",
        icon: "plug",
        lessons: [
          {
            id: "roles-trust",
            title: "Roles, trust policies and cross-account access",
            summary: "AssumeRole end to end, the cross-account patterns, and the confused-deputy problem.",
            minutes: 10,
            tags: ["roles", "sts", "cross-account", "confused-deputy"],
            blocks: [
              { t: "p", html: "A role is a hat. The <strong>trust policy</strong> says who may put it on; the <strong>permission policies</strong> say what you can do while wearing it. Calling <code class='tok'>sts:AssumeRole</code> hands back temporary credentials — an access key, secret and session token — that expire on their own. Nothing long-lived ever exists to leak." },
              { t: "code", lang: "javascript", code:
                "// Trust policy on role 'audit-reader' in the TARGET account\n" +
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [{\n" +
                "    \"Effect\": \"Allow\",\n" +
                "    \"Principal\": { \"AWS\": \"arn:aws:iam::<SECURITY_ACCOUNT_ID>:role/security-automation\" },\n" +
                "    \"Action\": \"sts:AssumeRole\",\n" +
                "    \"Condition\": { \"StringEquals\": { \"aws:PrincipalOrgID\": \"<ORG_ID>\" } }\n" +
                "  }]\n" +
                "}"
              },
              { t: "code", lang: "bash", code:
                "# from the security account (the caller also needs sts:AssumeRole on this ARN)\n" +
                "aws sts assume-role \\\n" +
                "  --role-arn arn:aws:iam::<TARGET_ACCOUNT_ID>:role/audit-reader \\\n" +
                "  --role-session-name weekly-audit \\\n" +
                "  --duration-seconds 3600\n\n" +
                "# better: let the CLI do it via a profile\n" +
                "# [profile audit-target]\n" +
                "# role_arn = arn:aws:iam::<TARGET_ACCOUNT_ID>:role/audit-reader\n" +
                "# source_profile = security"
              },
              { t: "stat", items: [
                { v: "1 h", k: "default role session" },
                { v: "12 h", k: "maximum you can configure" },
                { v: "1 h", k: "cap when chaining roles" },
                { v: "15 min", k: "shortest session" }
              ] },
              { t: "h", text: "Cross-account patterns" },
              { t: "table", headers: ["Pattern", "How it works", "Use when"], rows: [
                ["Assume a role in the target", "Target trusts caller; caller allowed to assume", "Broad or administrative access across accounts; one place to audit"],
                ["Resource-based policy", "Target resource names the caller; caller's identity policy allows", "Narrow data sharing (a bucket, a queue, a key) without switching identity"],
                ["Resource sharing (AWS RAM)", "Share subnets, Transit Gateways, and more with accounts or OUs", "Platform resources many accounts consume"]
              ] },
              { t: "h", text: "The confused-deputy problem" },
              { t: "p", html: "A SaaS vendor's account is trusted by thousands of customer roles. A malicious customer types <em>your</em> role ARN into the vendor's settings page. If your trust policy only checks 'the vendor's account', the vendor — the deputy — dutifully assumes your role on the attacker's behalf. The deputy had the authority; it was simply confused about whose request it was serving." },
              { t: "ol", items: [
                "The vendor generates a unique <strong>ExternalId</strong> per customer tenant and shows it to you.",
                "Your trust policy requires <code class='tok'>sts:ExternalId</code> to equal that value.",
                "The vendor always sends the ExternalId of the tenant making the request, so the attacker's tenant sends the attacker's id and fails your condition."
              ] },
              { t: "code", lang: "javascript", code:
                "\"Condition\": { \"StringEquals\": { \"sts:ExternalId\": \"<VENDOR_ISSUED_TENANT_ID>\" } }"
              },
              { t: "note", variant: "tip", html: "For AWS services acting for you (S3 notifications, SNS, CloudTrail writing to a bucket), the same problem is solved with <code class='tok'>aws:SourceArn</code> and <code class='tok'>aws:SourceAccount</code> conditions, so another customer's resource cannot drive the service into yours." },
              { t: "compare",
                bad: { title: "Trust that is too broad", items: ["Principal is a whole account root with no conditions", "Third-party role with no ExternalId", "Anyone with sts:AssumeRole in the caller account can wear it"] },
                good: { title: "Trust that is pinned", items: ["Principal is one named role", "aws:PrincipalOrgID or ExternalId conditions", "Session name required to identify the human or job"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'a vendor needs access to our account', 'central security tooling scans every account' — role assumption with a pinned trust policy; add ExternalId for third parties." },
              { t: "note", variant: "key", html: "<strong>Trust says who; permissions say what; STS says for how long.</strong> Pin trust to named principals with conditions, and require an ExternalId whenever a third party assumes your role." }
            ]
          },
          {
            id: "role-chaining",
            title: "Role chaining, source identity and access at scale",
            summary: "What happens when roles assume roles, how to keep the human visible through the chain, session tags for ABAC, and how a 200-account estate organizes access.",
            minutes: 10,
            tags: ["role-chaining", "source-identity", "session-tags", "multi-account"],
            blocks: [
              { t: "p", html: "<strong>Role chaining</strong> means using credentials from one assumed role to assume another. It is common: an engineer signs in through Identity Center, lands in a tooling account, and assumes a deploy role in production; a security automation role hops into every member account. Chaining works, but it has rules worth knowing." },
              { t: "table", headers: ["Rule", "Consequence"], rows: [
                ["A chained session lasts at most 1 hour", "Long jobs must re-assume from the original identity, not chain"],
                ["Each hop needs its own trust and permissions", "The caller role needs sts:AssumeRole on the next ARN; the next role's trust policy must name the caller"],
                ["Session names are set per hop", "They are useful labels but not reliable attribution"],
                ["SCPs and boundaries apply at every hop", "A deny in the target account's SCP still blocks the chained session"]
              ] },
              { t: "h", text: "Keeping the human visible: source identity" },
              { t: "p", html: "Set <code class='tok'>sts:SourceIdentity</code> when the first role is assumed (identity providers can pass it from SAML or OIDC). It persists through every chained hop, cannot be changed later in the chain, and is logged on every CloudTrail event, so an auditor can see which person was behind an API call three roles deep." },
              { t: "code", lang: "javascript", code:
                "// Trust policy on 'prod-deploy': allow the tooling role, require source identity\n" +
                "{\n" +
                "  \"Effect\": \"Allow\",\n" +
                "  \"Principal\": { \"AWS\": \"arn:aws:iam::<TOOLING_ACCOUNT_ID>:role/deployer\" },\n" +
                "  \"Action\": [\"sts:AssumeRole\", \"sts:SetSourceIdentity\", \"sts:TagSession\"],\n" +
                "  \"Condition\": {\n" +
                "    \"StringLike\": { \"sts:SourceIdentity\": \"*@corp.example\" },\n" +
                "    \"StringEquals\": { \"aws:PrincipalOrgID\": \"<ORG_ID>\" }\n" +
                "  }\n" +
                "}"
              },
              { t: "h", text: "Session tags and ABAC" },
              { t: "p", html: "<strong>Session tags</strong> are key-value attributes passed at assume time, often from the identity provider (department, team, cost centre). Permission policies can compare them with resource tags, for example allow access only when <code class='tok'>aws:ResourceTag/team</code> equals <code class='tok'>aws:PrincipalTag/team</code>. Mark tags <strong>transitive</strong> so they survive chaining and cannot be dropped by a later hop." },
              { t: "h", text: "Organizing access across many accounts" },
              { t: "table", headers: ["Need", "AWS", "Azure", "Google Cloud"], rows: [
                ["Humans into many accounts", "IAM Identity Center permission sets assigned per account and group", "Entra ID groups with RBAC at management group or subscription scope; PIM for elevation", "Google groups with IAM bindings at folder or project; just-in-time access tooling"],
                ["Automation into every account", "A role deployed into every account (StackSets or the landing zone), trusted by one central role", "A managed identity with RBAC at management group scope", "A service account with roles at folder or organization scope"],
                ["Managing a customer's tenant", "Cross-account role with ExternalId", "Azure Lighthouse delegated resource management", "Cross-organization IAM bindings or service account impersonation"],
                ["Chained identities", "Role chaining (1 h cap)", "Usually unnecessary: one identity, many scopes", "Service account impersonation with delegate chains"]
              ] },
              { t: "note", variant: "tip", html: "Azure and Google Cloud rarely need chaining because one identity can hold roles at many scopes in the hierarchy. On AWS each account is a separate IAM namespace, so crossing accounts always means a role in the target." },
              { t: "compare",
                bad: { title: "Hop-heavy access", items: ["Four chained roles to reach production", "Session names used as the only attribution", "Hour-long jobs fail when the chained session expires"] },
                good: { title: "Designed access", items: ["Identity Center lands humans directly in the target account", "Source identity required on sensitive roles", "Automation assumes directly from its own workload identity"] } },
              { t: "quiz", id: "iam-chaining" },
              { t: "note", variant: "key", html: "<strong>Chain sparingly and keep the human visible.</strong> Chained sessions cap at one hour, source identity survives the chain for audit, transitive session tags carry ABAC attributes, and Identity Center or a direct workload role usually removes the need for extra hops." }
            ]
          },
          {
            id: "oidc-ci",
            title: "OIDC federation for CI: no long-lived keys",
            summary: "Let a GitHub Actions job assume an AWS role with a signed token, and pin it with sub and aud conditions.",
            minutes: 10,
            tags: ["oidc", "github-actions", "federation", "ci-cd"],
            blocks: [
              { t: "p", html: "The old way to deploy from CI was an IAM user's access key stored as a pipeline secret: long-lived, copied into logs, rarely rotated. The modern way is <strong>OIDC federation</strong>. The CI platform signs a short-lived token describing exactly which repo, branch and job is running; AWS verifies it and exchanges it for temporary role credentials. There is no secret to steal." },
              { t: "ol", items: [
                "Register GitHub's OIDC issuer as an <strong>IAM OIDC identity provider</strong> in the account (audience <code class='tok'>sts.amazonaws.com</code>).",
                "Create a role whose trust policy allows <code class='tok'>sts:AssumeRoleWithWebIdentity</code> from that provider, with conditions on the token's <code class='tok'>aud</code> and <code class='tok'>sub</code> claims.",
                "In the workflow, grant the job <code class='tok'>id-token: write</code> so it can request a token.",
                "The job presents the token to STS and receives credentials for, typically, one hour."
              ] },
              { t: "code", lang: "text", code:
                "# .github/workflows/deploy.yml (excerpt)\n" +
                "permissions:\n" +
                "  id-token: write      # allow this job to request an OIDC token\n" +
                "  contents: read\n" +
                "jobs:\n" +
                "  deploy:\n" +
                "    runs-on: ubuntu-latest\n" +
                "    environment: production\n" +
                "    steps:\n" +
                "      - uses: actions/checkout@v4\n" +
                "      - uses: aws-actions/configure-aws-credentials@v4\n" +
                "        with:\n" +
                "          role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/gh-deploy-payments\n" +
                "          aws-region: eu-west-1\n" +
                "      - run: ./scripts/deploy.sh"
              },
              { t: "code", lang: "javascript", code:
                "// Trust policy on gh-deploy-payments\n" +
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [{\n" +
                "    \"Effect\": \"Allow\",\n" +
                "    \"Principal\": {\n" +
                "      \"Federated\": \"arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com\"\n" +
                "    },\n" +
                "    \"Action\": \"sts:AssumeRoleWithWebIdentity\",\n" +
                "    \"Condition\": {\n" +
                "      \"StringEquals\": {\n" +
                "        \"token.actions.githubusercontent.com:aud\": \"sts.amazonaws.com\",\n" +
                "        \"token.actions.githubusercontent.com:sub\": \"repo:acme/payments:environment:production\"\n" +
                "      }\n" +
                "    }\n" +
                "  }]\n" +
                "}"
              },
              { t: "widget", id: "iamOidcTrust" },
              { t: "table", headers: ["Workflow context", "sub claim GitHub issues"], rows: [
                ["Push to a branch", "<code class='tok'>repo:acme/payments:ref:refs/heads/main</code>"],
                ["Tag", "<code class='tok'>repo:acme/payments:ref:refs/tags/v1.4.0</code>"],
                ["Pull request", "<code class='tok'>repo:acme/payments:pull_request</code>"],
                ["Job using an environment", "<code class='tok'>repo:acme/payments:environment:production</code> (replaces the ref form)"]
              ] },
              { t: "note", variant: "warn", html: "A trust policy that checks only <code class='tok'>aud</code>, or uses a broad wildcard such as <code class='tok'>repo:acme/*</code>, lets any matching repository's workflow assume the role — with no sub check at all, that means any repository on GitHub. Some platforms now reject trust policies for well-known issuers that lack a sub condition, but treat that as a safety net, never as your design." },
              { t: "table", headers: ["Tier", "CI credentials", "Why"], rows: [
                ["Naive", "IAM user access key in a pipeline secret", "Long-lived, shared, leaks through logs and forks"],
                ["Solid", "OIDC role pinned to repo and branch", "No stored secret; credentials expire in an hour"],
                ["Standout", "OIDC role pinned to a protected <em>environment</em> with required reviewers, separate roles per environment, permissions scoped to the deploy, and CloudTrail alerts on use outside that path", "Deploy rights follow your change-approval process, not repository access"]
              ] },
              { t: "h", text: "The same pattern on Azure and Google Cloud" },
              { t: "table", headers: ["Step", "AWS", "Azure", "Google Cloud"], rows: [
                ["Trust the issuer", "IAM OIDC identity provider", "Federated identity credential on an app registration or user-assigned managed identity", "Workload identity pool + OIDC provider"],
                ["Pin the workload", "<code class='tok'>sub</code> / <code class='tok'>aud</code> conditions", "Subject identifier must match exactly (flexible matching is limited)", "Attribute mapping plus an attribute condition (CEL)"],
                ["Default audience", "<code class='tok'>sts.amazonaws.com</code>", "<code class='tok'>api://AzureADTokenExchange</code>", "The provider's full resource name"],
                ["What you get", "Temporary role credentials", "An Entra access token for the identity", "A federated token, often used to impersonate a service account"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'CI deploys with an access key', 'rotate pipeline secrets', 'a fork could trigger the deploy' — replace keys with OIDC federation and pin the subject to a repo plus branch or environment." },
              { t: "note", variant: "key", html: "<strong>Trade the stored key for a signed, short-lived token, and pin the subject.</strong> Check aud and an exact sub — ideally a protected environment — and treat wildcards as a finding." }
            ]
          },
          {
            id: "humans-sso",
            title: "Human access with IAM Identity Center",
            summary: "Single sign-on to every account with permission sets, group sync and short-lived credentials.",
            minutes: 8,
            tags: ["identity-center", "sso", "permission-sets", "scim"],
            blocks: [
              { t: "p", html: "Humans should never hold IAM users in a multi-account estate. <strong>IAM Identity Center</strong> lets people sign in once with the company identity provider and pick an account and a role. It is the workforce half of the 'no long-lived credentials' rule; OIDC federation is the workload half." },
              { t: "ol", items: [
                "Connect an identity source: an external IdP such as Entra ID, Okta or Google over SAML, with users and groups synced by <strong>SCIM</strong> — or Identity Center's own directory for small setups.",
                "Define <strong>permission sets</strong>: a template of managed and inline policies, an optional boundary, and a session duration.",
                "Assign <em>group + permission set + accounts</em>. Identity Center provisions a matching role (named <code class='tok'>AWSReservedSSO_...</code>) in each account.",
                "Users sign in to the access portal or CLI and receive temporary credentials for that role."
              ] },
              { t: "code", lang: "bash", code:
                "# one-time profile setup (prompts for the start URL and region)\n" +
                "aws configure sso --profile payments-prod-readonly\n\n" +
                "# daily: browser sign-in, then short-lived credentials are cached\n" +
                "aws sso login --profile payments-prod-readonly\n" +
                "aws s3 ls --profile payments-prod-readonly"
              },
              { t: "table", headers: ["Need", "AWS", "Azure", "Google Cloud"], rows: [
                ["Workforce sign-in", "IAM Identity Center (often federated to an IdP)", "Entra ID is the IdP", "Cloud Identity / Workspace, or federation from another IdP"],
                ["Group sync", "SCIM from the IdP", "Native groups (or sync from on-prem AD with Entra Connect)", "Google Cloud Directory Sync or SCIM from the IdP"],
                ["Just-in-time elevation", "Temporary elevated access patterns layered on Identity Center", "Privileged Identity Management (PIM)", "Privileged Access Manager (PAM)"],
                ["CLI sign-in", "<code class='tok'>aws sso login</code>", "<code class='tok'>az login</code>", "<code class='tok'>gcloud auth login</code>"]
              ] },
              { t: "compare",
                bad: { title: "IAM users per human per account", items: ["Passwords and keys to rotate everywhere", "Leavers keep access until someone notices", "No central view of who can reach what"] },
                good: { title: "Identity Center with an IdP", items: ["One sign-in, MFA enforced at the IdP", "Disable in the IdP and access ends everywhere", "Assignments reviewable per group and account"] } },
              { t: "note", variant: "warn", html: "Keep a documented <strong>break-glass</strong> path for when the IdP or Identity Center is unavailable: a small number of tightly monitored emergency roles or users with hardware MFA, credentials in a sealed process, and alerts on every use." },
              { t: "note", variant: "tip", html: "Design permission sets around job functions (read-only, developer, operator, security auditor), not around individuals, and keep session durations short for write-capable sets. Fewer, well-named sets make access reviews a ten-minute job instead of a week." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'engineers have IAM users', 'offboarding takes days', 'we need MFA everywhere' — move humans to Identity Center federated with the corporate IdP and grant by group." },
              { t: "quiz", id: "iam-roles" },
              { t: "note", variant: "key", html: "<strong>Humans sign in through the IdP; workloads federate through OIDC; nobody holds a long-lived key.</strong> Permission sets become roles in each account, granted by group, with a break-glass path for emergencies." }
            ]
          }
        ]
      },
      {
        id: "guardrails",
        name: "Guardrails & Multi-Cloud Identity",
        icon: "blocks",
        lessons: [
          {
            id: "guardrails",
            title: "SCPs, RCPs, permission boundaries, session policies and ABAC",
            summary: "The ceilings that limit what grants can do, and tag-based access that scales past role-per-team.",
            minutes: 10,
            tags: ["scp", "rcp", "permission-boundary", "session-policy", "abac"],
            blocks: [
              { t: "p", html: "Grants answer 'what may this principal do'. <strong>Guardrails</strong> answer 'what may anyone here ever do, no matter what someone grants'. They are your protection against the inevitable over-broad policy. Each one sits at a different level." },
              { t: "table", headers: ["Control", "Attaches to", "Caps", "Typical use"], rows: [
                ["SCP", "Root, OU or account", "Every principal in member accounts", "Deny leaving the org, disabling logs, unapproved regions"],
                ["RCP", "Root, OU or account", "Access to resources in member accounts (supported services such as S3, KMS, STS, SQS, Secrets Manager)", "Data perimeter: no principal outside the org can use our resources"],
                ["Permission boundary", "One user or role", "That principal", "Safe delegation of role creation"],
                ["Session policy", "One assumed-role or federated session", "That session", "Scope down a broad role for one task or one tenant"]
              ] },
              { t: "h", text: "Permission boundaries for safe delegation" },
              { t: "p", html: "Developers want to create roles for their own Lambdas without a ticket. The danger is that they create a role more powerful than themselves. The answer: allow <code class='tok'>iam:CreateRole</code> only when the new role carries an approved boundary, and deny removing it." },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [\n" +
                "    {\n" +
                "      \"Sid\": \"CreateRolesOnlyWithBoundary\",\n" +
                "      \"Effect\": \"Allow\",\n" +
                "      \"Action\": [\"iam:CreateRole\", \"iam:PutRolePolicy\", \"iam:AttachRolePolicy\"],\n" +
                "      \"Resource\": \"arn:aws:iam::<ACCOUNT_ID>:role/app-*\",\n" +
                "      \"Condition\": {\n" +
                "        \"StringEquals\": {\n" +
                "          \"iam:PermissionsBoundary\": \"arn:aws:iam::<ACCOUNT_ID>:policy/app-boundary\"\n" +
                "        }\n" +
                "      }\n" +
                "    },\n" +
                "    {\n" +
                "      \"Sid\": \"NeverRemoveTheBoundary\",\n" +
                "      \"Effect\": \"Deny\",\n" +
                "      \"Action\": [\"iam:DeleteRolePermissionsBoundary\", \"iam:CreatePolicyVersion\"],\n" +
                "      \"Resource\": [\"arn:aws:iam::<ACCOUNT_ID>:role/app-*\",\n" +
                "                   \"arn:aws:iam::<ACCOUNT_ID>:policy/app-boundary\"]\n" +
                "    }\n" +
                "  ]\n" +
                "}"
              },
              { t: "h", text: "Session policies" },
              { t: "p", html: "When you call <code class='tok'>AssumeRole</code> you can pass an inline or managed <strong>session policy</strong>. The session gets the intersection of the role's permissions and that policy. A common use is a multi-tenant service that assumes one broad role but passes a policy restricting the session to <code class='tok'>tenant-42/*</code> for each request." },
              { t: "h", text: "ABAC: grant by matching tags" },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"Effect\": \"Allow\",\n" +
                "  \"Action\": [\"ec2:StartInstances\", \"ec2:StopInstances\"],\n" +
                "  \"Resource\": \"*\",\n" +
                "  \"Condition\": {\n" +
                "    \"StringEquals\": { \"aws:ResourceTag/team\": \"${aws:PrincipalTag/team}\" }\n" +
                "  }\n" +
                "}"
              },
              { t: "compare",
                bad: { title: "Role per team (RBAC only)", items: ["Forty teams, forty near-identical policies", "Every new team is a policy change", "Policies drift apart over time"] },
                good: { title: "ABAC", items: ["One policy, tag comparison does the scoping", "New teams work as soon as they are tagged", "Requires strict control of who can set tags"] } },
              { t: "note", variant: "trap", html: "ABAC is only as strong as tag governance. If a developer can run <code class='tok'>ec2:CreateTags</code> on any instance or change their own session tags, they can retag their way into another team's resources. Deny tag changes on the <code class='tok'>team</code> key except through the platform pipeline, and set principal tags from the IdP." },
              { t: "p", html: "Elsewhere: Azure supports ABAC through <strong>role assignment conditions</strong> (initially for Storage blobs and queues), and Google Cloud uses <strong>IAM Conditions</strong> on bindings, which can test resource tags, names and request time." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'developers need to create roles without becoming admin' means boundaries; 'one role serves many tenants' means session policies; 'dozens of teams, same access shape' means ABAC; 'nothing must leave the org' means SCPs plus RCPs." },
              { t: "note", variant: "key", html: "<strong>Grants say what; guardrails say what never.</strong> SCPs and RCPs cap accounts, boundaries cap principals, session policies cap sessions, and ABAC lets one policy scale across teams — if tags are governed." }
            ]
          },
          {
            id: "azure-identity",
            title: "Azure: Entra ID, RBAC scopes and managed identities",
            summary: "Principals in the tenant, role assignments at scopes, and credential-free identity for workloads.",
            minutes: 10,
            tags: ["azure", "entra-id", "rbac", "managed-identity", "workload-identity"],
            blocks: [
              { t: "p", html: "Azure's model is different from AWS at its root. Identity lives in one <strong>Microsoft Entra ID tenant</strong>, shared by every subscription under it. Permissions are not JSON documents on principals but <strong>role assignments</strong>: a principal, a role definition, and a scope, glued together." },
              { t: "table", headers: ["Principal", "What it is", "AWS analogue"], rows: [
                ["User", "A person in the tenant (or a B2B guest)", "Identity Center user"],
                ["Group", "Security group; assign roles to groups, not people", "Identity Center group"],
                ["Service principal", "The tenant-local identity of an app registration", "IAM role trusted by an external identity"],
                ["Managed identity", "A service principal Azure creates and rotates for a resource", "Instance profile or execution role"]
              ] },
              { t: "h", text: "Role assignment = principal + role + scope" },
              { t: "table", headers: ["Scope", "Example", "Inherits to"], rows: [
                ["Management group", "<code class='tok'>/providers/Microsoft.Management/managementGroups/workloads</code>", "Every subscription below"],
                ["Subscription", "<code class='tok'>/subscriptions/&lt;SUBSCRIPTION_ID&gt;</code>", "All resource groups and resources"],
                ["Resource group", "<code class='tok'>.../resourceGroups/rg-payments-prod</code>", "Resources in the group"],
                ["Resource", "<code class='tok'>.../storageAccounts/stpaymentsprod</code>", "Only that resource"]
              ] },
              { t: "code", lang: "bash", code:
                "# grant a group read access to one resource group\n" +
                "az role assignment create \\\n" +
                "  --assignee-object-id <GROUP_OBJECT_ID> --assignee-principal-type Group \\\n" +
                "  --role \"Reader\" \\\n" +
                "  --scope /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-payments-prod"
              },
              { t: "table", headers: ["Built-in role", "Can do", "Note"], rows: [
                ["Owner", "Everything, including granting access", "Treat like account admin; keep assignments few and eligible via PIM"],
                ["Contributor", "Create and manage resources, but not grant access", "Still very broad — can read many secrets via resource APIs"],
                ["Reader", "View resources", "Does not include data-plane access such as blob contents"],
                ["User Access Administrator", "Manage role assignments", "Privilege-escalation path; guard it"]
              ] },
              { t: "note", variant: "trap", html: "Two separate role systems live in Azure: <strong>Entra roles</strong> (Global Administrator, User Administrator) govern the directory, and <strong>Azure RBAC roles</strong> govern resources. A Global Administrator can elevate themselves to manage all subscriptions, so the tenant's top role is effectively the keys to everything." },
              { t: "note", variant: "warn", html: "Azure RBAC is additive. <code class='tok'>NotActions</code> in a role definition only subtracts from that role's own grant; it is not a deny, and another assignment can still grant the action. True deny assignments exist but are created by specific platform features, not by custom roles." },
              { t: "h", text: "Managed identities" },
              { t: "table", headers: ["", "System-assigned", "User-assigned"], rows: [
                ["Lifecycle", "Created and deleted with its resource", "A standalone resource you manage"],
                ["Sharing", "One resource only", "Attach to many resources"],
                ["Good for", "A single app that owns its identity", "Fleets, scale sets, pre-granted access before deploy, federation targets"]
              ] },
              { t: "h", text: "Workload identity federation" },
              { t: "p", html: "For workloads outside Azure (GitHub Actions, another cloud, Kubernetes), add a <strong>federated identity credential</strong> to an app registration or a user-assigned managed identity. Azure trusts tokens from that issuer with that exact subject and audience, and no client secret ever exists. AKS uses the same mechanism for pods (AKS workload identity)." },
              { t: "code", lang: "bash", code:
                "az identity federated-credential create \\\n" +
                "  --name gh-payments-prod \\\n" +
                "  --identity-name id-payments-deploy \\\n" +
                "  --resource-group rg-identity \\\n" +
                "  --issuer <GITHUB_OIDC_ISSUER> \\\n" +
                "  --subject repo:acme/payments:environment:production \\\n" +
                "  --audiences api://AzureADTokenExchange"
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'client secret in app settings', 'service principal password expired and broke prod' — use a managed identity inside Azure and a federated credential outside it." },
              { t: "note", variant: "key", html: "<strong>On Azure, access is principal + role + scope, inherited downward.</strong> Assign to groups at the narrowest scope, guard Owner and User Access Administrator, and replace secrets with managed identities and federated credentials." }
            ]
          },
          {
            id: "gcp-identity",
            title: "Google Cloud: IAM bindings, service accounts and Workload Identity",
            summary: "Principals, basic versus predefined versus custom roles, inherited allow policies, and why service account keys are an anti-pattern.",
            minutes: 10,
            tags: ["gcp", "iam", "service-accounts", "workload-identity-federation", "gke"],
            blocks: [
              { t: "p", html: "Google Cloud IAM is one idea applied everywhere: every resource has an <strong>allow policy</strong> made of <strong>bindings</strong>, each binding is <em>role → list of principals</em>, optionally with a condition. Policies set on the organisation, a folder or a project inherit down to every resource beneath. Effective access is the union of all of them." },
              { t: "table", headers: ["Principal", "Format", "Notes"], rows: [
                ["Google account", "<code class='tok'>user:ana@acme.example</code>", "A human in Cloud Identity or Workspace"],
                ["Google group", "<code class='tok'>group:payments-devs@acme.example</code>", "Grant to groups, not people"],
                ["Service account", "<code class='tok'>serviceAccount:deployer@&lt;PROJECT_ID&gt;.iam.gserviceaccount.com</code>", "A workload identity; also a resource others can be allowed to impersonate"],
                ["Domain", "<code class='tok'>domain:acme.example</code>", "Everyone in the organisation's domain"],
                ["Federated identity", "<code class='tok'>principal://...</code> / <code class='tok'>principalSet://...</code>", "Workload or workforce identity pool members"],
                ["Public", "<code class='tok'>allUsers</code>, <code class='tok'>allAuthenticatedUsers</code>", "Public access — block with org policy unless intended"]
              ] },
              { t: "table", headers: ["Role type", "Example", "Use"], rows: [
                ["Basic", "Owner, Editor, Viewer", "Avoid in production — far too broad (Editor can change most resources)"],
                ["Predefined", "<code class='tok'>roles/storage.objectViewer</code>, <code class='tok'>roles/run.developer</code>", "Default choice; maintained by Google"],
                ["Custom", "<code class='tok'>projects/&lt;PROJECT_ID&gt;/roles/reportReader</code>", "When predefined roles are too broad; you maintain the permission list"]
              ] },
              { t: "code", lang: "bash", code:
                "# bind a predefined role to a group on one project\n" +
                "gcloud projects add-iam-policy-binding <PROJECT_ID> \\\n" +
                "  --member=\"group:payments-devs@acme.example\" \\\n" +
                "  --role=\"roles/run.developer\"\n\n" +
                "# narrower: bind on a single bucket instead of the whole project\n" +
                "gcloud storage buckets add-iam-policy-binding gs://acme-reports \\\n" +
                "  --member=\"group:finance@acme.example\" --role=\"roles/storage.objectViewer\""
              },
              { t: "note", variant: "tip", html: "Google Cloud also has <strong>IAM deny policies</strong>, evaluated before allow policies and inherited down the hierarchy — the closest thing to an AWS explicit Deny. Use them sparingly for permissions that must never be used, such as deleting the logging project." },
              { t: "h", text: "Service accounts and the key problem" },
              { t: "p", html: "A service account is how a workload authenticates. Attached to a VM, Cloud Run service or function, it gets short-lived tokens from the metadata server automatically. The anti-pattern is a downloaded <strong>service account key</strong>: a JSON file containing a private key that is valid until someone deletes it." },
              { t: "note", variant: "warn", html: "Service account keys leak through repos, laptops and CI logs, and are rarely rotated. Block their creation with the organisation policy constraint <code class='tok'>iam.disableServiceAccountKeyCreation</code> (enforced by default in newer organisations) and use attached service accounts, impersonation or Workload Identity Federation instead." },
              { t: "h", text: "Workload Identity Federation" },
              { t: "p", html: "For workloads outside Google Cloud, create a <strong>workload identity pool</strong> and a <strong>provider</strong> that trusts an external issuer. Attribute mappings turn token claims into Google attributes, and an attribute condition rejects tokens that do not match — the equivalent of an AWS sub condition." },
              { t: "code", lang: "bash", code:
                "gcloud iam workload-identity-pools providers create-oidc github \\\n" +
                "  --project=<PROJECT_ID> --location=global \\\n" +
                "  --workload-identity-pool=ci-pool \\\n" +
                "  --issuer-uri=\"<GITHUB_OIDC_ISSUER>\" \\\n" +
                "  --attribute-mapping=\"google.subject=assertion.sub,attribute.repository=assertion.repository\" \\\n" +
                "  --attribute-condition=\"assertion.repository == 'acme/payments' && assertion.ref == 'refs/heads/main'\""
              },
              { t: "h", text: "GKE Workload Identity" },
              { t: "p", html: "Inside GKE, Workload Identity Federation for GKE gives each Kubernetes service account its own IAM principal, so pods get Google credentials without node-wide service accounts or keys. You grant roles directly to that principal (or let it impersonate a Google service account):" },
              { t: "code", lang: "text", code:
                "principal://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/\n" +
                "  workloadIdentityPools/<PROJECT_ID>.svc.id.goog/subject/ns/payments/sa/api"
              },
              { t: "table", headers: ["Tier", "How a workload gets cloud credentials", "Why"], rows: [
                ["Naive", "Long-lived key file (AWS access key, Azure client secret, Google JSON key) in config", "Valid until revoked; leaks are silent"],
                ["Solid", "Platform identity: IAM role, managed identity, attached service account", "Short-lived tokens issued and rotated by the platform"],
                ["Standout", "Platform identity inside the cloud, federation for everything outside it, one identity per workload, and org policy blocking key creation", "No long-lived secrets exist anywhere to leak"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'service account key in a repo', 'pods share the node's identity', 'CI on another cloud deploys to Google Cloud' — attached service accounts, GKE Workload Identity and Workload Identity Federation, with key creation blocked." },
              { t: "note", variant: "key", html: "<strong>On Google Cloud, bindings on resources inherit down the tree, and keys are the anti-pattern.</strong> Prefer predefined roles at the narrowest level, attached service accounts inside, and Workload Identity Federation outside." }
            ]
          },
          {
            id: "least-privilege",
            title: "A least-privilege workflow that actually ships",
            summary: "Start bounded, observe real usage, generate and tighten policies, and keep elevated access just-in-time.",
            minutes: 9,
            tags: ["least-privilege", "access-analyzer", "pim", "iam-recommender"],
            blocks: [
              { t: "p", html: "Nobody writes a perfect least-privilege policy on day one. The realistic model is a <strong>loop</strong>: grant a bounded starting set, watch what is actually used, tighten to that, and repeat as the workload changes. The tools on each cloud exist to make the 'watch' and 'tighten' steps cheap." },
              { t: "ol", items: [
                "<strong>Bound first</strong>: start new workloads with a scoped managed policy inside a permission boundary or a sandbox account, never with admin.",
                "<strong>Observe</strong>: run the workload through its real cycle, including monthly or quarterly jobs.",
                "<strong>Generate</strong>: produce a policy from logged activity, then review it by hand (generated policies often need resource ARNs narrowed).",
                "<strong>Remove</strong>: drop unused services, roles and principals flagged by last-accessed data.",
                "<strong>Watch for exposure</strong>: alert on any new grant to principals outside your organisation.",
                "<strong>Elevate just in time</strong>: humans get standing read-only access and request time-bound write access with approval."
              ] },
              { t: "table", headers: ["Step", "AWS", "Azure", "Google Cloud"], rows: [
                ["Find external exposure", "IAM Access Analyzer external access findings", "Defender for Cloud recommendations, Entra access reviews for guests", "Policy Analyzer, Security Command Center findings"],
                ["Find unused access", "Access Analyzer unused access findings; last-accessed information", "Entra access reviews; Defender CIEM (permissions management)", "IAM recommender role recommendations"],
                ["Generate a policy", "Access Analyzer policy generation from CloudTrail", "(no direct generator; derive from Activity Log usage)", "Recommender suggests smaller predefined or custom roles"],
                ["Validate before deploy", "Access Analyzer policy validation and custom policy checks in CI", "What-if deployments, Azure Policy", "Policy Troubleshooter, Policy Simulator"],
                ["Just-in-time elevation", "Identity Center with a temporary elevated access workflow", "Privileged Identity Management (PIM)", "Privileged Access Manager (PAM)"]
              ] },
              { t: "code", lang: "bash", code:
                "# AWS: which services has this role actually used?\n" +
                "JOB=$(aws iam generate-service-last-accessed-details \\\n" +
                "  --arn arn:aws:iam::<ACCOUNT_ID>:role/app-orders --query JobId --output text)\n" +
                "aws iam get-service-last-accessed-details --job-id \"$JOB\" \\\n" +
                "  --query \"ServicesLastAccessed[?TotalAuthenticatedEntities==\\`0\\`].ServiceNamespace\"\n\n" +
                "# Google Cloud: role recommendations for a project\n" +
                "gcloud recommender recommendations list \\\n" +
                "  --project=<PROJECT_ID> --location=global \\\n" +
                "  --recommender=google.iam.policy.Recommender"
              },
              { t: "note", variant: "warn", html: "Usage-based tightening has blind spots: a quarterly report job or a disaster-recovery runbook may not appear in the observation window (Google's recommender, for example, looks back about 90 days). Tag roles that serve rare paths and test them before removing permissions." },
              { t: "table", headers: ["Tier", "Least-privilege practice", "Why"], rows: [
                ["Naive", "Grant admin now, 'tighten later'", "Later never comes; every incident has maximum blast radius"],
                ["Solid", "Scoped policies per workload, quarterly reviews using last-accessed data", "Drift is caught, but slowly and by hand"],
                ["Standout", "Policy validation in CI, generated-then-reviewed policies, automated unused-access findings with owners, external-access alerts, and JIT elevation for humans", "Least privilege becomes a pipeline property, not a yearly project"]
              ] },
              { t: "compare",
                bad: { title: "Standing privilege", items: ["Engineers hold Owner or admin all day", "A phished session can do anything", "Audit shows who could act, not who did"] },
                good: { title: "Just-in-time elevation", items: ["Read-only by default, write access requested with a reason", "Time-bound (for example one to four hours) and approved", "Every elevation logged and reviewable"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'everyone has admin', 'how do we know what permissions it needs?', 'auditors want to see who can access production' — describe the loop: bound, observe, generate, remove, alert, elevate just in time." },
              { t: "quiz", id: "iam-guardrails" },
              { t: "note", variant: "key", html: "<strong>Least privilege is a loop, not a document.</strong> Bound the start, tighten from observed usage with each cloud's analyzer or recommender, alert on external access, and make human write access just-in-time." }
            ]
          }
        ]
      },
      {
        id: "protect",
        name: "Keys & Secrets",
        icon: "diamond",
        lessons: [
          {
            id: "kms",
            title: "KMS: key policies, grants, envelope encryption and rotation",
            summary: "Key types, why the key policy is the root of access, cross-account use, grants, encryption context, rotation and deletion, with Key Vault and Cloud KMS alongside.",
            minutes: 12,
            tags: ["kms", "key-policy", "grants", "envelope-encryption", "rotation"],
            blocks: [
              { t: "p", html: "A key management service holds keys you never see in plain form and performs cryptographic operations on your behalf. Its real job is <strong>access control and audit</strong>: whoever can call <code class='tok'>kms:Decrypt</code> on a key can read everything encrypted under it, and every call is logged." },
              { t: "h", text: "Key types on AWS" },
              { t: "table", headers: ["Type", "Who controls the policy", "Rotation", "Use when"], rows: [
                ["AWS owned", "AWS, invisible to you", "AWS", "Default encryption you do not need to govern"],
                ["AWS managed (aws/s3, aws/ebs ...)", "AWS; you can view but not edit", "Automatic, yearly", "Quick start; cannot be shared cross-account"],
                ["Customer managed", "You", "Optional automatic (period configurable) or on demand", "Anything regulated, shared across accounts, or needing a deny-able kill switch"]
              ] },
              { t: "h", text: "The key policy is the root of access" },
              { t: "p", html: "Unlike most AWS resources, a KMS key is unusable unless its <strong>key policy</strong> allows the access. IAM policies only work if the key policy delegates to them with the account-root statement. Cross-account use needs both sides: the key policy names the external principal, and the caller's IAM policy allows the operation." },
              { t: "code", lang: "javascript", code:
                "// Key policy (excerpt) for a customer managed key in the data account\n" +
                "{\n" +
                "  \"Statement\": [\n" +
                "    { \"Sid\": \"EnableIAMPolicies\", \"Effect\": \"Allow\",\n" +
                "      \"Principal\": { \"AWS\": \"arn:aws:iam::<DATA_ACCOUNT_ID>:root\" },\n" +
                "      \"Action\": \"kms:*\", \"Resource\": \"*\" },\n" +
                "    { \"Sid\": \"AppDecryptViaS3Only\", \"Effect\": \"Allow\",\n" +
                "      \"Principal\": { \"AWS\": \"arn:aws:iam::<APP_ACCOUNT_ID>:role/orders-app\" },\n" +
                "      \"Action\": [\"kms:Decrypt\", \"kms:GenerateDataKey\"], \"Resource\": \"*\",\n" +
                "      \"Condition\": { \"StringEquals\": { \"kms:ViaService\": \"s3.<REGION>.amazonaws.com\" } } }\n" +
                "  ]\n" +
                "}"
              },
              { t: "note", variant: "tip", html: "Inside a key policy, <code class='tok'>\"Resource\": \"*\"</code> means <em>this key</em>, because the policy is attached to exactly one key. The account-root statement delegates to IAM in the key's own account; it does not grant access to everyone. Keep the administrative and usage statements separate so key admins cannot decrypt data." },
              { t: "widget", id: "iamKmsAccess" },
              { t: "h", text: "Grants, encryption context and envelope encryption" },
              { t: "ul", items: [
                "<strong>Grants</strong> delegate specific operations on one key to a principal, programmatically and revocably. AWS services use them, for example EBS attaching an encrypted volume to an instance.",
                "<strong>Encryption context</strong> is non-secret key-value data bound to a ciphertext as additional authenticated data. Decrypt fails if it differs, policies can require it, and CloudTrail records it, so you can see <em>which</em> object was decrypted.",
                "<strong>Envelope encryption</strong>: KMS returns a data key, the service encrypts data locally with it, and stores the data key encrypted under the KMS key. Bulk data never travels to KMS, and per-request limits stay manageable. S3 Bucket Keys reduce KMS calls further."
              ] },
              { t: "h", text: "Rotation and deletion" },
              { t: "p", html: "Automatic rotation adds new key material behind the same key ID and ARN; older material is kept for decrypting old ciphertext, so nothing needs re-encrypting. Deleting a key is irreversible, so KMS forces a <strong>waiting period of 7 to 30 days</strong>; disable the key first and watch for failures. Multi-Region keys share key material across regions for DR and global tables." },
              { t: "table", headers: ["Concept", "AWS", "Azure", "Google Cloud"], rows: [
                ["Key service", "KMS (CloudHSM, external key store)", "Key Vault (Standard, Premium HSM-backed) and Managed HSM", "Cloud KMS (software, Cloud HSM, Cloud EKM)"],
                ["Access model", "Key policy plus IAM, grants", "Azure RBAC (recommended) or legacy access policies", "IAM roles on key ring or key, such as cryptoKeyEncrypterDecrypter"],
                ["Rotation", "Automatic or on demand; same key ID", "Key rotation policy creates new versions", "Rotation period creates a new primary version"],
                ["Deletion safety", "7-30 day scheduled deletion", "Soft delete and purge protection", "Scheduled destruction of key versions"],
                ["Customer-managed keys on services", "SSE-KMS, EBS, RDS and most services", "Customer-managed keys on Storage, SQL, Disks", "CMEK on Cloud Storage, BigQuery, Persistent Disk"]
              ] },
              { t: "note", variant: "trap", html: "A key policy that grants <code class='tok'>kms:*</code> to a wide principal, or a grant left in place after a project ends, silently widens who can read your data. Review key policies and grants like IAM policies, and alert on <code class='tok'>PutKeyPolicy</code>, <code class='tok'>CreateGrant</code> and <code class='tok'>ScheduleKeyDeletion</code>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'share encrypted snapshots with another account', 'crypto-shred a tenant', 'auditors want to know who decrypted' — customer managed keys with cross-account key policy statements, a key per tenant or data class, and encryption context in CloudTrail." },
              { t: "note", variant: "key", html: "<strong>The key policy decides; IAM only helps if the key policy delegates.</strong> Use customer managed keys for anything shared or regulated, require encryption context, enable rotation, and treat key deletion and grants as privileged events." }
            ]
          },
          {
            id: "secrets",
            title: "Secrets: Secrets Manager, Parameter Store, Key Vault and Secret Manager",
            summary: "Where secrets live on each cloud, how rotation works, how workloads fetch them without leaking, and when you do not need a secret at all.",
            minutes: 10,
            tags: ["secrets-manager", "parameter-store", "key-vault", "secret-manager", "rotation"],
            blocks: [
              { t: "p", html: "The best secret is the one you do not have: roles, managed identities, workload identity federation and IAM database authentication remove whole classes of passwords. What remains (third-party API tokens, database passwords for engines that need them, signing material) belongs in a secret store, fetched at runtime, rotated, and never committed." },
              { t: "h", text: "Secrets Manager versus Parameter Store" },
              { t: "table", headers: ["", "Secrets Manager", "Parameter Store"], rows: [
                ["Built for", "Credentials that must rotate", "Configuration, including encrypted SecureString values"],
                ["Rotation", "Managed rotation for supported databases; Lambda rotation functions for the rest", "None built in; you rotate and write a new version"],
                ["Cross-region", "Replica secrets", "Copy it yourself"],
                ["Access control", "IAM plus resource policies (cross-account possible)", "IAM on parameter paths; SecureString also needs KMS access"],
                ["Cost", "Per secret per month plus API calls", "Standard tier free; advanced tier and higher throughput are billed"],
                ["Shape", "Up to 64 KB, often JSON with username and password", "Hierarchical paths such as /orders/prod/db-host; versioned"]
              ] },
              { t: "h", text: "Getting secrets into workloads safely" },
              { t: "table", headers: ["Platform", "Pattern"], rows: [
                ["ECS", "Reference the secret ARN in the task definition's secrets section; the agent injects it at start using the task execution role"],
                ["Lambda", "Fetch at init and cache, or use the parameters and secrets extension; never bake values into environment variables in IaC"],
                ["EKS", "Secrets Store CSI driver with the AWS provider, or External Secrets Operator, authenticated through Pod Identity or IRSA"],
                ["Azure", "Managed identity reads Key Vault; App Service and Functions support Key Vault references"],
                ["Google Cloud", "Service account reads Secret Manager; Cloud Run mounts secrets as volumes or environment variables"]
              ] },
              { t: "code", lang: "javascript", code:
                "// ECS task definition excerpt: the value never appears in the definition\n" +
                "\"secrets\": [\n" +
                "  { \"name\": \"PAYMENTS_API_TOKEN\",\n" +
                "    \"valueFrom\": \"arn:aws:secretsmanager:<REGION>:<ACCOUNT_ID>:secret:orders/prod/payments-token\" }\n" +
                "]"
              },
              { t: "h", text: "Rotation without outages" },
              { t: "ol", items: [
                "Create the new credential alongside the old one (two users, or the engine's dual-password support).",
                "Store it as the pending version and test it.",
                "Promote it to current; clients pick it up on their next fetch or cache refresh.",
                "Revoke the old credential after the longest client cache lifetime has passed."
              ] },
              { t: "p", html: "Secrets Manager's rotation functions follow exactly these steps. Azure Key Vault can emit near-expiry events to drive rotation, and Google Secret Manager sends rotation notifications to Pub/Sub on a schedule, leaving the rotation logic to you." },
              { t: "note", variant: "warn", html: "Secrets leak through side doors: CI logs, crash dumps, IaC state, environment variables shown in consoles, and container images. Scan repositories and images for secrets, mark IaC outputs sensitive, and lock down state. For the pipeline side in depth, see <a href='../devsecops-academy/index.html#/chain/identity/secrets-e2e'>Forge: Secrets management</a>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'where do we keep the DB password?', 'a key was committed to GitHub' — first remove the need (IAM auth, roles), then a secret store with rotation and runtime fetch; for a leak, revoke and rotate first, then clean history." },
              { t: "quiz", id: "iam-protect" },
              { t: "note", variant: "key", html: "<strong>Prefer identities to secrets; store what remains in a rotating secret store and fetch it at runtime.</strong> Secrets Manager rotates and replicates, Parameter Store is cheap configuration, and Key Vault and Secret Manager fill the same roles on Azure and Google Cloud." }
            ]
          }
        ]
      }
    ]
  };
})();
