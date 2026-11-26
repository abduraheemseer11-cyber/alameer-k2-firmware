#!/bin/sh
# Patch the vendor 24.10 Bootstrap ucode header without replacing LuCI's shell.
set -eu
ROOT="${1:-files}"
TPL="$ROOT/usr/share/ucode/luci/template/themes/bootstrap/header.ut"
[ -f "$TPL" ] || { echo "Missing Bootstrap header template: $TPL" >&2; exit 1; }
grep -q '</head>' "$TPL" || { echo "No </head> insertion point in Bootstrap header template" >&2; exit 1; }
if ! grep -q 'alameer.css' "$TPL"; then
  sed -i 's#</head>#<link rel="stylesheet" href="/luci-static/bootstrap/alameer.css" />\n</head>#' "$TPL"
fi
if ! grep -q 'alameer.js' "$TPL"; then
  sed -i 's#</head>#<script defer src="/luci-static/resources/alameer.js"></script>\n</head>#' "$TPL"
fi
grep -q 'alameer.css' "$TPL"
grep -q 'alameer.js' "$TPL"
# Guard against the old bug: a literal backslash-n must never reach the page.
if grep -q '\\n</head>' "$TPL"; then echo "Literal \\n found in header template" >&2; exit 1; fi
