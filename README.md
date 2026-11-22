# ALAMEER SOFTWARE - Phicomm K2 (PSG1218a, 8MB) Custom Firmware

OpenWrt 19.07.10 (ramips/mt7620, profile `psg1218a`) built with ImageBuilder on GitHub Actions.

## How to build
1. Upload this whole folder to a new GitHub repository (branch `main`).
2. Go to **Actions -> Build ALAMEER K2 Firmware -> Run workflow**.
3. Download `ALAMEER-K2-19.07.10-sysupgrade.bin` from the run's Artifacts (or from Releases).
4. Flash it from the Breed web interface (http://192.168.1.1 in Breed mode).

## Where to change things
| What | File |
|---|---|
| IP, SSIDs, channels, TX power, country, timezone | `files/etc/uci-defaults/99-alameer` (variables at the top) |
| Packages added/removed | `packages.txt` |
| Theme / colors | `files/www/luci-static/alameer/cascade.css` |
| Sidebar / header / login page | `files/usr/lib/lua/luci/view/themes/alameer/*.htm` |
| About the Developer page | `files/usr/lib/lua/luci/view/alameer/about.htm` |

## Defaults
LAN 192.168.1.20/24 (HTTP port 80 only), DHCP/DHCPv6 off, no WAN, no IPv6/PPPoE, SSH off,
hostname ALAMEER-SOFTWARE, timezone Asia/Aden, SSIDs AbduRaheem_2G (ch 6, 20MHz, 20dBm) /
AbduRaheem_5G (ch 36, 40MHz, 23dBm), both open, default language Arabic.

## Notes
* The theme is a first draft written without a device to test on. If a page renders badly, change
  `uci set luci.main.mediaurlbase='/luci-static/bootstrap'` (bootstrap is included as a fallback),
  or fix it via failsafe mode.
* If the build output is larger than 6.5 MB the workflow prints a warning - trim `packages.txt`.
