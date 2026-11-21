<<<<<<< HEAD
# Alameer Software – Phicomm K2 v22.5 WISP firmware

Custom OpenWrt **25.12.6** image for the **Phicomm K2 v22.5** (`ramips/mt7620`, profile `phicomm_k2-v22.5`, 8 MB flash / 64 MB RAM), built with the official ImageBuilder and GitHub Actions.

## Build with GitHub Actions
1. Create a repo, push this folder to `main`.
2. **Actions → Build Alameer K2 firmware → Run workflow** (a push to `main` also triggers it).
3. Download the `alameer-k2-firmware` artifact (`*sysupgrade.bin`, manifest, `sha256sums.txt`). Tick *release* to publish a GitHub Release instead.

The build fails automatically if the image is larger than the 7552k firmware partition.

## Build locally (Linux)
```bash
sudo apt install build-essential gawk wget zstd xz-utils file python3 rsync
./scripts/build.sh            # or: ./scripts/build.sh 25.12.6
```
The equivalent raw ImageBuilder command (what `build.sh` runs):
```bash
make image PROFILE="phicomm_k2-v22.5" \
  PACKAGES="$(grep -v '^\s*#' packages.txt | tr '\n' ' ')" \
  FILES=/path/to/files EXTRA_IMAGE_NAME=alameer
```

## Layout
| Path | Purpose |
|---|---|
| `config.env`, `packages.txt` | version / profile and the package list (`-pkg` = removed) |
| `scripts/build.sh`, `.github/workflows/build.yml` | build + size check |
| `files/etc/uci-defaults/99-alameer-config` | first-boot defaults (IP, SSIDs, radios, SNMP, theme) |
| `files/usr/share/ucode/luci/template/themes/alameer/` | `header.ut` / `footer.ut` |
| `files/www/luci-static/alameer/` | `cascade.css`, `logo.svg` |
| `files/www/luci-static/resources/menu-alameer.js` | sidebar / tab menu |
| `files/www/luci-static/resources/view/alameer/quicksetup.js` | Quick Setup wizard (4 modes) |
| `files/usr/libexec/alameer/quicksetup-apply` | writes UCI + reloads services |
| `files/usr/share/luci/menu.d`, `.../rpcd/acl.d` | menu entry `admin/quicksetup` and permissions |

## Defaults
LAN `192.168.1.20/24`, hostname `Alameer-K2`, SSIDs `AbduRaheem_2G` (HT40) / `AbduRaheem_5G` (VHT80), country `BO`, TX power 20 / 23 dBm, channel auto, **Wi-Fi password `12345678`** (change it, or set `WIFI_KEY=""` in the script for open Wi-Fi), SNMP v2c community `public` on UDP 161 (also allowed from the uplink/WAN zone – remove the `Allow-SNMP-WAN` rule if you don't want that). All editable at the top of `99-alameer-config`.

## Differences from the original brief (OpenWrt 25.12 reality)
- **LuCI is JavaScript + ucode in 25.12; Lua controllers/CBI no longer exist.** The wizard is therefore a JS view + `menu.d` JSON + rpcd ACL (still served at `/cgi-bin/luci/admin/quicksetup`), and the theme uses `header.ut` / `footer.ut` instead of `header.htm` / `footer.htm`.
- 25.12 uses **apk**, not opkg. `wpad-mesh-mbedtls` is used (smaller than wolfssl); swap to `wpad-mesh-wolfssl` in `packages.txt` if it is not available.
- The mt7620 switch uses **swconfig**, not DSA. The management VLAN adds a tagged `eth0.<id>` interface and never removes the untagged LAN.
- The Wi-Fi radios are detected by band (`2g`/`5g`), not by the `radio0`/`radio1` name, because the numbering can differ.
- The theme imports the bootstrap theme's CSS for the widgets (dropdowns, modals), so `luci-theme-bootstrap` stays in the image (also a safe fallback).

## Status
Shell, JSON, SVG, YAML, JS syntax were checked. **Not tested on a real K2 or in a real ImageBuilder run** – do a first build and flash on a spare unit, and keep serial/TFTP recovery in mind.
=======
<p align="center"><img src="branding/logo.png" width="180" alt="ALAMEER SOFTWARE"></p>

# ALAMEER SOFTWARE – Professional Router Firmware (Phicomm K2 PSG1218, v22.5 layout)

Developed by **Eng. Abdulrahim Al-Makhadhi** – المهندس عبد الرحيم الماخذي

OpenWrt-based firmware project for MT7620A + MT7612E, 64 MB RAM, 8 MB flash. Source project only:
**the firmware BIN is built by GitHub Actions**; nothing in this repository is a prebuilt binary.

## V2 (2.0.0)
See `docs/CHANGES-V2.md`: default-IP root-cause fix, new sidebar UI with Quick Setup as a top-level item, Wi-Fi provisioning hardening and `alameer-diag`.

## Status – read this first
* V2 changes were **not built or flashed by the author** (no build environment); the V1 base reportedly built on Actions. Expect to fix small issues on the first Actions run. Gates (`verify-device.sh`,
  `verify-image-size.sh`) make sure a bad image is never published as flashable.
* Pinned to OpenWrt **v22.03.7** (not 21.02.7): the `phicomm_k2-v22.5` profile does not exist in 21.02 – see
  `docs/HARDWARE.md`. You can try another tag through the workflow input; the device gate decides.
* LuCI theme/app are written for **Lua LuCI (21.02/22.03)**.

## What is inside
| Path | Purpose |
|---|---|
| `.github/workflows/build-firmware.yml` | CI: deps → selftest → build → verify → package → artifacts / release |
| `scripts/build.sh` | Clone pinned OpenWrt, verify device, feeds, apply project, `make` |
| `scripts/verify-device.sh` | Checks profile, 7552k size, DTS flash layout, read-only `factory`, MT7612E driver |
| `scripts/verify-image-size.sh` | Size ≤ min(7.4 MiB, partition), uImage magic, device string in metadata |
| `scripts/package-release.sh` | Produces `ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin` + sha256 + manifest |
| `scripts/selftest.sh` | Tests the gates against a synthetic tree |
| `scripts/check-scripts.sh`, `check-project.sh`, `test-theme-menu.js` | Script robustness, project consistency, sidebar unit test |
| `scripts/fix-permissions.sh` | Restore exec bits and record them in Git |
| `configs/base.config` | Size-optimised config (no IPv6/PPP/USB, squashfs block 1024, wpad-basic-wolfssl) |
| `files/` | Rootfs overlay: banner, `/etc/config/alameer`, first-boot provisioning |
| `packages/luci-theme-alameer` | Deep-crimson theme (CSS layer over Bootstrap templates), logo, favicon, footer |
| `packages/luci-app-alameer` | Dashboard, Quick Setup (AP / Repeater+WISP / Router), `alameer-apply` |
| `packages/alameer-watchdog` | Rate-limited network/Wi-Fi/memory watchdog (reboot off by default) |
| `docs/` | Installation, network modes, hardware, troubleshooting |

## Quick start
1. Create a GitHub repo and push this folder (see below).
2. Actions → **Build ALAMEER K2 Firmware** → *Run workflow* (≈1–2 h).
3. Download artifact **ALAMEER-K2-firmware** → `ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin`.
4. Read `docs/INSTALLATION.md`, then flash.

```bash
git init && git add . && git commit -m "ALAMEER K2 firmware project"
git branch -M main
git remote add origin https://github.com/<you>/ALAMEER-SOFTWARE-K2.git
git push -u origin main
```
Pushing a tag `v22.5.0` also builds and creates a GitHub Release.

## Defaults
Hostname `Al-Makhadhi-K2`, LAN `192.168.1.20/24`, AP/bridge mode, DHCP and NAT off, SSIDs `AbduRaheem_2G`
and `AbduRaheem_5G` **open**, country `US` (adjust to your location), TX power not forced.
>>>>>>> d777d6c1c18170daf611fdd513ab792332509ebb
