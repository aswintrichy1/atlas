/* =====================================================================
   CITADEL · Interactive widgets (cryptography)
   caesar · avalanche (SHA-256) · diffie · tlsflow
   Registered on window.Widgets[id]; pure client-side, no network.
   ===================================================================== */
(function () {
  "use strict";

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  };
  const shell = (mount, pill, title, desc) => {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  };
  const seg = (options, current, onPick) => {
    const wrap = h("div", { class: "w-seg" });
    const btns = [];
    options.forEach(([label, val]) => {
      const b = h("button", { class: val === current ? "active" : "" }, label);
      b.addEventListener("click", () => { btns.forEach((x) => x.classList.remove("active")); b.classList.add("active"); onPick(val); });
      wrap.appendChild(b); btns.push(b);
    });
    return wrap;
  };

  const Widgets = {};

  /* ---------------------------------------------------------------
     1. CLASSICAL CIPHER PLAYGROUND  (Caesar · Vigenere · ROT13)
  --------------------------------------------------------------- */
  Widgets.caesar = function (mount) {
    shell(mount, "crypto lab", "Classical cipher playground",
      "Feel how a key transforms text. Educational only \u2014 these ciphers are trivially broken and must never protect real data.");

    let mode = "caesar", dir = 1, shift = 3, keyword = "LEMON";
    const text = h("textarea", { class: "cy-textarea", rows: "2", spellcheck: "false" });
    text.value = "Attack at dawn";

    function shiftChar(ch, n) {
      if (ch >= "a" && ch <= "z") return String.fromCharCode((ch.charCodeAt(0) - 97 + (n % 26) + 26) % 26 + 97);
      if (ch >= "A" && ch <= "Z") return String.fromCharCode((ch.charCodeAt(0) - 65 + (n % 26) + 26) % 26 + 65);
      return ch;
    }
    function transform() {
      const t = text.value;
      if (mode === "rot13") return t.split("").map((c) => shiftChar(c, 13)).join("");
      if (mode === "caesar") return t.split("").map((c) => shiftChar(c, dir * shift)).join("");
      // vigenere
      const key = keyword.toLowerCase().replace(/[^a-z]/g, "");
      if (!key) return t;
      let ki = 0;
      return t.split("").map((c) => {
        if (/[a-zA-Z]/.test(c)) { const k = key.charCodeAt(ki % key.length) - 97; ki++; return shiftChar(c, dir * k); }
        return c;
      }).join("");
    }

    const controls = h("div", { class: "widget-controls" });
    const dynControls = h("div", { class: "widget-controls" });
    const out = h("pre", { class: "cipher-out" });
    const keyline = h("div", { class: "cipher-key" });

    function renderDyn() {
      dynControls.innerHTML = "";
      if (mode === "caesar") {
        const n = h("input", { type: "number", min: "0", max: "25", value: String(shift), class: "cy-num" });
        n.addEventListener("input", () => { shift = Math.max(0, Math.min(25, +n.value || 0)); render(); });
        dynControls.appendChild(h("div", { class: "w-field" }, "Shift", n));
      } else if (mode === "vigenere") {
        const kw = h("input", { type: "text", value: keyword, class: "cy-input", spellcheck: "false" });
        kw.addEventListener("input", () => { keyword = kw.value; render(); });
        dynControls.appendChild(h("div", { class: "w-field" }, "Keyword", kw));
      }
      if (mode !== "rot13") {
        dynControls.appendChild(seg([["Encode", 1], ["Decode", -1]], dir, (v) => { dir = v; render(); }));
      }
    }
    function render() {
      out.textContent = transform() || "\u00a0";
      const k = mode === "rot13" ? "ROT13 (self-inverse)" : mode === "caesar" ? ("shift " + (dir < 0 ? "-" : "+") + shift) : ("keyword \u201c" + (keyword || "?") + "\u201d \u00b7 " + (dir < 0 ? "decode" : "encode"));
      keyline.textContent = "key: " + k;
    }

    controls.appendChild(seg([["Caesar", "caesar"], ["Vigen\u00e8re", "vigenere"], ["ROT13", "rot13"]], mode, (v) => { mode = v; renderDyn(); render(); }));
    mount.appendChild(controls);
    mount.appendChild(dynControls);
    mount.appendChild(h("div", { class: "w-field", style: "margin-bottom:8px" }, "Plaintext / ciphertext:"));
    mount.appendChild(text);
    const stage = h("div", { class: "w-stage" }, keyline, out);
    mount.appendChild(stage);
    text.addEventListener("input", render);
    renderDyn(); render();
  };

  /* ---------------------------------------------------------------
     2. HASH AVALANCHE  (real SHA-256, computed in-browser)
  --------------------------------------------------------------- */
  function sha256(str) {
    const utf8 = unescape(encodeURIComponent(str));
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
    const w = new Array(64);
    for (let i = 0; i < bytes.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  function hexBitDiff(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) { let x = parseInt(a[i], 16) ^ parseInt(b[i], 16); while (x) { d += x & 1; x >>= 1; } }
    return d;
  }

  Widgets.avalanche = function (mount) {
    shell(mount, "crypto lab", "Hash avalanche (SHA-256)",
      "Change one character in either box and watch the digest change completely \u2014 about half the output bits flip. Computed with a real SHA-256.");

    const a = h("input", { type: "text", class: "cy-input", spellcheck: "false", value: "blockchain" });
    const b = h("input", { type: "text", class: "cy-input", spellcheck: "false", value: "blockchaim" });
    mount.appendChild(h("div", { class: "widget-controls" },
      h("div", { class: "w-field", style: "flex:1;min-width:200px" }, "Input A", a),
      h("div", { class: "w-field", style: "flex:1;min-width:200px" }, "Input B", b)
    ));
    const stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);

    function digestRow(tag, hex, other) {
      const row = h("div", { class: "av-row" }, h("span", { class: "av-tag" }, tag));
      const hexWrap = h("span", { class: "av-digest" });
      for (let i = 0; i < hex.length; i++) hexWrap.appendChild(h("span", { class: other && hex[i] !== other[i] ? "av-nib diff" : "av-nib" }, hex[i]));
      row.appendChild(hexWrap);
      return row;
    }
    function render() {
      const ha = sha256(a.value), hb = sha256(b.value);
      const bits = hexBitDiff(ha, hb);
      const pct = Math.round((bits / 256) * 100);
      stage.innerHTML = "";
      stage.appendChild(digestRow("A", ha, hb));
      stage.appendChild(digestRow("B", hb, ha));
      stage.appendChild(h("div", { class: "w-readout" },
        h("span", { class: "ro" }, "differing bits ", h("b", {}, bits + " / 256")),
        h("span", { class: "ro" }, "that's ", h("b", {}, pct + "%"), " of the output"),
        h("span", { class: "ro" }, a.value === b.value ? "(identical inputs \u2192 identical digest)" : "(one small change \u2192 total change)")
      ));
    }
    a.addEventListener("input", render);
    b.addEventListener("input", render);
    render();
  };

  /* ---------------------------------------------------------------
     3. DIFFIE-HELLMAN KEY EXCHANGE
  --------------------------------------------------------------- */
  Widgets.diffie = function (mount) {
    shell(mount, "crypto lab", "Diffie\u2013Hellman key exchange",
      "Alice and Bob derive the same shared secret over a public channel. The eavesdropper sees everything except their private numbers \u2014 and still can't compute it.");

    const PAIRS = [[23, 5], [47, 5], [97, 5]];
    let pi = 0, a = 6, b = 15;
    const modpow = (base, exp, mod) => { let r = 1; base %= mod; while (exp > 0) { if (exp & 1) r = (r * base) % mod; exp >>= 1; base = (base * base) % mod; } return r; };

    const controls = h("div", { class: "widget-controls" });
    const stage = h("div", { class: "w-stage" });
    mount.appendChild(controls);
    mount.appendChild(stage);

    function renderControls() {
      controls.innerHTML = "";
      const p = PAIRS[pi][0];
      controls.appendChild(h("div", { class: "w-field" }, "Public p, g",
        seg(PAIRS.map((pr, idx) => ["p=" + pr[0] + ", g=" + pr[1], idx]), pi, (v) => {
          pi = v; const np = PAIRS[pi][0]; a = Math.min(a, np - 2); b = Math.min(b, np - 2);
          renderControls(); renderStage();
        })));
      const sa = h("input", { type: "range", min: "2", max: String(p - 2), value: String(a), class: "cy-range" });
      sa.addEventListener("input", () => { a = +sa.value; renderStage(); });
      const sb = h("input", { type: "range", min: "2", max: String(p - 2), value: String(b), class: "cy-range" });
      sb.addEventListener("input", () => { b = +sb.value; renderStage(); });
      controls.appendChild(h("div", { class: "w-field" }, "Alice secret a", sa));
      controls.appendChild(h("div", { class: "w-field" }, "Bob secret b", sb));
    }
    function row(cls, who, expr, val) {
      return h("div", { class: "dh-row " + cls }, h("span", { class: "dh-who" }, who), h("span", { class: "dh-expr" }, expr), h("span", { class: "dh-val" }, String(val)));
    }
    function renderStage() {
      const [p, g] = PAIRS[pi];
      const A = modpow(g, a, p), B = modpow(g, b, p);
      const sA = modpow(B, a, p), sB = modpow(A, b, p);
      stage.innerHTML = "";
      stage.appendChild(row("alice", "Alice", "A = g^a mod p = " + g + "^" + a + " mod " + p, A));
      stage.appendChild(row("bob", "Bob", "B = g^b mod p = " + g + "^" + b + " mod " + p, B));
      stage.appendChild(h("div", { class: "dh-swap" }, "\u2193 Alice and Bob swap A and B over the public channel \u2193"));
      stage.appendChild(row("alice", "Alice computes", "B^a mod p", sA));
      stage.appendChild(row("bob", "Bob computes", "A^b mod p", sB));
      stage.appendChild(h("div", { class: "dh-secret" + (sA === sB ? " ok" : "") },
        "Shared secret = " + sA + (sA === sB ? "  \u2713 both sides match" : "")));
      stage.appendChild(h("div", { class: "dh-eve" },
        "Eavesdropper sees: p=" + p + ", g=" + g + ", A=" + A + ", B=" + B + "  \u2014 but not a or b, so the secret stays hidden."));
    }
    renderControls(); renderStage();
  };

  /* ---------------------------------------------------------------
     4. TLS HANDSHAKE STEPPER
  --------------------------------------------------------------- */
  Widgets.tlsflow = function (mount) {
    shell(mount, "crypto lab", "TLS 1.3 handshake stepper",
      "Walk the handshake message by message. Watch where it authenticates, agrees a key, and switches from slow asymmetric to fast symmetric crypto.");

    const STEPS = [
      { dir: "\u2192", msg: "ClientHello", phase: "Negotiate", text: "The client offers its supported TLS versions and cipher suites, and sends an ephemeral key share (its half of the Diffie\u2013Hellman exchange)." },
      { dir: "\u2190", msg: "ServerHello", phase: "Negotiate", text: "The server picks the version and cipher suite and returns its own ephemeral key share. Both sides now have what they need to derive a key." },
      { dir: "\u2190", msg: "Certificate + verify", phase: "Authenticate \u00b7 asymmetric", text: "The server sends its certificate chain and a signature. The client verifies the chain up to a trusted root \u2014 this is the asymmetric, public-key step that proves identity." },
      { dir: "\u21c4", msg: "Key derivation (ECDHE)", phase: "Key agreement", text: "Each side combines the two key shares into the same shared secret. Because the keys are ephemeral, this gives forward secrecy \u2014 stealing the server key later won't decrypt this session." },
      { dir: "\u21c4", msg: "Finished", phase: "Verify \u00b7 symmetric", text: "Both sides send an encrypted, authenticated Finished message proving the handshake wasn't tampered with. From here on, everything is encrypted." },
      { dir: "\u21c4", msg: "Application data", phase: "Encrypted \u00b7 symmetric", text: "HTTP requests and responses flow under fast authenticated encryption (AES-GCM or ChaCha20-Poly1305) using the derived session keys." }
    ];
    let i = 0;

    const diagram = h("div", { class: "tls-diagram" },
      h("div", { class: "tls-peer" }, "Client"),
      h("div", { class: "tls-wire" }, h("span", { class: "tls-arrow", id: "tlsArrow" }, ""), h("span", { class: "tls-msg", id: "tlsMsg" }, "")),
      h("div", { class: "tls-peer" }, "Server")
    );
    const phase = h("span", { class: "tls-phase", id: "tlsPhase" }, "");
    const desc = h("p", { class: "tls-desc", id: "tlsDesc" }, "");
    const dots = h("div", { class: "tls-dots" });
    STEPS.forEach((s, idx) => { const d = h("button", { class: "tls-dot", title: s.msg }); d.addEventListener("click", () => { i = idx; render(); }); dots.appendChild(d); });

    const prev = h("button", { class: "w-btn ghost" }, "\u2190 Prev");
    const next = h("button", { class: "w-btn primary" }, "Next \u2192");
    prev.addEventListener("click", () => { i = (i - 1 + STEPS.length) % STEPS.length; render(); });
    next.addEventListener("click", () => { i = (i + 1) % STEPS.length; render(); });

    const stage = h("div", { class: "w-stage" }, diagram, h("div", { class: "tls-head" }, phase, h("span", { class: "tls-count", id: "tlsCount" }, "")), desc);
    mount.appendChild(stage);
    mount.appendChild(h("div", { class: "widget-controls", style: "justify-content:space-between;margin-top:14px" }, prev, dots, next));

    function render() {
      const s = STEPS[i];
      document.getElementById("tlsArrow").textContent = s.dir;
      document.getElementById("tlsMsg").textContent = s.msg;
      document.getElementById("tlsPhase").textContent = s.phase;
      document.getElementById("tlsDesc").textContent = s.text;
      document.getElementById("tlsCount").textContent = "Step " + (i + 1) + " / " + STEPS.length;
      Array.from(dots.children).forEach((d, idx) => d.classList.toggle("on", idx === i));
    }
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
