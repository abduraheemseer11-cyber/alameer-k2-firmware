# Hardware and flash layout

| Item | Value |
|---|---|
| Device | Phicomm K2 v22.5 or newer, profile `phicomm_k2-v22.5` |
| SoC | MediaTek MT7620A |
| 2.4 GHz | MT7620 integrated radio |
| 5 GHz | MT7612E, package `kmod-mt76x2` |
| RAM / Flash | 64 MB DDR2 / 8 MB SPI NOR |
| Target | `ramips/mt7620` |
| Firmware partition | 7552 KiB (`0x760000`) |

The OpenWrt v22.5 device profile has a firmware partition beginning at `0xa0000` with size `0x760000` and a separate `permanent_config` region. The project is restricted to the v22.5 profile and does not target v22.4.

The device profile itself selects `kmod-mt76x2`; the project also lists it explicitly to make the MT7612E requirement visible. Preserve the factory/calibration partition. Never erase it to troubleshoot wireless.

The ImageBuilder release is configured in `config.env`. The build script refuses to package a sysupgrade image larger than 7,733,248 bytes.
