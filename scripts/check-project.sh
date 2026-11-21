#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "FAIL: $*" >&2; exit 1; }
pass(){ echo "PASS: $*"; }
[ -s "$ROOT/files/www/luci-static/alameer/logo.png" ] || fail 'logo missing'
[ -s "$ROOT/files/www/luci-static/resources/view/alameer/quicksetup.js" ] || fail 'Quick Setup JS missing'
[ -s "$ROOT/files/www/luci-static/alameer/cascade.css" ] || fail 'purple theme CSS missing'
[ -x "$ROOT/files/etc/uci-defaults/99-alameer-defaults" ] || fail 'first boot script is not executable'
grep -q '192.168.1.20' "$ROOT/files/etc/uci-defaults/99-alameer-defaults" || fail 'LAN IP default missing'
grep -q "AbduRaheem_2G" "$ROOT/files/etc/uci-defaults/99-alameer-defaults" || fail '2.4 GHz SSID missing'
grep -q "AbduRaheem_5G" "$ROOT/files/etc/uci-defaults/99-alameer-defaults" || fail '5 GHz SSID missing'
grep -q "Access Point WDS" "$ROOT/files/www/luci-static/resources/view/alameer/quicksetup.js" || fail 'AP WDS mode missing'
grep -q "Client WDS" "$ROOT/files/www/luci-static/resources/view/alameer/quicksetup.js" || fail 'Client WDS mode missing'
grep -q "Mesh" "$ROOT/files/www/luci-static/resources/view/alameer/quicksetup.js" || fail 'Mesh mode missing'
grep -q '^wpad-mesh-wolfssl$' "$ROOT/packages.txt" || fail 'mesh-capable wpad package missing'
grep -q '^kmod-mt76x2$' "$ROOT/packages.txt" || fail 'MT7612E driver package missing'
grep -q '^MAX_IMAGE_BYTES=6000000$' "$ROOT/config.env" || fail 'strict image size gate missing'
pass 'project structure and required configuration'
if command -v bash >/dev/null; then bash -n "$ROOT/scripts/check-project.sh"; fi
pass 'shell syntax'
echo 'All static project checks passed.'
