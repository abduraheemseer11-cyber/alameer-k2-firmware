#!/usr/bin/env python3
import pathlib, re, shutil, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PATCH = ROOT / "scripts" / "patch_theme.py"
FIX = ROOT / "tests" / "fixtures" / "bootstrap"
fails = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def run(src, dst):
    return subprocess.run([sys.executable, str(PATCH), str(src), str(dst)], capture_output=True, text=True)


with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    out = tmp / "out"
    r = run(FIX, out)
    check(r.returncode == 0, "patcher succeeds on fixture templates: " + r.stderr.strip())
    h = (out / "header.ut").read_text()
    f = (out / "footer.ut").read_text()
    s = (out / "sysauth.ut").read_text()

    check("amk-early.js" in h and h.index("amk-early.js") < h.index("</head>"), "header: early script inserted inside <head>")
    check('href="{{ media }}/favicon.png"' in h and "favicon.svg" not in h, "header: PNG favicon replaces SVG favicon")
    check('content="#2e1065"' in h, "header: theme-color is dark purple")
    check('name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"' in h, "header: mobile viewport is defined so responsive breakpoints work")
    check("{{ media }}/cascade.css" in h, "header: still loads the theme cascade.css through {{ media }}")
    check("cbi.js" in h and "translations" in h, "header: upstream LuCI bootstrap scripts preserved")
    check("menu-almakhdhi" in f and f.index("menu-almakhdhi") < f.index("</body>"), "footer: sidebar loader inserted before </body>")
    check("menu-bootstrap" in f, "footer: stock menu loader preserved (fallback)")
    check("themes/almakhdhi/header" in s and "themes/bootstrap" not in s, "sysauth: template paths rewritten to the new theme")
    for name, text in (("header", h), ("footer", f), ("sysauth", s)):
        check(text.count("{%") == text.count("%}") and text.count("{{") == text.count("}}"), name + ": ucode delimiters stay balanced")
        check("themes/bootstrap" not in text, name + ": no reference to the bootstrap template directory left")

    # failure modes must be loud
    bad = tmp / "bad"
    shutil.copytree(FIX, bad)
    (bad / "header.ut").write_text((bad / "header.ut").read_text().replace("</head>", ""))
    r = run(bad, tmp / "o2")
    check(r.returncode != 0 and "</head>" in r.stderr, "missing </head> anchor makes the patcher fail with a clear message")
    bad2 = tmp / "bad2"
    shutil.copytree(FIX, bad2)
    (bad2 / "footer.ut").write_text("no closing tag")
    r = run(bad2, tmp / "o3")
    check(r.returncode != 0 and "</body>" in r.stderr, "missing </body> anchor makes the patcher fail")
    bad3 = tmp / "bad3"
    bad3.mkdir()
    (bad3 / "header.ut").write_text("x")
    r = run(bad3, tmp / "o4")
    check(r.returncode != 0 and "footer.ut" in r.stderr, "missing footer.ut makes the patcher fail")
    r = run(tmp / "nope", tmp / "o5")
    check(r.returncode != 0, "missing upstream directory makes the patcher fail")

sys.exit(1 if fails else 0)
