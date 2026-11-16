'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	handleSave: null, handleSaveApply: null, handleReset: null,

	load: function() {
		return L.resolveDefault(fs.read('/etc/ameer/mode'), 'router');
	},

	apply: function(args) {
		ui.showModal('AL-AMEER', [ E('p', { 'class': 'spinning' }, 'جارٍ تطبيق الإعدادات وإعادة تشغيل الجهاز... انتظر دقيقة ثم أعد الاتصال') ]);
		return fs.exec('/usr/bin/ameer-mode', args);
	},

	card: function(title, desc, extra, onclick) {
		return E('div', { 'class': 'cbi-section', 'style': 'border:1px solid #8884;border-radius:8px;padding:12px;margin:10px 0' }, [
			E('h3', {}, title), E('p', {}, desc), extra || E('span'),
			E('button', { 'class': 'btn cbi-button cbi-button-apply', 'click': ui.createHandlerFn(this, onclick) }, 'تفعيل')
		]);
	},

	render: function(mode) {
		var self = this;
		var pUser = E('input', { 'class': 'cbi-input-text', 'placeholder': 'PPPoE user' });
		var pPass = E('input', { 'class': 'cbi-input-password', 'type': 'password', 'placeholder': 'PPPoE password' });
		var rSsid = E('input', { 'class': 'cbi-input-text', 'placeholder': 'اسم الشبكة المراد تكرارها (SSID)' });
		var rKey  = E('input', { 'class': 'cbi-input-password', 'type': 'password', 'placeholder': 'كلمة المرور' });
		var rBand = E('select', { 'class': 'cbi-input-select' }, [ E('option', { 'value': '2g' }, '2.4GHz'), E('option', { 'value': '5g' }, '5GHz') ]);

		return E('div', { 'style': 'direction:rtl;text-align:right' }, [
			E('div', { 'style': 'text-align:center' }, [ E('img', { 'src': '/luci-static/ameer/logo.png', 'style': 'max-height:110px' }) ]),
			E('h2', {}, 'الإعداد السريع - الوضع الحالي: ' + String(mode).trim()),

			this.card('Router (راوتر)', 'PPPoE أو DHCP مع الجدار الناري. اترك الحقول فارغة لاستخدام DHCP.',
				E('p', {}, [ pUser, ' ', pPass ]),
				function() { return self.apply(pUser.value ? ['router', 'pppoe', pUser.value, pPass.value] : ['router']); }),

			this.card('Access Point (أكسس بوينت)', 'دمج كل المنافذ في جسر واحد وتعطيل DHCP والجدار الناري.',
				null, function() { return self.apply(['ap']); }),

			this.card('Repeater / WDS (مكرر)', 'استقبال شبكة لاسلكياً وإعادة بثها مع تمرير الماك (WDS). يجب أن يدعم الجهاز الأصلي WDS.',
				E('p', {}, [ rSsid, ' ', rKey, ' ', rBand ]),
				function() {
					if (!rSsid.value) { ui.addNotification(null, E('p', 'أدخل اسم الشبكة')); return; }
					return self.apply(['repeater', rSsid.value, rKey.value, rBand.value]);
				})
		]);
	}
});
