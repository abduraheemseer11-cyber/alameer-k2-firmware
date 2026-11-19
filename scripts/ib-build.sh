#!/usr/bin/env bash
# بناء سريع بـ OpenWrt ImageBuilder (يستخدمه GitHub Actions)
set -euo pipefail
VERSION="${VERSION:-23.05.3}"
PROFILE="${PROFILE:-phicomm_k2-v22.5}"
VARIANT="${VARIANT:-full}"                 # full | lite
LIMIT=$((7*1024*1024 + 512*1024))          # 7.5MB
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="https://downloads.openwrt.org/releases/$VERSION/targets/ramips/mt7620"
cd "$ROOT"

echo ">> Profile check"
wget -q "$BASE/profiles.json" -O profiles.json
if ! jq -e --arg p "$PROFILE" '.profiles | has($p)' profiles.json >/dev/null; then
  echo "Profile '$PROFILE' not found. Available Phicomm profiles:"
  jq -r '.profiles | keys[]' profiles.json | grep -i -E 'phicomm|psg1218|k2' || true
  exit 1
fi

echo ">> Download ImageBuilder"
FILE=$(wget -qO- "$BASE/" | grep -oE 'openwrt-imagebuilder-[^"<> ]+Linux-x86_64\.tar\.(xz|zst)' | head -1)
rm -rf ib && mkdir ib
wget -q "$BASE/$FILE" -O "$FILE"
tar -xf "$FILE" -C ib --strip-components=1

echo ">> Collect available packages from the repositories"
: > avail.txt
grep '^src/gz' ib/repositories.conf | awk '{print $3}' | while read -r url; do
  wget -qO- "$url/Packages.gz" 2>/dev/null | gunzip 2>/dev/null | sed -n 's/^Package: //p' >> avail.txt || true
done
sort -u avail.txt -o avail.txt

list() {
  grep -v '^\s*#' "$1" | grep -v '^\s*$' | while read -r p; do
    case "$p" in
      -*) echo "$p" ;;
      *)  if grep -qx "$p" avail.txt; then echo "$p"; else echo "WARN: package '$p' not available, skipped" >&2; fi ;;
    esac
  done
}

chmod +x files/usr/bin/* files/etc/uci-defaults/* 2>/dev/null || true

build() {
  rm -rf ib/bin
  make -C ib image PROFILE="$PROFILE" PACKAGES="$1" FILES="$ROOT/files" EXTRA_IMAGE_NAME="al-makhadhi"
}
imgsize() { stat -c%s ib/bin/targets/ramips/mt7620/*sysupgrade.bin; }

CORE="$(list packages/core.txt | tr '\n' ' ')"
EXTRA="$(list packages/extra.txt | tr '\n' ' ')"

if [ "$VARIANT" = "full" ]; then
  build "$CORE $EXTRA"
  S=$(imgsize)
  echo ">> full image = $S bytes (limit $LIMIT)"
  if [ "$S" -gt "$LIMIT" ]; then
    echo "!! too large, falling back to LITE"
    VARIANT=lite
  fi
fi
if [ "$VARIANT" = "lite" ]; then
  build "$CORE"
  S=$(imgsize)
  echo ">> lite image = $S bytes (limit $LIMIT)"
  [ "$S" -le "$LIMIT" ] || { echo "ERROR: lite image still > 7.5MB"; exit 1; }
fi

mkdir -p out
cp ib/bin/targets/ramips/mt7620/*sysupgrade.bin out/
cp ib/bin/targets/ramips/mt7620/sha256sums out/ 2>/dev/null || true
echo "$VARIANT" > out/VARIANT.txt
ls -l out
