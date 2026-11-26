'use strict';
'require view';
'require rpc';
'require uci';
'require ui';

var callWifiStatus = rpc.declare({ object: 'network.wireless', method: 'status', expect: { '': {} } });
var callFreqs = rpc.declare({ object: 'iwinfo', method: 'freqlist', params: [ 'device' ], expect: { results: [] } });

var PROFILES = {
	'':   'بدون تغيير (الافتراضي)',
	'JP': 'JP — 1-14 / 36-140',
	'US': 'US — 1-11 / 36-165',
	'DE': 'DE — 1-13 / 36-140',
	'ZZ': 'ZZ — قاعدة بيانات مخصصة'
};
var SUPER = { '2g': 'JP', '5g': 'US' };

return view.extend({
	load: function() {
		return Promise.all([ uci.load([ 'wireless', 'alameer' ]), callWifiStatus().catch(function() { return {}; }) ]).then(function(r) {
			var st = r[1], jobs = [];
			uci.sections('wireless', 'wifi-device').forEach(function(s) {
				var ifs = (st[s['.name']] || {}).interfaces || [];
				var dev = ifs.length ? ifs[0].ifname : null;
				jobs.push(dev ? callFreqs(dev).catch(function() { return []; }) : Promise.resolve([]));
			});
			return Promise.all(jobs).then(function(f) { return { freqs: f }; });
		});
	},

	render: function(d) {
		var self = this, root = E('div', { 'class': 'am-page' }), radios = uci.sections('wireless', 'wifi-device');
		this.rows = [];
		root.appendChild(E('h2', 'Super Channel — توسيع القنوات المتاحة'));
		root.appendChild(E('div', { 'class': 'am-msg am-warn' }, 'تحذير: تغيير بلد التنظيم (Country) قد يفتح قنوات أو قدرة إرسال غير قانونية في بلدك. أنت المسؤول عن الالتزام بقوانين الاتصالات المحلية. العتاد نفسه (المعايرة/EEPROM والدرايفر) قد يمنع بعض القنوات مهما غيّرت الإعدادات، وبعض الأجهزة لن ترى القنوات الإضافية (مثل 12–14).'));
		radios.forEach(function(r, i) {
			var name = r['.name'], band = r.band || (parseInt(r.channel, 10) > 14 ? '5g' : '2g'), freqs = (d.freqs[i] || []);
			var prof = E('select', { 'style': 'width: 100%; max-width: 100%;' }, Object.keys(PROFILES).map(function(k) {
				var opt = E('option', { value: k }, PROFILES[k]);
				opt.title = PROFILES[k];
				return opt;
			}));
			prof.value = uci.get('wireless', name, 'country') || '';
			if (!(prof.value in PROFILES)) {
				var opt = E('option', { value: prof.value }, prof.value);
				opt.title = prof.value;
				prof.appendChild(opt);
			}
			prof.value = uci.get('wireless', name, 'country') || '';
			var ch = E('select', { 'style': 'width: 100%; max-width: 100%;' }, [ E('option', { value: 'auto' }, 'auto') ].concat(freqs.filter(function(f) { return !f.restricted; }).map(function(f) { return E('option', { value: '' + f.channel }, f.channel + ' (' + f.mhz + ' MHz)'); })));
			ch.value = uci.get('wireless', name, 'channel') || 'auto';
			var tx = E('input', { type: 'number', min: 1, max: 30, value: uci.get('wireless', name, 'txpower') || '', 'style': 'width: 100%; max-width: 100%;' });
			var list = freqs.length ? E('div', { 'class': 'am-tablewrap' }, E('table', { 'class': 'am-tbl' }, [ E('tr', [ E('th', 'القناة'), E('th', 'التردد'), E('th', 'الحالة') ]) ].concat(freqs.map(function(f) {
				return E('tr', [ E('td', '' + f.channel), E('td', f.mhz + ' MHz'), E('td', f.restricted ? 'محظورة حالياً' : 'متاحة') ]); })))) : E('em', 'قائمة القنوات غير متاحة (الراديو غير فعّال).');
			root.appendChild(E('div', { 'class': 'am-card' }, [ E('h3', name + ' — ' + (band === '5g' ? '5 GHz' : '2.4 GHz')),
				E('div', { 'class': 'am-row' }, [ E('label', 'ملف البلد (Country)'), prof,
					E('button', { 'class': 'btn cbi-button', 'click': function() { prof.value = SUPER[band] || ''; } }, 'تعبئة إعداد Super Channel') ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'القناة'), ch ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'قدرة الإرسال المطلوبة (dBm)'), tx ]),
				E('details', {}, [ E('summary', 'عرض القنوات الحالية للراديو'), list ]) ]));
			self.rows.push({ name: name, prof: prof, ch: ch, tx: tx });
		});
		var ack = E('input', { type: 'checkbox' });
		var btn = E('button', { 'class': 'btn cbi-button-save', 'click': function() {
			if (!ack.checked) { ui.addNotification(null, E('p', 'يجب الموافقة على إقرار المسؤولية أولاً.'), 'danger'); return; }
			self.rows.forEach(function(x) {
				var cur = uci.get('wireless', x.name, 'country') || '';
				if (x.prof.value !== cur) {
					if (cur && !uci.get('alameer', 'super', 'prev_' + x.name)) uci.set('alameer', 'super', 'prev_' + x.name, cur);
					if (x.prof.value) uci.set('wireless', x.name, 'country', x.prof.value); else uci.unset('wireless', x.name, 'country');
				}
				uci.set('wireless', x.name, 'channel', x.ch.value);
				if (x.tx.value) uci.set('wireless', x.name, 'txpower', x.tx.value); else uci.unset('wireless', x.name, 'txpower');
			});
			uci.set('alameer', 'super', 'enabled', self.rows.some(function(x) { return !!x.prof.value; }) ? '1' : '0');
			return uci.save().then(function() { return ui.changes.apply(); });
		} }, 'حفظ وتطبيق (مع تراجع تلقائي)');
		root.appendChild(E('div', { 'class': 'am-card' }, [ E('label', {}, [ ack, ' أُقرّ بأنني مسؤول عن الالتزام بالقوانين المحلية وعن أي تداخل أو ضرر ناتج.' ]), E('div', { 'class': 'am-row' }, btn) ]));
		return root;
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
