/* =====================================================================
   CITADEL · Interactive widgets — Reverse Engineering pack
   memorylayout · endianness · mitigations
   Merged into window.Widgets (loaded before app.js). Pure client-side,
   built as DOM nodes (never innerHTML of user input), zero network.
   Styles live in css/track-reversing.css (rv- prefix).
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
     1. PROCESS MEMORY LAYOUT  (click a region to explore it)
  --------------------------------------------------------------- */
  Widgets.memorylayout = function (mount) {
    mount.textContent = "";
    shell(mount, "reverse lab", "Process memory layout",
      "A running program's virtual address space, high addresses at the top. Click a region to see what it holds, which way it grows, and the defense tied to it.");
    // Ordered high -> low address (top -> bottom on screen).
    const REGIONS = [
      { id: "stack", name: "Stack", grow: "grows down \u2193", perm: "Read / Write \u00b7 no-execute",
        holds: "Local variables, function arguments, and saved return addresses \u2014 one frame per active call.",
        sec: "The saved return address lives here, so a stack overflow can hijack control flow. Defended by stack canaries and shadow stacks." },
      { id: "gap", name: "(unmapped gap)", grow: "buffer between stack & heap", perm: "No access",
        holds: "Deliberately unmapped space separating the downward stack from the upward heap.",
        sec: "Touching unmapped memory faults immediately \u2014 a guard region that turns some overruns into a clean crash instead of silent corruption." },
      { id: "heap", name: "Heap", grow: "grows up \u2191", perm: "Read / Write \u00b7 no-execute",
        holds: "Dynamic allocations (malloc / new) that must outlive the function that created them.",
        sec: "Allocator metadata and freed chunks are sensitive: use-after-free and double-free bugs live here. Hardened allocators and quarantines raise the cost." },
      { id: "bss", name: "BSS", grow: "fixed size", perm: "Read / Write",
        holds: "Uninitialized (zero-initialized) global and static variables.",
        sec: "Zeroed at startup so the program can't leak stale memory, but an overflow can still spill into adjacent globals." },
      { id: "data", name: "Data", grow: "fixed size", perm: "Read / Write",
        holds: "Initialized global and static variables.",
        sec: "Writable globals are a corruption target; RELRO can mark some control data read-only after startup." },
      { id: "text", name: "Text / code", grow: "fixed size", perm: "Read / Execute \u00b7 read-only",
        holds: "The program's machine instructions and, often, read-only constants.",
        sec: "Mapped executable but never writable. W^X / NX keeps code and data apart so data an attacker writes can't run as code." }
    ];
    let sel = 0;

    const map = h("div", { class: "rv-mem" });
    map.appendChild(h("div", { class: "rv-addr-cap" }, "high addresses \u2191"));
    const rows = REGIONS.map((r, idx) => {
      const row = h("button", { class: "rv-region rv-" + r.id, type: "button" },
        h("span", { class: "rv-region-name" }, r.name),
        h("span", { class: "rv-region-grow" }, r.grow));
      row.addEventListener("click", () => { sel = idx; render(); });
      map.appendChild(row);
      return row;
    });
    map.appendChild(h("div", { class: "rv-addr-cap" }, "low addresses \u2193"));
    mount.appendChild(map);

    const detail = h("div", { class: "w-stage rv-mem-detail" });
    mount.appendChild(detail);

    function row(k, v) {
      return h("div", { class: "sub-row" }, h("span", { class: "sub-k" }, k), h("span", { class: "sub-v" }, v));
    }
    function render() {
      const r = REGIONS[sel];
      rows.forEach((el, idx) => el.classList.toggle("on", idx === sel));
      detail.textContent = "";
      detail.appendChild(h("div", { class: "rv-detail-head" },
        h("h4", { class: "rv-detail-name" }, r.name),
        h("span", { class: "rv-perm" }, r.perm)));
      detail.appendChild(row("Holds", r.holds));
      detail.appendChild(row("Growth", r.grow));
      detail.appendChild(h("p", { class: "rv-secnote" }, h("strong", {}, "Security: "), document.createTextNode(r.sec)));
    }
    render();
  };

  /* ---------------------------------------------------------------
     2. ENDIANNESS  (byte-order converter)
  --------------------------------------------------------------- */
  Widgets.endianness = function (mount) {
    mount.textContent = "";
    shell(mount, "reverse lab", "Endianness explorer",
      "Type a value (hex like 0x12345678, or a decimal number) and pick a width. See how the same number is laid out byte-by-byte in big-endian and little-endian memory.");

    const input = h("input", { type: "text", class: "cy-input", spellcheck: "false", value: "0x12345678" });
    let width = 4;
    const widthSeg = seg([["1 byte", 1], ["2 bytes", 2], ["4 bytes", 4], ["8 bytes", 8]], width, (v) => { width = v; render(); });
    mount.appendChild(h("div", { class: "widget-controls" },
      h("div", { class: "w-field", style: "flex:1;min-width:200px" }, input),
      widthSeg));

    const stage = h("div", { class: "w-stage rv-endian" });
    mount.appendChild(stage);
    const readout = h("div", { class: "w-readout" });
    mount.appendChild(readout);

    function parse(str) {
      const s = str.trim().toLowerCase().replace(/[_ ]/g, "");
      if (!s) return { err: "Enter a value, e.g. 0x12345678 or 305419896." };
      let val;
      try {
        if (/^0x[0-9a-f]+$/.test(s)) val = BigInt(s);
        else if (/^[0-9a-f]+$/.test(s) && /[a-f]/.test(s)) val = BigInt("0x" + s);
        else if (/^[0-9]+$/.test(s)) val = BigInt(s);
        else return { err: "Use hex (0x..) or a non-negative whole number." };
      } catch (e) { return { err: "That value could not be parsed." }; }
      if (val < 0n) return { err: "Only non-negative values are supported." };
      return { val };
    }

    function byteRow(label, bytes) {
      const wrap = h("div", { class: "rv-endian-row" });
      wrap.appendChild(h("span", { class: "rv-endian-label" }, label));
      const cells = h("div", { class: "rv-bytes" });
      bytes.forEach((bv, addr) => {
        cells.appendChild(h("div", { class: "rv-byte" },
          h("span", { class: "rv-byte-addr" }, "@" + addr),
          h("span", { class: "rv-byte-val" }, bv.toString(16).padStart(2, "0").toUpperCase())));
      });
      wrap.appendChild(cells);
      return wrap;
    }

    function render() {
      stage.textContent = "";
      readout.textContent = "";
      const p = parse(input.value);
      if (p.err) {
        stage.appendChild(h("p", { class: "rv-err" }, p.err));
        return;
      }
      const max = (1n << BigInt(8 * width));
      if (p.val >= max) {
        stage.appendChild(h("p", { class: "rv-err" },
          "0x" + p.val.toString(16).toUpperCase() + " needs more than " + width + " byte" + (width > 1 ? "s" : "") + ". Pick a wider width."));
        return;
      }
      // Most-significant byte first (this is also big-endian's memory order).
      const msbFirst = [];
      for (let i = width - 1; i >= 0; i--) {
        msbFirst.push(Number((p.val >> BigInt(8 * i)) & 0xffn));
      }
      // Big-endian: address 0 holds the MSB.  Little-endian: address 0 holds the LSB.
      const big = msbFirst.slice();
      const little = msbFirst.slice().reverse();
      stage.appendChild(byteRow("Big-endian", big));
      stage.appendChild(byteRow("Little-endian", little));
      stage.appendChild(h("p", { class: "rv-explain" },
        "Little-endian (x86 / most ARM) stores the least-significant byte at the lowest address; big-endian (\u201cnetwork byte order\u201d) stores the most-significant byte first. The number is identical \u2014 only the byte order in memory differs."));
      const hex = "0x" + p.val.toString(16).toUpperCase();
      readout.appendChild(h("span", { class: "ro" }, "value ", h("b", {}, hex), " \u00b7 ", h("b", {}, p.val.toString(10)), " decimal"));
    }

    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") render(); });
    render();
  };

  /* ---------------------------------------------------------------
     3. EXPLOIT MITIGATIONS EXPLORER
  --------------------------------------------------------------- */
  Widgets.mitigations = function (mount) {
    mount.textContent = "";
    shell(mount, "reverse lab", "Exploit mitigations explorer",
      "The layered defenses that make a memory bug expensive to exploit. Pick one to see what attack it raises the cost of and how it works \u2014 defensively.");
    const MIT = [
      { tag: "NX / DEP", full: "No-eXecute / Data Execution Prevention",
        cost: "running attacker-supplied data as code",
        how: "Marks writable memory (stack, heap) non-executable, enforcing W^X \u2014 so bytes written as data can never be run as instructions.",
        build: "On by default; never link with an executable stack (-z execstack)." },
      { tag: "ASLR", full: "Address Space Layout Randomization",
        cost: "relying on fixed, predictable memory addresses",
        how: "Randomizes the base of the stack, heap, libraries and (with PIE) the executable each run, so an attacker can't hardcode addresses; an info-leak becomes a prerequisite.",
        build: "Enable system-wide; compile PIE so the main program is randomized too." },
      { tag: "Stack canary", full: "Stack-Smashing Protector",
        cost: "overwriting the saved return address with a linear overflow",
        how: "Places a random \u201ccanary\u201d before the return address and checks it before returning; a linear overflow corrupts the canary and the program aborts safely.",
        build: "-fstack-protector-strong (or -all)." },
      { tag: "PIE", full: "Position-Independent Executable",
        cost: "hardcoding addresses in the program's own code",
        how: "Lets the loader place the executable at a random base, extending ASLR to the program's own code and globals \u2014 not just its libraries.",
        build: "-fPIE -pie." },
      { tag: "RELRO", full: "RELocation Read-Only",
        cost: "overwriting the GOT to hijack function pointers",
        how: "Resolves dynamic symbols at startup, then maps the GOT read-only (full RELRO) so it can't be tampered with at runtime.",
        build: "-Wl,-z,relro,-z,now." },
      { tag: "CFG / CFI", full: "Control-Flow Guard / Integrity",
        cost: "diverting execution to arbitrary addresses (ROP / JOP)",
        how: "Validates indirect calls and returns against a set of legal targets, so a corrupted pointer can't jump just anywhere; hardware shadow stacks (CET) reinforce it.",
        build: "-fcf-protection=full (Intel CET) or /guard:cf on MSVC." }
    ];
    let sel = 0;

    const grid = h("div", { class: "rv-mit-grid" });
    const chips = MIT.map((m, idx) => {
      const c = h("button", { class: "rv-mit-chip", type: "button" }, m.tag);
      c.addEventListener("click", () => { sel = idx; render(); });
      grid.appendChild(c);
      return c;
    });
    mount.appendChild(grid);

    const detail = h("div", { class: "w-stage rv-mit-detail" });
    mount.appendChild(detail);

    function render() {
      const m = MIT[sel];
      chips.forEach((c, idx) => c.classList.toggle("on", idx === sel));
      detail.textContent = "";
      detail.appendChild(h("div", { class: "rv-mit-head" },
        h("h4", { class: "rv-mit-name" }, m.tag),
        h("span", { class: "rv-mit-full" }, m.full)));
      detail.appendChild(h("div", { class: "rv-mit-cost" },
        h("span", { class: "rv-mit-cost-k" }, "raises the cost of"),
        h("span", { class: "rv-mit-cost-v" }, m.cost)));
      detail.appendChild(h("p", { class: "rv-mit-how" }, m.how));
      detail.appendChild(h("div", { class: "rv-mit-build" }, h("span", { class: "rv-mit-build-k" }, "enable"), h("code", {}, m.build)));
    }
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
