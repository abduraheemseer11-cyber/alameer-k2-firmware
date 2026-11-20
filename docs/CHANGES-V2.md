# ALAMEER SOFTWARE K2 – V2 improvements

Base kept unchanged: OpenWrt **v22.03.7**, profile **phicomm_k2-v22.5**, flash layout and size limits
(7552k partition, 7.4 MiB gate) are untouched.

## 1. Default IP (192.168.1.20 / 255.255.255.0 / Al-Makhadhi-K2)
Root cause found in V1: `alameer-apply` aborted (`die`) when no Wi-Fi radio was visible yet at first boot, **before**
`uci commit`, so *all* staged changes (IP, bridge, hostname) were thrown away and OpenWrt's 192.168.1.1 stayed.
Fixes:
* Radio discovery is now non-fatal and runs **before** any change (atomic: nothing is modified if it fails).
* First-boot script has a guaranteed fallback: reverts staged changes, forces `network.lan` to the IP/netmask from
  `/etc/config/alameer`, sets the hostname, logs to `/etc/alameer/first-boot.log`.
* The script lives in the ROM (`/etc/uci-defaults`), so a **factory reset re-applies** the defaults.
* Persistent log `/etc/alameer/first-boot.log` records exactly what happened.

## 2. New LuCI UI (theme `luci-theme-alameer` v2)
Fixed sidebar built from the real LuCI menu: **Quick Setup (NEW) · Dashboard · Network · Wireless · System · Status ·
Security · System Logs**, logo on top, footer credit, SVG icons, card layout, crimson/silver/white palette, phone
layout (burger menu), branded login page. Any LuCI page not in this list appears under *More* so nothing becomes
unreachable. If the sidebar script fails, the stock menu stays visible. The theme *wraps* Bootstrap's templates
(`include`) instead of copying them, so all JS views keep working.
**Quick Setup is a stand-alone top-level page** (`admin/alameer`), not under Network.
Not included: the Simple/Advanced toggle and dark mode seen in the reference screenshot.

## 3. Wi-Fi 2.4 / 5 GHz
* In LuCI's wireless overview the button next to a radio reads **"Disable" when the radio is currently enabled** and
  "Enable" when it is off. So "Disable" alone is not proof that the radios are off – check `alameer-diag`.
* Hardening of provisioning: radios are enabled (`disabled=0`), country set, TX power not forced; if the radios were
  not probed at first boot a `wifi.pending` marker makes `alameer-boot` finish Wi-Fi setup at the next boot.
* New read-only tool **`alameer-diag`** (also a button on the Dashboard) prints: LAN settings, `/proc/mtd`, loaded
  wireless modules, PCI ids (MT7612E), phy list, wireless UCI, `wifi status`, `iwinfo`, kernel/system log lines.
  Needed to identify a real driver/calibration problem; I did not change EEPROM/ART or force TX power.

## 4. Tests / CI
`scripts/check-project.sh` (defaults, Makefile references, theme, controller), `scripts/test-theme-menu.js`
(sidebar model), plus the earlier script/permission checks, all run in GitHub Actions before the build.
