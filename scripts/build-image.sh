#!/bin/bash
# Build Alameer firmware with OpenWrt ImageBuilder 22.03.7 (ramips/mt7620)
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VER=22.03.7
PROFILE="${PROFILE:-phicomm_k2-v22.4}"
MAX_IMAGE_BYTES="${MAX_IMAGE_BYTES:-6500000}"
IB_NAME="openwrt-imagebuilder-${VER}-ramips-mt7620.Linux-x86_64"
IB_URL="https://downloads.openwrt.org/releases/${VER}/targets/ramips/mt7620/${IB_NAME}.tar.xz"

mkdir -p work out/"$PROFILE"
if [ ! -d "work/$IB_NAME" ]; then
  [ -f "work/$IB_NAME.tar.xz" ] || wget -q -O "work/$IB_NAME.tar.xz" "$IB_URL"
  tar -C work -xf "work/$IB_NAME.tar.xz"
fi

# Stage overlay files
rm -rf work/files && cp -a files work/files
[ "${BUILD_REGDB:-0}" = "1" ] && ./scripts/build-regdb.sh work/files
./scripts/inject-theme-assets.sh work/files "$VER"
chmod 755 work/files/usr/sbin/* work/files/etc/init.d/* work/files/etc/uci-defaults/* work/files/usr/libexec/rpcd/*

BASE="luci-base luci-mod-admin-full luci-theme-bootstrap uhttpd uhttpd-mod-ubus"
FULL="$BASE iw relayd kmod-batman-adv -wpad-basic-wolfssl wpad-mesh-wolfssl watchcat luci-app-watchcat"
LITE="$BASE iw relayd watchcat luci-app-watchcat"
MIN="$BASE iw"

built=0
for tier in FULL LITE MIN; do
  PKGS="${!tier}"
  echo "=== Tier $tier: $PKGS"
  make -C "work/$IB_NAME" image PROFILE="$PROFILE" PACKAGES="$PKGS" FILES="$ROOT/work/files" >/dev/null
  SYS=$(ls work/$IB_NAME/bin/targets/ramips/mt7620/*"$PROFILE"*sysupgrade.bin | head -n1)
  SIZE=$(stat -c %s "$SYS")
  echo "sysupgrade size: $SIZE (max $MAX_IMAGE_BYTES)"
  if [ "$SIZE" -le "$MAX_IMAGE_BYTES" ]; then built=1; echo "$tier" > out/"$PROFILE"/TIER.txt; break; fi
done
[ "$built" = 1 ] || { echo "ERROR: image too large even for MIN tier"; exit 1; }
cp work/$IB_NAME/bin/targets/ramips/mt7620/*"$PROFILE"*.bin out/"$PROFILE"/
ls -l out/"$PROFILE"
