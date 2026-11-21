#!/usr/bin/env python3
"""
Derive the AlMakhdhi theme templates from the REAL luci-theme-bootstrap templates
of the LuCI release that is being built.

usage: patch_theme.py <upstream themes/bootstrap dir> <output themes/almakhdhi dir>

Why: header.ut / footer.ut / sysauth.ut contain the LuCI runtime bootstrap
(L.env, session token, translations, cbi.js ...) which changes between LuCI
releases. Instead of guessing it, we copy the upstream templates and make only
three small, asserted insertions. If an anchor is missing the script fails with
a clear message and the firmware is NOT built with a half-working theme.
"""
import pathlib
import re
import sys

THEME = "almakhdhi"

EARLY = '<script src="{{ media }}/amk-early.js"></script>\n<link rel="icon" type="image/png" href="{{ media }}/favicon.png">\n'
LOADER = "<script type=\"text/javascript\">L.require('menu-almakhdhi')</script>\n"


def fail(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def patch_header(text):
    if "</head>" not in text:
        fail("header.ut: '</head>' anchor not found - upstream template layout changed")
    if "cascade.css" not in text:
        fail("header.ut: no cascade.css reference - upstream template layout changed")

    # LuCI's upstream template may omit the viewport declaration. Without it,
    # mobile browsers use a wide virtual layout viewport and our mobile media
    # queries never activate, making the complete desktop shell appear tiny.
    if not re.search(r'<meta\s+name=["\']viewport["\']', text, re.I):
        viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        if re.search(r'<meta\s+charset=', text, re.I):
            text = re.sub(r'(<meta\s+charset=[^>]+>\s*)', r'\1' + viewport, text, count=1, flags=re.I)
        else:
            text = text.replace("</head>", viewport + "</head>", 1)

    text = text.replace("</head>", EARLY + "</head>", 1)
    # purple browser chrome on phones (optional, tolerant)
    text = re.sub(r'(<meta\s+name="theme-color"\s+content=")[^"]*(")', r"\g<1>#2e1065\g<2>", text)
    # drop the stock SVG favicon so ours (inserted above) is used
    text = re.sub(r'\s*<link\s+rel="icon"\s+href="[^"]*favicon\.svg">', "", text)
    return text


def patch_footer(text):
    idx = text.rfind("</body>")
    if idx < 0:
        fail("footer.ut: '</body>' anchor not found - upstream template layout changed")
    return text[:idx] + LOADER + text[idx:]


def main():
    if len(sys.argv) != 3:
        fail(__doc__)
    src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    if not src.is_dir():
        fail("upstream template directory not found: %s" % src)

    files = sorted(p for p in src.iterdir() if p.is_file())
    names = [p.name for p in files]
    for need in ("header.ut", "footer.ut"):
        if need not in names:
            fail("%s not found in %s (found: %s)" % (need, src, ", ".join(names) or "nothing"))

    dst.mkdir(parents=True, exist_ok=True)
    for p in files:
        text = p.read_text(encoding="utf-8")
        text = text.replace("themes/bootstrap", "themes/" + THEME)
        if p.name == "header.ut":
            text = patch_header(text)
        elif p.name == "footer.ut":
            text = patch_footer(text)
        (dst / p.name).write_text(text, encoding="utf-8")
        print("  wrote %s/%s" % (dst, p.name))


if __name__ == "__main__":
    main()
