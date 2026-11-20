#!/usr/bin/env bash
# ALAMEER SOFTWARE - self-test of the verification gates using a synthetic source tree.
# This does NOT replace a real build; it proves the gates pass/fail as designed.
set -u
D="$(cd "$(dirname "$0")" && pwd)"; PRJ="$D/.."
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/target/linux/ramips/image" "$T/target/linux/ramips/dts" "$T/target/linux/ramips/mt7620/base-files/etc/board.d"
cat > "$T/target/linux/ramips/image/mt7620.mk" <<'EOF'
define Device/phicomm_k2-v22.5
  SOC := mt7620a
  IMAGE_SIZE := 7552k
  DEVICE_PACKAGES := kmod-mt76x2
endef
TARGET_DEVICES += phicomm_k2-v22.5
EOF
cat > "$T/target/linux/ramips/dts/mt7620a_phicomm_k2-v22.5.dts" <<'EOF'
/ { compatible = "phicomm,k2-v22.5", "ralink,mt7620a-soc"; };
&partitions {
	partition@50000 { label = "permanent_config"; reg = <0x50000 0x50000>; read-only; };
	partition@a0000 { compatible = "denx,uimage"; label = "firmware"; reg = <0xa0000 0x760000>; };
};
EOF
printf 'partition@40000 {\n\tlabel = "factory";\n\treg = <0x40000 0x10000>;\n\tread-only;\n};\n' > "$T/target/linux/ramips/dts/mt7620a_phicomm_k2x.dtsi"
echo 'phicomm,k2-v22.5) ucidef_add_switch "switch0"' > "$T/target/linux/ramips/mt7620/base-files/etc/board.d/02_network"
mkimg() { python3 - "$1" "$2" <<'EOF'
import sys
n=int(sys.argv[1]); b=bytearray(n); b[0:4]=bytes.fromhex('27051956')
t=sys.argv[2].encode(); b[-len(t):]=t
open('/tmp/_al_img.bin','wb').write(b)
EOF
}
fails=0
expect() { # desc expected_rc cmd...
	d="$1"; e="$2"; shift 2; "$@" >/dev/null 2>&1; r=$?
	if [ "$r" -eq "$e" ]; then echo "PASS  $d"; else echo "FAIL  $d (rc=$r, expected $e)"; fails=$((fails+1)); fi
}
expect "device gate accepts matching tree" 0 bash "$D/verify-device.sh" "$T" "$PRJ"
cp "$T/target/linux/ramips/image/mt7620.mk" "$T/mk.bak"
sed -i 's/phicomm_k2-v22.5/phicomm_psg1218b/g' "$T/target/linux/ramips/image/mt7620.mk"
expect "device gate rejects tree without v22.5 profile" 1 bash "$D/verify-device.sh" "$T" "$PRJ"
cp "$T/mk.bak" "$T/target/linux/ramips/image/mt7620.mk"
sed -i 's/0x760000/0x7b0000/' "$T/target/linux/ramips/dts/mt7620a_phicomm_k2-v22.5.dts"
expect "device gate rejects wrong firmware partition" 1 bash "$D/verify-device.sh" "$T" "$PRJ"
mkimg 6000000 '{"supported_devices":["phicomm,k2-v22.5"]}'
expect "size gate accepts 6.0 MB image" 0 bash "$D/verify-image-size.sh" /tmp/_al_img.bin "$T"
mkimg 7740000 '{"supported_devices":["phicomm,k2-v22.5"]}'
expect "size gate rejects image above the 7552k partition" 1 bash "$D/verify-image-size.sh" /tmp/_al_img.bin "$T"
mkimg 6000000 '{"supported_devices":["phicomm,psg1218b"]}'
expect "size gate rejects wrong device metadata" 1 bash "$D/verify-image-size.sh" /tmp/_al_img.bin "$T"
rm -f /tmp/_al_img.bin
[ "$fails" -eq 0 ] && echo "ALL SELFTESTS PASSED" || { echo "$fails SELFTEST(S) FAILED"; exit 1; }
