/* =====================================================================
   BLUEPRINT · Interactive pattern widgets (interview track)
   Sliding window, fast/slow pointers, in-place reversal, monotonic stack,
   merge intervals, modified binary search, tree traversal, matrix flood
   fill, DP table and a bitwise playground. Registered on window.Widgets.
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
      if (kid == null) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };
  const shell = (mount, pill, title, desc) => {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  };
  const seg = (labels, onPick) => {
    const wrap = h("div", { class: "w-seg" });
    labels.forEach((lab, i) => {
      const b = h("button", { class: i === 0 ? "active" : "" }, lab);
      b.addEventListener("click", () => {
        wrap.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        onPick(lab, i);
      });
      wrap.appendChild(b);
    });
    return wrap;
  };
  const btn = (label, cls, onClick) => h("button", { class: "w-btn " + (cls || ""), onclick: onClick }, label);
  const alive = (node) => document.body.contains(node);
  const legendItem = (color, label) => h("span", {}, h("i", { style: "background:" + color }), label);

  // generic stepper: builds frames, paints, supports step / auto / reset
  function stepper(mount, build, paint, speed) {
    const ctl = { frames: [], fi: 0, timer: null };
    function stop() { if (ctl.timer) { clearInterval(ctl.timer); ctl.timer = null; if (ctl.autoBtn) ctl.autoBtn.textContent = ctl.autoLabel; } }
    function step() { if (ctl.fi < ctl.frames.length - 1) { ctl.fi++; paint(true); } else stop(); }
    function reset() { stop(); ctl.frames = build(); ctl.fi = 0; paint(false); }
    function auto(label) {
      ctl.autoLabel = label;
      const b = btn(label, "primary", () => {
        if (ctl.timer) { stop(); return; }
        if (ctl.fi >= ctl.frames.length - 1) reset();
        b.textContent = "Pause";
        ctl.timer = setInterval(() => { if (!alive(mount)) { stop(); return; } if (ctl.fi >= ctl.frames.length - 1) { stop(); return; } step(); }, speed || 700);
      });
      ctl.autoBtn = b; return b;
    }
    ctl.stop = stop; ctl.step = step; ctl.reset = reset; ctl.auto = auto;
    return ctl;
  }

  const Widgets = window.Widgets || {};

  /* ---------------------------------------------------------------
     SLIDING WINDOW — fixed-size window max sum
  --------------------------------------------------------------- */
  Widgets.slidingwindow = function (mount) {
    shell(mount, "pattern lab", "Sliding Window",
      "Slide a window of size k across the array. Instead of re-summing each window (O(n·k)), add the entering element and subtract the leaving one — O(n).");

    let arr = [2, 1, 5, 1, 3, 2, 4, 2], k = 3;
    const cells = h("div", { class: "dsa-cells" });
    const readout = h("span", { class: "ro" }, "");
    const log = h("div", { class: "dsa-log" });

    const ctl = stepper(mount, build, paint, 700);
    function build() {
      const F = []; let sum = 0; let best = -Infinity, bestL = 0;
      for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= k) sum -= arr[i - k];
        if (i >= k - 1) {
          const L = i - k + 1;
          if (sum > best) { best = sum; bestL = L; }
          F.push({ L, R: i, sum, best, bestL, enter: arr[i], leave: i >= k ? arr[i - k] : null });
        } else {
          F.push({ L: 0, R: i, sum, best: -Infinity, bestL: 0, building: true, enter: arr[i] });
        }
      }
      return F;
    }
    function paint(appendLog) {
      const f = ctl.frames[ctl.fi];
      cells.innerHTML = "";
      arr.forEach((v, i) => {
        let cls = "dsa-cell";
        if (!f.building && i >= f.L && i <= f.R) cls += " win";
        if (i === f.R || i === f.L) cls += " win-edge";
        cells.appendChild(h("div", { class: cls }, h("span", { class: "idx" }, i), String(v),
          i === f.R ? h("span", { class: "ptr" }, "R") : (i === f.L && !f.building ? h("span", { class: "ptr" }, "L") : null)));
      });
      readout.innerHTML = "";
      if (f.building) readout.appendChild(h("b", { style: "color:var(--text-dim)" }, "filling first window… sum = " + f.sum));
      else {
        readout.appendChild(document.createTextNode("window [" + f.L + ".." + f.R + "] sum = "));
        readout.appendChild(h("b", {}, String(f.sum)));
        readout.appendChild(document.createTextNode("   best so far = "));
        readout.appendChild(h("b", { style: "color:var(--lime)" }, f.best === -Infinity ? "—" : String(f.best)));
      }
      if (appendLog && !f.building) {
        const d = h("div", {});
        d.textContent = "slide → add " + f.enter + (f.leave != null ? ", drop " + f.leave : "") + "  ⇒ sum " + f.sum;
        log.insertBefore(d, log.firstChild);
      }
    }

    const kSel = h("select");
    [2, 3, 4].forEach((kk) => kSel.appendChild(h("option", { value: kk, selected: kk === k ? "selected" : null }, "k = " + kk)));
    kSel.addEventListener("change", () => { k = +kSel.value; ctl.reset(); log.innerHTML = ""; });

    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, kSel),
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-slide"),
      btn("Shuffle", "ghost", () => { arr = Array.from({ length: 8 }, () => 1 + Math.floor(Math.random() * 9)); log.innerHTML = ""; ctl.reset(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, cells));
    mount.appendChild(h("div", { class: "w-readout" }, readout));
    mount.appendChild(log);
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     FAST & SLOW POINTERS — cycle detection (Floyd)
  --------------------------------------------------------------- */
  Widgets.fastslow = function (mount) {
    shell(mount, "pattern lab", "Fast & Slow Pointers",
      "Two pointers move at different speeds. If the list loops, the fast one (2 steps) eventually laps the slow one (1 step) and they collide — proving a cycle in O(n) time, O(1) space.");

    let n = 7, cycleTo = 3; // index the tail points back to (-1 = no cycle)
    const row = h("div", { class: "ll-row" });
    const readout = h("span", { class: "ro" }, "");
    const log = h("div", { class: "dsa-log" });

    function next(i) { if (i < n - 1) return i + 1; return cycleTo; } // tail -> cycleTo (or -1)

    const ctl = stepper(mount, build, paint, 650);
    function build() {
      const F = []; let slow = 0, fast = 0; F.push({ slow, fast, msg: "start: slow & fast at head" });
      for (let s = 0; s < 2 * n + 4; s++) {
        slow = next(slow);
        fast = next(fast); if (fast >= 0) fast = next(fast);
        if (slow < 0 || fast < 0) { F.push({ slow: slow < 0 ? -1 : slow, fast: -1, msg: "fast hit the end → no cycle", done: "none" }); break; }
        if (slow === fast) { F.push({ slow, fast, msg: "slow == fast at node " + slow + " → cycle detected!", done: "cycle" }); break; }
        F.push({ slow, fast, msg: "slow→" + slow + ", fast→" + fast });
      }
      return F;
    }
    function paint(appendLog) {
      const f = ctl.frames[ctl.fi];
      row.innerHTML = "";
      for (let i = 0; i < n; i++) {
        let cls = "ll-node";
        if (i === f.slow && i === f.fast) cls += " both";
        else if (i === f.slow) cls += " slow";
        else if (i === f.fast) cls += " fast";
        const node = h("div", { class: cls }, String.fromCharCode(65 + i),
          i === f.slow ? h("span", { class: "ll-tag s" }, "slow") : null,
          i === f.fast ? h("span", { class: "ll-tag f" }, "fast") : null);
        row.appendChild(node);
        if (i < n - 1) row.appendChild(h("div", { class: "ll-arrow" }, h("span", { html: '<svg viewBox="0 0 24 16"><path d="M2 8h18M15 3l5 5-5 5"/></svg>' })));
      }
      if (cycleTo >= 0) row.appendChild(h("span", { class: "gt-ds-lbl", style: "margin-left:8px;font-family:var(--font-mono);font-size:.66rem;color:var(--violet)" }, "tail ↺ " + String.fromCharCode(65 + cycleTo)));
      readout.innerHTML = "";
      readout.appendChild(h("b", { style: "color:" + (f.done === "cycle" ? "var(--rose)" : f.done === "none" ? "var(--cyan)" : "var(--accent)") }, f.msg));
      if (appendLog) { const d = h("div", f.done === "cycle" ? { class: "no" } : f.done === "none" ? { class: "ok" } : {}); d.textContent = f.msg; log.insertBefore(d, log.firstChild); }
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg(["with cycle", "no cycle"], (v) => { cycleTo = v === "with cycle" ? 3 : -1; log.innerHTML = ""; ctl.reset(); }),
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-run"), btn("Reset", "ghost", () => { log.innerHTML = ""; ctl.reset(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, row));
    mount.appendChild(h("div", { class: "w-readout" }, readout));
    mount.appendChild(log);
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--cyan)", "slow (×1)"), legendItem("var(--amber)", "fast (×2)"), legendItem("var(--rose)", "collision")));
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     IN-PLACE LINKED LIST REVERSAL
  --------------------------------------------------------------- */
  Widgets.listreversal = function (mount) {
    shell(mount, "pattern lab", "In-place List Reversal",
      "Reverse a linked list by re-pointing each node's arrow backwards with three pointers — prev, cur, next — in one pass, O(1) extra space.");

    const vals = [1, 2, 3, 4, 5];
    const row = h("div", { class: "ll-row" });
    const readout = h("span", { class: "ro" }, "");

    const ctl = stepper(mount, build, paint, 650);
    function build() {
      const F = []; let prev = -1, cur = 0; // indices into vals (logical), but we render by reversal progress
      F.push({ prev: -1, cur: 0, flipped: 0, msg: "prev = null, cur = head (1)" });
      for (let step = 0; step < vals.length; step++) {
        F.push({ prev: cur, cur: cur + 1, flipped: step + 1, msg: "flip node " + vals[cur] + "'s arrow ← then advance" });
        prev = cur; cur = cur + 1;
      }
      F.push({ prev: vals.length - 1, cur: vals.length, flipped: vals.length, msg: "cur = null → done. New head = " + vals[vals.length - 1], done: true });
      return F;
    }
    function paint(appendLog) {
      const f = ctl.frames[ctl.fi];
      row.innerHTML = "";
      for (let i = 0; i < vals.length; i++) {
        let cls = "ll-node";
        if (f.done) cls += " done";
        else if (i === f.cur) cls += " fast";
        else if (i === f.prev) cls += " slow";
        row.appendChild(h("div", { class: cls }, String(vals[i]),
          i === f.cur && !f.done ? h("span", { class: "ll-tag f" }, "cur") : null,
          i === f.prev && !f.done ? h("span", { class: "ll-tag s" }, "prev") : null));
        if (i < vals.length - 1) {
          const flipped = i < f.flipped;
          row.appendChild(h("div", { class: "ll-arrow" + (flipped ? " flipped" : "") }, h("span", { html: '<svg viewBox="0 0 24 16"><path d="M2 8h18M15 3l5 5-5 5"/></svg>' })));
        }
      }
      readout.innerHTML = "";
      readout.appendChild(h("b", { style: "color:" + (f.done ? "var(--lime)" : "var(--accent)") }, f.msg));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-reverse"), btn("Reset", "ghost", ctl.reset)
    ));
    mount.appendChild(h("div", { class: "w-stage" }, row));
    mount.appendChild(h("div", { class: "w-readout" }, readout));
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--cyan)", "prev"), legendItem("var(--amber)", "cur"), legendItem("var(--lime)", "reversed link")));
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     MONOTONIC STACK — next greater element
  --------------------------------------------------------------- */
  Widgets.monotonicstack = function (mount) {
    shell(mount, "pattern lab", "Monotonic Stack",
      "Scan once, keeping a stack of indices whose values are decreasing. When a bigger value arrives, it is the 'next greater element' for everything it pops — every item is pushed and popped at most once, so O(n).");

    let arr = [2, 1, 4, 3, 5, 2], res = [];
    const cells = h("div", { class: "dsa-cells" });
    const stackBox = h("div", { class: "mstack" });
    const resRow = h("div", { class: "dsa-cells" });
    const log = h("div", { class: "dsa-log" });

    const ctl = stepper(mount, build, paint, 720);
    function build() {
      const F = []; const stack = []; res = new Array(arr.length).fill(-1);
      for (let i = 0; i < arr.length; i++) {
        const popped = [];
        while (stack.length && arr[stack[stack.length - 1]] < arr[i]) {
          const idx = stack.pop(); res[idx] = arr[i]; popped.push(idx);
        }
        stack.push(i);
        F.push({ i, stack: stack.slice(), res: res.slice(), popped: popped.slice() });
      }
      F.push({ i: -1, stack: stack.slice(), res: res.slice(), popped: [], done: true });
      return F;
    }
    function paint(appendLog) {
      const f = ctl.frames[ctl.fi];
      cells.innerHTML = "";
      arr.forEach((v, i) => {
        let cls = "dsa-cell";
        if (i === f.i) cls += " cur";
        else if (f.stack.includes(i)) cls += " lo";
        cells.appendChild(h("div", { class: cls }, h("span", { class: "idx" }, i), String(v)));
      });
      stackBox.innerHTML = "";
      f.stack.forEach((idx) => stackBox.appendChild(h("div", { class: "mstack-cell" }, String(arr[idx]))));
      if (!f.stack.length) stackBox.appendChild(h("div", { class: "mstack-lbl" }, "empty"));
      resRow.innerHTML = "";
      f.res.forEach((v, i) => resRow.appendChild(h("div", { class: "dsa-cell" + (v >= 0 ? " hit" : "") }, h("span", { class: "idx" }, i), v >= 0 ? String(v) : "·")));
      if (appendLog && !f.done) {
        const d = h("div", {});
        if (f.popped.length) { d.className = "ok"; d.textContent = arr[f.i] + " is next-greater for [" + f.popped.map((p) => arr[p]).join(", ") + "]"; }
        else d.textContent = "push " + arr[f.i] + " (nothing smaller to pop)";
        log.insertBefore(d, log.firstChild);
      }
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-scan"),
      btn("Shuffle", "ghost", () => { arr = Array.from({ length: 6 }, () => 1 + Math.floor(Math.random() * 8)); log.innerHTML = ""; ctl.reset(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" },
      h("div", { class: "gt-ds-lbl", style: "font-family:var(--font-mono);font-size:.68rem;color:var(--text-faint)" }, "array (scanning →)"), cells,
      h("div", { class: "mstack-wrap" },
        h("div", {}, h("div", { class: "mstack-lbl" }, "stack (decreasing)"), stackBox),
        h("div", { style: "flex:1" }, h("div", { class: "mstack-lbl", style: "text-align:left" }, "next greater[]"), resRow))
    ));
    mount.appendChild(log);
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     MERGE OVERLAPPING INTERVALS
  --------------------------------------------------------------- */
  Widgets.mergeintervals = function (mount) {
    shell(mount, "pattern lab", "Merge Intervals",
      "Sort intervals by start, then sweep left to right: if the next interval overlaps the current merged one, extend it; otherwise start a new one. O(n log n) for the sort.");

    let intervals = [[1, 3], [2, 6], [8, 10], [9, 12], [15, 18]];
    const MAXX = 20;
    const inputTrack = h("div", { class: "iv-stage" });
    const outTrack = h("div", { class: "iv-stage" });
    const log = h("div", { class: "dsa-log" });

    const ctl = stepper(mount, build, paint, 760);
    function build() {
      const F = []; const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
      const merged = [];
      F.push({ sorted, merged: [], cur: -1, msg: "sort by start time" });
      for (let i = 0; i < sorted.length; i++) {
        const iv = sorted[i];
        if (!merged.length || merged[merged.length - 1][1] < iv[0]) {
          merged.push(iv.slice());
          F.push({ sorted, merged: merged.map((m) => m.slice()), cur: i, msg: "[" + iv[0] + "," + iv[1] + "] doesn't overlap → new interval", action: "new" });
        } else {
          const last = merged[merged.length - 1];
          const before = last[1];
          last[1] = Math.max(last[1], iv[1]);
          F.push({ sorted, merged: merged.map((m) => m.slice()), cur: i, msg: "[" + iv[0] + "," + iv[1] + "] overlaps → extend end " + before + " → " + last[1], action: "merge" });
        }
      }
      F.push({ sorted, merged: merged.map((m) => m.slice()), cur: -1, msg: merged.length + " merged interval(s)", done: true });
      return F;
    }
    function bar(iv, cls) {
      const left = (iv[0] / MAXX) * 100, w = ((iv[1] - iv[0]) / MAXX) * 100;
      return h("div", { class: "iv-bar " + (cls || ""), style: "left:" + left + "%;width:" + w + "%" }, iv[0] + "–" + iv[1]);
    }
    function axis() {
      const a = h("div", { class: "iv-axis" });
      [0, 5, 10, 15, 20].forEach((t) => a.appendChild(h("span", { style: "left:" + (t / MAXX * 100) + "%" }, String(t))));
      return a;
    }
    function paint(appendLog) {
      const f = ctl.frames[ctl.fi];
      inputTrack.innerHTML = "";
      f.sorted.forEach((iv, i) => {
        const tr = h("div", { class: "iv-track" }); tr.appendChild(bar(iv, i === f.cur ? "active" : ""));
        inputTrack.appendChild(tr);
      });
      inputTrack.appendChild(axis());
      outTrack.innerHTML = "";
      f.merged.forEach((iv) => { const tr = h("div", { class: "iv-track" }); tr.appendChild(bar(iv, "merged")); outTrack.appendChild(tr); });
      if (!f.merged.length) outTrack.appendChild(h("div", { class: "mstack-lbl" }, "—"));
      outTrack.appendChild(axis());
      if (appendLog) { const d = h("div", f.action === "merge" ? { class: "hi2" } : f.action === "new" ? { class: "ok" } : {}); d.textContent = f.msg; log.insertBefore(d, log.firstChild); }
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-merge"),
      btn("Randomize", "ghost", () => {
        const n = 5; const out = [];
        for (let i = 0; i < n; i++) { const s = Math.floor(Math.random() * 16); out.push([s, s + 1 + Math.floor(Math.random() * 4)]); }
        intervals = out; log.innerHTML = ""; ctl.reset();
      })
    ));
    mount.appendChild(h("div", { class: "w-stage" },
      h("div", { class: "mstack-lbl", style: "text-align:left" }, "input (sorted by start)"), inputTrack,
      h("div", { class: "mstack-lbl", style: "text-align:left;margin-top:10px" }, "merged output"), outTrack
    ));
    mount.appendChild(log);
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     MODIFIED BINARY SEARCH
  --------------------------------------------------------------- */
  Widgets.binarysearch = function (mount) {
    shell(mount, "pattern lab", "Binary Search",
      "Halve the search space every step. Track the invariant [lo, hi] and move a bound strictly past mid so the window always shrinks — ~log₂(n) probes for n elements.");

    let arr = [1, 3, 4, 7, 9, 11, 15, 18, 21, 24], target = 15;
    const cells = h("div", { class: "dsa-cells" });
    const readout = h("span", { class: "ro" }, "");
    const log = h("div", { class: "dsa-log" });

    const ctl = stepper(mount, build, paint, 800);
    function build() {
      const F = []; let lo = 0, hi = arr.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const cmp = arr[mid] === target ? "eq" : (arr[mid] < target ? "lt" : "gt");
        F.push({ lo, hi, mid, cmp });
        if (cmp === "eq") { F[F.length - 1].found = true; break; }
        if (cmp === "lt") lo = mid + 1; else hi = mid - 1;
      }
      if (!F.length || !F[F.length - 1].found) F.push({ lo, hi, mid: -1, cmp: "none", notfound: true });
      return F;
    }
    function paint(appendLog) {
      const f = ctl.frames[ctl.fi];
      cells.innerHTML = "";
      arr.forEach((v, i) => {
        let cls = "dsa-cell";
        if (f.found && i === f.mid) cls += " hit";
        else if (i === f.mid) cls += " mid";
        else if (i === f.lo) cls += " lo";
        else if (i === f.hi) cls += " hi";
        if (!f.found && (i < f.lo || i > f.hi)) cls += " gone";
        cells.appendChild(h("div", { class: cls }, h("span", { class: "idx" }, i), String(v),
          i === f.mid ? h("span", { class: "ptr" }, "M") : (i === f.lo ? h("span", { class: "ptr" }, "L") : (i === f.hi ? h("span", { class: "ptr" }, "R") : null))));
      });
      readout.innerHTML = "";
      if (f.notfound) readout.appendChild(h("b", { style: "color:var(--rose)" }, target + " not found"));
      else if (f.found) readout.appendChild(h("b", { style: "color:var(--lime)" }, "found " + target + " at index " + f.mid + " ✓"));
      else {
        readout.appendChild(document.createTextNode("mid = arr[" + f.mid + "] = " + arr[f.mid] + " "));
        readout.appendChild(h("b", {}, f.cmp === "lt" ? "< " + target + " → search right" : "> " + target + " → search left"));
      }
      if (appendLog) { const d = h("div", f.found ? { class: "ok" } : f.notfound ? { class: "no" } : {}); d.textContent = f.notfound ? (target + " not found") : "lo=" + f.lo + " hi=" + f.hi + " mid=" + f.mid + " (" + arr[f.mid] + ")"; log.insertBefore(d, log.firstChild); }
    }

    const tInput = h("input", { type: "number", value: String(target), style: "width:72px" });
    tInput.addEventListener("change", () => { target = +tInput.value || 0; log.innerHTML = ""; ctl.reset(); });
    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "target ", tInput),
      seg(["15", "1", "24", "10"], (v) => { target = +v; tInput.value = v; log.innerHTML = ""; ctl.reset(); }),
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-search"), btn("Reset", "ghost", () => { log.innerHTML = ""; ctl.reset(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, cells));
    mount.appendChild(h("div", { class: "w-readout" }, readout));
    mount.appendChild(log);
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--cyan)", "lo"), legendItem("var(--violet)", "mid"), legendItem("var(--amber)", "hi"), legendItem("var(--lime)", "found")));
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     BINARY TREE TRAVERSAL — in / pre / post / level order
  --------------------------------------------------------------- */
  Widgets.treetraversal = function (mount) {
    shell(mount, "pattern lab", "Tree Traversal",
      "The same tree, four orders. Pre/In/Post are DFS variants that differ only in WHEN you visit the node vs. its children; level-order is BFS with a queue.");

    // fixed tree of 7 nodes: indices 0..6 with values
    const val = [5, 3, 8, 1, 4, 7, 9];
    const pos = [[260, 30], [150, 95], [370, 95], [90, 160], [210, 160], [310, 160], [430, 160]];
    const left = [1, 3, 5, -1, -1, -1, -1], right = [2, 4, 6, -1, -1, -1, -1];
    let order = "Inorder";

    const svg = svgEl("svg", { class: "tree-svg", viewBox: "0 0 520 195" });
    const seqRow = h("div", { class: "dsa-cells" });

    const ctl = stepper(mount, build, paint, 650);
    function build() {
      const seq = [];
      function pre(i) { if (i < 0) return; seq.push(i); pre(left[i]); pre(right[i]); }
      function ino(i) { if (i < 0) return; ino(left[i]); seq.push(i); ino(right[i]); }
      function post(i) { if (i < 0) return; post(left[i]); post(right[i]); seq.push(i); }
      function level() { const q = [0]; while (q.length) { const x = q.shift(); seq.push(x); if (left[x] >= 0) q.push(left[x]); if (right[x] >= 0) q.push(right[x]); } }
      ({ Preorder: pre, Inorder: ino, Postorder: post, "Level-order": () => level() }[order])(0);
      // frames reveal the sequence one node at a time
      return seq.map((node, k) => ({ node, visited: seq.slice(0, k + 1) }));
    }
    function paint() {
      const f = ctl.frames[ctl.fi];
      const visSet = new Set(f.visited);
      svg.innerHTML = "";
      for (let i = 0; i < val.length; i++) {
        [left[i], right[i]].forEach((c) => { if (c >= 0) svg.appendChild(svgEl("line", { class: "tr-edge" + (visSet.has(i) && visSet.has(c) ? " on" : ""), x1: pos[i][0], y1: pos[i][1], x2: pos[c][0], y2: pos[c][1] })); });
      }
      for (let i = 0; i < val.length; i++) {
        const g = svgEl("g", { class: "tr-node" + (i === f.node ? " cmp" : visSet.has(i) ? " on" : "") });
        g.appendChild(svgEl("circle", { cx: pos[i][0], cy: pos[i][1], r: 17 }));
        const t = svgEl("text", { x: pos[i][0], y: pos[i][1] }); t.textContent = val[i]; g.appendChild(t);
        svg.appendChild(g);
      }
      seqRow.innerHTML = "";
      f.visited.forEach((idx, k) => seqRow.appendChild(h("div", { class: "dsa-cell" + (k === f.visited.length - 1 ? " cur" : " hit") }, String(val[idx]))));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg(["Inorder", "Preorder", "Postorder", "Level-order"], (v) => { order = v; ctl.reset(); }),
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-walk"), btn("Reset", "ghost", ctl.reset)
    ));
    mount.appendChild(h("div", { class: "w-stage" }, svg,
      h("div", { class: "mstack-lbl", style: "text-align:left;margin-top:6px" }, "visit order"), seqRow));
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--amber)", "visiting"), legendItem("var(--accent)", "done")));
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     MATRIX TRAVERSAL — number of islands (flood fill)
  --------------------------------------------------------------- */
  Widgets.matrixtraversal = function (mount) {
    shell(mount, "pattern lab", "Matrix Traversal · Islands",
      "Scan the grid; each time you hit unseen land, flood-fill its whole island with DFS and count +1. Every cell is visited once → O(rows × cols).");

    const R = 5, C = 7;
    let grid = seedGrid();
    function seedGrid() {
      // deterministic-ish island pattern
      const g = [
        [1, 1, 0, 0, 1, 0, 1],
        [1, 0, 0, 1, 1, 0, 0],
        [0, 0, 1, 0, 0, 0, 1],
        [0, 1, 1, 0, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1]
      ];
      return g.map((r) => r.slice());
    }
    const board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(" + C + ",38px)" });
    const readout = h("span", { class: "ro" }, "");
    const log = h("div", { class: "dsa-log" });

    const ctl = stepper(mount, build, paint, 110);
    function build() {
      const F = []; const g = grid.map((r) => r.slice()); const state = grid.map((r) => r.map((c) => c ? "land" : "water"));
      let count = 0;
      const snap = (msg, count) => F.push({ state: state.map((r) => r.slice()), count, msg });
      snap("scanning…", 0);
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (g[r][c] === 1) {
          count++;
          // DFS flood fill
          const stack = [[r, c]];
          snap("found island #" + count + " at (" + r + "," + c + ")", count);
          while (stack.length) {
            const [cr, cc] = stack.pop();
            if (cr < 0 || cc < 0 || cr >= R || cc >= C || g[cr][cc] !== 1) continue;
            g[cr][cc] = 0; state[cr][cc] = "visiting"; snap("flood-fill island #" + count, count);
            state[cr][cc] = "sunk";
            stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
          }
        }
      }
      snap(count + " islands total", count);
      F[F.length - 1].done = true;
      return F;
    }
    function paint(appendLog) {
      const f = ctl.frames[ctl.fi];
      board.style.gridTemplateColumns = "repeat(" + C + ",38px)";
      board.innerHTML = "";
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const s = f.state[r][c];
        board.appendChild(h("div", { class: "grid-cell " + s }, s === "land" ? "1" : s === "water" ? "" : s === "visiting" ? "▣" : "✓"));
      }
      readout.innerHTML = "";
      readout.appendChild(document.createTextNode("islands found = "));
      readout.appendChild(h("b", { style: "color:var(--lime)" }, String(f.count)));
      readout.appendChild(document.createTextNode("   " + f.msg));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-explore"),
      btn("New grid", "ghost", () => { grid = Array.from({ length: R }, () => Array.from({ length: C }, () => Math.random() < 0.45 ? 1 : 0)); ctl.reset(); }),
      btn("Reset", "ghost", () => { grid = seedGrid(); ctl.reset(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, board));
    mount.appendChild(h("div", { class: "w-readout" }, readout));
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--amber)", "land (1)"), legendItem("var(--rose)", "visiting"), legendItem("var(--violet)", "sunk"), legendItem("transparent", "water (0)")));
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     DYNAMIC PROGRAMMING — unique paths grid
  --------------------------------------------------------------- */
  Widgets.dptable = function (mount) {
    shell(mount, "pattern lab", "DP Table · Unique Paths",
      "How many ways to reach each cell moving only right or down? Each cell = paths-from-above + paths-from-left. Filling the table bottom-up reuses sub-answers instead of recomputing them.");

    const R = 4, C = 5;
    const board = h("div", { class: "grid-board", style: "grid-template-columns:repeat(" + C + ",44px)" });
    const readout = h("span", { class: "ro" }, "");

    const ctl = stepper(mount, build, paint, 300);
    function build() {
      const F = []; const dp = Array.from({ length: R }, () => new Array(C).fill(0));
      const snap = (r, c, deps, msg) => F.push({ dp: dp.map((row) => row.slice()), cur: [r, c], deps: deps || [], msg });
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (r === 0 || c === 0) { dp[r][c] = 1; snap(r, c, [], "edge cell → 1 way"); }
        else {
          dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
          snap(r, c, [[r - 1, c], [r, c - 1]], dp[r - 1][c] + " (up) + " + dp[r][c - 1] + " (left) = " + dp[r][c]);
        }
      }
      F.push({ dp: dp.map((row) => row.slice()), cur: [-1, -1], deps: [], msg: "answer = dp[" + (R - 1) + "][" + (C - 1) + "] = " + dp[R - 1][C - 1], done: true });
      return F;
    }
    function paint() {
      const f = ctl.frames[ctl.fi];
      board.style.gridTemplateColumns = "repeat(" + C + ",44px)";
      board.innerHTML = "";
      const depSet = new Set(f.deps.map((d) => d[0] + "," + d[1]));
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        let cls = "grid-cell";
        const isCur = f.cur[0] === r && f.cur[1] === c;
        const filled = f.dp[r][c] > 0;
        if (isCur) cls += " dp-cur";
        else if (depSet.has(r + "," + c)) cls += " dp-dep";
        else if (filled) cls += " dp-fill";
        board.appendChild(h("div", { class: cls }, f.dp[r][c] > 0 ? String(f.dp[r][c]) : ""));
      }
      readout.innerHTML = "";
      readout.appendChild(h("b", { style: "color:" + (f.done ? "var(--lime)" : "var(--accent)") }, f.msg));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      btn("Step", "ghost", ctl.step), ctl.auto("Auto-fill"), btn("Reset", "ghost", ctl.reset)
    ));
    mount.appendChild(h("div", { class: "w-stage" }, board));
    mount.appendChild(h("div", { class: "w-readout" }, readout));
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--accent)", "current cell"), legendItem("var(--cyan)", "dependencies (up + left)")));
    ctl.reset();
  };

  /* ---------------------------------------------------------------
     BITWISE PLAYGROUND
  --------------------------------------------------------------- */
  Widgets.bitwise = function (mount) {
    shell(mount, "pattern lab", "Bit Manipulation",
      "Numbers are bits. Toggle the bits of A and B and watch AND, OR, XOR and shifts update live. XOR is the interview workhorse — it cancels duplicates (x ^ x = 0).");

    const BITS = 8;
    let a = 0b00101101, b = 0b00011010, op = "XOR";

    const lines = h("div", { class: "bit-rows" });

    function row(label, val, editable, cls) {
      const wrap = h("div", { class: "bit-line" });
      wrap.appendChild(h("span", { class: "bit-label" }, label));
      const cellBox = h("div", { class: "bit-cells" });
      for (let i = BITS - 1; i >= 0; i--) {
        const on = (val >> i) & 1;
        const cell = h("div", { class: "bit-cell " + (cls || "") + (on ? " on" : "") + (editable ? " clickable" : "") }, String(on));
        if (editable) cell.addEventListener("click", () => { if (label === "A") a ^= (1 << i); else b ^= (1 << i); render(); });
        cellBox.appendChild(cell);
      }
      wrap.appendChild(cellBox);
      wrap.appendChild(h("span", { class: "bit-val" }, "= " + val));
      return wrap;
    }
    function compute() {
      if (op === "AND") return a & b;
      if (op === "OR") return a | b;
      if (op === "XOR") return a ^ b;
      if (op === "A << 1") return (a << 1) & 0xff;
      if (op === "A >> 1") return a >> 1;
      return a ^ b;
    }
    function render() {
      lines.innerHTML = "";
      lines.appendChild(row("A", a, true));
      if (op === "AND" || op === "OR" || op === "XOR") lines.appendChild(row("B", b, true));
      lines.appendChild(row(op, compute(), false, "res"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg(["XOR", "AND", "OR", "A << 1", "A >> 1"], (v) => { op = v; render(); })
    ));
    mount.appendChild(h("div", { class: "w-stage" }, lines));
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--accent)", "bit = 1 (click A/B to toggle)"), legendItem("var(--cyan)", "result")));
    mount.appendChild(h("div", { class: "w-readout" }, h("span", { class: "ro" }, "Tip: a ^ b ^ b == a — XOR twice cancels out. That's how you find the single non-duplicated number in O(n), O(1).")));
    render();
  };

  window.Widgets = Widgets;
})();
