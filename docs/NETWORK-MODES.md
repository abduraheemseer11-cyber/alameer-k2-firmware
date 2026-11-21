# Network modes

Quick Setup is a top-level LuCI menu entry, separate from Network. It provides Access Point, Router, Repeater/WISP and Mesh selections through the `quicksetup-apply` backend.

- **Access Point:** joins the detected WAN VLAN device to `br-lan` where the bridge layout is found and disables LAN DHCP. This is intended for upstream DHCP/MikroTik management.
- **Router:** separates WAN and LAN, enables DHCP/NAT using the existing OpenWrt network/firewall configuration.
- **Repeater/WISP:** uses a wireless client uplink. Relay mode is a pseudo-bridge, not a true transparent Layer-2 bridge; WDS requires compatible settings at both ends.
- **Mesh:** depends on `wpad-mesh-mbedtls` and compatible radio/driver support. It must be tested with the peer AP before production use.

802.1Q switch VLAN configuration remains a manual advanced task in Network → Switch. Relay mode does not preserve client MAC addresses end-to-end in the same way as a true WDS bridge.

## Wi-Fi regulatory domain

The country is configured by `WIFI_COUNTRY` in `config.env` and must match the country where the router operates. Do not set US or another country merely to expose additional channels. In the current Linux wireless-regdb, Yemen (`YE`) has a 2.4 GHz rule but no 5 GHz band rule; 5 GHz AP operation may therefore be blocked by the regulatory layer. Use only a country code and channels supported by the actual local rules and the router's factory calibration.
