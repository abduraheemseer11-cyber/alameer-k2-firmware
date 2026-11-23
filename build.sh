#!/usr/bin/env bash
# ALAMEER SOFTWARE - Phicomm K2 (PSG1218a, 8MB) firmware builder - OpenWrt 21.02.7 ImageBuilder
set -euo pipefail
VER="21.02.7"
PROFILE="phicomm_psg1218a"
ARCH="mipsel_24kc"
MAX_BYTES=$((6500*1024))
BASE="https://downloads.openwrt.org/releases/${VER}"
IB="openwrt-imagebuilder-${VER}-ramips-mt7620.Linux-x86_64"

ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="$ROOT/work"; OUT="$ROOT/output"
rm -rf "$WORK" "$OUT"; mkdir -p "$WORK" "$OUT"
cp -a "$ROOT/files" "$WORK/files"
cd "$WORK"

# 1) Take the stock bootstrap theme header, keep its <head> (LuCI JS bootstrap), add our sidebar body
wget -q "$BASE/packages/$ARCH/luci/Packages.gz" -O Packages.gz
FN="$(gunzip -c Packages.gz | awk '/^Package: luci-theme-bootstrap$/{f=1} f&&/^Filename:/{print $2; exit}')"
[ -n "$FN" ] || { echo "luci-theme-bootstrap not found in feed"; exit 1; }
wget -q "$BASE/packages/$ARCH/luci/$FN" -O bs.ipk
mkdir bs && cd bs
tar -xzf ../bs.ipk 2>/dev/null || ar x ../bs.ipk
tar -xzf data.tar.gz
cd ..
python3 "$ROOT/tools/make-theme.py" \
  bs/usr/lib/lua/luci/view/themes/bootstrap/header.htm \
  "$ROOT/theme-src/body.htm" \
  files/usr/lib/lua/luci/view/themes/alameer/header.htm

# 2) ImageBuilder
wget -q "$BASE/targets/ramips/mt7620/${IB}.tar.xz" -O ib.tar.xz
tar -xJf ib.tar.xz
cd "$IB"
PACKAGES="$(grep -v '^\s*#' "$ROOT/packages.txt" | tr '\n' ' ')"
make image PROFILE="$PROFILE" PACKAGES="$PACKAGES" FILES="$WORK/files" EXTRA_IMAGE_NAME="alameer"

BIN="$(ls bin/targets/ramips/mt7620/*${PROFILE}*sysupgrade.bin | head -n1)"
SIZE=$(stat -c%s "$BIN")
echo "Image: $BIN ($SIZE bytes)"
cp "$BIN" "$OUT/ALAMEER-K2-${VER}-sysupgrade.bin"
( cd "$OUT" && sha256sum *.bin > SHA256SUMS )
[ "$SIZE" -le "$MAX_BYTES" ] || echo "WARNING: image larger than 6.5 MB - trim packages.txt"
