# ALAMEER SOFTWARE V3 — Purple Edition

Clean GitHub Actions project for the **Phicomm K2 v22.5 or newer** (`ramips/mt7620`, profile `phicomm_k2-v22.5`) using OpenWrt 22.03.7 ImageBuilder.

## What is included

- Deep-purple LuCI visual override (`#24103F`) with responsive navigation and ALAMEER logo.
- A dedicated **Quick Setup** entry at the top of the LuCI admin menu.
- Independent 2.4 GHz and 5 GHz configuration.
- Per-radio modes: Access Point, Access Point WDS, Mesh, Client WDS.
- 1–4 SSIDs per radio for AP / AP WDS mode. Names are generated from the base name (`AbduRaheem_2G`, `AbduRaheem_2G+2`, ...).
- Client WDS accepts the upstream SSID and optional passphrase. Mesh accepts a mesh ID.
- First-boot defaults: LAN `192.168.1.20/24`, DHCP server off, DHCPv6 off, 2.4 GHz channel 6 / 20 MHz, 5 GHz channel 36 / 40 MHz, open default SSIDs.
- Firmware size gate: image must be **strictly smaller than 6,000,000 bytes** or the workflow fails without publishing a firmware artifact.

## Build

1. Upload the contents of this folder to a new GitHub repository.
2. Open **Actions → Build ALAMEER K2 V3 → Run workflow**.
3. Download `ALAMEER-K2-V3-firmware` only if the job succeeds.

The workflow uses the official OpenWrt 22.03.7 ImageBuilder for `ramips/mt7620` and verifies its SHA-256 before use.

## Important hardware / regulatory notes

- This project targets **Phicomm K2 v22.5 or newer only**. Do not flash it on v22.4 or K2G.
- The official device definition reserves a 7,552 KiB firmware partition and includes the MT7612E driver package. The 6,000,000-byte requirement is a stricter user-requested output gate, not the device's partition limit.
- `txpower` values (30 dBm on 2.4 GHz and 24 dBm on 5 GHz) are requested configuration ceilings. The driver and regulatory database may clamp the actual power; the firmware does not bypass regulatory restrictions.
- Channel 36 may be unavailable under the active regulatory domain. The project does not force an unlawful country code. If the radio is disabled by the regulatory database, inspect `iw reg get`, `iw phy`, and `logread` before changing country settings.
- Mesh and WDS depend on the radio driver, peer configuration, and WPA supplicant/hostapd support. They must be tested with the actual peer device. Client WDS is not the same as a universal transparent repeater.
- Multiple SSIDs share the same physical radio/channel and airtime. The UI limits each radio to four virtual SSIDs to reduce resource pressure on the K2's 64 MB RAM.
- Default Wi-Fi networks are open as requested. Set passwords before using the router on a public or production network.
- The default setup removes logical `wan` / `wan6` interfaces but does not rewrite the board's low-level switch VLAN map. Confirm the physical Ethernet port mapping before assuming the WAN jack has been bridged into LAN.
- No actual firmware compilation or on-device validation is claimed by the source ZIP. GitHub Actions performs the real ImageBuilder build and image-size gate.

## Recovery

Keep a verified stock firmware image and a backup of the router's factory/calibration partition. Do not interrupt power during flashing. If the device is not reachable at `192.168.1.20`, connect directly and try the documented recovery method for your Breed bootloader.
