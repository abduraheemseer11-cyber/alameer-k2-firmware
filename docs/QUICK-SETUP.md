# Quick Setup behaviour

The LuCI menu adds `Quick Setup` as a separate top-level admin item. Each band has an independent mode selector:

- Access Point: creates 1–4 AP interfaces, each attached to `lan`.
- Access Point WDS: creates 1–4 AP interfaces with `wds=1`.
- Mesh: creates a mesh interface using the entered Mesh ID; mesh-capable wpad is included.
- Client WDS: creates a station interface with `wds=1`, using the upstream SSID and optional key.

For AP modes, SSIDs are generated from the base name and can be individually edited. The current implementation intentionally limits each radio to four virtual interfaces because all BSSs share one radio and the device has limited RAM.

After changing modes, use **Save & Apply**. The `Save` button writes the staged UCI changes; `Save & Apply` commits and reloads the configuration through LuCI's UCI apply mechanism.
