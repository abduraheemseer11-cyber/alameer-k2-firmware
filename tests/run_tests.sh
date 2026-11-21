#!/usr/bin/env bash
# Offline test-suite. Needs: bash, python3, node. No router and no network required.
# These tests check files, logic and generated configuration. They do NOT replace
# a real on-device test of the LuCI pages (see README, "What was and was not tested").
cd "$(dirname "${BASH_SOURCE[0]}")/.."
fail=0
run() {
	echo "=== $1"
	shift
	if "$@"; then echo "--- PASS"; else echo "--- FAIL"; fail=1; fi
	echo
}

run "JavaScript syntax (node --check)" bash -c '
	rc=0
	while IFS= read -r f; do node --check "$f" || { echo "syntax error: $f"; rc=1; }; done < <(find files -name "*.js" | sort)
	exit $rc'
run "Project structure, JSON, CSS, budgets, workflow" python3 tests/test_structure.py
run "Quick Setup validators and change plan" node tests/test_qsvalidate.js
run "Arabic/English dictionary coverage" node tests/test_i18n.js
run "Dashboard / Quick Setup / menu modules with DOM stubs" node tests/test_views.js
run "Theme template derivation (fixture based)" python3 tests/test_patch_theme.py
run "uci-defaults scripts against a mock uci" python3 tests/test_uci_defaults.py

if [ "$fail" -eq 0 ]; then echo "ALL TEST GROUPS PASSED"; else echo "SOME TEST GROUPS FAILED"; fi
exit "$fail"
