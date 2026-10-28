/* =====================================================================
   NIMBUS · Cloud Networking
   window.TRACKS.net — modules: vpc / traffic / edge

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
    seg._btns = btns;
    return seg;
  }

  /* A labelled <select class="w-field">. `pairs` is [[value, label], ...]. */
  function selectField(label, pairs, initialValue, onPick) {
    var sel = h("select", { class: "w-field", "aria-label": label });
    for (var i = 0; i < pairs.length; i++) {
      var opt = h("option", { value: String(pairs[i][0]) }, pairs[i][1]);
      if (String(pairs[i][0]) === String(initialValue)) opt.setAttribute("selected", "selected");
      sel.appendChild(opt);
    }
    sel.addEventListener("change", function () { onPick(sel.value); });
    return h("label", { class: "w-field" }, label + " ", sel);
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function roWide(text) {
    return h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, text);
  }

  /* ---------- IPv4 integer math (plain arithmetic, no bitwise ops) ---------- */
  function pow2(k) { return Math.pow(2, k); }

  function ipToInt(s) {
    var parts = String(s == null ? "" : s).trim().split(".");
    if (parts.length !== 4) return -1;
    var n = 0;
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return -1;
      var v = parseInt(parts[i], 10);
      if (v < 0 || v > 255) return -1;
      n = n * 256 + v;
    }
    return n;
  }

  function intToIp(n) {
    n = Math.max(0, Math.floor(n));
    return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join(".");
  }

  function inCidr(ipInt, netInt, prefix) {
    var size = pow2(32 - prefix);
    return Math.floor(ipInt / size) === Math.floor(netInt / size);
  }

  function fmt(n) {
    var s = String(Math.round(n));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  var Widgets = {};

  /* ==================================================================
     1. netCidrPlanner — VPC / subnet CIDR planner
     Deterministic. Base address fixed at 10.0.0.0; subnets are carved
     sequentially, tier by tier.
  ================================================================== */
  var TIER_DEFS = [
    { id: "public", label: "public", fill: "var(--cyan)" },
    { id: "app", label: "private-app", fill: "var(--violet)" },
    { id: "data", label: "private-data", fill: "var(--amber)" }
  ];
  var PROVIDERS = {
    aws: { label: "AWS", reserved: 5, perAz: true, note: "AWS subnets live in exactly one AZ, so each tier gets one subnet per AZ. Reserved: network, VPC router (+1), DNS (+2), future use (+3) and the last address." },
    azure: { label: "Azure", reserved: 5, perAz: false, note: "Azure subnets span every zone in the region, so one subnet per tier is enough. Reserved: network, default gateway (+1), two DNS mappings (+2, +3) and the last address." },
    gcp: { label: "GCP", reserved: 4, perAz: false, note: "GCP subnets are regional and the VPC itself is global with no VPC-level CIDR; treat the prefix as your IPAM allocation. Reserved: network, gateway (+1), second-to-last and last." }
  };

  Widgets.netCidrPlanner = function (mount) {
    shell(mount, "planner", "VPC and subnet CIDR planner",
      "Carve a 10.0.0.0 range into tiered subnets. Change the VPC prefix, zone count, tiers, subnet size and provider; the plan shows every CIDR, usable addresses after the provider's reserved ones, and whether the plan fits.");

    var vpcPrefix = 16, azs = 3, tiers = 3, subPrefix = 24, provider = "aws";
    var BASE = ipToInt("10.0.0.0");
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var vpcOpts = [], subOpts = [], p;
    for (p = 16; p <= 24; p++) vpcOpts.push([p, "/" + p]);
    for (p = 20; p <= 28; p++) subOpts.push([p, "/" + p]);

    function paint() {
      var prov = PROVIDERS[provider] || PROVIDERS.aws;
      var vpcSize = pow2(32 - vpcPrefix);
      var subSize = pow2(32 - subPrefix);
      var perTier = prov.perAz ? azs : 1;
      var count = perTier * tiers;
      var need = count * subSize;
      var tooBig = subPrefix < vpcPrefix;
      var fits = !tooBig && need <= vpcSize;
      var usableEach = Math.max(0, subSize - prov.reserved);

      clear(stage);
      /* utilisation bar */
      var bar = h("div", { style: "display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--surface-solid);border:1px solid var(--line);margin-bottom:12px" });
      var idx, t, z;
      for (t = 0; t < tiers; t++) {
        for (z = 0; z < perTier; z++) {
          idx = t * perTier + z;
          if (tooBig || (idx + 1) * subSize > vpcSize) continue;
          var w = Math.max(0.4, subSize / vpcSize * 100);
          bar.appendChild(h("i", { style: "display:block;height:100%;width:" + w.toFixed(2) + "%;background:" + TIER_DEFS[t].fill + ";border-right:1px solid var(--surface-solid)" }));
        }
      }
      stage.appendChild(bar);

      var head = h("div", { style: "display:grid;grid-template-columns:minmax(90px,1fr) minmax(80px,0.8fr) minmax(120px,1.2fr) minmax(80px,0.8fr);gap:10px;font-size:0.74rem;font-family:var(--font-mono);color:var(--text-dim);padding:0 8px 6px;border-bottom:1px solid var(--line)" },
        h("span", {}, "tier"), h("span", {}, prov.perAz ? "AZ" : "zones"), h("span", {}, "CIDR"), h("span", {}, "usable"));
      stage.appendChild(head);

      var azNames = ["a", "b", "c"];
      for (t = 0; t < tiers; t++) {
        for (z = 0; z < perTier; z++) {
          idx = t * perTier + z;
          var start = BASE + idx * subSize;
          var inside = !tooBig && (idx + 1) * subSize <= vpcSize;
          stage.appendChild(h("div", {
            style: "display:grid;grid-template-columns:minmax(90px,1fr) minmax(80px,0.8fr) minmax(120px,1.2fr) minmax(80px,0.8fr);gap:10px;align-items:center;padding:6px 8px;font-size:0.84rem;border-bottom:1px solid var(--line);" + (inside ? "" : "background:color-mix(in srgb, var(--rose) 14%, transparent);")
          },
            h("span", { style: "display:flex;align-items:center;gap:8px;color:var(--text)" },
              h("i", { style: "display:inline-block;width:10px;height:10px;border-radius:3px;background:" + TIER_DEFS[t].fill }),
              TIER_DEFS[t].label),
            h("span", { style: "color:var(--text-dim)" }, prov.perAz ? "az-" + azNames[z] : (provider === "gcp" ? "regional" : "zone-spanning")),
            h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, intToIp(start) + "/" + subPrefix),
            h("span", { style: "font-family:var(--font-mono);color:" + (inside ? "var(--text)" : "var(--rose)") }, inside ? fmt(usableEach) : "outside VPC")
          ));
        }
      }

      clear(readout);
      readout.appendChild(ro("provider", prov.label));
      readout.appendChild(ro("VPC", "10.0.0.0/" + vpcPrefix + " (" + fmt(vpcSize) + " addrs)"));
      readout.appendChild(ro("subnets", count + " x /" + subPrefix));
      readout.appendChild(ro("per subnet", fmt(subSize) + " - " + prov.reserved + " = " + fmt(usableEach) + " usable"));
      readout.appendChild(ro("total usable", fmt(fits ? usableEach * count : 0)));
      readout.appendChild(ro("VPC allocated", tooBig ? "n/a" : Math.min(100, Math.round(need / vpcSize * 1000) / 10) + "%"));
      readout.appendChild(ro("status", tooBig ? "subnet larger than VPC" : (fits ? "fits" : "does not fit (short " + fmt(need - vpcSize) + " addrs)")));
      readout.appendChild(ro("spare", fits ? fmt(vpcSize - need) + " addrs for growth" : "none"));
      readout.appendChild(roWide(prov.note));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      selectField("VPC prefix", vpcOpts, vpcPrefix, function (v) { vpcPrefix = parseInt(v, 10) || 16; paint(); }),
      segment([[2, "2 AZs"], [3, "3 AZs"]], 1, function (v) { azs = v; paint(); }),
      segment([[1, "1 tier"], [2, "2 tiers"], [3, "3 tiers"]], 2, function (v) { tiers = v; paint(); }),
      selectField("subnet size", subOpts, subPrefix, function (v) { subPrefix = parseInt(v, 10) || 24; paint(); }),
      segment([["aws", "AWS"], ["azure", "Azure"], ["gcp", "GCP"]], 0, function (v) { provider = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. netSgNacl — packet walk through security groups and NACLs
     Deterministic hop list per scenario; each hop either needs a rule
     (keyed to a toggle) or is auto-allowed because SGs are stateful.
  ================================================================== */
  var SG_TOGGLES = [
    { key: "sg", label: "SG rule" },
    { key: "naclInSvc", label: "NACL in: service port" },
    { key: "naclOutSvc", label: "NACL out: service port" },
    { key: "naclInEph", label: "NACL in: ephemeral" },
    { key: "naclOutEph", label: "NACL out: ephemeral" }
  ];
  var SG_SCENARIOS = {
    alb: {
      label: "Internet to ALB on 443",
      hops: [
        { dir: "request", where: "Public subnet NACL, inbound", need: "a numbered rule allowing TCP 443 from 0.0.0.0/0", key: "naclInSvc" },
        { dir: "request", where: "ALB security group, inbound", need: "allow TCP 443 from 0.0.0.0/0 (fine for a public web listener)", key: "sg" },
        { dir: "response", where: "ALB security group, outbound", need: "nothing: the SG tracked the connection, so the reply is allowed", key: null },
        { dir: "response", where: "Public subnet NACL, outbound", need: "allow TCP 1024-65535 to 0.0.0.0/0, the client's ephemeral port", key: "naclOutEph" }
      ]
    },
    app: {
      label: "ALB to app on 8080",
      hops: [
        { dir: "request", where: "App subnet NACL, inbound", need: "allow TCP 8080 from the public subnet CIDRs", key: "naclInSvc" },
        { dir: "request", where: "App security group, inbound", need: "allow TCP 8080 from source sg-alb (an SG reference, not a CIDR)", key: "sg" },
        { dir: "response", where: "App security group, outbound", need: "nothing: stateful return traffic", key: null },
        { dir: "response", where: "App subnet NACL, outbound", need: "allow TCP 1024-65535 to the public subnet CIDRs", key: "naclOutEph" }
      ]
    },
    nat: {
      label: "App to partner API via NAT",
      hops: [
        { dir: "request", where: "App security group, outbound", need: "allow TCP 443 to the destination (0.0.0.0/0 or a prefix list)", key: "sg" },
        { dir: "request", where: "App subnet NACL, outbound", need: "allow TCP 443 to 0.0.0.0/0", key: "naclOutSvc" },
        { dir: "request", where: "NAT gateway in the public subnet", need: "route 0.0.0.0/0 to the NAT; source rewritten to its public IP", key: null, info: true },
        { dir: "response", where: "App subnet NACL, inbound", need: "allow TCP 1024-65535 from 0.0.0.0/0, back to the instance's ephemeral port", key: "naclInEph" },
        { dir: "response", where: "App security group, inbound", need: "nothing: stateful return traffic", key: null }
      ]
    }
  };

  Widgets.netSgNacl = function (mount) {
    shell(mount, "packet walk", "Security group vs NACL packet walk",
      "Pick a flow, then switch rules off. Security groups are stateful (replies ride the tracked connection); NACLs are stateless, so the reply direction needs its own rule, usually the ephemeral port range.");

    var scen = "alb";
    var on = { sg: true, naclInSvc: true, naclOutSvc: true, naclInEph: true, naclOutEph: true };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var toggleBtns = {};

    function paintToggles() {
      for (var i = 0; i < SG_TOGGLES.length; i++) {
        var tg = SG_TOGGLES[i];
        var b = toggleBtns[tg.key];
        if (!b) continue;
        b.className = "w-btn " + (on[tg.key] ? "primary" : "ghost");
        b.textContent = tg.label + ": " + (on[tg.key] ? "on" : "off");
      }
    }

    function paint() {
      var s = SG_SCENARIOS[scen] || SG_SCENARIOS.alb;
      var blockedAt = -1, stateful = 0, used = {}, i;
      clear(stage);
      for (i = 0; i < s.hops.length; i++) {
        var hp = s.hops[i];
        var verdict, color;
        if (hp.key) used[hp.key] = true;
        if (blockedAt >= 0) { verdict = "not reached"; color = "var(--text-dim)"; }
        else if (!hp.key) {
          verdict = hp.info ? "pass" : "auto-allow";
          color = "var(--accent-ink)";
          if (!hp.info) stateful++;
        } else if (on[hp.key]) { verdict = "ALLOW"; color = "var(--accent-ink)"; }
        else { verdict = "DENY"; color = "var(--rose)"; blockedAt = i; }
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:28px minmax(70px,0.6fr) minmax(140px,1.3fr) minmax(70px,0.5fr);gap:10px;align-items:start;padding:8px 10px;border-radius:10px;margin-bottom:4px;" +
            (blockedAt === i ? "background:color-mix(in srgb, var(--rose) 14%, transparent);" : (blockedAt >= 0 && i > blockedAt ? "opacity:0.6;" : ""))
        },
          h("b", { style: "font-family:var(--font-mono);color:var(--text-dim)" }, String(i + 1)),
          h("span", { style: "font-size:0.78rem;font-family:var(--font-mono);color:" + (hp.dir === "request" ? "var(--text)" : "var(--text-dim)") }, hp.dir),
          h("span", { style: "font-size:0.84rem;color:var(--text)" },
            h("strong", {}, hp.where), h("br", {}),
            h("span", { style: "color:var(--text-dim)" }, hp.need)),
          h("b", { style: "font-family:var(--font-mono);font-size:0.8rem;color:" + color }, verdict)
        ));
      }
      stage.appendChild(h("p", { style: "font-size:0.8rem;color:var(--text-dim);margin:10px 0 0" },
        "Cross-cloud: Azure NSGs and GCP VPC firewall rules are both stateful, so only the request-direction rule exists there. The stateless subnet ACL is an AWS-specific extra layer."));

      var unused = [];
      for (i = 0; i < SG_TOGGLES.length; i++) if (!used[SG_TOGGLES[i].key]) unused.push(SG_TOGGLES[i].label);

      clear(readout);
      readout.appendChild(ro("flow", s.label));
      readout.appendChild(ro("verdict", blockedAt < 0 ? "connection succeeds" : "blocked at hop " + (blockedAt + 1)));
      readout.appendChild(ro("stateful auto-allows", stateful));
      readout.appendChild(ro("rules this flow needs", s.hops.filter(function (x) { return !!x.key; }).length));
      readout.appendChild(roWide(blockedAt < 0
        ? "Every hop passed. Toggles not used by this flow: " + (unused.length ? unused.join(", ") : "none") + "."
        : "Blocked by " + s.hops[blockedAt].where + ". " + (s.hops[blockedAt].dir === "response"
          ? "The request got through, so this looks like a timeout to the client: the classic stateless-NACL bug."
          : "The request never reached the target, so the client sees a timeout, not a refusal.")));
    }

    var toggleRow = h("div", { class: "widget-controls" });
    for (var ti = 0; ti < SG_TOGGLES.length; ti++) {
      (function (tg) {
        var b = h("button", { type: "button", class: "w-btn primary" }, tg.label);
        b.addEventListener("click", function () { on[tg.key] = !on[tg.key]; paintToggles(); paint(); });
        toggleBtns[tg.key] = b;
        toggleRow.appendChild(b);
      })(SG_TOGGLES[ti]);
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["alb", "Internet to ALB"], ["app", "ALB to app"], ["nat", "Out via NAT"]], 0, function (v) { scen = v; paint(); })
    ));
    mount.appendChild(toggleRow);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paintToggles();
    paint();
  };

  /* ==================================================================
     3. netRouteLookup — longest-prefix match on a fixed route table
  ================================================================== */
  var RT_ROUTES = [
    { cidr: "10.0.0.0", prefix: 16, label: "10.0.0.0/16", target: "local", why: "the VPC's own range; every route table has it and it cannot be deleted" },
    { cidr: "10.20.0.0", prefix: 16, label: "10.20.0.0/16", target: "tgw-0a1b (Transit Gateway)", why: "the shared-services and spoke range reached through the hub" },
    { cidr: "10.20.5.0", prefix: 24, label: "10.20.5.0/24", target: "pcx-7c (VPC peering)", why: "one partner VPC peered directly; more specific than the TGW /16" },
    { cidr: "52.216.0.0", prefix: 15, label: "pl-s3 (illustrative 52.216.0.0/15)", target: "vpce-s3 (gateway endpoint)", why: "a managed prefix list for the storage service; real lists hold many CIDRs that change over time" },
    { cidr: "0.0.0.0", prefix: 0, label: "0.0.0.0/0", target: "", why: "the default route; matches everything, so it only wins when nothing else does" }
  ];
  var RT_PRESETS = [
    ["10.0.12.7", "in VPC"], ["10.20.5.40", "peered /24"], ["10.20.9.3", "TGW spoke"],
    ["52.217.4.10", "storage (illustr.)"], ["198.51.100.25", "internet"], ["192.168.1.5", "on-prem?"]
  ];

  Widgets.netRouteLookup = function (mount) {
    shell(mount, "lookup", "Route table longest-prefix match",
      "Pick a destination or type an IPv4 address. Every route whose CIDR contains the address is a candidate; the one with the longest prefix wins, regardless of the order rows are listed.");

    var dest = "10.20.5.40";
    var subnet = "private";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var input = h("input", { type: "text", class: "w-field", placeholder: "e.g. 10.20.5.40", "aria-label": "destination IP", style: "max-width:160px" });
    var presetSeg;

    function defaultTarget() { return subnet === "private" ? "nat-az-a (NAT gateway)" : "igw-01 (Internet Gateway)"; }

    function paint() {
      var ipInt = ipToInt(dest);
      var best = -1, matches = 0, i;
      if (ipInt >= 0) {
        for (i = 0; i < RT_ROUTES.length; i++) {
          var r = RT_ROUTES[i];
          if (inCidr(ipInt, ipToInt(r.cidr), r.prefix)) {
            matches++;
            if (best < 0 || r.prefix > RT_ROUTES[best].prefix) best = i;
          }
        }
      }
      clear(stage);
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:minmax(150px,1.3fr) minmax(130px,1fr) minmax(70px,0.5fr);gap:10px;font-size:0.74rem;font-family:var(--font-mono);color:var(--text-dim);padding:0 10px 6px;border-bottom:1px solid var(--line)" },
        h("span", {}, "destination"), h("span", {}, "target"), h("span", {}, "match")));
      for (i = 0; i < RT_ROUTES.length; i++) {
        var rr = RT_ROUTES[i];
        var hit = ipInt >= 0 && inCidr(ipInt, ipToInt(rr.cidr), rr.prefix);
        var win = i === best;
        stage.appendChild(h("div", {
          style: "display:grid;grid-template-columns:minmax(150px,1.3fr) minmax(130px,1fr) minmax(70px,0.5fr);gap:10px;align-items:center;padding:7px 10px;border-radius:8px;font-size:0.84rem;" +
            (win ? "background:color-mix(in srgb, var(--accent) 16%, transparent);font-weight:700;" : "")
        },
          h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, rr.label),
          h("span", { style: "color:var(--text)" }, rr.target || defaultTarget()),
          h("span", { style: "font-family:var(--font-mono);color:" + (win ? "var(--accent-ink)" : "var(--text-dim)") }, win ? "WINNER /" + rr.prefix : (hit ? "match /" + rr.prefix : "-"))
        ));
      }

      clear(readout);
      if (ipInt < 0) {
        readout.appendChild(ro("destination", "invalid"));
        readout.appendChild(roWide("Enter a dotted-quad IPv4 address such as 10.20.5.40 (four numbers from 0 to 255)."));
        return;
      }
      var w = RT_ROUTES[best];
      readout.appendChild(ro("destination", intToIp(ipInt)));
      readout.appendChild(ro("subnet type", subnet));
      readout.appendChild(ro("matched route", w.prefix === 0 ? "0.0.0.0/0" : w.label));
      readout.appendChild(ro("target", w.target || defaultTarget()));
      readout.appendChild(ro("candidates", matches + (matches === 1 ? " route" : " routes")));
      var why = "Why: /" + w.prefix + " is the longest prefix containing this address; " + w.why + ".";
      if (dest === "192.168.1.5") why += " There is no on-prem route here, so private traffic would leak to the default route and fail: add a VGW/TGW route for the on-prem range.";
      if (w.prefix === 0 && subnet === "private") why += " Private subnet: the NAT gateway lets instances reach out without being reachable from the internet.";
      if (w.prefix === 0 && subnet === "public") why += " Public subnet: the IGW route is what makes the subnet public.";
      readout.appendChild(roWide(why));
    }

    input.addEventListener("change", function () {
      var v = String(input.value || "").trim();
      if (!v) return;
      dest = v;
      if (presetSeg && presetSeg._btns) for (var j = 0; j < presetSeg._btns.length; j++) presetSeg._btns[j].classList.remove("active");
      paint();
    });

    var presetIdx = 1;
    presetSeg = segment(RT_PRESETS.map(function (p) { return [p[0], p[1]]; }), presetIdx, function (v) { dest = v; input.value = ""; paint(); });

    mount.appendChild(h("div", { class: "widget-controls" }, presetSeg));
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["private", "Private subnet"], ["public", "Public subnet"]], 0, function (v) { subnet = v; paint(); }),
      h("label", { class: "w-field" }, "custom IP ", input)
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "net-vpc": {
      title: "VPC foundations checkpoint",
      sub: "CIDR math, network scope per cloud, subnet tiers, routing and NAT.",
      questions: [
        {
          q: "How many addresses can you assign to resources in an AWS subnet with a /24 CIDR?",
          options: ["256", "254", "251", "250"],
          answer: 2,
          explain: "A /24 holds 256 addresses. AWS reserves five in every subnet: the network address, the VPC router, the DNS address, one held for future use, and the last address. That leaves 251; Azure also reserves five, while GCP reserves four."
        },
        {
          q: "Which statement about network scope is correct?",
          options: ["AWS VPCs are global; GCP VPCs are regional", "GCP VPC networks are global and their subnets are regional", "Azure subnets are pinned to one availability zone", "All three clouds scope subnets to a single zone"],
          answer: 1,
          explain: "A GCP VPC network is a global resource and each subnet belongs to one region while spanning its zones. AWS VPCs are regional with subnets inside one AZ, and Azure VNets are regional with subnets that span zones. That difference changes how many subnets a multi-zone design needs."
        },
        {
          q: "A route table has 10.0.0.0/16 to local, 10.0.0.0/8 to a transit gateway, and 0.0.0.0/0 to a NAT gateway. Where does traffic for 10.1.2.3 go?",
          options: ["local", "The NAT gateway", "It is dropped", "The transit gateway"],
          answer: 3,
          explain: "10.1.2.3 is outside 10.0.0.0/16, so local does not match. It is inside 10.0.0.0/8 and inside 0.0.0.0/0, and the /8 is the longer prefix, so the transit gateway wins. Row order never matters; prefix length does."
        },
        {
          q: "Why do resilient AWS designs run one NAT gateway per AZ instead of one shared NAT gateway?",
          options: ["A NAT gateway is zonal: if its AZ fails, other AZs lose egress, and cross-AZ traffic adds data charges", "A NAT gateway can only be attached to one subnet", "Internet gateways are zonal and need a NAT in each AZ", "Route tables cannot reference resources in another AZ"],
          answer: 0,
          explain: "The classic NAT gateway lives in one AZ. Pointing every private subnet at it makes egress depend on that AZ and sends other AZs' traffic across zones, which is billed. One per AZ, with each AZ's route table pointing at its local NAT, removes both problems at the cost of more hourly charges."
        },
        {
          q: "What makes an AWS subnet public?",
          options: ["Its CIDR comes from a public range", "Its instances have security groups that allow 0.0.0.0/0", "Its route table sends 0.0.0.0/0 to an internet gateway", "It is the first subnet created in the VPC"],
          answer: 2,
          explain: "Public versus private is a routing property: a subnet whose route table has a default route to an internet gateway is public. Instances still need a public or Elastic IP to be reachable, and security groups still filter. A private subnet sends its default route to a NAT gateway or nowhere."
        }
      ]
    },
    "net-traffic": {
      title: "Traffic control and connectivity checkpoint",
      sub: "Stateful vs stateless filtering, peering vs hubs, hybrid links and private access.",
      questions: [
        {
          q: "HTTPS requests reach an instance, but clients time out. The security group allows 443 in. The subnet NACL allows 443 inbound and only 443 outbound. What is wrong?",
          options: ["The security group needs an outbound 443 rule", "The NACL outbound rules do not allow the ephemeral port range the replies go to", "The internet gateway is missing", "The TLS certificate has expired"],
          answer: 1,
          explain: "Replies go from port 443 to the client's ephemeral port, often anywhere in 1024-65535. Security groups are stateful and let the reply out automatically, but NACLs are stateless and evaluate the reply as a new packet. Without an outbound ephemeral-range rule, the reply is dropped and the client sees a timeout."
        },
        {
          q: "VPC A is peered with B, and B is peered with C. Can A reach C through B?",
          options: ["Yes, peering connections are transitive", "Only if all three VPCs are in the same account", "No; peering is non-transitive, so peer A with C directly or use a hub such as a transit gateway", "Only for IPv6 traffic"],
          answer: 2,
          explain: "Peering only connects the two VPCs on each side of the connection. Traffic cannot hop through B to reach C. At a handful of VPCs a full mesh is workable; beyond that, a transit gateway or equivalent hub keeps routing manageable."
        },
        {
          q: "Which services can an AWS gateway VPC endpoint reach?",
          options: ["S3 and DynamoDB", "Any AWS service with an API", "Only third-party SaaS services", "Only on-premises networks over Direct Connect"],
          answer: 0,
          explain: "Gateway endpoints exist only for S3 and DynamoDB. They work by adding a prefix-list route to your route tables and carry no hourly charge. Everything else uses interface endpoints, which place ENIs with private IPs in your subnets and are billed per hour and per GB."
        },
        {
          q: "You want a PaaS database in Azure to be reachable only through a private IP inside your VNet. What do you use?",
          options: ["A service endpoint", "A NAT gateway", "ExpressRoute Microsoft peering", "A private endpoint"],
          answer: 3,
          explain: "A private endpoint places a network interface with a private IP from your subnet in front of that specific resource, which is the nearest match to an AWS interface endpoint. Service endpoints keep the service on its public address and only optimise the path from a subnet. Pair the private endpoint with a private DNS zone so the normal hostname resolves to the private IP."
        },
        {
          q: "Is traffic over AWS Direct Connect encrypted by default?",
          options: ["Yes, every connection uses IPsec automatically", "No; it is a private path but not encrypted by default, so add MACsec where supported or run a VPN over it", "Yes, TLS is applied at the physical layer", "It cannot be encrypted at all"],
          answer: 1,
          explain: "Direct Connect is a private circuit, not an encrypted one. If policy requires encryption in transit, use MACsec on supported dedicated connections, run IPsec VPN over the link, or rely on TLS in the application. The same reasoning applies to ExpressRoute and Cloud Interconnect."
        }
      ]
    },
    "net-edge": {
      title: "Edge, DNS and delivery checkpoint",
      sub: "DNS records and routing policies, load balancer choice, CDN and flow logs.",
      questions: [
        {
          q: "You need the zone apex shop.example to point at an AWS Application Load Balancer. Which Route 53 record do you create?",
          options: ["A CNAME at the apex", "An MX record", "An alias A record targeting the load balancer", "A TXT record with the load balancer's DNS name"],
          answer: 2,
          explain: "DNS forbids a CNAME at the zone apex because the apex must hold SOA and NS records. Route 53 alias records solve this: they look like an A or AAAA record to clients but track the load balancer's changing addresses, and queries to AWS targets are not billed."
        },
        {
          q: "Which Route 53 routing policy gives you active-passive disaster recovery driven by health checks?",
          options: ["Failover", "Weighted", "Geolocation", "Simple"],
          answer: 0,
          explain: "Failover routing answers with the primary record while its health check passes and switches to the secondary when it fails. Weighted splits traffic by ratio and geolocation routes by the client's location. Remember DNS TTLs and resolver caching delay the switch."
        },
        {
          q: "A non-HTTP TCP service needs a static IP per AZ, very high throughput and the client's source IP preserved. Which AWS load balancer fits?",
          options: ["Application Load Balancer", "Gateway Load Balancer", "CloudFront", "Network Load Balancer"],
          answer: 3,
          explain: "A Network Load Balancer works at layer 4, supports static or Elastic IPs per AZ and preserves source IPs for many target types. An ALB terminates HTTP and is the wrong tool for raw TCP. A Gateway Load Balancer inserts inspection appliances rather than serving clients."
        },
        {
          q: "In GCP, what gives you one anycast IP that fronts HTTP backends in several regions?",
          options: ["An internal passthrough Network Load Balancer", "The global external Application Load Balancer", "Cloud NAT", "A regional external proxy Network Load Balancer"],
          answer: 1,
          explain: "The global external Application Load Balancer advertises a single anycast address from Google's edge and routes each request to the closest healthy backend across regions. Regional and passthrough load balancers stay inside one region. Azure's nearest equivalent for global HTTP is Front Door."
        },
        {
          q: "What does a VPC flow log record contain?",
          options: ["Metadata such as source and destination IP, ports, protocol, bytes and whether the flow was accepted or rejected", "Full packet payloads for forensic replay", "Only DNS queries made by instances", "Only TLS handshake details"],
          answer: 0,
          explain: "Flow logs capture connection metadata, aggregated over an interval, not packet contents. They answer who talked to whom and whether filtering allowed it. When you need payloads, you use traffic mirroring or packet capture instead, at much higher cost."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.net = {
    id: "net",
    name: "Cloud Networking",
    short: "NET",
    tagline: "Address plans, filters, hubs and the edge, on three clouds",
    color: "#34d399",
    blurb: "Design cloud networks the way a reviewer expects: CIDR plans that leave room to grow, subnet tiers across zones, routing and NAT, stateful and stateless filtering, peering versus transit hubs, hybrid links, private service access, DNS, load balancers, CDN and flow logs. Every concept is mapped to its Azure and GCP equivalent, including where the mapping is loose.",
    modules: [
      {
        id: "vpc",
        name: "VPC Foundations",
        icon: "grid",
        lessons: [
          {
            id: "cidr-math",
            title: "CIDR and IP math for cloud networks",
            summary: "Read a prefix, size a block, split it cleanly and avoid the overlaps that block peering later.",
            minutes: 8,
            tags: ["cidr", "ipv4", "subnetting", "ipam"],
            blocks: [
              { t: "p", html: "Every cloud network starts with an address plan, and most network pain three years later traces back to it: two VPCs that cannot peer because they both picked <code class='tok'>10.0.0.0/16</code>, or a subnet that ran out of addresses when a cluster scaled. Hold one picture: <strong>a CIDR block is a power-of-two slice of the address space</strong>, and planning means carving slices that never overlap." },
              { t: "h", text: "Reading a prefix" },
              { t: "p", html: "In <code class='tok'>10.20.0.0/16</code>, the <code class='tok'>/16</code> says the first 16 of 32 bits are fixed. The remaining 16 bits are free, so the block holds 2^16 = 65,536 addresses. Each extra prefix bit halves the block." },
              { t: "table", headers: ["Prefix", "Addresses", "Typical use"], rows: [
                ["/16", "65,536", "A whole VPC or VNet (the largest AWS allows for one CIDR)"],
                ["/19", "8,192", "A large Kubernetes pod subnet"],
                ["/20", "4,096", "A busy application subnet"],
                ["/24", "256", "A common default subnet size"],
                ["/26", "64", "Small tiers, firewall or gateway subnets"],
                ["/28", "16", "The smallest subnet AWS allows"]
              ] },
              { t: "h", text: "The arithmetic, done by hand" },
              { t: "code", lang: "text", code:
                "addresses(prefix)     = 2 ^ (32 - prefix)\n" +
                "/22                   = 2 ^ 10 = 1,024 addresses\n\n" +
                "Split 10.0.0.0/16 into /20s:\n" +
                "  count               = 2 ^ (20 - 16) = 16 subnets\n" +
                "  step                = 4,096 addresses = 16 in the third octet\n" +
                "  10.0.0.0/20, 10.0.16.0/20, 10.0.32.0/20, ... 10.0.240.0/20\n\n" +
                "Does 10.0.37.9 sit inside 10.0.32.0/20?\n" +
                "  block covers 10.0.32.0 - 10.0.47.255  -> yes"
              },
              { t: "p", html: "A block must start on a multiple of its own size. <code class='tok'>10.0.8.0/20</code> is invalid because 8 is not a multiple of 16 in the third octet; tools will silently round it to <code class='tok'>10.0.0.0/20</code> or reject it." },
              { t: "h", text: "Plan for the whole estate, not one VPC" },
              { t: "ul", items: [
                "Reserve a large private range per region or environment (for example <code class='tok'>10.0.0.0/12</code> for production) and hand out non-overlapping VPC blocks from it.",
                "Keep a central record: AWS VPC IPAM, Azure Virtual Network Manager IP address pools, or a spreadsheet you actually maintain.",
                "Avoid the ranges on-premises already uses, and avoid <code class='tok'>172.17.0.0/16</code>, which container runtimes often take by default.",
                "Leave headroom: secondary CIDRs can be added later on all three clouds, but they complicate routing and firewall rules."
              ] },
              { t: "table", headers: ["Concern", "AWS", "Azure", "GCP"], rows: [
                ["Address management tool", "VPC IPAM", "Virtual Network Manager IPAM pools", "No direct equivalent; plan per VPC or use third-party IPAM"],
                ["Add space later", "Secondary VPC CIDRs", "Add address space to a VNet", "Add subnets or secondary subnet ranges"],
                ["Overlap tolerance for peering", "None", "None", "None"]
              ] },
              { t: "note", variant: "trap", html: "Overlapping CIDRs cannot be peered or routed through a transit hub without NAT. Fixing overlap after workloads exist means re-IPing them, so the cheap moment to get this right is before the first VPC." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'merger', 'connect to on-prem', 'many teams creating VPCs', or 'ran out of IPs' all mean the interviewer wants an address plan and an overlap story before any service names." },
              { t: "note", variant: "key", html: "<strong>A prefix is a power-of-two slice; planning is avoiding overlap.</strong> Allocate VPC blocks from a central plan, size subnets for growth, and say out loud that overlapping ranges can never be peered cleanly." }
            ]
          },
          {
            id: "vpc-design",
            title: "VPC, VNet and VPC network: what scope each cloud gives you",
            summary: "The same idea with three different scopes, and how that shapes subnets, zones and multi-region design.",
            minutes: 9,
            tags: ["vpc", "vnet", "gcp-vpc", "regions", "zones"],
            blocks: [
              { t: "p", html: "A virtual network is your private, isolated slice of the provider's network: you choose its address space, its subnets and its routes, and nothing gets in or out unless you add a path. All three clouds offer this, but they disagree on <strong>scope</strong>, and scope decides how many networks and subnets a design needs." },
              { t: "table", headers: ["Property", "AWS VPC", "Azure VNet", "GCP VPC network"], rows: [
                ["Network scope", "Regional", "Regional", "<strong>Global</strong>"],
                ["Subnet scope", "One availability zone", "Regional, spans zones", "Regional, spans zones"],
                ["CIDR defined on", "The VPC, then carved into subnets", "The VNet address space, then carved", "Each subnet only; no network-level CIDR"],
                ["Multi-region", "One VPC per region, connected", "One VNet per region, connected", "One network, subnets in each region"],
                ["Default network", "Default VPC per region (delete or ignore in production)", "None by default", "Auto-mode default network (prefer custom mode)"]
              ] },
              { t: "note", variant: "warn", html: "The mapping is loose. A GCP VPC is closer to 'an AWS VPC in every region with the routing already joined', and firewall rules are attached to the global network, not to a subnet. Design reviews go wrong when someone assumes subnet-per-AZ thinking carries over." },
              { t: "h", text: "Mechanism: what lives inside the network" },
              { t: "ul", items: [
                "<strong>Subnets</strong> hold resource interfaces and are where most placement decisions happen.",
                "<strong>Route tables</strong> (AWS, Azure user-defined routes) or <strong>VPC routes</strong> (GCP) decide the next hop for each destination.",
                "<strong>Gateways</strong> connect to the internet, NAT, on-premises or other networks.",
                "<strong>Filtering</strong>: security groups and NACLs (AWS), NSGs (Azure), VPC firewall rules and policies (GCP).",
                "<strong>DNS</strong>: a built-in resolver at a well-known address in every network."
              ] },
              { t: "h", text: "How many networks should you have?" },
              { t: "table", headers: ["Tier", "Design", "Why it scores that way"], rows: [
                ["Naive", "One big network for every environment and team", "One blast radius, no clean ownership, IAM and routing tangle quickly"],
                ["Solid", "One network per workload account or subscription per environment, from a central CIDR plan", "Isolation follows the account boundary; peering or a hub joins only what must talk"],
                ["Standout", "Solid, plus a hub (Transit Gateway, Virtual WAN or NCC) and shared VPC or VPC sharing for teams that should not run networking", "Platform owns routing and egress once; app teams get subnets, not network admin rights"]
              ] },
              { t: "compare",
                bad: { title: "Default network in production", items: ["Every region pre-created with public subnets", "Overlapping ranges across accounts", "Nobody owns its firewall rules"] },
                good: { title: "Custom network from a plan", items: ["CIDR comes from central allocation", "Only the subnets you need, named by tier", "Created by IaC with flow logs on"] } },
              { t: "p", html: "Interview cue: <em>'AWS and Azure scope the network to a region, GCP makes it global with regional subnets, so in GCP I get multi-region reachability for free but must be stricter with firewall rules because they apply network-wide.'</em>" },
              { t: "note", variant: "key", html: "<strong>Same concept, different scope.</strong> AWS VPC is regional with AZ-bound subnets, Azure VNet is regional with zone-spanning subnets, GCP VPC is global with regional subnets; plan subnet counts and connectivity around that." }
            ]
          },
          {
            id: "subnet-tiers",
            title: "Subnet tiers across zones and reserved addresses",
            summary: "Public, private-app and private-data tiers spread across zones, sized for growth after the provider takes its reserved addresses.",
            minutes: 10,
            tags: ["subnets", "availability-zones", "tiers", "reserved-ips"],
            blocks: [
              { t: "p", html: "The default shape for a production VPC is <strong>three tiers repeated across at least two zones</strong>. Tiers separate what the internet can reach from what only your services can reach, and repeating them per zone means one zone failing takes out a slice, not a tier." },
              { t: "diagram", id: "vpc-layout", caption: "One VPC across two AZs: public subnets hold the ALB and NAT gateways; private-app and private-data subnets have no inbound path from the internet." },
              { t: "table", headers: ["Tier", "Holds", "Default route", "Inbound from internet"], rows: [
                ["Public", "Load balancers, NAT gateways, bastion alternatives", "0.0.0.0/0 to the internet gateway", "Only to what you expose (for example the ALB on 443)"],
                ["Private-app", "Instances, containers, functions in a VPC", "0.0.0.0/0 to the NAT gateway in the same AZ", "None"],
                ["Private-data (isolated)", "Databases, caches, internal queues", "No default route, or endpoints only", "None"]
              ] },
              { t: "h", text: "Reserved addresses per subnet" },
              { t: "p", html: "Each provider keeps a few addresses in every subnet for its own plumbing, which matters most for small subnets." },
              { t: "table", headers: ["Provider", "Reserved per subnet", "Which ones (typical)", "Smallest IPv4 subnet"], rows: [
                ["AWS", "5", "Network, VPC router (+1), DNS (+2), future use (+3), last address", "/28 (11 usable)"],
                ["Azure", "5", "Network, default gateway (+1), DNS mapping (+2, +3), last address", "/29 (3 usable)"],
                ["GCP", "4", "Network, default gateway (+1), second-to-last, last address", "/29 (4 usable)"]
              ] },
              { t: "widget", id: "netCidrPlanner" },
              { t: "h", text: "Sizing rules that survive growth" },
              { t: "ul", items: [
                "Size private-app subnets for the peak, not today: container platforms that give each pod a VPC IP (EKS with the VPC CNI, AKS with Azure CNI, GKE VPC-native) consume addresses fast.",
                "Public subnets can be small (a /24 or /26) because they hold few interfaces.",
                "Leave unallocated space in the VPC for a fourth tier or another zone rather than handing it all out on day one.",
                "In AWS, one subnet per tier per AZ; in Azure and GCP, one subnet per tier usually suffices because subnets span zones."
              ] },
              { t: "note", variant: "tip", html: "Some Azure services need dedicated, named subnets (for example <code class='tok'>GatewaySubnet</code> for VPN or ExpressRoute gateways, and a dedicated subnet for Azure Firewall). Reserve space for them in the plan even if you do not deploy them yet." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'highly available', 'database must not be reachable from the internet', or 'survive an AZ outage' all point to tiered subnets repeated across zones, with the data tier having no internet route at all." },
              { t: "note", variant: "key", html: "<strong>Tiers separate reachability; zones separate failure.</strong> Public, private-app and isolated data tiers in every zone, sized for peak after the 5/5/4 reserved addresses, is the baseline a reviewer expects." }
            ]
          },
          {
            id: "routing-gateways",
            title: "Route tables, internet gateways, NAT and egress-only",
            summary: "Longest-prefix match, what makes a subnet public, NAT placement and cost, and IPv6 egress.",
            minutes: 10,
            tags: ["routing", "igw", "nat", "ipv6"],
            blocks: [
              { t: "p", html: "A route table is a lookup from destination CIDR to next hop. Every subnet is associated with exactly one route table, and the router picks the <strong>most specific matching route</strong>, never the first one listed." },
              { t: "widget", id: "netRouteLookup" },
              { t: "h", text: "The gateways" },
              { t: "table", headers: ["Job", "AWS", "Azure", "GCP"], rows: [
                ["Two-way internet", "Internet gateway (IGW), one per VPC, horizontally scaled", "Implicit system route to Internet plus a public IP on the resource", "Default internet gateway route plus an external IP"],
                ["Outbound-only IPv4", "NAT gateway (zonal) with an Elastic IP", "NAT Gateway resource attached to subnets", "Cloud NAT, configured on a Cloud Router, regional and software-defined"],
                ["Outbound-only IPv6", "Egress-only internet gateway", "No direct equivalent; filter outbound-only with NSG rules", "No direct equivalent; firewall rules provide the filtering"],
                ["Custom next hop", "Route to an ENI, appliance or GWLB endpoint", "User-defined route to a virtual appliance", "Route with next hop instance or internal load balancer"]
              ] },
              { t: "h", text: "NAT: placement and cost" },
              { t: "p", html: "An AWS NAT gateway lives in one AZ. Put one in each AZ's public subnet and point that AZ's private route table at it. You pay an hourly charge per gateway plus a per-GB processing charge on everything through it, so heavy egress such as image pulls, package downloads or calls to storage adds up quickly." },
              { t: "code", lang: "text", code:
                "Illustrative prices only - check current pricing for your region.\n\n" +
                "3 NAT gateways x 730 h x $0.045/h      = ~$99 / month fixed\n" +
                "20 TB processed  x $0.045/GB          = ~$920 / month variable\n\n" +
                "Same 20 TB, but 15 TB is S3 traffic moved to a gateway endpoint:\n" +
                "5 TB x $0.045/GB                      = ~$230 / month variable"
              },
              { t: "compare",
                bad: { title: "One NAT gateway for all AZs", items: ["Cheaper hourly line item", "AZ outage removes egress for every AZ", "Cross-AZ data charges on every byte from other AZs"] },
                good: { title: "One NAT gateway per AZ", items: ["Each AZ fails independently", "No cross-AZ hop for egress", "Costs more hourly; offload storage traffic to endpoints to cut processing"] } },
              { t: "note", variant: "tip", html: "Providers keep adding NAT options (for example regional or zone-redundant modes). At the time of writing the per-AZ pattern is still the one reviewers expect you to explain; mention newer modes as an option, not a default." },
              { t: "h", text: "IPv6 in one paragraph" },
              { t: "p", html: "AWS gives a VPC a /56 and each subnet a /64 of globally unique IPv6. There is no NAT for IPv6 because addresses are not scarce; instead, an <strong>egress-only internet gateway</strong> lets instances start outbound connections while blocking unsolicited inbound ones. Dual-stack subnets still need IPv4 egress for anything that is IPv4-only." },
              { t: "note", variant: "trap", html: "A route to the internet gateway does not by itself make an instance reachable: it also needs a public IP and an SG that allows the traffic. Equally, a private subnet with a NAT route can still leak data outbound, so filter egress too." },
              { t: "quiz", id: "net-vpc" },
              { t: "note", variant: "key", html: "<strong>Most specific route wins; the default route decides public versus private.</strong> IGW for two-way, NAT per AZ for outbound IPv4 (and watch its per-GB charge), egress-only IGW for IPv6." }
            ]
          }
        ]
      },
      {
        id: "traffic",
        name: "Traffic Control & Connectivity",
        icon: "shield",
        lessons: [
          {
            id: "sg-nacl",
            title: "Security groups, NACLs, NSGs and firewall rules",
            summary: "Stateful versus stateless filtering, rule ordering, SG references, and the cross-cloud equivalents.",
            minutes: 11,
            tags: ["security-groups", "nacl", "nsg", "firewall"],
            blocks: [
              { t: "p", html: "Cloud filtering comes in two flavours. A <strong>stateful</strong> filter remembers each allowed connection and lets its replies through automatically. A <strong>stateless</strong> filter judges every packet on its own, so you must allow both directions explicitly. Almost every 'the request arrives but the client times out' ticket is a stateless rule missing its return path." },
              { t: "table", headers: ["Property", "AWS security group", "AWS network ACL"], rows: [
                ["Attached to", "Network interfaces (ENIs)", "Subnets"],
                ["State", "Stateful", "Stateless"],
                ["Rule types", "Allow only", "Allow and deny"],
                ["Evaluation", "All rules considered together", "Numbered rules, lowest first, first match wins"],
                ["Defaults", "No inbound; all outbound allowed", "Default NACL allows all; a new custom NACL denies all"],
                ["Sources", "CIDRs, prefix lists, <strong>other security groups</strong>", "CIDRs only"]
              ] },
              { t: "widget", id: "netSgNacl" },
              { t: "h", text: "Ephemeral ports" },
              { t: "p", html: "A client connects from a short-lived source port. Replies go back to that port. Operating systems use different ranges (Linux commonly 32768-60999, Windows 49152-65535), and load balancers and NAT gateways may use 1024-65535, which is why NACL return rules usually open <code class='tok'>1024-65535</code>." },
              { t: "h", text: "Reference security groups, not CIDRs" },
              { t: "code", lang: "javascript", code:
                "// App tier: accept 8080 only from members of the ALB security group\n" +
                "{\n" +
                "  \"IpProtocol\": \"tcp\", \"FromPort\": 8080, \"ToPort\": 8080,\n" +
                "  \"UserIdGroupPairs\": [{ \"GroupId\": \"sg-alb\" }]\n" +
                "}\n\n" +
                "// Data tier: accept 5432 only from the app tier's security group\n" +
                "{\n" +
                "  \"IpProtocol\": \"tcp\", \"FromPort\": 5432, \"ToPort\": 5432,\n" +
                "  \"UserIdGroupPairs\": [{ \"GroupId\": \"sg-app\" }]\n" +
                "}"
              },
              { t: "code", lang: "text", code:
                "# ANTI-PATTERN - do not ship. Database and SSH open to the whole internet.\n" +
                "resource \"aws_security_group_rule\" \"bad_db\" {\n" +
                "  type        = \"ingress\"\n" +
                "  from_port   = 5432\n" +
                "  to_port     = 5432\n" +
                "  protocol    = \"tcp\"\n" +
                "  cidr_blocks = [\"0.0.0.0/0\"]   # anti-pattern: use source_security_group_id\n" +
                "}\n" +
                "# Same for 22/3389: replace SSH/RDP with Session Manager, Bastion or IAP."
              },
              { t: "h", text: "The cross-cloud map" },
              { t: "table", headers: ["Concept", "AWS", "Azure", "GCP"], rows: [
                ["Stateful filter", "Security group (per ENI)", "Network security group (per subnet and/or NIC)", "VPC firewall rules (network-wide, targeted by tag or service account)"],
                ["Rule order", "Unordered, allow only", "Priority 100-4096, allow and deny", "Priority 0-65535, lower wins, allow and deny"],
                ["Group by workload", "SG references", "Application security groups", "Network tags or, better, service accounts"],
                ["Stateless subnet ACL", "Network ACL", "No equivalent", "No equivalent"],
                ["Org-wide guardrails", "Firewall Manager policies", "Azure Firewall policy, Virtual Network Manager admin rules", "Hierarchical firewall policies at org/folder"]
              ] },
              { t: "note", variant: "warn", html: "GCP firewall rules apply to the whole global network, and a rule with no target applies to every instance. Always target by service account in production; tags can be set by anyone who can edit the instance." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'requests arrive but responses never come back' means a stateless return rule; 'only the web tier may reach the database' means SG references or service-account targeting, not CIDRs." },
              { t: "note", variant: "key", html: "<strong>Security groups are stateful allow-lists you chain by reference; NACLs are stateless, ordered and need return rules.</strong> Azure NSGs and GCP firewall rules are both stateful, and no one should ever see 0.0.0.0/0 on an admin or database port." }
            ]
          },
          {
            id: "peering-transit",
            title: "Peering, Transit Gateway and hub-and-spoke designs",
            summary: "Why peering does not scale, how a transit hub segments routing, and what Azure and GCP use instead.",
            minutes: 10,
            tags: ["peering", "transit-gateway", "virtual-wan", "ncc", "shared-vpc"],
            blocks: [
              { t: "p", html: "VPC peering joins exactly two networks with a private route. It is fast, cheap and simple, and it is <strong>non-transitive</strong>: if A peers with B and B with C, A still cannot reach C. With n VPCs, a full mesh needs n(n-1)/2 peerings, which is 45 at ten VPCs and 190 at twenty." },
              { t: "diagram", id: "hub-spoke", caption: "A transit hub: spoke VPCs and a shared-services VPC attach once, and on-premises joins through VPN or Direct Connect on the same hub." },
              { t: "table", headers: ["Option", "Topology", "Strength", "Cost"], rows: [
                ["VPC peering", "Point to point", "No hourly charge, lowest latency, no bandwidth bottleneck", "Mesh explosion, no transitive routing, no central inspection"],
                ["Transit Gateway", "Hub and spoke, regional; peer hubs across regions", "Transitive routing, multiple route tables for segmentation, on-prem on the same hub", "Per-attachment hourly charge plus per-GB processing"],
                ["PrivateLink", "Service-to-consumer, one direction", "Exposes one service, tolerates overlapping CIDRs", "Per endpoint hour and per GB"]
              ] },
              { t: "h", text: "Segmentation with route tables" },
              { t: "p", html: "A transit gateway can hold several route tables. Associate production spokes with a production table and development spokes with a development table, and propagate only shared-services routes into both. Production and development then share the hub without being able to reach each other." },
              { t: "code", lang: "text", code:
                "TGW route table: prod\n" +
                "  10.0.0.0/12   -> prod spoke attachments (propagated)\n" +
                "  10.255.0.0/16 -> shared-services attachment\n" +
                "  0.0.0.0/0     -> egress / inspection VPC attachment\n\n" +
                "TGW route table: dev\n" +
                "  10.16.0.0/12  -> dev spoke attachments (propagated)\n" +
                "  10.255.0.0/16 -> shared-services attachment\n" +
                "  # no prod routes: dev cannot reach prod"
              },
              { t: "h", text: "The Azure and GCP answers" },
              { t: "table", headers: ["Need", "AWS", "Azure", "GCP"], rows: [
                ["Two-network link", "VPC peering", "VNet peering (also non-transitive)", "VPC Network Peering (non-transitive)"],
                ["Managed hub", "Transit Gateway", "Virtual WAN hub, or a self-built hub VNet with Azure Firewall or an NVA and gateway transit", "Network Connectivity Center hub with VPC and hybrid spokes"],
                ["Let teams use a central network", "VPC sharing through Resource Access Manager", "No exact equivalent; usually spoke VNets per subscription peered to the hub", "Shared VPC: a host project shares subnets with service projects"]
              ] },
              { t: "note", variant: "warn", html: "These are loose equivalents. Shared VPC in GCP is the default enterprise pattern and differs from a transit hub: it shares one network, rather than joining many. Azure hub VNets need user-defined routes to force spoke-to-spoke traffic through the firewall." },
              { t: "table", headers: ["Tier", "Design for 30 VPCs plus on-prem", "Why"], rows: [
                ["Naive", "Full mesh of peerings", "435 peerings, no central egress or inspection"],
                ["Solid", "Transit Gateway with prod/dev/shared route tables and on-prem attached to the hub", "Linear growth, segmentation, one hybrid edge"],
                ["Standout", "Solid, plus a central inspection VPC and egress VPC, and peering kept only for a few high-volume pairs", "Inspection where policy needs it, peering where per-GB hub charges hurt"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'dozens of accounts', 'central egress', 'inspect east-west traffic' or 'connect every VPC to the data centre' all mean a transit hub; 'two VPCs, heavy traffic, nothing else' means peering." },
              { t: "note", variant: "key", html: "<strong>Peering is a cable between two networks; a hub is a router for many.</strong> Peering is non-transitive and free per hour; Transit Gateway, Virtual WAN and NCC give transitive, segmented routing for a per-attachment and per-GB price." }
            ]
          },
          {
            id: "hybrid",
            title: "Hybrid connectivity: site-to-site VPN and dedicated links",
            summary: "IPsec VPN versus Direct Connect, ExpressRoute and Cloud Interconnect, with BGP, redundancy and encryption.",
            minutes: 9,
            tags: ["vpn", "direct-connect", "expressroute", "interconnect", "bgp"],
            blocks: [
              { t: "p", html: "Hybrid connectivity is how the data centre and the cloud reach each other privately. You have two families: an <strong>encrypted tunnel over the internet</strong>, which is quick to set up and cheap, and a <strong>dedicated private circuit</strong>, which gives predictable bandwidth and latency at a higher cost and a longer lead time." },
              { t: "table", headers: ["Family", "AWS", "Azure", "GCP"], rows: [
                ["IPsec over internet", "Site-to-Site VPN (two tunnels per connection)", "VPN Gateway", "Cloud VPN (HA VPN)"],
                ["Dedicated circuit", "Direct Connect (dedicated or hosted)", "ExpressRoute", "Cloud Interconnect (Dedicated or Partner)"],
                ["Dynamic routing", "BGP on the virtual private gateway or TGW", "BGP on the gateway", "BGP through Cloud Router"],
                ["Cross-site extras", "Direct Connect gateway for multi-region", "ExpressRoute Global Reach links on-prem sites", "Cross-Cloud Interconnect to other providers"]
              ] },
              { t: "stat", items: [
                { v: "~1.25 Gbps", k: "typical per AWS VPN tunnel" },
                { v: "1-100 Gbps", k: "dedicated circuit port speeds" },
                { v: "Weeks", k: "typical circuit lead time" },
                { v: "Minutes", k: "to stand up a VPN" }
              ] },
              { t: "h", text: "Mechanism: redundancy and routing" },
              { t: "ul", items: [
                "Run at least two tunnels or circuits, terminated on different customer devices and, for circuits, at different locations.",
                "Use BGP so routes are learned and withdrawn automatically; static routes do not fail over.",
                "A common resilient pattern is a dedicated circuit as primary with a VPN as backup, steering with BGP attributes such as AS path prepending or local preference.",
                "Advertise summarised prefixes, and watch provider limits on how many routes you can advertise over a session."
              ] },
              { t: "note", variant: "warn", html: "Dedicated circuits are private but <strong>not encrypted by default</strong>. If policy requires encryption in transit, use MACsec where your port supports it, run IPsec over the circuit, or rely on TLS end to end." },
              { t: "compare",
                bad: { title: "Single VPN tunnel, static routes", items: ["One device reboot is an outage", "Failover is manual", "Bandwidth capped by one tunnel"] },
                good: { title: "Two circuits plus VPN backup, all BGP", items: ["Location and device diversity", "Automatic failover", "Encryption decided explicitly, not assumed"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'migrate in weeks' or 'branch offices' points to VPN first; 'predictable latency', 'large nightly transfers' or 'regulated data from the data centre' points to dedicated circuits, with a stated encryption plan." },
              { t: "p", html: "Interview cue: <em>'I would start with HA VPN to unblock the migration, order two dedicated circuits in separate locations for steady state, keep the VPN as BGP backup, and add MACsec or IPsec because the circuit alone is not encrypted.'</em>" },
              { t: "note", variant: "key", html: "<strong>VPN is fast to start; dedicated circuits are predictable.</strong> Make either redundant, route with BGP, land it on the hub, and never assume a private circuit is an encrypted one." }
            ]
          },
          {
            id: "private-access",
            title: "Private access to services: endpoints, Private Link and PSC",
            summary: "Gateway versus interface endpoints, Azure private endpoints, GCP Private Service Connect, and the DNS that makes them work.",
            minutes: 10,
            tags: ["privatelink", "vpc-endpoints", "private-endpoint", "psc"],
            blocks: [
              { t: "p", html: "Managed services listen on public endpoints by default. Private access puts a path to them <strong>inside your network</strong>, so a private subnet with no NAT can still reach storage, queues or a partner's API, and you can deny access from anywhere else." },
              { t: "table", headers: ["Type", "How it works", "Services", "Cost"], rows: [
                ["AWS gateway endpoint", "Adds a prefix-list route to chosen route tables", "S3 and DynamoDB only", "No hourly or data charge"],
                ["AWS interface endpoint (PrivateLink)", "ENIs with private IPs in your subnets; private DNS overrides the public name", "Most AWS services, your own services, partner SaaS", "Per endpoint per AZ hour, plus per GB"],
                ["Azure private endpoint", "A NIC with a private IP for one resource", "Most PaaS, plus your services via Private Link service", "Per hour plus per GB"],
                ["Azure service endpoint", "Optimised route from a subnet; service keeps its public IP", "Selected PaaS", "No charge"],
                ["GCP Private Service Connect", "An internal IP endpoint for Google APIs or a published service", "Google APIs, producer services, some partner services", "Per endpoint and per GB"],
                ["GCP Private Google Access", "Subnet setting letting internal-only VMs reach Google APIs", "Google APIs", "No charge"]
              ] },
              { t: "h", text: "DNS is half the feature" },
              { t: "p", html: "Clients keep using the normal hostname. Private access works because DNS inside your network resolves that name to the private IP instead of the public one: AWS private DNS on the interface endpoint, Azure Private DNS zones such as <code class='tok'>privatelink.blob.core.windows.net</code> linked to your VNets, and Cloud DNS private zones in GCP." },
              { t: "code", lang: "javascript", code:
                "// S3 bucket policy: only accept requests that arrive through our endpoint\n" +
                "{\n" +
                "  \"Effect\": \"Deny\",\n" +
                "  \"Principal\": \"*\",\n" +
                "  \"Action\": \"s3:*\",\n" +
                "  \"Resource\": [\"arn:aws:s3:::reports-<ACCOUNT_ID>\", \"arn:aws:s3:::reports-<ACCOUNT_ID>/*\"],\n" +
                "  \"Condition\": { \"StringNotEquals\": { \"aws:SourceVpce\": \"vpce-0123example\" } }\n" +
                "}"
              },
              { t: "note", variant: "trap", html: "Test a deny-unless-endpoint policy before applying it: it also blocks the console, CI pipelines and other services that reach the bucket from outside that endpoint, including you." },
              { t: "h", text: "Publishing your own service privately" },
              { t: "p", html: "Put a Network Load Balancer in front of the service and create an endpoint service (AWS), Private Link service (Azure) or a PSC published service (GCP). Consumers create an endpoint in their own network. Traffic is one-directional and CIDRs can overlap, which is why platform teams use this to expose shared services to hundreds of accounts without routing them all together." },
              { t: "h", text: "Service-to-service across accounts: VPC Lattice" },
              { t: "p", html: "<strong>Amazon VPC Lattice</strong> is an application-layer service network. You register services (backed by instances, IPs, containers or Lambda) into a service network, associate VPCs with it, and clients in those VPCs call services by name across accounts and VPCs. No peering, no Transit Gateway routes, and overlapping CIDRs are fine. Auth policies can require SigV4-signed IAM identities per service, so access control moves from IP ranges to identities." },
              { t: "table", headers: ["Need", "Reach for"], rows: [
                ["Expose one service to many consumer VPCs, one direction, at layer 4", "PrivateLink endpoint service"],
                ["Many services calling each other across accounts over HTTP or gRPC with IAM auth", "VPC Lattice"],
                ["Full network routing between VPCs and on-premises", "Transit Gateway or Cloud WAN"],
                ["Azure and Google Cloud nearest equivalents", "Private Link services and an internal API layer; GCP PSC with service-level access, or a service mesh"]
              ] },
              { t: "table", headers: ["Tier", "Reaching storage from private subnets", "Trade-off"], rows: [
                ["Naive", "Through the NAT gateway", "Per-GB NAT charge on every byte; traffic leaves the private path"],
                ["Solid", "Gateway endpoint for storage, interface endpoints for the few APIs you call", "Cheaper and private; endpoints cost per AZ hour"],
                ["Standout", "Solid, plus endpoint policies and resource policies that require the endpoint, with interface endpoints centralised in a shared VPC and shared via DNS", "Strong data perimeter; DNS design becomes a platform responsibility"]
              ] },
              { t: "quiz", id: "net-traffic" },
              { t: "note", variant: "key", html: "<strong>Private access is an endpoint plus DNS plus a policy that requires it.</strong> Gateway endpoints for S3 and DynamoDB are free; interface endpoints, Azure private endpoints and GCP PSC put a private IP in your network for everything else." }
            ]
          }
        ]
      },
      {
        id: "edge",
        name: "Edge, DNS & Delivery",
        icon: "globe",
        lessons: [
          {
            id: "dns",
            title: "DNS: Route 53, Azure DNS and Cloud DNS",
            summary: "Public and private zones, alias records, routing policies, health checks and hybrid resolution.",
            minutes: 10,
            tags: ["dns", "route53", "azure-dns", "cloud-dns", "resolver"],
            blocks: [
              { t: "p", html: "DNS is the first hop of every request and the cheapest global traffic manager you will ever run. Think of a cloud DNS service as two things: an <strong>authoritative</strong> host for your zones, and a <strong>resolver</strong> inside each network that answers private names and forwards everything else." },
              { t: "table", headers: ["Capability", "AWS", "Azure", "GCP"], rows: [
                ["Public zones", "Route 53 public hosted zones", "Azure DNS zones", "Cloud DNS public zones"],
                ["Private zones", "Private hosted zones associated with VPCs", "Private DNS zones linked to VNets", "Cloud DNS private zones bound to networks"],
                ["Policy-based answers", "Route 53 routing policies", "Traffic Manager (DNS-based), separate from Azure DNS", "Cloud DNS routing policies"],
                ["Hybrid resolution", "Route 53 Resolver inbound and outbound endpoints with forwarding rules", "Azure DNS Private Resolver", "Inbound server policies and forwarding zones"]
              ] },
              { t: "h", text: "Route 53 routing policies" },
              { t: "table", headers: ["Policy", "Answers with", "Use it for"], rows: [
                ["Simple", "One record set", "A single endpoint"],
                ["Weighted", "Records in proportion to weights", "Canary and blue/green shifts, for example 95/5"],
                ["Latency", "The region with the lowest measured latency to the resolver", "Active-active multi-region"],
                ["Failover", "Primary while healthy, otherwise secondary", "Active-passive DR"],
                ["Geolocation", "Records by the client's continent or country", "Data residency, localised content"],
                ["Geoproximity, IP-based, multivalue", "Distance with bias, client CIDR, several healthy IPs", "Specialised steering"]
              ] },
              { t: "h", text: "Alias records" },
              { t: "p", html: "The zone apex (<code class='tok'>shop.example</code>) cannot be a CNAME. A Route 53 <strong>alias</strong> record looks like an A or AAAA record to clients but follows the target's changing addresses, and queries for AWS targets such as load balancers and CloudFront are not charged. Azure DNS has alias records for some Azure resources, and other providers offer similar apex-flattening features." },
              { t: "h", text: "Hybrid DNS" },
              { t: "code", lang: "text", code:
                "On-prem asks for orders.internal.shop.example\n" +
                "  -> on-prem DNS conditional forwarder -> Route 53 Resolver INBOUND endpoint IPs\n" +
                "  -> private hosted zone answers 10.0.21.14\n\n" +
                "EC2 asks for ldap.corp.example\n" +
                "  -> VPC resolver (base + 2) matches a FORWARD rule for corp.example\n" +
                "  -> OUTBOUND endpoint sends the query to on-prem DNS servers"
              },
              { t: "note", variant: "warn", html: "DNS failover is only as fast as caching allows. Set TTLs to 60 seconds or less on records you may fail over, and remember some clients and resolvers ignore low TTLs." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'canary 5% of users' means weighted; 'route users to the nearest region' means latency; 'standby region' means failover with health checks; 'on-prem must resolve cloud names' means resolver endpoints." },
              { t: "note", variant: "key", html: "<strong>Authoritative zones plus a resolver per network.</strong> Use alias records at the apex, pick the routing policy that matches the traffic goal, keep TTLs short on failover records, and wire resolver endpoints for hybrid names." }
            ]
          },
          {
            id: "load-balancers",
            title: "Load balancers: layer 7, layer 4 and gateway",
            summary: "ALB, NLB and GWLB against Application Gateway, Azure Load Balancer and Front Door, and GCP's global and regional load balancers.",
            minutes: 10,
            tags: ["alb", "nlb", "gwlb", "application-gateway", "front-door", "gcp-lb"],
            blocks: [
              { t: "p", html: "Choose a load balancer by three questions: <strong>what layer</strong> do you need to see (HTTP or just TCP/UDP), <strong>what scope</strong> (one region or global), and <strong>who is the client</strong> (the internet, internal services, or an inspection appliance)." },
              { t: "table", headers: ["Type", "AWS", "Azure", "GCP"], rows: [
                ["Regional HTTP(S), L7", "Application Load Balancer", "Application Gateway (with optional WAF)", "Regional external or internal Application LB"],
                ["Global HTTP(S), L7", "CloudFront in front of regional ALBs, or Global Accelerator", "Front Door", "Global external Application LB (single anycast IP)"],
                ["TCP/UDP, L4", "Network Load Balancer", "Azure Load Balancer (regional; a cross-region tier exists)", "Passthrough or proxy Network LBs, external and internal"],
                ["Appliance insertion", "Gateway Load Balancer (GENEVE)", "Gateway Load Balancer", "No direct equivalent; next-hop internal LB routes are used"],
                ["DNS-based steering", "Route 53 policies", "Traffic Manager", "Cloud DNS routing policies"]
              ] },
              { t: "h", text: "What each AWS option is for" },
              { t: "ul", items: [
                "<strong>ALB</strong>: host and path routing, header rules, redirects, TLS termination, WAF attachment, targets that are instances, IPs, containers or functions.",
                "<strong>NLB</strong>: layer 4, millions of requests per second, static or Elastic IP per AZ, client source IP preserved for many target types, TLS passthrough or termination. The front door for PrivateLink services.",
                "<strong>GWLB</strong>: sends traffic transparently through a fleet of firewalls or IDS appliances using GENEVE encapsulation, then back to its path."
              ] },
              { t: "code", lang: "text", code:
                "ALB listener rules for api.shop.example (HCL-style sketch)\n\n" +
                "listener 443 (TLS cert from the managed certificate service)\n" +
                "  rule 10: path /orders/*   -> target group orders-svc   (port 8080)\n" +
                "  rule 20: path /search/*   -> target group search-svc   (port 8080)\n" +
                "  rule 30: header x-canary  -> target group orders-v2    (weight 100)\n" +
                "  default:                  -> fixed 404\n" +
                "listener 80\n" +
                "  default: redirect to 443"
              },
              { t: "compare",
                bad: { title: "ALB for everything", items: ["Raw TCP or UDP services do not fit", "No static IPs for partner allow-lists", "Extra latency for non-HTTP work"] },
                good: { title: "Match layer and scope", items: ["ALB or Application Gateway for HTTP routing", "NLB for TCP, static IPs and PrivateLink", "A global L7 edge when users are worldwide"] } },
              { t: "table", headers: ["Tier", "Front door for a global web shop", "Why"], rows: [
                ["Naive", "One ALB in one region, its DNS name handed to users", "Single-region blast radius, no edge caching or WAF"],
                ["Solid", "ALB per region behind Route 53 latency or failover records, WAF on each ALB", "Regional failover; DNS TTLs limit how fast it shifts"],
                ["Standout", "Global edge (CloudFront or Global Accelerator, Front Door, GCP global LB) with WAF, health-based origin failover, and origins accepting only edge traffic", "Fast failover without DNS caching, attacks absorbed at the edge, costs an extra layer to operate"]
              ] },
              { t: "note", variant: "tip", html: "Health checks decide everything. Point them at a lightweight endpoint that checks the instance's own dependencies, not the whole downstream graph, or one slow database marks every target unhealthy at once." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'path-based routing' or 'WAF' means L7; 'gaming, UDP, static IP, preserve client IP' means L4; 'insert third-party firewalls' means a gateway load balancer; 'one IP worldwide' means a global L7 edge." },
              { t: "note", variant: "key", html: "<strong>Pick by layer, scope and client.</strong> ALB, Application Gateway and GCP Application LBs for HTTP; NLB, Azure Load Balancer and Network LBs for L4; GWLB to insert appliances; Front Door or GCP's global LB for a worldwide entry point." }
            ]
          },
          {
            id: "cdn-flowlogs",
            title: "CDN, edge protection and flow logs",
            summary: "Caching at the edge with CloudFront, Front Door and Cloud CDN, locking origins down, and the flow logs that prove what happened.",
            minutes: 10,
            tags: ["cdn", "cloudfront", "front-door", "cloud-cdn", "flow-logs"],
            blocks: [
              { t: "p", html: "A CDN puts copies of your responses in edge locations near users. Every cache hit is a request your origin never sees, which cuts latency, origin load and egress cost at once. The edge is also the best place to absorb attacks, because it is built to take volume you cannot." },
              { t: "table", headers: ["Concern", "AWS", "Azure", "GCP"], rows: [
                ["CDN", "CloudFront", "Front Door (Standard/Premium), which absorbs the older Azure CDN offerings", "Cloud CDN, attached to the global external Application LB"],
                ["WAF at the edge", "AWS WAF on CloudFront", "WAF policy on Front Door", "Cloud Armor"],
                ["DDoS baseline", "Shield Standard (automatic); Shield Advanced optional", "Infrastructure protection built in; DDoS Protection plans optional", "Built-in edge protection; Cloud Armor adaptive features optional"],
                ["Edge code", "CloudFront Functions, Lambda@Edge", "Front Door rules engine", "Service extensions and LB routing rules"]
              ] },
              { t: "h", text: "Mechanism: what decides a cache hit" },
              { t: "ul", items: [
                "The <strong>cache key</strong>: host, path, and only the query strings, headers and cookies you choose. Adding every header to the key destroys the hit ratio.",
                "<strong>TTLs</strong> from origin <code class='tok'>Cache-Control</code> headers, bounded by the CDN's minimum and maximum settings.",
                "<strong>Versioned asset names</strong> (<code class='tok'>app.3f9c.js</code>) let you cache for a year and never invalidate.",
                "<strong>Origin lock-down</strong>: storage origins accept only the CDN (for example CloudFront origin access control), and load balancer origins check a secret header or the CDN's managed prefix list."
              ] },
              { t: "stat", items: [
                { v: "90%+", k: "hit ratio typical for static assets" },
                { v: "1 year", k: "TTL for fingerprinted files" },
                { v: "0-60 s", k: "TTL for personalised HTML, or bypass" }
              ] },
              { t: "h", text: "Flow logs: the network's audit trail" },
              { t: "p", html: "Flow logs record connection metadata (source, destination, ports, protocol, bytes, and accept or reject) aggregated over an interval, not packet payloads. They are how you prove a security group blocked something, find the instance talking to an unexpected IP, or work out who is driving NAT charges." },
              { t: "table", headers: ["Provider", "Feature", "Scope", "Destinations"], rows: [
                ["AWS", "VPC Flow Logs", "VPC, subnet or ENI", "CloudWatch Logs, S3, Firehose"],
                ["Azure", "VNet flow logs (NSG flow logs are being retired in their favour)", "VNet, subnet or NIC", "Storage account, Traffic Analytics in Log Analytics"],
                ["GCP", "VPC Flow Logs, plus Firewall Rules Logging", "Subnet, with a sampling rate", "Cloud Logging, then sinks to BigQuery or storage"]
              ] },
              { t: "code", lang: "text", code:
                "# IaC baseline: flow logs on every VPC, to a central log archive bucket\n" +
                "resource \"aws_flow_log\" \"vpc\" {\n" +
                "  vpc_id               = aws_vpc.main.id\n" +
                "  traffic_type         = \"ALL\"            # ACCEPT and REJECT\n" +
                "  log_destination_type = \"s3\"\n" +
                "  log_destination      = var.central_flow_log_bucket_arn\n" +
                "  max_aggregation_interval = 60\n" +
                "}"
              },
              { t: "note", variant: "tip", html: "Flow logs cost money at scale (ingestion and storage). Send them to object storage with a lifecycle policy, query on demand, and keep only REJECT records in the expensive hot log store if budget is tight." },
              { t: "quiz", id: "net-edge" },
              { t: "note", variant: "key", html: "<strong>Cache at the edge, lock the origin, log every flow.</strong> A tight cache key and versioned assets drive hit ratio, WAF and DDoS protection belong at the edge, and flow logs on every network are non-negotiable evidence." }
            ]
          }
        ]
      }
    ]
  };
})();
