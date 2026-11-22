module("luci.controller.alameer", package.seeall)

function index()
    -- إضافة رابط لوحة التحكم في القائمة الرئيسية
    entry({"admin", "status", "alameer"}, template("alameer/dashboard"), _("لوحة التحكم السريعة"), 10).dependent = false
end
