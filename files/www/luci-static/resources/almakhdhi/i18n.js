'use strict';
'require baseclass';

/*
 * Tiny dictionary for the strings added by the AlMakhdhi SoftWare theme
 * (Dashboard, Quick Setup, header). Stock LuCI pages keep using the
 * official translation packages (luci-i18n-base-ar ...).
 */

var AR = {
	'Dashboard': 'لوحة المعلومات',
	'Quick Setup': 'الإعداد السريع',
	'Switch language': 'تغيير اللغة',
	'Toggle dark mode': 'تبديل الوضع الداكن',
	'Toggle menu': 'إظهار / إخفاء القائمة',
	'Could not change the language: %s': 'تعذر تغيير اللغة: %s',

	'Live data from this router, refreshed every 3 seconds.': 'بيانات حقيقية من الراوتر، تُحدَّث كل 3 ثوانٍ.',
	'Hostname': 'اسم الجهاز',
	'Model': 'الموديل',
	'Firmware': 'إصدار النظام',
	'Uptime': 'مدة التشغيل',
	'LAN address': 'عنوان IP',
	'Internet': 'الإنترنت',
	'Wi-Fi': 'الواي فاي',
	'Processor': 'المعالج',
	'Load average': 'حمل النظام',
	'Temperature': 'درجة الحرارة',
	'Memory (RAM)': 'الذاكرة (RAM)',
	'Storage (flash)': 'التخزين (Flash)',
	'Memory usage': 'استهلاك الذاكرة',
	'System load': 'حمل المعالج',
	'used': 'مستخدم',
	'free': 'متاح',
	'of': 'من',
	'Connected': 'متصل',
	'Not reachable': 'غير متاح',
	'No default route': 'لا يوجد مسار افتراضي (Gateway)',
	'Unknown': 'غير معروف',
	'Not available': 'غير متوفر',
	'No sensor': 'لا يوجد حساس',
	'Checking…': 'جارٍ الفحص…',
	'Active': 'يعمل',
	'Off': 'متوقف',
	'Wi-Fi radios': 'أجهزة الواي فاي',
	'Network interfaces': 'واجهات الشبكة',
	'Radio': 'الراديو',
	'Band': 'النطاق',
	'SSID': 'اسم الشبكة SSID',
	'Channel': 'القناة',
	'TX power': 'قدرة الإرسال',
	'Clients': 'العملاء',
	'Status': 'الحالة',
	'Interface': 'الواجهة',
	'Protocol': 'البروتوكول',
	'IPv4 address': 'عنوان IPv4',
	'Up': 'يعمل',
	'Down': 'متوقف',
	'Disabled': 'معطّل',
	'No wireless radios were found.': 'لم يتم العثور على أجهزة واي فاي.',
	'No interfaces were found.': 'لم يتم العثور على واجهات.',
	'd': 'ي',
	'h': 'س',
	'm': 'د',

	'Welcome': 'الترحيب',
	'LAN': 'الشبكة المحلية',
	'Wireless': 'الواي فاي',
	'Review & apply': 'المراجعة والتطبيق',
	'Welcome to the Quick Setup': 'مرحباً بك في الإعداد السريع',
	'This wizard changes the router address and the Wi-Fi settings in a few simple steps. Settings are validated and applied with the standard OpenWrt UCI system.': 'يقوم هذا المعالج بتغيير عنوان الراوتر وإعدادات الواي فاي في خطوات بسيطة. يتم التحقق من المدخلات ثم تطبيقها عبر نظام UCI الرسمي في OpenWrt.',
	'Start Setup': 'ابدأ الإعداد',
	'Next': 'التالي',
	'Back': 'السابق',
	'Apply Settings': 'تطبيق الإعدادات',
	'LAN configuration': 'إعدادات الشبكة المحلية',
	'Router IP address': 'عنوان IP للراوتر',
	'Subnet mask': 'قناع الشبكة (Subnet Mask)',
	'Gateway (optional)': 'البوابة Gateway (اختياري)',
	'Leave empty if the router does not need a gateway.': 'اتركه فارغاً إذا لم يكن الراوتر بحاجة إلى بوابة.',
	'Wireless configuration': 'إعدادات الواي فاي',
	'Wi-Fi name 2.4 GHz': 'اسم شبكة 2.4GHz',
	'Wi-Fi name 5 GHz': 'اسم شبكة 5GHz',
	'Wi-Fi security': 'حماية الواي فاي',
	'Open network (no password)': 'شبكة مفتوحة (بدون كلمة مرور)',
	'WPA2 password': 'كلمة مرور WPA2',
	'Wi-Fi password': 'كلمة مرور الواي فاي',
	'Leave empty to keep the current password.': 'اتركه فارغاً للإبقاء على كلمة المرور الحالية.',
	'Show password': 'إظهار كلمة المرور',
	'No 5 GHz radio was found on this device.': 'لا يوجد راديو 5GHz في هذا الجهاز.',
	'No access point is defined on a radio. Create one under Network > Wireless.': 'لا توجد شبكة (Access Point) على أحد أجهزة الراديو. أنشئها من Network > Wireless.',
	'Review your settings': 'راجع إعداداتك',
	'Setting': 'الإعداد',
	'Current': 'الحالية',
	'New': 'الجديدة',
	'Nothing will be changed - all values are already applied.': 'لن يتم تغيير أي شيء - كل القيم مطبقة بالفعل.',
	'Warning: the router address changes from %s to %s. The connection will drop for a moment. Afterwards open http://%s/ - DHCP is disabled, so your computer may need a fixed address in the same subnet.': 'تنبيه: سيتغير عنوان الراوتر من %s إلى %s وسينقطع الاتصال مؤقتاً. بعد ذلك افتح http://%s/ - خدمة DHCP معطّلة، لذلك قد تحتاج إلى عنوان IP ثابت في نفس الشبكة على جهازك.',
	'Wi-Fi clients will be disconnected briefly while the wireless network restarts.': 'سيتم فصل أجهزة الواي فاي لحظات أثناء إعادة تشغيل الشبكة اللاسلكية.',
	'The Wi-Fi network will be open: anyone in range can connect.': 'ستكون شبكة الواي فاي مفتوحة: يمكن لأي شخص ضمن النطاق الاتصال بها.',
	'Applying settings…': 'جارٍ تطبيق الإعدادات…',
	'Saving and applying the configuration. Please wait.': 'يتم حفظ الإعدادات وتطبيقها. يرجى الانتظار.',
	'Failed to apply settings: %s': 'فشل تطبيق الإعدادات: %s',
	'Settings applied': 'تم تطبيق الإعدادات',
	'The new settings are active.': 'الإعدادات الجديدة فعّالة الآن.',
	'Close': 'إغلاق',
	'Router address changed': 'تم تغيير عنوان الراوتر',
	'Reconnecting to the new address in %s seconds…': 'سيتم الانتقال إلى العنوان الجديد خلال %s ثوانٍ…',
	'Open the new address now': 'افتح العنوان الجديد الآن',
	'Please correct the highlighted fields.': 'يرجى تصحيح الحقول المظللة.',
	'Enter the Wi-Fi password.': 'أدخل كلمة مرور الواي فاي.',
	'LAN IP address': 'عنوان IP للشبكة المحلية',
	'Gateway': 'البوابة',
	'Wi-Fi security 2.4 GHz': 'حماية الواي فاي 2.4GHz',
	'Wi-Fi security 5 GHz': 'حماية الواي فاي 5GHz',
	'Wi-Fi password 2.4 GHz': 'كلمة مرور 2.4GHz',
	'Wi-Fi password 5 GHz': 'كلمة مرور 5GHz',

	'Enter a valid IPv4 address.': 'أدخل عنوان IPv4 صحيحاً.',
	'This address range cannot be used for the router.': 'لا يمكن استخدام هذا النطاق من العناوين للراوتر.',
	'Enter a valid subnet mask.': 'أدخل قناع شبكة صحيحاً.',
	'The subnet mask is not valid (example: 255.255.255.0).': 'قناع الشبكة غير صالح (مثال: 255.255.255.0).',
	'The subnet prefix must be between /8 and /30.': 'يجب أن يكون طول القناع بين /8 و /30.',
	'The address cannot be the network address of the subnet.': 'لا يمكن أن يكون العنوان هو عنوان الشبكة نفسها.',
	'The address cannot be the broadcast address of the subnet.': 'لا يمكن أن يكون العنوان هو عنوان البث (Broadcast).',
	'The gateway must be inside the same subnet as the router address.': 'يجب أن تكون البوابة داخل نفس شبكة عنوان الراوتر.',
	'The gateway cannot be the same as the router address.': 'لا يمكن أن تكون البوابة نفس عنوان الراوتر.',
	'The gateway cannot be the network or broadcast address.': 'لا يمكن أن تكون البوابة عنوان الشبكة أو عنوان البث.',
	'The network name (SSID) cannot be empty.': 'اسم الشبكة (SSID) لا يمكن أن يكون فارغاً.',
	'The network name contains invalid characters.': 'اسم الشبكة يحتوي على أحرف غير صالحة.',
	'The network name must not exceed 32 bytes.': 'يجب ألا يتجاوز اسم الشبكة 32 بايت.',
	'The password must be 8 to 63 printable ASCII characters.': 'يجب أن تتكون كلمة المرور من 8 إلى 63 حرفاً (ASCII).',

	'AlMakhdhi SoftWare': 'AlMakhdhi SoftWare'
};

return baseclass.extend({
	lang: function() {
		return String(document.documentElement.getAttribute('lang') || 'en').slice(0, 2).toLowerCase();
	},

	isRTL: function() {
		return [ 'ar', 'he', 'fa', 'ur' ].indexOf(this.lang()) > -1;
	},

	/* strings added by this theme */
	t: function(s) {
		if (this.lang() === 'ar' && AR.hasOwnProperty(s)) return AR[s];
		return s;
	},

	/* %s formatting after translation */
	f: function(s) {
		var args = Array.prototype.slice.call(arguments, 1), i = 0;
		return this.t(s).replace(/%s/g, function() { return args[i++]; });
	},

	/* menu titles: own dictionary first, then the official LuCI catalog */
	menu: function(s) {
		if (this.lang() === 'ar' && AR.hasOwnProperty(s)) return AR[s];
		return _(s);
	}
});
