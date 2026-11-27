#!/bin/bash
# Usage: inject-theme-assets.sh <files-dir> <openwrt-version>
set -euo pipefail
FILES="$(cd "${1:?files dir}" && pwd)"; VER="${2:-22.03.7}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
REPO="https://downloads.openwrt.org/releases/${VER}/packages/mipsel_24kc/luci"
wget -q -O "$TMP/Packages.gz" "$REPO/Packages.gz"
FN=$(zcat "$TMP/Packages.gz" | awk '/^Package: luci-theme-bootstrap$/{f=1} f&&/^Filename:/{print $2; exit}')
[ -n "$FN" ] || { echo "luci-theme-bootstrap not found in feed"; exit 1; }
wget -q -O "$TMP/pkg.ipk" "$REPO/$FN"
mkdir "$TMP/x" && cd "$TMP/x" && tar xzf ../pkg.ipk && mkdir d && tar -C d -xzf data.tar.gz

# Updated to v=2 to break browser cache
INJ='<link rel="stylesheet" href="/luci-static/alameer/alameer.css?v=2">\n<script src="/luci-static/alameer/alameer.js?v=2" defer></script>\n</head>'

for p in usr/lib/lua/luci/view/themes/bootstrap/header.htm \
         usr/lib/lua/luci/view/sysauth.htm \
         usr/share/ucode/luci/template/themes/bootstrap/header.ut \
         usr/share/ucode/luci/template/sysauth.ut; do
  if [ -f "d/$p" ]; then
    grep -q alameer.css "d/$p" || sed -i "0,/<\/head>/s##${INJ}#" "d/$p"
    mkdir -p "$FILES/$(dirname "$p")"
    cp "d/$p" "$FILES/$p"
    echo "Injected theme assets into /$p"
  fi
done
