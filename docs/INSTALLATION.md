# Installation — read before flashing

## Confirm the hardware
This image targets Phicomm K2 v22.5 or newer with the `phicomm_k2-v22.5` layout only. Do not flash it to v22.4 or an unverified board revision. Back up the factory/calibration partition before making changes.

## Build
Upload the complete repository to GitHub. Open **Actions → Build ALAMEER K2 Firmware → Run workflow**. Leave the OpenWrt version blank to use `config.env`. Download the `ALAMEER-K2-firmware` artifact after all checks pass.

The sysupgrade image is `ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin`. Verify its `.sha256` file before flashing.

## Flashing
From an existing OpenWrt installation using the same v22.5 layout, use LuCI → System → Backup / Flash Firmware, or `sysupgrade -n` with the image. First installation from stock firmware is not covered by this project; follow the Phicomm K2 OpenWrt device documentation and recovery instructions.

## First boot
The configured LAN address is `192.168.1.20/24`; browse to `http://192.168.1.20/`. The default network mode is AP/bridge when the `br-lan` device and WAN VLAN device can be identified. DHCP on the LAN is disabled in that mode. Set a strong root password immediately. Wi-Fi is open by default to match the original specification; configure a password before exposing it to untrusted users.

## Recovery
If the address is unreachable, connect by Ethernet with a static address in `192.168.1.0/24`, inspect `/etc/alameer/first-boot.log`, and use the device's documented failsafe/serial/TFTP recovery process. Do not erase the factory/calibration partition.
