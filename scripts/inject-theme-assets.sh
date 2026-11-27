#!/bin/bash
# Usage: inject-theme-assets.sh <files-dir> <openwrt-version>
# Downloads luci-theme-bootstrap ipk, extracts header.htm for 22.03.7 and
# injects alameer.css / alameer.js before </head>, writing it into the overlay.
set -euo pipefail
FILES="$(cd "${1:?files dir}" && pwd)"; VER="${2:-22.03.7}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
REPO="https://downloads.openwrt.org/releases/${VER}/packages/mipsel_24kc/luci"
wget -q -O "$TMP/Packages.gz" "$REPO/Packages.gz"
FN=$(zcat "$TMP/Packages.gz" | awk '/^Package: luci-theme-bootstrap$/{f=1} f&&/^Filename:/{print $2; exit}')
[ -n "$FN" ] || { echo "luci-theme-bootstrap not found in feed"; exit 1; }
wget -q -O "$TMP/pkg.ipk" "$REPO/$FN"
mkdir "$TMP/x" && cd "$TMP/x" && tar xzf ../pkg.ipk && mkdir d && tar -C d -xzf data.tar.gz
HDR=""
for p in usr/lib/lua/luci/view/themes/bootstrap/header.htm usr/share/ucode/luci/template/themes/bootstrap/header.ut; do
  [ -f "d/$p" ] && { HDR="$p"; break; }
done
[ -n "$HDR" ] || { echo "header template not found"; exit 1; }
INJ='<link rel="stylesheet" href="/luci-static/alameer/alameer.css?v=1">\n<script src="/luci-static/alameer/alameer.js?v=1" defer></script>\n</head>'
grep -q alameer.css "d/$HDR" || sed -i "0,/<\/head>/s##${INJ}#" "d/$HDR"
grep -q alameer.css "d/$HDR" || { echo "injection failed"; exit 1; }
mkdir -p "$FILES/$(dirname "$HDR")"
cp "$TMP/x/d/$HDR" "$FILES/$HDR"
echo "Injected theme assets into /$HDR"
