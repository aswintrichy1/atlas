#!/usr/bin/env bash
# =====================================================================
# assemble.sh — build the self-contained "Atlas Collection" for GitHub Pages.
#
# GitHub Pages does NOT follow symbolic links, so the three academy apps
# must live inside this folder as REAL files. This script rebuilds each
# app's clean distributable (via that app's own build.sh, which already
# strips dev artifacts and symlinks) and copies it in beside the hub.
#
# It reads the source apps from the PARENT directory of this folder
# (e.g. ~/Documents/<app>). That only works on the machine where those
# sources live. A fresh clone of this repo ALREADY contains the built
# copies, so you do NOT need to run this to deploy — only re-run it after
# editing one of the source apps locally, then commit the result.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(dirname "$ROOT")"
APPS=(hld-lld-academy cyber-academy data-eng-academy)

for app in "${APPS[@]}"; do
  src="$SRC/$app"
  if [ ! -f "$src/build.sh" ]; then
    echo "!! $app: no build.sh at $src — skipping"; continue
  fi
  echo ">> building $app"
  ( cd "$src" && bash build.sh >/dev/null )
  rm -rf "${ROOT:?}/$app"
  cp -R "$src/dist" "$ROOT/$app"
  rm -rf "$src/dist"
done

# Safety net: a GitHub Pages tree must contain no symlinks or OS cruft.
find "$ROOT" -type l -delete 2>/dev/null || true
find "$ROOT" \( -name '._*' -o -name '.DS_Store' -o -name '*.bak' \) -delete 2>/dev/null || true

echo
echo "Assembled $(find "$ROOT" -type f | wc -l | tr -d ' ') files, $(du -sh "$ROOT" | cut -f1 | tr -d ' ') total."
echo "Symlinks remaining: $(find "$ROOT" -type l | wc -l | tr -d ' ') (must be 0)."
