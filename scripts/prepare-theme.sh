#!/usr/bin/env bash
# Generates files/usr/share/ucode/luci/template/themes/almakhdhi/* from the upstream
# luci-theme-bootstrap package of the OpenWrt release being built (needs internet).
#
# usage: scripts/prepare-theme.sh <openwrt-version, e.g. 24.10.8> [package-arch, default mipsel_24kc]
set -euo pipefail

V="${1:?usage: prepare-theme.sh <openwrt-version> [arch]}"
ARCH="${2:-mipsel_24kc}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FEED="https://downloads.openwrt.org/releases/${V}/packages/${ARCH}/luci"
echo "Feed: ${FEED}"

curl -fsSL "${FEED}/Packages.gz" | gunzip > "${WORK}/Packages"

read -r FILENAME SHA < <(awk -v pkg="luci-theme-bootstrap" '
	BEGIN { RS = ""; FS = "\n" }
	{
		name = ""; fn = ""; sha = ""
		for (i = 1; i <= NF; i++) {
			if ($i == "Package: " pkg) name = pkg
			if ($i ~ /^Filename: /) fn = substr($i, 11)
			if ($i ~ /^SHA256sum: /) sha = substr($i, 12)
		}
		if (name == pkg) { print fn, sha; exit }
	}' "${WORK}/Packages")

[ -n "${FILENAME:-}" ] && [ -n "${SHA:-}" ] || { echo "ERROR: luci-theme-bootstrap not found in ${FEED}/Packages.gz"; exit 1; }
echo "Package: ${FILENAME}"

curl -fsSL -o "${WORK}/pkg.ipk" "${FEED}/${FILENAME}"
echo "${SHA}  ${WORK}/pkg.ipk" | sha256sum -c -

mkdir -p "${WORK}/ipk" "${WORK}/data"
tar -xzf "${WORK}/pkg.ipk" -C "${WORK}/ipk"
tar -xzf "${WORK}/ipk/data.tar.gz" -C "${WORK}/data"

TPL="${WORK}/data/usr/share/ucode/luci/template/themes/bootstrap"
CSS="${WORK}/data/www/luci-static/bootstrap/cascade.css"
MENU="${WORK}/data/www/luci-static/resources/menu-bootstrap.js"

# Keep a copy for diagnostics (uploaded by the workflow).
mkdir -p "${ROOT}/upstream-debug"
( cd "${WORK}/data" && find . -type f | sort ) > "${ROOT}/upstream-debug/file-list.txt"
cp -r "${TPL}" "${ROOT}/upstream-debug/templates" 2>/dev/null || true
cp "${MENU}" "${ROOT}/upstream-debug/menu-bootstrap.js" 2>/dev/null || true

# Contract checks: fail early with a readable message instead of shipping a broken UI.
[ -d "${TPL}" ]  || { echo "ERROR: template dir not found in upstream package. Files:"; cat "${ROOT}/upstream-debug/file-list.txt"; exit 1; }
[ -f "${CSS}" ]  || { echo "ERROR: /www/luci-static/bootstrap/cascade.css missing (our CSS imports it)"; exit 1; }
[ -f "${MENU}" ] || { echo "ERROR: menu-bootstrap.js missing"; exit 1; }
grep -q "ui.menu.load" "${MENU}"        || { echo "ERROR: menu-bootstrap.js no longer uses ui.menu.load"; exit 1; }
grep -q "getChildren" "${MENU}"         || { echo "ERROR: menu-bootstrap.js no longer uses ui.menu.getChildren"; exit 1; }
grep -q "dispatchpath" "${MENU}"        || echo "WARNING: menu-bootstrap.js does not mention dispatchpath"

OUT="${ROOT}/files/usr/share/ucode/luci/template/themes/almakhdhi"
rm -rf "${OUT}"
python3 "${ROOT}/scripts/patch_theme.py" "${TPL}" "${OUT}"
echo "Theme templates generated in ${OUT}"
