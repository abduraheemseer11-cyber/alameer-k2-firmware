#!/usr/bin/env python3
import json, pathlib, re, struct, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
F = ROOT / "files"
fails = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


# ---- required files -------------------------------------------------------
required = """
.github/workflows/build.yml .gitignore README.md packages.txt
assets/logo-original.png
scripts/prepare-theme.sh scripts/patch_theme.py
files/etc/banner files/etc/uci-defaults/98-almakhdhi-theme files/etc/uci-defaults/99-custom-settings
files/usr/share/luci/menu.d/luci-app-almakhdhi.json files/usr/share/rpcd/acl.d/luci-app-almakhdhi.json
files/www/luci-static/almakhdhi/cascade.css files/www/luci-static/almakhdhi/logo.png files/www/luci-static/almakhdhi/favicon.png files/www/luci-static/almakhdhi/amk-early.js
files/www/luci-static/resources/menu-almakhdhi.js
files/www/luci-static/resources/almakhdhi/i18n.js files/www/luci-static/resources/almakhdhi/qsvalidate.js
files/www/luci-static/resources/view/almakhdhi/dashboard.js files/www/luci-static/resources/view/almakhdhi/quicksetup.js
tests/run_tests.sh tests/verify_image_contents.sh
""".split()
for r in required:
    check((ROOT / r).is_file(), "file exists: " + r)

# ---- JSON, menu -> view paths, ACL ----------------------------------------
menu = json.loads(read("files/usr/share/luci/menu.d/luci-app-almakhdhi.json"))
acl = json.loads(read("files/usr/share/rpcd/acl.d/luci-app-almakhdhi.json"))
for node, spec in menu.items():
    act = spec.get("action", {})
    if act.get("type") == "view":
        p = F / "www/luci-static/resources/view" / (act["path"] + ".js")
        check(p.is_file(), "menu %s -> view file %s exists" % (node, act["path"]))
    for g in spec.get("depends", {}).get("acl", []):
        check(g in acl, "menu %s depends on ACL group '%s' which is defined" % (node, g))
check(menu["admin/dashboard"]["order"] < menu["admin/quicksetup"]["order"] < 10, "Dashboard and Quick Setup come before the stock Status menu (order 10) so Dashboard is the landing page")
grp = acl["luci-app-almakhdhi"]
needed_ubus = {"system": {"board", "info"}, "network.interface": {"dump"}, "network.wireless": {"status"}, "iwinfo": {"info", "assoclist"}}
for obj, methods in needed_ubus.items():
    check(methods <= set(grp["read"]["ubus"].get(obj, [])), "ACL allows ubus %s %s" % (obj, sorted(methods)))
check({"network", "wireless", "luci"} <= set(grp["read"]["uci"]) and {"network", "wireless", "luci"} <= set(grp["write"]["uci"]), "ACL grants uci read+write on network, wireless, luci")
check(set(grp["read"]["file"]) == {"/sys/class/thermal/thermal_zone0/temp", "/bin/ping"}, "ACL file access is limited to the temperature sensor and ping")

# every rpc.declare used by the views is covered by the ACL
for f in ("view/almakhdhi/dashboard.js", "menu-almakhdhi.js"):
    src = read("files/www/luci-static/resources/" + f)
    for m in re.finditer(r"object:\s*'([^']+)',\s*method:\s*'([^']+)'", src):
        obj, meth = m.groups()
        if obj in ("uci",):
            continue    # governed by the uci ACL scope (same as stock LuCI)
        if obj == "file":
            check(meth == "exec" and "/bin/ping" in grp["read"]["file"], "%s: file.exec is limited to /bin/ping by the ACL" % f)
            continue
        check(meth in grp["read"]["ubus"].get(obj, []), "%s: ubus %s.%s allowed by ACL" % (f, obj, meth))

# ---- CSS --------------------------------------------------------------------
css = read("files/www/luci-static/almakhdhi/cascade.css")
body = re.sub(r"/\*.*?\*/", "", css, flags=re.S).strip()
check(body.startswith("@import url('/luci-static/bootstrap/cascade.css');"), "CSS starts with the local bootstrap @import (must be the first rule)")
check(body.count("{") == body.count("}") and body.count("(") == body.count(")"), "CSS braces and parentheses balanced")
check(not re.search(r"https?://|@font-face|url\(\s*['\"]?//", css), "CSS has no external URLs or web fonts")
check(all(re.search(p, css) for p in (r"--amk-header-bg:\s*#2e1065", r"\.amk-header", r"\.amk-sidebar", r"@media \(max-width: 900px\)", r'html\[dir="rtl"\]')), "CSS defines purple header, sidebar, responsive breakpoint and RTL rules")
early = read("files/www/luci-static/almakhdhi/amk-early.js")
menu = read("files/www/luci-static/resources/menu-almakhdhi.js")
check("width=device-width" in early and "amk-mobile-viewport" in early, "early script enforces device viewport and detects phone screen size")
check("orientationchange" in early, "early script refreshes responsive mode after rotation")
check("isMobile: function()" in menu and "sw <= 700" in menu, "sidebar controller detects mobile hardware even with desktop-site viewport")
check("100vw" in css and "html.amk-mobile-viewport" in css and "grid-template-columns: minmax(0, 1fr)" in css, "CSS forces full-width single-column phone layout")
check("body.amk-ready #mainmenu" in css, "stock menu is hidden only after the sidebar is ready (fallback stays usable)")

# ---- JS: no external loads, no heavy frameworks -------------------------------
for p in sorted((F / "www").rglob("*.js")):
    s = p.read_text(encoding="utf-8")
    bad = re.findall(r"https?://[A-Za-z0-9.-]+", s)
    check(not bad, "%s has no external URL (%s)" % (p.relative_to(F), bad))
    check(not re.search(r"\b(import\s+React|require\(['\"](react|vue)|from ['\"]react)", s), "%s uses no React/Vue" % p.name)
    check(not re.search(r"localStorage\.(set|get)Item\(\s*['\"][^'\"]*(password|passwd|secret|psk|wifi)", s, re.I), "%s does not store secrets in the browser" % p.name)

# ---- images -----------------------------------------------------------------
def png_size(path):
    d = path.read_bytes()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    return struct.unpack(">II", d[16:24])
logo = F / "www/luci-static/almakhdhi/logo.png"
orig = ROOT / "assets/logo-original.png"
lw, lh = png_size(logo); ow, oh = png_size(orig)
check(logo.stat().st_size < 20000 and (F / "www/luci-static/almakhdhi/favicon.png").stat().st_size < 8000, "logo %d bytes / favicon small enough for an 8 MB flash" % logo.stat().st_size)
check(abs(lw / lh - ow / oh) < 0.08, "shipped logo has the same aspect ratio as the original artwork (%dx%d vs %dx%d)" % (lw, lh, ow, oh))
check(orig.stat().st_size > 0, "original logo kept untouched in assets/logo-original.png")

# ---- size budget ---------------------------------------------------------------
total = sum(p.stat().st_size for p in (F / "www").rglob("*") if p.is_file()) + (F / "usr").stat().st_size * 0
total += sum(p.stat().st_size for p in (F / "usr").rglob("*") if p.is_file())
check(total < 150 * 1024, "everything added to the firmware (uncompressed) is %.1f KB, below the 150 KB budget" % (total / 1024))

# ---- default settings preserved ---------------------------------------------------
s99 = read("files/etc/uci-defaults/99-custom-settings")
for pat, msg in ((r'HOSTNAME="AbduRaheem"', "hostname"), (r'LAN_IP="192\.168\.1\.20"', "LAN IP"), (r'LAN_MASK="255\.255\.255\.0"', "LAN mask"),
                 (r'SSID_2G="AbduRaheem_2G"', "2.4G SSID"), (r'SSID_5G="ABDURAHEEM_5G"', "5G SSID"), (r'TXPOWER="20"', "tx power"),
                 (r"dhcp\.lan\.ignore='1'", "DHCP off"), (r"dhcp\.lan\.dhcpv6='disabled'", "DHCPv6 off"), (r"dhcp\.lan\.ra='disabled'", "RA off"), (r"dhcp\.lan\.ndp='disabled'", "NDP off")):
    check(re.search(pat, s99) is not None, "99-custom-settings keeps " + msg)
check("AbduRaheem" in read("files/etc/banner"), "files/etc/banner contains the literal name AbduRaheem")
for f in ("98-almakhdhi-theme", "99-custom-settings"):
    r = subprocess.run(["sh", "-n", str(F / "etc/uci-defaults" / f)], capture_output=True, text=True)
    check(r.returncode == 0, "sh -n %s" % f)
for f in ("scripts/prepare-theme.sh", "tests/verify_image_contents.sh", "tests/run_tests.sh"):
    r = subprocess.run(["bash", "-n", str(ROOT / f)], capture_output=True, text=True)
    check(r.returncode == 0, "bash -n %s" % f)

# ---- packages -------------------------------------------------------------------------
pk = [l.strip() for l in read("packages.txt").splitlines() if l.strip() and not l.startswith("#")]
check({"luci", "luci-i18n-base-ar", "wpad-basic-mbedtls", "kmod-mt76x0e", "kmod-mt7603"} <= set(pk), "packages.txt keeps luci, luci-i18n-base-ar, wpad-basic-mbedtls, kmod-mt76x0e, kmod-mt7603")
check(not any(re.search(r"node|npm|react|vue|python|luci-theme-(?!bootstrap)", p) for p in pk), "no heavy/extra packages were added")
check("-luci-theme-bootstrap" not in pk, "luci-theme-bootstrap is kept as fallback theme and as base stylesheet")

# ---- workflow ---------------------------------------------------------------------------
wf = read(".github/workflows/build.yml")
for pat, msg in ((r"sort -uV", "latest 24.10.x resolution"), (r"sha256sum -c", "SHA256 verification of ImageBuilder"), (r"ramips/mt76x8", "target ramips/mt76x8"),
                 (r"FILES=", "files/ overlay passed to ImageBuilder"), (r"make image", "make image"), (r"upload-artifact@v4", "artifact upload"),
                 (r"\*sysupgrade\*\.bin", "sysupgrade output"), (r"\*factory\*\.bin", "factory output"), (r"tests/run_tests\.sh", "offline tests run in CI"),
                 (r"scripts/prepare-theme\.sh", "theme templates derived in CI"), (r"verify_image_contents\.sh", "post-build content verification"),
                 (r"tplink_re205-v3", "RE205 v3 profile"), (r"packages\.txt", "package list")):
    check(re.search(pat, wf) is not None, "workflow: " + msg)
order = [wf.index(x) for x in ("tests/run_tests.sh", "Download and verify ImageBuilder", "scripts/prepare-theme.sh", "make image", "verify_image_contents.sh", "Collect output")]
check(order == sorted(order), "workflow steps are in the right order (tests -> download -> theme -> build -> verify -> collect)")
check("files/usr/share/ucode/luci/template/themes/almakhdhi/" in read(".gitignore"), "generated templates are git-ignored (they are derived from upstream at build time)")

sys.exit(1 if fails else 0)
