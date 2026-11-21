# ALAMEER SOFTWARE K2 — refreshed project

This revision consolidates the project on the OpenWrt 25.12.6 ImageBuilder path and removes the conflicting old Lua/22.03 build path.

## Interface
- Rebuilt the theme as a ucode LuCI theme for OpenWrt 24.10/25.12.
- Dark charcoal desktop shell, black top bar, fixed sidebar, crimson active state and silver details.
- Uses the supplied ALAMEER logo.
- Quick Setup is always the first, independent sidebar entry; Dashboard follows it.
- Mobile layout uses a compact top bar, slide-in drawer, backdrop and stacked forms/tables.

## Network defaults
- LAN address: 192.168.1.20/24.
- Hostname: Al-Makhadhi-K2.
- Default AP setup adds the detected WAN VLAN device to br-lan and disables the LAN DHCP server, but only when both the bridge and WAN device are identified.
- First boot no longer calls the absent legacy `alameer-apply` executable or creates stale `default_radio0/default_radio1` wireless sections.

## Wireless
- Explicitly includes `kmod-mt76x2` for the MT7612E 5 GHz radio.
- Keeps detected radios enabled in UCI and avoids forcing TX power.
- Uses the country configured in `config.env`; default is YE and must match the actual country of operation.
- Radio availability still depends on the installed driver, factory calibration data and regulatory database. The Linux wireless-regdb entry for YE currently has no 5 GHz band rule, so this project does not spoof another country to force 5 GHz transmission.

## Validation
- Shell syntax checks passed.
- LuCI JavaScript syntax checks passed.
- Static project checks passed.
- The OpenWrt ImageBuilder build and real-router runtime have not been executed in this editing environment.
