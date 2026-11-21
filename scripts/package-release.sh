#!/usr/bin/env bash
# ALAMEER SOFTWARE - create release artifacts AFTER verify-device + verify-image-size passed.
# Usage: package-release.sh [outdir]
set -euo pipefail
PRJ="$(cd "$(dirname "$0")/.." && pwd)"
WORKDIR="${WORKDIR:-$PRJ/build}"; OUT="${1:-$PRJ/out}"
SRC="$WORKDIR/openwrt"; IMG="$(cat "$WORKDIR/image.path")"
FINAL="ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin"
bash "$PRJ/scripts/verify-device.sh" "$SRC" "$PRJ" >/dev/null
bash "$PRJ/scripts/verify-image-size.sh" "$IMG" "$SRC" >/dev/null || { echo "refusing to package: image verification failed"; exit 1; }
mkdir -p "$OUT"
# This is a verified, real build output of profile phicomm_k2-v22.5 (copy, not a hand-made file).
cp "$IMG" "$OUT/$FINAL"
( cd "$OUT" && sha256sum "$FINAL" > "$FINAL.sha256" )
cp "$WORKDIR/config.buildinfo" "$OUT/config.buildinfo"
cp "$(dirname "$IMG")"/*phicomm_k2-v22.5*.manifest "$OUT/" 2>/dev/null || true
{
	echo "ALAMEER SOFTWARE firmware - Phicomm K2 (PSG1218) v22.5 layout"
	echo "Built (UTC) : $(date -u '+%F %T')"
	echo "OpenWrt     : $(cat "$WORKDIR/openwrt.sha")  tag ${OPENWRT_TAG:-v22.03.7}"
	echo "Image       : $FINAL"
	echo "Size        : $(stat -c %s "$OUT/$FINAL") bytes"
	echo "SHA256      : $(cut -d' ' -f1 "$OUT/$FINAL.sha256")"
	echo "Developed by Eng. Abdulrahim Al-Makhadhi"
} > "$OUT/VERSION.txt"
cat "$OUT/VERSION.txt"
