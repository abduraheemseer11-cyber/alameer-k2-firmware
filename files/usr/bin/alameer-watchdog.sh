#!/bin/sh
# ALAMEER SOFTWARE - lightweight watchdog (RAM + 2.4GHz radio)
MIN_FREE_KB=4096
STATE=/tmp/alameer-wd-fail

# --- RAM ---
FREE=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
[ -z "$FREE" ] && FREE=$(awk '/^(MemFree|Cached):/{s+=$2} END{print s}' /proc/meminfo)
if [ "$FREE" -lt "$MIN_FREE_KB" ]; then
    logger -t alameer-wd "Low RAM (${FREE} kB) - dropping caches"
    sync; echo 3 > /proc/sys/vm/drop_caches
    sleep 2
    FREE=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)
    [ -z "$FREE" ] && FREE=$(awk '/^(MemFree|Cached):/{s+=$2} END{print s}' /proc/meminfo)
    if [ "$FREE" -lt 2048 ]; then
        logger -t alameer-wd "RAM still critical - rebooting"
        reboot
        exit 0
    fi
fi

# --- 2.4GHz radio (phy0) ---
if [ "$(uci -q get wireless.radio0.disabled)" != "1" ]; then
    if ! iwinfo 2>/dev/null | grep -q '^phy0-'; then
        N=$(cat $STATE 2>/dev/null || echo 0); N=$((N+1)); echo $N > $STATE
        logger -t alameer-wd "2.4GHz radio down (try $N) - wifi reload"
        wifi reload
        if [ "$N" -ge 3 ]; then
            rm -f $STATE
            logger -t alameer-wd "2.4GHz radio did not recover - rebooting"
            reboot
        fi
    else
        rm -f $STATE
    fi
fi
exit 0
