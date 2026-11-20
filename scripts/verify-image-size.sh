#!/usr/bin/env bash
# ALAMEER SOFTWARE - verify a built sysupgrade image: size, uImage header, target device string.
# Usage: verify-image-size.sh <image.bin> <openwrt-source-dir>
# Env:   MAX_BYTES  extra upper limit (default 7759462 = 7.4 MiB); the real limit is min(MAX_BYTES, IMAGE_SIZE of the profile)
set -u
IMG="${1:?usage: $0 <image.bin> <openwrt-source-dir>}"; SRC="${2:?missing source dir}"
DEV="phicomm_k2-v22.5"; BOARD="phicomm,k2-v22.5"
MK="$SRC/target/linux/ramips/image/mt7620.mk"
[ -f "$IMG" ] || { echo "FAIL: image $IMG not found"; exit 1; }

sz="$(awk "/^define Device\/$DEV\$/,/^endef/" "$MK" | sed -n 's/^[[:space:]]*IMAGE_SIZE := \([0-9]*\)k.*/\1/p')"
[ -n "$sz" ] || { echo "FAIL: cannot read IMAGE_SIZE for $DEV from $MK"; exit 1; }
part=$((sz * 1024))
max="${MAX_BYTES:-7759462}"; [ "$part" -lt "$max" ] && max="$part"
size="$(stat -c %s "$IMG")"
echo "image size      : $size bytes ($(awk "BEGIN{printf \"%.2f\", $size/1048576}") MiB)"
echo "firmware part.  : $part bytes (${sz}k)"
echo "allowed maximum : $max bytes"
echo "free in partition (left for overlay/settings): $((part - size)) bytes"

rc=0
if [ "$size" -gt "$max" ]; then
	echo "FAIL: image is $((size - max)) bytes over the limit. NOT a flashable image. Remove packages (see configs/base.config)."; rc=1
fi
magic="$(head -c4 "$IMG" | od -An -tx1 | tr -d ' \n')"
[ "$magic" = "27051956" ] && echo "uImage magic    : ok" || { echo "FAIL: not a uImage-based sysupgrade image (magic=$magic)"; rc=1; }
if tail -c 4096 "$IMG" | strings | grep -q "$BOARD"; then echo "device metadata : contains '$BOARD'"
else echo "FAIL: image metadata does not list supported device '$BOARD'"; rc=1; fi
# Keep room for the JFFS2 overlay: warn if less than 256 KiB is left
[ $((part - size)) -lt 262144 ] && [ "$rc" -eq 0 ] && echo "WARNING: less than 256 KiB left in the firmware partition; settings/opkg space will be very small."
[ "$rc" -eq 0 ] && echo "SIZE/FORMAT CHECK PASSED" || echo "SIZE/FORMAT CHECK FAILED"
exit $rc
