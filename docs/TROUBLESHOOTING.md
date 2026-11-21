# Troubleshooting

| Symptom | Checks |
|---|---|
| LuCI shows the old theme | Confirm `uci get luci.main.mediaurlbase` returns `/luci-static/alameer`; clear the browser cache and reload. |
| Sidebar does not appear | Check browser console and `logread`; confirm `menu-alameer.js` and the ucode theme templates are present. |
| LAN is not reachable at 192.168.1.20 | Check `/etc/alameer/first-boot.log`, `uci show network.lan`, and the static IP on the PC. |
| 2.4 GHz radio is missing | Run `wifi status`, `iw phy`, and `dmesg | grep -Ei 'mt7620|rt2x00|eeprom|firmware'`. |
| 5 GHz radio is missing | Check `opkg`/`apk` package list for `kmod-mt76x2`, `iw phy`, `iw reg get`, `dmesg | grep -Ei 'mt76|mt7612|eeprom|firmware'`, and factory calibration. In Yemen, the current Linux wireless-regdb does not define a 5 GHz rule for YE. |
| Wi-Fi appears disabled | In LuCI, inspect the radio state and the interface state separately. `option disabled '0'` in UCI does not override missing driver, calibration or regulatory channels. |
| Build exceeds flash limit | Remove optional packages from `packages.txt`; do not change the device profile or partition limit. |
| Firmware does not boot | Confirm v22.5 hardware layout and restore using the documented serial/TFTP recovery method. Preserve the factory partition. |

Run `alameer-wifi-diag` to collect the read-only wireless report. Useful individual commands:

```sh
cat /etc/config/wireless
wifi status
iw phy
iw reg get
logread | grep -Ei 'hostapd|netifd|mt76|wireless'
dmesg | grep -Ei 'mt76|mt7620|eeprom|firmware|wlan'
```
