#!/usr/bin/env node
/*
 * Atlas static guardrail lint (no dependencies).
 *
 * For every app (21 sub-apps + hub) it checks the things that silently break a
 * fully-offline static PWA collection:
 *   - every sw.js CORE precache entry points at a file that exists
 *     (Cache.addAll is all-or-nothing: one missing entry kills the whole SW)
 *   - every <script src> / <link rel=stylesheet> in index.html exists
 *   - every JS/CSS asset in index.html is precached in CORE (warning)
 *   - every @font-face url("../fonts/..") exists and is precached (warning)
 *   - each app has a CACHE constant and cache names are unique across apps
 *   - manifest.webmanifest is valid JSON (when present)
 *   - no external http(s) URLs except the W3C SVG ns, .example, localhost
 *
 * Usage:  node tools/lint_static.mjs
 * Exit code is non-zero if any FAIL is found.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = [
  { name: "hub", dir: ROOT },
  { name: "Blueprint", dir: join(ROOT, "hld-lld-academy") },
  { name: "Codex", dir: join(ROOT, "dsa-patterns-academy") },
  { name: "Citadel", dir: join(ROOT, "cyber-academy") },
  { name: "Cascade", dir: join(ROOT, "data-eng-academy") },
  { name: "TechLead", dir: join(ROOT, "techno-managerial-academy") },
  { name: "Compass", dir: join(ROOT, "behavioral-academy") },
  { name: "Synapse", dir: join(ROOT, "ml-ai-academy") },
  { name: "Forge", dir: join(ROOT, "devsecops-academy") },
  { name: "Lumen", dir: join(ROOT, "llm-academy") },
  { name: "Glacier", dir: join(ROOT, "snowflake-academy") },
  { name: "Nimbus", dir: join(ROOT, "cloud-academy") },
  { name: "Beacon", dir: join(ROOT, "sre-academy") },
  { name: "Ledger", dir: join(ROOT, "db-internals-academy") },
  { name: "Kernel", dir: join(ROOT, "linux-net-academy") },
  { name: "Anvil", dir: join(ROOT, "java-backend-academy") },
  { name: "Orbit", dir: join(ROOT, "salesforce-academy") },
  { name: "Pixel", dir: join(ROOT, "frontend-academy") },
  { name: "Chisel", dir: join(ROOT, "software-craft-academy") },
  { name: "Pyxis", dir: join(ROOT, "python-academy") },
  { name: "Summit", dir: join(ROOT, "certification-academy") },
  { name: "Pulse", dir: join(ROOT, "streaming-academy") },
];

let fails = 0;
let warns = 0;
const cacheNames = new Map();

const fail = (app, msg) => { console.log(`FAIL [${app}] ${msg}`); fails++; };
const warn = (app, msg) => { console.log(`warn [${app}] ${msg}`); warns++; };
const pass = (app, msg) => console.log(`ok   [${app}] ${msg}`);

function read(p) { return existsSync(p) ? readFileSync(p, "utf8") : null; }

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function resolveCore(appDir, entry) {
  let rel = entry.replace(/^\.\//, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  return join(appDir, rel);
}

function extractCore(sw) {
  const m = sw.match(/const CORE\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/*
 * Borrowed vocabulary (docs/ENGINE_SPEC.md rule 9).
 *
 * A coined framework name or recurring section heading lifted from a commercial
 * course is borrowed even when every sentence under it is original, and it
 * spreads silently: a phrase in a build brief becomes a heading in twenty
 * lessons, then a module name, then a route slug. 216 instances had to be
 * renamed by hand once. These patterns are the ones that cost that cleanup, so
 * they are checked rather than trusted.
 *
 * Each entry is anchored enough to be unambiguous — a bare "bad" or "good" is
 * ordinary English and is deliberately not matched. Add a row here whenever a
 * row is added to the vocabulary table in the spec.
 */
const BORROWED = [
  [/\bBad\s*(?:\/|\u2192|->|,|\bto\b)\s*Good\s*(?:\/|\u2192|->|,|\band\b)?\s*Great\b/i, "graded ladder", "Naive / Solid / Standout"],
  [/what(?:'|\u2019)?s expected at each level/i, "level rubric heading", "How this scores at each level"],
  [/when do I use this\??/i, "pattern-recognition cue", "Spotting it in a prompt"],
  [/\bCARL\b(?!\w)/, "four-beat answer structure", "SALT (Setup, Actions, Landing, Takeaway)"],
  [/\bmenu technique\b/i, "story pre-indexing", "the story shortlist"],
  [/\bwe[- ]disease\b/i, "first-person-plural narration problem", 'the missing "I"'],
  [/\bdelivery framework\b/i, "named phase framework", "the phase plan"],
  [/\bSTAR method\b/i, "four-beat answer structure", "SALT (Setup, Actions, Landing, Takeaway)"],
  /* the label, not the verb — "interviewers recognise it instantly" is ordinary
     English and must keep passing, so this only matches the quoted block name */
  [/["'\u201c\u2018]recogni[sz]e it["'\u201d\u2019]\s*callout/i, "cue block description", '"spotting it" callout'],
];

/*
 * Ladders and mnemonics checked as *values* rather than as one adjacent string.
 *
 * The patterns above only fire when the borrowed words sit next to each other in
 * a single string. That is exactly how 175 rubric cells and 23 headings survived
 * both a green lint and a clean `git grep`: `Bad`, `Good` and `Great` were each
 * their own table cell or their own heading, so nothing in the source ever held
 * them adjacent — the renderer is what put the rungs side by side. A ladder is
 * still a ladder when the markup is what assembles it.
 *
 * So a rung is matched only when it is the *whole* value of a cell, heading or
 * list item. "a bad trade-off" is ordinary English and never matches; a cell
 * containing exactly "Bad" does. Every value in a set must appear before it
 * fails, which is what keeps the `compare` block's own `bad:`/`good:` field
 * names — which have no `great` — from tripping it.
 *
 * Add a row here whenever a row is added to the vocabulary table in the spec and
 * the borrowed device is a set of rungs rather than a single phrase.
 */
const BORROWED_SETS = [
  { values: ["Bad", "Good", "Great"], concept: "graded ladder", ours: "Naive / Solid / Standout" },
  { values: ["Situation", "Task", "Action", "Result"], concept: "four-beat answer structure", ours: "SALT (Setup, Actions, Landing, Takeaway)" },
  { values: ["Context", "Action", "Result", "Learning"], concept: "four-beat answer structure", ours: "SALT (Setup, Actions, Landing, Takeaway)" },
];

/*
 * Scoped to a window rather than the whole file: a window this size spans any
 * one lesson's blocks, so it still catches rungs split across separate headings,
 * while a 2,000-line curriculum file cannot fail by accumulating four unrelated
 * one-word cells in four unrelated lessons.
 */
const SET_WINDOW_LINES = 200;

/** strip the markup a cell or heading value can legitimately carry */
function bareValue(s) {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/[*_`~]/g, "")
    .trim()
    .replace(/[:.,;\u2014-]+$/, "")
    .trim();
}

/*
 * Every place a value can stand on its own. In content files that is any string
 * literal, because `headers:`, `rows:` and `{t:"h", text}` are all built from
 * them; in markdown it is additionally a table cell and an ATX heading.
 */
function standaloneValues(text, isMarkdown) {
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)) {
      out.push({ value: bareValue(m[1] !== undefined ? m[1] : m[2]), line: i + 1 });
    }
    if (!isMarkdown) continue;
    if (line.includes("|")) for (const cell of line.split("|")) out.push({ value: bareValue(cell), line: i + 1 });
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (heading) out.push({ value: bareValue(heading[1]), line: i + 1 });
  }
  return out;
}

/** smallest line span containing every value in the set, or null */
function setSpan(occurrences, values) {
  const need = values.length;
  const seen = new Map();
  let distinct = 0, lo = 0;
  for (let hi = 0; hi < occurrences.length; hi++) {
    const v = occurrences[hi].value;
    seen.set(v, (seen.get(v) || 0) + 1);
    if (seen.get(v) === 1) distinct++;
    while (occurrences[hi].line - occurrences[lo].line > SET_WINDOW_LINES) {
      const out = occurrences[lo].value;
      seen.set(out, seen.get(out) - 1);
      if (seen.get(out) === 0) distinct--;
      lo++;
    }
    if (distinct === need) {
      const span = occurrences.slice(lo, hi + 1);
      return { from: span[0].line, to: span[span.length - 1].line };
    }
  }
  return null;
}

/** every borrowed *set* assembled out of separate values, with its line span */
function borrowedSetHits(text, isMarkdown) {
  const values = standaloneValues(text, isMarkdown);
  const hits = [];
  for (const set of BORROWED_SETS) {
    const wanted = new Set(set.values.map((v) => v.toLowerCase()));
    const occurrences = values
      .filter((v) => wanted.has(v.value.toLowerCase()))
      .map((v) => ({ line: v.line, value: v.value.toLowerCase() }))
      .sort((a, b) => a.line - b.line);
    const span = setSpan(occurrences, set.values);
    if (!span) continue;
    hits.push({
      concept: set.concept,
      ours: set.ours,
      found: set.values.join(" / "),
      line: span.from,
      shape: span.to - span.from <= 2 ? "as separate cells in one block" : "as separate cells or headings",
      span: span.from === span.to ? `line ${span.from}` : `lines ${span.from}-${span.to}`,
    });
  }
  return hits;
}

/** every borrowed-vocabulary hit in one file, with line numbers */
function borrowedHits(text) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const [re, concept, ours] of BORROWED) {
      const m = lines[i].match(re);
      if (m) hits.push({ line: i + 1, found: m[0], concept, ours });
    }
  }
  return hits;
}

function hasExternal(text) {
  const cleaned = text
    .replace(/https?:\/\/(www\.)?w3\.org[^\s"')]*/g, "")
    .replace(/https?:\/\/[a-z0-9.-]*\.example[^\s"')]*/gi, "")
    .replace(/https?:\/\/(localhost|127\.0\.0\.1)[^\s"')]*/g, "");
  const m = cleaned.match(/https?:\/\/[^\s"')]+/);
  return m ? m[0] : null;
}

for (const app of APPS) {
  const { name, dir } = app;
  const indexPath = join(dir, "index.html");
  const swPath = join(dir, "sw.js");
  const index = read(indexPath);
  const sw = read(swPath);
  if (!index) { fail(name, "missing index.html"); continue; }
  if (!sw) { fail(name, "missing sw.js"); continue; }

  // cache name + uniqueness
  const cm = sw.match(/const CACHE\s*=\s*"([^"]+)"/);
  if (!cm) fail(name, "sw.js has no CACHE constant");
  else {
    if (cacheNames.has(cm[1])) fail(name, `cache name "${cm[1]}" collides with ${cacheNames.get(cm[1])}`);
    else { cacheNames.set(cm[1], name); pass(name, `cache ${cm[1]}`); }
  }

  // CORE entries exist
  const core = extractCore(sw) || [];
  if (!core.length) warn(name, "sw.js CORE array empty or unparsed");
  let missing = 0;
  for (const entry of core) {
    if (/^https?:/.test(entry)) { fail(name, `CORE has external URL ${entry}`); continue; }
    if (!existsSync(resolveCore(dir, entry))) { fail(name, `CORE entry missing on disk: ${entry}`); missing++; }
  }
  if (!missing && core.length) pass(name, `${core.length} CORE entries all exist`);

  // index.html assets exist + precached
  const assets = [
    ...[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ...[...index.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]),
  ].filter((a) => !/^https?:|^data:/.test(a));
  for (const a of assets) {
    if (!existsSync(join(dir, a.replace(/^\.\//, "")))) fail(name, `index asset missing on disk: ${a}`);
    const norm = a.startsWith("./") ? a : "./" + a;
    if (core.length && !core.includes(norm) && !core.includes(a)) warn(name, `index asset not precached in CORE: ${a}`);
  }

  // @font-face references
  const css = read(join(dir, "css", "styles.css"));
  if (css) {
    for (const m of css.matchAll(/url\("\.\.\/(fonts\/[^"]+)"\)/g)) {
      const fp = join(dir, m[1]);
      if (!existsSync(fp)) fail(name, `@font-face references missing file: ${m[1]}`);
      else if (core.length && !core.includes("./" + m[1])) warn(name, `font not precached in CORE: ./${m[1]}`);
    }
  }

  // manifest JSON valid
  const manPath = join(dir, "manifest.webmanifest");
  if (existsSync(manPath)) {
    try { JSON.parse(readFileSync(manPath, "utf8")); pass(name, "manifest JSON valid"); }
    catch (e) { fail(name, "manifest.webmanifest invalid JSON: " + e.message); }
  }

  // external URL scan over html/js/css
  const scanFiles = [indexPath, swPath, ...walk(join(dir, "js")), ...walk(join(dir, "css"))]
    .filter((p) => /\.(html|js|mjs|css)$/.test(p) && existsSync(p));
  let ext = 0, borrowed = 0;
  for (const p of scanFiles) {
    const text = readFileSync(p, "utf8");
    const hit = hasExternal(text);
    if (hit) { fail(name, `external URL in ${p.replace(ROOT + "/", "")}: ${hit}`); ext++; }
    for (const b of borrowedHits(text)) {
      fail(name, `borrowed vocabulary in ${p.replace(ROOT + "/", "")}:${b.line}: ` +
        `"${b.found}" (${b.concept}) — the house wording is "${b.ours}", see the vocabulary table in docs/ENGINE_SPEC.md`);
      borrowed++;
    }
    for (const b of borrowedSetHits(text, false)) {
      fail(name, `borrowed vocabulary in ${p.replace(ROOT + "/", "")}:${b.line}: ` +
        `"${b.found}" (${b.concept}) ${b.shape}, ${b.span} — the house wording is ` +
        `"${b.ours}", see the vocabulary table in docs/ENGINE_SPEC.md`);
      borrowed++;
    }
  }
  if (!ext) pass(name, "no disallowed external URLs");
  if (!borrowed) pass(name, "no borrowed vocabulary");
}

/*
 * The spec and the scaffold inputs get the same scan. This is where the last
 * round leaked from: the content was renamed but docs/ still specified the
 * borrowed terms as the house convention, so the next scaffolded app would have
 * re-seeded all of it.
 */
{
  const docs = walk(join(ROOT, "docs")).filter((p) => /\.(md|json)$/.test(p));
  let borrowed = 0;
  for (const p of docs) {
    const text = readFileSync(p, "utf8");
    for (const b of borrowedHits(text)) {
      /* the vocabulary table itself names what it is replacing */
      if (/ENGINE_SPEC\.md$/.test(p) && /\*\*/.test(b.found) === false && b.line < 60) continue;
      fail("docs", `borrowed vocabulary in ${p.replace(ROOT + "/", "")}:${b.line}: ` +
        `"${b.found}" (${b.concept}) — the house wording is "${b.ours}"`);
      borrowed++;
    }
    for (const b of borrowedSetHits(text, /\.md$/.test(p))) {
      fail("docs", `borrowed vocabulary in ${p.replace(ROOT + "/", "")}:${b.line}: ` +
        `"${b.found}" (${b.concept}) ${b.shape}, ${b.span} — the house wording is "${b.ours}"`);
      borrowed++;
    }
  }
  if (!borrowed) pass("docs", `no borrowed vocabulary across ${docs.length} spec/scaffold file(s)`);
}

console.log(`\n${fails ? "FAILED" : "PASSED"}: ${fails} failure(s), ${warns} warning(s) across ${APPS.length} apps.`);
process.exit(fails ? 1 : 0);
