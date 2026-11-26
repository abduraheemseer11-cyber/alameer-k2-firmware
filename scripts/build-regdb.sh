#!/bin/bash
# EXPERIMENTAL: build regulatory.db with an extra permissive country "ZZ".
# Usage: build-regdb.sh <imagebuilder files dir>. Runs in CI only (needs network).
# Whether the kernel accepts an unsigned regulatory.db depends on the cfg80211
# build options of the target; if it is rejected, Wi-Fi falls back to the world
# domain. This is why it is disabled by default (SUPER_REGDB=false).
set -euo pipefail
OUT="${1:?files dir}"
W="$(mktemp -d)"
git clone --depth 1 https://git.kernel.org/pub/scm/linux/kernel/git/wens/wireless-regdb.git "$W/regdb"
cd "$W/regdb"
cat >> db.txt <<'DB'

country ZZ: DFS-UNSET
	(2400 - 2500 @ 40), (30)
	(5150 - 5895 @ 80), (30)
DB
python3 db2fw.py regulatory.db db.txt
test -s regulatory.db
mkdir -p "$OUT/lib/firmware"
install -m 0644 regulatory.db "$OUT/lib/firmware/regulatory.db"
echo "Custom regulatory.db installed (country ZZ added)."
