-- ALAMEER SOFTWARE - LuCI controller (Lua LuCI: OpenWrt 21.02 / 22.03)
-- Developed by Eng. Abdulrahim Al-Makhadhi
module("luci.controller.alameer", package.seeall)

local fs   = require "nixio.fs"
local util = require "luci.util"
local sys  = require "luci.sys"
local http = require "luci.http"

function index()
	entry({"admin", "status", "alameer"}, template("alameer/dashboard"), _("ALAMEER Dashboard"), 1)
	entry({"admin", "status", "alameer", "data"}, call("action_data")).leaf = true
	entry({"admin", "network", "alameer"}, template("alameer/setup"), _("ALAMEER Quick Setup"), 90)
	entry({"admin", "network", "alameer", "scan"}, call("action_scan")).leaf = true
	entry({"admin", "network", "alameer", "apply"}, call("action_apply")).leaf = true
	entry({"admin", "network", "alameer", "state"}, call("action_state")).leaf = true
	entry({"admin", "system", "alameer_about"}, template("alameer/about"), _("About ALAMEER"), 99)
end

local function trim(s) return (s or ""):gsub("^%s+", ""):gsub("%s+$", "") end
local function json(t) http.prepare_content("application/json"); http.write_json(t) end

local function kv_file(path)
	local t = {}
	for line in (fs.readfile(path) or ""):gmatch("[^\n]+") do
		local k, v = line:match("^([%w_]+)=['\"]?(.-)['\"]?$")
		if k then t[k] = v end
	end
	return t
end

local function wifi_ifaces()
	local out = {}
	local st = util.ubus("network.wireless", "status", {}) or {}
	for radio, r in pairs(st) do
		local band = (r.config and (r.config.band or r.config.hwmode)) or ""
		for _, i in ipairs(r.interfaces or {}) do
			if i.ifname then
				out[#out + 1] = { radio = radio, ifname = i.ifname, up = r.up, band = band,
					mode = i.config and i.config.mode, ssid = i.config and i.config.ssid }
			end
		end
	end
	return out
end

local function band_of(b)
	b = tostring(b or "")
	if b:find("5g") or b:find("11a") then return "5g" end
	return "2g"
end

function action_data()
	local d = {}
	d.hostname = sys.hostname()
	d.model = trim(fs.readfile("/tmp/sysinfo/model"))
	d.board = trim(fs.readfile("/tmp/sysinfo/board_name"))
	local rel = kv_file("/etc/openwrt_release")
	local al  = kv_file("/etc/alameer_release")
	d.firmware = { alameer = al.ALAMEER_VERSION or "dev", build = al.ALAMEER_BUILD or "",
		openwrt = rel.DISTRIB_DESCRIPTION or rel.DISTRIB_RELEASE or "" }
	d.uptime = sys.uptime()
	local l1, l5, l15 = sys.loadavg()
	d.load = { l1, l5, l15 }
	-- CPU
	local ci = fs.readfile("/proc/cpuinfo") or ""
	d.cpu = { type = ci:match("system type%s*:%s*([^\n]+)") or "", model = ci:match("cpu model%s*:%s*([^\n]+)") or "",
		bogomips = ci:match("BogoMIPS%s*:%s*([^\n]+)") or "" }
	-- RAM
	local mi = fs.readfile("/proc/meminfo") or ""
	local function mem(k) return tonumber(mi:match(k .. ":%s*(%d+)")) or 0 end
	d.mem = { total = mem("MemTotal"), free = mem("MemFree"), available = mem("MemAvailable"),
		buffers = mem("Buffers"), cached = mem("Cached") }
	-- Flash
	d.flash = {}
	for _, mp in ipairs({ "/overlay", "/rom" }) do
		local l = util.exec("df -k " .. mp .. " 2>/dev/null | tail -n1")
		local total, used, avail = l:match("%S+%s+(%d+)%s+(%d+)%s+(%d+)")
		if total then d.flash[#d.flash + 1] = { mount = mp, total = tonumber(total), used = tonumber(used), avail = tonumber(avail) } end
	end
	-- Wireless + clients
	d.wireless, d.clients = {}, {}
	local arp = {}
	for line in (fs.readfile("/proc/net/arp") or ""):gmatch("[^\n]+") do
		local ip, mac = line:match("^(%S+)%s+%S+%s+%S+%s+(%S+)")
		if ip and mac and mac ~= "HW" then arp[mac:lower()] = ip end
	end
	for _, w in ipairs(wifi_ifaces()) do
		local info = util.ubus("iwinfo", "info", { device = w.ifname }) or {}
		d.wireless[#d.wireless + 1] = { ifname = w.ifname, radio = w.radio, band = band_of(w.band), up = w.up and true or false,
			mode = w.mode, ssid = info.ssid or w.ssid, channel = info.channel, freq = info.frequency,
			txpower = info.txpower, country = info.country, signal = info.signal, noise = info.noise, bitrate = info.bitrate }
		local hc = util.ubus("hostapd." .. w.ifname, "get_clients", {})
		if hc and hc.clients then
			for mac, c in pairs(hc.clients) do
				d.clients[#d.clients + 1] = { mac = mac, ip = arp[mac:lower()] or "", iface = w.ifname, ssid = w.ssid,
					signal = c.signal }
			end
		end
	end
	-- Interfaces
	d.interfaces = {}
	local dump = util.ubus("network.interface", "dump", {}) or {}
	for _, i in ipairs(dump.interface or {}) do
		if i.interface ~= "loopback" then
			local a = i["ipv4-address"] and i["ipv4-address"][1]
			d.interfaces[#d.interfaces + 1] = { name = i.interface, up = i.up and true or false, proto = i.proto,
				device = i.l3_device or i.device, ip = a and (a.address .. "/" .. a.mask) or "" }
		end
	end
	-- Ethernet ports (swconfig)
	d.ports = {}
	local sw = util.exec("swconfig dev switch0 show 2>/dev/null")
	for p, state, rest in sw:gmatch("link: port:(%d+) link:(%a+)([^\n]*)") do
		d.ports[#d.ports + 1] = { port = tonumber(p), up = (state == "up"), speed = trim(rest) }
	end
	d.mode = util.exec("uci -q get alameer.core.mode"):gsub("%s+", "")
	d.log = util.exec("logread 2>/dev/null | tail -n 60")
	d.wdlog = fs.readfile("/tmp/alameer-watchdog.log") or ""
	json(d)
end


function action_scan()
	local want = http.formvalue("band")
	if want ~= "2g" and want ~= "5g" then return json({ ok = false, error = "bad band" }) end
	local iw = require "iwinfo"
	local res = {}
	for _, w in ipairs(wifi_ifaces()) do
		if band_of(w.band) == want then
			local t = iw.type(w.ifname)
			local list = t and iw[t].scanlist(w.ifname) or {}
			for _, e in ipairs(list) do
				local enc, supported = "none", true
				local x = e.encryption
				if x and x.enabled then
					local auth = {}
					for _, a in ipairs(x.authentication or {}) do auth[a] = true end
					if x.wep then enc, supported = "wep", false
					elseif auth["8021x"] then enc, supported = "802.1x", false
					elseif auth["sae"] and auth["psk"] then enc = "sae-mixed"
					elseif auth["sae"] then enc = "sae"
					elseif x.wpa == 1 then enc = "psk"
					else enc = "psk2" end
				end
				if e.ssid and e.ssid ~= "" then
					res[#res + 1] = { ssid = e.ssid, bssid = e.bssid, channel = e.channel, signal = e.signal,
						quality = e.quality, quality_max = e.quality_max, enc = enc, supported = supported }
				end
			end
			break
		end
	end
	table.sort(res, function(a, b) return (a.signal or -999) > (b.signal or -999) end)
	json({ ok = true, networks = res })
end

function action_state()
	local c = require("luci.model.uci").cursor()
	json({ mode = c:get("alameer", "core", "mode"), hostname = c:get("alameer", "core", "hostname"),
		lan_ip = c:get("alameer", "core", "lan_ip"), netmask = c:get("alameer", "core", "netmask"),
		gateway = c:get("alameer", "core", "gateway") or "", dns = c:get("alameer", "core", "dns") or "",
		ssid_2g = c:get("alameer", "wifi_2g", "ssid"), enc_2g = c:get("alameer", "wifi_2g", "encryption"),
		ssid_5g = c:get("alameer", "wifi_5g", "ssid"), enc_5g = c:get("alameer", "wifi_5g", "encryption"),
		pppoe = fs.access("/lib/netifd/proto/ppp.sh") and true or false })
end

local ALLOWED = { "hostname", "lan_ip", "netmask", "gateway", "dns", "ssid_2g", "enc_2g", "key_2g", "ssid_5g", "enc_5g",
	"key_5g", "up_band", "up_ssid", "up_enc", "up_key", "up_bssid", "wds", "wan_proto", "pppoe_user", "pppoe_pass",
	"dhcp_start", "dhcp_limit" }

function action_apply()
	local mode = http.formvalue("mode")
	local check = http.formvalue("check") == "1"
	if mode ~= "ap" and mode ~= "repeater" and mode ~= "wisp" and mode ~= "router" and mode ~= "rollback" then
		return json({ ok = false, message = "ERROR: invalid mode" })
	end
	local args = { util.shellquote(mode) }
	if check then args[#args + 1] = "--check" end
	if mode ~= "rollback" then
		for _, k in ipairs(ALLOWED) do
			local v = http.formvalue(k)
			-- keep empty strings for gateway/dns/key so "clear" works; skip absent fields
			if v ~= nil then
				if v:find("[%c]") then return json({ ok = false, message = "ERROR: control characters in " .. k }) end
				args[#args + 1] = util.shellquote(k .. "=" .. v)
			end
		end
	end
	local out = util.exec("/usr/sbin/alameer-apply " .. table.concat(args, " ") .. " 2>&1")
	out = trim(out)
	json({ ok = out:match("^OK") ~= nil, message = out, checked = check })
end
