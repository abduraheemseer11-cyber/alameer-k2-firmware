# Installation (read fully before flashing)

## 0. Is this the right firmware for your unit?
Only for Phicomm K2 / PSG1218 with the **v22.5-or-newer** flash layout (`phicomm_k2-v22.5`). See HARDWARE.md.
For v22.4 or older, build a different profile (`phicomm_k2-v22.4`); do not use this image.

## 1. Back up the calibration data (strongly recommended)
From an OpenWrt shell on the router: `grep factory /proc/mtd`, then (replace N)
`dd if=/dev/mtdN of=/tmp/factory.bin` and copy it off with `scp`. This is the Wi-Fi calibration (ART/EEPROM).
This project never writes to it.

## 2. Flash
* **From an existing OpenWrt (same layout)**: LuCI → System → Backup / Flash Firmware → choose
  `ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin` (uncheck *keep settings* the first time) or
  `scp` it to `/tmp` and run `sysupgrade -n /tmp/ALAMEER-K2-mt7620-phicomm_k2-v22.5-sysupgrade.bin`.
* **From stock firmware**: the first-install route for stock V22.5 is not covered or tested by this project.
  Follow the OpenWrt Table of Hardware page for the Phicomm K2 (openwrt.org/toh/phicomm/k2). The image is a
  standard OpenWrt sysupgrade image.
Check the SHA256 (`ALAMEER-...bin.sha256`) before flashing. Do not power off during the write.

## 3. First boot
Set your PC to `192.168.1.x` and browse to `http://192.168.1.20/`. Default state: AP mode, DHCP **off**, SSIDs
open. Because DHCP is off, use a static IP on the PC or connect it behind your MikroTik. Set a root password
(System → Administration) – the Wi-Fi is open by default.

## 4. Recovery
* **Failsafe**: reboot and press the reset button (or type `f` when the console prompts) during early boot;
  the router answers on 192.168.1.1 with SSH/telnet and no config. Run `firstboot && reboot` to wipe settings.
* **Bad network config**: use Quick Setup → *Rollback*, or in failsafe `cp /etc/alameer/prev/network /etc/config/network`.
* **Bricked**: serial console 57600 8N1 and OpenWrt's TFTP/bootloader recovery documented on the ToH page.
  Having the `factory` backup lets you restore calibration.
