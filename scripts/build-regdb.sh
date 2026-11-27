#!/bin/bash
# OPTIONAL: builds /lib/firmware/regulatory.db with a custom region "ZZ"
# (2.4/5 GHz wide open, up to 30 dBm). Needs: python3, wireless-regdb tools.
# Usage: build-regdb.sh <files-dir>     (enable with BUILD_REGDB=1)
# WARNING: using unlicensed frequencies/power may be illegal in your country.
set -euo pipefail
FILES="$(cd "${1:?files dir}" && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
git clone --depth 1 https://git.kernel.org/pub/scm/linux/kernel/git/wens/wireless-regdb.git
cd wireless-regdb
cat >> db.txt <<'DB'

country ZZ:
	(2300 - 2500 @ 40), (30)
	(4900 - 5900 @ 80), (30)
DB
python3 db2fw.py regulatory.db db.txt
DEST="$FILES/lib/firmware"
mkdir -p "$DEST" && cp regulatory.db "$DEST/regulatory.db"
echo "regulatory.db installed to $DEST"
