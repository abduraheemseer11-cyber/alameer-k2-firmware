#!/usr/bin/env python3
"""Build header.htm for the alameer theme: keep the <head> of the stock luci-theme-bootstrap
header (it loads luci.js / cbi.js and initialises LuCI), replace its <body> with our sidebar."""
import re, sys
src, body, out = sys.argv[1:4]
h = open(src, encoding="utf-8").read()
m = re.search(r"</head>", h, re.I)
if not m:
    sys.exit("ERROR: </head> not found in stock bootstrap header.htm")
head = h[:m.end()]
head = re.sub(r'(<meta name="viewport" content=")initial-scale=1(\.0)?"', r'\1width=device-width, initial-scale=1"', head)
head = re.sub(r'<link[^>]*mobile\.css[^>]*>', '', head)
open(out, "w", encoding="utf-8").write(head + "\n" + open(body, encoding="utf-8").read())
print("header.htm generated:", len(head), "bytes of stock <head> kept")
