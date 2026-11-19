#!/usr/bin/env python3
"""
ALAMEER SOFTWARE - patch luci-theme-bootstrap header/footer + inject custom CSS.

Supports both LuCI template generations:
  * OpenWrt 21.02  -> luasrc/view/themes/bootstrap/header.htm , footer.htm
  * OpenWrt 22.03+ -> ucode/template/themes/bootstrap/header.ut , footer.ut

Strategy:
  1. Prefer .ut (ucode) files, they are the active templates on 22.03+.
  2. Fall back to .htm (legacy Lua) if .ut is missing.
  3. Never require cascade.css specifically - if it is not present,
     inject the CSS right before </head> (or the ucode body close tag).

Usage: patch-theme.py feeds/luci/themes/luci-theme-bootstrap
"""
import re
import sys
import pathlib

# --------------------------------------------------------------------------
# locate theme
# --------------------------------------------------------------------------
theme = pathlib.Path(sys.argv[1] if len(sys.argv) > 1
                     else "feeds/luci/themes/luci-theme-bootstrap")
if not theme.exists():
    sys.exit(f"ERROR: theme directory not found: {theme}")

def find_any(*names):
    """Return the first matching file for the given basenames (in order)."""
    for name in names:
        hits = list(theme.rglob(name))
        if hits:
            return hits[0]
    return None

# .ut first (22.03+), .htm fallback (21.02)
header = find_any("header.ut", "header.htm")
footer = find_any("footer.ut", "footer.htm")

if not header:
    sys.exit(f"ERROR: no header.ut / header.htm under {theme}")
if not footer:
    sys.exit(f"ERROR: no footer.ut / footer.htm under {theme}")

print(f"HEADER: {header}")
print(f"FOOTER: {footer}")

# --------------------------------------------------------------------------
# helper: inject a stylesheet link
# --------------------------------------------------------------------------
CSS_LINK = '<link rel="stylesheet" href="<%= media %>/custom-alameer.css">'

def inject_css(text: str) -> str:
    if "custom-alameer.css" in text:
        print("  = custom-alameer.css already present")
        return text

    # 1) try to append right after any cascade.css <link>
    m = re.search(r'<link[^>]*cascade\.css[^>]*>', text, re.IGNORECASE)
    if m:
        print("  + cascade.css found -> CSS link appended after it")
        return text[:m.end()] + "\n\t\t" + CSS_LINK + text[m.end():]

    # 2) try to append after ANY stylesheet <link> already in the template
    links = list(re.finditer(r'<link[^>]*rel=["\']stylesheet["\'][^>]*>',
                             text, re.IGNORECASE))
    if links:
        last = links[-1]
        print("  + no cascade.css, CSS link appended after last stylesheet link")
        return text[:last.end()] + "\n\t\t" + CSS_LINK + text[last.end():]

    # 3) last resort: inject right before </head>
    m = re.search(r'</head\s*>', text, re.IGNORECASE)
    if m:
        print("  + no stylesheet at all, CSS link injected before </head>")
        return text[:m.start()] + "\t\t" + CSS_LINK + "\n\t" + text[m.start():]

    sys.exit("ERROR: could not find a safe place to inject custom-alameer.css")

# --------------------------------------------------------------------------
# patch header
# --------------------------------------------------------------------------
s = header.read_text(encoding="utf-8")
s = inject_css(s)

if "alameer-logo" not in s:
    brand_re = re.compile(
        r'(<a\b[^>]*\bclass=["\']brand["\'][^>]*>)(.*?)(</a>)',
        re.DOTALL,
    )
    def _brand(m):
        return (
            m.group(1)
            + '<img class="alameer-logo" src="<%= resource %>/alameer-logo.png"'
              ' alt="ALAMEER" width="36" height="36"'
              ' style="vertical-align:middle;margin-right:8px">'
            + '<span class="alameer-title">ALAMEER SOFTWARE | الماخذي</span>'
            + m.group(3)
        )
    s, n = brand_re.subn(_brand, s, count=1)
    if n:
        print("  + brand replaced with logo + title")
    else:
        print("  ! WARNING: <a class=\"brand\">...</a> not found (header still usable)")
else:
    print("  = alameer logo already present")

header.write_text(s, encoding="utf-8")

# --------------------------------------------------------------------------
# patch footer
# --------------------------------------------------------------------------
t = footer.read_text(encoding="utf-8")
FOOT = ('<span class="alameer-footer">ALAMEER SOFTWARE | '
        'تطوير وبرمجة: المهندس عبد الرحيم الماخذي (Eng. Abdulrahim Al-Makhadhi)</span>')

if "alameer-footer" not in t:
    m = re.search(
        r'<a\b[^>]*href=["\']https?://github\.com/openwrt/luci["\'][^>]*>.*?</a>',
        t, re.DOTALL,
    )
    if m:
        t = t[:m.start()] + FOOT + t[m.end():]
        print("  + 'Powered by LuCI' link replaced")
    else:
        m = re.search(r'(<footer\b[^>]*>)', t)
        if m:
            t = t[:m.end()] + "\n\t\t" + FOOT + t[m.end():]
            print("  + footer note inserted after <footer>")
        else:
            print("  ! WARNING: no <footer> tag - footer left untouched")
else:
    print("  = alameer footer already present")

footer.write_text(t, encoding="utf-8")

print("OK: theme patched")
