#!/usr/bin/env bash
# ALAMEER SOFTWARE - verify the device definition in an OpenWrt source tree BEFORE building.
# Usage: verify-device.sh <openwrt-source-dir> [project-dir]
# Fails (exit 1) if the Phicomm K2 v22.5 profile / flash layout is not exactly what this project expects.
set -u
SRC="${1:?usage: $0 <openwrt-source-dir> [project-dir]}"
PRJ="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
DEV="phicomm_k2-v22.5"
MK="$SRC/target/linux/ramips/image/mt7620.mk"
DTS="$SRC/target/linux/ramips/dts/mt7620a_phicomm_k2-v22.5.dts"
DTSI="$SRC/target/linux/ramips/dts/mt7620a_phicomm_k2x.dtsi"
NET="$SRC/target/linux/ramips/mt7620/base-files/etc/board.d/02_network"
fail=0
bad() { echo "FAIL: $*"; fail=1; }
ok()  { echo "ok:   $*"; }

[ -f "$MK" ] || { echo "FAIL: $MK not found - is $SRC an OpenWrt tree?"; exit 1; }

if ! grep -q "^define Device/$DEV\$" "$MK"; then
	bad "device profile '$DEV' does not exist in this OpenWrt source."
	echo "      Profiles found for Phicomm K2/PSG1218 in this tree:"
	grep -E '^define Device/phicomm_(k2|psg1218)' "$MK" | sed 's/^/        /'
	echo "      The v22.5 layout profile was added to OpenWrt in Aug 2021 (after the 21.02 branch point),"
	echo "      so use a newer pinned tag (default: v22.03.7). Do NOT flash a v22.4/PSG1218 image on a v22.5 unit."
	exit 1
fi
ok "device profile $DEV present"

blk="$(awk "/^define Device\/$DEV\$/,/^endef/" "$MK")"
echo "$blk" | grep -q 'SOC := mt7620a' && ok "SOC mt7620a" || bad "SOC is not mt7620a"
echo "$blk" | grep -q 'IMAGE_SIZE := 7552k' && ok "IMAGE_SIZE 7552k (= 0x760000)" || bad "IMAGE_SIZE differs from 7552k"
echo "$blk" | grep -q 'kmod-mt76x2' && ok "MT7612E driver kmod-mt76x2 in DEVICE_PACKAGES" || bad "kmod-mt76x2 missing from DEVICE_PACKAGES"

[ -f "$DTS" ] && ok "DTS $(basename "$DTS") exists" || bad "DTS $DTS missing"
if [ -f "$DTS" ]; then
	grep -q 'compatible = "phicomm,k2-v22.5"' "$DTS" && ok "DTS compatible phicomm,k2-v22.5" || bad "DTS compatible string mismatch"
	grep -q 'label = "permanent_config"' "$DTS" && ok "permanent_config partition present (v22.5 layout)" || bad "permanent_config partition missing"
	grep -Eq '0xa0000[[:space:]]+0x760000' "$DTS" && ok "firmware partition = 0xa0000 + 0x760000" || bad "firmware partition is not <0xa0000 0x760000>"
fi
if [ -f "$DTSI" ]; then
	grep -q 'label = "factory"' "$DTSI" && ok "factory (ART/EEPROM/calibration) partition defined" || bad "factory partition not found in $DTSI"
	awk '/label = "factory"/,/};/' "$DTSI" | grep -q 'read-only' && ok "factory partition is read-only" || bad "factory partition NOT read-only"
else bad "$DTSI missing"; fi
grep -q 'phicomm,k2-v22.5' "$NET" && ok "board.d/02_network knows phicomm,k2-v22.5 (switch + MAC setup)" || bad "02_network has no phicomm,k2-v22.5 entry"
grep -Eq 'swconfig|ucidef_add_switch' "$NET" && ok "swconfig switch definitions present in 02_network" || bad "no switch definitions found"

# Project safety: nothing may write to ART/EEPROM/bootloader partitions
if grep -rEn 'mtd[[:space:]]+(-[a-z]+[[:space:]]+)*(write|erase|unlock)[^|;&]*(factory|art|eeprom|u-boot|config)|dd[[:space:]].*of=/dev/mtd' \
	"$PRJ/files" "$PRJ/packages" "$PRJ/patches" 2>/dev/null; then
	bad "project files contain commands that could write calibration/bootloader partitions"
else ok "no project file writes to factory/ART/bootloader partitions"; fi
if ls "$PRJ"/patches/*.patch >/dev/null 2>&1 && grep -lEi 'factory|eeprom|\bART\b' "$PRJ"/patches/*.patch 2>/dev/null; then
	bad "a patch touches factory/EEPROM/ART - review it manually"
fi

if [ "$fail" -ne 0 ]; then echo; echo "DEVICE VERIFICATION FAILED - build aborted."; exit 1; fi
echo; echo "Device verification passed for $DEV."
