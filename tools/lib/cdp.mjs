/*
 * Minimal Chrome DevTools Protocol client — no dependencies, just fetch and the
 * platform WebSocket.
 *
 * Extracted from crawl_e2e.mjs so the end-to-end crawl and the UI sweep share
 * one client. Two copies of this would drift, and a fix to the navigation race
 * below would silently land in only one gate.
 *
 * Prereqs (both gates assume these are already listening):
 *   python3 -m http.server 8780 --directory .
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     --headless=new --disable-gpu --no-first-run --no-default-browser-check \
 *     --remote-debugging-port=9240 --user-data-dir=/tmp/atlas-chrome-smoke about:blank
 */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Exit code for "the browser or the connection let us down", kept distinct from
 * 1 (content failed) and 2 (bad usage).
 *
 * A gate that reports a harness problem as a content failure — or worse, exits
 * quietly after the page stops answering — teaches people to rerun until green,
 * which is strictly worse than having no gate. Everything raised from this
 * module is tagged so the callers can say which of the two happened.
 */
export const HARNESS_FAULT = 3;

export function fault(message) {
  const e = new Error(message);
  e.harnessFault = true;
  return e;
}

/**
 * Wall-clock ceiling for a whole run. The per-command timeout catches a page
 * that stops answering; this catches the other shape of the same problem, where
 * every individual call answers but the run as a whole has stopped making
 * progress. Exits with the harness-fault code rather than hanging a CI job.
 */
export function startDeadline(ms, gate) {
  const t = setTimeout(() => {
    reportFault(fault(`the run passed its ${Math.round(ms / 1000)}s ceiling without finishing`), gate);
    process.exit(HARNESS_FAULT);
  }, ms);
  t.unref();                 // never keep the process alive on its own account
  return () => clearTimeout(t);
}

/** one place to print the distinction, so both gates word it identically */
export function reportFault(e, gate) {
  console.error(
    `\nHARNESS FAULT — not a content failure.\n` +
    `${gate} could not finish because the test harness itself failed:\n` +
    `  ${e && e.message ? e.message : e}\n\n` +
    `Nothing has been proven about the content either way. Do not treat this as a pass\n` +
    `or a fail: fix the harness and rerun. Usual causes are a dead static server, a\n` +
    `Chrome that was killed or wedged, or a page that stopped answering the protocol.\n` +
    `Chrome must be launched WITHOUT any Emulation viewport override — one of those\n` +
    `pinned this browser's process at 100% CPU past the end of a run and made every\n` +
    `later attach hang; use --window-size on the command line instead.`);
}

export class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];          // console / exception / network problems
    this.closed = null;
    this.ws.onmessage = (e) => this.#onMessage(JSON.parse(e.data));
    /*
     * Without this, a target that goes away leaves every in-flight promise
     * unsettled with no handle keeping the loop alive, so Node exits 0 in the
     * middle of a gate and reports a pass by omission. Fail loudly instead.
     */
    this.ws.onclose = () => {
      this.closed = fault("the DevTools connection closed mid-run — the page or the browser went away");
      for (const { rej } of this.pending.values()) rej(this.closed);
      this.pending.clear();
    };
  }

  static async attach(cdpBase) {
    let tabs;
    try {
      tabs = await (await fetch(cdpBase + "/json")).json();
    } catch (e) {
      throw fault(
        `cannot reach the DevTools endpoint at ${cdpBase} (${e.message}).\n` +
        `  Start Chrome with --remote-debugging-port, and remember loopback to that port\n` +
        `  needs to run outside the sandbox.`);
    }
    const tab = tabs.find((t) => t.type === "page");
    if (!tab) throw fault("no Chrome page target — launch Chrome with about:blank");
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(fault("websocket to the page target failed: " + e.message)); });
    const s = new Session(ws);
    await s.send("Page.enable");
    await s.send("Runtime.enable");
    await s.send("Log.enable");
    await s.send("Network.enable");
    await s.send("Network.setCacheDisabled", { cacheDisabled: true });
    /* the apps register a service worker; without this a gate can be served a
     * stale precache and silently test yesterday's content */
    await s.send("Network.setBypassServiceWorker", { bypass: true }).catch(() => {});
    return s;
  }

  #onMessage(m) {
    if (m.id && this.pending.has(m.id)) {
      const { res } = this.pending.get(m.id);
      this.pending.delete(m.id);
      res(m);
      return;
    }
    const p = m.params || {};
    /*
     * A native confirm()/alert() blocks the renderer until something answers
     * it, and nothing does when the driver is a script: every later evaluate
     * then times out and the run dies looking like a wedged browser. The apps
     * do have confirm() behind "reset progress" and "import backup", which a
     * stray keystroke can reach, so dismiss dialogs immediately and record it —
     * a dialog the gate did not ask for is itself worth reporting.
     */
    if (m.method === "Inspector.targetCrashed") {
      /* the renderer died: everything after this is meaningless, and the
       * pending calls would otherwise sit until their timeout */
      this.closed = fault("the page's renderer crashed mid-run");
      for (const { rej } of this.pending.values()) rej(this.closed);
      this.pending.clear();
      return;
    }
    if (m.method === "Page.javascriptDialogOpening") {
      this.events.push({ kind: "dialog." + p.type, text: String(p.message || "").slice(0, 200) });
      this.send("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
      return;
    }
    if (m.method === "Runtime.exceptionThrown") {
      const d = p.exceptionDetails || {};
      const desc = (d.exception && (d.exception.description || d.exception.value)) || d.text || "unknown";
      this.events.push({ kind: "exception", text: String(desc).split("\n")[0], detail: String(desc).slice(0, 600) });
    } else if (m.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "warning" || p.type === "assert")) {
      const args = (p.args || []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? "").join(" ");
      this.events.push({ kind: "console." + p.type, text: args.slice(0, 400) });
    } else if (m.method === "Log.entryAdded" && (p.entry || {}).level === "error") {
      const e = p.entry;
      /* browser-level errors: CSP, bad manifest. Network failures are skipped
       * here because the Network domain reports them with more detail. */
      if (e.source === "network") return;
      this.events.push({ kind: "log." + e.source, text: `${e.text}${e.url ? " <" + e.url + ">" : ""}`.slice(0, 400) });
    } else if (m.method === "Network.responseReceived" && (p.response || {}).status >= 400) {
      this.events.push({ kind: "http." + p.response.status, text: p.response.url });
    } else if (m.method === "Network.loadingFailed" && !p.canceled) {
      this.events.push({ kind: "net.fail", text: `${p.errorText}` });
    }
  }

  /*
   * Every command is bounded. A gate that hangs is worse than a gate that
   * fails: it burns the operator's time and reports nothing. A page stuck in a
   * long task, an Input event the renderer never acknowledges, a promise the
   * app never settles — all of those become a legible error here instead of
   * silence.
   */
  send(method, params = {}, timeoutMs = 30000) {
    if (this.closed) return Promise.reject(this.closed);
    const cid = ++this.id;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        this.pending.delete(cid);
        rej(fault(`${method} did not answer within ${timeoutMs}ms — the page stopped responding to the protocol`));
      }, timeoutMs);
      this.pending.set(cid, { res: (m) => { clearTimeout(timer); res(m); }, rej: (e) => { clearTimeout(timer); rej(e); } });
      try { this.ws.send(JSON.stringify({ id: cid, method, params })); }
      catch (e) { clearTimeout(timer); this.pending.delete(cid); rej(fault("CDP send failed: " + e.message)); }
    });
  }

  /** Runtime.evaluate that throws on harness-side errors and unwraps the value. */
  async evaluate(expression, { awaitPromise = false, timeoutMs = 30000 } = {}) {
    let m;
    try {
      m = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise }, timeoutMs);
    } catch (e) {
      /* name the call that hung: "the page stopped answering" is only actionable
       * if you know which expression it stopped answering */
      if (e.harnessFault) e.message += `\n  the call was: ${expression.replace(/\s+/g, " ").slice(0, 160)}`;
      throw e;
    }
    if (m.error) throw new Error(`CDP error: ${m.error.message}`);
    const r = m.result || {};
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      const desc = (d.exception && (d.exception.description || d.exception.value)) || d.text;
      throw new Error(`evaluate threw: ${String(desc).split("\n")[0]}`);
    }
    return r.result ? r.result.value : undefined;
  }

  /** drain events accumulated so far (deduped), and reset the buffer */
  take() {
    const seen = new Set();
    const out = [];
    for (const e of this.events) {
      const k = e.kind + "|" + e.text;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    this.events = [];
    return out;
  }

  /** one cheap round trip; CDP orders messages per connection, so any console
   * event emitted before this resolves has already been delivered */
  async flush() { await this.evaluate("1"); }

  close() { try { this.ws.close(); } catch { /* already gone */ } }
}

/* ========================================================= readiness signal */

/*
 * Not a sleep — and it must be the *new* document's signal. The outgoing
 * document still satisfies "#main has content" for a moment after a navigate is
 * issued, so polling content alone can hand back the page that is about to be
 * discarded, and anything injected into it vanishes. Stamping the old document
 * and waiting for the stamp to disappear pins the fresh one.
 */
const STALE = "__e2eStale";
const FRESH_EXPR =
  `(function(){if(window.${STALE})return false;` +
  `var m=document.getElementById("main")||document.querySelector("main");` +
  `return document.readyState!=="loading"&&!!m&&(m.textContent||"").trim().length>20;})()`;

export async function waitFresh(s, ms = 20000) {
  const deadline = Date.now() + ms;
  for (;;) {
    let ok = false;
    try { ok = await s.evaluate(FRESH_EXPR); } catch { /* mid-navigation, retry */ }
    if (ok) return true;
    if (Date.now() > deadline) return false;
    await sleep(30);
  }
}

export async function markStale(s) {
  try { await s.evaluate(`window.${STALE}=1,1`); } catch { /* about:blank or mid-load */ }
}

export async function boot(s, url) {
  await markStale(s);
  await s.send("Page.navigate", { url });
  return waitFresh(s);
}

export async function reload(s) {
  await markStale(s);
  await s.send("Page.reload", { ignoreCache: true });
  return waitFresh(s);
}

/**
 * Deterministic per-app state: drop any service worker and Cache Storage this
 * user-data-dir picked up on a previous run, and clear the progress/exam blobs
 * that change what #/review and #/exam render.
 */
export async function resetOrigin(s) {
  await s.evaluate(
    `(async function(){` +
    `try{localStorage.clear();sessionStorage.clear();}catch(e){}` +
    `try{if(navigator.serviceWorker){var rs=await navigator.serviceWorker.getRegistrations();` +
    `for(var i=0;i<rs.length;i++)await rs[i].unregister();}}catch(e){}` +
    `try{if(window.caches){var ks=await caches.keys();for(var j=0;j<ks.length;j++)await caches.delete(ks[j]);}}catch(e){}` +
    `return 1;})()`, { awaitPromise: true });
}
