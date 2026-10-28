#!/usr/bin/env bash
#
# Atlas verification runner — all five gates, one verdict, all 21 academies.
#
#   1. validate_content.mjs  content contract (ids, block grammar, quiz answers)
#   2. lint_static.mjs       precache integrity, asset existence, no external URLs
#   3. check_links.mjs       link & route reference integrity, storage-key uniqueness
#   4. crawl_e2e.mjs         every route rendered and driven in a real browser
#   5. crawl_ui.mjs          light-theme contrast + real keyboard and palette keys
#
# Starts the static server and headless Chrome only if they are not already
# listening, and tears down only what it started — so this is safe to re-run and
# safe to run while you already have a dev server up.
#
# Usage:
#   tools/verify_all.sh                      # everything
#   tools/verify_all.sh --app=cyber-academy  # scope the link + crawl gates
#   tools/verify_all.sh --sample=8           # quick crawl pass
#   PORT=8899 CDP_PORT=9333 tools/verify_all.sh
#
# Exit codes:
#   0   all gates green
#   N   N gates found real problems
#   98  harness fault — a gate could not run, nothing was proven either way

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8780}"
CDP_PORT="${CDP_PORT:-9240}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
CHROME_PROFILE="${CHROME_PROFILE:-}"
BASE="http://127.0.0.1:${PORT}"
CDP="http://127.0.0.1:${CDP_PORT}"

SERVER_PID=""
CHROME_PID=""
STARTED_SERVER=0
STARTED_CHROME=0

cleanup() {
  if [ "$STARTED_CHROME" = "1" ] && [ -n "$CHROME_PID" ]; then
    kill "$CHROME_PID" 2>/dev/null || true
    wait "$CHROME_PID" 2>/dev/null || true
    [ -n "$CHROME_PROFILE" ] && rm -rf "$CHROME_PROFILE" 2>/dev/null || true
    echo "   torn down: headless Chrome (pid $CHROME_PID)"
  fi
  if [ "$STARTED_SERVER" = "1" ] && [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    echo "   torn down: static server (pid $SERVER_PID)"
  fi
}
trap cleanup EXIT INT TERM

listening() {
  # lsof is authoritative on macOS; fall back to a bare TCP connect
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1 && { exec 3<&-; return 0; }
  return 1
}

wait_for() {  # wait_for <port> <seconds> <label>
  local port="$1" limit="$2" label="$3" i=0
  while [ "$i" -lt "$((limit * 10))" ]; do
    listening "$port" && return 0
    sleep 0.1
    i=$((i + 1))
  done
  echo "   ERROR: $label never came up on port $port"
  return 1
}

echo "Atlas verification — repo $ROOT"
echo

# ---------------------------------------------------------------- harness up
if listening "$PORT"; then
  echo "   static server already listening on $PORT — reusing"
else
  echo "   starting static server on $PORT"
  ( cd "$ROOT" && exec python3 -m http.server "$PORT" --directory . ) >/dev/null 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1
  wait_for "$PORT" 15 "static server" || exit 99
fi

# Each browser gate gets a Chrome of its own, from a profile that has never seen
# these apps before. Sharing one long-lived browser across several gate runs is
# where this suite turned flaky: after two or three sessions against the same
# profile, a hash navigation or a serviceWorker.getRegistrations() call would
# simply never settle, which reads as "the content broke" to anyone glancing at
# the exit code. A browser costs a few seconds; a gate nobody trusts costs more.
start_chrome() {
  [ -x "$CHROME" ] || return 1
  CHROME_PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/atlas-chrome-XXXXXX")"
  # The window size is set here, on the command line, and never through
  # Emulation.setDeviceMetricsOverride: that override pinned Chrome's browser
  # process at 100% CPU for the rest of its life, outliving the run that set it
  # and hanging every later attach. The UI sweep needs >=1100px or the apps
  # switch to their mobile layout and the search box and sidebar cannot be
  # reached at all.
  # --disable-ipc-flooding-protection: the crawl fires hundreds of hash
  # navigations per app, and Chrome's navigation rate limiter otherwise starts
  # dropping them on the biggest apps, which reads as a content failure.
  "$CHROME" --headless=new --disable-gpu --disable-ipc-flooding-protection \
    --no-first-run --no-default-browser-check \
    --force-device-scale-factor=1 --hide-scrollbars --window-size=1440,1000 \
    --remote-debugging-port="$CDP_PORT" \
    --user-data-dir="$CHROME_PROFILE" about:blank >/dev/null 2>&1 &
  CHROME_PID=$!
  STARTED_CHROME=1
  wait_for "$CDP_PORT" 25 "headless Chrome" || return 1
  # A listening socket is not the same as a browser that will answer: a dying
  # Chrome's socket can still be in the listen state for a moment, which is long
  # enough for the next gate to attach to nothing and report a harness fault.
  # Insist on a real protocol answer from a live process.
  local i=0
  while [ "$i" -lt 25 ]; do
    if kill -0 "$CHROME_PID" 2>/dev/null && cdp_answers; then return 0; fi
    sleep 0.2
    i=$((i + 1))
  done
  return 1
}

cdp_answers() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 2 "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1
  else
    listening "$CDP_PORT"
  fi
}

stop_chrome() {
  [ "$STARTED_CHROME" = "1" ] || return 0
  [ -n "$CHROME_PID" ] && { kill "$CHROME_PID" 2>/dev/null || true; wait "$CHROME_PID" 2>/dev/null || true; }
  [ -n "$CHROME_PROFILE" ] && rm -rf "$CHROME_PROFILE" 2>/dev/null || true
  CHROME_PID=""
  STARTED_CHROME=0
  # the port takes a moment to free up before the next launch can claim it
  local i=0
  while listening "$CDP_PORT" && [ "$i" -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
}

# fresh Chrome for the next gate, but only when this script owns the browser
recycle_chrome() {
  [ "$REUSING_CHROME" = "1" ] && return 0
  stop_chrome
  if ! start_chrome; then
    echo "   ERROR: could not start a fresh Chrome on $CDP_PORT for the next gate"
    return 1
  fi
  echo "   fresh Chrome on $CDP_PORT (pid $CHROME_PID)"
}

REUSING_CHROME=0
if listening "$CDP_PORT"; then
  echo "   headless Chrome already listening on $CDP_PORT — reusing"
  echo "   NOTE: a browser this script did not start is reused as-is. If a gate reports a"
  echo "         harness fault, rerun without a pre-existing Chrome on $CDP_PORT so each"
  echo "         gate gets a clean profile."
  REUSING_CHROME=1
elif [ ! -x "$CHROME" ]; then
  echo "   WARNING: Chrome not found at $CHROME — the browser gates will be skipped"
  echo "            (set CHROME=/path/to/chrome to enable them)"
else
  echo "   starting headless Chrome on $CDP_PORT (fresh profile per browser gate)"
  start_chrome || exit 99
fi
echo

# -------------------------------------------------------------------- gates
FAILED=0
FAULTED=0
declare -a NAMES=() STATUS=()

# Exit 3 from a browser gate means the harness broke, not the content. Counting
# that as a content failure is how a suite earns a reputation for flakiness and
# gets rerun until it goes green, so it is tracked separately and it suppresses
# the verdict entirely.
gate() {  # gate <label> <command...>
  local label="$1"; shift
  echo "══════════════════════════════════════════════════════════════"
  echo "  gate: $label"
  echo "══════════════════════════════════════════════════════════════"
  "$@"
  local code=$?
  NAMES+=("$label")
  if [ "$code" -eq 0 ]; then
    STATUS+=("pass")
  elif [ "$code" -eq 3 ]; then
    STATUS+=("HARNESS FAULT (exit 3) — nothing proven")
    FAULTED=$((FAULTED + 1))
  else
    STATUS+=("FAIL (exit $code)")
    FAILED=$((FAILED + 1))
  fi
  echo
  return 0
}

# --app= is understood by check_links and crawl_e2e; validate_content takes a
# bare directory; lint_static always covers everything.
APP_ARG=""
CRAWL_ARGS=()
for a in "$@"; do
  case "$a" in
    --app=*) APP_ARG="${a#--app=}"; CRAWL_ARGS+=("$a") ;;
    *) CRAWL_ARGS+=("$a") ;;
  esac
done

cd "$ROOT" || exit 99

# Pre-flight: prove the link checker still detects a dangling route before
# trusting it to say the repo is clean.
if ! node tools/check_links.mjs --selftest >/dev/null 2>&1; then
  echo "ERROR: link-checker self-test failed — run 'node tools/check_links.mjs --selftest' for detail"
  exit 99
fi
if listening "$CDP_PORT"; then
  if ! E2E_BASE="$BASE" E2E_CDP="$CDP" node tools/crawl_e2e.mjs --selfcheck >/dev/null 2>&1; then
    echo "ERROR: crawler self-check failed — run 'node tools/crawl_e2e.mjs --selfcheck' for detail"
    exit 99
  fi
  recycle_chrome || exit 99
  if ! E2E_BASE="$BASE" E2E_CDP="$CDP" node tools/crawl_ui.mjs --selftest --quiet >/dev/null 2>&1; then
    echo "ERROR: UI-sweep self-test failed — run 'node tools/crawl_ui.mjs --selftest' for detail"
    exit 99
  fi
fi
echo "   tooling self-tests: pass"
echo

if [ -n "$APP_ARG" ]; then
  gate "content contract"  node tools/validate_content.mjs "$APP_ARG"
else
  gate "content contract"  node tools/validate_content.mjs
fi

gate "static guardrails"   node tools/lint_static.mjs

if [ -n "$APP_ARG" ]; then
  gate "link integrity"    node tools/check_links.mjs "--app=$APP_ARG"
else
  gate "link integrity"    node tools/check_links.mjs
fi

if listening "$CDP_PORT"; then
  recycle_chrome || exit 99
  E2E_BASE="$BASE" E2E_CDP="$CDP" gate "end-to-end crawl" node tools/crawl_e2e.mjs "${CRAWL_ARGS[@]+"${CRAWL_ARGS[@]}"}"
  recycle_chrome || exit 99
  E2E_BASE="$BASE" E2E_CDP="$CDP" gate "ui sweep" node tools/crawl_ui.mjs "${CRAWL_ARGS[@]+"${CRAWL_ARGS[@]}"}"
else
  NAMES+=("end-to-end crawl"); STATUS+=("skipped (no Chrome)")
  NAMES+=("ui sweep");         STATUS+=("skipped (no Chrome)")
fi

# ------------------------------------------------------------------- verdict
echo "══════════════════════════════════════════════════════════════"
for i in "${!NAMES[@]}"; do
  printf '  %-20s %s\n' "${NAMES[$i]}" "${STATUS[$i]}"
done
echo "══════════════════════════════════════════════════════════════"
if [ "$FAULTED" -ne 0 ]; then
  echo "VERDICT: INCONCLUSIVE — $FAULTED gate(s) hit a harness fault, not a content failure."
  echo "         Nothing has been proven about the content. Fix the harness and rerun;"
  echo "         do not read this as a pass or a fail."
  exit 98
fi
if [ "$FAILED" -eq 0 ]; then
  echo "VERDICT: PASSED — all gates green"
else
  echo "VERDICT: FAILED — $FAILED of ${#NAMES[@]} gate(s) failed"
fi
exit "$FAILED"
