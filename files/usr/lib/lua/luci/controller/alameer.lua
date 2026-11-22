module("luci.controller.alameer", package.seeall)

function index()
	entry({"admin", "about"}, template("alameer/about"), _("About the Developer"), 99).dependent = false
	entry({"admin", "alameer_lang"}, call("action_lang")).leaf = true
end

function action_lang()
	local http = require "luci.http"
	local uci  = require "luci.model.uci".cursor()
	local lang = http.formvalue("l")
	if lang == "ar" or lang == "en" then
		uci:set("luci", "main", "lang", lang)
		uci:commit("luci")
	end
	http.redirect(http.getenv("HTTP_REFERER") or luci.dispatcher.build_url("admin"))
end
