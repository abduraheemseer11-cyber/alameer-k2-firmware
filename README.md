# Alameer / AlMakhdhi SoftWare — Phicomm K2 (PSG1218) on OpenWrt 22.03.7

Custom firmware distribution (ramips/mt7620, mipsel_24kc) built with the official ImageBuilder.
Profiles: `phicomm_k2-v22.4`, `phicomm_k2-v22.5`.

## Build
1. Push this repo to GitHub, then run **Actions → Build Alameer firmware → Run workflow**
   (or push a tag `v1.0`). Artifacts: `factory.bin` + `sysupgrade.bin` per profile.
2. Local build: `PROFILE=phicomm_k2-v22.4 ./scripts/build-image.sh` (Linux x86_64).
3. Size guard `MAX_IMAGE_BYTES=6500000`; package tiers FULL → LITE → MIN are tried in order.
4. Optional custom regdb (country `ZZ`): `BUILD_REGDB=1`.

## First boot defaults
- Management IP `192.168.1.20/24`, gateway/DNS `192.168.1.1`, DHCP off, 5 ports bridged (AP mode).
- SSIDs `AbduRaheem_2G` (ch 6, HT20) and `AbduRaheem_5G` (ch 36, VHT80), 20 dBm.
- **Default WiFi key: `ChangeMe1234` — change it immediately** (`alameer.main.wifi_key` or LuCI).
- Runs once (`alameer.main.initialized=1`), so `sysupgrade -k` keeps your settings.

## Layout
- `.github/workflows/build-openwrt.yml`, `scripts/` — build automation, theme injection, regdb
- `files/etc/uci-defaults/99-custom-config`, `files/usr/sbin/alameer-*` — first boot + loop guard
- `files/usr/libexec/rpcd/alameer` + `acl.d` + `menu.d` — ubus bridge & LuCI menu
- `files/www/luci-static/` — theme (alameer.css/js) and the 5 tool pages

## ⚠ Items to verify on real hardware (could not be tested here)
1. **Switch port mapping** — LoopGuard defaults to LAN ports `0 1 2 3`, WAN port `4`
   (`alameer.loopguard.lan_ports / wan_port`). Check with `swconfig dev switch0 show`
   and your profile's `/etc/config/network`.
2. **Per-port counters/isolation** use `swconfig dev switch0 port N get mib` / `set disable`.
   Support on the mt7620 `esw` driver varies; if unsupported, wifi + bridge-level
   detection still works and events are logged.
3. **Theme header path** — build script handles both `header.htm` (Lua) and `header.ut`.
4. **Wi-Fi interface names / MT7612E** are resolved dynamically through `ubus network.wireless status`.
5. Regulatory overrides (Super Channel / ZZ) may be illegal in your country.
