#!/usr/bin/env bash
# ALAMEER SOFTWARE - static consistency checks of the project (no OpenWrt tree needed).
#  * defaults (IP, netmask, hostname, SSIDs) are what the specification says
#  * every file referenced by a package Makefile install rule exists
#  * theme templates exist and load alameer.js; controller has the top-level Quick Setup entry
#  * first-boot script has the IP fallback; inline JS of LuCI views parses
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fails=0
ok()  { echo "PASS  $*"; }
bad() { echo "FAIL  $*"; fails=$((fails+1)); }
chk() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }

C="$ROOT/files/etc/config/alameer"
chk "default LAN IP 192.168.1.20"        grep -q "option lan_ip '192.168.1.20'" "$C"
chk "default netmask 255.255.255.0"       grep -q "option netmask '255.255.255.0'" "$C"
chk "default hostname Al-Makhadhi-K2"     grep -q "option hostname 'Al-Makhadhi-K2'" "$C"
chk "default SSID AbduRaheem_2G (open)"   grep -q "option ssid 'AbduRaheem_2G'" "$C"
chk "default SSID AbduRaheem_5G (open)"   grep -q "option ssid 'AbduRaheem_5G'" "$C"
chk "DHCP disabled by default (AP mode)"  grep -q "uci set dhcp.lan.ignore=1" "$ROOT/packages/luci-app-alameer/root/usr/sbin/alameer-apply"
FB="$ROOT/files/etc/uci-defaults/99-alameer-first-boot"
chk "first boot: IP fallback present"     grep -q "fallback: forcing network.lan" "$FB"
chk "first boot: reverts partial changes" grep -q "uci -q revert network" "$FB"
chk "first boot: theme selected"          grep -q "mediaurlbase='/luci-static/alameer'" "$FB"
chk "apply never dies before commit (radios soft)" bash -c "! sed -n '/^find_radios()/,/^}/p' '$ROOT/packages/luci-app-alameer/root/usr/sbin/alameer-apply' | grep -q die"

# Makefile install rules -> files exist
for mk in "$ROOT"/packages/*/Makefile; do
	pkg="$(dirname "$mk")"
	while IFS= read -r src; do
		[ -z "$src" ] && continue
		compgen -G "$pkg/$src" >/dev/null && ok "$(basename "$pkg"): $src exists" || bad "$(basename "$pkg"): Makefile references missing '$src'"
	done < <(grep -E 'INSTALL_(BIN|DATA|CONF)' "$mk" | grep -oE '\./[^ ]+' | sed 's|^\./||')
done

T="$ROOT/packages/luci-theme-alameer"
for f in header footer sysauth; do chk "theme template $f.htm" test -s "$T/luasrc/view/themes/alameer/$f.htm"; done
chk "header loads alameer.js"             grep -q "alameer.js" "$T/luasrc/view/themes/alameer/header.htm"
chk "header wraps bootstrap header"       grep -q 'themes/bootstrap/header' "$T/luasrc/view/themes/alameer/header.htm"
for f in cascade.css alameer.js logo-160.png favicon.png favicon.ico; do chk "theme asset $f" test -s "$T/files/www/luci-static/alameer/$f"; done
chk "logo.png in branding/"               test -s "$ROOT/branding/logo.png"
CT="$ROOT/packages/luci-app-alameer/luasrc/controller/alameer.lua"
chk "Quick Setup is a top-level entry"    grep -q 'entry({"admin", "alameer"}, template("alameer/setup")' "$CT"
chk "Quick Setup not under Network"       bash -c "! grep -q '\"admin\", \"network\", \"alameer\"' '$CT'"
chk "setup page uses admin/alameer URLs"  grep -q 'url("admin/alameer")' "$ROOT/packages/luci-app-alameer/luasrc/view/alameer/setup.htm"

if command -v node >/dev/null 2>&1; then
	tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
	i=0
	for f in "$ROOT"/packages/luci-app-alameer/luasrc/view/alameer/*.htm; do
		python3 - "$f" "$tmp/$(basename "$f").js" <<'PY'
import re,sys
s=open(sys.argv[1]).read()
js="\n".join(re.sub(r"<%.*?%>","X",m) for m in re.findall(r'<script type="text/javascript">(.*?)</script>',s,re.S))
open(sys.argv[2],'w').write(js)
PY
		if [ -s "$tmp/$(basename "$f").js" ]; then node --check "$tmp/$(basename "$f").js" 2>/dev/null && ok "inline JS parses: $(basename "$f")" || bad "inline JS error: $(basename "$f")"; fi
	done
	node --check "$T/files/www/luci-static/alameer/alameer.js" && ok "alameer.js parses" || bad "alameer.js syntax error"
fi
[ "$fails" -eq 0 ] && { echo "ALL PROJECT CHECKS PASSED"; exit 0; } || { echo "$fails PROJECT CHECK(S) FAILED"; exit 1; }
