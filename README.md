# AlMakhdhi SoftWare — TP-Link RE205 v3 (OpenWrt 24.10)

Custom OpenWrt ImageBuilder project for `ramips/mt76x8`, profile `tplink_re205-v3`.
It retains LuCI's native controllers and page logic while replacing the visible navigation shell with an AlMakhdhi-branded header and slide-out sidebar.

## What changed in this revision

### Sidebar fix
In OpenWrt 24.10 the stock `Status / System / Network / Log out` row is `#modemenu` (filled by LuCI's `menu-bootstrap.js`), not `.navbar`. The old script looked for the wrong element, so the row stayed on the main screen. `alameer.js` now loads LuCI's own menu tree (`ui.menu`) and builds the slide-out drawer from it (collapsible groups, active page highlighted, logout included). The native header, `#modemenu` and the stock sidebar are hidden; the "Unsaved changes / Apply" indicator is moved into the top bar so it stays usable. Also fixed: `inject-theme-assets.sh` used to leave a literal `\n` in the page `<head>`.

### New pages (menu: **Alameer Tools**)
| Page | What it does | Honest limits |
|---|---|---|
| **WiFi Analyzer** | `iwinfo scan` + `iw survey dump` via an rpcd plugin; canvas chart (no Chart.js, saves flash), congestion score, recommended channel, noise/busy table | Scan-based, not an SDR spectrum analyzer. Scanning on an AP briefly interrupts clients. |
| **Quick Setup** | AP / Extender (relayd) / Mesh (batman-adv + 802.11s). Validation layer → diff review → apply through LuCI's apply-with-rollback | Mesh needs the FULL package tier (see below). |
| **Super Channel** | Per-radio country profile (JP/US/DE), channel and txpower, with legal warning and previous-value backup | Uses the regulatory database. Hardware calibration/driver can still block channels. Custom `ZZ` country is experimental (`SUPER_REGDB`). |
| **Performance & Power** | Live CPU/RAM/load/temperature; cpufreq governor/min/max + auto-by-load service **when the kernel exposes cpufreq** | **MT7628 has a fixed 580 MHz clock and OpenWrt has no cpufreq for it**, so the page shows monitoring only. ImageBuilder cannot change kernel options. |
| **Loop Prevention** | STP on `br-lan` + user-space storm guard (per-port pps and multicast pps, isolate port for N seconds, uplink ports only warn) started early at boot | User-space only: no switch-ASIC or in-kernel fast path (needs a custom kernel build). RE205 has a single Ethernet port. |

### Package tiers (6,000,000-byte limit)
The workflow tries, in order: **FULL** (`iw relayd kmod-batman-adv wpad-mesh-mbedtls watchcat luci-app-watchcat`) → **LITE** (`iw relayd`) → **MIN** (`iw`). The first image under the limit wins; `BUILD-TIER.txt` in the artifact says which one. Quick Setup disables Mesh when batman-adv is absent.

### Settings survive sysupgrade
`99-custom-config` now runs the network/Wi-Fi defaults only once (`alameer.main.initialized`), so Quick Setup choices are kept by `sysupgrade -k`.

> This source was prepared without running a GitHub build or flashing a device. Check the Actions log (tier used, image sizes) and test on the bench before deploying.

## Wireless duplicate fix

Previous versions only replaced the two sections named `alameer_2g` and `alameer_5g`. That left the device's original `default_radio0` / `default_radio1` (or other pre-existing `wifi-iface` sections) in place, which could produce multiple APs advertising the same SSID.

The new `/usr/bin/alameer-reset-wireless` script now:

1. Enumerates every `wifi-iface` UCI section.
2. Deletes every section assigned to `radio0` or `radio1`.
3. Creates exactly one AP interface per radio.
4. Commits wireless configuration and reloads Wi-Fi.

The first-boot script calls this helper automatically. **For a router already running a previous Alameer image**, `/etc/uci-defaults` will not automatically rerun after a normal sysupgrade if its one-shot script has already been consumed. After installing this new image, connect by SSH and run:

```sh
/usr/bin/alameer-reset-wireless
```

Then reload the Wireless page. It should show one AP for radio0 and one AP for radio1. This command removes all existing wireless interface sections on those two radios before recreating the requested two; it does not reset the Wi-Fi radios' regulatory country.

## Network and wireless defaults

- Management address: `192.168.1.20/24`
- WAN and WAN6 UCI interfaces removed.
- LAN DHCP server disabled; the upstream router must provide DHCP.
- 2.4 GHz: `AbduRaheem_2G`, AP, open security, channel 6.
- 5 GHz: `AbduRaheem_5G`, AP, open security, channel 36, HT40.
- Requests `txpower=30` on both radios. Driver, calibration and regulatory rules may clamp actual output; 30 dBm is not guaranteed.

**Security:** both SSIDs are open (no password), as originally requested. Anyone in radio range may connect. LAN DHCP is disabled, so the upstream router must provide DHCP. For direct management, place a client on `192.168.1.0/24` and browse to `http://192.168.1.20/`.

## Build on GitHub

1. Download and extract this ZIP.
2. Create an empty GitHub repository.
3. Upload the extracted folder's **contents**, including hidden `.github`, to the repository root.
4. Open **Actions**, enable workflows if prompted, then run **Build Alameer OpenWrt 24.10**.
5. Download the `alameer-openwrt-24.10.8-tplink_re205-v3` artifact from the completed run.

The workflow uses the official OpenWrt 24.10.8 ImageBuilder, injects the custom files, and enforces a strict `< 6,000,000` byte check for both factory and sysupgrade images. It fails rather than publishing an image that violates the size limit. No GitHub-hosted build has been executed as part of preparing this source ZIP.

## Important firmware and lifecycle notes

- OpenWrt 24.10 is no longer the maintained stable branch as of this project's preparation date. Use a currently supported branch for security-sensitive deployments when device support permits.
- Stock RE205 v3 images already use most of the 8 MB flash budget. LuCI plus the custom UI may exceed the requested 6 MB image limit; the workflow will reject oversized output.
- Verify the exact hardware revision is RE205 v3. Use factory only for the supported stock-to-OpenWrt installation path and sysupgrade only from a compatible OpenWrt installation. Verify checksums and never interrupt power during flashing.

## Project layout

```text
.github/workflows/build-openwrt.yml
files/etc/uci-defaults/99-custom-config
files/usr/bin/alameer-reset-wireless
files/www/luci-static/bootstrap/alameer.css
files/www/luci-static/resources/alameer.js
files/www/luci-static/resources/logo.png
files/www/luci-static/resources/view/alameer/*.js
files/usr/libexec/rpcd/alameer
files/usr/sbin/alameer-loopguard, alameer-cpufreq
files/etc/init.d/alameer-loopguard, alameer-cpufreq
files/etc/config/alameer
files/usr/share/luci/menu.d/luci-app-alameer.json
files/usr/share/rpcd/acl.d/luci-app-alameer.json
scripts/inject-theme-assets.sh, build-regdb.sh
README.md
```
