#!/usr/bin/env node
/*
 * Atlas end-to-end route crawler (no dependencies; drives the system Chrome
 * over the DevTools protocol with fetch + WebSocket).
 *
 * Replaces the 8-view boot smoke with an exhaustive crawl. Nothing is
 * hardcoded: it navigates to each app once, reads window.TRACKS (or the legacy
 * window.*_DATA.tracks shape) out of the live page, and derives every lesson
 * route from that — so content added after this file was written is covered
 * automatically. Feature routes come from each app's own router source.
 *
 * Per route it asserts:
 *   - #main rendered real content
 *   - zero uncaught exceptions, zero console.error, zero console.warn
 *     (this repo forbids console output entirely)
 *   - zero failed network requests
 *   - every .widget-mount is non-empty      (an empty mount is a silent hole)
 *   - every .quiz-mount renders a question
 *   - no runtime-synthesized junk leaked into output ([object Object], NaN,
 *     undefined, ...), ignoring syntax-highlighted code samples
 *   - the route did not silently fall through to the home view
 *
 * Then it exercises behaviour, not just render: every distinct quiz id is
 * played to its result card, and at least one control on every distinct widget
 * id is driven and asserted to change the widget's state. Exam mode is started
 * and answered; a flashcard is flipped.
 *
 * Prereqs:
 *   python3 -m http.server 8780 --directory .
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --disable-gpu --no-first-run --no-default-browser-check \
 *     --remote-debugging-port=9240 --user-data-dir=/tmp/atlas-chrome-smoke about:blank
 *
 * Usage:
 *   node tools/crawl_e2e.mjs                 # all apps, all routes
 *   node tools/crawl_e2e.mjs --app=cyber-academy
 *   node tools/crawl_e2e.mjs --sample=8      # 8 lessons per app, quick pass
 *   node tools/crawl_e2e.mjs --no-interact   # render checks only
 *
 * Env: E2E_BASE (default http://127.0.0.1:8780), E2E_CDP (default http://127.0.0.1:9240)
 */
import { writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, discoverApps, read, routerVocab, mountedTrackIds } from "./lib/atlas-shared.mjs";
import { Session, sleep, boot, reload, resetOrigin, HARNESS_FAULT, reportFault, startDeadline } from "./lib/cdp.mjs";

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return dflt;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : true;
};
const BASE = String(flag("base", process.env.E2E_BASE || "http://127.0.0.1:8780")).replace(/\/$/, "");
const CDP = String(flag("cdp", process.env.E2E_CDP || "http://127.0.0.1:9240")).replace(/\/$/, "");
const ONLY = flag("app");
const SAMPLE = Number(flag("sample", 0)) || 0;
const INTERACT = !flag("no-interact", false);
const QUIET = !!flag("quiet", false);
const OUT = String(flag("out", join(ROOT, "tools", "e2e-report.json")));

/* ==================================================== in-page test harness */

/*
 * Installed into every page after load. Kept as one string so it can be
 * re-injected after a reload without a second source of truth.
 *
 * Placeholder-leak tokens are split into two tiers, calibrated against this
 * repo's actual content:
 *   hard  — zero legitimate occurrences anywhere ([object Object], NaN, ...)
 *   soft  — appear in real authored prose or widget output (TODO, placeholder)
 * Syntax-highlighted code samples are excluded from both, because the
 * highlighter emits `undefined`/`null` as keyword tokens by design.
 */
const HARNESS = String.raw`
window.__e2e = (function () {
  "use strict";
  var HARD = [
    { name: "[object Object]", re: /\[object (?:Object|Array|HTMLDivElement)\]/g },
    { name: "NaN",             re: /\bNaN\b/g },
    { name: "undefined",       re: /\bundefined\b/g },
    { name: "Infinity",        re: /(^|[^-\w])Infinity\b/g },
    { name: "Lorem ipsum",     re: /Lorem ipsum/gi },
    { name: "FIXME",           re: /\bFIXME\b/g },
    { name: "TBD",             re: /\bTBD\b/g },
    { name: "unrendered template", re: /\{\{|\$\{/g },
    { name: "format specifier",    re: /%[sd]\b/g }
  ];
  var SOFT = [
    { name: "TODO",        re: /\bTODO\b/g },
    { name: "placeholder", re: /\bplaceholder\b/gi }
  ];

  function main() { return document.getElementById("main") || document.querySelector("main") || document.body; }

  /* text with syntax-highlighted code samples stripped out */
  function proseText(root) {
    var clone = root.cloneNode(true);
    var drop = clone.querySelectorAll("code, pre, kbd, samp, .tok, .code-card, .code-copy, script, style");
    for (var i = 0; i < drop.length; i++) drop[i].remove();
    return clone.textContent || "";
  }

  /* Set of normalized "what follows the token" snippets taken from the authored
   * source. The renderer escapes prose but never rewrites it, so a hit whose
   * trailing text appears in the source is authored prose ("undefined
   * behaviour", "a placeholder with the same interface"), while a hit with no
   * source match was synthesized at runtime — which is the actual defect. */
  var AFTER = Object.create(null), BEFORE = Object.create(null);
  function setAuthored(a, b) {
    AFTER = Object.create(null); BEFORE = Object.create(null);
    for (var i = 0; i < a.length; i++) AFTER[a[i]] = true;
    for (var j = 0; j < b.length; j++) BEFORE[b[j]] = true;
  }
  function norm(s) { return s.replace(/\s+/g, " ").toLowerCase(); }

  /* A block boundary can put unrelated text right after an authored token, so
   * either side matching the source is enough to call it prose. Windows shorter
   * than 12 chars are too weak to suppress on. */
  function authored(text, start, end) {
    var a = norm(text.slice(end, end + 24));
    if (a.length >= 12 && AFTER[a]) return true;
    var b = norm(text.slice(Math.max(0, start - 24), start));
    return b.length >= 12 && !!BEFORE[b];
  }

  function scan(text, defs) {
    var out = [];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i]; d.re.lastIndex = 0;
      var m;
      while ((m = d.re.exec(text))) {
        if (authored(text, m.index, m.index + m[0].length)) continue;
        out.push({ token: d.name, context: text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, " ").trim() });
        if (out.length > 12) return out;
      }
    }
    return out;
  }

  function fingerprint(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h) + ":" + s.length;
  }

  /* two frames, or a timer if the frames never come — headless Chrome stops
   * producing frames when nothing repaints, and a bare rAF chain can then be
   * starved indefinitely, hanging the crawl instead of reporting anything */
  function settle(done) {
    var fired = false;
    function go() { if (fired) return; fired = true; done(); }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(go, 0); });
    });
    setTimeout(go, 150);
  }

  function nav(hash) {
    return new Promise(function (resolve) {
      var fired = false;
      function finish() { if (fired) return; fired = true; window.removeEventListener("hashchange", onHash); settle(function () { resolve(true); }); }
      function onHash() { finish(); }
      if (location.hash === hash) { finish(); return; }
      window.addEventListener("hashchange", onHash);
      location.hash = hash;
      /* a router that calls location.replace() can swallow the event; also
       * covers an identical-hash assignment that fires nothing */
      setTimeout(finish, 400);
    });
  }

  function audit() {
    var m = main();
    var text = (m.textContent || "").trim();
    var prose = proseText(m);

    var widgets = [];
    var wm = m.querySelectorAll(".widget-mount");
    for (var i = 0; i < wm.length; i++) {
      var w = wm[i];
      widgets.push({
        id: w.getAttribute("data-widget") || ("#" + i),
        childCount: w.children.length,
        textLen: (w.textContent || "").trim().length,
        controls: w.querySelectorAll(".w-btn, .w-seg-btn, input, select, textarea, button").length,
        errorCard: !!w.querySelector(".note.warn")
      });
    }

    var quizzes = [];
    var qm = m.querySelectorAll(".quiz-mount");
    for (var j = 0; j < qm.length; j++) {
      var q = qm[j];
      var qq = q.querySelector(".q-question");
      var opts = q.querySelectorAll(".q-opt");
      quizzes.push({
        id: q.getAttribute("data-quiz") || ("#" + j),
        childCount: q.children.length,
        questionLen: qq ? (qq.textContent || "").trim().length : 0,
        optionCount: opts.length,
        textLen: (q.textContent || "").trim().length
      });
    }

    return {
      hash: location.hash,
      title: document.title,
      textLen: text.length,
      sample: text.slice(0, 120).replace(/\s+/g, " "),
      fingerprint: fingerprint(text),
      widgets: widgets,
      quizzes: quizzes,
      hard: scan(prose, HARD),
      soft: scan(prose, SOFT),
      emptyState: !!m.querySelector(".empty-state")
    };
  }

  function navAudit(hash) { return nav(hash).then(audit); }

  /* ---- interactivity ---- */

  /* Interactive state lives in three places across these apps: rendered text,
   * toggled state classes, and ARIA state. A signature over all three catches
   * a CSS-only flip (both faces stay in the DOM) as well as a full re-render. */
  var STATE_SEL = ".active, .selected, .is-flipped, .flipped, .correct, .wrong, .show, .open, " +
    "[aria-pressed='true'], [aria-selected='true'], [aria-expanded='true'], [aria-checked='true']";

  function sig(el) {
    /* Identity, not just count: switching which segment is active keeps the
     * count at one, so a count-only signature would call a working segmented
     * control inert. */
    var st = [].slice.call(el.querySelectorAll(STATE_SEL)).map(function (n) {
      return n.tagName + ":" + classOf(n) + ":" + (n.textContent || "").replace(/\s+/g, " ").slice(0, 20);
    }).join(",");
    return (el.textContent || "").replace(/\s+/g, " ") + "|" + st + "|" +
      el.querySelectorAll("*").length + "|" +
      classOf(el) + "|" +
      (el.value != null ? el.value : "");
  }

  /** play one quiz mount from Q1 to its result card */
  function playQuiz(index) {
    var mounts = main().querySelectorAll(".quiz-mount");
    var slot = mounts[index || 0];
    if (!slot) return { ok: false, why: "no quiz mount at index " + index };
    var id = slot.getAttribute("data-quiz");
    var answered = 0, guard = 0;
    while (guard++ < 40) {
      if (slot.querySelector(".quiz-result")) break;
      var opts = slot.querySelectorAll(".q-opt");
      if (opts.length) {
        var before = sig(slot);
        activate(opts[0]);
        if (sig(slot) === before) return { ok: false, id: id, why: "clicking an option changed nothing at Q" + (answered + 1) };
        answered++;
      }
      var next = slot.querySelector(".quiz-next");
      if (!next) return { ok: false, id: id, why: "no next/result button after Q" + answered };
      if (next.disabled) return { ok: false, id: id, why: "next button stayed disabled after answering Q" + answered };
      activate(next);
    }
    var result = slot.querySelector(".quiz-result");
    if (!result) return { ok: false, id: id, why: "never reached the result card after " + answered + " question(s)" };
    var score = slot.querySelector(".quiz-result .score");
    return { ok: true, id: id, answered: answered, score: score ? (score.textContent || "").trim() : "" };
  }

  /* SVG elements expose className as an SVGAnimatedString, so read the
   * attribute rather than the property */
  function classOf(c) { return String(c.getAttribute && c.getAttribute("class") || "").trim(); }

  function label(c) {
    var cls = classOf(c);
    return (c.tagName.toLowerCase() + (cls ? "." + cls.split(/\s+/).join(".") : "") +
      (c.type ? "[" + c.type + "]" : "")).slice(0, 70);
  }

  /* HTMLElement.click() does not exist on SVGElement, and a real page.click
   * would be hit-tested against any fixed overlay, so dispatch the event. */
  function activate(c) {
    if (typeof c.click === "function") c.click();
    else c.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  /**
   * Drive a widget's controls and prove its state moved.
   *
   * Controls split into two kinds, because "clicking something changed nothing"
   * is only a defect for one of them:
   *   mutators — a non-active segment, a slider, a multi-option select, a
   *              checkbox, an unselected SVG node. Activating one of these MUST
   *              change state; if it does not, the widget is broken.
   *   actions  — a plain submit-style button. Several widgets compute on mount
   *              and their button just recomputes the same answer, so an
   *              unchanged result is idempotent, not broken. Those are driven
   *              after perturbing any text input, and only warn if still inert.
   */
  function pokeWidget(index) {
    var mount = main().querySelectorAll(".widget-mount")[index || 0];
    if (!mount) return { ok: false, why: "no widget mount at index " + index };
    var id = mount.getAttribute("data-widget");
    if (!(mount.textContent || "").trim().length) return { ok: false, id: id, why: "mount is empty" };

    function q(sel) { return [].slice.call(mount.querySelectorAll(sel)); }

    var mutators = []
      .concat(q(".w-seg-btn:not(.active)"))
      .concat(q("input[type=range], input[type=number]"))
      .concat(q("select"))
      .concat(q("input[type=checkbox], input[type=radio]"))
      /* several widgets are SVG diagrams whose click targets are <g> nodes with
       * an inline pointer cursor rather than <button> elements */
      .concat(q('[style*="cursor:pointer"], [style*="cursor: pointer"], [role="button"]'))
      .filter(function (c) { return !c.disabled; });
    /* Segmented chips inside .w-seg that skip the documented .w-seg-btn class.
     * Usually a real control, occasionally a decorative label row, so an inert
     * one is a warning rather than a failure. */
    var softMutators = q(".w-seg button:not(.active):not([disabled])")
      .filter(function (c) { return mutators.indexOf(c) < 0; });
    var actions = q("button:not([disabled]), .w-btn:not([disabled])")
      .filter(function (c) { return mutators.indexOf(c) < 0 && softMutators.indexOf(c) < 0; });
    var texts = q('input[type=text], input:not([type]), textarea');

    if (!mutators.length && !softMutators.length && !actions.length) {
      return { ok: true, id: id, control: "none", changed: false, static: true };
    }

    var tried = [];

    function drive(c) {
      try {
        if (c.tagName === "INPUT" && (c.type === "range" || c.type === "number")) {
          var min = parseFloat(c.min || "0"), max = parseFloat(c.max || "100"), cur = parseFloat(c.value || "0");
          var step = parseFloat(c.step || "1") || 1;
          var next = cur + step * 3 <= max ? cur + step * 3 : Math.max(min, cur - step * 3);
          if (next === cur) next = cur === max ? min : max;
          c.value = String(next);
          c.dispatchEvent(new Event("input", { bubbles: true }));
          c.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (c.tagName === "SELECT") {
          var pick = -1;
          for (var oi = 0; oi < c.options.length; oi++) if (oi !== c.selectedIndex) { pick = oi; break; }
          if (pick < 0) return "single option";
          c.selectedIndex = pick;
          c.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (c.tagName === "INPUT" && (c.type === "checkbox" || c.type === "radio")) {
          c.checked = !c.checked;
          c.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          activate(c);
        }
        return null;
      } catch (e) {
        return "THREW " + ((e && (e.name + ": " + e.message)) || "unknown");
      }
    }

    var ordered = mutators.concat(softMutators);
    for (var i = 0; i < ordered.length && i < 10; i++) {
      var c = ordered[i], before = sig(mount), lb = label(c);
      var err = drive(c);
      if (err && err.indexOf("THREW") === 0) return { ok: false, id: id, control: lb, why: lb + " " + err };
      if (sig(mount) !== before) return { ok: true, id: id, control: lb, changed: true, kind: "mutator" };
      tried.push(lb + (err ? " (" + err + ")" : ""));
    }

    /* Text-driven widgets: the button only recomputes, so change the input
     * first. An empty value is the best single discriminator (most widgets
     * render a distinct empty/invalid state), but several strip their input to
     * one alphabet and no-op on anything else, so the ladder spans letters,
     * a network address and a digit. */
    var LADDER = ["", "cat", "10.0.0.0/8", "7"];
    for (var a = 0; a < actions.length && a < 4; a++) {
      var btn = actions[a], lbl = label(btn);
      for (var v = 0; v < (texts.length ? LADDER.length : 1); v++) {
        var pre = sig(mount);
        if (texts.length) {
          for (var t = 0; t < texts.length; t++) {
            texts[t].value = LADDER[v];
            texts[t].dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        var e2 = drive(btn);
        if (e2 && e2.indexOf("THREW") === 0) return { ok: false, id: id, control: lbl, why: lbl + " " + e2 };
        if (sig(mount) !== pre) {
          return { ok: true, id: id, control: lbl, changed: true, kind: texts.length ? "action+input" : "action" };
        }
      }
      tried.push(lbl);
    }

    if (mutators.length) {
      return { ok: false, id: id, why: "state-changing control(s) did nothing: " + tried.join(", ") };
    }
    /* only idempotent buttons or decorative chips: not a defect, but surfaced */
    return { ok: true, id: id, changed: false, idempotent: true, control: tried.join(", ") };
  }

  /** start an exam and answer one question */
  function runExam() {
    var m = main();
    var start = m.querySelector(".exam-start") || findButton(m, /^(start|begin|take)\b/i);
    if (!start) {
      if (m.querySelector(".empty-state")) return { ok: false, why: "exam view shows an empty state: " + (m.textContent || "").slice(0, 120).replace(/\s+/g, " ") };
      return { ok: false, why: "no start control on the exam view" };
    }
    var before = sig(m);
    activate(start);
    if (sig(m) === before) return { ok: false, why: "clicking start changed nothing" };
    var q = m.querySelector(".exam-q, .q-question, .quiz-q, [class*='question']");
    var opts = m.querySelectorAll(".exam-opt, .q-opt, .quiz-opt");
    if (!opts.length) return { ok: false, why: "exam started but rendered no answer options" };
    var b2 = sig(m);
    activate(opts[0]);
    if (sig(m) === b2) return { ok: false, why: "answering the first question changed nothing" };
    return { ok: true, questionLen: q ? (q.textContent || "").trim().length : 0, options: opts.length };
  }

  /* The visible card face, re-queried each time: some apps re-render the whole
   * view on flip, which detaches any element reference held across the click. */
  function faceText() {
    var m = main();
    var f = m.querySelector(".fc-face, .fc-front, .fc-back, .flash-front, .flash-back, .fc-card, .flash-card");
    return ((f ? f.textContent : m.textContent) || "").replace(/\s+/g, " ").trim();
  }

  /** flip one flashcard */
  function flipCard() {
    var m = main();
    var flip = m.querySelector(".fc-flip") || document.getElementById("flip") || findButton(m, /^flip\b/i);
    if (!flip) {
      if (m.querySelector(".empty-state")) return { ok: false, why: "flashcards view shows an empty state" };
      return { ok: false, why: "no flip control on the flashcards view" };
    }
    var faceBefore = faceText();
    if (!faceBefore) return { ok: false, why: "no card face rendered before flipping" };
    var before = sig(m);
    activate(flip);
    if (sig(main()) === before) {
      return { ok: false, why: 'flipping changed nothing (face stayed "' + faceBefore.slice(0, 60) + '")' };
    }
    return { ok: true, face: faceBefore.slice(0, 50) };
  }

  function findButton(root, re) {
    var bs = root.querySelectorAll("button, .btn, a.btn");
    for (var i = 0; i < bs.length; i++) if (re.test((bs[i].textContent || "").trim())) return bs[i];
    return null;
  }

  /* ---- route discovery, read off the live page ---- */
  function tracks() {
    var out = [];
    if (window.TRACKS && typeof window.TRACKS === "object" && !Array.isArray(window.TRACKS)) {
      Object.keys(window.TRACKS).forEach(function (k) { if (window.TRACKS[k]) out.push(window.TRACKS[k]); });
    }
    if (out.length) return out;
    /* legacy shape: some other global holding { tracks: [...] } */
    var names = Object.keys(window);
    for (var i = 0; i < names.length; i++) {
      var v;
      try { v = window[names[i]]; } catch (e) { continue; }
      if (v && typeof v === "object" && Array.isArray(v.tracks) && v.tracks.length) return v.tracks;
    }
    return out;
  }

  function discover() {
    var ts = tracks();
    var lessons = [], trackIds = [], counts = [];
    ts.forEach(function (t) {
      if (!t || !t.id) return;
      trackIds.push(t.id);
      var n = 0;
      (t.modules || []).forEach(function (mod) {
        (mod.lessons || []).forEach(function (ls) {
          if (!ls || !ls.id) return;
          lessons.push("#/" + t.id + "/" + mod.id + "/" + ls.id);
          n++;
        });
      });
      counts.push({ id: t.id, name: t.name, lessons: n, modules: (t.modules || []).length });
    });
    return {
      trackIds: trackIds,
      tracks: counts,
      lessons: lessons,
      quizIds: window.QUIZZES ? Object.keys(window.QUIZZES) : [],
      widgetIds: window.Widgets ? Object.keys(window.Widgets) : [],
      hasExam: !!(window.AcademyExam && window.AcademyExam.mountExam),
      hasFlash: !!(window.AcademyExam && window.AcademyExam.mountFlashcards)
    };
  }

  /**
   * Negative test for the audit itself: plant the three defects this crawler
   * exists to catch and confirm the audit sees all of them. A checker that has
   * quietly stopped detecting looks exactly like a clean repo.
   */
  function selfcheck() {
    var m = main();
    var probe = document.createElement("div");
    probe.innerHTML =
      '<div class="widget-mount" data-widget="__e2e_probe__"></div>' +
      '<div class="quiz-mount" data-quiz="__e2e_probe__"></div>' +
      "<p>a synthesized value [object Object] and a NaN slipped through</p>";
    m.appendChild(probe);
    var a = audit();
    probe.remove();

    var w = a.widgets.filter(function (x) { return x.id === "__e2e_probe__"; })[0];
    var q = a.quizzes.filter(function (x) { return x.id === "__e2e_probe__"; })[0];
    var tokens = a.hard.map(function (h) { return h.token; });
    return {
      sawEmptyWidgetMount: !!w && w.textLen === 0,
      sawEmptyQuizMount: !!q && q.textLen === 0,
      sawObjectObject: tokens.indexOf("[object Object]") >= 0,
      sawNaN: tokens.indexOf("NaN") >= 0,
      cleanAfterRemoval: audit().hard.length === 0,
    };
  }

  return {
    nav: nav, audit: audit, navAudit: navAudit, discover: discover,
    setAuthored: setAuthored, selfcheck: selfcheck,
    playQuiz: playQuiz, pokeWidget: pokeWidget, runExam: runExam, flipCard: flipCard,
    ready: function () {
      var m = main();
      return document.readyState !== "loading" && !!m && (m.textContent || "").trim().length > 20;
    }
  };
})();
true;
`;

/* ================================================================== report */

/*
 * Tokens like `undefined` and `placeholder` occur in real authored prose
 * ("undefined behaviour in some languages"). Collect the text that follows
 * every such occurrence in an app's own source files; the in-page scanner uses
 * it to tell authored prose from a value synthesized at runtime.
 */
const LEAK_TOKENS = /\[object |\bNaN\b|\bundefined\b|\bInfinity\b|Lorem ipsum|\bFIXME\b|\bTBD\b|\{\{|\$\{|%[sd]\b|\bTODO\b|placeholder/gi;

function authoredContexts(app) {
  const jsDir = join(app.path, "js");
  const after = new Set(), before = new Set();
  if (!existsSync(jsDir)) return [[], []];
  for (const f of readdirSync(jsDir)) {
    if (!f.endsWith(".js")) continue;
    /* decode the escapes the renderer resolves before the text reaches the DOM */
    const src = readFileSync(join(jsDir, f), "utf8")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
    LEAK_TOKENS.lastIndex = 0;
    let m;
    while ((m = LEAK_TOKENS.exec(src))) {
      const end = m.index + m[0].length;
      after.add(src.slice(end, end + 24).replace(/\s+/g, " ").toLowerCase());
      before.add(src.slice(Math.max(0, m.index - 24), m.index).replace(/\s+/g, " ").toLowerCase());
    }
  }
  return [[...after], [...before]];
}

const report = { base: BASE, startedAt: new Date().toISOString(), apps: [], totals: {} };
let totalRoutes = 0, totalBad = 0;

function say(...a) { if (!QUIET) console.log(...a); }

/* ============================================================== crawl loop */

/** (re)install the in-page harness and confirm it survived */
async function installHarness(s, app) {
  const [afterCtx, beforeCtx] = authoredContexts(app);
  for (let attempt = 0; attempt < 3; attempt++) {
    await s.evaluate(HARNESS);
    await s.evaluate(`window.__e2e.setAuthored(${JSON.stringify(afterCtx)},${JSON.stringify(beforeCtx)}),1`);
    if (await s.evaluate(`typeof window.__e2e === "object" && typeof window.__e2e.nav === "function"`)) return true;
    await sleep(120);
  }
  return false;
}

async function crawlApp(s, app) {
  const url = `${BASE}/${app.dir}/index.html`;
  const entry = {
    name: app.name, dir: app.dir, url,
    tracks: [], routes: 0, checked: 0, failures: [], warnings: [],
    widgetIds: [], quizIds: [], quizzesPlayed: 0, widgetsPoked: 0,
    examOk: null, flashOk: null, skipped: null,   // null = feature not present
  };

  /*
   * When the shell mounts tracks that no content file registers yet, the app is
   * mid-integration. Findings caused by that are downgraded to warnings — but
   * only for the routes it can explain: the unregistered tracks themselves and
   * the cross-track aggregate views. A defect on a route belonging to a fully
   * registered track is real regardless, so it stays a failure.
   */
  let unregisteredTracks = null;
  const AGGREGATE = /^#\/($|paths|practice|review|exam|quiz|flashcards|scenarios|interview|rubrics|cheatsheets|glossary| \(boot\))/;
  const downgraded = (route) => {
    if (!unregisteredTracks) return false;
    if (AGGREGATE.test(route)) return true;
    const seg = String(route).replace(/^#\/?/, "").split("/");
    return unregisteredTracks.includes(seg[0]) || (seg[0] === "print" && unregisteredTracks.includes(seg[1]));
  };
  const fail = (route, symptom, detail) => {
    (downgraded(route) ? entry.warnings : entry.failures).push({ route, symptom, detail: detail || undefined });
  };
  const warnAt = (route, symptom, detail) => {
    entry.warnings.push({ route, symptom, detail: detail || undefined });
  };

  say(`\n── ${app.name} (${app.dir}) ──`);
  if (!app.hasShell) { entry.skipped = "no index.html + js/app.js yet"; say(`   skipped — ${entry.skipped}`); return entry; }

  if (!(await boot(s, url))) {
    /* An app shell whose content files are missing registers no tracks. That is
     * an academy still being authored, not a regression — skip with a notice so
     * the gate stays useful, and start failing the moment content lands. */
    const registered = await s.evaluate(
      `(function(){try{return window.TRACKS?Object.keys(window.TRACKS).length:0;}catch(e){return 0;}})()`
    ).catch(() => 0);
    const events = s.take();
    if (!registered) {
      entry.skipped = "shell present but no content registered yet (mid-authoring)";
      entry.warnings = events.map((e) => ({ route: "#/", symptom: e.kind, detail: e.text }));
      say(`   skipped — ${entry.skipped} (${events.length} boot event(s) recorded as warnings)`);
      return entry;
    }
    fail("#/", "app never booted", `#main stayed empty for 15s at ${url}`);
    for (const e of events) fail("#/", e.kind, e.text);
    entry.checked = 1;
    say(`   FAIL — app never booted`);
    return entry;
  }

  /* Deterministic state, and no chance of testing yesterday's precache. Then
   * reload so the next load is the clean one. */
  await resetOrigin(s);
  s.take();                                  // events from the pre-clean load

  if (!(await reload(s))) {
    fail("#/", "app never booted after a clean reload", url);
    for (const e of s.take()) fail("#/", e.kind, e.text);
    entry.checked = 1;
    return entry;
  }
  if (!(await installHarness(s, app))) {
    fail("#/", "test harness would not install", "window.__e2e vanished after three attempts — the page kept navigating");
    entry.checked = 1;
    return entry;
  }
  await s.evaluate(`window.__e2e.nav("#/").then(function(){return 1;})`, { awaitPromise: true });
  await s.flush();
  /* boot-time console output is a real defect, so it is scored, not discarded —
   * but held until the partial-integration check below decides the severity */
  const bootEvents = s.take();

  const disc = await s.evaluate(`JSON.stringify(window.__e2e.discover())`).then(JSON.parse);
  entry.tracks = disc.tracks;
  entry.widgetIds = disc.widgetIds;
  entry.quizIds = disc.quizIds;

  if (!disc.lessons.length) {
    entry.skipped = "no tracks registered yet (content still being authored)";
    entry.warnings = bootEvents.map((e) => ({ route: "#/ (boot)", symptom: e.kind, detail: e.text }));
    say(`   skipped — ${entry.skipped}`);
    return entry;
  }

  const unregistered = [...mountedTrackIds(read(app.appJs))].filter((id) => !disc.trackIds.includes(id));
  if (unregistered.length) {
    unregisteredTracks = unregistered;
    entry.partial = unregistered;
    say(`   partial — app.js mounts ${unregistered.join(", ")} but no content file registers them;` +
        ` findings on those tracks and on aggregate views are warnings`);
  }
  for (const e of bootEvents) fail("#/ (boot)", e.kind, e.text);

  /* feature routes from the app's own router, print routes from its own tracks */
  const { features, takesParam } = routerVocab(read(app.appJs));
  const featureRoutes = [...features].filter((f) => f !== "print").sort().map((f) => `#/${f}`);
  /* only where the router actually reads a second segment for practice — a
   * crawler that invents routes the app never claimed reports its own bugs */
  if (features.has("practice") && takesParam.has("practice")) featureRoutes.push("#/practice/weak");
  const printRoutes = features.has("print") ? disc.trackIds.map((t) => `#/print/${t}`) : [];

  let lessons = disc.lessons;
  if (SAMPLE > 0 && lessons.length > SAMPLE) {
    const stride = lessons.length / SAMPLE;
    lessons = Array.from({ length: SAMPLE }, (_, i) => lessons[Math.floor(i * stride)]);
  }
  const routes = ["#/", ...featureRoutes, ...printRoutes, ...lessons];
  const lessonSet = new Set(lessons);
  entry.routes = routes.length;
  entry.lessonRoutes = disc.lessons.length;

  /* home fingerprint, so a route that silently falls through is detectable */
  const home = await navAudit(s, "#/");
  await s.flush(); s.take();
  const homeFingerprint = home.fingerprint;

  /* ---- pass 1: render + integrity on every route ---- */
  const widgetRoute = new Map();   // widget id -> [route, mountIndex]
  const quizRoute = new Map();     // quiz id   -> [route, mountIndex]

  for (const route of routes) {
    let a;
    try {
      a = await navAudit(s, route);
    } catch (e) {
      /* a dead browser is not a defect in this route — let it end the run
       * rather than be filed as content evidence */
      if (e.harnessFault) throw e;
      fail(route, "audit failed", e.message);
      entry.checked++;
      continue;
    }
    await s.flush();
    const events = s.take();
    entry.checked++;

    for (const e of events) fail(route, e.kind, e.text);

    /* Lessons are long-form reads, so anything under ~200 chars means the
     * render collapsed. Feature views are legitimately terse — a flashcard
     * front is a single term, and #/review with no weak spots is one sentence. */
    const floor = lessonSet.has(route) ? 200 : 25;
    if (a.textLen < floor) fail(route, "view rendered almost nothing", `#main text is ${a.textLen} chars (floor ${floor}): "${a.sample}"`);
    if (route !== "#/" && a.fingerprint === homeFingerprint) {
      fail(route, "fell through to home", "the router did not recognise this route");
    }

    a.widgets.forEach((w, i) => {
      if (!w.textLen) fail(route, "empty widget mount", `data-widget="${w.id}" rendered nothing — window.Widgets["${w.id}"] is missing or the mount was skipped`);
      else if (w.errorCard) fail(route, "widget error card", `data-widget="${w.id}" rendered the "Widget failed to load" fallback`);
      else if (!widgetRoute.has(w.id)) widgetRoute.set(w.id, [route, i]);
    });

    a.quizzes.forEach((q, i) => {
      if (!q.textLen) fail(route, "empty quiz mount", `data-quiz="${q.id}" rendered nothing — window.QUIZZES["${q.id}"] is missing at mount time`);
      else if (!q.questionLen) fail(route, "quiz without a question", `data-quiz="${q.id}" mounted but no .q-question`);
      else if (!q.optionCount) fail(route, "quiz without options", `data-quiz="${q.id}" rendered no .q-opt buttons`);
      else if (!quizRoute.has(q.id)) quizRoute.set(q.id, [route, i]);
    });

    for (const h of a.hard) fail(route, `leaked "${h.token}"`, h.context);
    for (const soft of a.soft) warnAt(route, `contains "${soft.token}"`, soft.context);
  }

  /* ---- pass 2: interactivity ---- */
  if (INTERACT) {
    /* every distinct quiz id, played to its result card */
    let quizTargets = [...quizRoute.entries()];
    if (SAMPLE > 0) quizTargets = quizTargets.slice(0, Math.max(2, Math.ceil(SAMPLE / 2)));
    for (const [id, [route, index]] of quizTargets) {
      const r = await runOn(s, route, `window.__e2e.playQuiz(${index})`);
      await s.flush();
      for (const e of s.take()) fail(route, `${e.kind} while playing quiz "${id}"`, e.text);
      if (!r || !r.ok) fail(route, `quiz "${id}" not playable`, (r && r.why) || "harness error");
      else entry.quizzesPlayed++;
    }

    /* one control on every distinct widget id */
    let widgetTargets = [...widgetRoute.entries()];
    if (SAMPLE > 0) widgetTargets = widgetTargets.slice(0, Math.max(2, SAMPLE));
    for (const [id, [route, index]] of widgetTargets) {
      let r = await runOn(s, route, `window.__e2e.pokeWidget(${index})`);
      /* "the mount isn't there" is never an answer about the widget: either the
       * route had not finished rendering, or something re-rendered underneath
       * the poke. Re-navigate and ask once more, so a rendering race cannot be
       * filed as "this widget is inert" — which is what it looked like once, on
       * a widget that is provably interactive. */
      if (r && !r.ok && /no widget mount/.test(r.why || "")) {
        r = await runOn(s, route, `window.__e2e.pokeWidget(${index})`);
        if (r && r.ok) warnAt(route, `widget "${id}" needed a second navigation before its mount existed`, "rendering race in the crawl, not a content defect");
      }
      await s.flush();
      for (const e of s.take()) fail(route, `${e.kind} while driving widget "${id}"`, e.text);
      if (!r || !r.ok) fail(route, `widget "${id}" not interactive`, (r && r.why) || "harness error");
      else {
        entry.widgetsPoked++;
        if (r.static) warnAt(route, `widget "${id}" has no controls`, "render-only widget");
        else if (r.idempotent) warnAt(route, `widget "${id}" control is idempotent`, `re-running "${r.control}" produced the same output`);
      }
    }

    /* exam + flashcards read QUIZZES/TRACKS at call time and break on their own */
    if (features.has("exam") || features.has("quiz")) {
      const examRoute = features.has("exam") ? "#/exam" : "#/quiz";
      const r = await runOn(s, examRoute, `window.__e2e.runExam()`);
      await s.flush();
      for (const e of s.take()) fail(examRoute, `${e.kind} in exam mode`, e.text);
      entry.examOk = !!(r && r.ok);
      if (!entry.examOk) fail(examRoute, "exam not playable", (r && r.why) || "harness error");
    }
    if (features.has("flashcards")) {
      const r = await runOn(s, "#/flashcards", `window.__e2e.flipCard()`);
      await s.flush();
      for (const e of s.take()) fail("#/flashcards", `${e.kind} in flashcards`, e.text);
      entry.flashOk = !!(r && r.ok);
      if (!entry.flashOk) fail("#/flashcards", "flashcard not flippable", (r && r.why) || "harness error");
    }
  }

  return entry;
}

/** navigate then audit in one awaited round trip; the promise is resolved
 * in-page before stringifying, which awaitPromise alone would not do */
async function navAudit(s, route) {
  const json = await s.evaluate(
    `window.__e2e.navAudit(${JSON.stringify(route)}).then(function(a){return JSON.stringify(a);})`,
    { awaitPromise: true });
  return JSON.parse(json);
}

/* "the control isn't on the page yet" answers when the view finished rendering,
 * not whether the feature works: nav() resolves on hashchange plus two frames,
 * and a view that renders a beat later (Citadel's exam and flashcards did) was
 * being filed as broken. Poll for it before concluding anything. */
const NOT_RENDERED_YET = /^no (start|flip) control|^no card face rendered|^no widget mount/;

async function runOn(s, route, call) {
  await s.evaluate(`window.__e2e.nav(${JSON.stringify(route)}).then(function(){return 1;})`, { awaitPromise: true });
  await s.flush();
  s.take();                          // render noise for this route was already scored in pass 1
  let r;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      r = JSON.parse(await s.evaluate(`JSON.stringify(${call})`));
    } catch (e) {
      if (e.harnessFault) throw e;
      return { ok: false, why: e.message };
    }
    if (r && (r.ok || !NOT_RENDERED_YET.test(r.why || ""))) return r;
    await new Promise((res) => setTimeout(res, 150));
  }
  return r;
}

/* ==================================================================== main */

/** prove the audit and the fall-through detector still fire, against a real app */
async function selfcheck(s, app) {
  const url = `${BASE}/${app.dir}/index.html`;
  if (!(await boot(s, url))) { console.log(`FAIL [selfcheck] ${app.dir} would not boot`); return 1; }
  if (!(await installHarness(s, app))) { console.log(`FAIL [selfcheck] harness would not install`); return 1; }
  await s.evaluate(`window.__e2e.setAuthored([],[]),1`);

  const home = await navAudit(s, "#/");
  const bogus = await navAudit(s, "#/__atlas_e2e_bogus__/x/y");
  const r = JSON.parse(await s.evaluate(`JSON.stringify(window.__e2e.selfcheck())`));
  await s.flush(); s.take();

  const checks = [
    [r.sawEmptyWidgetMount, "an empty .widget-mount is reported"],
    [r.sawEmptyQuizMount, "an empty .quiz-mount is reported"],
    [r.sawObjectObject, 'a leaked "[object Object]" is reported'],
    [r.sawNaN, 'a leaked "NaN" is reported'],
    [r.cleanAfterRemoval, "the probe leaves no residue"],
    [bogus.fingerprint === home.fingerprint, "an unknown route is detected as a fall-through to home"],
    [home.textLen > 200, "the home view renders real content"],
  ];
  let bad = 0;
  for (const [ok, what] of checks) {
    console.log(`${ok ? "ok  " : "FAIL"} [selfcheck] ${what}`);
    if (!ok) bad++;
  }
  return bad;
}

const main = async () => {
  startDeadline(Number(flag("deadline", 25)) * 60_000, "The end-to-end crawl");
  const apps = discoverApps().filter((a) => !ONLY || a.dir === ONLY || a.name.toLowerCase() === String(ONLY).toLowerCase());
  if (!apps.length) { console.error(`no academy matched --app=${ONLY}`); process.exit(2); }

  const s = await Session.attach(CDP);

  if (flag("selfcheck", false)) {
    const target = apps.find((a) => a.hasShell);
    const bad = target ? await selfcheck(s, target) : 1;
    s.close();
    console.log(`\n${bad ? "FAILED" : "PASSED"}: crawler self-check ${bad ? bad + " assertion(s) failed" : "all assertions hold"}.`);
    process.exit(bad ? 1 : 0);
  }
  try {
    for (const app of apps) {
      const entry = await crawlApp(s, app);
      report.apps.push(entry);
      totalRoutes += entry.checked;
      const routesWithProblems = new Set(entry.failures.map((f) => f.route)).size;
      totalBad += routesWithProblems;

      if (entry.skipped) { say(`   ${entry.checked} route(s) checked · skipped: ${entry.skipped}`); continue; }
      say(`   ${entry.checked} route(s) · ${entry.tracks.length} track(s) · ` +
          `${entry.quizzesPlayed} quiz(zes) played · ${entry.widgetsPoked} widget(s) driven · ` +
          `${entry.failures.length} failure(s), ${entry.warnings.length} warning(s)`);
      for (const f of entry.failures.slice(0, 40)) {
        console.log(`   FAIL ${f.route}  ${f.symptom}${f.detail ? "\n        " + f.detail : ""}`);
      }
      if (entry.failures.length > 40) console.log(`   ... ${entry.failures.length - 40} more failure(s) (see ${OUT})`);
      for (const w of entry.warnings.slice(0, 10)) {
        console.log(`   warn ${w.route}  ${w.symptom}${w.detail ? "  — " + w.detail.slice(0, 120) : ""}`);
      }
      if (entry.warnings.length > 10) console.log(`   ... ${entry.warnings.length - 10} more warning(s) (see ${OUT})`);
    }
  } finally {
    s.close();
  }

  /* summary table */
  const rows = report.apps.map((a) => ({
    app: a.name,
    tracks: a.tracks.length,
    routes: a.checked,
    widgets: a.widgetIds.length,
    quizzes: a.quizIds.length,
    played: a.quizzesPlayed,
    driven: a.widgetsPoked,
    exam: a.examOk === null ? "-" : a.examOk ? "ok" : "FAIL",
    flash: a.flashOk === null ? "-" : a.flashOk ? "ok" : "FAIL",
    fails: a.failures.length,
    warns: a.warnings.length,
    note: a.skipped || (a.partial ? `partial: ${a.partial.join(",")} unregistered` : ""),
  }));
  const cols = ["app", "tracks", "routes", "widgets", "quizzes", "played", "driven", "exam", "flash", "fails", "warns", "note"];
  const w = {};
  for (const c of cols) w[c] = Math.max(c.length, ...rows.map((r) => String(r[c]).length));
  console.log("\n" + cols.map((c) => c.padEnd(w[c])).join("  "));
  console.log(cols.map((c) => "-".repeat(w[c])).join("  "));
  for (const r of rows) console.log(cols.map((c) => String(r[c]).padEnd(w[c])).join("  "));

  report.totals = {
    routesChecked: totalRoutes,
    routesWithProblems: totalBad,
    failures: report.apps.reduce((n, a) => n + a.failures.length, 0),
    warnings: report.apps.reduce((n, a) => n + a.warnings.length, 0),
    skipped: report.apps.filter((a) => a.skipped).map((a) => a.dir),
  };
  report.finishedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(report, null, 2));

  const verdict = totalBad ? "FAILED" : "PASSED";
  console.log(`\n${verdict}: ${totalRoutes - totalBad} of ${totalRoutes} routes clean` +
    `${report.totals.failures ? ` (${report.totals.failures} failure(s))` : ""}` +
    `${report.totals.skipped.length ? ` · skipped ${report.totals.skipped.join(", ")}` : ""}`);
  console.log(`report: ${OUT}`);
  process.exit(totalBad ? 1 : 0);
};

main().catch((e) => {
  if (e && e.harnessFault) { reportFault(e, "The end-to-end crawl"); process.exit(HARNESS_FAULT); }
  console.error("crawler error: " + (e && e.message || e));
  process.exit(2);
});
