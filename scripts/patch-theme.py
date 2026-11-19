#!/usr/bin/env python3
"""
ALAMEER SOFTWARE - patch luci-theme-bootstrap header/footer + inject custom CSS.
Works with both 21.02 (header.htm/footer.htm) and 22.03+ (header.ut/footer.ut).
Usage: patch-theme.py feeds/luci/themes/luci-theme-bootstrap
"""
import re, sys, pathlib

theme = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else
                     "feeds/luci/themes/luci-theme-bootstrap")
if not theme.exists():
    sys.exit(f"ERROR: theme directory not found: {theme}")

def find_first(*patterns):
    for pat in patterns:
        for p in theme.rglob(pat):
            return p
    return None

header = find_first("header.htm", "header.ut")
footer = find_first("footer.htm", "footer.ut")
if not header: sys.exit("ERROR: header template not found")
if not footer: sys.exit("ERROR: footer template not found")
print(f"HEADER: {header}\nFOOTER: {footer}")

# ---------- header ----------
s = header.read_text(encoding="utf-8")
if "custom-alameer.css" not in s:
    m = re.search(r'<link[^>]*cascade\.css[^>]*>', s)
    if not m: sys.exit("ERROR: cascade.css <link> not found")
    s = s[:m.end()] + '\n\t\t<link rel="stylesheet" href="<%=media%>/custom-alameer.css">' + s[m.end():]
    print("  + custom-alameer.css injected")
else:
    print("  = custom-alameer.css present")

if "alameer-logo" not in s:
    def _brand(m):
        return (m.group(1)
                + '<img class="alameer-logo" src="<%=resource%>/alameer-logo.png"'
                  ' alt="ALAMEER" width="36" height="36"'
                  ' style="vertical-align:middle;margin-right:8px">'
                + '<span class="alameer-title">ALAMEER SOFTWARE | الماخذي</span>'
                + m.group(3))
    s, n = re.subn(r'(<a\b[^>]*\bclass=["\']brand["\'][^>]*>)(.*?)(</a>)',
                   _brand, s, count=1, flags=re.DOTALL)
    if n == 0: sys.exit("ERROR: <a class=\"brand\"> not found")
    print("  + brand replaced")
else:
    print("  = brand already patched")
header.write_text(s, encoding="utf-8")

# ---------- footer ----------
t = footer.read_text(encoding="utf-8")
FOOT = ('<span class="alameer-footer">ALAMEER SOFTWARE | '
        'تطوير وبرمجة: المهندس عبد الرحيم الماخذي (Eng. Abdulrahim Al-Makhadhi)</span>')
if "alameer-footer" not in t:
    m = re.search(r'<a\b[^>]*href=["\']https?://github\.com/openwrt/luci["\'][^>]*>.*?</a>',
                  t, re.DOTALL)
    if m:
        t = t[:m.start()] + FOOT + t[m.end():]
        print("  + 'Powered by LuCI' replaced")
    else:
        m = re.search(r'(<footer\b[^>]*>)', t)
        if not m: sys.exit("ERROR: <footer> not found")
        t = t[:m.end()] + "\n\t\t" + FOOT + t[m.end():]
        print("  + footer note inserted")
else:
    print("  = footer already patched")
footer.write_text(t, encoding="utf-8")
print("OK: theme patched")
