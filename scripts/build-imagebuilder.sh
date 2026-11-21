#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/config.env"
WORK="${WORK_DIR:-$ROOT/.work}"
mkdir -p "$WORK" "$ROOT/out"
ARCHIVE="openwrt-imagebuilder-${OPENWRT_VERSION}-${TARGET//\//-}.Linux-x86_64.tar.xz"
URL="https://downloads.openwrt.org/releases/${OPENWRT_VERSION}/targets/${TARGET}/$ARCHIVE"
EXPECTED_SHA256='5b1d5cd1d7e8ac5405437d1c52193d21deccba22467f68fcdc266b45f893393e'

if [ ! -f "$WORK/$ARCHIVE" ]; then
  curl -fL --retry 3 "$URL" -o "$WORK/$ARCHIVE"
fi
echo "$EXPECTED_SHA256  $WORK/$ARCHIVE" | sha256sum -c -
rm -rf "$WORK/imagebuilder"
mkdir -p "$WORK/imagebuilder"
tar -xJf "$WORK/$ARCHIVE" -C "$WORK/imagebuilder" --strip-components=1
cd "$WORK/imagebuilder"
PACKAGES="$(grep -Ev '^[[:space:]]*(#|$)' "$ROOT/packages.txt" | tr '\n' ' ')"
make image PROFILE="$PROFILE" PACKAGES="$PACKAGES" FILES="$ROOT/files" V=s 2>&1 | tee "$ROOT/out/build.log"
IMAGE="$(find bin/targets -type f -name '*phicomm_k2-v22.5*squashfs-sysupgrade.bin' -print -quit)"
[ -n "$IMAGE" ] || { echo 'Expected Phicomm K2 v22.5 sysupgrade image not found.' >&2; exit 1; }
SIZE="$(stat -c '%s' "$IMAGE")"
echo "Image size: $SIZE bytes (must be below $MAX_IMAGE_BYTES)"
[ "$SIZE" -lt "$MAX_IMAGE_BYTES" ] || { echo "Image is not below 6,000,000 bytes; refusing to publish." >&2; exit 1; }
cp "$IMAGE" "$ROOT/out/$FINAL_NAME"
sha256sum "$ROOT/out/$FINAL_NAME" > "$ROOT/out/$FINAL_NAME.sha256"
printf 'ALAMEER SOFTWARE V3 Purple Edition\nOpenWrt: %s\nTarget: %s\nProfile: %s\nImage size: %s bytes\n' "$OPENWRT_VERSION" "$TARGET" "$PROFILE" "$SIZE" > "$ROOT/out/VERSION.txt"
cp .config "$ROOT/out/config.buildinfo" 2>/dev/null || true
find bin/targets -name '*.manifest' -exec cp {} "$ROOT/out/" \;
echo "SUCCESS: $ROOT/out/$FINAL_NAME"
