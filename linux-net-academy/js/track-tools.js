/* =====================================================================
   KERNEL · Network Tools & Troubleshooting
   window.TRACKS.tools — modules: inspect / probe / filter

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

  function roLine(text) {
    return h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, text);
  }

  function term(text) {
    return h("pre", {
      style: "margin:0;padding:12px 14px;border-radius:10px;background:var(--surface-solid);color:var(--text);" +
        "border:1px solid var(--line);font-family:var(--font-mono);font-size:0.8rem;line-height:1.55;white-space:pre-wrap;overflow-x:auto"
    }, text);
  }

  function textInput(value, label, onChange) {
    var inp = h("input", {
      type: "text", value: value, "aria-label": label, spellcheck: "false",
      style: "background:var(--surface-solid);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--font-mono);font-size:0.8rem;width:150px"
    });
    inp.value = value;
    inp.addEventListener("input", function () { onChange(String(inp.value || "")); });
    return h("label", { class: "w-field" }, label, inp);
  }

  function toggleBtn(label, initial, onToggle) {
    var on = !!initial;
    var b = h("button", { type: "button", class: "w-btn" + (on ? " primary" : "") }, label + (on ? ": on" : ": off"));
    b.addEventListener("click", function () {
      on = !on;
      b.className = "w-btn" + (on ? " primary" : "");
      b.textContent = label + (on ? ": on" : ": off");
      onToggle(on);
    });
    return b;
  }

  var HOST_RE = /^[A-Za-z0-9][A-Za-z0-9.\-:]{0,252}$/;
  function validPort(s) {
    if (!/^\d{1,5}$/.test(String(s))) return 0;
    var n = parseInt(s, 10);
    return n >= 1 && n <= 65535 ? n : 0;
  }

  var Widgets = {};

  /* ==================================================================
     1. toolsCurlTiming — curl -w phase breakdown
  ================================================================== */
  var CURL_PHASES = [
    { id: "dns", label: "DNS lookup", def: 40, max: 600, color: "var(--cyan-ink)",
      advise: "Name resolution dominates. Time the resolver directly with dig, check the search-domain list and ndots (one name can become several lookups), and confirm with --resolve to skip DNS entirely." },
    { id: "tcp", label: "TCP connect", def: 30, max: 600, color: "var(--violet-ink)",
      advise: "The TCP handshake costs about one round trip. A large value means distance, a lossy path, or SYN retransmits (a full listen backlog or a dropping firewall). Check mtr to the host and ss -s on the server." },
    { id: "tls", label: "TLS handshake", def: 60, max: 800, color: "var(--amber-ink)",
      advise: "The TLS handshake dominates: TLS 1.2 needs two round trips where TLS 1.3 needs one, and a long certificate chain or missing session resumption adds more. Read the protocol version and chain in curl -v or openssl s_client." },
    { id: "server", label: "Server think time", def: 250, max: 3000, color: "var(--rose-ink)",
      advise: "Waiting for the first byte after the request was sent is the backend: application code, database queries, upstream calls. Network tools will not fix it; go to app logs and traces, and compare against a cheap health endpoint." },
    { id: "transfer", label: "Body transfer", def: 40, max: 2000, color: "var(--lime-ink)",
      advise: "Downloading the body dominates. Check size_download, whether compression is on, and throughput on the path; a big JSON payload over a long fat pipe is limited by window size and bandwidth." }
  ];

  Widgets.toolsCurlTiming = function (mount) {
    shell(mount, "simulator", "Where did the request time go?",
      "Set how long each phase takes. The panel prints what curl -w would report (cumulative seconds from the start) and a stacked bar of the phases, then names the phase to chase.");

    var vals = {};
    var scheme = "https";
    for (var i = 0; i < CURL_PHASES.length; i++) vals[CURL_PHASES[i].id] = CURL_PHASES[i].def;

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var sliders = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 18px;margin-bottom:14px" });

    function secs(ms) { return (ms / 1000).toFixed(6); }

    function paint() {
      try {
        var dns = vals.dns, tcp = vals.tcp, tls = scheme === "https" ? vals.tls : 0, srv = vals.server, xfer = vals.transfer;
        var tNl = dns, tConn = dns + tcp, tApp = scheme === "https" ? tConn + tls : 0;
        var tStart = tConn + tls + srv, tTotal = tStart + xfer;
        clear(stage);
        stage.appendChild(term(
          "$ curl -s -o /dev/null -w @timing.txt " + scheme + "://api.shop.example/orders\n" +
          "time_namelookup:    " + secs(tNl) + "\n" +
          "time_connect:       " + secs(tConn) + "\n" +
          "time_appconnect:    " + secs(tApp) + (scheme === "http" ? "   (always 0 without TLS)" : "") + "\n" +
          "time_starttransfer: " + secs(tStart) + "\n" +
          "time_total:         " + secs(tTotal)));
        var eff = { dns: dns, tcp: tcp, tls: tls, server: srv, transfer: xfer };
        var bar = h("div", { style: "display:flex;height:22px;border-radius:8px;overflow:hidden;margin-top:14px;border:1px solid var(--line);background:var(--surface-solid)" });
        var legend = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:0.78rem;color:var(--text-dim)" });
        var dom = CURL_PHASES[0], domV = -1;
        for (var j = 0; j < CURL_PHASES.length; j++) {
          var p = CURL_PHASES[j], v = eff[p.id];
          if (v > domV) { domV = v; dom = p; }
          var pct = tTotal > 0 ? (v / tTotal) * 100 : 0;
          if (pct > 0) bar.appendChild(h("i", { title: p.label, style: "display:block;height:100%;width:" + pct.toFixed(2) + "%;background:" + p.color }));
          legend.appendChild(h("span", {},
            h("i", { style: "display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:middle;background:" + p.color }),
            p.label + " " + v + " ms"));
        }
        stage.appendChild(bar);
        stage.appendChild(legend);
        clear(readout);
        var share = tTotal > 0 ? Math.round(domV / tTotal * 100) : 0;
        readout.appendChild(ro("total", tTotal + " ms"));
        readout.appendChild(ro("TTFB", tStart + " ms"));
        readout.appendChild(ro("dominant phase", tTotal > 0 ? dom.label : "none"));
        readout.appendChild(ro("share", share + "%"));
        readout.appendChild(roLine(tTotal > 0 ? "Investigate: " + dom.advise : "Every phase is zero; move a slider."));
      } catch (e) {
        clear(readout);
        readout.appendChild(roLine("Could not compute the breakdown for these values."));
      }
    }

    for (var k = 0; k < CURL_PHASES.length; k++) {
      (function (p) {
        var out = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink);min-width:58px;text-align:right" }, p.def + " ms");
        var inp = h("input", { type: "range", min: "0", max: String(p.max), step: "10", value: String(p.def), "aria-label": p.label + " in milliseconds", style: "flex:1" });
        inp.addEventListener("input", function () {
          var n = parseInt(inp.value, 10);
          vals[p.id] = isNaN(n) ? 0 : Math.max(0, Math.min(p.max, n));
          out.textContent = vals[p.id] + " ms";
          paint();
        });
        sliders.appendChild(h("label", { class: "w-field", style: "display:flex" }, h("span", { style: "min-width:118px" }, p.label), inp, out));
      })(CURL_PHASES[k]);
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["https", "HTTPS"], ["http", "plain HTTP (no TLS)"]], 0, function (v) { scheme = v; paint(); }),
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { vals.dns = 520; vals.tcp = 30; vals.tls = 60; vals.server = 120; vals.transfer = 30; paint(); } }, "Preset: slow resolver"),
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { vals.dns = 20; vals.tcp = 25; vals.tls = 50; vals.server = 2400; vals.transfer = 40; paint(); } }, "Preset: slow backend")
    ));
    mount.appendChild(sliders);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. toolsTcpdump — BPF filter builder with simulated output
  ================================================================== */
  var PORT_NAMES = { 22: "ssh", 53: "domain", 80: "http", 443: "https", 5353: "mdns" };

  Widgets.toolsTcpdump = function (mount) {
    shell(mount, "builder", "Build a tcpdump capture",
      "Pick the protocol, host, port, direction and flags. The panel composes the command with the filter quoted, explains each piece, and shows which packets of a small simulated capture would match.");

    var S = { proto: "tcp", host: "203.0.113.10", port: "443", dir: "either", syn: false, nn: true, iface: "any" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function buildPackets(H, tcpPort, udpPort) {
      var L = "10.0.0.5";
      return [
        { t: "12:00:01.000100", proto: "tcp", src: L, sport: 51544, dst: H, dport: tcpPort, flags: "S", info: "seq 1000, win 64240, length 0" },
        { t: "12:00:01.021400", proto: "tcp", src: H, sport: tcpPort, dst: L, dport: 51544, flags: "S.", info: "seq 7000, ack 1001, win 65160, length 0" },
        { t: "12:00:01.021480", proto: "tcp", src: L, sport: 51544, dst: H, dport: tcpPort, flags: ".", info: "ack 1, win 502, length 0" },
        { t: "12:00:01.022100", proto: "tcp", src: L, sport: 51544, dst: H, dport: tcpPort, flags: "P.", info: "seq 1:518, ack 1, win 502, length 517" },
        { t: "12:00:01.045900", proto: "tcp", src: H, sport: tcpPort, dst: L, dport: 51544, flags: "P.", info: "seq 1:1449, ack 518, win 509, length 1448" },
        { t: "12:00:01.090300", proto: "tcp", src: L, sport: 51544, dst: H, dport: tcpPort, flags: "F.", info: "seq 518, ack 1449, win 501, length 0" },
        { t: "12:00:02.100000", proto: "udp", src: L, sport: 40122, dst: H, dport: udpPort, info: "UDP, length 40" },
        { t: "12:00:02.118000", proto: "udp", src: H, sport: udpPort, dst: L, dport: 40122, info: "UDP, length 56" },
        { t: "12:00:03.000000", proto: "icmp", src: L, dst: H, info: "ICMP echo request, id 7, seq 1, length 64" },
        { t: "12:00:03.020500", proto: "icmp", src: H, dst: L, info: "ICMP echo reply, id 7, seq 1, length 64" },
        { t: "12:00:04.500000", proto: "tcp", src: L, sport: 52010, dst: "198.51.100.20", dport: 22, flags: "P.", info: "seq 1:89, ack 1, win 501, length 88" },
        { t: "12:00:04.700000", proto: "udp", src: L, sport: 5353, dst: "224.0.0.251", dport: 5353, info: "UDP, length 120" }
      ];
    }

    function fmtAddr(ip, nn) {
      if (nn) return ip;
      if (ip === "10.0.0.5") return "laptop.lan.example";
      return ip;
    }
    function fmtPort(p, nn) { return !nn && PORT_NAMES[p] ? PORT_NAMES[p] : String(p); }

    function fmtPkt(p, nn) {
      if (p.proto === "icmp") return p.t + " IP " + fmtAddr(p.src, nn) + " > " + fmtAddr(p.dst, nn) + ": " + p.info;
      var head = p.t + " IP " + fmtAddr(p.src, nn) + "." + fmtPort(p.sport, nn) + " > " + fmtAddr(p.dst, nn) + "." + fmtPort(p.dport, nn) + ": ";
      return p.proto === "tcp" ? head + "Flags [" + p.flags + "], " + p.info : head + p.info;
    }

    function paint() {
      try {
        var warnings = [];
        var hostOk = S.host === "" || HOST_RE.test(S.host);
        if (!hostOk) warnings.push("Host contains characters a BPF host term cannot take; it was left out.");
        var host = hostOk ? S.host : "";
        var portN = S.port === "" ? 0 : validPort(S.port);
        if (S.port !== "" && !portN) warnings.push("Port must be a whole number from 1 to 65535; it was left out.");
        if (portN && S.proto === "icmp") { warnings.push("ICMP has no ports, so 'port' would match nothing; it was left out."); portN = 0; }
        var syn = S.syn;
        if (syn && (S.proto === "udp" || S.proto === "icmp")) { warnings.push("SYN is a TCP flag; with " + S.proto + " the SYN test was left out."); syn = false; }

        var terms = [], explain = [];
        if (S.proto !== "any") { terms.push(S.proto); explain.push([S.proto, "only " + S.proto.toUpperCase() + " packets"]); }
        var hostDirUsed = false;
        if (host) {
          var ht = S.dir === "either" ? "host " + host : S.dir + " host " + host;
          terms.push(ht); hostDirUsed = true;
          explain.push([ht, S.dir === "either" ? "packets to or from " + host : "only packets whose " + (S.dir === "src" ? "source" : "destination") + " is " + host]);
        }
        if (portN) {
          var pt = (!hostDirUsed && S.dir !== "either") ? S.dir + " port " + portN : "port " + portN;
          terms.push(pt);
          explain.push([pt, pt === "port " + portN ? "the source or destination port is " + portN : "only packets whose " + (S.dir === "src" ? "source" : "destination") + " port is " + portN]);
        }
        if (syn) { terms.push("tcp[tcpflags] & tcp-syn != 0"); explain.push(["tcp[tcpflags] & tcp-syn != 0", "the SYN bit is set: matches both the client SYN and the server SYN-ACK"]); }
        var filter = terms.join(" and ");
        var cmd = "sudo tcpdump -i " + S.iface + (S.nn ? " -nn" : "") + " -c 20" + (filter ? " '" + filter + "'" : "");

        var H = host && /^[0-9.]+$/.test(host) ? host : (host || "203.0.113.10");
        var pkts = buildPackets(H, portN && S.proto !== "udp" ? portN : 443, portN && S.proto === "udp" ? portN : 53);
        var shown = [];
        for (var i = 0; i < pkts.length; i++) {
          var p = pkts[i];
          if (S.proto !== "any" && p.proto !== S.proto) continue;
          if (host) {
            if (S.dir === "either" && p.src !== H && p.dst !== H) continue;
            if (S.dir === "src" && p.src !== H) continue;
            if (S.dir === "dst" && p.dst !== H) continue;
          }
          if (portN) {
            if (p.proto === "icmp") continue;
            if (!hostDirUsed && S.dir === "src" && p.sport !== portN) continue;
            if (!hostDirUsed && S.dir === "dst" && p.dport !== portN) continue;
            if ((hostDirUsed || S.dir === "either") && p.sport !== portN && p.dport !== portN) continue;
          }
          if (syn && !(p.proto === "tcp" && p.flags.indexOf("S") === 0)) continue;
          shown.push(fmtPkt(p, S.nn));
        }

        clear(stage);
        stage.appendChild(term("$ " + cmd));
        var list = h("div", { style: "display:grid;grid-template-columns:minmax(140px,auto) 1fr;gap:4px 14px;margin:12px 0;font-size:0.82rem" });
        list.appendChild(h("code", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, "-i " + S.iface));
        list.appendChild(h("span", { style: "color:var(--text-dim)" }, S.iface === "any" ? "all interfaces (a Linux pseudo-device; macOS support varies)" : S.iface === "en0" ? "the usual Wi-Fi/Ethernet interface on a Mac" : "one Linux NIC"));
        list.appendChild(h("code", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, S.nn ? "-nn" : "(no -nn)"));
        list.appendChild(h("span", { style: "color:var(--text-dim)" }, S.nn ? "print raw IPs and port numbers, no lookups" : "resolve names and port names: slower, and the lookups add DNS traffic of their own"));
        list.appendChild(h("code", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, "-c 20"));
        list.appendChild(h("span", { style: "color:var(--text-dim)" }, "stop after 20 packets so the capture cannot run away"));
        for (var e = 0; e < explain.length; e++) {
          list.appendChild(h("code", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, explain[e][0]));
          list.appendChild(h("span", { style: "color:var(--text-dim)" }, explain[e][1]));
        }
        if (!filter) {
          list.appendChild(h("code", { style: "font-family:var(--font-mono);color:var(--amber-ink)" }, "(no filter)"));
          list.appendChild(h("span", { style: "color:var(--text-dim)" }, "everything on the interface: noisy on a busy host"));
        }
        stage.appendChild(list);
        stage.appendChild(term(shown.length ? shown.slice(0, 4).join("\n") + (shown.length > 4 ? "\n... " + (shown.length - 4) + " more" : "") : "(no packets in the simulated capture match this filter)"));

        clear(readout);
        readout.appendChild(ro("filter terms", terms.length));
        readout.appendChild(ro("matching packets", shown.length + " of " + pkts.length));
        readout.appendChild(ro("interface", S.iface));
        for (var w = 0; w < warnings.length; w++) readout.appendChild(roLine("Note: " + warnings[w]));
        if (S.iface === "any") readout.appendChild(roLine("On a Mac, prefer -i en0 (or another interface from ifconfig); 'any' is a Linux pseudo-interface and macOS tcpdump handles it differently."));
      } catch (err) {
        clear(readout);
        readout.appendChild(roLine("Could not build a command from these inputs."));
      }
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["any", "any proto"], ["tcp", "tcp"], ["udp", "udp"], ["icmp", "icmp"]], 1, function (v) { S.proto = v; paint(); }),
      segment([["either", "either"], ["src", "src"], ["dst", "dst"]], 0, function (v) { S.dir = v; paint(); }),
      segment([["any", "-i any"], ["eth0", "-i eth0"], ["en0", "-i en0 (macOS)"]], 0, function (v) { S.iface = v; paint(); })
    ));
    mount.appendChild(h("div", { class: "widget-controls" },
      textInput(S.host, "host", function (v) { S.host = v.trim(); paint(); }),
      textInput(S.port, "port", function (v) { S.port = v.trim(); paint(); }),
      toggleBtn("SYN only", false, function (on) { S.syn = on; paint(); }),
      toggleBtn("-nn", true, function (on) { S.nn = on; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. toolsFirewall — first-match rule evaluation
  ================================================================== */
  var FW_RULES = [
    { n: 1, text: "-A INPUT -i lo -j ACCEPT", target: "ACCEPT", m: function (p) { return p.iface === "lo"; } },
    { n: 2, text: "-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT", target: "ACCEPT", m: function (p) { return p.state === "ESTABLISHED" || p.state === "RELATED"; } },
    { n: 3, text: "-A INPUT -p tcp -s 10.0.0.0/8 --dport 22 -j ACCEPT", target: "ACCEPT", m: function (p) { return p.proto === "tcp" && p.dport === 22 && p.src.indexOf("10.") === 0; } },
    { n: 4, text: "-A INPUT -p tcp --dport 443 -j ACCEPT", target: "ACCEPT", m: function (p) { return p.proto === "tcp" && p.dport === 443; } },
    { n: 5, text: "-A INPUT -j DROP", target: "DROP", m: function () { return true; } }
  ];
  var FW_PACKETS = {
    sshMgmt: { label: "New SSH from 10.1.2.3", iface: "eth0", proto: "tcp", src: "10.1.2.3", dport: 22, state: "NEW" },
    sshNet: { label: "New SSH from 203.0.113.9", iface: "eth0", proto: "tcp", src: "203.0.113.9", dport: 22, state: "NEW" },
    reply: { label: "Reply to our outbound HTTPS call", iface: "eth0", proto: "tcp", src: "198.51.100.7", dport: 51544, state: "ESTABLISHED" },
    web8080: { label: "New TCP 8080 from 192.0.2.44", iface: "eth0", proto: "tcp", src: "192.0.2.44", dport: 8080, state: "NEW" },
    ping: { label: "ICMP ping from 10.1.2.3", iface: "eth0", proto: "icmp", src: "10.1.2.3", dport: 0, state: "NEW" },
    lo: { label: "App to local Postgres on lo", iface: "lo", proto: "tcp", src: "127.0.0.1", dport: 5432, state: "NEW" }
  };

  Widgets.toolsFirewall = function (mount) {
    shell(mount, "simulator", "First match wins",
      "An INPUT chain with policy DROP. Choose a test packet and watch it walk the rules top to bottom until one matches. Then break the ordering on purpose.");

    var pkt = "sshMgmt";
    var layout = "written";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function rules() {
      if (layout === "droptop") return [FW_RULES[4], FW_RULES[0], FW_RULES[1], FW_RULES[2], FW_RULES[3]];
      if (layout === "nodrop") return FW_RULES.slice(0, 4);
      return FW_RULES.slice(0);
    }

    function paint() {
      try {
        var p = FW_PACKETS[pkt] || FW_PACKETS.sshMgmt;
        var rs = rules();
        var hit = -1;
        for (var i = 0; i < rs.length; i++) { if (rs[i].m(p)) { hit = i; break; } }
        clear(stage);
        stage.appendChild(term("packet: in=" + p.iface + " proto=" + p.proto + " src=" + p.src + (p.dport ? " dport=" + p.dport : "") + " ctstate=" + p.state + "\n:INPUT DROP [policy]"));
        var list = h("div", { style: "display:grid;gap:6px;margin-top:12px" });
        for (var j = 0; j < rs.length; j++) {
          var status, col, bg = "";
          if (hit === -1 || j < hit) { status = "checked, no match"; col = "var(--text-faint)"; }
          if (j === hit) { status = "MATCH, " + rs[j].target; col = rs[j].target === "ACCEPT" ? "var(--lime-ink)" : "var(--rose-ink)"; bg = "background:color-mix(in srgb, var(--accent) 14%, transparent);"; }
          if (hit !== -1 && j > hit) { status = "never evaluated"; col = "var(--text-faint)"; }
          list.appendChild(h("div", { style: "display:grid;grid-template-columns:34px 1fr minmax(130px,auto);gap:10px;align-items:center;padding:7px 10px;border-radius:10px;border:1px solid var(--line);" + bg },
            h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink)" }, String(j + 1)),
            h("code", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text)" }, rs[j].text),
            h("span", { style: "font-size:0.8rem;font-weight:700;color:" + col }, status)));
        }
        if (hit === -1) list.appendChild(h("div", { style: "padding:7px 10px;border-radius:10px;border:1px dashed var(--line);font-size:0.82rem;color:var(--rose-ink);font-weight:700" }, "End of chain: default policy DROP applies"));
        stage.appendChild(list);

        var verdict = hit === -1 ? "DROP (policy)" : rs[hit].target;
        var why;
        if (layout === "droptop") why = "With the catch-all DROP first, every packet stops at position 1: loopback traffic, replies to your own connections and your SSH session all die. This is the classic lock-out.";
        else if (hit === -1) why = "No rule matched, so the chain policy decided. Relying on the policy is fine, but an explicit final rule makes the intent visible and lets you count drops.";
        else if (rs[hit].n === 2) why = "Conntrack recognised the packet as part of a connection this host already allowed, so it is accepted early without re-checking ports. This one rule is what makes the firewall stateful.";
        else if (rs[hit].n === 5) why = "Nothing above allowed it, so the catch-all DROP silently discards it. The sender sees a timeout, not a refusal.";
        else if (rs[hit].n === 3) why = "The source sits inside the management range 10.0.0.0/8, so the SSH allow rule matches.";
        else if (rs[hit].n === 1) why = "Loopback traffic is trusted first; local services talking to each other never touch the other rules.";
        else why = "Matched rule " + rs[hit].n + ".";
        clear(readout);
        readout.appendChild(ro("verdict", verdict));
        readout.appendChild(ro("decided by", hit === -1 ? "chain policy" : "position " + (hit + 1)));
        readout.appendChild(ro("rules evaluated", hit === -1 ? rs.length : hit + 1));
        readout.appendChild(roLine(why));
      } catch (e) {
        clear(readout);
        readout.appendChild(roLine("Could not evaluate this packet."));
      }
    }

    var pickRow = h("div", { class: "widget-controls" });
    var pktBtns = [];
    Object.keys(FW_PACKETS).forEach(function (key) {
      var b = h("button", { type: "button", class: "w-btn" + (key === pkt ? " primary" : "") }, FW_PACKETS[key].label);
      b.addEventListener("click", function () {
        pkt = key;
        for (var i = 0; i < pktBtns.length; i++) pktBtns[i].className = "w-btn";
        b.className = "w-btn primary";
        paint();
      });
      pktBtns.push(b);
      pickRow.appendChild(b);
    });
    mount.appendChild(pickRow);
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["written", "Rules as written"], ["droptop", "Move rule 5 to the top"], ["nodrop", "Delete rule 5"]], 0, function (v) { layout = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     4. toolsPicker — symptom → layer → next commands
  ================================================================== */
  var SYMPTOMS = [
    { id: "resolve", label: "curl: Could not resolve host", layer: "DNS (name resolution)",
      cmds: [
        ["getent hosts api.shop.example", "dscacheutil -q host -a name api.shop.example", "Asks the same resolver path your apps use. Empty output means the system resolver cannot answer: search domains, /etc/hosts, or VPN split DNS."],
        ["dig api.shop.example", "dig api.shop.example", "NXDOMAIN means the name truly does not exist; SERVFAIL points at the resolver or upstream; an answer here but nothing from getent means local resolver config, not DNS data."],
        ["resolvectl status", "scutil --dns", "Shows which resolvers and search domains apply per interface; a VPN often installs a resolver for specific domains only."]
      ] },
    { id: "refused", label: "Connection refused", layer: "TCP port: the host answered with a reset",
      cmds: [
        ["ss -tlnp | grep ':8443'", "lsof -nP -iTCP:8443 -sTCP:LISTEN", "Run on the server. No LISTEN line means the service is down or on another port; a listener on 127.0.0.1 only is unreachable from outside."],
        ["nc -zv api.shop.example 8443", "nc -zv api.shop.example 8443", "An instant refusal proves the path works and the host is up; only the port is closed (or a REJECT rule answered)."],
        ["sudo iptables -S | grep -i reject", "sudo pfctl -sr", "A reject-with tcp-reset rule looks exactly like a closed port from the client side."]
      ] },
    { id: "timeout", label: "Connection timed out", layer: "Path or firewall: packets silently dropped",
      cmds: [
        ["nc -zv -w 3 203.0.113.10 443", "nc -zv -G 3 203.0.113.10 443", "A hang then timeout means the SYN got no answer: a DROP rule, a security group, a wrong route, or the host is down."],
        ["ip route get 203.0.113.10", "route -n get 203.0.113.10", "Confirms which interface and gateway are used; a VPN split tunnel can send the SYN somewhere useless."],
        ["sudo tcpdump -nn -i any 'host 203.0.113.10 and port 443'", "sudo tcpdump -nn -i en0 'host 203.0.113.10 and port 443'", "SYNs leaving with no SYN-ACK back means the drop is beyond you; capture on the server too to see whether SYNs arrive."]
      ] },
    { id: "cert", label: "SSL certificate problem", layer: "TLS (trust and certificate)",
      cmds: [
        ["openssl s_client -connect api.shop.example:443 -servername api.shop.example </dev/null", "openssl s_client -connect api.shop.example:443 -servername api.shop.example </dev/null", "Read the chain and the 'Verify return code'. Code 20 or 21 usually means a missing intermediate on the server or a root your trust store does not have."],
        ["... | openssl x509 -noout -dates -subject -issuer", "... | openssl x509 -noout -dates -subject -issuer", "Look for a past notAfter, a subject that does not cover the name, or an issuer named after your company proxy."],
        ["env | grep -i _proxy", "scutil --proxy", "If a corporate proxy re-signs TLS, add its root CA to the tool's own trust store. Do not reach for -k."]
      ] },
    { id: "lb502", label: "HTTP 502 from the load balancer", layer: "HTTP: the load balancer could not get a valid backend response",
      cmds: [
        ["curl -sv https://api.shop.example/ -o /dev/null", "curl -sv https://api.shop.example/ -o /dev/null", "A 502 with the load balancer's server header means the client side is fine; note any request-id header for the LB logs."],
        ["curl -v http://app-3.internal.example:8080/healthz", "curl -v http://app-3.internal.example:8080/healthz", "Run from inside the network. Refused or timed out means the backend is down or blocked from the LB; slow means the LB timeout is shorter than the app."],
        ["journalctl -u app --since '10 min ago'", "log show --last 10m --style compact", "Look for crashes, exhausted workers, or the app closing idle keep-alive connections before the load balancer does."]
      ] },
    { id: "byname", label: "Works by IP, not by name", layer: "DNS, or name-based routing (Host header / SNI)",
      cmds: [
        ["dig +short api.shop.example; getent hosts api.shop.example", "dig +short api.shop.example; dscacheutil -q host -a name api.shop.example", "Different answers point at a stale cache, an /etc/hosts override, or split DNS."],
        ["curl -v --resolve api.shop.example:443:203.0.113.10 https://api.shop.example/", "curl -v --resolve api.shop.example:443:203.0.113.10 https://api.shop.example/", "Works: DNS is the problem. Fails: the bare IP only worked because no SNI or Host header was sent, so check virtual hosts and the certificate."],
        ["resolvectl flush-caches", "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder", "Clears a cached old record after a DNS change; respect the TTL elsewhere."]
      ] },
    { id: "slow", label: "Slow first byte", layer: "Usually the server; confirm with timing",
      cmds: [
        ["curl -s -o /dev/null -w '%{time_connect} %{time_appconnect} %{time_starttransfer}\\n' https://api.shop.example/", "curl -s -o /dev/null -w '%{time_connect} %{time_appconnect} %{time_starttransfer}\\n' https://api.shop.example/", "A large gap between appconnect and starttransfer is backend think time; a large connect or appconnect is the network or TLS."],
        ["mtr -rwzc 50 api.shop.example", "sudo mtr -rwzc 50 api.shop.example", "Only relevant if connect is slow too. Loss that continues to the last hop is real; loss on one middle hop alone usually is not."],
        ["(app traces / slow-query log)", "(app traces / slow-query log)", "When server time dominates, the fix is in the application or database, not the network."]
      ] }
  ];

  Widgets.toolsPicker = function (mount) {
    shell(mount, "triage", "Symptom to next command",
      "Pick the error you are looking at. The panel names the layer it most likely lives in and the next commands to run, with the Linux and macOS spelling and what each result would tell you.");

    var cur = "refused";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var btns = [];

    function paint() {
      try {
        var s = SYMPTOMS[0];
        for (var i = 0; i < SYMPTOMS.length; i++) if (SYMPTOMS[i].id === cur) s = SYMPTOMS[i];
        clear(stage);
        stage.appendChild(h("div", { style: "font-size:0.86rem;margin-bottom:10px;color:var(--text)" }, h("b", {}, "Likely layer: "), s.layer));
        for (var j = 0; j < s.cmds.length; j++) {
          var c = s.cmds[j];
          stage.appendChild(h("div", { style: "margin:10px 0 4px;font-weight:700;font-size:0.82rem;color:var(--accent-ink)" }, "Step " + (j + 1)));
          stage.appendChild(term("Linux:  " + c[0] + "\nmacOS:  " + c[1]));
          stage.appendChild(h("p", { style: "margin:6px 0 0;font-size:0.84rem;line-height:1.5;color:var(--text-dim)" }, c[2]));
        }
        clear(readout);
        readout.appendChild(ro("symptom", s.label));
        readout.appendChild(ro("layer", s.layer.split(":")[0].split(" (")[0]));
        readout.appendChild(ro("next commands", s.cmds.length));
      } catch (e) {
        clear(readout);
        readout.appendChild(roLine("Could not load this symptom."));
      }
    }

    var row = h("div", { class: "widget-controls" });
    SYMPTOMS.forEach(function (s) {
      var b = h("button", { type: "button", class: "w-btn" + (s.id === cur ? " primary" : "") }, s.label);
      b.addEventListener("click", function () {
        cur = s.id;
        for (var i = 0; i < btns.length; i++) btns[i].className = "w-btn";
        b.className = "w-btn primary";
        paint();
      });
      btns.push(b);
      row.appendChild(b);
    });
    mount.appendChild(row);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "tools-inspect": {
      title: "Inspect the host checkpoint",
      sub: "iproute2, ss, the macOS equivalents, ping, traceroute and mtr.",
      questions: [
        {
          q: "You want to know exactly which interface, gateway and source address the kernel will use to reach 198.51.100.7. Which Linux command answers that directly?",
          options: ["ip addr show", "ip route get 198.51.100.7", "ip neigh show", "ss -tan dst 198.51.100.7"],
          answer: 1,
          explain: "ip route get asks the kernel to perform a real route lookup for one destination and prints the chosen device, next hop and source address. Reading the whole table with ip route works too but makes you do longest-prefix matching and policy rules in your head. On macOS the equivalent is route -n get."
        },
        {
          q: "In ss -tlnp output, a LISTEN socket shows Recv-Q 129 and Send-Q 128. What does that tell you?",
          options: ["129 bytes are waiting to be read by the application", "The accept queue is full: the app is not calling accept() fast enough", "The peer has not acknowledged 128 bytes", "The socket is about to close"],
          answer: 1,
          explain: "For LISTEN sockets the columns change meaning: Recv-Q is the number of completed connections waiting to be accepted and Send-Q is the backlog limit. A Recv-Q at or above the limit means new handshakes will be dropped or retried. On ESTAB sockets the same columns are unread and unacknowledged bytes instead."
        },
        {
          q: "You are on a Mac and need the equivalent of Linux's ss -tlnp to see which process listens on TCP ports. Which command fits?",
          options: ["netstat -tlnp", "ip -br a", "lsof -nP -iTCP -sTCP:LISTEN", "ifconfig -a"],
          answer: 2,
          explain: "macOS has neither ss nor the GNU netstat flags that show processes. lsof with -iTCP and -sTCP:LISTEN lists listening TCP sockets with the owning command and PID, and -nP keeps addresses and ports numeric. The BSD netstat on macOS shows sockets but not their owners."
        },
        {
          q: "A ping to a server gets 100% loss, but curl to its port 443 works. What is the most likely explanation?",
          options: ["The server is down", "ICMP echo is filtered somewhere on the path or on the host, while TCP 443 is allowed", "DNS is returning the wrong address for ping only", "ping uses UDP and UDP is blocked"],
          answer: 1,
          explain: "ping uses ICMP echo, which many firewalls and cloud security groups block by default. A working TCP connection proves the host is up and reachable, so no ping reply only means ICMP is filtered. Never conclude a host is down from ping alone."
        },
        {
          q: "An mtr report shows 40% loss at hop 5, but 0% loss at hops 6 through 10 including the destination. How should you read it?",
          options: ["Hop 5 is dropping 40% of your traffic; escalate to that network", "The destination is losing packets", "Hop 5 is rate-limiting the ICMP replies it generates; forwarded traffic is fine", "The path is asymmetric so the numbers are meaningless"],
          answer: 2,
          explain: "Routers forward packets in hardware but generate ICMP time-exceeded replies on a slower control plane, often with a rate limit. If later hops and the destination show no loss, the packets passing through hop 5 are fine. Real loss shows up at a hop and persists all the way to the final hop."
        },
        {
          q: "Linux traceroute shows only * * * rows after hop 3 toward a web server, while the site loads normally. What is a good next step?",
          options: ["Rerun with traceroute -T -p 443 to probe with TCP SYNs to the port the service actually allows", "Conclude the route is broken after hop 3", "Increase the ping packet size", "Flush the ARP cache"],
          answer: 0,
          explain: "Default Linux traceroute sends UDP probes to high ports, which firewalls often drop, so later hops never answer. TCP mode sends SYNs to port 443, which the path must allow for the site to work, so you usually get replies all the way through. Rows of asterisks mean no answer to the probe, not a broken path."
        }
      ]
    },
    "tools-probe": {
      title: "Probe services checkpoint",
      sub: "dig, curl timing, nc, openssl s_client and tcpdump.",
      questions: [
        {
          q: "dig returns status: SERVFAIL for a name. What does that usually mean?",
          options: ["The name does not exist", "The resolver could not get a valid answer: an upstream, delegation or DNSSEC failure", "The record exists but has a TTL of zero", "The query was blocked by a local firewall"],
          answer: 1,
          explain: "NXDOMAIN is the authoritative statement that the name does not exist. SERVFAIL means the resolver tried and failed: a broken delegation, unreachable authoritative servers, or a DNSSEC validation failure. Query an authoritative server directly with @server or use +trace to find where it breaks."
        },
        {
          q: "curl -w reports time_connect 0.031 and time_appconnect 0.095. How long did the TLS handshake itself take?",
          options: ["95 ms", "31 ms", "About 64 ms", "126 ms"],
          answer: 2,
          explain: "curl's timing variables are cumulative from the start of the request, not per-phase durations. The TLS handshake runs from the end of TCP connect to the end of appconnect, so it is 0.095 minus 0.031, roughly 64 ms. Subtract neighbouring values to get each phase."
        },
        {
          q: "You need to test a new server at 203.0.113.10 before DNS is switched, with the correct SNI and certificate check for shop.example. Which command does that safely?",
          options: ["Run curl -k against the IP 203.0.113.10 directly", "Send curl to the IP 203.0.113.10 with -H 'Host: shop.example'", "curl --resolve shop.example:443:203.0.113.10 https://shop.example/", "curl -L https://shop.example/"],
          answer: 2,
          explain: "--resolve pins the name to the IP for this one request, so curl still sends SNI and the Host header for shop.example and verifies the certificate against that name. Setting only the Host header leaves SNI and verification pointed at the bare IP, which usually fails. -k turns verification off and proves nothing about the certificate."
        },
        {
          q: "openssl s_client ends with 'Verify return code: 21 (unable to verify the first certificate)'. What is the most common cause?",
          options: ["The certificate has expired", "The server is not sending the intermediate certificate in its chain", "The client does not support TLS 1.3", "The private key does not match"],
          answer: 1,
          explain: "Code 21 means the client could not build a path from the leaf to a trusted root, which most often happens when the server sends only its leaf. Browsers sometimes hide this by fetching or caching intermediates; command-line tools usually do not. An expired certificate reports a different code (10)."
        },
        {
          q: "In tcpdump output you see Flags [S], then Flags [R.] from the server. What happened?",
          options: ["The handshake completed and the server closed normally", "The server actively refused: nothing listens on that port or a reject rule answered", "The packets were dropped by a firewall", "The server is waiting for data"],
          answer: 1,
          explain: "A SYN answered with a RST is a refusal; the client application reports connection refused. A normal close uses FIN flags, and a silent firewall drop produces repeated [S] retransmits with no reply at all. Seeing which of the three you have points you at the right layer immediately."
        },
        {
          q: "On a Mac you run nc -l -p 8080 to start a quick listener and it errors out. Why?",
          options: ["macOS forbids listening on ports above 1024", "macOS ships the BSD netcat, which takes the port directly: nc -l 8080", "nc cannot listen; only ncat can", "You need sudo for any listener"],
          answer: 1,
          explain: "netcat comes in several flavours with different flags. The BSD version on macOS listens with nc -l 8080 and treats -p as the source port, while the traditional GNU netcat wants -l -p 8080. Check which variant you have before copying a command from another system."
        }
      ]
    },
    "tools-filter": {
      title: "Firewalls, proxies and triage checkpoint",
      sub: "netfilter, nftables, proxies, and reading connection errors.",
      questions: [
        {
          q: "An INPUT chain has policy DROP and these rules in order: ACCEPT lo; ACCEPT tcp 22 from 10.0.0.0/8; DROP all. Outbound HTTPS calls from the host now hang. What is missing?",
          options: ["An ACCEPT for tcp port 443 inbound", "A conntrack rule accepting ESTABLISHED,RELATED packets", "A NAT rule in POSTROUTING", "An OUTPUT rule for port 22"],
          answer: 1,
          explain: "Replies to the host's own outbound connections arrive on INPUT from port 443 to a random high port, and no rule allows them. A rule accepting ESTABLISHED,RELATED via conntrack lets every reply in without opening any listening port. Opening 443 inbound would not even match these replies, since their destination port is the ephemeral one."
        },
        {
          q: "You are about to apply a new ruleset over SSH to a remote server. What protects you from locking yourself out?",
          options: ["Apply it twice in a row", "Put the DROP rule first so the policy is explicit", "Schedule an automatic rollback to the saved ruleset that you cancel once you confirm access", "Use nftables instead of iptables"],
          answer: 2,
          explain: "Save the current rules, schedule a restore a couple of minutes out, apply the new rules, and open a second SSH session to prove access before cancelling the restore. Tools like iptables-apply automate exactly this. Changing frameworks does not help, and a DROP at the top is precisely how people lock themselves out."
        },
        {
          q: "A client sees 'Connection timed out' while a colleague on another network sees 'Connection refused' to the same host and port. What is the most likely difference?",
          options: ["DNS returns different records to each of them", "A firewall or security group on your path silently drops your SYNs, while your colleague's packets reach the host, which has nothing listening", "Your TLS version is older", "Your colleague is using HTTP/3"],
          answer: 1,
          explain: "Refused means a RST came back, so the colleague reached the host and found the port closed. Timed out means nothing came back at all, which is the signature of a silent drop on your path. Both point at the port, but only your case also involves a filtering rule."
        },
        {
          q: "curl ignores HTTP_PROXY set in uppercase for plain-HTTP URLs, but honours http_proxy. Why?",
          options: ["It is a bug in curl", "Uppercase HTTP_PROXY can be injected by a web server's CGI environment through the Proxy request header, so curl only trusts the lowercase form for http", "Uppercase variables are reserved for the shell", "curl reads proxies only from ~/.curlrc"],
          answer: 1,
          explain: "In CGI environments a request header named Proxy becomes the variable HTTP_PROXY, letting an attacker redirect outbound calls. curl therefore only accepts lowercase http_proxy for http URLs; HTTPS_PROXY and NO_PROXY work in either case. Other tools follow different rules, which is why setting both cases is common."
        },
        {
          q: "Behind a corporate TLS-intercepting proxy, curl works but a Python script fails with a certificate verification error. What is the best fix?",
          options: ["Set verify=False in the script", "Add the corporate root CA to the bundle Python uses, for example via REQUESTS_CA_BUNDLE or SSL_CERT_FILE", "Downgrade to TLS 1.2", "Unset HTTPS_PROXY"],
          answer: 1,
          explain: "The proxy re-signs every certificate with a corporate root. Your system or curl trusts that root, but Python often ships its own CA bundle that does not include it. Pointing the tool at a bundle containing the corporate root fixes it properly; disabling verification removes the protection entirely."
        },
        {
          q: "A service is unreachable. Following a bottom-up runbook, which check should come right after confirming the interface is up and the route is correct?",
          options: ["Read the application logs", "Check the HTTP status code", "Confirm the name resolves to the expected address", "Run openssl s_client"],
          answer: 2,
          explain: "Once link and routing are fine, the next dependency is name resolution: if the name maps to the wrong address, every later test is aimed at the wrong machine. Then test the TCP port, the firewall, TLS, HTTP and finally application logs. Each layer depends on the ones below it working."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.tools = {
    id: "tools",
    name: "Network Tools & Troubleshooting",
    short: "TOOLS",
    tagline: "From ip and ss to tcpdump and a triage runbook",
    color: "#a78bfa",
    blurb: "The command-line kit for answering 'why can't I reach it?': inspect interfaces, routes and sockets; probe DNS, HTTP and TLS; capture packets; read firewall rules and proxies; and walk a layered runbook from link to application, with the macOS spelling of every command.",
    modules: [
      {
        id: "inspect",
        name: "Inspect the Host",
        icon: "map",
        lessons: [
          {
            id: "ip-ss",
            title: "ip, ss and their macOS cousins",
            summary: "Read addresses, routes, neighbours and sockets with iproute2, and know the commands that replace them on a Mac.",
            minutes: 10,
            tags: ["iproute2", "ss", "routing", "macos"],
            blocks: [
              { t: "p", html: "Before you blame the network, ask the host four questions: <em>what addresses do I have, which way will I send this packet, who is my next hop, and which sockets are open?</em> On modern Linux one family of tools answers all four: <code class='tok'>ip</code> for interfaces, routes and neighbours, and <code class='tok'>ss</code> for sockets." },
              { t: "h", text: "Addresses and links" },
              { t: "code", lang: "bash", code:
                "ip -br -c a            # brief, coloured: one line per interface\n" +
                "ip addr show dev eth0  # full detail for one interface\n" +
                "ip link show           # link layer: state UP/DOWN, MTU, MAC\n" +
                "ip -s link show eth0   # plus RX/TX counters, errors, drops" },
              { t: "code", lang: "text", code:
                "$ ip -br -c a\n" +
                "lo      UNKNOWN  127.0.0.1/8 ::1/128\n" +
                "eth0    UP       10.0.0.5/24 fe80::a00:27ff:fe4e:66a1/64\n" +
                "wg0     UNKNOWN  10.8.0.2/32" },
              { t: "h", text: "Routes: ask the kernel, do not guess" },
              { t: "p", html: "<code class='tok'>ip route</code> prints the table; <code class='tok'>ip route get</code> performs a real lookup for one destination, including policy rules and VPN routes you would otherwise miss. It is the single most useful routing command when a VPN is involved." },
              { t: "code", lang: "text", code:
                "$ ip route\n" +
                "default via 10.0.0.1 dev eth0 proto dhcp metric 100\n" +
                "10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.5\n\n" +
                "$ ip route get 198.51.100.7\n" +
                "198.51.100.7 via 10.0.0.1 dev eth0 src 10.0.0.5 uid 1000\n" +
                "    cache\n\n" +
                "$ ip neigh\n" +
                "10.0.0.1 dev eth0 lladdr 52:54:00:12:35:02 REACHABLE" },
              { t: "p", html: "<code class='tok'>ip neigh</code> is the ARP (IPv4) and neighbour-discovery (IPv6) cache. A gateway stuck in <code class='tok'>FAILED</code> or <code class='tok'>INCOMPLETE</code> means layer 2 is broken before IP even matters; see <a class='inline' href='#/net/layers/arp-l2'>ARP and layer 2</a>." },
              { t: "h", text: "Sockets with ss" },
              { t: "table", headers: ["Command", "Shows"], rows: [
                ["<code class='tok'>ss -tlnp</code>", "TCP listeners, numeric, with owning process (process names need root for other users' sockets)"],
                ["<code class='tok'>ss -tan</code>", "every TCP socket in every state"],
                ["<code class='tok'>ss -s</code>", "summary counts: how many ESTAB, TIME-WAIT, orphaned"],
                ["<code class='tok'>ss -tn dst :443</code>", "connections whose remote port is 443"],
                ["<code class='tok'>ss -tn state established '( dport = :443 )'</code>", "state filter plus port expression"],
                ["<code class='tok'>ss -ulnp</code>", "UDP sockets bound for receiving"]
              ] },
              { t: "code", lang: "text", code:
                "$ sudo ss -tlnp\n" +
                "State   Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process\n" +
                "LISTEN  0       4096    0.0.0.0:22          0.0.0.0:*          users:((\"sshd\",pid=812,fd=3))\n" +
                "LISTEN  0       511     127.0.0.1:5432      0.0.0.0:*          users:((\"postgres\",pid=990,fd=6))\n\n" +
                "$ ss -tn state established\n" +
                "Recv-Q  Send-Q  Local Address:Port   Peer Address:Port\n" +
                "0       0       10.0.0.5:22          10.1.2.3:53118\n" +
                "0       87040   10.0.0.5:443         198.51.100.40:61022" },
              { t: "note", variant: "trap", html: "<strong>Recv-Q and Send-Q change meaning by state.</strong> On a LISTEN socket, Recv-Q is the number of finished handshakes waiting for <code class='tok'>accept()</code> and Send-Q is the backlog limit; Recv-Q near the limit means the app is not keeping up. On ESTAB, Recv-Q is bytes the app has not read and Send-Q is bytes the peer has not acknowledged; a large, steady Send-Q (like 87040 above) points at a slow or stalled receiver or a lossy path." },
              { t: "note", variant: "warn", html: "Postgres above listens on <code class='tok'>127.0.0.1</code> only. From another host that port looks closed no matter what the firewall says. Always read the local address column before you open a firewall rule." },
              { t: "h", text: "Legacy net-tools and macOS" },
              { t: "p", html: "Older guides use <code class='tok'>ifconfig</code>, <code class='tok'>netstat</code> and <code class='tok'>route</code> from the net-tools package, which many distros no longer install. A Mac has BSD versions of those tools and no <code class='tok'>ip</code> or <code class='tok'>ss</code> at all." },
              { t: "table", headers: ["Question", "Linux (iproute2)", "Linux legacy", "macOS"], rows: [
                ["Addresses", "<code class='tok'>ip -br a</code>", "<code class='tok'>ifconfig -a</code>", "<code class='tok'>ifconfig</code> (Wi-Fi is usually en0)"],
                ["Routing table", "<code class='tok'>ip route</code>", "<code class='tok'>route -n</code>", "<code class='tok'>netstat -rn</code>"],
                ["Route for one IP", "<code class='tok'>ip route get IP</code>", "(none)", "<code class='tok'>route -n get IP</code>"],
                ["ARP cache", "<code class='tok'>ip neigh</code>", "<code class='tok'>arp -n</code>", "<code class='tok'>arp -an</code>"],
                ["Listening sockets", "<code class='tok'>ss -tlnp</code>", "<code class='tok'>netstat -tlnp</code>", "<code class='tok'>lsof -nP -iTCP -sTCP:LISTEN</code>"],
                ["All TCP sockets", "<code class='tok'>ss -tan</code>", "<code class='tok'>netstat -tan</code>", "<code class='tok'>netstat -anp tcp</code>"],
                ["Interface config", "<code class='tok'>nmcli</code> / netplan", "(files)", "<code class='tok'>networksetup -getinfo Wi-Fi</code>"]
              ] },
              { t: "code", lang: "text", code:
                "$ route -n get 198.51.100.7          # macOS\n" +
                "   route to: 198.51.100.7\n" +
                "destination: default\n" +
                "    gateway: 192.168.1.1\n" +
                "  interface: en0\n\n" +
                "$ networksetup -listallhardwareports  # maps 'Wi-Fi' to en0, etc." },
              { t: "cue", html: "<strong>In the field:</strong> on a fresh box, run <code class='tok'>ip -br a</code>, <code class='tok'>ip route get &lt;target&gt;</code> and <code class='tok'>ss -tlnp</code> before anything else. Three commands tell you whether you have an address, which way traffic goes, and whether the service is even listening where you think." },
              { t: "note", variant: "key", html: "<strong>Ask the kernel, not the config file.</strong> <code class='tok'>ip route get</code> and <code class='tok'>ss -tlnp</code> (or <code class='tok'>route -n get</code> and <code class='tok'>lsof -iTCP</code> on a Mac) show what the host will actually do." }
            ]
          },
          {
            id: "ping-trace",
            title: "ping, traceroute and mtr without the myths",
            summary: "What ICMP tools really measure, how traceroute uses TTL, and how to read loss that is not real.",
            minutes: 10,
            tags: ["ping", "traceroute", "mtr", "icmp"],
            blocks: [
              { t: "p", html: "<code class='tok'>ping</code> and <code class='tok'>traceroute</code> are the first tools everyone reaches for and the most misread. Both rely on ICMP behaviour that routers and firewalls are free to restrict, so treat them as hints about reachability and latency, never as proof that something is down." },
              { t: "h", text: "ping" },
              { t: "code", lang: "bash", code:
                "ping -c 5 api.shop.example          # 5 probes then a summary (both OSes)\n" +
                "ping -c 20 -i 0.2 203.0.113.10      # faster interval (very short intervals may need root)\n" +
                "ping -c 3 -s 1400 203.0.113.10      # bigger payload: 1400 + 8 ICMP + 20 IP = 1428 bytes" },
              { t: "code", lang: "text", code:
                "64 bytes from 203.0.113.10: icmp_seq=1 ttl=54 time=21.4 ms\n" +
                "64 bytes from 203.0.113.10: icmp_seq=2 ttl=54 time=22.0 ms\n" +
                "--- 203.0.113.10 ping statistics ---\n" +
                "5 packets transmitted, 5 received, 0% packet loss, time 4006ms\n" +
                "rtt min/avg/max/mdev = 21.1/21.7/22.4/0.4 ms" },
              { t: "ul", items: [
                "<strong>time</strong> is the round trip, not one way. Jitter shows in <code class='tok'>mdev</code> (Linux) or <code class='tok'>stddev</code> (macOS).",
                "<strong>ttl</strong> in the reply is what was left when it arrived. Hosts start at common values like 64 or 128, so 54 suggests roughly 10 hops; it is a heuristic, not a measurement.",
                "<strong>Loss</strong> over a handful of probes is noisy; send 50 or 100 before drawing conclusions."
              ] },
              { t: "note", variant: "trap", html: "<strong>No reply does not mean down.</strong> Cloud security groups, host firewalls and many corporate networks drop ICMP echo. If <code class='tok'>nc -zv host 443</code> or <code class='tok'>curl</code> works, the host is up and ping is simply filtered." },
              { t: "h", text: "How traceroute works" },
              { t: "p", html: "traceroute sends probes with TTL 1, then 2, then 3. Each router decrements the TTL; the one that drops it to zero discards the probe and sends back an ICMP <em>time exceeded</em> message, revealing its address. The destination answers differently (port unreachable for UDP probes, echo reply for ICMP, SYN-ACK or RST for TCP), which tells traceroute it has arrived." },
              { t: "table", headers: ["Mode", "Linux", "macOS", "When to use"], rows: [
                ["UDP to high ports (default)", "<code class='tok'>traceroute host</code>", "<code class='tok'>traceroute host</code>", "General use; often blocked by firewalls near the target"],
                ["ICMP echo", "<code class='tok'>traceroute -I host</code>", "<code class='tok'>traceroute -I host</code>", "Networks that allow ping but not random UDP"],
                ["TCP SYN to a port", "<code class='tok'>sudo traceroute -T -p 443 host</code> or <code class='tok'>tcptraceroute</code>", "no -T; use <code class='tok'>sudo mtr --tcp -P 443 host</code> from Homebrew", "Reaching a service through firewalls that only allow its port"]
              ] },
              { t: "code", lang: "text", code:
                "$ traceroute -n api.shop.example\n" +
                " 1  10.0.0.1       0.8 ms  0.7 ms  0.7 ms\n" +
                " 2  192.0.2.1      4.9 ms  5.1 ms  4.8 ms\n" +
                " 3  * * *\n" +
                " 4  198.51.100.9  12.3 ms 12.0 ms 12.6 ms\n" +
                " 5  * * *\n" +
                " 6  * * *" },
              { t: "ul", items: [
                "<strong>A lone <code class='tok'>* * *</code> row followed by normal hops</strong> (hop 3) is a router that does not send time-exceeded messages. Harmless.",
                "<strong>Asterisks to the end</strong> (hops 5 and 6) mean probes stopped getting answers; often the target's firewall drops this probe type. Retry with TCP to the real service port before concluding anything.",
                "<strong>Asymmetric paths:</strong> traceroute shows the forward path only. Replies may come back a different way, so a latency jump at one hop can belong to the return path.",
                "<strong>ECMP:</strong> routers load-balance across equal-cost links per flow; each probe can take a different branch, so one hop number may show two or three addresses."
              ] },
              { t: "h", text: "mtr: traceroute that keeps going" },
              { t: "p", html: "<code class='tok'>mtr</code> repeats probes to every hop and keeps per-hop loss and latency statistics. Report mode prints a final table, which is what you paste into a ticket. On a Mac install it with Homebrew and run it with <code class='tok'>sudo</code>." },
              { t: "code", lang: "text", code:
                "$ mtr -rwzc 100 api.shop.example     # report, wide names, AS numbers, 100 cycles\n" +
                "HOST                         Loss%   Snt   Last   Avg  Best  Wrst StDev\n" +
                "  1. AS???    10.0.0.1         0.0%   100    0.8   0.8   0.6   1.4   0.1\n" +
                "  2. AS64500  192.0.2.1        0.0%   100    5.0   5.1   4.7   7.9   0.4\n" +
                "  3. AS64500  192.0.2.77      38.0%   100   11.9  12.4  11.5  30.1   2.1\n" +
                "  4. AS64501  198.51.100.9     0.0%   100   12.2  12.6  11.9  15.0   0.5\n" +
                "  5. AS64501  203.0.113.10     0.0%   100   21.3  21.6  20.9  24.8   0.6" },
              { t: "note", variant: "warn", html: "<strong>Loss that does not persist is not loss.</strong> Hop 3 shows 38%, but hops 4 and 5 show none, so packets <em>passing through</em> hop 3 are fine; it simply rate-limits the ICMP replies its control plane generates. Real loss starts at some hop and continues all the way to the destination." },
              { t: "quiz", id: "tools-inspect" },
              { t: "note", variant: "key", html: "<strong>Judge the path by the last hop.</strong> ICMP is optional for routers and often filtered for hosts, so trust end-to-end results and use TCP probes to the real port when ICMP goes quiet." }
            ]
          }
        ]
      },
      {
        id: "probe",
        name: "Probe Services",
        icon: "plug",
        lessons: [
          {
            id: "dig-curl",
            title: "dig and curl: DNS and HTTP from the command line",
            summary: "Read a dig answer like a resolver does, and make curl tell you exactly where a request spends its time.",
            minutes: 12,
            tags: ["dig", "dns", "curl", "http", "timing"],
            blocks: [
              { t: "p", html: "Most 'the site is down' reports are either a name that resolves wrong or a request that is slow in one specific phase. <code class='tok'>dig</code> shows you what DNS really says, and <code class='tok'>curl</code> with <code class='tok'>-v</code> and <code class='tok'>-w</code> shows you the phase. Both work the same on Linux and macOS. For the resolution chain itself, see <a class='inline' href='#/net/app/dns'>DNS</a>." },
              { t: "h", text: "dig essentials" },
              { t: "table", headers: ["Command", "Does"], rows: [
                ["<code class='tok'>dig api.shop.example</code>", "A record via your configured resolver, full output"],
                ["<code class='tok'>dig +short api.shop.example</code>", "just the answer values"],
                ["<code class='tok'>dig @10.0.0.53 api.shop.example</code>", "ask one specific server"],
                ["<code class='tok'>dig -t MX shop.example</code> (also TXT, NS, AAAA)", "other record types"],
                ["<code class='tok'>dig +trace api.shop.example</code>", "walk from the root down, ignoring caches"],
                ["<code class='tok'>dig +norecurse @ns1.shop.example api.shop.example</code>", "ask an authoritative server without recursion"],
                ["<code class='tok'>dig -x 203.0.113.10</code>", "reverse lookup (PTR)"]
              ] },
              { t: "code", lang: "text", code:
                "$ dig api.shop.example\n" +
                ";; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 4242\n" +
                ";; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1\n\n" +
                ";; ANSWER SECTION:\n" +
                "api.shop.example.     300   IN  CNAME  lb.shop.example.\n" +
                "lb.shop.example.       60   IN  A      203.0.113.10\n\n" +
                ";; Query time: 18 msec\n" +
                ";; SERVER: 10.0.0.53#53(10.0.0.53)" },
              { t: "ul", items: [
                "<strong>status</strong>: <code class='tok'>NOERROR</code> (fine, though the answer can still be empty for that type), <code class='tok'>NXDOMAIN</code> (name does not exist), <code class='tok'>SERVFAIL</code> (the resolver failed: broken delegation, unreachable authoritative servers, DNSSEC failure).",
                "<strong>flags</strong>: <code class='tok'>aa</code> means an authoritative answer; <code class='tok'>ra</code> means the server offers recursion.",
                "<strong>ANSWER</strong> holds the records; <strong>AUTHORITY</strong> holds NS or SOA records, which is what you get for NXDOMAIN or a referral.",
                "<strong>TTL</strong> (300, 60) is seconds a cache may keep the record. After a change, old answers can live that long in caches."
              ] },
              { t: "note", variant: "trap", html: "<strong>dig bypasses parts of the system resolver.</strong> It reads the nameserver list and talks DNS directly, ignoring <code class='tok'>/etc/hosts</code>, nsswitch and (on macOS) per-domain VPN resolvers. If dig and your app disagree, compare with <code class='tok'>getent hosts</code> on Linux or <code class='tok'>dscacheutil -q host -a name</code> on macOS." },
              { t: "h", text: "curl -v: read the conversation" },
              { t: "code", lang: "text", code:
                "$ curl -sv https://api.shop.example/health -o /dev/null\n" +
                "*   Trying 203.0.113.10:443...\n" +
                "* Connected to api.shop.example (203.0.113.10) port 443\n" +
                "* ALPN: curl offers h2,http/1.1\n" +
                "* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n" +
                "* ALPN: server accepted h2\n" +
                "* Server certificate:\n" +
                "*  subject: CN=api.shop.example\n" +
                "*  issuer: C=US; O=Example CA; CN=Example Issuing CA 1\n" +
                "> GET /health HTTP/2\n" +
                "> Host: api.shop.example\n" +
                "< HTTP/2 200\n" +
                "< content-type: application/json" },
              { t: "p", html: "Lines with <code class='tok'>*</code> are curl's own notes (DNS, connect, TLS), <code class='tok'>&gt;</code> is what you sent, <code class='tok'>&lt;</code> is what came back. Where the output stops tells you which layer failed: no <em>Connected</em> line is TCP, no <em>SSL connection</em> line is TLS, a status code is HTTP." },
              { t: "h", text: "curl -w: time every phase" },
              { t: "code", lang: "bash", code:
                "curl -s -o /dev/null -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} code=%{http_code}\\n' \\\n" +
                "  https://api.shop.example/orders" },
              { t: "p", html: "Each variable is <strong>cumulative from the start</strong>, so subtract neighbours to get phase durations: TLS took <code class='tok'>time_appconnect - time_connect</code>, and server think time is roughly <code class='tok'>time_starttransfer - time_appconnect</code>. For plain http, <code class='tok'>time_appconnect</code> stays 0." },
              { t: "widget", id: "toolsCurlTiming" },
              { t: "h", text: "Flags that save an afternoon" },
              { t: "table", headers: ["Flag", "Use"], rows: [
                ["<code class='tok'>-I</code>", "HEAD request: headers only"],
                ["<code class='tok'>-L</code>", "follow redirects (and see every hop with -v)"],
                ["<code class='tok'>--resolve api.shop.example:443:203.0.113.10</code>", "pin a name to an IP for this request, keeping SNI, Host and certificate checks correct"],
                ["<code class='tok'>-H 'Host: api.shop.example'</code>", "override the Host header only; SNI and verification still use the URL host"],
                ["<code class='tok'>--http2</code> / <code class='tok'>--http3</code>", "force a protocol; HTTP/3 needs a curl built with it (the macOS system curl may not be)"],
                ["<code class='tok'>-x http://proxy.corp.example:3128</code>", "use an explicit proxy; <code class='tok'>--noproxy '*'</code> bypasses env proxies"],
                ["<code class='tok'>-k</code>", "skip certificate verification: diagnosis only, never in scripts"]
              ] },
              { t: "note", variant: "warn", html: "<code class='tok'>-k</code> makes a TLS problem disappear without fixing it, and it tends to get copied into scripts and stay there. Diagnose with <code class='tok'>openssl s_client</code> instead, then fix the trust store or the server chain." },
              { t: "note", variant: "key", html: "<strong>dig tells you what the name means; curl -w tells you where the time went.</strong> Subtract the cumulative timers to find the slow phase before you guess." }
            ]
          },
          {
            id: "nc-openssl",
            title: "nc and openssl s_client: raw TCP and TLS",
            summary: "Check ports, fake a client or a server, and inspect a TLS handshake and certificate by hand.",
            minutes: 10,
            tags: ["netcat", "openssl", "tls", "certificates"],
            blocks: [
              { t: "p", html: "When curl's view is too high-level, drop one layer. <code class='tok'>nc</code> opens a bare TCP or UDP connection, so you can prove a port is reachable without any protocol in the way. <code class='tok'>openssl s_client</code> performs just the TLS handshake and shows you the certificate chain, the negotiated version and whether verification passed." },
              { t: "h", text: "netcat in four moves" },
              { t: "code", lang: "bash", code:
                "nc -zv api.shop.example 443             # port check: connect, report, close\n" +
                "nc -zv -w 3 203.0.113.10 5432           # give up after 3 s (GNU/OpenBSD variants)\n" +
                "nc -l 8080                              # quick listener (BSD/macOS, OpenBSD nc)\n" +
                "printf 'GET / HTTP/1.1\\r\\nHost: api.shop.example\\r\\nConnection: close\\r\\n\\r\\n' | nc api.shop.example 80" },
              { t: "code", lang: "text", code:
                "$ nc -zv api.shop.example 443\n" +
                "Connection to api.shop.example port 443 [tcp/https] succeeded!\n\n" +
                "$ nc -zv 203.0.113.10 8443\n" +
                "nc: connect to 203.0.113.10 port 8443 (tcp) failed: Connection refused" },
              { t: "p", html: "The raw-HTTP trick is useful when you suspect a proxy or a library is rewriting your request: you see the server's literal bytes. It only works for plain HTTP; for HTTPS, use <code class='tok'>openssl s_client</code> with the same printf piped in." },
              { t: "table", headers: ["Variant", "Where you find it", "Listen", "Timeout"], rows: [
                ["BSD / OpenBSD nc", "macOS, Debian's netcat-openbsd", "<code class='tok'>nc -l 8080</code>", "<code class='tok'>-w 3</code>; macOS also has <code class='tok'>-G 3</code> for connect"],
                ["Traditional GNU netcat", "older distros, netcat-traditional", "<code class='tok'>nc -l -p 8080</code>", "<code class='tok'>-w 3</code>"],
                ["ncat (from nmap)", "RHEL family, installable anywhere", "<code class='tok'>ncat -l 8080</code>", "<code class='tok'>-w 3</code>; also has <code class='tok'>--ssl</code>"]
              ] },
              { t: "note", variant: "trap", html: "On a Mac, <code class='tok'>nc -l -p 8080</code> fails because BSD nc treats <code class='tok'>-p</code> as the <em>source</em> port. Check <code class='tok'>nc -h</code> before trusting a one-liner written for another system." },
              { t: "h", text: "openssl s_client" },
              { t: "code", lang: "bash", code:
                "openssl s_client -connect api.shop.example:443 -servername api.shop.example </dev/null\n" +
                "openssl s_client -connect api.shop.example:443 -servername api.shop.example -showcerts </dev/null\n" +
                "openssl s_client -connect api.shop.example:443 -servername api.shop.example -alpn h2 </dev/null\n" +
                "openssl s_client -connect api.shop.example:443 -servername api.shop.example -tls1_2 </dev/null\n" +
                "openssl s_client -connect mail.shop.example:587 -starttls smtp </dev/null" },
              { t: "p", html: "<code class='tok'>&lt;/dev/null</code> closes stdin so the command returns instead of waiting for you to type. <code class='tok'>-servername</code> sends SNI, which servers hosting many names need to pick the right certificate; always pass it. <code class='tok'>-showcerts</code> prints every certificate the server sent, which is how you spot a missing intermediate." },
              { t: "code", lang: "text", code:
                "CONNECTED(00000003)\n" +
                "depth=2 C = US, O = Example Root Authority, CN = Example Root R1\n" +
                "depth=1 C = US, O = Example CA, CN = Example Issuing CA 1\n" +
                "depth=0 CN = api.shop.example\n" +
                "---\n" +
                "Certificate chain\n" +
                " 0 s:CN = api.shop.example\n" +
                "   i:C = US, O = Example CA, CN = Example Issuing CA 1\n" +
                "   <PEM certificate block omitted>\n" +
                "---\n" +
                "New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384\n" +
                "ALPN protocol: h2\n" +
                "Verify return code: 0 (ok)" },
              { t: "table", headers: ["Verify return code", "Usual meaning", "Fix"], rows: [
                ["0 (ok)", "chain builds to a trusted root and the name matched what was checked", "nothing"],
                ["10 (certificate has expired)", "leaf or an intermediate is past notAfter", "renew and redeploy"],
                ["18 / 19 (self-signed)", "self-signed leaf, or a private root you do not trust", "trust the private CA explicitly, if intended"],
                ["20 / 21 (unable to get local issuer / verify the first certificate)", "server omits the intermediate, or the root is missing locally (corporate interception)", "serve the full chain, or add the corporate root"]
              ] },
              { t: "h", text: "Read a certificate's dates and names" },
              { t: "code", lang: "bash", code:
                "openssl s_client -connect api.shop.example:443 -servername api.shop.example </dev/null 2>/dev/null \\\n" +
                "  | openssl x509 -noout -dates -subject -issuer" },
              { t: "code", lang: "text", code:
                "notBefore=Jan 10 00:00:00 2026 GMT\n" +
                "notAfter=Apr 10 23:59:59 2026 GMT\n" +
                "subject=CN = api.shop.example\n" +
                "issuer=C = US, O = Example CA, CN = Example Issuing CA 1" },
              { t: "note", variant: "tip", html: "On macOS, <code class='tok'>openssl</code> is usually LibreSSL. The flags in this lesson work, but some newer OpenSSL options and output formats differ; <code class='tok'>openssl version</code> tells you which one you have, and Homebrew installs OpenSSL alongside it. See <a class='inline' href='#/net/app/tls'>TLS</a> for what the handshake is doing." },
              { t: "note", variant: "key", html: "<strong>Drop a layer to isolate a layer.</strong> nc proves TCP reachability with no protocol in the way; s_client proves the TLS handshake and chain with no HTTP in the way." }
            ]
          },
          {
            id: "tcpdump",
            title: "tcpdump: see the packets",
            summary: "Capture exactly the traffic you need with BPF filters, read a TCP handshake in the output, and hand pcaps to Wireshark.",
            minutes: 12,
            tags: ["tcpdump", "bpf", "pcap", "wireshark"],
            blocks: [
              { t: "p", html: "Every other tool reports what an application <em>thinks</em> happened. <code class='tok'>tcpdump</code> shows what actually crossed the interface. When two teams disagree about whether a request was sent, a ten-line capture settles it." },
              { t: "h", text: "The flags you use every time" },
              { t: "table", headers: ["Flag", "Meaning"], rows: [
                ["<code class='tok'>-i any</code> / <code class='tok'>-i eth0</code>", "interface; <code class='tok'>any</code> is a Linux pseudo-interface. On a Mac prefer <code class='tok'>-i en0</code> (or what <code class='tok'>ifconfig</code> lists)"],
                ["<code class='tok'>-nn</code>", "no name or port lookups: faster, and no extra DNS traffic in your capture"],
                ["<code class='tok'>-c 100</code>", "stop after 100 packets"],
                ["<code class='tok'>-s 0</code>", "full packet length (modern versions already default to a large snap length)"],
                ["<code class='tok'>-w cap.pcap</code> / <code class='tok'>-r cap.pcap</code>", "write raw packets to a file / read them back"],
                ["<code class='tok'>-A</code> / <code class='tok'>-X</code>", "print payload as ASCII / as hex plus ASCII"]
              ] },
              { t: "h", text: "BPF filters" },
              { t: "p", html: "The filter expression decides which packets the kernel hands to tcpdump, so a good filter keeps captures small and cheap. Quote it, so the shell leaves characters like <code class='tok'>&amp;</code>, <code class='tok'>!</code> and brackets alone." },
              { t: "code", lang: "bash", code:
                "sudo tcpdump -i any -nn 'host 203.0.113.10'\n" +
                "sudo tcpdump -i any -nn 'tcp and dst port 443'\n" +
                "sudo tcpdump -i any -nn 'net 10.0.0.0/8 and not port 22'\n" +
                "sudo tcpdump -i any -nn 'udp port 53'\n" +
                "sudo tcpdump -i any -nn 'icmp or (tcp and src host 198.51.100.7)'\n" +
                "sudo tcpdump -i any -nn 'tcp[tcpflags] & tcp-syn != 0'          # SYN and SYN-ACK only\n" +
                "sudo tcpdump -i en0 -nn -w /tmp/web.pcap 'port 443'            # macOS, to a file" },
              { t: "widget", id: "toolsTcpdump" },
              { t: "h", text: "Reading a handshake" },
              { t: "code", lang: "text", code:
                "12:00:01.000100 IP 10.0.0.5.51544 > 203.0.113.10.443: Flags [S], seq 1000, win 64240, length 0\n" +
                "12:00:01.021400 IP 203.0.113.10.443 > 10.0.0.5.51544: Flags [S.], seq 7000, ack 1001, win 65160, length 0\n" +
                "12:00:01.021480 IP 10.0.0.5.51544 > 203.0.113.10.443: Flags [.], ack 1, win 502, length 0\n" +
                "12:00:01.022100 IP 10.0.0.5.51544 > 203.0.113.10.443: Flags [P.], seq 1:518, ack 1, length 517\n" +
                "12:00:01.090300 IP 10.0.0.5.51544 > 203.0.113.10.443: Flags [F.], seq 518, ack 1449, length 0" },
              { t: "table", headers: ["Flags", "Meaning", "What it tells you"], rows: [
                ["<code class='tok'>[S]</code>", "SYN", "client wants a connection"],
                ["<code class='tok'>[S.]</code>", "SYN-ACK", "server is listening and answered; the gap from [S] is one round trip (21 ms here)"],
                ["<code class='tok'>[.]</code>", "ACK only", "handshake done, or a pure acknowledgement"],
                ["<code class='tok'>[P.]</code>", "PUSH + ACK", "data is flowing (517 bytes: likely a TLS ClientHello)"],
                ["<code class='tok'>[F.]</code>", "FIN + ACK", "orderly close"],
                ["<code class='tok'>[R]</code> / <code class='tok'>[R.]</code>", "RST", "refused or aborted: closed port, reject rule, or an app tearing down"]
              ] },
              { t: "p", html: "Three patterns cover most tickets: <strong>[S] repeated with no answer</strong> is a silent drop (firewall, security group, routing); <strong>[S] then [R.]</strong> is a refusal; <strong>a full handshake then [R] after data</strong> is the application or a middlebox killing the session. Relative sequence numbers start at 1 after the handshake because tcpdump shows them relative by default. See <a class='inline' href='#/net/transport/tcp-handshake'>the TCP handshake</a> for the states behind these flags." },
              { t: "note", variant: "warn", html: "<strong>Capture on the right side.</strong> Behind NAT or a load balancer, addresses change at each hop: the backend sees the LB's address (or the client's, if the LB preserves it), not what the client sent to. Capture on both ends and match by time and ports, and remember a TLS-terminating LB opens a brand-new connection to the backend." },
              { t: "note", variant: "trap", html: "Captures need root or the <code class='tok'>CAP_NET_RAW</code> capability (often with <code class='tok'>CAP_NET_ADMIN</code>), and they contain whatever crossed the wire: cookies, tokens, plain-text credentials on unencrypted protocols. Filter tightly, store pcaps like secrets, and delete them when the ticket closes." },
              { t: "cue", html: "<strong>In the field:</strong> capture to a file with <code class='tok'>-w</code> on the server, copy it to your laptop, and open it in Wireshark. Its 'Follow TCP Stream' view and expert warnings (retransmissions, zero windows, resets) find in seconds what scrolling text hides." },
              { t: "quiz", id: "tools-probe" },
              { t: "note", variant: "key", html: "<strong>The capture is the ground truth.</strong> Filter tightly, capture on both sides of any NAT or load balancer, and read the flags: repeated [S] is a drop, [R] is a refusal, a handshake proves the path." }
            ]
          }
        ]
      },
      {
        id: "filter",
        name: "Firewalls & Proxies",
        icon: "shield",
        lessons: [
          {
            id: "iptables-nft",
            title: "iptables, nftables and host firewalls",
            summary: "How netfilter decides a packet's fate, a minimal safe host ruleset, and how not to lock yourself out.",
            minutes: 12,
            tags: ["iptables", "nftables", "netfilter", "conntrack", "pf"],
            blocks: [
              { t: "p", html: "Linux filtering happens in the kernel's <strong>netfilter</strong> framework. Packets pass a fixed set of <em>hooks</em>; rules attached to those hooks match on headers and connection state and return a verdict. <code class='tok'>iptables</code> and <code class='tok'>nftables</code> are two front ends for writing those rules." },
              { t: "h", text: "Hooks, tables, chains" },
              { t: "table", headers: ["Chain (hook)", "Sees", "Typical use"], rows: [
                ["PREROUTING", "every arriving packet, before the routing decision", "DNAT / port forwarding (nat table)"],
                ["INPUT", "packets addressed to this host", "host firewall (filter table)"],
                ["FORWARD", "packets routed through this host", "routers, container and VM hosts"],
                ["OUTPUT", "packets this host generates", "egress restrictions"],
                ["POSTROUTING", "every leaving packet, after routing", "SNAT / masquerade (nat table)"]
              ] },
              { t: "p", html: "iptables groups chains into tables by purpose: <strong>filter</strong> (accept or drop), <strong>nat</strong> (rewrite addresses; only the first packet of a connection is consulted), <strong>mangle</strong> (alter marks and header fields). Rules in a chain are tried <strong>top to bottom and the first match wins</strong>; if nothing matches, the chain's <strong>default policy</strong> applies." },
              { t: "h", text: "State is what makes it usable" },
              { t: "p", html: "The conntrack module tracks every flow. With <code class='tok'>-m conntrack --ctstate ESTABLISHED,RELATED</code> you accept replies to connections you already allowed, and related traffic such as ICMP errors, without opening any ports. Without that rule, a host with a default-drop INPUT chain cannot even receive the answers to its own outbound requests." },
              { t: "code", lang: "bash", code:
                "# minimal host firewall (IPv4); run from a console or with a rollback armed\n" +
                "iptables -P INPUT DROP\n" +
                "iptables -A INPUT -i lo -j ACCEPT\n" +
                "iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT\n" +
                "iptables -A INPUT -p tcp -s 10.0.0.0/8 --dport 22 -m conntrack --ctstate NEW -j ACCEPT\n" +
                "iptables -A INPUT -p tcp --dport 443 -j ACCEPT\n" +
                "iptables -A INPUT -j DROP\n\n" +
                "iptables -L INPUT -n -v --line-numbers   # list with packet counters\n" +
                "iptables -S                              # rules as commands" },
              { t: "widget", id: "toolsFirewall" },
              { t: "note", variant: "warn", html: "<strong>Arm a rollback before you touch a remote firewall.</strong> Save the current rules, schedule their restore, apply the change, and confirm a <em>new</em> SSH session works before cancelling the restore. <code class='tok'>iptables-apply</code> automates this; the manual version is below. An existing session can survive a bad rule thanks to conntrack while new ones fail, so testing in the old session proves nothing." },
              { t: "code", lang: "bash", code:
                "# in a root shell (sudo -i)\n" +
                "iptables-save > /root/fw.before\n" +
                "( sleep 120 && iptables-restore < /root/fw.before ) &   # safety net\n" +
                "iptables-restore < /root/fw.new\n" +
                "# open a NEW ssh session; if it works:\n" +
                "kill %1" },
              { t: "h", text: "The same ruleset in nftables" },
              { t: "code", lang: "text", code:
                "table inet filter {\n" +
                "  chain input {\n" +
                "    type filter hook input priority 0; policy drop;\n" +
                "    iif \"lo\" accept\n" +
                "    ct state established,related accept\n" +
                "    ip saddr 10.0.0.0/8 tcp dport 22 ct state new accept\n" +
                "    tcp dport 443 accept\n" +
                "  }\n" +
                "}" },
              { t: "p", html: "nftables uses one <code class='tok'>inet</code> table for IPv4 and IPv6 together, sets and maps for large allow-lists, and atomic loading with <code class='tok'>nft -f file</code>. Inspect everything with <code class='tok'>sudo nft list ruleset</code>. On many current distros the <code class='tok'>iptables</code> command is itself a compatibility layer writing nftables rules, so mixing both styles by hand gets confusing quickly." },
              { t: "table", headers: ["Layer", "Tool", "Notes"], rows: [
                ["Ubuntu-style front end", "<code class='tok'>ufw allow from 10.0.0.0/8 to any port 22</code>", "generates netfilter rules for you"],
                ["RHEL-style front end", "<code class='tok'>firewall-cmd --add-service=https --permanent</code>", "zones and services; reload to apply permanent changes"],
                ["Cloud security group", "provider console or IaC", "stateful like conntrack: allowing inbound 443 lets replies out automatically"],
                ["macOS packet filter", "<code class='tok'>sudo pfctl -sr</code>, <code class='tok'>sudo pfctl -s info</code>", "pf, inherited from BSD; rules in /etc/pf.conf"],
                ["macOS application firewall", "<code class='tok'>/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate</code>", "per-app inbound allow/deny, separate from pf"]
              ] },
              { t: "note", variant: "tip", html: "When a port looks blocked, check every layer that can filter: the host firewall, the cloud security group, any network ACL, and the service's bind address. The packet counters in <code class='tok'>iptables -L -n -v</code> or <code class='tok'>nft list ruleset</code> show whether your rule is even being hit." },
              { t: "note", variant: "key", html: "<strong>Order, state, policy.</strong> First match wins, an ESTABLISHED,RELATED rule makes the firewall usable, and the default policy catches the rest; always change a remote firewall with a rollback armed." }
            ]
          },
          {
            id: "proxies",
            title: "Proxies, load balancers and TLS interception",
            summary: "Forward and reverse proxies, the environment variables tools read, and why corporate interception breaks some tools but not others.",
            minutes: 10,
            tags: ["proxy", "load-balancer", "tls", "macos"],
            blocks: [
              { t: "p", html: "A proxy is anything that terminates your connection and opens another one on your behalf. Once one sits in the path, the addresses, certificates and headers you see are the proxy's, and every tool on the machine may or may not know it is there." },
              { t: "table", headers: ["Kind", "Who configures it", "Example"], rows: [
                ["Forward proxy", "the client (env vars, system settings, PAC file)", "corporate egress proxy on <code class='tok'>proxy.corp.example:3128</code>"],
                ["Reverse proxy", "the server owner; clients do not know", "nginx or a cloud LB in front of app servers"],
                ["Transparent proxy", "the network, by redirecting traffic", "an egress gateway intercepting port 80/443"]
              ] },
              { t: "h", text: "HTTPS through a forward proxy: CONNECT" },
              { t: "p", html: "For https URLs the client asks the proxy to open a raw tunnel with <code class='tok'>CONNECT api.shop.example:443</code>, then runs TLS end to end through it. curl -v makes this visible:" },
              { t: "code", lang: "text", code:
                "* Uses proxy env variable https_proxy == 'http://proxy.corp.example:3128'\n" +
                "*   Trying 10.20.0.8:3128...\n" +
                "* CONNECT tunnel: HTTP/1.1 negotiated\n" +
                "> CONNECT api.shop.example:443 HTTP/1.1\n" +
                "< HTTP/1.1 200 Connection established\n" +
                "* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n" +
                "*  issuer: O=Corp Example; CN=Corp Example Inspection CA" },
              { t: "p", html: "Notice two things: <em>Trying</em> shows the proxy's address, not the server's, so DNS for the target happens at the proxy; and the issuer is a corporate CA, which means the proxy is intercepting TLS." },
              { t: "h", text: "Environment variables, and the case trap" },
              { t: "code", lang: "bash", code:
                "export https_proxy=http://proxy.corp.example:3128\n" +
                "export HTTPS_PROXY=$https_proxy\n" +
                "export http_proxy=$https_proxy\n" +
                "export no_proxy=localhost,127.0.0.1,.internal.example,10.0.0.0/8\n" +
                "export NO_PROXY=$no_proxy" },
              { t: "ul", items: [
                "<strong>curl</strong> reads only lowercase <code class='tok'>http_proxy</code> for http URLs (uppercase could be injected via CGI's Proxy header), and either case for <code class='tok'>HTTPS_PROXY</code> and <code class='tok'>NO_PROXY</code>.",
                "<strong>NO_PROXY matching differs:</strong> some tools match domain suffixes with or without a leading dot, some accept CIDR ranges, some ignore them. Test each tool you depend on.",
                "<strong>Many tools have their own settings</strong> (git, npm, pip, Docker daemon, JVM system properties), and some ignore env vars entirely. Setting both cases covers the most ground."
              ] },
              { t: "h", text: "Corporate TLS interception" },
              { t: "p", html: "An intercepting proxy decrypts traffic and re-signs every site's certificate with a corporate root CA pushed to managed machines. Browsers and the OS trust that root, so they work. Tools that carry <strong>their own trust store</strong> fail with errors like <em>unable to get local issuer certificate</em>." },
              { t: "table", headers: ["Tool", "Trust store", "Point it at the corporate root"], rows: [
                ["Python requests", "bundled certifi file", "<code class='tok'>REQUESTS_CA_BUNDLE=/path/corp-bundle.pem</code>"],
                ["OpenSSL-based tools", "system bundle path", "<code class='tok'>SSL_CERT_FILE=/path/corp-bundle.pem</code>"],
                ["Node.js", "compiled-in list", "<code class='tok'>NODE_EXTRA_CA_CERTS=/path/corp-root.pem</code>"],
                ["Java", "the JDK's cacerts keystore", "import with <code class='tok'>keytool -importcert</code> into the keystore the app uses"],
                ["curl", "depends on the build", "<code class='tok'>--cacert /path/corp-bundle.pem</code> or <code class='tok'>CURL_CA_BUNDLE</code>"]
              ] },
              { t: "note", variant: "trap", html: "Turning verification off (<code class='tok'>verify=False</code>, <code class='tok'>-k</code>, <code class='tok'>NODE_TLS_REJECT_UNAUTHORIZED=0</code>) 'fixes' interception errors by accepting any certificate from anyone. Add the corporate root to the tool's trust store instead; it is one environment variable." },
              { t: "h", text: "Load balancers: L4 versus L7" },
              { t: "compare",
                bad: { title: "L4 (TCP) load balancer", items: ["Forwards connections without reading HTTP", "Cannot route by path or header", "Client IP lost unless it uses PROXY protocol or preserves the source address", "TLS usually passes through to the backend"] },
                good: { title: "L7 (HTTP) load balancer", items: ["Terminates TLS and parses requests", "Routes by host, path, header; can retry and rewrite", "Adds X-Forwarded-For / X-Forwarded-Proto for the backend", "Returns its own 502/503/504 when backends misbehave"] } },
              { t: "p", html: "<code class='tok'>X-Forwarded-For</code> is a plain header any client can forge, so a backend should trust only the entries appended by its own proxies. <strong>PROXY protocol</strong> instead prefixes the TCP stream with the original addresses; the backend must be configured to expect it, or it will read the prefix as garbage." },
              { t: "h2", text: "macOS: two proxy worlds" },
              { t: "p", html: "macOS keeps system proxy settings per network service, which GUI apps and many system frameworks use. Shell tools mostly ignore them and read only environment variables. Check both when 'the browser works but the terminal doesn't'." },
              { t: "code", lang: "bash", code:
                "scutil --proxy                          # effective system proxy config\n" +
                "networksetup -getwebproxy Wi-Fi         # HTTP proxy for one service\n" +
                "networksetup -getsecurewebproxy Wi-Fi   # HTTPS proxy\n" +
                "env | grep -i _proxy                    # what your shell tools will use" },
              { t: "note", variant: "key", html: "<strong>A proxy changes what you can see.</strong> Check which proxy each tool uses, whose certificate you are looking at, and which hop's address shows in the logs before drawing conclusions." }
            ]
          },
          {
            id: "troubleshoot-flow",
            title: "Can't reach the service: a layered runbook",
            summary: "Walk from link to application in order, read the exact wording of connection errors, and pick the right next command.",
            minutes: 12,
            tags: ["troubleshooting", "runbook", "errors"],
            blocks: [
              { t: "p", html: "Unreachable-service tickets are solved fastest bottom-up: each layer depends on the ones below, so a test at a high layer is meaningless until the lower ones pass. The trick is to make every step a quick yes-or-no check and to stop at the first <em>no</em>." },
              { t: "diagram", id: "troubleshoot-layers", caption: "Bottom-up triage: link, IP and route, DNS, TCP port, TLS, HTTP. Stop at the first layer that fails." },
              { t: "ol", items: [
                "<strong>Link and interface:</strong> <code class='tok'>ip -br a</code> / <code class='tok'>ifconfig en0</code>. Is it UP with an address? Is the VPN interface present?",
                "<strong>IP and route:</strong> <code class='tok'>ip route get 203.0.113.10</code> / <code class='tok'>route -n get 203.0.113.10</code>. Right interface and gateway?",
                "<strong>DNS:</strong> <code class='tok'>dig +short api.shop.example</code> and the system view (<code class='tok'>getent hosts</code> / <code class='tok'>dscacheutil -q host -a name</code>). Same, expected address?",
                "<strong>TCP port:</strong> <code class='tok'>nc -zv api.shop.example 443</code> or the <em>Connected</em> line of <code class='tok'>curl -v</code>. Refused, timed out, or connected?",
                "<strong>Firewall / security group:</strong> if it timed out, check host rules, cloud security groups and ACLs on both ends, and capture with tcpdump to see where SYNs stop.",
                "<strong>TLS:</strong> <code class='tok'>openssl s_client -connect api.shop.example:443 -servername api.shop.example</code>. Verify return code 0? Expected certificate?",
                "<strong>HTTP:</strong> <code class='tok'>curl -sv https://api.shop.example/health</code>. Status code, server header, redirect loops?",
                "<strong>Application:</strong> logs and traces on the backend for the request id or timestamp."
              ] },
              { t: "h", text: "Read the error message literally" },
              { t: "table", headers: ["Message", "What happened on the wire", "Layer", "Usual causes"], rows: [
                ["<code class='tok'>Name or service not known</code> / <code class='tok'>Could not resolve host</code>", "no packets to the target at all; the DNS lookup failed", "DNS", "typo, missing record, wrong resolver, VPN split DNS"],
                ["<code class='tok'>Connection refused</code>", "SYN answered by RST", "TCP port", "nothing listening, bound to 127.0.0.1, reject rule"],
                ["<code class='tok'>Connection timed out</code>", "SYN retransmitted, never answered", "path / firewall", "DROP rule, security group, wrong route, host down"],
                ["<code class='tok'>No route to host</code>", "local route missing, ARP failed, or ICMP host-unreachable came back", "IP / L2", "wrong subnet, gateway down, reject with icmp-host-prohibited"],
                ["<code class='tok'>Network is unreachable</code>", "kernel has no route at all; nothing sent", "IP / route", "no default route, interface down"],
                ["<code class='tok'>SSL certificate problem</code>", "TCP fine, TLS verification failed", "TLS", "expired, missing intermediate, name mismatch, interception"],
                ["HTTP <code class='tok'>502</code> / <code class='tok'>504</code> from a proxy", "client side fine; proxy to backend failed or was too slow", "HTTP / backend", "backend down, wrong port, timeouts mismatched"]
              ] },
              { t: "widget", id: "toolsPicker" },
              { t: "compare",
                bad: { title: "Top-down guessing", items: ["Restart the app because the browser shows an error", "Open firewall rules before checking the bind address", "Add -k because TLS failed", "Blame DNS without comparing dig and the system resolver"] },
                good: { title: "Bottom-up checks", items: ["One yes/no test per layer, in order", "Stop at the first failure and fix only that", "Use the exact error wording to skip layers that clearly work", "Capture packets when two teams disagree"] } },
              { t: "note", variant: "tip", html: "An error message lets you skip ahead: <em>refused</em> already proves link, route and DNS work, because a RST came back from the right host. <em>Certificate problem</em> proves TCP works. Start one layer below the failure, not at the bottom every time." },
              { t: "note", variant: "warn", html: "Test from where the failing client actually runs. A command that works from your laptop says nothing about a container, a CI runner or a pod with its own DNS, routes and egress rules; use <code class='tok'>kubectl exec</code>, <code class='tok'>docker exec</code> or the runner's shell." },
              { t: "cue", html: "<strong>In the field:</strong> write the ticket update as layers: 'DNS resolves to 203.0.113.10 (ok); TCP 443 times out from subnet A, connects from subnet B; tcpdump on the host shows no SYNs from A.' That sentence routes the ticket to the network team and saves a day of back-and-forth." },
              { t: "note", variant: "tip", html: "The same bottom-up flow works on a Mac with different tools. Use <code>ifconfig</code> and <code>netstat -rn</code> for layers 2 and 3, <code>nc -vz</code> for TCP, <code>dscacheutil -q host -a name shop.example</code> for the resolver path, and <code>sudo killall -HUP mDNSResponder</code> to flush its DNS cache." },
              { t: "quiz", id: "tools-filter" },
              { t: "note", variant: "key", html: "<strong>Bottom-up, one yes/no per layer, stop at the first no.</strong> The exact error wording (refused, timed out, no route, not resolved) tells you which layer to start from." }
            ]
          }
        ]
      }
    ]
  };
})();
