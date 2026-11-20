# Network modes (LuCI: Network → ALAMEER Quick Setup)

Every Apply: validates input → saves previous config (`/etc/alameer/prev`) → rebuilds config from the board
defaults (`/etc/alameer/*.default`, saved at first boot) → restarts network in the background.
**Rollback** restores the saved previous configuration.

## Mode 1 – Access Point / MikroTik bridge (default)
* LAN IP `192.168.1.20/24`, no gateway, DHCP server **ignored on LAN**, dnsmasq disabled, no NAT.
* switch VLAN 2 merged into VLAN 1 → all Ethernet ports + both SSIDs in `br-lan` (Linux bridge).
* Passes broadcast, ARP, unicast; client MACs are preserved on Ethernet. Wi-Fi clients are bridged by
  hostapd in standard AP mode (their own MACs are seen upstream).
### What is NOT transparent
* **802.1Q VLAN tags are not passed through by default.** The switch runs port VLAN 1 untagged; tagged frames from
  MikroTik for other VLAN IDs are dropped by the switch. To carry specific VLANs configure
  Network → Switch (swconfig) manually (trunk port `t` tagging, extra VLANs, bridge-vlan). Not automated here.
* Tagged-VLAN-per-SSID is not configured by the wizard.
* LLDP/CDP frames are link-local and consumed by lldpd, not forwarded as a bridge would.

## Mode 2 – Repeater / WISP
* Scan lists SSID, channel, signal and encryption (WEP and 802.1X networks are shown but refused).
* **Repeater (relayd)**: pseudo-bridge. Layer 3 relaying with ARP/DHCP proxying; clients behind it are *not*
  true Layer-2 peers (MAC addresses are not preserved end-to-end, some broadcast protocols fail).
* **Repeater with WDS (4addr)**: real Layer-2 bridging, but only if the upstream AP also enables WDS
  (OpenWrt `wds=1`, MikroTik "wds-mode"); many consumer APs do not.
* **WISP**: upstream Wi-Fi becomes `wwan` (DHCP) in the firewall `wan` zone with NAT; the LAN gets its own
  DHCP. Choose a LAN subnet different from the upstream.
* The upstream scan uses the same radio that serves clients and briefly interrupts them.

## Mode 3 – Router
WAN port separated (VLAN 2), NAT + firewall + DHCP server enabled, DHCP client on WAN. **PPPoE is not in the
image** (flash budget): the wizard refuses PPPoE and tells you to `opkg install ppp ppp-mod-pppoe` (needs
Internet and ~100 KB overlay space).

## Advanced features – what is really included
| Feature | Status |
|---|---|
| VLAN / 802.1Q | via LuCI Network → Switch (swconfig). Not automated. |
| swconfig, Linux bridge, relayd, WDS | included |
| 802.11s mesh | **not included** (needs `wpad-mesh-*`, too large for 8 MB; also conflicts with `wpad-basic`) |
| LLDP | `lldpd`, hostname `Al-Makhadhi-K2` (from `alameer.core.hostname`) |
| CDP | sent/received by lldpd (`enable_cdp=1`), if built with CDP support (see TROUBLESHOOTING) |
| MNDP | **not supported** – MikroTik proprietary, no OpenWrt package. MikroTik's neighbor list can see the device via LLDP/CDP. |

## Wi-Fi
Defaults: `AbduRaheem_2G` / `AbduRaheem_5G`, **open (no encryption)** as requested, country `US`.
WPA2 or WPA2/WPA3 can be enabled in Quick Setup (wpad-basic-wolfssl). TX power is deliberately **not** forced;
the driver applies the regdomain limit. Note: a country code should match where the device operates; using `US`
elsewhere can be non-compliant with local rules (e.g. EU). Change `alameer.core.country` if needed.
Radio mapping is detected by band (2g/5g), not by the names radio0/radio1.
