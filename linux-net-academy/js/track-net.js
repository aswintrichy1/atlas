/* =====================================================================
   KERNEL · Networking Fundamentals
   window.TRACKS.net — modules: layers / transport / app

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
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
  function roLine(text) { return h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, text); }
  var PRE = "margin:0;padding:12px 14px;border-radius:10px;background:var(--surface-solid);color:var(--text);" +
    "border:1px solid var(--line);font-family:var(--font-mono);font-size:0.8rem;line-height:1.55;white-space:pre-wrap;overflow-x:auto";
  function term(text) { return h("pre", { style: PRE }, text); }
  function label(text) {
    return h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-faint);margin:10px 0 4px" }, text);
  }

  var Widgets = {};

  function field(value, lbl, width, onChange) {
    var inp = h("input", { type: "text", "aria-label": lbl, spellcheck: "false",
      style: "background:var(--surface-solid);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--font-mono);font-size:0.85rem;width:" + width });
    inp.value = value;
    inp.addEventListener("input", function () { onChange(String(inp.value || "").trim()); });
    return { el: h("label", { class: "w-field" }, lbl, inp), inp: inp };
  }

  /* ==================================================================
     1. netCidr — subnet calculator
  ================================================================== */
  function ipToInt(s) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
    if (!m) return null;
    var n = 0;
    for (var i = 1; i <= 4; i++) { var o = +m[i]; if (o > 255) return null; n = n * 256 + o; }
    return n;
  }
  function intToIp(n) { return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join("."); }
  function maskInt(p) { return p === 0 ? 0 : (0xFFFFFFFF - (Math.pow(2, 32 - p) - 1)); }
  function classify(n) {
    function inR(base, p) { var b = ipToInt(base), size = Math.pow(2, 32 - p); return n >= b && n < b + size; }
    if (inR("10.0.0.0", 8) || inR("172.16.0.0", 12) || inR("192.168.0.0", 16)) return "private (RFC 1918)";
    if (inR("100.64.0.0", 10)) return "carrier-grade NAT (100.64/10)";
    if (inR("127.0.0.0", 8)) return "loopback";
    if (inR("169.254.0.0", 16)) return "link-local (no DHCP answer?)";
    if (inR("192.0.2.0", 24) || inR("198.51.100.0", 24) || inR("203.0.113.0", 24)) return "documentation range";
    if (inR("224.0.0.0", 4)) return "multicast";
    return "public";
  }

  Widgets.netCidr = function (mount) {
    shell(mount, "calculator", "CIDR calculator",
      "Enter an IPv4 address with a prefix length. The panel computes the network, broadcast, mask and host range, and tells you whether a second address is on the same subnet (no router needed) or not.");
    var S = { cidr: "10.20.37.140/26", other: "10.20.37.200" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var f1 = field(S.cidr, "address/prefix", "170px", function (v) { S.cidr = v; paint(); });
    var f2 = field(S.other, "is this host local?", "140px", function (v) { S.other = v; paint(); });
    var sl = h("input", { type: "range", min: "0", max: "32", value: "26", "aria-label": "prefix length", style: "width:180px" });
    sl.addEventListener("input", function () {
      var ip = S.cidr.split("/")[0];
      S.cidr = ip + "/" + sl.value; f1.inp.value = S.cidr; paint();
    });
    function bin(n) { var s = ""; for (var i = 31; i >= 0; i--) { s += Math.floor(n / Math.pow(2, i)) % 2; if (i % 8 === 0 && i) s += "."; } return s; }
    function paint() {
      clear(stage); clear(readout);
      try {
        var parts = S.cidr.split("/");
        var ip = ipToInt(parts[0]);
        var p = parts.length === 2 && /^\d{1,2}$/.test(parts[1]) ? +parts[1] : -1;
        if (ip === null || p < 0 || p > 32) throw new Error("Use the form a.b.c.d/nn with each octet 0-255 and a prefix 0-32.");
        sl.value = String(p);
        var mask = maskInt(p), size = Math.pow(2, 32 - p);
        var net = ip - (ip % size), bc = net + size - 1;
        var usable = p >= 31 ? size : size - 2;
        var first = p >= 31 ? net : net + 1, last = p >= 31 ? bc : bc - 1;
        stage.appendChild(term(
          "address    " + intToIp(ip) + "\n" +
          "mask       " + intToIp(mask) + "  (/" + p + ")\n" +
          "wildcard   " + intToIp(0xFFFFFFFF - mask) + "\n" +
          "network    " + intToIp(net) + "\n" +
          "broadcast  " + (p >= 31 ? "(none for /" + p + ")" : intToIp(bc)) + "\n" +
          "hosts      " + intToIp(first) + " - " + intToIp(last) + "\n\n" +
          "address    " + bin(ip) + "\n" +
          "mask       " + bin(mask)));
        readout.appendChild(ro("addresses", size));
        readout.appendChild(ro("usable hosts", usable));
        readout.appendChild(ro("type", classify(ip)));
        var o = ipToInt(S.other);
        if (o === null) readout.appendChild(roLine("Enter a second IPv4 address to test locality."));
        else {
          var local = o - (o % size) === net;
          readout.appendChild(roLine(intToIp(o) + (local ? " is on the same /" + p + ": the host ARPs for it directly." :
            " is outside " + intToIp(net) + "/" + p + ": traffic goes to the default gateway, so the host ARPs for the gateway's MAC instead.") +
            (p === 31 ? " /31 is valid for point-to-point links (RFC 3021): both addresses are usable." : "")));
        }
      } catch (e) {
        readout.appendChild(ro("input", "invalid"));
        readout.appendChild(roLine(String(e.message || "Could not parse.")));
      }
    }
    mount.appendChild(h("div", { class: "widget-controls" }, f1.el, h("label", { class: "w-field" }, "prefix", sl), f2.el));
    mount.appendChild(h("div", { class: "widget-controls" }, segment([["10.20.37.140/26", "/26 subnet"], ["192.168.1.77/24", "home /24"], ["172.31.5.9/20", "cloud /20"], ["203.0.113.6/30", "/30 link"], ["10.0.0.0/8", "/8"]], 0, function (v) { S.cidr = v; f1.inp.value = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. netTcp — step through a TCP conversation
  ================================================================== */
  var TCP_SCN = {
    normal: { label: "handshake + close", steps: [
      ["C", "SYN seq=1000", "SYN-SENT", "LISTEN", "Client picks an initial sequence number and asks to connect."],
      ["S", "SYN-ACK seq=7000 ack=1001", "SYN-SENT", "SYN-RCVD", "Server acknowledges 1000+1 and sends its own ISN. A half-open entry sits in the SYN backlog."],
      ["C", "ACK ack=7001", "ESTABLISHED", "ESTABLISHED", "One round trip spent. The connection is open; the server moves it to the accept queue."],
      ["C", "PSH,ACK seq=1001 len=120  (GET /orders)", "ESTABLISHED", "ESTABLISHED", "Data flows. Each byte has a sequence number."],
      ["S", "PSH,ACK seq=7001 ack=1121 len=900", "ESTABLISHED", "ESTABLISHED", "Response; ack=1121 confirms all 120 request bytes."],
      ["C", "FIN,ACK seq=1121", "FIN-WAIT-1", "ESTABLISHED", "The client closes first (active close)."],
      ["S", "ACK ack=1122", "FIN-WAIT-2", "CLOSE-WAIT", "Server acknowledges; its app must now call close(). If it never does, CLOSE-WAIT piles up."],
      ["S", "FIN,ACK seq=7901", "FIN-WAIT-2", "LAST-ACK", "Server's app closed its side."],
      ["C", "ACK ack=7902", "TIME-WAIT", "CLOSED", "Client waits in TIME-WAIT (about 60 s on Linux) so stray old segments cannot confuse a new connection on the same port pair."]
    ] },
    refused: { label: "port closed", steps: [
      ["C", "SYN seq=1000  → port 8443", "SYN-SENT", "(no listener)", "Nothing listens on 8443."],
      ["S", "RST,ACK ack=1001", "CLOSED", "(no listener)", "The host answers with a reset: 'Connection refused' arrives in one round trip. The host is reachable; the service is not."]
    ] },
    dropped: { label: "SYN dropped", steps: [
      ["C", "SYN seq=1000  ✗ dropped by firewall", "SYN-SENT", "LISTEN", "A filter silently discards the packet. No reply at all."],
      ["C", "SYN seq=1000  (retransmit after 1 s)", "SYN-SENT", "LISTEN", "The client retries with exponential backoff: 1 s, 3 s, 7 s, 15 s..."],
      ["C", "SYN seq=1000  (retransmit after 2 s more)", "SYN-SENT", "LISTEN", "Still nothing."],
      ["C", "(gives up after net.ipv4.tcp_syn_retries)", "CLOSED", "LISTEN", "'Connection timed out' after a long wait. Timeout vs refused tells you: drop on the path vs no listener."]
    ] },
    loss: { label: "data loss", steps: [
      ["C", "seq=1001 len=1448", "ESTABLISHED", "ESTABLISHED", "Segment 1 arrives."],
      ["C", "seq=2449 len=1448  ✗ lost", "ESTABLISHED", "ESTABLISHED", "Segment 2 is lost on a congested link."],
      ["C", "seq=3897 len=1448", "ESTABLISHED", "ESTABLISHED", "Segment 3 arrives out of order."],
      ["S", "ACK ack=2449 (dup) ×3", "ESTABLISHED", "ESTABLISHED", "The receiver keeps acknowledging the last in-order byte. Three duplicate ACKs (or SACK blocks) signal a gap."],
      ["C", "seq=2449 len=1448  (fast retransmit)", "ESTABLISHED", "ESTABLISHED", "The sender resends only the missing segment and halves its congestion window. Throughput dips; nstat shows TcpRetransSegs rising."],
      ["S", "ACK ack=5345", "ESTABLISHED", "ESTABLISHED", "Everything up to segment 3 is now acknowledged."]
    ] }
  };

  Widgets.netTcp = function (mount) {
    shell(mount, "animator", "TCP conversation, step by step",
      "Pick a scenario and step through it (or press Play). Each step shows the segment on the wire and the state each side enters, as ss would report it.");
    var cur = "normal", idx = 0, playing = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function lane(steps, upto) {
      var box = h("div", { style: "display:grid;grid-template-columns:1fr 2.4fr 1fr;gap:4px 10px;font-family:var(--font-mono);font-size:0.78rem;align-items:center" });
      box.appendChild(h("b", { style: "color:var(--cyan-ink)" }, "client 10.0.0.5"));
      box.appendChild(h("span", {}, ""));
      box.appendChild(h("b", { style: "color:var(--violet-ink);text-align:right" }, "server :443"));
      for (var i = 0; i < upto; i++) {
        var s = steps[i], c2s = s[0] === "C", lost = s[1].indexOf("✗") > -1;
        box.appendChild(h("span", { style: "color:var(--text-dim)" }, s[2]));
        box.appendChild(h("span", { style: "padding:4px 8px;border-radius:8px;border:1px solid var(--line);background:var(--surface-solid);color:" + (lost ? "var(--rose-ink)" : "var(--text)") + ";text-align:" + (c2s ? "left" : "right") },
          (c2s ? "" : "◀── ") + s[1] + (c2s ? " ──▶" : "")));
        box.appendChild(h("span", { style: "color:var(--text-dim);text-align:right" }, s[3]));
      }
      return box;
    }
    function paint() {
      var steps = TCP_SCN[cur].steps;
      clear(stage);
      stage.appendChild(idx ? lane(steps, idx) : term("Press Next to send the first segment."));
      clear(readout);
      readout.appendChild(ro("step", idx + " / " + steps.length));
      if (idx) {
        var s = steps[idx - 1];
        readout.appendChild(ro("client", s[2]));
        readout.appendChild(ro("server", s[3]));
        readout.appendChild(roLine(s[4]));
      } else readout.appendChild(roLine("States follow RFC 9293 naming. On the server, ss -tan shows each connection's state."));
    }
    function next() { if (idx < TCP_SCN[cur].steps.length) { idx++; paint(); return true; } return false; }
    function play() {
      if (playing) return;
      playing = true;
      (function tick() {
        if (!mount.isConnected) { playing = false; return; }
        if (!next()) { playing = false; return; }
        setTimeout(tick, 900);
      })();
    }
    var pairs = [];
    for (var k in TCP_SCN) if (Object.prototype.hasOwnProperty.call(TCP_SCN, k)) pairs.push([k, TCP_SCN[k].label]);
    mount.appendChild(h("div", { class: "widget-controls" },
      segment(pairs, 0, function (v) { cur = v; idx = 0; paint(); }),
      h("button", { type: "button", class: "w-btn primary", onclick: next }, "Next"),
      h("button", { type: "button", class: "w-btn", onclick: play }, "Play"),
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { idx = 0; paint(); } }, "Reset")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. netDns — walk a recursive resolution
  ================================================================== */
  var DNS_CASES = {
    a: { label: "www.shop.example A", q: "www.shop.example", steps: [
      ["stub → recursive", "Your laptop's stub resolver sends the query to the configured recursive resolver (from DHCP or /etc/resolv.conf). The cache is cold."],
      ["recursive → root", "Asks a root server. Roots do not know the answer but return a referral: the NS records for .example."],
      ["recursive → .example TLD", "The TLD servers refer onward: shop.example is served by ns1.shop.example and ns2.shop.example (with glue addresses)."],
      ["recursive → ns1.shop.example", "The authoritative server answers: www.shop.example. 300 IN A 203.0.113.10, with the aa (authoritative) flag."],
      ["recursive → stub", "The recursive resolver caches the answer for its TTL (300 s) and returns it. Next lookups within 5 minutes are answered from cache."]
    ], final: ";; ANSWER SECTION:\nwww.shop.example.   300   IN   A   203.0.113.10\n\n;; Query time: 84 msec" },
    cname: { label: "api.shop.example (CNAME)", q: "api.shop.example", steps: [
      ["stub → recursive", "Query for api.shop.example. The resolver already caches the .example and shop.example delegations, so it skips root and TLD."],
      ["recursive → ns1.shop.example", "Answer: api.shop.example. 60 IN CNAME lb-7.cdn.example. An alias, not an address."],
      ["recursive → cdn.example servers", "The resolver restarts resolution for lb-7.cdn.example, following the alias to another zone."],
      ["recursive → stub", "Returns the whole chain: the CNAME plus lb-7.cdn.example. 20 IN A 198.51.100.42. The low TTL lets the CDN move traffic quickly."]
    ], final: ";; ANSWER SECTION:\napi.shop.example.     60  IN  CNAME  lb-7.cdn.example.\nlb-7.cdn.example.     20  IN  A      198.51.100.42" },
    nx: { label: "typo: wwww.shop.example", q: "wwww.shop.example", steps: [
      ["stub → recursive", "A typo. Cache miss."],
      ["recursive → ns1.shop.example", "The authoritative server says the name does not exist: status NXDOMAIN, with the zone's SOA record in the authority section."],
      ["recursive → stub", "The negative answer is cached too, for the SOA's negative TTL. Creating the record now will not be visible until that expires."]
    ], final: ";; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN\n;; AUTHORITY SECTION:\nshop.example.  900  IN  SOA  ns1.shop.example. hostmaster.shop.example. 2026102801 7200 900 1209600 900" },
    cached: { label: "repeat (cached)", q: "www.shop.example", steps: [
      ["stub → recursive", "Same query 40 seconds later."],
      ["recursive → stub", "Served from cache with the remaining TTL (260 s). No root, TLD or authoritative traffic at all."]
    ], final: ";; ANSWER SECTION:\nwww.shop.example.   260   IN   A   203.0.113.10\n\n;; Query time: 1 msec" }
  };

  Widgets.netDns = function (mount) {
    shell(mount, "walkthrough", "DNS resolution, hop by hop",
      "Pick a query and step through what the recursive resolver does. The final step prints what dig would show.");
    var cur = "a", idx = 0;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var c = DNS_CASES[cur];
      clear(stage);
      var list = h("ol", { style: "margin:0 0 10px 18px;padding:0;color:var(--text);line-height:1.6" });
      for (var i = 0; i < c.steps.length; i++) {
        list.appendChild(h("li", { style: "color:" + (i < idx ? "var(--text)" : "var(--text-faint)") + (i === idx - 1 ? ";font-weight:700" : "") },
          c.steps[i][0] + (i < idx ? ": " + c.steps[i][1] : "")));
      }
      stage.appendChild(term("$ dig " + c.q + (cur === "cname" ? "" : " A")));
      stage.appendChild(list);
      if (idx >= c.steps.length) stage.appendChild(term(c.final));
      clear(readout);
      readout.appendChild(ro("step", idx + " / " + c.steps.length));
      readout.appendChild(ro("network round trips", cur === "cached" ? 1 : Math.max(0, idx)));
      readout.appendChild(roLine(idx >= c.steps.length ? "Done. dig +trace performs these referrals itself and prints each one, which is how you find a broken delegation." : "Press Next to follow the query."));
    }
    var pairs = [];
    for (var k in DNS_CASES) if (Object.prototype.hasOwnProperty.call(DNS_CASES, k)) pairs.push([k, DNS_CASES[k].label]);
    mount.appendChild(h("div", { class: "widget-controls" },
      segment(pairs, 0, function (v) { cur = v; idx = 0; paint(); }),
      h("button", { type: "button", class: "w-btn primary", onclick: function () { if (idx < DNS_CASES[cur].steps.length) { idx++; paint(); } } }, "Next"),
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { idx = 0; paint(); } }, "Reset")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "net-layers": {
      title: "Layers and addressing checkpoint",
      sub: "OSI vs TCP/IP, CIDR, ARP and layer 2.",
      questions: [
        {
          q: "How many usable host addresses does a /27 subnet provide?",
          options: ["32", "30", "62", "14"],
          answer: 1,
          explain: "A /27 leaves 5 host bits, so the block has 2^5 = 32 addresses. The first is the network address and the last is the broadcast, leaving 30 usable hosts. Each extra prefix bit halves the block."
        },
        {
          q: "Host 10.1.4.20/22 wants to reach 10.1.7.9. Does the packet go through the default gateway?",
          options: ["Yes, because the third octet differs", "No: a /22 spans 10.1.4.0 to 10.1.7.255, so 10.1.7.9 is on the local subnet", "Yes, /22 is not a valid prefix", "Only if DNS says so"],
          answer: 1,
          explain: "A /22 covers four /24s; aligned on a multiple of 4 in the third octet, 10.1.4.0/22 runs from 10.1.4.0 to 10.1.7.255. The destination is inside it, so the host ARPs for 10.1.7.9 directly. Comparing octets by eye only works for /8, /16 and /24."
        },
        {
          q: "Which layer of the TCP/IP model is responsible for getting a packet across multiple networks to the right host?",
          options: ["Link", "Internet (IP)", "Transport", "Application"],
          answer: 1,
          explain: "IP handles addressing and routing between networks, hop by hop. The link layer only moves frames within one segment, transport (TCP, UDP) adds ports and reliability between processes, and the application layer carries protocols like HTTP and DNS."
        },
        {
          q: "A host has the address 169.254.33.7. What does that usually indicate?",
          options: ["It is on a public network", "It failed to get a DHCP lease and self-assigned a link-local address", "It is a loopback address", "It is behind carrier-grade NAT"],
          answer: 1,
          explain: "169.254.0.0/16 is link-local, used automatically when no DHCP server answers. It only works on the local segment. Check the DHCP server, the VLAN or the cable before anything else."
        },
        {
          q: "Two hosts on the same switch have the same IP address. What symptom is most typical?",
          options: ["Both work perfectly", "Intermittent connectivity as neighbours' ARP caches flip between the two MAC addresses", "The switch shuts down", "DNS stops resolving"],
          answer: 1,
          explain: "Other hosts map the IP to whichever MAC answered ARP most recently, so traffic alternates between the two machines. ip neigh shows the MAC changing, and arping -D can detect the duplicate. The kernel often logs a duplicate-address warning."
        },
        {
          q: "What does a switch use to decide which port to forward an Ethernet frame to?",
          options: ["The destination IP address", "The destination MAC address and its learned MAC table", "The TCP port", "The VLAN's default gateway"],
          answer: 1,
          explain: "Switches operate at layer 2. They learn which MAC lives on which port from source addresses and forward by destination MAC, flooding unknown destinations. Routers are what look at IP addresses."
        }
      ]
    },
    "net-transport": {
      title: "Transport checkpoint",
      sub: "TCP handshake, states, retransmits and UDP.",
      questions: [
        {
          q: "A server shows thousands of sockets in CLOSE_WAIT. Where is the bug?",
          options: ["In the client, which never sent FIN", "In the local application, which received the peer's FIN but never closed its socket", "In the kernel's TCP stack", "In the firewall"],
          answer: 1,
          explain: "CLOSE_WAIT means the remote side closed and the local kernel is waiting for the local application to call close(). Piles of them indicate a descriptor leak, often an HTTP client or pool that never releases connections. TIME_WAIT, by contrast, is normal."
        },
        {
          q: "What is the purpose of the TIME_WAIT state?",
          options: ["To wait for the application to read data", "To ensure delayed segments from an old connection are not mistaken for a new one using the same address and port pair, and to resend the final ACK if needed", "To throttle new connections", "To keep the connection open for reuse"],
          answer: 1,
          explain: "The side that closes first stays in TIME_WAIT for a while so its final ACK can be retransmitted and old duplicates expire. Many TIME_WAIT sockets on a busy client are normal; connection reuse (keep-alive, pooling) reduces them."
        },
        {
          q: "`curl` to a host reports 'Connection refused' immediately. What happened on the wire?",
          options: ["The SYN was dropped by a firewall", "The host replied to the SYN with a RST because no process listens on that port", "DNS failed", "TLS negotiation failed"],
          answer: 1,
          explain: "A RST in reply to a SYN is the kernel saying 'nothing here'. It proves the host is reachable. A silent drop instead causes retransmitted SYNs and eventually a timeout."
        },
        {
          q: "Why do DNS and many real-time protocols use UDP?",
          options: ["UDP guarantees delivery", "UDP has no handshake or retransmission delays, so small request-response exchanges and latency-sensitive streams are faster", "UDP packets are encrypted", "TCP cannot carry small messages"],
          answer: 1,
          explain: "A DNS query fits in one datagram and the client simply retries if no answer comes, so a TCP handshake would only add latency. Voice and games prefer late data to be dropped rather than delayed. QUIC builds reliability on top of UDP in user space."
        },
        {
          q: "`nstat` shows TcpRetransSegs climbing steadily on a server. What is the most useful next step?",
          options: ["Increase the listen backlog", "Find where loss happens: check interface errors and drops, then mtr toward the affected clients", "Disable TCP timestamps", "Switch to UDP"],
          answer: 1,
          explain: "Retransmissions mean segments or ACKs are being lost or excessively delayed. Interface counters (ip -s link, ethtool -S) find local problems; mtr and tcpdump narrow down path loss. Loss directly reduces TCP throughput through congestion control."
        },
        {
          q: "During the three-way handshake, what does the server's ACK number in the SYN-ACK acknowledge?",
          options: ["The server's own sequence number", "The client's initial sequence number plus one", "The number of bytes in the request", "The window size"],
          answer: 1,
          explain: "The SYN consumes one sequence number, so the server acknowledges the client's ISN plus one, meaning 'I expect byte ISN+1 next'. It also carries its own ISN, which the client acknowledges the same way."
        }
      ]
    },
    "net-app": {
      title: "Application protocols checkpoint",
      sub: "DNS, HTTP and TLS.",
      questions: [
        {
          q: "You changed an A record, but some users still reach the old IP an hour later. What is the most likely reason?",
          options: ["DNS changes need a server reboot", "Resolvers and clients cached the old record for its TTL, which was longer than an hour", "The authoritative server is down", "HTTP caches DNS records"],
          answer: 1,
          explain: "Each resolver may keep a record for its TTL. If the old record had a TTL of a day, some users keep the old address that long. Lower the TTL well ahead of a planned change, then raise it again afterwards."
        },
        {
          q: "What is the main advantage of HTTP/2 over HTTP/1.1 for a page with many assets?",
          options: ["It uses UDP", "It multiplexes many requests as streams over one connection, avoiding the need for many parallel connections", "It removes the need for TLS", "It compresses images"],
          answer: 1,
          explain: "HTTP/1.1 processes one request at a time per connection, so browsers open several. HTTP/2 interleaves streams on one TCP connection with compressed headers. A single lost TCP packet still stalls every stream, which is what HTTP/3 over QUIC fixes."
        },
        {
          q: "A TLS client gets a certificate for default.hosting.example when connecting to shop.example on a shared IP. What is missing?",
          options: ["ALPN", "SNI: the client did not send the server name in the ClientHello, so the server chose its default certificate", "OCSP stapling", "A longer key"],
          answer: 1,
          explain: "Server Name Indication tells a multi-tenant server which certificate to present. Old clients, raw IP connections or openssl s_client without -servername omit it and receive the default. Browsers always send SNI."
        },
        {
          q: "How many round trips does a full TLS 1.3 handshake add before application data can be sent (excluding TCP)?",
          options: ["Zero", "One", "Two", "Three"],
          answer: 1,
          explain: "TLS 1.3 sends key shares in the first flight, so the handshake completes in one round trip, compared with two for TLS 1.2. Resumed sessions can even send early data (0-RTT), with replay risks that limit it to idempotent requests."
        },
        {
          q: "Which HTTP status code family indicates the server, or an upstream it depends on, failed?",
          options: ["2xx", "3xx", "4xx", "5xx"],
          answer: 3,
          explain: "5xx codes signal server-side failures: 500 for an internal error, 502 and 504 when a proxy or load balancer could not get a valid or timely answer from its upstream, 503 when overloaded or in maintenance. 4xx codes blame the request."
        },
        {
          q: "Why does a client verify the server certificate's chain up to a trusted root?",
          options: ["To speed up the handshake", "To confirm that a trusted certificate authority vouched that the public key belongs to the requested name", "To pick the cipher suite", "To compress traffic"],
          answer: 1,
          explain: "Without chain validation anyone could present a key for any name and intercept traffic. The client checks signatures up to a root in its trust store, the validity dates and the name match. Corporate proxies that re-sign traffic require their root to be added to the trust store."
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
    name: "Networking Fundamentals",
    short: "NET",
    tagline: "From frames to TLS, one layer at a time",
    color: "#f472b6",
    blurb: "A working model of how data moves: layers and encapsulation, IPv4 addressing and CIDR, ARP and switching, TCP's handshake, states and retransmissions, UDP, and the application protocols you debug most (DNS, HTTP/1.1 to HTTP/3, and TLS with certificates).",
    modules: [
      {
        id: "layers",
        name: "Layers and addressing",
        icon: "share",
        lessons: [
          {
            id: "osi-tcpip",
            title: "OSI vs TCP/IP and encapsulation",
            summary: "The two layer models, what each layer adds, encapsulation and MTU, and using layers as a debugging map.",
            minutes: 9,
            tags: ["OSI", "TCP/IP", "encapsulation"],
            blocks: [
              { t: "p", html: "Networking is built in layers: each one offers a service to the layer above and uses the one below. The <b>OSI model</b> has seven layers and is mostly a vocabulary; the <b>TCP/IP model</b> has four and matches what actually runs." },
              { t: "diagram", id: "osi-tcpip", caption: "OSI's seven layers mapped onto TCP/IP's four, with example protocols at each." },
              { t: "table", headers: ["TCP/IP layer", "Unit", "Addresses", "Examples"], rows: [
                ["Application", "Message", "Names, URLs", "HTTP, DNS, SSH, TLS (sits between)"],
                ["Transport", "Segment / datagram", "Ports", "TCP, UDP, QUIC"],
                ["Internet", "Packet", "IP addresses", "IPv4, IPv6, ICMP"],
                ["Link", "Frame", "MAC addresses", "Ethernet, Wi-Fi, ARP"]
              ] },
              { t: "h", text: "Encapsulation" },
              { t: "p", html: "When you send an HTTP request, each layer wraps the data with its own header: HTTP bytes inside a TCP segment inside an IP packet inside an Ethernet frame. Each router strips and rebuilds only the link layer; the IP packet travels end to end." },
              { t: "code", lang: "text", code: "| Ethernet 14 B | IPv4 20 B | TCP 20-60 B | TLS record | HTTP request ... | FCS 4 B |\n\nMTU (Ethernet)          1500 bytes of IP packet\nMSS (typical)           1500 - 20 (IP) - 20 (TCP) = 1460 bytes of payload\nWith TCP timestamps     1448 bytes" },
              { t: "note", variant: "trap", html: "Tunnels and VPNs add headers and reduce the effective MTU. If ICMP 'fragmentation needed' messages are filtered, large packets vanish while small ones work: SSH logs in but hangs on the first big output, or TLS handshakes stall." },
              { t: "h", text: "Layers as a debugging map" },
              { t: "ol", items: [
                "Link: is the interface up, with a carrier? (<code>ip -br link</code>)",
                "Internet: do I have an address and a route? (<code>ip -br addr</code>, <code>ip route get</code>)",
                "Name: does the name resolve to the expected address? (<code>dig</code>)",
                "Transport: is the port reachable? (<code>nc -vz host port</code>)",
                "Application: does TLS validate, does HTTP answer? (<code>curl -v</code>)"
              ] },
              { t: "cue", html: "<b>In the field:</b> state the layer out loud when reporting a problem (\"TCP connects, TLS fails\"). It instantly tells the team which half of the stack to look at." },
              { t: "note", variant: "tip", html: "The layer tools differ by OS. Linux uses <code>ip addr</code>, <code>ip route</code> and <code>ip neigh</code>. macOS uses <code>ifconfig</code>, <code>netstat -rn</code> (or <code>route -n get default</code>) and <code>arp -an</code>. The concepts are identical; only the commands change." },
              { t: "note", variant: "key", html: "Four practical layers, each adding a header and its own addresses; debug bottom-up and watch for MTU problems in tunnels." }
            ]
          },
          {
            id: "ip-cidr",
            title: "IPv4 addressing and CIDR",
            summary: "Prefixes and masks, subnet math, private and special ranges, routing decisions, NAT, and a glance at IPv6.",
            minutes: 11,
            tags: ["CIDR", "subnetting", "NAT"],
            blocks: [
              { t: "p", html: "An IPv4 address is a 32-bit number. A <b>prefix length</b> such as <code>/24</code> says how many leading bits identify the network; the rest identify a host within it. Everything about subnets follows from that one split." },
              { t: "widget", id: "netCidr" },
              { t: "table", headers: ["Prefix", "Mask", "Addresses", "Usable hosts"], rows: [
                ["/30", "255.255.255.252", "4", "2"],
                ["/28", "255.255.255.240", "16", "14"],
                ["/26", "255.255.255.192", "64", "62"],
                ["/24", "255.255.255.0", "256", "254"],
                ["/20", "255.255.240.0", "4,096", "4,094"],
                ["/16", "255.255.0.0", "65,536", "65,534"]
              ] },
              { t: "h", text: "Ranges to recognise" },
              { t: "ul", items: [
                "Private (RFC 1918): <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>.",
                "Loopback <code>127.0.0.0/8</code>; link-local <code>169.254.0.0/16</code>; carrier-grade NAT <code>100.64.0.0/10</code>.",
                "Documentation, safe for examples: <code>192.0.2.0/24</code>, <code>198.51.100.0/24</code>, <code>203.0.113.0/24</code>."
              ] },
              { t: "h", text: "How a host decides where to send" },
              { t: "p", html: "For each packet the kernel picks the route with the <b>longest matching prefix</b>. If the destination is on a directly connected subnet, it sends straight to that host; otherwise it sends to the route's gateway, usually the default route." },
              { t: "code", lang: "bash", code: "ip route\n# default via 10.20.37.129 dev eth0\n# 10.20.37.128/26 dev eth0 proto kernel scope link src 10.20.37.140\n# 10.99.0.0/16 via 10.20.37.130 dev eth0      <- VPN or peering route\nip route get 10.99.4.2\n# 10.99.4.2 via 10.20.37.130 dev eth0 src 10.20.37.140\n\n# macOS\nnetstat -rn -f inet\nroute -n get 10.99.4.2" },
              { t: "note", variant: "warn", html: "Overlapping private ranges cause the most painful network bugs: a home network on 10.0.0.0/24 and a corporate VPN routing 10.0.0.0/8 fight over the same addresses. Plan cloud and office ranges so they never overlap." },
              { t: "h", text: "NAT and IPv6 in one paragraph each" },
              { t: "p", html: "<b>NAT</b> rewrites private source addresses to a shared public one at the edge and tracks each flow so replies can be mapped back. It is why many devices share one address, and why inbound connections need explicit port forwarding." },
              { t: "p", html: "<b>IPv6</b> uses 128-bit addresses written in hex (<code>2001:db8::/32</code> is the documentation prefix). Subnets are normally /64, NAT is not needed, and neighbour discovery replaces ARP. Most tools take <code>-6</code> or have a v6 twin." },
              { t: "cue", html: "<b>In the field:</b> before blaming a firewall, run <code>ip route get &lt;dst&gt;</code>. A wrong or missing route sends traffic out the wrong interface and looks exactly like a block." },
              { t: "note", variant: "key", html: "The prefix splits network from host bits; same subnet means direct delivery, otherwise the longest-prefix route's gateway gets the packet." }
            ]
          },
          {
            id: "arp-l2",
            title: "ARP, MAC addresses and switching",
            summary: "How IP addresses map to MAC addresses, the neighbour table, switches and VLANs, and layer-2 failure modes.",
            minutes: 9,
            tags: ["ARP", "MAC", "VLAN"],
            blocks: [
              { t: "p", html: "IP gets a packet to the right network, but on the wire inside that network frames are delivered by <b>MAC address</b>. <b>ARP</b> (Address Resolution Protocol) finds the MAC that owns an IPv4 address on the local segment." },
              { t: "ol", items: [
                "Host A wants to send to 10.20.37.150 (same subnet) and has no entry in its neighbour table.",
                "A broadcasts: <i>who has 10.20.37.150? tell 10.20.37.140</i>.",
                "The owner replies with its MAC, unicast.",
                "A caches the mapping for a while and sends the frame. For off-subnet destinations, A ARPs for the <b>gateway</b> instead."
              ] },
              { t: "code", lang: "bash", code: "ip neigh\n# 10.20.37.129 dev eth0 lladdr 52:54:00:aa:01:01 REACHABLE\n# 10.20.37.150 dev eth0 lladdr 52:54:00:bb:02:07 STALE\n# 10.20.37.160 dev eth0  FAILED          <- nobody answered ARP\n\nsudo arping -I eth0 10.20.37.150        # ARP-level ping\nsudo tcpdump -ni eth0 arp               # watch requests and replies\n\n# macOS\narp -an" },
              { t: "note", variant: "tip", html: "A <code>FAILED</code> or <code>INCOMPLETE</code> neighbour entry means layer 2 is broken: wrong VLAN, host down, cable unplugged, or the address simply is not in use. No amount of firewall debugging will help." },
              { t: "h", text: "Switches and VLANs" },
              { t: "p", html: "A switch learns which MAC addresses live on which port and forwards frames only where needed, flooding unknown destinations and broadcasts. A <b>VLAN</b> splits one physical switch into separate broadcast domains; traffic between VLANs must be routed." },
              { t: "table", headers: ["Failure", "Symptom", "Check"], rows: [
                ["Duplicate IP", "Connectivity flaps", "ip neigh shows MAC changing; arping -D"],
                ["Wrong VLAN", "Link up, but no ARP replies", "Switch port config; tcpdump arp"],
                ["Gateway MAC changed (failover)", "Brief outage until caches refresh", "Gratuitous ARP from the new gateway"],
                ["ARP spoofing", "Traffic diverted through an attacker", "Unexpected MAC for the gateway; switch protections"]
              ] },
              { t: "note", variant: "warn", html: "ARP has no authentication; any host on a segment can claim any address. That is one reason untrusted devices belong on separate VLANs and why encryption (TLS, SSH) matters even on internal networks." },
              { t: "cue", html: "<b>In the field:</b> after moving an IP to a new machine, flush stale entries with <code>ip neigh flush dev eth0</code> on the clients, or send a gratuitous ARP from the new owner with <code>arping -U</code>." },
              { t: "quiz", id: "net-layers" },
              { t: "note", variant: "key", html: "ARP maps IPv4 to MAC on the local segment; FAILED neighbour entries mean a layer-2 problem, and off-subnet traffic always goes to the gateway's MAC." }
            ]
          }
        ]
      },
      {
        id: "transport",
        name: "Transport",
        icon: "queue",
        lessons: [
          {
            id: "tcp-handshake",
            title: "The TCP handshake",
            summary: "SYN, SYN-ACK, ACK; sequence numbers; listen and accept queues; refused versus timed-out connections.",
            minutes: 10,
            tags: ["TCP", "handshake", "backlog"],
            blocks: [
              { t: "p", html: "TCP gives applications a reliable, ordered byte stream over an unreliable network. Before any data flows, both sides agree on starting sequence numbers with the <b>three-way handshake</b>, which costs one round trip." },
              { t: "diagram", id: "tcp-handshake", caption: "SYN, SYN-ACK, ACK and the state each side enters." },
              { t: "widget", id: "netTcp" },
              { t: "h", text: "What the server does with a SYN" },
              { t: "ul", items: [
                "If nothing listens on the port, the kernel answers with <b>RST</b>: <i>connection refused</i>.",
                "Otherwise the half-open connection goes into the <b>SYN queue</b>; after the final ACK it moves to the <b>accept queue</b> until the application calls <code>accept()</code>.",
                "If the accept queue is full because the app is slow, new handshakes are dropped and clients retry: latency spikes that look like network loss."
              ] },
              { t: "code", lang: "bash", code: "ss -ltn\n# State   Recv-Q  Send-Q  Local Address:Port\n# LISTEN  129     128     0.0.0.0:8080      <- Recv-Q > backlog: accept queue overflowing\nnstat -az | grep -E 'ListenOverflows|ListenDrops'\nsysctl net.core.somaxconn net.ipv4.tcp_max_syn_backlog" },
              { t: "note", variant: "tip", html: "For a listening socket, <code>ss</code> repurposes the columns: Recv-Q is the current accept queue length and Send-Q is the configured backlog." },
              { t: "h", text: "Refused versus timed out" },
              { t: "compare", bad: { title: "Connection timed out", items: ["SYN sent, nothing came back", "Retransmitted with backoff for a minute or more", "Cause: a firewall dropping, a wrong route, host down"] }, good: { title: "Connection refused", items: ["SYN answered with RST in one round trip", "Host reachable, port closed", "Cause: service down, wrong port, bound to 127.0.0.1"] } },
              { t: "note", variant: "trap", html: "A service bound to <code>127.0.0.1:8080</code> refuses connections from other hosts even though <code>curl localhost:8080</code> works on the box. Check the local address column in <code>ss -ltn</code>." },
              { t: "cue", html: "<b>In the field:</b> time a connect alone with <code>curl -o /dev/null -s -w '%{time_connect}\\n' http://api.shop.example:8080/</code>. Connect time is about one round trip; much more means SYN loss or a full queue." },
              { t: "h", text: "Seeing it on the wire" },
              { t: "code", lang: "bash", code: "sudo tcpdump -ni any 'tcp port 443 and (tcp[tcpflags] & (tcp-syn|tcp-fin|tcp-rst) != 0)'\n# 10:01:02.100 IP 10.0.4.9.51544 > 203.0.113.10.443: Flags [S],  seq 1000\n# 10:01:02.131 IP 203.0.113.10.443 > 10.0.4.9.51544: Flags [S.], seq 7000, ack 1001\n# 10:01:02.131 IP 10.0.4.9.51544 > 203.0.113.10.443: Flags [.],  ack 7001\n# gap between [S] and [S.] = one network round trip (31 ms)" },
              { t: "table", headers: ["Client sees", "Meaning"], rows: [
                  ["SYN, then SYN-ACK", "Healthy; the gap is your RTT"],
                  ["SYN, then RST", "Host reached, nothing listening: <b>refused</b>"],
                  ["SYN, SYN, SYN… nothing", "Dropped by a firewall or the host is down: <b>timeout</b>"],
                  ["SYN, ICMP unreachable", "A router or host firewall rejected it explicitly"]
                ] },
              { t: "note", variant: "tip", html: "tcpdump ships with macOS. Name an interface such as <code>-i en0</code>, or use <code>-i pktap</code> to capture across interfaces with process metadata (<code>-k</code>)." },
              { t: "note", variant: "key", html: "The handshake costs one RTT; RST means refused, silence means dropped, and a full accept queue looks like loss." }
            ]
          },
          {
            id: "tcp-states",
            title: "TCP states, retransmits and flow control",
            summary: "The connection state machine, TIME_WAIT and CLOSE_WAIT, retransmission and congestion control, windows and keepalives.",
            minutes: 11,
            tags: ["TCP states", "retransmits", "congestion"],
            blocks: [
              { t: "p", html: "Every TCP connection is a small state machine on each side. Reading those states with <code>ss</code> is one of the fastest ways to understand what an application and its peers are doing." },
              { t: "table", headers: ["State", "Meaning", "Many of them suggests"], rows: [
                ["ESTABLISHED", "Open, data can flow", "Normal; compare with expected pool sizes"],
                ["SYN-SENT", "Our SYN is waiting for a reply", "Peer unreachable or filtered"],
                ["SYN-RECV", "Server got SYN, waiting for final ACK", "SYN flood, or ACKs lost"],
                ["FIN-WAIT-1/2", "We closed; waiting for the peer", "Peer slow to close"],
                ["CLOSE-WAIT", "Peer closed; our app has not", "<b>Our</b> application leaks sockets"],
                ["LAST-ACK", "Both closed, waiting for final ACK", "Usually transient"],
                ["TIME-WAIT", "We closed first; waiting about 60 s", "Normal for busy clients; reuse connections"]
              ] },
              { t: "code", lang: "bash", code: "ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn\n#  1840 TIME-WAIT\n#   412 ESTAB\n#   397 CLOSE-WAIT     <- investigate the local app\nss -tanp state close-wait '( sport = :8080 )'\nss -ti dst 198.51.100.7      # per-connection rtt, cwnd, retrans" },
              { t: "h", text: "Reliability: retransmission" },
              { t: "p", html: "TCP numbers every byte and the receiver acknowledges what it has. Missing data is resent either after a retransmission timeout (RTO, at least 200 ms on Linux and doubling each time) or sooner by <b>fast retransmit</b> when duplicate ACKs or SACK blocks reveal a gap." },
              { t: "h", text: "Flow and congestion control" },
              { t: "ul", items: [
                "<b>Receive window</b>: how much the receiver can buffer. A zero window means the reading application is too slow.",
                "<b>Congestion window</b>: how much the sender dares to have in flight. Loss shrinks it; algorithms such as CUBIC (Linux default) or BBR grow it back.",
                "Throughput is limited by roughly window ÷ RTT: a 64 KiB window over 100 ms caps a flow near 5 Mbit/s, which is why window scaling matters on long links."
              ] },
              { t: "code", lang: "bash", code: "nstat -az TcpRetransSegs TcpExtTCPTimeouts TcpExtTCPSynRetrans\nsysctl net.ipv4.tcp_congestion_control net.ipv4.tcp_keepalive_time\n# tcp_keepalive_time = 7200   (2 hours before the first keepalive probe)" },
              { t: "note", variant: "warn", html: "Idle connections through NAT gateways, load balancers and firewalls are often dropped after a few minutes, but the default keepalive starts after two hours. Long-lived connections (database pools, websockets) need application or socket-level keepalives shorter than the middlebox timeout." },
              { t: "note", variant: "tip", html: "On macOS, <code>netstat -an -p tcp</code> lists states and <code>netstat -s -p tcp</code> prints retransmission counters." },
              { t: "cue", html: "<b>In the field:</b> intermittent hangs after exactly N minutes of idleness are almost always a middlebox idle timeout silently dropping the flow." },
              { t: "note", variant: "key", html: "Read states with ss: CLOSE-WAIT blames the local app, TIME-WAIT is normal; retransmits mean loss, and windows over RTT bound throughput." }
            ]
          },
          {
            id: "udp",
            title: "UDP and when to use it",
            summary: "Datagrams without connections, what UDP leaves to the application, DNS, QUIC and media, and debugging UDP services.",
            minutes: 8,
            tags: ["UDP", "QUIC", "datagrams"],
            blocks: [
              { t: "p", html: "UDP adds only ports and a checksum to IP. There is no handshake, no ordering, no retransmission and no congestion control. Each <code>send</code> is one datagram that arrives once, never, or occasionally twice." },
              { t: "compare", bad: { title: "TCP", items: ["Handshake before data", "Ordered, reliable byte stream", "Head-of-line blocking on loss", "Kernel congestion control"] }, good: { title: "UDP", items: ["Send immediately", "Independent datagrams, may be lost or reordered", "No blocking: late data can be skipped", "The application decides everything"] } },
              { t: "table", headers: ["Protocol", "Why UDP"], rows: [
                ["DNS (53)", "One small query and answer; just retry if lost"],
                ["DHCP (67/68)", "The client has no address yet"],
                ["NTP (123)", "Tiny, latency-sensitive timestamps"],
                ["Voice, video, games", "A late packet is useless; skip it"],
                ["QUIC / HTTP/3 (443)", "Reliability and TLS 1.3 implemented in user space, per stream"],
                ["WireGuard, many VPNs", "Tunnel packets without TCP-over-TCP meltdown"]
              ] },
              { t: "note", variant: "trap", html: "UDP has no 'connection refused' in the normal sense. A closed port may trigger an ICMP port-unreachable that some tools report, or nothing at all if ICMP is filtered. Silence proves nothing about a UDP service." },
              { t: "h", text: "Debugging UDP" },
              { t: "code", lang: "bash", code: "ss -ulnp                            # UDP listeners\ndig @10.0.0.2 shop.example          # test a DNS server explicitly\nnc -u -v 10.0.0.2 514 <<< 'test syslog line'\nsudo tcpdump -ni any udp port 53   # does the query leave? does an answer return?\nnstat -az | grep -i udp            # RcvbufErrors: datagrams dropped, socket buffer full" },
              { t: "note", variant: "warn", html: "Large DNS answers (DNSSEC, many records) exceed common UDP sizes and are truncated, forcing a retry over TCP 53. Firewalls that only allow UDP 53 break these lookups in confusing ways." },
              { t: "cue", html: "<b>In the field:</b> rising <code>UdpRcvbufErrors</code> on a metrics or syslog receiver means the application cannot read fast enough; raise the socket buffer or add receivers." },
              { t: "h", text: "Testing a UDP service" },
              { t: "code", lang: "bash", code: "dig @10.0.0.2 shop.example +tries=1 +time=2   # DNS is the UDP you will test most\nnc -u -v -w2 10.0.0.5 514 <<< 'test syslog'    # no reply is normal for syslog\nss -ulnp                                       # who is listening on UDP\nnstat -az UdpInErrors UdpRcvbufErrors          # drops because the socket buffer was full" },
              { t: "note", variant: "warn", html: "Port scanners report UDP as <code>open|filtered</code> because silence proves nothing. Only an application reply or an ICMP port-unreachable gives you a firm answer." },
              { t: "note", variant: "tip", html: "On macOS, use <code>netstat -anv -p udp</code> or <code>lsof -nP -iUDP</code> instead of <code>ss -u</code>, and <code>netstat -s -p udp</code> for drop counters." },
              { t: "quiz", id: "net-transport" },
              { t: "note", variant: "key", html: "UDP is ports plus a checksum; the application owns reliability, which suits DNS, media and QUIC, and silence proves nothing when debugging." }
            ]
          }
        ]
      },
      {
        id: "app",
        name: "Application protocols",
        icon: "globe",
        lessons: [
          {
            id: "dns",
            title: "DNS",
            summary: "Recursive and authoritative servers, record types, TTLs and caching, the stub resolver on Linux and macOS, and common failures.",
            minutes: 11,
            tags: ["DNS", "dig", "resolver"],
            blocks: [
              { t: "p", html: "DNS maps names to data, most often addresses. It is a distributed, cached database: <b>authoritative</b> servers own zones, and <b>recursive resolvers</b> chase the answer for clients and cache it." },
              { t: "diagram", id: "dns-resolution", caption: "Stub to recursive resolver, then root, TLD and authoritative servers; the answer is cached on the way back." },
              { t: "widget", id: "netDns" },
              { t: "table", headers: ["Record", "Holds", "Example"], rows: [
                ["A / AAAA", "IPv4 / IPv6 address", "www → 203.0.113.10"],
                ["CNAME", "Alias to another name", "api → lb-7.cdn.example"],
                ["MX", "Mail servers with priority", "10 mx1.shop.example"],
                ["TXT", "Free text: SPF, verification tokens", "\"v=spf1 -all\""],
                ["NS", "Authoritative servers for a zone", "ns1.shop.example"],
                ["SOA", "Zone metadata, negative-cache TTL", "serial, refresh, minimum"],
                ["PTR", "Reverse lookup: address to name", "10.113.0.203.in-addr.arpa"],
                ["SRV", "Service host and port", "_sip._tcp → host:5060"]
              ] },
              { t: "code", lang: "bash", code: "dig www.shop.example +short\ndig www.shop.example A +noall +answer      # just the answer section with TTLs\ndig @ns1.shop.example www.shop.example     # ask the authoritative server directly\ndig +trace www.shop.example                # do the referrals yourself\ndig -x 203.0.113.10                        # reverse (PTR)" },
              { t: "h", text: "The client side" },
              { t: "p", html: "Applications call the system resolver (<code>getaddrinfo</code>), which consults <code>/etc/hosts</code> and then DNS according to <code>/etc/nsswitch.conf</code>. On many Linux systems <code>/etc/resolv.conf</code> points at a local stub (systemd-resolved on 127.0.0.53); <code>resolvectl status</code> shows the real upstream servers." },
              { t: "note", variant: "warn", html: "On macOS, <code>dig</code> and <code>nslookup</code> bypass the system resolver, which may use per-domain VPN resolvers and mDNS. Test what applications see with <code>dscacheutil -q host -a name www.shop.example</code>, inspect with <code>scutil --dns</code>, and flush with <code>sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder</code>." },
              { t: "note", variant: "trap", html: "In Kubernetes and similar setups, <code>ndots:5</code> plus several search domains turns one lookup of <code>api.shop.example</code> into many queries for names like <code>api.shop.example.default.svc.cluster.local</code> first. Use fully qualified names with a trailing dot for external hosts." },
              { t: "h", text: "Failure patterns" },
              { t: "ul", items: [
                "<b>NXDOMAIN</b>: the name does not exist (typo, missing record), and that answer is cached too.",
                "<b>SERVFAIL</b>: the resolver could not get an answer: broken delegation, DNSSEC failure, unreachable authoritative servers.",
                "<b>Timeout</b>: resolver unreachable (firewall on UDP and TCP 53, wrong IP in resolv.conf).",
                "<b>Stale answer</b>: TTL caching after a change. Lower TTLs before migrations."
              ] },
              { t: "cue", html: "<b>In the field:</b> \"it is always DNS\" is a cliché because the failure surfaces as something else (timeouts, wrong server, TLS name mismatch). Check resolution first whenever behaviour differs between hosts." },
              { t: "note", variant: "key", html: "Recursive resolvers chase referrals from root to authoritative and cache by TTL; test with dig, but check the system resolver path on macOS and in containers." }
            ]
          },
          {
            id: "http",
            title: "HTTP/1.1, HTTP/2 and HTTP/3",
            summary: "Requests, responses and headers, status codes, keep-alive, multiplexing, QUIC, caching and proxies.",
            minutes: 10,
            tags: ["HTTP", "HTTP/2", "QUIC"],
            blocks: [
              { t: "p", html: "HTTP is a request-response protocol: a method and path with headers go one way, a status code with headers and a body come back. The semantics have barely changed in decades; the wire format and transport have." },
              { t: "code", lang: "text", code: "> GET /api/orders?limit=20 HTTP/1.1\n> Host: api.shop.example\n> Accept: application/json\n> Authorization: Bearer <your-token>\n>\n< HTTP/1.1 200 OK\n< Content-Type: application/json\n< Cache-Control: private, max-age=30\n< Content-Length: 5120\n< \n< {\"items\": [...]}" },
              { t: "table", headers: ["Code", "Meaning", "Usually"], rows: [
                ["200, 201, 204", "Success", "OK, created, no content"],
                ["301, 302, 304", "Redirect or not modified", "Moved; cache still valid"],
                ["400, 401, 403, 404", "Client problem", "Bad request, not authenticated, forbidden, not found"],
                ["429", "Too many requests", "Rate limited; respect Retry-After"],
                ["500", "Server error", "Bug or unhandled exception"],
                ["502, 504", "Bad or slow upstream", "Proxy could not get a timely valid answer"],
                ["503", "Unavailable", "Overloaded, draining, maintenance"]
              ] },
              { t: "h", text: "Three versions" },
              { t: "table", headers: ["", "HTTP/1.1", "HTTP/2", "HTTP/3"], rows: [
                ["Transport", "TCP (+TLS)", "TCP + TLS", "QUIC over UDP (TLS 1.3 built in)"],
                ["Format", "Text", "Binary frames", "Binary frames"],
                ["Concurrency", "One request at a time per connection", "Many streams per connection", "Many independent streams"],
                ["Loss impact", "Blocks that connection", "Blocks all streams (TCP head-of-line)", "Only the affected stream"],
                ["Negotiated by", "Default", "ALPN h2", "Alt-Svc header, then QUIC"]
              ] },
              { t: "note", variant: "tip", html: "<code>curl -sI --http2 https://shop.example/</code> and <code>curl -v</code> show the negotiated protocol in the ALPN lines. <code>--http3</code> works only if your curl was built with QUIC support." },
              { t: "h", text: "Keep-alive, caching and proxies" },
              { t: "ul", items: [
                "Reusing connections avoids a TCP and TLS handshake per request; pools and keep-alive are a big latency win.",
                "<code>Cache-Control</code>, <code>ETag</code> and <code>If-None-Match</code> let clients and CDNs avoid refetching.",
                "Reverse proxies add <code>X-Forwarded-For</code> / <code>Forwarded</code> with the client address and terminate TLS.",
                "A 502 or 504 from a proxy is about its upstream: check the backend, not the proxy."
              ] },
              { t: "note", variant: "warn", html: "Never paste real tokens into commands you share. Use a variable (<code>-H \"Authorization: Bearer $TOKEN\"</code>) and remember that <code>curl -v</code> prints request headers, including authorization." },
              { t: "cue", html: "<b>In the field:</b> when a page is slow, separate connection setup from server time with curl's timing variables, then read Cache-Control to see whether the CDN should have served it." },
              { t: "code", lang: "bash", code: "curl -sS -o /dev/null -w 'dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total} code=%{http_code}\\n' https://shop.example/\n# dns=0.012 tcp=0.043 tls=0.101 ttfb=0.870 total=0.872 code=200\n# -> the network is fine; 770 ms is spent in the application" },
              { t: "note", variant: "tip", html: "macOS ships curl too, linked against the system TLS stack, so certificate trust comes from the Keychain rather than <code>/etc/ssl/certs</code>. A certificate that works in curl on a Mac can still fail on Linux if the intermediate is missing." },
              { t: "note", variant: "key", html: "Same HTTP semantics, three transports: text over TCP, multiplexed binary over TCP, and per-stream reliability over QUIC; status families tell you which side failed." }
            ]
          },
          {
            id: "tls",
            title: "TLS handshakes and certificates",
            summary: "What TLS provides, the TLS 1.3 handshake, SNI and ALPN, certificate chains and validation, and common failures.",
            minutes: 11,
            tags: ["TLS", "certificates", "SNI"],
            blocks: [
              { t: "p", html: "TLS gives a connection three properties: <b>confidentiality</b> (encryption), <b>integrity</b> (tamper detection) and <b>authentication</b> of the server, and optionally the client, through certificates. HTTPS, SMTP with STARTTLS, database drivers and gRPC all use it." },
              { t: "diagram", id: "tls-handshake", caption: "TLS 1.3 in one round trip: ClientHello with key share, SNI and ALPN; ServerHello with certificate and Finished; client Finished." },
              { t: "h", text: "The TLS 1.3 handshake" },
              { t: "ol", items: [
                "<b>ClientHello</b>: supported versions and cipher suites, an ECDHE key share (for example X25519), the server name (<b>SNI</b>) and wanted protocols (<b>ALPN</b>: h2, http/1.1).",
                "<b>ServerHello</b>: picks parameters and sends its key share; from here everything is encrypted. Then the certificate chain, a signature proving it holds the private key, and Finished.",
                "<b>Client</b> validates the chain and name, sends Finished, and application data can flow: one round trip in total."
              ] },
              { t: "note", variant: "tip", html: "Prefer TLS 1.3 and disable TLS 1.0 and 1.1. With ephemeral ECDHE key exchange every session has forward secrecy: a stolen server key cannot decrypt recorded traffic." },
              { t: "h", text: "Certificate validation" },
              { t: "ul", items: [
                "The leaf certificate names the host in its <b>Subject Alternative Name</b> list (the CN field is legacy).",
                "It is signed by an intermediate, which is signed by a root in the client's trust store. The server must send the intermediates.",
                "Validity dates must cover now; clock skew on a client causes 'not yet valid' errors.",
                "Revocation is checked by some clients via OCSP or CRLs; servers can staple an OCSP response."
              ] },
              { t: "code", lang: "bash", code: "openssl s_client -connect shop.example:443 -servername shop.example </dev/null 2>/dev/null \\\n  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName\n# subject=CN = shop.example\n# issuer=C = US, O = Example CA, CN = Example Issuing CA R3\n# notBefore=Sep  1 00:00:00 2026 GMT\n# notAfter=Nov 30 23:59:59 2026 GMT\n# X509v3 Subject Alternative Name: DNS:shop.example, DNS:www.shop.example\n\nopenssl x509 -in server.crt -noout -text | grep -E 'Public-Key|Signature Algorithm'" },
              { t: "table", headers: ["Error", "Cause", "Fix"], rows: [
                ["certificate has expired", "notAfter passed", "Renew; automate renewal and alert 30 days ahead"],
                ["unable to get local issuer certificate", "Server did not send intermediates, or private CA not trusted", "Serve the full chain; add the CA to the trust store"],
                ["hostname mismatch", "Name not in SAN, or no SNI sent", "Fix the certificate or pass -servername"],
                ["self-signed certificate", "Dev or internal certificate", "Trust it explicitly for internal use only"],
                ["handshake failure / no shared cipher", "Version or cipher mismatch", "Enable TLS 1.2+ with modern suites on both sides"]
              ] },
              { t: "note", variant: "warn", html: "Never fix certificate errors with <code>curl -k</code>, <code>verify=False</code> or similar in real code; that removes authentication and invites interception. Fix the chain, the name or the trust store. Certificates should use RSA 2048-bit or larger or ECDSA P-256, and be signed with SHA-256 or stronger." },
              { t: "cue", html: "<b>In the field:</b> a monitoring check that runs the <code>openssl x509 -checkend 2592000</code> command against each endpoint warns you 30 days before any certificate expires." },
              { t: "h", text: "Certificate checks you will actually run" },
              { t: "code", lang: "bash", code: "# What does the server present (with SNI)?\nopenssl s_client -connect shop.example:443 -servername shop.example </dev/null 2>/dev/null \\\n  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName\n\n# Does it expire within 14 days? (exit 1 = yes) - put this in monitoring\nopenssl x509 -in /etc/ssl/shop.pem -noout -checkend $((14*24*3600))\n\n# Which protocol and cipher were negotiated?\nopenssl s_client -connect shop.example:443 -tls1_3 </dev/null 2>/dev/null | grep -E 'Protocol|Cipher'" },
              { t: "note", variant: "warn", html: "Never fix a certificate error with <code>curl -k</code> or by disabling verification in code. It removes the protection TLS exists for. Fix the chain, the name or the clock instead." },
              { t: "note", variant: "tip", html: "macOS ships LibreSSL as <code>openssl</code>, so some flags and outputs differ from OpenSSL 3 on Linux. Install <code>openssl@3</code> with Homebrew when you need identical behaviour." },
              { t: "quiz", id: "net-app" },
              { t: "note", variant: "key", html: "TLS 1.3 negotiates keys, SNI and ALPN in one round trip; clients validate the chain, dates and SAN name, and the fix for errors is never to disable verification." }
            ]
          }
        ]
      }
    ]
  };
})();
