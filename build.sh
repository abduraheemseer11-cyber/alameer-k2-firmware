#!/bin/bash
# Alameer-K2 ImageBuilder Script
set -e

BUILD_DIR="$HOME/storage/downloads/openwrt-k2-build"
IB_URL="https://downloads.openwrt.org/releases/21.02.7/targets/ramips/mt7620/openwrt-imagebuilder-21.02.7-ramips-mt7620.Linux-x86_64.tar.xz"
IB_TAR="openwrt-imagebuilder-21.02.7-ramips-mt7620.Linux-x86_64.tar.xz"
IB_DIR="openwrt-imagebuilder-21.02.7-ramips-mt7620.Linux-x86_64"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

if [ ! -f "$IB_TAR" ]; then
    echo "⬇️  تحميل ImageBuilder..."
    wget "$IB_URL"
fi

if [ ! -d "$IB_DIR" ]; then
    echo "📦 استخراج ImageBuilder..."
    tar -xf "$IB_TAR"
fi

cd "$IB_DIR"

echo "📁 نسخ ملفات المشروع..."
rm -rf files
cp -r "$HOME/storage/downloads/alameer-k2-buildA/files" ./files

echo "🔨 بدء البناء..."
make image PROFILE="phicomm_k2-v22.4" \
  PACKAGES="luci luci-i18n-base-ar luci-i18n-firewall-ar luci-app-watchcat lldpd iwinfo luci-app-commands luci-compat luci-lib-jsonc -luci-app-firewall -luci-app-opkg -luci-theme-bootstrap wpad-openssl" \
  FILES="./files" \
  DISABLED_SERVICES="dnsmasq firewall odhcpd" \
  EXTRA_IMAGE_NAME="alameer-k2-v1"

echo "✅ البناء اكتمل! الصورة في: $BUILD_DIR/$IB_DIR/bin/targets/ramips/mt7620/"
ls -lh "$BUILD_DIR/$IB_DIR/bin/targets/ramips/mt7620/"*.bin
