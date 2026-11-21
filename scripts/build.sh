#!/usr/bin/env bash
# Build ALAMEER SOFTWARE firmware with the official OpenWrt ImageBuilder.
# Usage: bash scripts/build.sh [OpenWrt release version]
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/config.env"
VERSION="${1:-$OPENWRT_VERSION}"
WORK="$ROOT/build"
OUT="$ROOT/output"
BASE="https://downloads.openwrt.org/releases/${VERSION}/targets/${TARGET}/${SUBTARGET}"
mkdir -p "$WORK" "$OUT"

for cmd in wget sha256sum tar make grep sed find stat; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing build tool: $cmd" >&2; exit 1; }
done

printf '==> OpenWrt %s | %s/%s | %s\n' "$VERSION" "$TARGET" "$SUBTARGET" "$PROFILE"
printf '==> Downloading ImageBuilder checksum list\n'
wget -q --show-progress -O "$WORK/sha256sums" "$BASE/sha256sums"
IB="$(awk '{print $2}' "$WORK/sha256sums" | sed 's/^\*//' | grep -E '^openwrt-imagebuilder-.*\.tar\.(zst|xz|gz)$' | head -n1 || true)"
[ -n "$IB" ] || { echo "No ImageBuilder archive found at $BASE" >&2; exit 1; }
printf '==> ImageBuilder: %s\n' "$IB"

if [ ! -s "$WORK/$IB" ]; then
  wget -q --show-progress -O "$WORK/$IB" "$BASE/$IB"
fi
IB_SHA="$(awk -v f="$IB" '$2 == f || $2 == "*" f { print $1; exit }' "$WORK/sha256sums")"
[ -n "$IB_SHA" ] || { echo "ImageBuilder checksum entry not found for $IB" >&2; exit 1; }
(cd "$WORK" && printf '%s  %s\n' "$IB_SHA" "$IB" | sha256sum -c -)

IBDIR="$WORK/${IB%.tar.*}"
if [ ! -d "$IBDIR" ]; then
  echo '==> Extracting ImageBuilder'
  tar -C "$WORK" -xf "$WORK/$IB"
fi
[ -d "$IBDIR" ] || { echo "ImageBuilder extraction failed: $IBDIR" >&2; exit 1; }

STAGE="$WORK/files"
rm -rf "$STAGE"
cp -a "$ROOT/files" "$STAGE"
find "$STAGE/etc/uci-defaults" -type f -exec sed -i 's/\r$//' {} +
find "$STAGE/usr" -type f \( -name '*.sh' -o -name 'quicksetup-apply' \) -exec sed -i 's/\r$//' {} +
chmod 0755 "$STAGE"/etc/uci-defaults/* "$STAGE"/usr/libexec/alameer/* 2>/dev/null || true
# Apply the selected regulatory country without hardcoding a permissive country.
[[ "$WIFI_COUNTRY" =~ ^[A-Z]{2}$ ]] || { echo "WIFI_COUNTRY must be a two-letter ISO code" >&2; exit 1; }
sed -i "s/^COUNTRY=\"[A-Z][A-Z]\"/COUNTRY=\"${WIFI_COUNTRY}\"/" "$STAGE/etc/uci-defaults/99-alameer-config"
sed -i "s/option country '[A-Z][A-Z]'/option country '${WIFI_COUNTRY}'/" "$STAGE/etc/config/alameer"

PKGS="$(grep -Ev '^[[:space:]]*(#|$)' "$ROOT/packages.txt" | tr '\n' ' ' | xargs)"
printf '==> Packages: %s\n' "$PKGS"
printf '==> Building profile %s\n' "$PROFILE"
make -C "$IBDIR" image \
  PROFILE="$PROFILE" \
  PACKAGES="$PKGS" \
  FILES="$STAGE" \
  EXTRA_IMAGE_NAME="alameer"

IMAGE_DIR="$IBDIR/bin/targets/$TARGET/$SUBTARGET"
SYSUP="$(find "$IMAGE_DIR" -maxdepth 1 -type f -name "*${PROFILE}*squashfs-sysupgrade.bin" -print -quit)"
[ -n "$SYSUP" ] && [ -s "$SYSUP" ] || { echo "No sysupgrade image produced for $PROFILE" >&2; ls -lah "$IMAGE_DIR"; exit 1; }

SIZE="$(stat -c '%s' "$SYSUP")"
printf '==> Image size: %s bytes (maximum %s)\n' "$SIZE" "$MAX_IMAGE_BYTES"
[ "$SIZE" -le "$MAX_IMAGE_BYTES" ] || { echo 'Image exceeds the v22.5 firmware partition; refusing to package.' >&2; exit 1; }

FINAL='ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin'
rm -f "$OUT"/*
cp "$SYSUP" "$OUT/$FINAL"
cp "$IMAGE_DIR"/*"${PROFILE}"*.manifest "$OUT/" 2>/dev/null || true
cp "$IBDIR/.config" "$OUT/config.buildinfo" 2>/dev/null || true
(cd "$OUT" && sha256sum "$FINAL" > "$FINAL.sha256")
{
  echo 'ALAMEER SOFTWARE - Phicomm K2 v22.5'
  echo "OpenWrt: $VERSION"
  echo "Target: $TARGET/$SUBTARGET"
  echo "Profile: $PROFILE"
  echo "Wi-Fi regulatory country: $WIFI_COUNTRY"
  echo "Image: $FINAL"
  echo "Size: $SIZE bytes"
  echo "SHA256: $(cut -d' ' -f1 "$OUT/$FINAL.sha256")"
  echo 'Developed by Eng. Abdulrahim Al-Makhadhi'
} > "$OUT/VERSION.txt"
printf '==> Firmware ready: %s\n' "$OUT/$FINAL"
