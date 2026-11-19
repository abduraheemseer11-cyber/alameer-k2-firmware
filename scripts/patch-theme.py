#!/usr/bin/env python3
"""
ALAMEER SOFTWARE - patch the REAL luci-theme-bootstrap templates (OpenWrt 21.02.7)

Instead of shipping a hand-copied header.htm/footer.htm (which can break LuCI if it
differs from the stock file by even one line), this script patches the genuine files
from the checked-out LuCI feed, so the result is always compatible:
  * header.htm : links custom-alameer.css and replaces the brand with logo + title
  * footer.htm : replaces the "Powered by LuCI" text with the ALAMEER footer
Usage: patch-theme.py <.../luasrc/view/themes/bootstrap>
"""
import re, sys, pathlib

d = pathlib.Path(sys.argv[1])
header, footer = d / "header.htm", d / "footer.htm"
for f in (header, footer):
    if not f.exists():
        sys.exit(f"ERROR: {f} not found")

# ------------------------------ header.htm ------------------------------
s = header.read_text(encoding="utf-8")

if "custom-alameer.css" not in s:
    s, n = re.subn(
        r'(<link rel="stylesheet" href="<%=media%>/cascade\.css[^"]*"[^>]*>)',
        lambda m: m.group(1) + '\n\t\t<link rel="stylesheet" href="<%=media%>/custom-alameer.css">',
        s, count=1)
    if n == 0:
        sys.exit("ERROR: cascade.css <link> not found in header.htm")

if "alameer-logo" not in s:
    def brand(m):
        inner = m.group(2)  # original hostname expression is preserved
        return (m.group(1)
                + '<img class="alameer-logo" src="<%=resource%>/alameer-logo.png" alt="ALAMEER" width="36" height="36">'
                + '<span class="alameer-title">ALAMEER SOFTWARE | الماخذي</span>'
                + '<small class="alameer-host">' + inner + '</small></a>')
    s, n = re.subn(r'(<a class="brand"[^>]*>)(.*?)</a>', brand, s, count=1, flags=re.S)
    if n == 0:
        sys.exit('ERROR: <a class="brand"> not found in header.htm')

header.write_text(s, encoding="utf-8")

# ------------------------------ footer.htm ------------------------------
t = footer.read_text(encoding="utf-8")
FOOT = ('<span class="alameer-footer">ALAMEER SOFTWARE | '
        'تطوير وبرمجة: المهندس عبد الرحيم الماخذي (Eng. Abdulrahim Al-Makhadhi)</span>')

if "alameer-footer" not in t:
    t, n = re.subn(r'<a href="https://github\.com/openwrt/luci">.*?</a>',
                   lambda m: FOOT, t, count=1, flags=re.S)
    if n == 0:  # fallback: insert right after the <footer> tag
        t, n = re.subn(r'(<footer[^>]*>)', lambda m: m.group(1) + "\n\t\t" + FOOT, t, count=1)
    if n == 0:
        sys.exit("ERROR: <footer> not found in footer.htm")
footer.write_text(t, encoding="utf-8")

print("OK: header.htm and footer.htm patched")
