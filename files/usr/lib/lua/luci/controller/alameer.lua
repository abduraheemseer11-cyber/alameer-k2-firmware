module("luci.controller.alameer", package.seeall)

local fs = require "nixio.fs"
local http = require "luci.http"

function index()
    if not fs.access("/etc/config/wireless") then
        return
    end

    entry({"admin", "quicksetup"}, view("alameer/quicksetup"), _("Quick Setup"), 1).leaf = true
    entry({"admin", "alameer"}, firstchild(), _("ALAMEER SOFTWARE"), 90)
    entry({"admin", "alameer", "about"}, call("action_about"), _("About"), 1).leaf = true
end

function action_about()
    http.prepare_content("text/plain")
    http.write("ALAMEER SOFTWARE V3 - Purple Edition\\nPhicomm K2 v22.5 or newer\\nDeveloper: Eng. Abdulrahim Al-Makhadhi\\n")
end
