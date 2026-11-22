module("luci.controller.alameer", package.seeall)

function index()
    entry({"admin", "status", "alameer"}, template("alameer/dashboard"), _("لوحة التحكم السريعة"), 10)
    entry({"admin", "status", "alameer", "scan"}, call("action_scan"), _("ماسح الشبكات"), 20)
    entry({"admin", "status", "alameer", "mode"}, call("action_set_mode"), _("تغيير الوضع"), 30)
end

function action_scan()
    local iwinfo = require "luci.model.iwinfo"
    local radio = luci.http.formvalue("radio") or "radio0"
    local scan = iwinfo.scanlist(radio)
    local results = {}
    for _, net in ipairs(scan) do
        table.insert(results, {
            ssid = net.ssid,
            bssid = net.bssid,
            channel = net.channel,
            signal = net.signal,
            encryption = net.encryption
        })
    end
    luci.http.prepare_content("application/json")
    luci.http.write_json(results)
end

function action_set_mode()
    local mode = luci.http.formvalue("mode")
    local uci = require "luci.model.uci".cursor()
    if mode == "ap" then
        uci:set("network", "lan", "proto", "static")
        uci:set("network", "lan", "ipaddr", "192.168.1.20")
        uci:set("network", "lan", "netmask", "255.255.255.0")
        uci:delete("network", "wan")
        uci:commit("network")
    elseif mode == "router" then
        uci:set("network", "lan", "proto", "static")
        uci:set("network", "lan", "ipaddr", "192.168.1.1")
        uci:set("network", "wan", "proto", "dhcp")
        uci:commit("network")
    end
    luci.http.redirect(luci.dispatcher.build_url("admin/status/alameer"))
end
