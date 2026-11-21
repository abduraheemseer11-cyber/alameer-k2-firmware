#!/usr/bin/env bash
# Post-build check (runs in GitHub Actions): confirms the generated root filesystem really
# contains the theme, the views, the menu/ACL files and the preserved default settings.
set -euo pipefail

IB="${1:?usage: verify_image_contents.sh <imagebuilder dir>}"
ROOTFS="$(find "$IB/build_dir" -maxdepth 3 -type d -name 'root-*' | head -n1)"
[ -n "$ROOTFS" ] || { echo "ERROR: root filesystem directory not found under $IB/build_dir"; exit 1; }
echo "Root filesystem: $ROOTFS"

fail=0
need() {
	if [ -e "$ROOTFS/$1" ]; then echo "  ok   /$1"; else echo "  MISSING /$1"; fail=1; fi
}

need usr/share/ucode/luci/template/themes/almakhdhi/header.ut
need usr/share/ucode/luci/template/themes/almakhdhi/footer.ut
need www/luci-static/almakhdhi/cascade.css
need www/luci-static/almakhdhi/logo.png
need www/luci-static/almakhdhi/favicon.png
need www/luci-static/almakhdhi/amk-early.js
need www/luci-static/bootstrap/cascade.css
need www/luci-static/resources/menu-bootstrap.js
need www/luci-static/resources/menu-almakhdhi.js
need www/luci-static/resources/almakhdhi/i18n.js
need www/luci-static/resources/almakhdhi/qsvalidate.js
need www/luci-static/resources/view/almakhdhi/dashboard.js
need www/luci-static/resources/view/almakhdhi/quicksetup.js
need usr/share/luci/menu.d/luci-app-almakhdhi.json
need usr/share/rpcd/acl.d/luci-app-almakhdhi.json
need etc/uci-defaults/98-almakhdhi-theme
need etc/uci-defaults/99-custom-settings
need etc/banner
need usr/share/ucode/luci/template/themes/bootstrap/header.ut

grep -q "menu-almakhdhi" "$ROOTFS/usr/share/ucode/luci/template/themes/almakhdhi/footer.ut" || { echo "  footer.ut does not load menu-almakhdhi"; fail=1; }
grep -q "amk-early.js"   "$ROOTFS/usr/share/ucode/luci/template/themes/almakhdhi/header.ut" || { echo "  header.ut does not load amk-early.js"; fail=1; }
grep -q "AbduRaheem"     "$ROOTFS/etc/banner" || { echo "  banner lost AbduRaheem"; fail=1; }
grep -q "192.168.1.20"   "$ROOTFS/etc/uci-defaults/99-custom-settings" || { echo "  99-custom-settings lost LAN IP"; fail=1; }
[ -x "$ROOTFS/etc/uci-defaults/98-almakhdhi-theme" ] || { echo "  98-almakhdhi-theme is not executable"; fail=1; }
[ -x "$ROOTFS/etc/uci-defaults/99-custom-settings" ] || { echo "  99-custom-settings is not executable"; fail=1; }

echo
echo "Size added by the AlMakhdhi theme (uncompressed):"
du -sch "$ROOTFS/www/luci-static/almakhdhi" "$ROOTFS/www/luci-static/resources/almakhdhi" \
        "$ROOTFS/www/luci-static/resources/view/almakhdhi" "$ROOTFS/www/luci-static/resources/menu-almakhdhi.js" \
        "$ROOTFS/usr/share/ucode/luci/template/themes/almakhdhi" | tail -n1

[ "$fail" -eq 0 ] || { echo "Image content verification FAILED"; exit 1; }
echo "Image content verification passed."
