#!/usr/bin/env bash
# بناء كامل من المصدر (Ubuntu 22.04 / 24.04) — بطيء (30-90 دقيقة). للبناء السريع: scripts/ib-build.sh
set -euo pipefail

BRANCH="${OPENWRT_BRANCH:-openwrt-23.05}"
DEVICE="${DEVICE:-phicomm_k2-v22.5}"      # أو phicomm_psg1218a / phicomm_psg1218b
LIMIT=$((7*1024*1024 + 512*1024))
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/openwrt"

echo ">> Installing dependencies"
sudo apt-get update
sudo apt-get install -y build-essential clang flex bison g++ gawk gettext git libncurses-dev \
  libssl-dev python3-setuptools rsync swig unzip zlib1g-dev file wget ca-certificates xsltproc zstd jq

echo ">> Cloning OpenWrt ($BRANCH)"
[ -d "$SRC" ] || git clone --depth 1 -b "$BRANCH" https://github.com/openwrt/openwrt.git "$SRC"
cd "$SRC"

echo ">> Feeds"
./scripts/feeds update -a
./scripts/feeds install -a

echo ">> Injecting custom files and config ($DEVICE)"
rm -rf files && cp -r "$HERE/files" files
chmod +x files/usr/bin/* files/etc/uci-defaults/*
sed "s/@DEVICE@/$DEVICE/" "$HERE/diffconfig" > .config
make defconfig

echo ">> Download sources"
make download -j"$(nproc)" || make download -j1 V=s

echo ">> Compile"
make -j"$(nproc)" || make -j1 V=s

IMG=$(ls bin/targets/ramips/mt7620/*sysupgrade.bin | head -1)
S=$(stat -c%s "$IMG")
echo ">> Image: $IMG  ($S bytes, limit $LIMIT)"
if [ "$S" -gt "$LIMIT" ]; then
  echo "!! WARNING: image larger than 7.5MB. Do NOT flash. Remove sqm/luci-app-wol/rp-pppoe-server from diffconfig and rebuild."
  exit 1
fi
mkdir -p "$HERE/out" && cp "$IMG" "$HERE/out/"
echo ">> Done: $HERE/out/$(basename "$IMG")"
