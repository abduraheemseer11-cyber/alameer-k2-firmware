# ALAMEER SOFTWARE — Phicomm K2 v22.5 Custom Dashboard Firmware

This repository builds an OpenWrt 23.05.3 ImageBuilder firmware for the **Phicomm K2 PSG1218 v22.5** profile `phicomm_k2-v22.5`. The router's web UI is a standalone ALAMEER application served at `/alameer/`; LuCI is deliberately removed from the image.

## What the custom dashboard contains

- ALAMEER-branded login and responsive desktop/mobile layout.
- Independent dark-red/black design with light/dark theme switch.
- Dashboard with system board, uptime, memory, Linux load average, LAN status and wireless radio information.
- Quick Setup forms for both wireless bands: SSID, Open/WPA2-PSK, channel, width, TX power, hidden SSID and client isolation.
- LAN management IP and subnet settings.
- Wireless associated-station list (MAC and signal/rates where the driver reports them).
- Reboot action.
- Settings are sent to OpenWrt through the HTTP ubus JSON-RPC endpoint. Wireless and LAN settings are written through rpcd's built-in UCI API and committed; then netifd is asked to reload.

## Important feature boundaries

This is a working first dashboard version, not a claim that every feature in the earlier specification has been implemented:

- Access Point mode is implemented. Repeater/WDS scanning and association are shown as unavailable and are not falsely presented as working.
- VLAN input is not applied. Creating a VLAN requires knowing the exact K2 switch/DSA layout; this UI intentionally does not guess.
- The hardware reset-button disable feature is not implemented. A software setting cannot guarantee disabling the physical reset circuit on this board.
- The client list reports wireless associated stations from `iwinfo`; IP addresses are not guaranteed because DHCP is external.
- Dashboard CPU display is Linux load average, not a fabricated CPU percentage. RAM values depend on kernel memory reporting.
- The initial web login is `root` / `admin`. Change this password before connecting the router to an untrusted network. The System Information page includes a password-change form using rpcd's password API.
- Firmware upgrade is performed through Breed. SSH, LuCI and HTTPS are intentionally absent.

## API and access control

The page uses `uhttpd-mod-ubus` at `/ubus`, with `rpcd` and the `rpcd-mod-iwinfo` and `rpcd-mod-file` plugins. The file plugin ACL grants execution only to `/sbin/wifi` so the dashboard can reload radios after committing wireless UCI changes. The ACL file is installed at `/usr/share/rpcd/acl.d/alameer.json`. The rpcd root login is assigned the `alameer` ACL group, which permits read access to system/interface/radio data and write access only to UCI network/wireless/system configuration, network reload and reboot.

No LuCI packages, Dropbear, dnsmasq, odhcpd/odhcpd-ipv6only, firewall, PPP, TLS listener, or `libustream-*` package is intentionally included. The only intended TCP listener is uHTTPd on IPv4 TCP/80. This must still be verified on the flashed router with an external port scan; a package manifest cannot prove runtime socket state.

## Network defaults

- Hostname: `Al-Makhadhi-K2`
- Management IP: `192.168.1.20/24`
- LAN only; WAN and WAN6 logical interfaces are deleted.
- Wi-Fi defaults: `AbduRaheem_2G` channel 6 / HT20 and `AbduRaheem_5G` channel 36 / VHT40.
- Both wireless networks start open and client isolation is enabled.
- Country code: `YE`; the driver/regulatory database may clamp channel and TX power values.
- The MikroTik/upstream network must provide DHCP and DNS. This device has no DHCP/DNS server.
- Cron drops page cache at 03:30 and reboots at 04:00.

The board's factory switch/bridge layout is preserved rather than inventing a WAN-to-LAN port mapping. Confirm the actual port membership on your exact board before relying on every physical port as LAN.

## Build on GitHub

1. Create a new GitHub repository.
2. Upload the **contents** of this folder to the repository root, including `.github`.
3. Open Actions and enable workflows if prompted.
4. Run **Build ALAMEER K2 Dashboard Firmware**, or push to `main`.
5. Download the `ALAMEER-K2-Dashboard-v22.5` artifact from the completed run.
6. It contains the sysupgrade image, `firmware.manifest` and `SHA256SUMS`.

The workflow pins OpenWrt 23.05.3 and the official ramips/mt7620 ImageBuilder archive SHA-256 (`188e6caab9db67526eb8f85aab0591793bed490c85eb39a0ad4ea523d7ccb588`). It verifies the archive directly against this pinned digest (without parsing a separately downloaded checksum-list file), validates the tar archive, and verifies the package manifest. It fails if forbidden packages are present or the image exceeds 7 MiB. The 7 MiB limit is intentionally strict; if the package set exceeds it, the build stops and packages must be reduced rather than bypassing the check.

## Flashing and first login

1. Back up Breed flash/calibration data first.
2. Confirm the label is Phicomm K2 v22.5. Do not use this image on K2 v22.4, K2P or K2G.
3. In Breed, upload the generated `*-squashfs-sysupgrade.bin` only if Breed accepts this image for the board. Never force-write an image rejected by Breed.
4. After boot, connect a PC to the same Layer-2 network and open `http://192.168.1.20/`.
5. Login with username `root`, password `admin`, then change the password before using the device on a network you do not fully trust.

Because Dropbear is removed, SSH `sysupgrade` is intentionally unavailable. Use Breed for recovery/upgrades. The dashboard is not a replacement for Breed's recovery console.

## Verify network ports

From a PC on the same LAN:

```sh
nmap -Pn -sT -p 22,53,80,443 192.168.1.20
```

Expected TCP result: port 80 open; ports 22, 53 and 443 closed. UDP DHCP check:

```sh
nmap -Pn -sU -p 67 192.168.1.20
```

UDP scans may show `open|filtered`; confirm with packet capture if necessary. If a temporary serial/recovery shell is available, also inspect:

```sh
ss -lntup
```

## Intended network-facing services

- `uhttpd`: IPv4 TCP/80, serves the ALAMEER static UI and ubus JSON-RPC endpoint.
- `rpcd` and ubus: local Unix-domain IPC, not intended TCP/UDP listeners.
- `lldpd`: raw Layer-2 LLDP frames and local control socket; no ordinary TCP/UDP listener in normal operation.
- `relayd`: relay/bridge helper; no management TCP listener intended.
- `hostapd`/`wpad`, `netifd`, `cron`: system services; no additional management TCP listener intended.

This list describes intended services, not runtime proof. Perform the Nmap test after flashing.

## Project tree

```text
.github/workflows/build.yml
packages.txt
build.sh
README.md
logo-original.png
files/
  etc/config/uhttpd
  etc/config/rpcd
  etc/uci-defaults/
  usr/share/rpcd/acl.d/alameer.json
  usr/bin/alameer-drop-caches
  www/index.html                 (generated on first boot)
  www/alameer/index.html
  www/alameer/assets/app.css
  www/alameer/assets/app.js
  www/alameer/assets/logo.png
  www/alameer/assets/favicon.png
```

## Sources

- OpenWrt 23.05.3 ImageBuilder archive: https://downloads.openwrt.org/releases/23.05.3/targets/ramips/mt7620/
- OpenWrt rpcd documentation: https://openwrt.org/docs/techref/rpcd
- OpenWrt uhttpd ubus module description: https://git.openwrt.org/openwrt/openwrt/tree/package/network/services/uhttpd/Makefile
