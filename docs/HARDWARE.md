# Hardware & flash layout

| Item | Value |
|---|---|
| Device | Phicomm K2 (PSG1218), firmware layout "v22.5 or newer" |
| SoC | MediaTek MT7620A, MIPS 24KEc, 580 MHz |
| 2.4 GHz | MT7620 integrated radio (rt2x00 `rt2800soc`) |
| 5 GHz | MT7612E (PCIe, driver `kmod-mt76x2`) |
| RAM / Flash | 64 MB DDR2 / 8 MB SPI NOR |
| Target / profile | `ramips/mt7620` / `phicomm_k2-v22.5` (OpenWrt compatible string `phicomm,k2-v22.5`) |
| Serial console | 57600 8N1 (per the OpenWrt Table of Hardware page) |

## What was verified (from OpenWrt's commit "ramips: add new flash layout support to Phicomm K2")
* Two profiles exist upstream: `phicomm_k2-v22.4` (IMAGE_SIZE 7872k, firmware at 0x50000) and
  `phicomm_k2-v22.5` (IMAGE_SIZE **7552k**, new `permanent_config` partition at 0x50000, firmware at
  **0xa0000 size 0x760000**). The v22.5 profile adds `kmod-mt76x2` for the MT7612E.
* The old `phicomm_psg1218a` profile (which the 21.02 branch used) was renamed to `phicomm_k2-v22.4` by that
  commit (August 2021, after the 21.02 branch point). **That is why this project defaults to tag `v22.03.7`
  and not `v21.02.7`**; `scripts/verify-device.sh` fails the build if the profile is absent.
* Flashing a v22.4 image on a v22.5 unit (or the reverse) can overwrite/corrupt the wrong region.

## Not verified here (needs your confirmation on the device)
* That your unit's "V22.6" uses the same layout as v22.5. OpenWrt labels the profile "v22.5 or newer", but
  verify before flashing: on OpenWrt, `cat /proc/mtd` must show `permanent_config` and a `firmware` partition of
  `00760000`. On stock firmware names can differ; if in doubt do not flash.
* The ART/EEPROM/calibration data lives in the read-only `factory` partition; nothing in this project writes
  to it. Back it up anyway (see INSTALLATION.md).

## Switch
`swconfig` device `switch0`; board defaults come from OpenWrt `board.d/02_network`. In AP mode the
WAN switch VLAN (vlan 2) is merged into LAN (vlan 1), so **all five ports join br-lan**.
