#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

. "$ROOT/config.env"
[ "$PROFILE" = 'phicomm_k2-v22.5' ] || fail 'wrong target profile'
[ "$MAX_IMAGE_BYTES" = '7733248' ] || fail 'unexpected firmware partition limit'
pass 'Phicomm K2 v22.5 profile and size limit'

grep -q "LAN_IP=\"192.168.1.20\"" "$ROOT/files/etc/uci-defaults/99-alameer-config" || fail 'default LAN IP missing'
grep -qE "^WIFI_COUNTRY=[A-Z]{2}$" "$ROOT/config.env" || fail 'regulatory country setting missing'
grep -q 'kmod-mt76x2' "$ROOT/packages.txt" || fail 'MT7612E driver package missing'
grep -q 'uci set dhcp.lan.ignore' "$ROOT/files/etc/uci-defaults/99-alameer-first-boot" || fail 'AP mode must disable LAN DHCP'
pass 'network defaults and MT76x2 package selection'

for f in \
  files/usr/share/ucode/luci/template/themes/alameer/header.ut \
  files/usr/share/ucode/luci/template/themes/alameer/footer.ut \
  files/www/luci-static/alameer/cascade.css \
  files/www/luci-static/alameer/logo.svg \
  files/www/luci-static/alameer/logo.png \
  files/www/luci-static/resources/menu-alameer.js \
  files/www/luci-static/resources/view/alameer/quicksetup.js \
  files/usr/sbin/alameer-wifi-diag \
  files/usr/share/luci/menu.d/luci-app-alameer.json \
  files/usr/share/rpcd/acl.d/luci-app-alameer.json; do
  [ -s "$ROOT/$f" ] || fail "missing required LuCI asset: $f"
done
pass 'ucode theme, sidebar, Quick Setup view and ACL assets'

if command -v node >/dev/null 2>&1; then
  node --check "$ROOT/files/www/luci-static/resources/menu-alameer.js"
  node --check "$ROOT/files/www/luci-static/resources/view/alameer/quicksetup.js"
  node --check "$ROOT/files/www/luci-static/resources/view/status/include/90_alameer.js"
  pass 'LuCI JavaScript syntax'
fi
sh -n "$ROOT/files/etc/uci-defaults/99-alameer-config"
sh -n "$ROOT/files/etc/uci-defaults/99-alameer-first-boot"
sh -n "$ROOT/files/usr/libexec/alameer/quicksetup-apply"
sh -n "$ROOT/files/usr/sbin/alameer-wifi-diag"
pass 'first-boot and Quick Setup shell syntax'

grep -q '#amtop' "$ROOT/files/www/luci-static/alameer/cascade.css" || fail 'topbar styles missing'
grep -q '@media (max-width:900px)' "$ROOT/files/www/luci-static/alameer/cascade.css" || fail 'mobile responsive layout missing'
grep -q "_('Quick Setup')" "$ROOT/files/www/luci-static/resources/menu-alameer.js" || fail 'Quick Setup first menu entry missing'
pass 'desktop/mobile design hooks and independent Quick Setup menu entry'
echo 'ALL PROJECT CHECKS PASSED'
