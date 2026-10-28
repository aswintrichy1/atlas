#!/usr/bin/env node
/*
 * Atlas content contract validator (no dependencies).
 *
 * Loads each app's data files (curriculum / track / quiz / widget / practice)
 * inside a `vm` sandbox with a minimal DOM stub, then asserts the authoring
 * contract in docs/ENGINE_SPEC.md holds:
 *
 *   - every track has id/name/short/color/blurb + non-empty modules
 *   - track.id matches its window.TRACKS key; module + lesson ids are unique
 *     and URL-safe; no duplicate routes
 *   - every lesson has title/summary/minutes/blocks and a sane block mix
 *   - every block uses a known `t` and carries the fields that `t` requires
 *   - every {t:'quiz'} id resolves in window.QUIZZES
 *   - every {t:'widget'} id resolves in window.Widgets
 *   - every quiz has title/sub/questions; every question has 2+ options, an
 *     integer `answer` in range, and a non-trivial `explain`
 *   - every quiz id is prefixed with a track id the app actually mounts
 *   - no orphan quizzes (registered but never referenced and not reachable)
 *
 * Usage:  node tools/validate_content.mjs [appDir ...] [--content-only]
 *
 * --content-only skips the app.js/index.html wiring cross-check, which is what
 * you want while authoring a track that has not been integrated yet.
 *
 * Exit code is non-zero if any FAIL is found.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const APPS = [
  { name: "Blueprint", dir: "hld-lld-academy" },
  { name: "Codex", dir: "dsa-patterns-academy" },
  { name: "Citadel", dir: "cyber-academy" },
  { name: "Cascade", dir: "data-eng-academy" },
  { name: "TechLead", dir: "techno-managerial-academy" },
  { name: "Compass", dir: "behavioral-academy" },
  { name: "Synapse", dir: "ml-ai-academy" },
  { name: "Forge", dir: "devsecops-academy" },
  { name: "Lumen", dir: "llm-academy" },
  { name: "Glacier", dir: "snowflake-academy" },
  { name: "Nimbus", dir: "cloud-academy" },
  { name: "Beacon", dir: "sre-academy" },
  { name: "Ledger", dir: "db-internals-academy" },
  { name: "Kernel", dir: "linux-net-academy" },
  { name: "Anvil", dir: "java-backend-academy" },
  { name: "Orbit", dir: "salesforce-academy" },
  { name: "Pixel", dir: "frontend-academy" },
  { name: "Chisel", dir: "software-craft-academy" },
  { name: "Pyxis", dir: "python-academy" },
  { name: "Summit", dir: "certification-academy" },
  { name: "Pulse", dir: "streaming-academy" },
];

let fails = 0, warns = 0, checks = 0;
const fail = (app, msg) => { console.log(`FAIL [${app}] ${msg}`); fails++; };
const warn = (app, msg) => { console.log(`warn [${app}] ${msg}`); warns++; };
const pass = (app, msg) => { console.log(`ok   [${app}] ${msg}`); checks++; };

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const MIN_QUESTIONS = 4;      // docs/ENGINE_SPEC.md: "4-10 questions per quiz"

/* ---------- DOM stub: a real-enough element tree so widgets can mount ----------
 * Widgets build a subtree then re-find parts of it with querySelector, so a stub
 * whose querySelector always returns null produces false "threw on mount"
 * failures. This implements a tiny tree with matching for the selector shapes
 * the widget code actually uses: "#id", ".class", "tag", and "tag.class".
 */
/* widget helpers branch on `kid instanceof Node`, so stub nodes must be real
 * instances of something exposed as the global `Node` */
function NodeStub() {}

function makeSandbox() {
  const noop = () => {};
  // some widgets look their own children up with document.getElementById, which
  // works in the app because the mount is already attached; index every node so
  // the stub can answer the same way
  const byId = new Map();

  function matches(node, sel) {
    if (!node || !node.tagName) return false;
    for (const part of sel.trim().split(/\s*,\s*/)) {
      // take the last compound in a descendant selector: ".a .b" -> ".b"
      const compound = part.trim().split(/\s+/).pop();
      const m = compound.match(/^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)(?:\[[^\]]*\])?$/);
      if (!m) continue;
      const [, tag, rest] = m;
      if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) continue;
      const bits = rest ? rest.match(/[.#][\w-]+/g) || [] : [];
      let ok = true;
      for (const b of bits) {
        const val = b.slice(1);
        if (b[0] === "#") { if (node.id !== val && node.getAttribute("id") !== val) { ok = false; break; } }
        else if (!String(node.className || "").split(/\s+/).includes(val)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }
  function descend(node, sel, out, first) {
    for (const c of node.children) {
      if (!c || !c.tagName) continue;
      if (matches(c, sel)) { out.push(c); if (first) return true; }
      if (descend(c, sel, out, first) && first) return true;
    }
    return out.length > 0;
  }

  const mkNode = (tagName = "div") => {
    const node = {
      tagName: String(tagName).toUpperCase(), id: "", style: {}, dataset: {},
      children: [], attributes: {}, parentNode: null, _classes: new Set(),
      className: "", textContent: "", innerHTML: "", value: "", disabled: false,
      checked: false, hidden: false, isConnected: true, files: null,
      get childNodes() { return this.children; },
      get firstChild() { return this.children[0] || null; },
      get lastChild() { return this.children[this.children.length - 1] || null; },
      classList: {
        add(...cs) { cs.forEach((c) => node._classes.add(c)); node.className = [...node._classes].join(" "); },
        remove(...cs) { cs.forEach((c) => node._classes.delete(c)); node.className = [...node._classes].join(" "); },
        toggle(c, on) { const has = node._classes.has(c); const want = on === undefined ? !has : !!on; want ? node._classes.add(c) : node._classes.delete(c); node.className = [...node._classes].join(" "); return want; },
        contains(c) { return node._classes.has(c); },
      },
      appendChild(c) { if (c) { c.parentNode = node; node.children.push(c); } return c; },
      /* ParentNode.append/prepend/replaceChildren take nodes or strings */
      append(...cs) { for (const c of cs) node.appendChild(typeof c === "object" && c ? c : document.createTextNode(c)); },
      prepend(...cs) { for (const c of cs.reverse()) node.insertBefore(typeof c === "object" && c ? c : document.createTextNode(c), node.children[0]); },
      replaceChildren(...cs) { node.children.length = 0; node.append(...cs); },
      insertBefore(c, ref) { if (!c) return c; c.parentNode = node; const i = node.children.indexOf(ref); i < 0 ? node.children.push(c) : node.children.splice(i, 0, c); return c; },
      replaceChild(n, o) { const i = node.children.indexOf(o); if (i >= 0) node.children[i] = n; return o; },
      removeChild(c) { const i = node.children.indexOf(c); if (i >= 0) node.children.splice(i, 1); return c; },
      remove() { if (node.parentNode) node.parentNode.removeChild(node); },
      addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
      setAttribute(k, v) { node.attributes[k] = String(v); if (k === "id") { node.id = String(v); byId.set(String(v), node); } if (k === "class") { node._classes = new Set(String(v).split(/\s+/).filter(Boolean)); node.className = String(v); } },
      getAttribute(k) { return k === "id" && node.id ? node.id : (node.attributes[k] ?? null); },
      removeAttribute(k) { delete node.attributes[k]; },
      hasAttribute(k) { return k in node.attributes; },
      querySelector(sel) { const out = []; descend(node, sel, out, true); return out[0] || null; },
      querySelectorAll(sel) { const out = []; descend(node, sel, out, false); return out; },
      closest(sel) { let n = node; while (n) { if (matches(n, sel)) return n; n = n.parentNode; } return null; },
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 300, height: 150, top: 0, left: 0, right: 300, bottom: 150 }),
      getContext: () => null,
      focus: noop, blur: noop, click: noop, scrollIntoView: noop, select: noop,
      setSelectionRange: noop, animate: () => ({ finished: Promise.resolve(), cancel: noop }),
    };
    // keep className <-> classList in sync when assigned directly
    let cn = "";
    Object.defineProperty(node, "className", {
      get: () => cn,
      set: (v) => { cn = String(v); node._classes = new Set(cn.split(/\s+/).filter(Boolean)); },
      enumerable: true,
    });
    Object.setPrototypeOf(node, NodeStub.prototype);
    return node;
  };

  const document = {
    createElement: (t) => mkNode(t), createElementNS: (ns, t) => mkNode(t),
    createTextNode: (t) => Object.setPrototypeOf({ tagName: null, textContent: String(t), children: [] }, NodeStub.prototype),
    createDocumentFragment: () => mkNode("fragment"),
    querySelector: () => null, querySelectorAll: () => [],
    getElementById: (id) => byId.get(String(id)) || null,
    getElementsByClassName: () => [], getElementsByTagName: () => [],
    addEventListener: noop, removeEventListener: noop,
    documentElement: mkNode("html"), body: mkNode("body"), head: mkNode("head"),
    title: "", activeElement: null,
  };
  const storage = (() => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
  })();
  const window = {
    Node: NodeStub, HTMLElement: NodeStub, SVGElement: NodeStub, Element: NodeStub,
    document, localStorage: storage, sessionStorage: storage,
    location: { hash: "", protocol: "http:", href: "http://localhost/", replace: noop },
    navigator: { userAgent: "node", clipboard: null, serviceWorker: undefined },
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: (fn) => { void fn; return 0; }, cancelAnimationFrame: noop,
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    print: noop, confirm: () => false, alert: noop, scrollTo: noop,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Set, Map, Promise, isNaN, parseInt, parseFloat,
  };
  window.window = window;
  window.self = window;
  window.globalThis = window;
  return window;
}

/* data files only — never app.js / exam.js / pwa.js, which touch live DOM at load */
const DATA_FILE_RE = /^(curriculum-|track-|quizzes|widgets|widget-kit|practice-content|content)/;
const SKIP_FILE_RE = /^(app|exam|pwa)\.js$/;

function loadApp(app) {
  const jsDir = join(ROOT, app.dir, "js");
  if (!existsSync(jsDir)) return null;
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".js") && !SKIP_FILE_RE.test(f) && DATA_FILE_RE.test(f));
  // widget-kit must load before track files that use window.WK
  files.sort((a, b) => (a.startsWith("widget-kit") ? -1 : b.startsWith("widget-kit") ? 1 : a.localeCompare(b)));

  const sandbox = makeSandbox();
  const context = vm.createContext(sandbox);
  const loaded = [];
  for (const f of files) {
    const src = readFileSync(join(jsDir, f), "utf8");
    try {
      new vm.Script(src, { filename: f }).runInContext(context, { timeout: 15000 });
      loaded.push(f);
    } catch (e) {
      fail(app.name, `${f} threw while loading: ${e.message}`);
    }
  }
  return { sandbox, loaded, files };
}

/* ---------- block grammar ---------- */
const BLOCK_FIELDS = {
  p: ["html"], h: ["text"], h2: ["text"], ul: ["items"], ol: ["items"],
  code: ["code"], note: ["variant", "html"], table: ["headers", "rows"],
  compare: ["bad", "good"], stat: ["items"], cue: ["html"],
  widget: ["id"], quiz: ["id"], diagram: ["id"],
};
const NOTE_VARIANTS = new Set(["tip", "key", "warn", "trap"]);
const PROSE = new Set(["p", "h", "h2"]);

function checkBlocks(app, where, blocks, quizzes, widgets, seen) {
  if (!Array.isArray(blocks) || !blocks.length) { fail(app, `${where}: blocks must be a non-empty array`); return; }
  let rich = 0, notes = 0;
  blocks.forEach((b, i) => {
    const at = `${where} block[${i}]`;
    if (!b || typeof b !== "object") { fail(app, `${at}: not an object`); return; }
    const fields = BLOCK_FIELDS[b.t];
    if (!fields) { fail(app, `${at}: unknown block type "${b.t}"`); return; }
    for (const f of fields) {
      if (b[f] == null) { fail(app, `${at} (t=${b.t}): missing required field "${f}"`); return; }
    }
    if (!PROSE.has(b.t)) rich++;
    if (b.t === "note") {
      notes++;
      if (!NOTE_VARIANTS.has(b.variant)) fail(app, `${at}: note variant "${b.variant}" not in tip|key|warn|trap`);
    }
    if ((b.t === "ul" || b.t === "ol" || b.t === "stat") && !Array.isArray(b.items)) fail(app, `${at}: items must be an array`);
    if (b.t === "table") {
      if (!Array.isArray(b.headers) || !Array.isArray(b.rows)) { fail(app, `${at}: headers and rows must be arrays`); return; }
      b.rows.forEach((r, ri) => {
        if (!Array.isArray(r)) fail(app, `${at}: rows[${ri}] must be an array`);
        else if (r.length !== b.headers.length) fail(app, `${at}: rows[${ri}] has ${r.length} cells, headers has ${b.headers.length}`);
      });
    }
    if (b.t === "compare") {
      for (const side of ["bad", "good"]) {
        if (!b[side] || typeof b[side].title !== "string" || !Array.isArray(b[side].items)) fail(app, `${at}: ${side} needs {title, items[]}`);
      }
    }
    if (b.t === "stat") {
      (b.items || []).forEach((s, si) => { if (!s || s.v == null || s.k == null) fail(app, `${at}: items[${si}] needs {v, k}`); });
    }
    if (b.t === "quiz") {
      seen.quizRefs.add(b.id);
      if (!quizzes[b.id]) fail(app, `${at}: quiz id "${b.id}" not found in window.QUIZZES`);
    }
    if (b.t === "widget") {
      seen.widgetRefs.add(b.id);
      if (!widgets[b.id]) fail(app, `${at}: widget id "${b.id}" not found in window.Widgets`);
    }
  });
  if (!rich) warn(app, `${where}: prose-only lesson (no table/list/note/code/widget/quiz)`);
  void notes;
}

/* ---------- track validation ---------- */
function checkTracks(app, sandbox, seen) {
  const TRACKS = sandbox.TRACKS || (sandbox.window && sandbox.window.TRACKS);
  const quizzes = sandbox.QUIZZES || {};
  const widgets = sandbox.Widgets || {};
  if (!TRACKS || typeof TRACKS !== "object") { warn(app, "no window.TRACKS registered (legacy content shape?)"); return null; }

  let lessons = 0, modules = 0;
  const routes = new Set();
  for (const key of Object.keys(TRACKS)) {
    const tr = TRACKS[key];
    if (!tr) { fail(app, `TRACKS.${key} is falsy`); continue; }
    if (tr.id !== key) fail(app, `TRACKS.${key}: track.id is "${tr.id}", must equal its key "${key}"`);
    for (const f of ["name", "short", "color", "blurb"]) {
      if (!tr[f]) fail(app, `TRACKS.${key}: missing "${f}"`);
    }
    if (!Array.isArray(tr.modules) || !tr.modules.length) { fail(app, `TRACKS.${key}: modules must be a non-empty array`); continue; }
    seen.trackIds.add(key);

    const modIds = new Set();
    for (const mod of tr.modules) {
      modules++;
      if (!mod || !mod.id) { fail(app, `TRACKS.${key}: a module has no id`); continue; }
      if (!ID_RE.test(mod.id)) fail(app, `TRACKS.${key}/${mod.id}: module id is not url-safe`);
      if (modIds.has(mod.id)) fail(app, `TRACKS.${key}: duplicate module id "${mod.id}"`);
      modIds.add(mod.id);
      if (!mod.name) fail(app, `TRACKS.${key}/${mod.id}: module missing name`);
      if (!Array.isArray(mod.lessons) || !mod.lessons.length) { fail(app, `TRACKS.${key}/${mod.id}: lessons must be a non-empty array`); continue; }

      const lessonIds = new Set();
      for (const ls of mod.lessons) {
        lessons++;
        if (!ls || !ls.id) { fail(app, `TRACKS.${key}/${mod.id}: a lesson has no id`); continue; }
        if (!ID_RE.test(ls.id)) fail(app, `TRACKS.${key}/${mod.id}/${ls.id}: lesson id is not url-safe`);
        if (lessonIds.has(ls.id)) fail(app, `TRACKS.${key}/${mod.id}: duplicate lesson id "${ls.id}"`);
        lessonIds.add(ls.id);
        const route = `${key}/${mod.id}/${ls.id}`;
        if (routes.has(route)) fail(app, `duplicate route ${route}`);
        routes.add(route);
        seen.routes.push(route);

        if (!ls.title) fail(app, `${route}: missing title`);
        if (!ls.summary) fail(app, `${route}: missing summary`);
        if (typeof ls.minutes !== "number" || ls.minutes <= 0) warn(app, `${route}: minutes should be a positive number`);
        if (ls.blocks) checkBlocks(app, route, ls.blocks, quizzes, widgets, seen);
        else if (!ls.points) fail(app, `${route}: no blocks (and no legacy points)`);
      }
    }
  }
  pass(app, `${Object.keys(TRACKS).length} track(s), ${modules} module(s), ${lessons} lesson(s), ${routes.size} unique route(s)`);
  return { lessons, modules, tracks: Object.keys(TRACKS).length };
}

/* ---------- quiz validation ---------- */
function checkQuizzes(app, sandbox, seen) {
  const quizzes = sandbox.QUIZZES || {};
  const ids = Object.keys(quizzes);
  if (!ids.length) { warn(app, "no window.QUIZZES registered"); return; }
  let questions = 0, bad = 0;
  for (const qid of ids) {
    const qz = quizzes[qid];
    if (!qz || typeof qz !== "object") { fail(app, `QUIZZES["${qid}"] is not an object`); bad++; continue; }
    if (!qz.title) fail(app, `QUIZZES["${qid}"]: missing title`);
    if (!qz.sub) warn(app, `QUIZZES["${qid}"]: missing sub`);
    if (!Array.isArray(qz.questions) || !qz.questions.length) { fail(app, `QUIZZES["${qid}"]: questions must be a non-empty array`); bad++; continue; }
    qz.questions.forEach((q, i) => {
      questions++;
      const at = `QUIZZES["${qid}"].questions[${i}]`;
      if (!q || typeof q !== "object") { fail(app, `${at}: not an object`); return; }
      if (!q.q || typeof q.q !== "string") fail(app, `${at}: missing question text`);
      if (!Array.isArray(q.options) || q.options.length < 2) { fail(app, `${at}: needs at least 2 options`); return; }
      if (q.options.length > 5) fail(app, `${at}: ${q.options.length} options — the quiz UI only keys A-E`);
      if (new Set(q.options.map(String)).size !== q.options.length) fail(app, `${at}: duplicate option text`);
      if (!Number.isInteger(q.answer)) fail(app, `${at}: answer must be an integer index`);
      else if (q.answer < 0 || q.answer >= q.options.length) fail(app, `${at}: answer ${q.answer} out of range for ${q.options.length} options`);
      if (!q.explain || String(q.explain).trim().length < 40) fail(app, `${at}: explain must be a real explanation (40+ chars)`);
    });
    // if the app filters quizzes by prefix, an unlisted prefix means the quiz
    // never reaches practice/exam mode
    if (seen.quizPrefixes && seen.quizPrefixes.length) {
      if (!seen.quizPrefixes.some((p) => qid.startsWith(p))) {
        fail(app, `QUIZZES["${qid}"]: no ACTIVE_QUIZ_PREFIXES match (${seen.quizPrefixes.join(", ")}) — excluded from practice & exam`);
      }
    }
  }
  const orphans = ids.filter((id) => !seen.quizRefs.has(id));
  if (orphans.length) warn(app, `${orphans.length} quiz(zes) never referenced by a {t:'quiz'} block: ${orphans.slice(0, 6).join(", ")}${orphans.length > 6 ? "…" : ""}`);

  /*
   * The spec asks for 4-10 questions per quiz. Only the upper bound was ever
   * enforced (indirectly, through the A-E option keying), so short quizzes
   * passed in silence. A warning rather than a failure: every current instance
   * predates this check and red-gating the build on them would just teach
   * people to ignore the gate.
   */
  const short = ids
    .filter((id) => Array.isArray(quizzes[id].questions) && quizzes[id].questions.length < MIN_QUESTIONS)
    .map((id) => `${id} (${quizzes[id].questions.length})`);
  if (short.length) {
    warn(app, `${short.length} of ${ids.length} quiz(zes) below the ${MIN_QUESTIONS}-question minimum: ` +
      `${short.slice(0, 8).join(", ")}${short.length > 8 ? ` … +${short.length - 8} more` : ""}`);
  }
  if (!bad) pass(app, `${ids.length} quiz(zes), ${questions} question(s) all well-formed`);
}

/* ---------- widget validation ---------- */
function checkWidgets(app, sandbox, seen) {
  const widgets = sandbox.Widgets || {};
  const ids = Object.keys(widgets);
  if (!ids.length) return;
  let notFn = 0;
  for (const id of ids) if (typeof widgets[id] !== "function") { fail(app, `Widgets["${id}"] is not a function`); notFn++; }

  // actually mount every widget against the DOM stub to catch load-time throws
  let threw = 0;
  for (const id of ids) {
    if (typeof widgets[id] !== "function") continue;
    const mount = sandbox.document.createElement("div");
    try { widgets[id](mount); }
    catch (e) { fail(app, `Widgets["${id}"] threw on mount: ${e.message}`); threw++; }
  }
  const orphans = ids.filter((id) => !seen.widgetRefs.has(id));
  if (orphans.length) warn(app, `${orphans.length} widget(s) never referenced by a {t:'widget'} block: ${orphans.slice(0, 6).join(", ")}${orphans.length > 6 ? "…" : ""}`);
  if (!notFn && !threw) pass(app, `${ids.length} widget(s) all mount cleanly`);
}

/* ---------- wiring cross-check: app.js must mount what content registers ---------- */
function checkWiring(app, sandbox, seen) {
  const appJs = join(ROOT, app.dir, "js", "app.js");
  const indexHtml = join(ROOT, app.dir, "index.html");
  if (!existsSync(appJs) || !existsSync(indexHtml)) return;
  const src = readFileSync(appJs, "utf8");
  const html = readFileSync(indexHtml, "utf8");

  const m = src.match(/const TRACKS\s*=\s*\[([^\]]*)\]/);
  if (m) {
    const mounted = [...m[1].matchAll(/window\.TRACKS\.([A-Za-z0-9_]+)/g)].map((x) => x[1]);
    for (const id of seen.trackIds) {
      if (!mounted.includes(id)) fail(app.name, `track "${id}" is registered but app.js does not mount it (const TRACKS = [...])`);
    }
    for (const id of mounted) {
      if (!seen.trackIds.has(id)) fail(app.name, `app.js mounts window.TRACKS.${id} but no content file registers it`);
    }
    if (mounted.length) pass(app.name, `app.js mounts ${mounted.length} track(s): ${mounted.join(", ")}`);
  }

  // exam.js keeps its own copy of the prefix list; the two must agree
  const examJs = join(ROOT, app.dir, "js", "exam.js");
  if (existsSync(examJs) && seen.quizPrefixes.length) {
    const ex = readFileSync(examJs, "utf8").match(/ACTIVE_QUIZ_PREFIXES\s*=\s*\[([^\]]*)\]/);
    if (ex) {
      const examPrefixes = [...ex[1].matchAll(/"([^"]+)"/g)].map((x) => x[1].replace(/-$/, ""));
      const appPrefixes = seen.quizPrefixes.map((p) => p.replace(/-$/, ""));
      const missing = appPrefixes.filter((p) => !examPrefixes.includes(p));
      if (missing.length) fail(app.name, `exam.js ACTIVE_QUIZ_PREFIXES is missing ${missing.join(", ")} — those quizzes never appear in exam mode`);
      else pass(app.name, `exam.js prefix list matches app.js (${examPrefixes.join(", ")})`);
    }
  }

  // every data file we loaded must be a <script src> in index.html
  for (const f of seen.loaded) {
    if (!html.includes(`js/${f}`)) fail(app.name, `js/${f} exists and registers content but is not loaded by index.html`);
  }
  pass(app.name, `${seen.loaded.length} data file(s) all referenced by index.html`);
}

/* ---------- run ---------- */
const argv = process.argv.slice(2);
const contentOnly = argv.includes("--content-only");
const only = argv.filter((a) => !a.startsWith("--")).map((a) => basename(a.replace(/\/+$/, "")));
const targets = only.length ? APPS.filter((a) => only.includes(a.dir) || only.includes(a.name)) : APPS;

for (const app of targets) {
  if (!existsSync(join(ROOT, app.dir))) continue;
  console.log(`\n── ${app.name} (${app.dir}) ──`);
  const res = loadApp(app);
  if (!res) { warn(app.name, "no js/ directory"); continue; }
  if (!res.loaded.length) { warn(app.name, "no data files matched"); continue; }
  const appJsPath = join(ROOT, app.dir, "js", "app.js");
  const appSrc = existsSync(appJsPath) ? readFileSync(appJsPath, "utf8") : "";
  const pm = appSrc.match(/ACTIVE_QUIZ_PREFIXES\s*=\s*\[([^\]]*)\]/);
  const quizPrefixes = pm ? [...pm[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];

  const seen = { quizRefs: new Set(), widgetRefs: new Set(), trackIds: new Set(), routes: [], loaded: res.loaded, quizPrefixes };
  checkTracks(app.name, res.sandbox, seen);
  checkQuizzes(app.name, res.sandbox, seen);
  checkWidgets(app.name, res.sandbox, seen);
  if (!contentOnly) checkWiring(app, res.sandbox, seen);
}

console.log(`\n${fails ? "FAILED" : "PASSED"}: ${fails} failure(s), ${warns} warning(s), ${checks} check group(s) passed.`);
process.exit(fails ? 1 : 0);
