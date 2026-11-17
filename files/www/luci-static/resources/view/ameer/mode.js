'use strict';
'require view';
'require form';
'require fs';
'require ui';

var APMODES = [ 'ap', 'apwds', 'repeater' ];
var UPMODES = [ 'client', 'repeater' ];

function dep(o, modes, extra) {
	modes.forEach(function(m) {
		var d = { mode: m };
		if (extra) Object.keys(extra).forEach(function(k) { d[k] = extra[k]; });
		o.depends(d);
	});
}

return view.extend({
	handleSaveApply: function(ev) {
		return this.handleSave(ev).then(function() {
			ui.showModal('AL-AMEER', [ E('p', { 'class': 'spinning' }, 'Applying settings... the connection may drop for a few seconds. If you changed the IP, open the new address.') ]);
			window.setTimeout(function() { ui.hideModal(); }, 12000);
			return fs.exec('/usr/bin/ameer-mode').then(function(res) {
				ui.addNotification(null, E('pre', {}, (res.stdout || '') + (res.stderr || '') + ' (code ' + res.code + ')'));
			});
		});
	},

	addFooter: function() {
		return E('div', { 'class': 'cbi-page-actions' }, [
			E('button', { 'class': 'cbi-button cbi-button-apply important', 'click': ui.createHandlerFn(this, 'handleSaveApply') }, _('Save & Apply')),
			' ',
			E('button', { 'class': 'cbi-button cbi-button-save', 'click': ui.createHandlerFn(this, 'handleSave') }, _('Save')),
			' ',
			E('button', { 'class': 'cbi-button cbi-button-reset', 'click': ui.createHandlerFn(this, 'handleReset') }, _('Reset'))
		]);
	},

	render: function() {
		var m, s, o, i;

		m = new form.Map('ameer', 'البرمجة السريعة (Quick Setup)', 'Choose the operation mode, fill the fields and press Save & Apply.');
		s = m.section(form.NamedSection, 'main', 'ameer');
		s.addremove = false;
		s.tab('quick', 'البرمجة السريعة');
		s.tab('wifi', 'Wireless');
		s.tab('more', 'More Settings');

		/* ---------- Quick Setup ---------- */
		o = s.taboption('quick', form.ListValue, 'mode', 'Operation Mode');
		o.value('ap', 'Access Point / Bridge (DHCP off)');
		o.value('apwds', 'Access Point (WDS)');
		o.value('client', 'Client (WDS)');
		o.value('repeater', 'Repeater (WDS)');
		o.default = 'ap';

		o = s.taboption('quick', form.Value, 'ip', 'IPv4 address');
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.20';

		o = s.taboption('quick', form.Value, 'netmask', 'IPv4 netmask');
		o.datatype = 'ip4addr';
		[ '255.255.255.0', '255.255.255.128', '255.255.254.0', '255.255.252.0', '255.255.0.0', '255.0.0.0' ].forEach(function(v) { o.value(v); });
		o.default = '255.255.255.0';

		o = s.taboption('quick', form.Value, 'gateway', 'Gateway');
		o.datatype = 'ip4addr';
		o.optional = true;

		o = s.taboption('quick', form.Value, 'dns1', 'DNS 1');
		o.datatype = 'ip4addr';
		o.optional = true;
		o.placeholder = '8.8.8.8';

		o = s.taboption('quick', form.Value, 'dns2', 'DNS 2');
		o.datatype = 'ip4addr';
		o.optional = true;
		o.placeholder = '1.1.1.1';

		/* ---------- Wireless ---------- */
		o = s.taboption('wifi', form.ListValue, 'client_band', 'Connect to upstream on');
		o.value('5g', '5GHz');
		o.value('2g', '2.4GHz');
		o.default = '5g';
		dep(o, UPMODES);

		o = s.taboption('wifi', form.Value, 'up_ssid', 'Upstream network name (SSID)');
		dep(o, UPMODES);

		o = s.taboption('wifi', form.Value, 'up_pass', 'Upstream password (empty = open)');
		o.password = true;
		o.optional = true;
		dep(o, UPMODES);

		o = s.taboption('wifi', form.Value, 'ssid_2g', 'اسم الشبكة 2.4GHz (SSID)');
		o.placeholder = 'AL-AMEER-NET@_2G';
		dep(o, APMODES);

		o = s.taboption('wifi', form.Value, 'ssid_5g', 'اسم الشبكة 5GHz (SSID)');
		o.placeholder = 'AL-AMEER-NET@_5G';
		dep(o, APMODES);

		o = s.taboption('wifi', form.Flag, 'pass_enabled', 'تخصيص كلمة مرور Wifi');
		o.default = '0';
		dep(o, APMODES);

		o = s.taboption('wifi', form.Value, 'pass_2g', 'Password 2.4GHz (min 8)');
		o.password = true;
		o.datatype = 'minlength(8)';
		o.optional = true;
		dep(o, APMODES, { pass_enabled: '1' });

		o = s.taboption('wifi', form.Value, 'pass_5g', 'Password 5GHz (min 8)');
		o.password = true;
		o.datatype = 'minlength(8)';
		o.optional = true;
		dep(o, APMODES, { pass_enabled: '1' });

		o = s.taboption('wifi', form.ListValue, 'channel_2g', 'Channel 2.4GHz');
		o.value('auto', 'Auto (least interference)');
		for (i = 1; i <= 13; i++) o.value(String(i), String(i));
		o.default = '6';
		dep(o, APMODES);

		o = s.taboption('wifi', form.ListValue, 'width_2g', 'Channel width 2.4GHz');
		o.value('HT20', '20 MHz');
		o.value('HT40', '40 MHz');
		o.default = 'HT20';
		dep(o, APMODES);

		o = s.taboption('wifi', form.ListValue, 'channel_5g', 'Channel 5GHz');
		o.value('auto', 'Auto (may delay boot: DFS)');
		[ 36, 40, 44, 48, 149, 153, 157, 161, 165 ].forEach(function(c) { o.value(String(c), String(c)); });
		o.default = '36';
		dep(o, APMODES);

		o = s.taboption('wifi', form.ListValue, 'width_5g', 'Channel width 5GHz');
		o.value('HT20', '20 MHz');
		o.value('HT40', '40 MHz');
		o.value('VHT80', '80 MHz');
		o.default = 'VHT80';
		dep(o, APMODES);

		/* ---------- More Settings ---------- */
		o = s.taboption('more', form.Flag, 'isolate', 'Client Isolation (عزل العملاء)');
		o.description = 'Public network mode: Wi-Fi clients cannot talk to each other.';
		o.default = '0';
		dep(o, APMODES);

		o = s.taboption('more', form.Flag, 'vlan_enabled', 'إضافة فيلان (VLAN) - experimental');
		o.default = '0';

		o = s.taboption('more', form.Value, 'vlan_id', 'VLAN ID');
		o.datatype = 'range(1,4094)';
		o.depends('vlan_enabled', '1');

		o = s.taboption('more', form.Flag, 'antitheft', 'حماية من السرقة');
		o.description = 'تفعيل / تعطيل الزر الخاص بالفورمات: عند التفعيل يُعطَّل زر Reset بالكامل.';
		o.default = '0';

		o = s.taboption('more', form.Flag, 'format_btn', 'خصائص زر الفورمات');
		o.description = 'Allow factory reset by holding the Reset button for more than 5 seconds.';
		o.default = '1';
		o.depends('antitheft', '0');

		return m.render().then(function(node) {
			return E('div', {}, [
				E('div', { 'style': 'text-align:center;margin:8px 0' }, [ E('img', { 'src': '/luci-static/ameer/logo.png', 'style': 'max-height:110px;max-width:60%' }) ]),
				node
			]);
		});
	}
});
