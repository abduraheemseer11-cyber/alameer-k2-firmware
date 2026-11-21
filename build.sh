#!/usr/bin/env bash
set -euo pipefail

IB_DIR="${IB_DIR:-openwrt-imagebuilder-23.05.3-ramips-mt7620.Linux-x86_64}"
PROFILE="phicomm_k2-v22.5"
MAX_IMAGE_BYTES=$((7 * 1024 * 1024))

[[ -d "$IB_DIR" ]] || { echo "ERROR: Missing ImageBuilder directory: $IB_DIR" >&2; exit 1; }
[[ -f packages.txt && -d files ]] || { echo "ERROR: Run from project root." >&2; exit 1; }

mapfile -t PACKAGES < <(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' packages.txt | xargs -n1)
mkdir -p output
make -C "$IB_DIR" image PROFILE="$PROFILE" PACKAGES="${PACKAGES[*]}" FILES="$PWD/files" BIN_DIR="$PWD/output"

MANIFEST="$(find output -maxdepth 1 -type f -name "*${PROFILE}*.manifest" -print -quit)"
[[ -n "$MANIFEST" ]] || MANIFEST="$(find output -maxdepth 1 -type f -name '*.manifest' -print -quit)"
[[ -n "$MANIFEST" ]] || { echo "ERROR: ImageBuilder did not produce a manifest." >&2; exit 1; }
cp "$MANIFEST" output/firmware.manifest

FORBIDDEN='^(dropbear|dnsmasq(-full)?|odhcpd(-[^[:space:]]*)?|odhcp6c|unbound|uhttpd-mod-tls|luci(-[^[:space:]]*)?|rpcd-mod-luci|firewall4?|nftables|iptables|ppp(-[^[:space:]]*)?|libustream-[^[:space:]]*)($|[[:space:]])'
if grep -Eq "$FORBIDDEN" output/firmware.manifest; then
  echo "ERROR: Forbidden package found:" >&2
  grep -E "$FORBIDDEN" output/firmware.manifest >&2
  exit 1
fi
for required in uhttpd uhttpd-mod-ubus rpcd rpcd-mod-iwinfo rpcd-mod-file rpcd-mod-rpcsys; do
  grep -Eq "^${required}([[:space:]]|$)" output/firmware.manifest || {
    echo "ERROR: Required package missing from manifest: $required" >&2; exit 1;
  }
done

mapfile -t IMAGES < <(find output -maxdepth 1 -type f \( -name '*sysupgrade.bin' -o -name '*factory.bin' \) -print)
((${#IMAGES[@]} > 0)) || { echo "ERROR: No firmware image found." >&2; exit 1; }
for image in "${IMAGES[@]}"; do
  size="$(stat -c '%s' "$image")"
  if (( size > MAX_IMAGE_BYTES )); then
    echo "ERROR: $image is $size bytes; maximum is 7 MiB." >&2; exit 1
  fi
  echo "PASS: $(basename "$image") size=$size bytes"
done
sha256sum output/* > output/SHA256SUMS
