#!/usr/bin/env python3
"""Runs the real first-boot scripts (98 theme, 99 custom settings) against a mock uci."""
import json, os, pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
MOCK = ROOT / "tests" / "mock_uci.py"
S98 = ROOT / "files/etc/uci-defaults/98-almakhdhi-theme"
S99 = ROOT / "files/etc/uci-defaults/99-custom-settings"
fails = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def base_db(band_opts):
    r0 = {"channel": "auto", **band_opts[0]}
    r1 = {"channel": "auto", **band_opts[1]}
    return {
        "system": [["cfg01", "system", {"hostname": "OpenWrt"}]],
        "network": [["globals", "globals", {"ula_prefix": "fd12:3456:789a::/48"}],
                    ["lan", "interface", {"proto": "static", "ipaddr": "192.168.1.1", "netmask": "255.255.255.0", "ip6assign": "60"}]],
        "dhcp": [["lan", "dhcp", {"interface": "lan", "start": "100", "limit": "150", "leasetime": "12h", "dhcpv6": "server", "ra": "server", "ra_slaac": "1", "ra_flags": ["managed-config", "other-config"]}]],
        "wireless": [["radio0", "wifi-device", {**r0, "disabled": "1"}], ["default_radio0", "wifi-iface", {"device": "radio0", "network": "lan", "mode": "ap", "ssid": "OpenWrt", "encryption": "none"}],
                     ["radio1", "wifi-device", {**r1, "disabled": "1"}], ["default_radio1", "wifi-iface", {"device": "radio1", "network": "lan", "mode": "ap", "ssid": "OpenWrt", "encryption": "none"}]],
        "luci": [["main", "core", {"mediaurlbase": "/luci-static/bootstrap", "lang": "auto"}]],
    }


def opt(db, cfg, sec, o):
    for n, t, opts in db.get(cfg, []):
        if n == sec or (sec.startswith("@" + t)):
            return opts.get(o)
    return None


def run_script(script, db, tmp):
    dbf = tmp / "db.json"
    dbf.write_text(json.dumps(db))
    (tmp / "bin").mkdir(exist_ok=True)
    (tmp / "bin/uci").write_text('#!/bin/sh\nexec python3 "%s" "$@"\n' % MOCK)
    (tmp / "bin/wifi").write_text("#!/bin/sh\nexit 0\n")
    for f in ("uci", "wifi"):
        os.chmod(tmp / "bin" / f, 0o755)
    text = script.read_text().replace("/etc/banner", str(tmp / "banner"))
    sp = tmp / "script.sh"
    sp.write_text(text)
    env = dict(os.environ, PATH=str(tmp / "bin") + ":" + os.environ["PATH"], MOCK_UCI_DB=str(dbf))
    r = subprocess.run(["sh", str(sp)], env=env, capture_output=True, text=True)
    return r, json.loads(dbf.read_text())


def verify_99(db, tmp, label):
    check(opt(db, "system", "@system[0]", "hostname") == "AbduRaheem", label + ": hostname AbduRaheem")
    check(opt(db, "network", "lan", "ipaddr") == "192.168.1.20" and opt(db, "network", "lan", "netmask") == "255.255.255.0", label + ": LAN 192.168.1.20/255.255.255.0")
    check(opt(db, "network", "lan", "proto") == "static", label + ": LAN proto static")
    check(opt(db, "network", "lan", "ip6assign") is None and opt(db, "network", "globals", "ula_prefix") is None, label + ": no IPv6 prefix assignment / ULA")
    check(opt(db, "dhcp", "lan", "ignore") == "1", label + ": DHCPv4 disabled (ignore=1)")
    check(all(opt(db, "dhcp", "lan", k) == "disabled" for k in ("dhcpv6", "ra", "ndp")), label + ": DHCPv6 / RA / NDP disabled")
    check(opt(db, "wireless", "default_radio0", "ssid") == "AbduRaheem_2G", label + ": 2.4 GHz SSID AbduRaheem_2G")
    check(opt(db, "wireless", "default_radio1", "ssid") == "ABDURAHEEM_5G", label + ": 5 GHz SSID ABDURAHEEM_5G")
    check(all(opt(db, "wireless", r, "txpower") == "20" and opt(db, "wireless", r, "disabled") == "0" for r in ("radio0", "radio1")), label + ": both radios enabled, txpower 20 dBm")
    b = (tmp / "banner")
    check(b.exists() and "AbduRaheem" in b.read_text(), label + ": SSH banner written and contains AbduRaheem")


with tempfile.TemporaryDirectory() as t:
    t = pathlib.Path(t)
    r, db = run_script(S99, base_db([{"band": "2g"}, {"band": "5g"}]), t)
    check(r.returncode == 0, "99-custom-settings exits 0 (so OpenWrt deletes it after first boot): " + r.stderr.strip())
    verify_99(db, t, "99 (band option)")

with tempfile.TemporaryDirectory() as t:
    t = pathlib.Path(t)
    r, db = run_script(S99, base_db([{"hwmode": "11g"}, {"hwmode": "11a"}]), t)
    check(r.returncode == 0, "99-custom-settings works on radios that only have hwmode")
    verify_99(db, t, "99 (hwmode fallback)")

with tempfile.TemporaryDirectory() as t:
    t = pathlib.Path(t)
    d = base_db([{"band": "2g"}, {"band": "5g"}])
    d["wireless"] = [x for x in d["wireless"] if x[0] in ("radio0", "radio1")]       # radios without any wifi-iface
    r, db = run_script(S99, d, t)
    check(r.returncode == 0 and opt(db, "wireless", "ap_radio0", "ssid") == "AbduRaheem_2G" and opt(db, "wireless", "ap_radio1", "ssid") == "ABDURAHEEM_5G", "99 creates the missing access-point sections")

with tempfile.TemporaryDirectory() as t:
    t = pathlib.Path(t)
    r, db = run_script(S98, base_db([{"band": "2g"}, {"band": "5g"}]), t)
    check(r.returncode == 0, "98-almakhdhi-theme exits 0: " + r.stderr.strip())
    check(opt(db, "luci", "main", "mediaurlbase") == "/luci-static/almakhdhi", "98: luci.main.mediaurlbase -> /luci-static/almakhdhi")
    check(opt(db, "luci", "themes", "AlMakhdhi") == "/luci-static/almakhdhi", "98: theme registered in luci.themes (created even if the section was missing)")
    check(os.path.exists(str(t / "db.json.commits")) and "luci" in open(str(t / "db.json.commits")).read(), "98: luci config committed")
    r2, db2 = run_script(S98, db, t)    # running twice stays idempotent
    check(opt(db2, "luci", "main", "mediaurlbase") == "/luci-static/almakhdhi", "98 is idempotent")

# the theme must be selected AFTER stock luci-theme-bootstrap's own uci-default (30_luci-theme-bootstrap)
check(S98.name > "30_luci-theme-bootstrap", "98 sorts after the stock theme's uci-default so it wins")
check(S98.name < S99.name, "98 runs before 99-custom-settings")

sys.exit(1 if fails else 0)
