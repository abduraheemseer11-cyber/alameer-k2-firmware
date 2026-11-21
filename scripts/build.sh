#!/usr/bin/env bash
<<<<<<< HEAD
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
=======
# ALAMEER SOFTWARE - reproducible firmware build for Phicomm K2 (v22.5 layout).
# Usage: scripts/build.sh            (works locally on Debian/Ubuntu and inside GitHub Actions)
# Env:   OPENWRT_TAG     pinned release tag            (default v22.03.7)
#        OPENWRT_COMMIT  expected commit SHA of the tag (optional; build fails on mismatch if set)
#        WORKDIR         build dir                      (default ./build)
#        JOBS            parallel jobs                  (default nproc)
set -euo pipefail
PRJ="$(cd "$(dirname "$0")/.." && pwd)"
OPENWRT_TAG="${OPENWRT_TAG:-v22.03.7}"
OPENWRT_COMMIT="${OPENWRT_COMMIT:-}"
WORKDIR="${WORKDIR:-$PRJ/build}"
JOBS="${JOBS:-$(nproc)}"
SRC="$WORKDIR/openwrt"
mkdir -p "$WORKDIR"

echo "==> Fetching OpenWrt $OPENWRT_TAG"
if [ ! -d "$SRC/.git" ]; then
	git clone --depth 1 --branch "$OPENWRT_TAG" https://github.com/openwrt/openwrt.git "$SRC"
fi
cd "$SRC"
HEAD_SHA="$(git rev-parse HEAD)"
echo "OpenWrt $OPENWRT_TAG = $HEAD_SHA"
if [ -n "$OPENWRT_COMMIT" ] && [ "$HEAD_SHA" != "$OPENWRT_COMMIT" ]; then
	echo "FAIL: tag $OPENWRT_TAG resolves to $HEAD_SHA, expected $OPENWRT_COMMIT"; exit 1
fi
echo "$HEAD_SHA" > "$WORKDIR/openwrt.sha"

echo "==> Verifying device definition"
bash "$PRJ/scripts/verify-device.sh" "$SRC" "$PRJ"

echo "==> Feeds"
./scripts/feeds update -a
./scripts/feeds install -a

echo "==> Applying ALAMEER project"
rm -rf package/alameer files
mkdir -p package/alameer
cp -a "$PRJ"/packages/. package/alameer/
cp -a "$PRJ/files" files
# build info embedded in the image
{
	echo "ALAMEER_VERSION='2.0.0'"; echo "ALAMEER_HW='Phicomm K2 v22.5 layout'"
	echo "ALAMEER_BUILD='$(date -u +%Y-%m-%d) openwrt-$OPENWRT_TAG'"
	echo "ALAMEER_OPENWRT_COMMIT='$HEAD_SHA'"
} > files/etc/alameer_release
if ls "$PRJ"/patches/*.patch >/dev/null 2>&1; then
	for p in "$PRJ"/patches/*.patch; do echo "patch: $p"; git apply "$p"; done
fi
chmod +x files/etc/uci-defaults/* 2>/dev/null || true

echo "==> Configuring"
cp "$PRJ/configs/base.config" .config
make defconfig
for sym in CONFIG_TARGET_ramips_mt7620_DEVICE_phicomm_k2-v22.5=y CONFIG_PACKAGE_luci-app-alameer=y CONFIG_PACKAGE_luci-theme-alameer=y \
           CONFIG_PACKAGE_alameer-watchdog=y CONFIG_PACKAGE_kmod-mt76x2=y CONFIG_PACKAGE_swconfig=y CONFIG_PACKAGE_relayd=y; do
	grep -q "^$sym" .config || { echo "FAIL: $sym missing after defconfig (dependency problem?)"; exit 1; }
done
grep -q '^CONFIG_PACKAGE_lldpd=y' .config || echo "WARNING: lldpd not selected (not available in this feed?) - LLDP/CDP will be absent"
grep -q '^CONFIG_IPV6=y' .config && echo "WARNING: IPv6 still enabled"
cp .config "$WORKDIR/config.buildinfo"

echo "==> Download sources (hash-verified by OpenWrt PKG_HASH)"
make download -j8
echo "==> Building (jobs=$JOBS)"
make -j"$JOBS" || { echo "parallel build failed; retrying verbosely"; make -j1 V=s; }

IMG="$(ls bin/targets/ramips/mt7620/*phicomm_k2-v22.5*squashfs-sysupgrade.bin 2>/dev/null | head -n1 || true)"
[ -n "$IMG" ] || { echo "FAIL: sysupgrade image for phicomm_k2-v22.5 was not produced"; ls -l bin/targets/ramips/mt7620/ || true; exit 1; }
echo "$SRC/$IMG" > "$WORKDIR/image.path"
echo "Built: $IMG"
>>>>>>> d777d6c1c18170daf611fdd513ab792332509ebb
