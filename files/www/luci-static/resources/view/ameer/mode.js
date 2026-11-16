'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	handleSaveApply: function(ev) {
		return this.handleSave(ev).then(function() {
			ui.showModal('AL-AMEER', [ E('p', { 'class': 'spinning' }, 'جارٍ تطبيق الإعدادات... قد ينقطع الاتصال لثوانٍ، وإذا غيّرت الآي بي ادخل على العنوان الجديد') ]);
			window.setTimeout(function() { ui.hideModal(); }, 12000);
			return fs.exec('/usr/bin/ameer-mode');
		});
	},

	render: function() {
		var m, s, o;

		m = new form.Map('ameer', 'البرمجة السريعة', 'إختر وضع البرمجة المناسب واضغط على حفظ');
		s = m.section(form.NamedSection, 'main', 'ameer');
		s.addremove = false;
		s.tab('quick', 'البرمجة السريعة');
		s.tab('more', 'More Settings');

		o = s.taboption('quick', form.ListValue, 'type', 'Type');
		o.value('ap', 'Access Point برمجة أكسس');
		o.value('mesh', 'Access Point and Mesh');
		o.value('apwds', 'Access Point (wds)');
		o.value('clientwds', 'Client (wds)');
		o.default = 'ap';

		o = s.taboption('quick', form.ListValue, 'band', 'تردد الاتصال بالشبكة (Client)');
		o.value('5g', '5GHz');
		o.value('2g', '2.4GHz');
		o.default = '5g';
		o.depends('type', 'clientwds');

		o = s.taboption('quick', form.Value, 'ip', 'IPv4 address');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.20';

		o = s.taboption('quick', form.Value, 'netmask', 'IPv4 netmask');
		o.datatype = 'ip4addr';
		['255.255.255.0', '255.255.255.128', '255.255.254.0', '255.255.252.0', '255.255.0.0', '255.0.0.0'].forEach(function(v) { o.value(v); });
		o.default = '255.255.255.0';

		o = s.taboption('quick', form.Value, 'ssid', 'إسم الشبكة');
		o.optional = true;
		o.placeholder = 'AL-AMEER-NET@  (يُضاف _2G و _5G تلقائياً)';
		o.description = 'وضع Client: اسم الشبكة التي سيتصل بها الجهاز بالضبط.';

		o = s.taboption('quick', form.Flag, 'vlan_enabled', 'إضافة فيلان');
		o.default = '0';

		o = s.taboption('quick', form.Value, 'vlan_id', 'VLAN ID');
		o.datatype = 'range(1,4094)';
		o.depends('vlan_enabled', '1');

		o = s.taboption('quick', form.Flag, 'pass_enabled', 'تخصيص كلمة مرور Wifi');
		o.default = '0';

		o = s.taboption('quick', form.Value, 'password', 'كلمة المرور');
		o.password = true;
		o.datatype = 'minlength(8)';
		o.depends('pass_enabled', '1');

		o = s.taboption('more', form.Flag, 'antitheft', 'حماية من السرقة');
		o.description = 'تفعيل / تعطيل الزر الخاص بالفورمات: عند التفعيل يُعطَّل زر Reset بالكامل.';
		o.default = '0';

		o = s.taboption('more', form.Flag, 'format_btn', 'خصائص زر الفورمات');
		o.description = 'السماح بالفورمات (Factory Reset) عند الضغط المطوّل على الزر (أكثر من 5 ثوانٍ).';
		o.default = '1';
		o.depends('antitheft', '0');

		return m.render();
	}
});
