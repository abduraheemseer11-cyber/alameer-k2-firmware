#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0
for f in "$ROOT"/scripts/*.sh; do
  [ "$(head -n1 "$f")" = '#!/usr/bin/env bash' ] || { echo "FAIL shebang: $f"; fail=1; }
  bash -n "$f" || { echo "FAIL bash syntax: $f"; fail=1; }
done
if grep -RIl $'\r' "$ROOT/scripts" "$ROOT/.github/workflows" "$ROOT/files/etc/uci-defaults" "$ROOT/files/usr/libexec" | grep .; then
  echo 'FAIL: CRLF line endings detected'; fail=1
fi
if grep -RInE '^(<<<<<<< |=======|>>>>>>> )' "$ROOT" --exclude='check-scripts.sh' --exclude='*.png' --exclude='*.ico' --exclude='*.svg'; then
  echo 'FAIL: unresolved merge-conflict markers detected'; fail=1
fi
[ "$fail" -eq 0 ] || exit 1
echo 'PASS: shell scripts and project text are clean.'
