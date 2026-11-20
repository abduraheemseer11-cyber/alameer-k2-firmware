#!/bin/bash
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
"$PRJ/scripts/verify-device.sh" "$SRC" "$PRJ"

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
	echo "ALAMEER_VERSION='22.5'"
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
