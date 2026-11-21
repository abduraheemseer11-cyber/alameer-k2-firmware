#!/usr/bin/env python3
"""Tiny stand-in for OpenWrt's `uci` (set/get/delete/add_list/commit/show/batch) for offline tests."""
import json, os, shlex, sys

DB = os.environ["MOCK_UCI_DB"]
db = json.load(open(DB))      # {config: [[name, type, {opt: str | [str]}], ...]}
rc = 0


def find(cfg, sec):
    secs = db.setdefault(cfg, [])
    if sec.startswith("@"):
        t, idx = sec[1:].rstrip("]").split("[")
        m = [s for s in secs if s[1] == t]
        return m[int(idx)] if m and int(idx) < len(m) else None
    for s in secs:
        if s[0] == sec:
            return s
    return None


def run(args):
    global rc
    args = [a for a in args if not a.startswith("-")]
    if not args:
        return
    cmd, rest = args[0], args[1:]
    if cmd == "set":
        path, _, val = rest[0].partition("=")
        p = path.split(".")
        if len(p) == 2:
            s = find(p[0], p[1])
            if s: s[1] = val
            else: db.setdefault(p[0], []).append([p[1], val, {}])
        else:
            s = find(p[0], p[1])
            if not s: rc = 1; return
            s[2][p[2]] = val
    elif cmd == "get":
        p = rest[0].split(".")
        s = find(p[0], p[1])
        if not s: rc = 1; return
        if len(p) == 2: print(s[1]); return
        v = s[2].get(p[2])
        if v is None: rc = 1; return
        print(" ".join(v) if isinstance(v, list) else v)
    elif cmd == "delete":
        p = rest[0].split(".")
        s = find(p[0], p[1])
        if not s: rc = 1; return
        if len(p) == 2: db[p[0]].remove(s)
        elif p[2] in s[2]: del s[2][p[2]]
        else: rc = 1
    elif cmd == "add_list":
        path, _, val = rest[0].partition("=")
        p = path.split(".")
        s = find(p[0], p[1])
        cur = s[2].get(p[2], [])
        s[2][p[2]] = (cur if isinstance(cur, list) else [cur]) + [val]
    elif cmd == "commit":
        with open(DB + ".commits", "a") as f: f.write(" ".join(rest) + "\n")
    elif cmd == "show":
        for name, typ, opts in db.get(rest[0], []):
            print("%s.%s=%s" % (rest[0], name, typ))
            for k, v in opts.items():
                vals = v if isinstance(v, list) else [v]
                print("%s.%s.%s=%s" % (rest[0], name, k, " ".join("'%s'" % x for x in vals)))
    elif cmd == "batch":
        for line in sys.stdin.read().splitlines():
            if line.strip():
                run(shlex.split(line))
    else:
        rc = 1


run(sys.argv[1:])
json.dump(db, open(DB, "w"))
sys.exit(rc)
