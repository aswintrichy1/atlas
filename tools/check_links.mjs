#!/usr/bin/env node
/*
 * Atlas link & reference integrity checker (static, no browser, no deps).
 *
 * The router in every app falls through to renderHome() for anything it does
 * not recognise, so a dangling cross-link is invisible at runtime — the reader
 * just lands on the home page. This gate catches those statically:
 *
 *   1. every href in every index.html (hub + academies): relative file links
 *      resolve on disk, "#/..." hash routes resolve to a real route, "#anchor"
 *      links match an id the page actually contains
 *   2. every route literal in JS — LEARNING_PATHS route arrays, practice-content
 *      route:/related/links entries, palette commands, location.hash writes and
 *      href='#/...' inside authored lesson HTML — resolves to a real lesson,
 *      track or feature route (reported with file and line)
 *   3. the hub's APPS array: every href points at an academy index.html that
 *      exists, and every progress key is unique across apps
 *   4. localStorage key prefixes are unique per academy — they share one origin
 *      on GitHub Pages, so a collision silently mixes progress between apps
 *   5. every academy links back to ../index.html and that target exists
 *   6. no external URLs (independent re-assert, not trusting lint_static.mjs)
 *   7. cross-academy links  ../<other>-academy/index.html#/...  point at an
 *      academy that exists and at a route that academy's router really serves
 *
 * Valid routes are derived from each app's own window.TRACKS and its own
 * router source, so content added later is covered with no edit here.
 *
 * Usage:  node tools/check_links.mjs [--app=<dir>] [--quiet]
 * Exit code is non-zero if any FAIL is found.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import {
  ROOT, discoverApps, hubApp, read, loadContent, buildRouteModel, storageKeys,
} from "./lib/atlas-shared.mjs";

const argv = process.argv.slice(2);
const onlyApp = (argv.find((a) => a.startsWith("--app=")) || "").split("=")[1] || null;
const QUIET = argv.includes("--quiet");

let fails = 0, warns = 0, checks = 0;
const fail = (app, msg) => { console.log(`FAIL [${app}] ${msg}`); fails++; };
const warn = (app, msg) => { console.log(`warn [${app}] ${msg}`); warns++; };
const pass = (app, msg) => { if (!QUIET) console.log(`ok   [${app}] ${msg}`); checks++; };

const rel = (p) => relative(ROOT, p) || ".";

/* ------------------------------------------------------------ file walking */

function walkJs(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkJs(p));
    else if (/\.(js|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

/** line number of a character offset, 1-based */
function lineAt(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

/* ------------------------------------------------------- reference scanners */

/**
 * Route literals worth checking. Two shapes only, both unambiguous:
 *   A. a string literal that is exactly a route      "#/hld/foundations/estimation"
 *   B. an href inside authored HTML                  href='#/glossary/saga'
 * Concatenated routes ("#/" + track.id + ...) are deliberately skipped — they
 * are computed at runtime and the crawler covers them.
 */
function scanRouteLiterals(src) {
  const hits = [];
  for (const m of src.matchAll(/(['"])(#\/[A-Za-z0-9\-_/]*)\1/g)) {
    /* skip concatenation prefixes like "#/print/" + tr.id — the tail is
     * computed at runtime, so the literal on its own is not a claim about a
     * route that should exist */
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (/^\s*\+/.test(after) || m[2].endsWith("/")) continue;
    hits.push({ route: m[2], index: m.index, kind: "literal" });
  }
  for (const m of src.matchAll(/href=\\?(['"])(#[^'"\\<>\s]*)\\?\1/g)) {
    hits.push({ route: m[2], index: m.index, kind: "href" });
  }
  return hits;
}

/** every href="..." in an HTML document */
function scanHtmlHrefs(src) {
  const hits = [];
  for (const m of src.matchAll(/\shref="([^"]*)"/g)) hits.push({ href: m[1], index: m.index });
  return hits;
}

/** ids present as literal attributes in an HTML document */
function scanHtmlIds(src) {
  const ids = new Set();
  for (const m of src.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

const EXTERNAL_OK = /^(https?:\/\/(www\.)?w3\.org|https?:\/\/[a-z0-9.-]*\.example|https?:\/\/(localhost|127\.0\.0\.1))/i;

function externalHit(text) {
  const cleaned = text
    .replace(/https?:\/\/(www\.)?w3\.org[^\s"')]*/g, "")
    .replace(/https?:\/\/[a-z0-9.-]*\.example[^\s"')]*/gi, "")
    .replace(/https?:\/\/(localhost|127\.0\.0\.1)[^\s"')]*/g, "");
  const m = cleaned.match(/https?:\/\/[^\s"')]+/);
  return m ? { url: m[0], index: cleaned.indexOf(m[0]) } : null;
}

/* --------------------------------------------------------------- app model */

const apps = discoverApps().filter((a) => !onlyApp || a.dir === onlyApp);
const models = new Map();

for (const app of apps) {
  if (!app.hasShell) continue;
  const content = loadContent(app);
  const model = buildRouteModel(app, content && content.sandbox, read(app.appJs));
  model.headingSlugs = headingSlugIndex(model.tracks);
  models.set(app.dir, { app, content, model });
}

/** lesson route -> Set of heading anchor ids the renderer emits for it */
function headingSlugIndex(tracks) {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const out = new Map();
  for (const tr of tracks || []) {
    for (const mod of tr.modules || []) {
      for (const ls of mod.lessons || []) {
        const set = new Set();
        for (const b of ls.blocks || []) if (b && (b.t === "h" || b.t === "h2") && b.text) set.add(slug(b.text));
        out.set(`#/${tr.id}/${mod.id}/${ls.id}`, set);
      }
    }
  }
  return out;
}

/** classify a route, extended with the 4th-segment heading anchor */
function classify(model, route) {
  const parts = route.replace(/^#\/?/, "").split("/").filter(Boolean);
  const base = model.classify(route);
  if (!base.ok || parts.length < 4) return base;
  const lesson = `#/${parts[0]}/${parts[1]}/${parts[2]}`;
  const slugs = model.headingSlugs.get(lesson);
  if (!slugs) return base;
  if (slugs.has(parts[3])) return { ok: true };
  return { ok: false, why: `"${parts[3]}" is not a heading anchor in ${lesson}` };
}

/* ------------------------------------------------------------------- gates */

/* ---- gate 3 + 4 prep: hub APPS array ---- */
function checkHub() {
  const name = "hub";
  const src = read(hubApp().indexHtml);
  if (!src) { fail(name, "index.html missing"); return { keys: new Map() }; }

  /* APPS entries are simple object literals in the inline script */
  const entries = [];
  for (const m of src.matchAll(/\{\s*\n?\s*name:\s*"([^"]+)"[\s\S]*?\n\s*\}/g)) {
    const blob = m[0];
    const href = (blob.match(/href:\s*"([^"]+)"/) || [])[1];
    const key = (blob.match(/key:\s*"([^"]+)"/) || [])[1];
    if (href || key) entries.push({ name: m[1], href, key, index: m.index });
  }
  if (!entries.length) { fail(name, "could not parse the APPS array out of index.html"); return { keys: new Map() }; }

  const keys = new Map();
  for (const e of entries) {
    if (!e.href) { fail(name, `APPS["${e.name}"] has no href`); continue; }
    const target = resolve(ROOT, e.href.replace(/^\.\//, ""));
    if (!existsSync(target)) fail(name, `APPS["${e.name}"].href -> ${e.href} does not exist on disk`);
    if (!/index\.html$/.test(e.href)) warn(name, `APPS["${e.name}"].href does not point at an index.html: ${e.href}`);
    if (!e.key) { warn(name, `APPS["${e.name}"] has no progress key`); continue; }
    if (keys.has(e.key)) fail(name, `APPS progress key "${e.key}" is used by both ${keys.get(e.key)} and ${e.name}`);
    else keys.set(e.key, e.name);
  }
  pass(name, `APPS: ${entries.length} card(s), all href targets exist, ${keys.size} unique progress key(s)`);

  /* an academy on disk that the hub never links is unreachable from the hub */
  const linked = new Set(entries.map((e) => (e.href || "").replace(/^\.\//, "").split("/")[0]));
  for (const a of apps) {
    if (!a.hasShell) continue;
    if (!linked.has(a.dir)) warn(name, `${a.dir} exists but no APPS card links to it — unreachable from the hub`);
  }
  return { keys };
}

/* ---- gate 1: hrefs in HTML ---- */
function checkHtml(appName, htmlPath, model, soft) {
  const report = soft ? warn : fail;
  const src = read(htmlPath);
  if (!src) { fail(appName, `${rel(htmlPath)} missing`); return; }
  const ids = scanHtmlIds(src);
  const base = dirname(htmlPath);
  let bad = 0, n = 0;

  for (const { href, index } of scanHtmlHrefs(src)) {
    const where = `${rel(htmlPath)}:${lineAt(src, index)}`;
    if (!href || href === "#") { warn(appName, `${where}: empty href`); continue; }
    if (/^(data|mailto|tel|javascript):/i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      if (!EXTERNAL_OK.test(href)) { fail(appName, `${where}: external URL ${href}`); bad++; }
      continue;
    }
    n++;
    if (href.startsWith("#/")) {
      if (!model) { warn(appName, `${where}: hash route ${href} but no route model for this app`); continue; }
      const v = classify(model, href);
      if (!v.ok) { report(appName, `${where}: dangling route ${href} — ${v.why}`); bad++; }
      else if (v.warn) warn(appName, `${where}: ${href} — ${v.warn}`);
      continue;
    }
    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (!ids.has(id)) { fail(appName, `${where}: anchor ${href} has no matching id in ${rel(htmlPath)}`); bad++; }
      continue;
    }
    const target = resolve(base, href.split("#")[0].split("?")[0]);
    if (!existsSync(target)) { fail(appName, `${where}: link ${href} does not resolve on disk`); bad++; }
  }
  if (!bad) pass(appName, `${rel(htmlPath)}: ${n} internal link(s) all resolve`);
}

/* ---- gate 2: route literals in JS ---- */
function checkJsRoutes(appName, jsFiles, model, soft) {
  const report = soft ? warn : fail;
  let bad = 0, total = 0;
  const seen = new Set();
  for (const p of jsFiles) {
    const src = readFileSync(p, "utf8");
    for (const { route, index } of scanRouteLiterals(src)) {
      if (!route.startsWith("#/")) {
        /* a plain #anchor inside authored HTML: cannot resolve statically to a
         * lesson heading without knowing which lesson it sits in, so only the
         * obviously-broken empty form is flagged */
        if (route === "#") { warn(appName, `${rel(p)}:${lineAt(src, index)}: empty anchor href`); }
        continue;
      }
      total++;
      const v = classify(model, route);
      if (v.ok) { if (v.warn) warnOnce(appName, `${rel(p)}:${lineAt(src, index)}: ${route} — ${v.warn}`); continue; }
      const sig = `${rel(p)}|${route}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      report(appName, `${rel(p)}:${lineAt(src, index)}: dangling route ${route} — ${v.why}`);
      bad++;
    }
  }
  if (!bad) pass(appName, `${total} route reference(s) across ${jsFiles.length} JS file(s) all resolve`);
  else if (soft) warn(appName, `${bad} dangling route(s) held as warnings until content lands`);
  return bad;
}

const warnedOnce = new Set();
function warnOnce(app, msg) {
  const key = app + "|" + msg;
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  warn(app, msg);
}

/* ---- gate 7: links into sibling academies ---- */
const ALL_APPS = new Map(discoverApps().map((a) => [a.dir, a]));
function modelFor(dir) {
  if (models.has(dir)) return models.get(dir).model;
  const a = ALL_APPS.get(dir);
  if (!a || !a.hasShell) return null;
  const content = loadContent(a);
  const model = buildRouteModel(a, content && content.sandbox, read(a.appJs));
  models.set(dir, { app: a, content, model });
  return model;
}
function checkCrossApp(appName, files) {
  let bad = 0, n = 0;
  for (const p of files) {
    const src = readFileSync(p, "utf8");
    for (const m of src.matchAll(/\.\.\/([a-z0-9-]+-academy)\/index\.html(#\/[A-Za-z0-9\-_/]*)?/g)) {
      n++;
      const [, dir, hash] = m;
      const where = `${rel(p)}:${lineAt(src, m.index)}`;
      const target = modelFor(dir);
      if (!target) { fail(appName, `${where}: links to ${dir}, which is not an academy on disk`); bad++; continue; }
      if (!hash) continue;
      const v = target.classify(hash);
      if (!v.ok) { fail(appName, `${where}: dangling cross-academy link ${dir}${hash} — ${v.why}`); bad++; }
    }
  }
  if (!bad) pass(appName, `${n} cross-academy link(s) all resolve`);
}

/* ---- gate 5: hub backlink ---- */
function checkBacklink(appName, htmlPath) {
  const src = read(htmlPath);
  if (!src) return;
  const back = [...src.matchAll(/\shref="(\.\.\/[^"]*)"/g)].map((m) => m[1]);
  const toHub = back.filter((h) => /^\.\.\/(index\.html)?$/.test(h) || h === "../index.html");
  if (!toHub.length) { fail(appName, "no link back to the hub (expected href=\"../index.html\")"); return; }
  const target = resolve(dirname(htmlPath), toHub[0]);
  if (!existsSync(target)) fail(appName, `hub backlink ${toHub[0]} does not resolve to a file`);
  else pass(appName, `links back to the hub (${toHub[0]})`);
}

/* ---- gate 6: external URLs across all files ---- */
function checkExternal(appName, files) {
  let bad = 0;
  for (const p of files) {
    const src = readFileSync(p, "utf8");
    const hit = externalHit(src);
    if (hit) { fail(appName, `${rel(p)}: external URL ${hit.url}`); bad++; }
  }
  if (!bad) pass(appName, `no external URLs in ${files.length} file(s)`);
}

/* ---------------------------------------------------------------- self-test
 * A checker that silently stops detecting is worse than no checker. These
 * assertions pin the two pieces of logic that already produced a false result
 * once: the route-literal scanner (which used to flag `"#/print/" + tr.id`
 * concatenation prefixes) and the route classifier.
 */
function selftest() {
  let bad = 0;
  const ok = (cond, what) => { if (cond) console.log(`ok   [selftest] ${what}`); else { console.log(`FAIL [selftest] ${what}`); bad++; } };

  const routesIn = (src) => scanRouteLiterals(src).map((h) => h.route);
  ok(routesIn(`x = "#/hld/foundations/estimation";`).includes("#/hld/foundations/estimation"),
    "picks up a plain route literal");
  ok(!routesIn(`location.hash = "#/print/" + tr.id;`).length,
    "ignores a concatenation prefix (\"#/print/\" + tr.id)");
  ok(routesIn(`html: "see <a href='#/glossary/saga'>saga</a>"`).includes("#/glossary/saga"),
    "picks up a route inside authored HTML");
  ok(routesIn(`{ route: "#/scenarios" }`).includes("#/scenarios"),
    "picks up a practice-content route field");

  const sandbox = makeSandboxWith({
    TRACKS: { hld: { id: "hld", modules: [{ id: "m", lessons: [{ id: "l", blocks: [{ t: "h", text: "Pick a Shard Key" }] }] }] } },
    DemoPractice: { glossary: [{ id: "saga" }], rubrics: [{ id: "senior" }] },
  });
  const routerSrc = `function route(){ const parts=[];
    if (parts[0] === "paths") { renderPaths(); }
    else if (["scenarios","glossary","rubrics"].includes(parts[0])) { refs(parts[0], parts[1]); }
    else if (parts[0] === "practice") { p({mode: parts[1]}); }
    else if (parts[0] === "review") { renderReview(); }
    else if (parts[0] === "print" && parts[1]) { renderPrint(parts[1]); } }`;
  const m = buildRouteModel({ dir: "demo" }, sandbox, routerSrc);
  m.headingSlugs = headingSlugIndex(m.tracks);

  const cases = [
    ["#/", true], ["#/hld/m/l", true], ["#/hld", true],
    ["#/hld/m/nope", false], ["#/nope/m/l", false],
    ["#/paths", true], ["#/review", true], ["#/review/extra", false],
    ["#/print/hld", true], ["#/print/nope", false], ["#/print", false],
    ["#/practice/weak", true], ["#/practice/bogus", false],
    ["#/glossary/saga", true], ["#/glossary/nope", false],
    ["#/rubrics/senior", true],
    ["#/hld/m/l/pick-a-shard-key", true], ["#/hld/m/l/not-a-heading", false],
    ["#/attack-lab", false],
  ];
  for (const [route, want] of cases) {
    const got = classify(m, route).ok;
    ok(got === want, `classify ${route} -> ${want ? "valid" : "dangling"}`);
  }
  console.log(`\n${bad ? "FAILED" : "PASSED"}: self-test ${bad ? bad + " assertion(s) failed" : "all assertions hold"}.`);
  process.exit(bad ? 1 : 0);
}

/** a bare sandbox seeded with fixture globals, for the self-test only */
function makeSandboxWith(globals) {
  const sb = { document: { createElement: () => ({}) } };
  return Object.assign(sb, globals);
}

if (argv.includes("--selftest")) selftest();

/* ------------------------------------------------------------------- drive */

console.log("── hub ──");
const hub = checkHub();
checkHtml("hub", hubApp().indexHtml, null);
checkExternal("hub", [hubApp().indexHtml, join(ROOT, "sw.js")].filter(existsSync));

const prefixOwners = new Map();

for (const app of apps) {
  console.log(`\n── ${app.name} (${app.dir}) ──`);
  if (!app.hasShell) { warn(app.name, "no index.html + js/app.js yet — skipped"); continue; }

  const entry = models.get(app.dir);
  const model = entry.model;
  if (entry.content && entry.content.errors.length) {
    for (const e of entry.content.errors) fail(app.name, `content file failed to load: ${e}`);
  }
  /* An app whose shell exists but which registers no tracks is mid-authoring:
   * every lesson route its app.js references is dangling by definition. Those
   * become real failures the moment the first track lands. */
  const soft = !model.tracks.length;
  if (soft) {
    warn(app.name, "shell present but no tracks registered yet — route failures held as warnings");
  } else {
    pass(app.name, `${model.tracks.length} track(s), ${model.lessons.length} lesson route(s), ${model.features.size} feature route(s)`);
  }

  const jsFiles = walkJs(join(app.path, "js"));
  checkHtml(app.name, app.indexHtml, model, soft);
  checkJsRoutes(app.name, [...jsFiles, app.indexHtml], model, soft);
  checkBacklink(app.name, app.indexHtml);
  checkCrossApp(app.name, [...jsFiles, app.indexHtml]);
  checkExternal(app.name, [app.indexHtml, join(app.path, "sw.js"), ...jsFiles].filter(existsSync));

  /* gate 4: localStorage prefix ownership */
  const keySrc = [app.appJs, join(app.path, "js", "exam.js"), join(app.path, "js", "flashcards.js")]
    .filter(existsSync).map((p) => readFileSync(p, "utf8")).join("\n");
  const keys = [...storageKeys(keySrc)].filter((k) => /_(v\d+|theme|draft|history|bank)/.test(k) || /^[a-z]{2,4}_[a-z]+$/.test(k));
  const prefixes = new Set(keys.map((k) => k.slice(0, k.indexOf("_") + 1)));
  for (const pfx of prefixes) {
    if (prefixOwners.has(pfx) && prefixOwners.get(pfx) !== app.name) {
      fail(app.name, `localStorage prefix "${pfx}" also used by ${prefixOwners.get(pfx)} — one origin, so progress would mix`);
    } else prefixOwners.set(pfx, app.name);
  }
  if (!prefixes.size) warn(app.name, "no localStorage keys found — progress is probably not persisted");
  else pass(app.name, `localStorage prefix ${[...prefixes].join(", ")} (${keys.length} key(s))`);

  /* the hub's progress key must be one this app actually writes */
  for (const [k, owner] of hub.keys) {
    if (owner !== app.name) continue;
    if (!keys.includes(k)) fail(app.name, `hub reads progress from "${k}" but this app never writes that key (writes: ${keys.join(", ")})`);
  }
}

console.log(`\n${fails ? "FAILED" : "PASSED"}: ${fails} failure(s), ${warns} warning(s), ${checks} check group(s) passed.`);
process.exit(fails ? 1 : 0);
