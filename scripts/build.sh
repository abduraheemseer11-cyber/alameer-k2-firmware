#!/usr/bin/env bash
# Builds the Alameer K2 firmware with the official OpenWrt ImageBuilder.
# Works locally (Linux) and inside GitHub Actions.
#   usage: scripts/build.sh [openwrt-version]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source config.env
VERSION="${1:-$OPENWRT_VERSION}"

BASE="https://downloads.openwrt.org/releases/${VERSION}/targets/${TARGET}/${SUBTARGET}"
WORK="$ROOT/build"
OUT="$ROOT/output"
mkdir -p "$WORK" "$OUT"

echo "==> Resolving ImageBuilder for ${VERSION} (${TARGET}/${SUBTARGET})"
wget -q -O "$WORK/sha256sums" "$BASE/sha256sums"
IB="$(grep -o 'openwrt-imagebuilder-[^ *]*' "$WORK/sha256sums" | head -n1 || true)"
[ -n "$IB" ] || { echo "ImageBuilder not found at $BASE" >&2; exit 1; }
echo "    $IB"

if [ ! -f "$WORK/$IB" ]; then
  wget -q --show-progress -O "$WORK/$IB" "$BASE/$IB"
fi
( cd "$WORK" && grep -F "$IB" sha256sums | sha256sum -c - )

IBDIR="$WORK/${IB%.tar.*}"
if [ ! -d "$IBDIR" ]; then
  echo "==> Extracting"
  tar -C "$WORK" -xf "$WORK/$IB"
fi

echo "==> Staging overlay files"
rm -rf "$WORK/files"
cp -a "$ROOT/files" "$WORK/files"
chmod 0755 "$WORK"/files/etc/uci-defaults/* "$WORK"/files/usr/libexec/alameer/* 2>/dev/null || true
# strip CRLF in case the repo was edited on Windows
find "$WORK/files" -type f \( -name '*.sh' -o -path '*/uci-defaults/*' -o -path '*/libexec/*' -o -path '*/etc/config/*' \) \
  -exec sed -i 's/\r$//' {} +

PKGS="$(grep -v '^[[:space:]]*#' "$ROOT/packages.txt" | tr '\n' ' ' | tr -s ' ')"
echo "==> Packages: $PKGS"

echo "==> Building image for $PROFILE"
make -C "$IBDIR" image \
  PROFILE="$PROFILE" \
  PACKAGES="$PKGS" \
  FILES="$WORK/files" \
  EXTRA_IMAGE_NAME="alameer"

echo "==> Collecting images"
rm -f "$OUT"/*
cp -v "$IBDIR"/bin/targets/"$TARGET"/"$SUBTARGET"/*"$PROFILE"*.bin "$OUT"/ || true
cp -v "$IBDIR"/bin/targets/"$TARGET"/"$SUBTARGET"/*.manifest "$OUT"/ 2>/dev/null || true

SYSUP="$(ls "$OUT"/*sysupgrade.bin 2>/dev/null | head -n1 || true)"
[ -n "$SYSUP" ] || { echo "No sysupgrade image produced" >&2; exit 1; }

SIZE="$(stat -c%s "$SYSUP")"
echo "==> Image size: $SIZE bytes (limit $MAX_IMAGE_BYTES)"
if [ "$SIZE" -gt "$MAX_IMAGE_BYTES" ]; then
  echo "ERROR: image is larger than the 7552k firmware partition" >&2
  exit 1
fi
( cd "$OUT" && sha256sum ./*.bin > sha256sums.txt )
echo "==> Done: $SYSUP"
