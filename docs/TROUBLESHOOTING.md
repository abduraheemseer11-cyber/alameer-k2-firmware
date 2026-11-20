# Troubleshooting

| Problem | What to do |
|---|---|
| Build fails with "device profile ... does not exist" | The pinned OpenWrt tag is too old (21.02.x lacks `phicomm_k2-v22.5`). Use `v22.03.7` or newer. |
| "IMAGE SIZE ... over the limit" | Remove packages in `configs/base.config` (e.g. `luci-app-firewall` is already off; drop `lldpd`/`relayd` if necessary). No BIN is produced. |
| Theme looks like plain Bootstrap | The theme relies on Lua LuCI templates (21.02/22.03). On 23.05+ (ucode) it needs porting. Check `uci get luci.main.mediaurlbase`. |
| Lost access after Apply | Wait ~40 s; connect to the new LAN IP; or Rollback; or failsafe (INSTALLATION.md §4). |
| Only one radio shows | `logread | grep -i mt76`, `wifi status`; the 5 GHz radio needs `kmod-mt76x2`. Do not touch the `factory` partition. |
| CDP not visible on MikroTik | `lldpcli show configuration`; if CDP is unavailable the lldpd build lacks it (LLDP still works). Verify with `lldpcli show neighbors`. |
| Watchdog log | `/tmp/alameer-watchdog.log`, `logread -e alameer-watchdog`. Config: `uci show alameer.watchdog`. |
| PPPoE needed | `opkg update && opkg install ppp ppp-mod-pppoe` then re-run Quick Setup (router mode). |
