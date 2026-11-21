# ALAMEER SOFTWARE — Phicomm K2 V22.5

Custom OpenWrt **25.12.6** ImageBuilder project for **Phicomm K2 v22.5** (`ramips/mt7620`, profile `phicomm_k2-v22.5`). The project is designed for the 8 MB flash layout and refuses to package a sysupgrade image larger than **7,733,248 bytes** (7552 KiB).

Developed by **Eng. Abdulrahim Al-Makhadhi**.

## What this project builds

- Official OpenWrt ImageBuilder image for `phicomm_k2-v22.5`.
- ALAMEER ucode LuCI theme for OpenWrt 24.10/25.12, with dark desktop layout, fixed left sidebar, top bar, responsive mobile drawer, cards and crimson/silver branding.
- Independent **Quick Setup** menu item at the top of the sidebar, separate from Network.
- First-boot LAN management address `192.168.1.20/24` and hostname `Al-Makhadhi-K2`.
- Default SSIDs `AbduRaheem_2G` and `AbduRaheem_5G`.
- MT7612E driver package (`kmod-mt76x2`), wireless utilities, regulatory database and read-only `alameer-wifi-diag` report.

## Build with GitHub Actions

1. Create or open your GitHub repository and upload the complete project.
2. Open **Actions → Build ALAMEER K2 Firmware → Run workflow**.
3. Leave the OpenWrt version blank to use `25.12.6` from `config.env`.
4. After a successful run, download `ALAMEER-K2-firmware` from Artifacts.
5. The flashable file is `ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin`.

The build checks the ImageBuilder checksum and enforces the 7552 KiB partition limit before creating the artifact. `build.log` is uploaded separately.

## Build locally

On Ubuntu/Debian with the ImageBuilder tools installed:

```sh
bash scripts/check-scripts.sh
bash scripts/check-project.sh
bash scripts/build.sh
```

Optionally pass another official OpenWrt release version:

```sh
bash scripts/build.sh 25.12.6
```

The output files are placed in `output/`.

## LuCI layout

Desktop:
- Black top bar with ALAMEER logo and router identity.
- Fixed dark sidebar with Quick Setup first, then Dashboard, Wi-Fi, Network, System and Status entries discovered from LuCI's real menu tree.
- Dark content canvas and consistent panels, buttons, tables and forms.

Mobile:
- Compact top bar with a hamburger button.
- Slide-in navigation drawer with a dimmed backdrop and Escape-to-close support.
- Single-column forms and stacked table rows for narrow screens.

The theme is built for the ucode LuCI runtime used by OpenWrt 24.10 and 25.12. It is not the old Lua `.htm` theme package.

## Wi-Fi regulatory note — important

The build defaults to `WIFI_COUNTRY=YE` in `config.env` because the regulatory domain must match the country where the router is used. The current Linux `wireless-regdb` entry for Yemen (`YE`) lists 2.4 GHz operation but no 5 GHz allocation. Therefore, **the project cannot lawfully force a 5 GHz access point to transmit in Yemen by changing the country code to US or another country**. The 5 GHz radio/driver can be present while the regulatory rules prevent AP operation. See the Linux wireless regulatory database documentation and the `country YE` entry.

If the router will actually be operated in another country, change `WIFI_COUNTRY` in `config.env` to that country's valid ISO alpha-2 code only after confirming that the relevant 2.4/5 GHz channels are permitted there. The driver and regulatory database still determine the real allowed channels and power. No 30 dBm override is applied.

`kmod-mt76x2` is explicitly selected for the MT7612E 5 GHz chipset. The 2.4 GHz radio is provided by the MT7620 device support in the target image. If either radio still fails to start, run `alameer-wifi-diag` and share its output; it collects `iw phy`, `iw reg get`, `wifi status`, `dmesg | grep -Ei 'mt76|mt7620|firmware|eeprom|wlan'`, and `/etc/config/wireless`; do not erase or overwrite the factory calibration partition.

## Default settings and security

- LAN: `192.168.1.20`, netmask `255.255.255.0`.
- Hostname: `Al-Makhadhi-K2`.
- SSIDs: `AbduRaheem_2G` and `AbduRaheem_5G`.
- Wi-Fi is configured open by default to match the original specification. Set a strong Wi-Fi key in Quick Setup before exposing the network to users.
- Set a strong root password immediately after first boot.

## Hardware safety

This project targets **Phicomm K2 V22.5 or newer using the v22.5 flash layout only**. Do not flash this image on V22.4 or an unverified board revision. Keep a backup of the factory/calibration partition. The project has not been tested on the user's physical router in this development environment; a successful CI build is not a substitute for first-boot hardware testing.
