#!/usr/bin/env bash
# ALAMEER SOFTWARE - restore execute bits (they are lost by ZIP extraction / GitHub web upload)
# and record them in Git. Run once after unpacking:  bash scripts/fix-permissions.sh
set -eu
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
EXEC_FILES=(scripts/*.sh files/etc/uci-defaults/* packages/luci-app-alameer/root/usr/sbin/* packages/luci-app-alameer/root/etc/init.d/* packages/alameer-watchdog/files/*)
chmod +x "${EXEC_FILES[@]}"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	git add -- "${EXEC_FILES[@]}"
	git update-index --chmod=+x -- "${EXEC_FILES[@]}"
	echo "Execute bit recorded in Git for ${#EXEC_FILES[@]} files. Commit the change."
else
	echo "Not a Git repository: chmod applied only (run 'git init' first, then re-run this script)."
fi
