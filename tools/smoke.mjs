#!/usr/bin/env node
/*
 * Atlas headless boot-smoke (no npm deps; uses the system Chrome via CDP).
 *
 * Loads the hub + all 21 apps (plus feature views such as Citadel Attack Lab,
 * the TechLead quiz and the simulators/labs)
 * and asserts each view renders real content with zero console errors /
 * uncaught exceptions. Complements tools/lint_static.mjs (static) with a
 * runtime check.
 *
 * Prereqs (kept out of this script so it stays dependency-free):
 *   1. Serve the repo root:   python3 -m http.server 8780 --directory .
 *   2. Start headless Chrome: \
 *      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *        --headless=new --disable-gpu --disable-ipc-flooding-protection \
 *        --remote-debugging-port=9240 \
 *        --user-data-dir=.chrome-smoke about:blank
 *   3. node tools/smoke.mjs
 *
 * Env overrides: SMOKE_BASE (default http://127.0.0.1:8780),
 *                SMOKE_CDP  (default http://127.0.0.1:9240)
 */
const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:8780";
const CDP = process.env.SMOKE_CDP || "http://127.0.0.1:9240";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = [
  { name: "hub", url: BASE + "/index.html", sel: "#groups" },
  { name: "Blueprint", url: BASE + "/hld-lld-academy/index.html#/", sel: "#main" },
  { name: "Codex", url: BASE + "/dsa-patterns-academy/index.html#/", sel: "#main" },
  { name: "Citadel", url: BASE + "/cyber-academy/index.html#/", sel: "#main" },
  { name: "Citadel-attacklab", url: BASE + "/cyber-academy/index.html#/attack-lab", sel: "#main" },
  { name: "Cascade", url: BASE + "/data-eng-academy/index.html#/", sel: "#main" },
  { name: "TechLead", url: BASE + "/techno-managerial-academy/index.html#/", sel: "#main" },
  { name: "TechLead-quiz", url: BASE + "/techno-managerial-academy/index.html#/quiz", sel: "#main" },
  { name: "Forge", url: BASE + "/devsecops-academy/index.html#/", sel: "#main" },
  { name: "Forge-simulator", url: BASE + "/devsecops-academy/index.html#/simulator", sel: "#main" },
  { name: "Lumen", url: BASE + "/llm-academy/index.html#/", sel: "#main" },
  { name: "Lumen-playground", url: BASE + "/llm-academy/index.html#/playground", sel: "#main" },
  { name: "Glacier", url: BASE + "/snowflake-academy/index.html#/", sel: "#main" },
  { name: "Nimbus", url: BASE + "/cloud-academy/index.html#/", sel: "#main" },
  { name: "Nimbus-servicemap", url: BASE + "/cloud-academy/index.html#/servicemap", sel: "#main" },
  { name: "Beacon", url: BASE + "/sre-academy/index.html#/", sel: "#main" },
  { name: "Beacon-simulator", url: BASE + "/sre-academy/index.html#/simulator", sel: "#main" },
  { name: "Ledger", url: BASE + "/db-internals-academy/index.html#/", sel: "#main" },
  { name: "Ledger-lab", url: BASE + "/db-internals-academy/index.html#/lab", sel: "#main" },
  { name: "Kernel", url: BASE + "/linux-net-academy/index.html#/", sel: "#main" },
  { name: "Kernel-simulator", url: BASE + "/linux-net-academy/index.html#/simulator", sel: "#main" },
  { name: "Anvil", url: BASE + "/java-backend-academy/index.html#/", sel: "#main" },
  { name: "Orbit", url: BASE + "/salesforce-academy/index.html#/", sel: "#main" },
  { name: "Pixel", url: BASE + "/frontend-academy/index.html#/", sel: "#main" },
  { name: "Chisel", url: BASE + "/software-craft-academy/index.html#/", sel: "#main" },
  { name: "Pyxis", url: BASE + "/python-academy/index.html#/", sel: "#main" },
  { name: "Summit", url: BASE + "/certification-academy/index.html#/", sel: "#main" },
  { name: "Summit-exam", url: BASE + "/certification-academy/index.html#/exam", sel: "#main" },
  { name: "Summit-plans", url: BASE + "/certification-academy/index.html#/plans", sel: "#main" },
  { name: "Summit-readiness", url: BASE + "/certification-academy/index.html#/readiness", sel: "#main" },
  { name: "Pulse", url: BASE + "/streaming-academy/index.html#/", sel: "#main" },
];

const main = async () => {
  const tabs = await (await fetch(CDP + "/json")).json();
  const tab = tabs.find((t) => t.type === "page");
  if (!tab) throw new Error("No Chrome page target; is Chrome running with --remote-debugging-port?");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); let errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      errors.push("exception: " + ((d.exception && d.exception.description) || d.text));
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push("console.error: " + m.params.args.map((a) => a.value || a.description || "").join(" "));
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise((r) => { const cid = ++id; pending.set(cid, r); ws.send(JSON.stringify({ id: cid, method, params })); });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });

  const results = [];
  for (const t of targets) {
    errors = [];
    await send("Page.navigate", { url: t.url });
    await sleep(1100);
    const expr = `(function(){var e=document.querySelector(${JSON.stringify(t.sel)});return e?e.textContent.trim().length:-1;})()`;
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    const len = (r.result && r.result.result && r.result.result.value) || -2;
    results.push({ name: t.name, rendered: len > 20, len, errors: errors.slice(0, 3) });
  }
  ws.close();
  const bad = results.filter((r) => !r.rendered || r.errors.length);
  for (const r of results) console.log(`${r.rendered && !r.errors.length ? "ok  " : "FAIL"} ${r.name} (len=${r.len}${r.errors.length ? ", errors=" + r.errors.length : ""})`);
  console.log(`\n${bad.length ? "FAILED" : "PASSED"}: ${bad.length} of ${results.length} views had problems.`);
  process.exit(bad.length ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
