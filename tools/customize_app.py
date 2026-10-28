#!/usr/bin/env python3
"""Rewrite the Blueprint-derived engine copy for a specific Atlas app.

    tools/customize_app.py <config.json>

The scaffold step copies Blueprint's app.js / exam.js verbatim; this step swaps
the parts that are genuinely app-specific (mounted tracks, quiz prefixes,
learning paths, hero copy). Kept as a script so the substitutions are visible
and repeatable instead of buried in a pile of one-off edits.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def sub_once(text, old, new, label):
    if old not in text:
        die("could not find %s" % label)
    if text.count(old) != 1:
        die("%s is ambiguous (%d matches)" % (label, text.count(old)))
    return text.replace(old, new)


def js_str(s):
    return json.dumps(s)


def build_paths(paths):
    out = ["  const LEARNING_PATHS = ["]
    for i, p in enumerate(paths):
        routes = ",\n".join('        %s' % js_str(r) for r in p["routes"])
        out.append("    {")
        out.append("      id: %s," % js_str(p["id"]))
        out.append("      title: %s," % js_str(p["title"]))
        out.append("      label: %s," % js_str(p["label"]))
        out.append("      color: %s," % js_str(p["color"]))
        out.append("      desc: %s," % js_str(p["desc"]))
        out.append("      routes: [")
        out.append(routes)
        out.append("      ]")
        out.append("    }" + ("," if i < len(paths) - 1 else ""))
    out.append("  ];")
    return "\n".join(out)


def main():
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    app_dir = ROOT / cfg["dir"]
    name = cfg["name"]
    tracks = cfg["tracks"]  # [{id, short}]
    tids = [t["id"] for t in tracks]
    shorts = [t["short"] for t in tracks]

    # ---------------- app.js ----------------
    p = app_dir / "js" / "app.js"
    s = p.read_text(encoding="utf-8")

    s = sub_once(
        s,
        "  const TRACKS = [window.TRACKS.hld, window.TRACKS.lld].filter(Boolean);",
        "  const TRACKS = [%s].filter(Boolean);" % ", ".join("window.TRACKS.%s" % t for t in tids),
        "TRACKS mount list",
    )
    s = sub_once(
        s,
        '  const ACTIVE_QUIZ_PREFIXES = ["hld-", "lld-"];',
        "  const ACTIVE_QUIZ_PREFIXES = [%s];" % ", ".join(js_str(t + "-") for t in tids),
        "app.js ACTIVE_QUIZ_PREFIXES",
    )

    # learning paths: replace the whole literal
    m = re.search(r"^  const LEARNING_PATHS = \[.*?^  \];$", s, re.S | re.M)
    if not m:
        die("could not find LEARNING_PATHS literal")
    s = s[: m.start()] + build_paths(cfg["paths"]) + s[m.end():]

    # titles
    s = s.replace('%s \u00b7 The HLD & LLD Atlas' % name, '%s \u00b7 %s' % (name, cfg["subtitle"]))
    s = s.replace('document.title = "%s \u00b7 The HLD & LLD Atlas";' % name,
                  'document.title = "%s \u00b7 %s";' % (name, cfg["subtitle"]))

    # hero block
    s = sub_once(
        s,
        "'<span class=\"hero-tag reveal reveal-1\"><span class=\"pulse\"></span>Interactive system-design atlas</span>' +",
        "'<span class=\"hero-tag reveal reveal-1\"><span class=\"pulse\"></span>%s</span>' +" % cfg["heroTag"],
        "hero tag",
    )
    s = sub_once(
        s,
        "'<h1 class=\"reveal reveal-2\">Design systems<br>that <span class=\"grad\">scale</span> &amp; code<br>that <span class=\"grad\">bends</span>.</h1>' +",
        "'<h1 class=\"reveal reveal-2\">%s</h1>' +" % cfg["heroH1"],
        "hero h1",
    )
    s = sub_once(
        s,
        "'<p class=\"lede reveal reveal-3\">Master software design end to end \\u2014 the <strong>High-Level Design</strong> of distributed systems, the <strong>Low-Level Design</strong> of clean code, and the production trade-offs that connect architecture to implementation. Learn by reading, then by <em>doing</em>.</p>' +",
        "'<p class=\"lede reveal reveal-3\">%s</p>' +" % cfg["heroLede"],
        "hero lede",
    )

    old_cta = (
        "          (resumeF\n"
        "            ? '<a class=\"btn btn-primary\" href=\"' + resumeF.route + '\">Resume \\u00b7 ' + escapeHtml(resumeF.lesson.title) + ARR + \"</a>\" +\n"
        "              '<a class=\"btn btn-ghost\" href=\"#/hld/foundations/what-is-hld\">Start with HLD' + ARR + \"</a>\"\n"
        "            : '<a class=\"btn btn-primary\" href=\"#/hld/foundations/what-is-hld\">Start with HLD' + ARR + \"</a>\" +\n"
        "              '<a class=\"btn btn-ghost\" href=\"#/lld/oop/what-is-lld\">Start with LLD' + ARR + \"</a>\") +"
    )
    a0, a1 = cfg["ctaPrimary"], cfg["ctaSecondary"]
    new_cta = (
        "          (resumeF\n"
        "            ? '<a class=\"btn btn-primary\" href=\"' + resumeF.route + '\">Resume \\u00b7 ' + escapeHtml(resumeF.lesson.title) + ARR + \"</a>\" +\n"
        "              '<a class=\"btn btn-ghost\" href=\"%s\">%s' + ARR + \"</a>\"\n"
        "            : '<a class=\"btn btn-primary\" href=\"%s\">%s' + ARR + \"</a>\" +\n"
        "              '<a class=\"btn btn-ghost\" href=\"%s\">%s' + ARR + \"</a>\") +"
        % (a0["route"], a0["label"], a0["route"], a0["label"], a1["route"], a1["label"])
    )
    s = sub_once(s, old_cta, new_cta, "hero CTA")

    # feature card copy that names Blueprint's widgets
    s = sub_once(
        s,
        '["bolt", "Interactive labs", "Drive a load balancer, tune a token bucket, compare cache writes, explore CAP trade-offs, route tenants through cells, and estimate launch capacity."],',
        '["bolt", "Interactive labs", %s],' % js_str(cfg["featLabs"]),
        "feature labs copy",
    )

    # practice-mode copy that names HLD/LLD
    s = s.replace(
        "every HLD and LLD checkpoint quiz",
        "every %s checkpoint quiz" % " and ".join(shorts),
    )
    s = s.replace(
        "\" questions, shuffled across HLD & LLD\"",
        '" questions, shuffled across %s"' % " & ".join(shorts),
    )
    s = s.replace(
        "Pick HLD Basics, Reliability &amp; SRE, Case Studies, LLD Mastery, or AI Systems and copy the path as Markdown study notes.",
        cfg["pathBanner"],
    )

    p.write_text(s, encoding="utf-8")

    # ---------------- exam.js ----------------
    p = app_dir / "js" / "exam.js"
    s = p.read_text(encoding="utf-8")
    s = sub_once(
        s,
        '  var ACTIVE_QUIZ_PREFIXES = ["hld", "lld"];',
        "  var ACTIVE_QUIZ_PREFIXES = [%s];" % ", ".join(js_str(t) for t in tids),
        "exam.js ACTIVE_QUIZ_PREFIXES",
    )
    labels = "\n".join("    %s: %s," % (t["id"], js_str(t["name"])) for t in tracks)
    m = re.search(r"^  var TRACK_NAMES = \{.*?^  \};$", s, re.S | re.M)
    if not m:
        die("could not find exam.js TRACK_NAMES literal")
    s = s[: m.start()] + "  var TRACK_NAMES = {\n" + labels + "\n  };" + s[m.end():]
    s = s.replace("// Quiz ids in %s use these prefixes: hld-, lld-." % name,
                  "// Quiz ids in %s use these prefixes: %s." % (name, ", ".join(t + "-" for t in tids)))
    s = s.replace("Tracks match %s's window.TRACKS ids: hld, lld." % name,
                  "Tracks match %s's window.TRACKS ids: %s." % (name, ", ".join(tids)))
    p.write_text(s, encoding="utf-8")

    print("customized %s: tracks=%s prefixes=%s" % (cfg["dir"], ",".join(tids), ",".join(t + "-" for t in tids)))


if __name__ == "__main__":
    main()
