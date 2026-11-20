<p align="center"><img src="branding/logo.png" width="180" alt="ALAMEER SOFTWARE"></p>

# ALAMEER SOFTWARE – Professional Router Firmware (Phicomm K2 PSG1218, v22.5 layout)

Developed by **Eng. Abdulrahim Al-Makhadhi** – المهندس عبد الرحيم الماخذي

OpenWrt-based firmware project for MT7620A + MT7612E, 64 MB RAM, 8 MB flash. Source project only:
**the firmware BIN is built by GitHub Actions**; nothing in this repository is a prebuilt binary.

## Status – read this first
* The project has **not been built or flashed by its author in this delivery** (no build environment was
  available). Expect to fix small issues on the first Actions run. Gates (`verify-device.sh`,
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
