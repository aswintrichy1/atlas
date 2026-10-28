/*
 * Shared helpers for the Atlas test tooling (no dependencies).
 *
 * Nothing in here is app-specific by hand: the app list is discovered from disk
 * and every route vocabulary is derived from the app's own router source, so a
 * new academy or a new feature route is picked up without editing this file.
 *
 * Consumed by tools/check_links.mjs and tools/crawl_e2e.mjs.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Display names only. Membership is decided by what is on disk, so an academy
 * missing from this map still gets crawled (under its directory name). */
const NAMES = {
  "hld-lld-academy": "Blueprint",
  "dsa-patterns-academy": "Codex",
  "cyber-academy": "Citadel",
  "data-eng-academy": "Cascade",
  "techno-managerial-academy": "TechLead",
  "ml-ai-academy": "Synapse",
  "behavioral-academy": "Compass",
  "devsecops-academy": "Forge",
  "llm-academy": "Lumen",
  "snowflake-academy": "Glacier",
  "cloud-academy": "Nimbus",
  "sre-academy": "Beacon",
  "db-internals-academy": "Ledger",
  "linux-net-academy": "Kernel",
  "java-backend-academy": "Anvil",
  "salesforce-academy": "Orbit",
  "frontend-academy": "Pixel",
  "software-craft-academy": "Chisel",
  "python-academy": "Pyxis",
  "certification-academy": "Summit",
  "streaming-academy": "Pulse",
};

/* ---------------------------------------------------------------- app list */

/**
 * Every academy directory on disk, in a stable order, each tagged with whether
 * it is populated enough to test. `ready:false` apps are skipped with a notice
 * rather than failing the run — new academies are often authored in parallel.
 */
export function discoverApps() {
  const order = Object.keys(NAMES);
  const dirs = readdirSync(ROOT)
    .filter((d) => /-academy$/.test(d) && statSync(join(ROOT, d)).isDirectory())
    .sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });

  return dirs.map((dir) => {
    const path = join(ROOT, dir);
    const indexHtml = join(path, "index.html");
    const appJs = join(path, "js", "app.js");
    const hasShell = existsSync(indexHtml) && existsSync(appJs);
    return {
      name: NAMES[dir] || dir,
      dir,
      path,
      indexHtml,
      appJs,
      hasShell,
      /* content readiness is decided by the caller after loading, since an app
       * can have a shell but no tracks registered yet */
      ready: hasShell,
    };
  });
}

export function hubApp() {
  return { name: "hub", dir: ".", path: ROOT, indexHtml: join(ROOT, "index.html"), appJs: null, hasShell: true, ready: true };
}

export function read(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/* ------------------------------------------------------- router vocabulary */

/**
 * Derive the set of valid first hash segments from an app's own router.
 *
 * Handles all three router dialects in the repo:
 *   parts[0] === "paths"                                  (engine apps)
 *   ["scenarios", "interview", ...].includes(parts[0])     (engine apps)
 *   hash === "#/practice" || hash === "#/scenarios"        (TechLead)
 *
 * Returns { features:Set<string>, takesParam:Set<string> } where takesParam
 * marks segments the router reads a second segment for.
 */
export function routerVocab(appJsSrc) {
  const features = new Set();
  const takesParam = new Set();
  if (!appJsSrc) return { features, takesParam };

  const body = routerBody(appJsSrc) || appJsSrc;

  for (const m of body.matchAll(/parts\[0\]\s*===\s*"([a-z0-9-]+)"/g)) features.add(m[1]);
  for (const m of body.matchAll(/hash\s*===\s*"#\/([a-z0-9-]+)"/g)) features.add(m[1]);
  for (const m of body.matchAll(/\[((?:\s*"[a-z0-9-]+"\s*,?)+)\]\s*\.includes\(\s*parts\[0\]\s*\)/g)) {
    for (const s of m[1].matchAll(/"([a-z0-9-]+)"/g)) { features.add(s[1]); takesParam.add(s[1]); }
  }
  /* A second segment is only honoured when the same branch forwards parts[1].
   * Scoped to one line so an adjacent else-if branch can't be credited with a
   * parameter it never reads — that would silently accept dangling links. */
  for (const line of body.split("\n")) {
    const m = line.match(/parts\[0\]\s*===\s*"([a-z0-9-]+)"/);
    if (m && /parts\[1\]/.test(line)) takesParam.add(m[1]);
  }

  return { features, takesParam };
}

/** Isolate `function route() { ... }` so unrelated string literals don't leak in. */
function routerBody(src) {
  const at = src.search(/function\s+route\s*\(\s*\)\s*\{/);
  if (at < 0) return null;
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (!depth) return src.slice(open, i + 1); }
  }
  return null;
}

/**
 * Which data field the app's renderer turns into a DOM id.
 * Blueprint/Codex/Cascade use `.id`; Citadel's glossary uses `.slug`. Reading
 * it out of the renderer keeps the anchor check honest instead of guessing.
 */
export function idFields(appJsSrc) {
  const out = new Set(["id"]);
  if (!appJsSrc) return out;
  for (const m of appJsSrc.matchAll(/\bid="'\s*\+\s*escapeHtml\(\s*[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\s*\)/g)) out.add(m[1]);
  for (const m of appJsSrc.matchAll(/\bid:\s*[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\b/g)) out.add(m[1]);
  return out;
}

/**
 * Track ids the app's shell mounts: `const TRACKS = [window.TRACKS.hld, ...]`.
 * A mounted id that no content file registers means the app is mid-integration.
 */
export function mountedTrackIds(appJsSrc) {
  const out = new Set();
  if (!appJsSrc) return out;
  const m = appJsSrc.match(/const TRACKS\s*=\s*\[([^\]]*)\]/);
  if (!m) return out;
  for (const t of m[1].matchAll(/window\.TRACKS\.([A-Za-z0-9_]+)/g)) out.add(t[1]);
  return out;
}

/** localStorage keys an app touches, e.g. bp_progress_v1 -> prefix "bp_". */
export function storageKeys(appJsSrc) {
  const keys = new Set();
  if (!appJsSrc) return keys;
  for (const m of appJsSrc.matchAll(/"([a-z]{2,4}_[a-z0-9_]+)"/g)) keys.add(m[1]);
  return keys;
}

/* --------------------------------------------------------------- DOM stub --
 * A real-enough element tree so content files (and the widgets they register)
 * can load and mount under `vm`. Same approach as tools/validate_content.mjs:
 * a stub whose querySelector always returns null produces false failures,
 * because widgets build a subtree then re-find parts of it.
 */
function NodeStub() {}

export function makeSandbox() {
  const noop = () => {};
  const byId = new Map();

  function matches(node, sel) {
    if (!node || !node.tagName) return false;
    for (const part of sel.trim().split(/\s*,\s*/)) {
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
const DATA_FILE_RE = /^(curriculum-|track-|quizzes|widgets|widget-kit|practice-content|content|flashcards)/;
const SKIP_FILE_RE = /^(app|exam|pwa)\.js$/;

/** Load an app's content files into one sandbox, mirroring browser load order. */
export function loadContent(app) {
  const jsDir = join(app.path, "js");
  if (!existsSync(jsDir)) return null;
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".js") && !SKIP_FILE_RE.test(f) && DATA_FILE_RE.test(f));
  files.sort((a, b) => (a.startsWith("widget-kit") ? -1 : b.startsWith("widget-kit") ? 1 : a.localeCompare(b)));

  const sandbox = makeSandbox();
  const context = vm.createContext(sandbox);
  const loaded = [];
  const errors = [];
  for (const f of files) {
    try {
      new vm.Script(readFileSync(join(jsDir, f), "utf8"), { filename: f }).runInContext(context, { timeout: 15000 });
      loaded.push(f);
    } catch (e) {
      errors.push(`${f}: ${e.message}`);
    }
  }
  return { sandbox, loaded, files, errors };
}

/* ------------------------------------------------------------- route model */

/**
 * Normalize both content shapes to one array of tracks:
 *   window.TRACKS            — object keyed by track id (engine apps)
 *   window.TM_DATA.tracks    — array (TechLead's legacy shape)
 */
export function tracksFrom(sandbox) {
  if (!sandbox) return [];
  const t = sandbox.TRACKS || (sandbox.window && sandbox.window.TRACKS);
  if (t && typeof t === "object" && Object.keys(t).length) {
    return Object.keys(t).map((k) => t[k]).filter(Boolean);
  }
  for (const key of Object.keys(sandbox)) {
    const v = sandbox[key];
    if (v && typeof v === "object" && Array.isArray(v.tracks) && v.tracks.length) return v.tracks;
  }
  return [];
}

/** All lesson routes `#/<track>/<module>/<lesson>` for a normalized track list. */
export function lessonRoutes(tracks) {
  const out = [];
  for (const tr of tracks || []) {
    for (const mod of tr.modules || []) {
      for (const ls of mod.lessons || []) {
        out.push(`#/${tr.id}/${mod.id}/${ls.id}`);
      }
    }
  }
  return out;
}

/**
 * Ids reachable as a second segment under an anchor-taking feature route,
 * bucketed by feature. The practice objects use different key names per app
 * (`interview` vs `interviewPrompts`, `cheatSheets` vs `cheatsheets`), so
 * buckets are matched by fuzzy key name instead of a hardcoded map.
 */
const ANCHOR_BUCKETS = {
  scenarios: /scenario/i,
  interview: /interview/i,
  rubrics: /rubric/i,
  cheatsheets: /cheat/i,
  glossary: /glossar/i,
};

export function practiceAnchors(sandbox, fields = new Set(["id"])) {
  const out = {};
  for (const k of Object.keys(ANCHOR_BUCKETS)) out[k] = new Set();
  if (!sandbox) return out;

  const roots = [];
  for (const key of Object.keys(sandbox)) {
    if (!/practice/i.test(key)) continue;
    const v = sandbox[key];
    if (v && typeof v === "object") roots.push(v);
  }
  for (const root of roots) {
    for (const [feature, re] of Object.entries(ANCHOR_BUCKETS)) {
      for (const key of Object.keys(root)) {
        if (!re.test(key)) continue;
        collectIds(root[key], out[feature], fields);
      }
    }
  }
  return out;
}

function collectIds(value, into, fields, depth = 0) {
  if (!value || depth > 3) return;
  if (Array.isArray(value)) { value.forEach((v) => collectIds(v, into, fields, depth + 1)); return; }
  if (typeof value !== "object") return;
  for (const f of fields) if (typeof value[f] === "string") into.add(value[f]);
  for (const k of Object.keys(value)) {
    if (fields.has(k)) continue;
    collectIds(value[k], into, fields, depth + 1);
  }
}

/**
 * Build the complete valid-route predicate for one app.
 * `routes` is the exhaustive list of routes worth visiting;
 * `isValid(hash)` additionally accepts parameterized forms.
 */
export function buildRouteModel(app, sandbox, appJsSrc) {
  const tracks = tracksFrom(sandbox);
  const trackIds = new Set(tracks.map((t) => t.id));
  const lessons = lessonRoutes(tracks);
  const lessonSet = new Set(lessons);
  const { features, takesParam } = routerVocab(appJsSrc);
  const anchors = practiceAnchors(sandbox, idFields(appJsSrc));

  const featureRoutes = [...features].sort().map((f) => `#/${f}`);
  const printRoutes = features.has("print") ? [...trackIds].sort().map((t) => `#/print/${t}`) : [];
  const extras = [];
  if (features.has("practice")) extras.push("#/practice/weak");

  return {
    tracks, trackIds, lessons, features, takesParam, anchors,
    /* everything the crawler should visit, home first */
    routes: ["#/", ...featureRoutes.filter((r) => r !== "#/print"), ...extras, ...printRoutes, ...lessons],

    /**
     * Classify a hash route. `ok:false` is a dangling link (the router falls
     * through to home, silently). `warn` flags a link the router accepts but
     * whose anchor cannot resolve because that page emits no ids.
     */
    classify(hash) {
      const parts = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
      if (!parts.length) return { ok: true };                                          // "#/" home
      if (parts.length >= 3 && lessonSet.has(`#/${parts[0]}/${parts[1]}/${parts[2]}`)) return { ok: true };
      if (parts.length >= 3) return { ok: false, why: `no lesson at ${parts[0]}/${parts[1]}/${parts[2]}` };
      if (parts.length === 1 && trackIds.has(parts[0])) return { ok: true };            // track root redirects
      if (!features.has(parts[0])) {
        return { ok: false, why: `"${parts[0]}" is neither a track nor a route this app's router handles` };
      }
      if (parts.length === 1) {
        return parts[0] === "print" ? { ok: false, why: "bare #/print has no track id" } : { ok: true };
      }
      if (parts[0] === "print") {
        return trackIds.has(parts[1]) ? { ok: true } : { ok: false, why: `no track "${parts[1]}"` };
      }
      if (parts[0] === "practice") {
        return parts[1] === "weak" ? { ok: true } : { ok: false, why: `practice mode "${parts[1]}" is not a mode (only "weak")` };
      }
      const bucket = anchors[parts[0]];
      if (bucket) {
        if (bucket.has(parts[1])) return { ok: true };
        if (!bucket.size) return { ok: true, warn: `#/${parts[0]} renders no element ids, so the "${parts[1]}" anchor cannot scroll` };
        return { ok: false, why: `no "${parts[1]}" entry on the #/${parts[0]} page` };
      }
      return takesParam.has(parts[0])
        ? { ok: true }
        : { ok: false, why: `#/${parts[0]} ignores a second segment` };
    },
    isValid(hash) { return this.classify(hash).ok; },
  };
}
