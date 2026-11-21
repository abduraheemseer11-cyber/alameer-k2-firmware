# patches/

Optional `*.patch` files placed here are applied (in alphabetical order, `git apply`) to the pinned OpenWrt
source by `scripts/build.sh`. This release needs **no source patches**: it uses the upstream
`phicomm_k2-v22.5` profile unmodified. `scripts/verify-device.sh` refuses to build if a patch mentions
factory / EEPROM / ART.
