#!/usr/bin/env bash
# ALAMEER SOFTWARE - checks that project scripts are robust against lost execute bits.
#  1. every scripts/*.sh has the shebang '#!/usr/bin/env bash' and passes 'bash -n'
#  2. no CRLF line endings in scripts / workflows / on-device scripts
#  3. no script calls a sibling *.sh directly (must be 'bash <script>')
#  4. selftest.sh still passes in a copy of the project with ALL execute bits removed
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fails=0
ok()  { echo "PASS  $*"; }
bad() { echo "FAIL  $*"; fails=$((fails+1)); }

for f in "$ROOT"/scripts/*.sh; do
	n="$(basename "$f")"
	[ "$(head -n1 "$f")" = '#!/usr/bin/env bash' ] && ok "$n shebang" || bad "$n shebang is not '#!/usr/bin/env bash'"
	bash -n "$f" 2>/dev/null && ok "$n syntax" || bad "$n has a syntax error"
done

while IFS= read -r f; do
	grep -q $'\r' "$f" && bad "CRLF line endings: ${f#$ROOT/}"
done < <(find "$ROOT/scripts" "$ROOT/.github" "$ROOT/files" "$ROOT/packages" -type f \( -name '*.sh' -o -name '*.yml' -o -name '*.init' -o -name 'alameer-apply' -o -name '99-*' -o -name Makefile -o -name '*.lua' -o -name '*.htm' -o -name '*.js' -o -name '*.css' -o -name 'alameer-*' \))
[ "$fails" -eq 0 ] && ok "no CRLF line endings"

# direct execution of a project script (without bash/source in front of it)
direct="$(grep -nE '^[[:space:]]*("?\$[A-Za-z_{}]+/)?(scripts/)?[A-Za-z0-9_-]+\.sh"?[[:space:]]' "$ROOT"/scripts/*.sh "$ROOT"/.github/workflows/*.yml 2>/dev/null \
	| grep -vE ':[0-9]+:[[:space:]]*(bash|source|\.|echo|#)' | grep -vE 'name:|run:|uses:' || true)"
direct2="$(grep -nE '^[[:space:]]*"\$[A-Za-z_{}]+/(scripts/)?[A-Za-z0-9_-]+\.sh"' "$ROOT"/scripts/*.sh || true)"
if [ -n "$direct$direct2" ]; then bad "scripts executed directly instead of via bash:"; echo "$direct$direct2"; else ok "all script invocations use explicit bash"; fi
grep -nE 'expect .* [01] "\$D/' "$ROOT/scripts/selftest.sh" >/dev/null && bad "selftest.sh calls a gate directly" || ok "selftest.sh calls gates through bash"

# real proof: run the selftest from a copy where nothing is executable
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
cp -r "$ROOT/scripts" "$ROOT/files" "$T/" 2>/dev/null; mkdir -p "$T/patches" "$T/packages"
cp -r "$ROOT/packages/." "$T/packages/" ; cp -r "$ROOT/patches/." "$T/patches/" 2>/dev/null
find "$T" -type f -exec chmod a-x {} +
if bash "$T/scripts/selftest.sh" >"$T/selftest.out" 2>&1; then ok "selftest passes with no execute bits"; else bad "selftest fails without execute bits"; cat "$T/selftest.out"; fi

[ "$fails" -eq 0 ] && { echo "ALL SCRIPT CHECKS PASSED"; exit 0; } || { echo "$fails SCRIPT CHECK(S) FAILED"; exit 1; }
