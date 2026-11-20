#!/bin/sh
# ALAMEER SOFTWARE - lightweight watchdog (BusyBox ash). Developed by Eng. Abdulrahim Al-Makhadhi
# Escalation ladder per problem: (1) log, (2) reload Wi-Fi / restart network (rate limited),
# (3) optional reboot only if allow_reboot=1 and limits not exceeded. A temporary RAM spike never reboots.
LOGF=/tmp/alameer-watchdog.log
STATE=/tmp/alameer-wd
mkdir -p "$STATE"
MAXLOG=65536

cfg() { v="$(uci -q get "alameer.watchdog.$1")"; echo "${v:-$2}"; }
log() {
	echo "$(date '+%F %T') $*" >> "$LOGF"
	logger -t alameer-watchdog "$*"
	[ "$(wc -c < "$LOGF" 2>/dev/null || echo 0)" -gt "$MAXLOG" ] && tail -n 100 "$LOGF" > "$LOGF.n" && mv "$LOGF.n" "$LOGF"
}
cnt_get() { cat "$STATE/$1" 2>/dev/null || echo 0; }
cnt_set() { echo "$2" > "$STATE/$1"; }

# Allow at most N recoveries per rolling hour (timestamps kept in a file).
recovery_allowed() { # name
	now=$(date +%s); f="$STATE/rec.$1"; max=$(cfg max_restarts_per_hour 3); n=0; keep=""
	for t in $(cat "$f" 2>/dev/null); do [ $((now - t)) -lt 3600 ] && { keep="$keep $t"; n=$((n+1)); }; done
	echo $keep > "$f"
	[ "$n" -lt "$max" ] || return 1
	echo "$keep $now" > "$f"; return 0
}

gateway() {
	g="$(uci -q get network.lan.gateway)"
	[ -n "$g" ] && { echo "$g"; return; }
	ip route 2>/dev/null | awk '/^default/ {print $3; exit}'
}

INTERVAL=$(cfg interval 60); [ "$INTERVAL" -lt 15 ] && INTERVAL=15
FAILN=$(cfg fail_threshold 3)
MINFREE=$(cfg min_free_kb 4096)
MEMN=$(cfg mem_fail_threshold 5)

log "started (interval=${INTERVAL}s, fail_threshold=$FAILN, min_free=${MINFREE}KB, allow_reboot=$(cfg allow_reboot 0))"
[ -e /dev/watchdog ] && log "hardware watchdog device present (/dev/watchdog); managed by procd, not by this script" \
	|| log "no /dev/watchdog device: software checks only"

while sleep "$INTERVAL"; do
	# 1. Link / gateway reachability -------------------------------------
	tgt="$(cfg ping_target '')"; [ -n "$tgt" ] || tgt="$(gateway)"
	if [ -n "$tgt" ]; then
		if ping -c 2 -W 2 "$tgt" >/dev/null 2>&1; then
			[ "$(cnt_get net)" -ge "$FAILN" ] && log "network recovered (target $tgt reachable)"
			cnt_set net 0
		else
			n=$(( $(cnt_get net) + 1 )); cnt_set net $n
			[ "$n" -eq 1 ] && log "ping to $tgt failed"
			if [ "$n" -eq "$FAILN" ]; then
				if recovery_allowed net; then
					log "network unreachable for $n checks: restarting network service"
					/etc/init.d/network restart >/dev/null 2>&1
				else
					log "network unreachable but recovery limit reached this hour: no action"
					if [ "$(cfg allow_reboot 0)" = 1 ] && recovery_allowed reboot; then
						log "allow_reboot=1 and limits ok: rebooting as last resort"; sync; reboot
					fi
				fi
				cnt_set net 0
			fi
		fi
	fi

	# 2. Wi-Fi radios ---------------------------------------------------------
	st="$(ubus call network.wireless status 2>/dev/null)"
	if [ -n "$st" ]; then
		down=""
		for r in $(uci -q show wireless | sed -n 's/^wireless\.\([^.=]*\)=wifi-device$/\1/p'); do
			dis="$(uci -q get wireless.$r.disabled)"; [ "$dis" = 1 ] && continue
			up="$(echo "$st" | jsonfilter -e "@.$r.up" 2>/dev/null)"
			[ "$up" = "false" ] && down="$down $r"
		done
		if [ -n "$down" ]; then
			n=$(( $(cnt_get wifi) + 1 )); cnt_set wifi $n
			if [ "$n" -ge "$FAILN" ]; then
				if recovery_allowed wifi; then log "radio(s) down:$down - reloading Wi-Fi"; wifi reload >/dev/null 2>&1
				else log "radio(s) down:$down - recovery limit reached this hour"; fi
				cnt_set wifi 0
			fi
		else
			cnt_set wifi 0
		fi
	fi

	# 3. Memory: log + gentle action only; never reboot for a temporary spike ----
	avail=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
	[ -n "$avail" ] || avail=$(awk '/MemFree|^Cached|^Buffers/ {s+=$2} END {print s}' /proc/meminfo)
	if [ "$avail" -lt "$MINFREE" ]; then
		n=$(( $(cnt_get mem) + 1 )); cnt_set mem $n
		if [ "$n" -eq "$MEMN" ]; then
			log "low memory for $n consecutive checks (${avail}KB available): dropping caches"
			sync; echo 1 > /proc/sys/vm/drop_caches 2>/dev/null
		elif [ "$n" -eq $((MEMN * 3)) ]; then
			if recovery_allowed mem; then log "memory still low (${avail}KB): restarting uhttpd"; /etc/init.d/uhttpd restart >/dev/null 2>&1; fi
		fi
	else
		[ "$(cnt_get mem)" -ge "$MEMN" ] && log "memory recovered (${avail}KB available)"
		cnt_set mem 0
	fi
done
