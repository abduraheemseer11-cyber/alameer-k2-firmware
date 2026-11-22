#!/usr/bin/env bash
# ALAMEER SOFTWARE - Phicomm K2 (PSG1218a, 8MB) firmware builder (OpenWrt ImageBuilder)
set -euo pipefail
VER="19.07.10"
TARGET="ramips/mt7620"
PROFILE="psg1218a"
MAX_BYTES=$((6500*1024))     # target: stay under 6.5 MB
IB="openwrt-imagebuilder-${VER}-ramips-mt7620.Linux-x86_64"
URL="https://downloads.openwrt.org/releases/${VER}/targets/${TARGET}/${IB}.tar.xz"

ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="$ROOT/work"; OUT="$ROOT/output"
rm -rf "$WORK" "$OUT"; mkdir -p "$WORK" "$OUT"
cd "$WORK"
wget -q "$URL" -O ib.tar.xz
tar -xJf ib.tar.xz
cd "$IB"

PACKAGES="$(grep -v '^\s*#' "$ROOT/packages.txt" | tr '\n' ' ')"
# 19.07 prereq check asks for Python 2 (not available on ubuntu-22.04); not needed for ImageBuilder -> FORCE=1
make image FORCE=1 PROFILE="$PROFILE" PACKAGES="$PACKAGES" FILES="$ROOT/files" EXTRA_IMAGE_NAME="alameer"

BIN="$(ls bin/targets/ramips/mt7620/*${PROFILE}*sysupgrade.bin | head -n1)"
SIZE=$(stat -c%s "$BIN")
echo "Image: $BIN  ($SIZE bytes)"
cp "$BIN" "$OUT/ALAMEER-K2-${VER}-sysupgrade.bin"
( cd "$OUT" && sha256sum *.bin > SHA256SUMS )
if [ "$SIZE" -gt "$MAX_BYTES" ]; then
  echo "WARNING: image is larger than 6.5 MB - remove packages in packages.txt"; fi
