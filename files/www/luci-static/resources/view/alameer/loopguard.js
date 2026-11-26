'use strict';
'require view';
'require rpc';
'require poll';
'require uci';
'require ui';

var callStatus = rpc.declare({ object: 'alameer', method: 'loopstatus' });
var callPorts = rpc.declare({ object: 'alameer', method: 'ports' });

function brDev() { var f = null; uci.sections('network', 'device').forEach(function(s) { if (s.name === 'br-lan') f = s['.name']; }); return f; }

return view.extend({
	load: function() { return Promise.all([ uci.load([ 'alameer', 'network' ]), callPorts().catch(function() { return { ports: [] }; }), callStatus().catch(function() { return {}; }) ]); },

	render: function(d) {
		var self = this, ports = (d[1] && d[1].ports) || [], c = function(o, def) { return uci.get('alameer', 'loopguard', o) || def; };
		var up = (c('uplink', '') + '').split(/\s+/);
		var dev = brDev();
		var en = E('input', { type: 'checkbox' }); en.checked = c('enabled', '1') === '1';
		var stp = E('input', { type: 'checkbox' }); stp.checked = dev && uci.get('network', dev, 'stp') === '1';
		var act = E('select', {}, [ E('option', { value: 'down' }, 'عزل المنفذ مؤقتاً'), E('option', { value: 'warn' }, 'تحذير وتسجيل فقط') ]); act.value = c('action', 'down');
		var num = function(o, def, min, max) { return E('input', { type: 'number', min: min, max: max, value: c(o, def) }); };
		var storm = num('storm_pps', 30000, 1000, 200000), mc = num('mc_pps', 1500, 50, 100000), win = num('window', 3, 1, 60), lock = num('lockout', 60, 5, 3600);
		var interval = num('interval', 1, 1, 10), logthr = num('log_threshold', 5, 1, 100);
		var igmp = E('input', { type: 'checkbox' }); igmp.checked = dev && uci.get('network', dev, 'igmp_snooping') === '1';
		var upBoxes = ports.map(function(p) { var cb = E('input', { type: 'checkbox', value: p }); cb.checked = up.indexOf(p) >= 0; return cb; });
		var adv = E('div', { 'class': 'am-hide' }, [
			E('div', { 'class': 'am-row' }, [ E('label', 'فترة القياس (ثانية)'), interval ]),
			E('div', { 'class': 'am-row' }, [ E('label', 'عتبة رسائل own-MAC'), logthr ]),
			E('div', { 'class': 'am-row' }, [ E('label', 'IGMP snooping'), igmp ]) ]);
		var pro = E('input', { type: 'checkbox', 'change': function() { adv.classList.toggle('am-hide', !pro.checked); } });

		this.live = E('div'); this.events = E('div');
		poll.add(function() { return callStatus().then(function(s) { self.show(s); }); }, 3); this.show(d[2]);

		var save = E('button', { 'class': 'btn cbi-button-save', 'click': function() {
			if (!dev) { ui.addNotification(null, E('p', 'لم يُعثر على جسر br-lan في /etc/config/network.'), 'danger'); return; }
			uci.set('alameer', 'loopguard', 'enabled', en.checked ? '1' : '0'); uci.set('alameer', 'loopguard', 'action', act.value);
			[ [ 'storm_pps', storm ], [ 'mc_pps', mc ], [ 'window', win ], [ 'lockout', lock ], [ 'interval', interval ], [ 'log_threshold', logthr ] ].forEach(function(x) {
				var v = parseInt(x[1].value, 10); if (!isNaN(v)) uci.set('alameer', 'loopguard', x[0], '' + v); });
			uci.set('alameer', 'loopguard', 'uplink', upBoxes.filter(function(b) { return b.checked; }).map(function(b) { return b.value; }).join(' '));
			uci.set('network', dev, 'stp', stp.checked ? '1' : '0');
			uci.set('network', dev, 'igmp_snooping', igmp.checked ? '1' : '0');
			return uci.save().then(function() { return ui.changes.apply(); });
		} }, 'حفظ وتطبيق');

		return E('div', { 'class': 'am-page' }, [ E('h2', 'مكافحة اللوبات (Loop Prevention)'),
			E('div', { 'class': 'am-msg' }, 'طبقتان للحماية: (1) STP في جسر النواة لتعطيل الحلقات تلقائياً، (2) حارس عواصف البث في فضاء المستخدم يراقب عدّادات المنافذ ويعزل المنفذ المسبّب. لتحديد وضع الجهاز (AP / Extender / Mesh) استخدم صفحة Quick Setup.'),
			E('div', { 'class': 'am-msg am-warn' }, 'حدود التقنية: هذه حماية برمجية (ليست داخل شريحة السويتش). قد تمر بضع ثوانٍ قبل رصد العاصفة. لا تُحدَّد المنافذ الحرجة (Uplink) للعزل؛ تُسجَّل كتحذير فقط. في Mesh فعّل bridge_loop_avoidance الخاص بـ batman-adv.'),
			E('div', { 'class': 'am-card' }, [ E('h3', 'الحالة الحية'), this.live, this.events ]),
			E('div', { 'class': 'am-card' }, [ E('h3', 'الإعدادات'),
				E('div', { 'class': 'am-row' }, [ E('label', 'تفعيل حارس العواصف'), en ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'تفعيل STP على br-lan'), stp ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'الإجراء عند الاكتشاف'), act ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'عتبة الحزم الكلية (pps)'), storm ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'عتبة Multicast/Broadcast (pps)'), mc ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'ثوانٍ متتالية قبل الإجراء'), win ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'مدة العزل (ثانية)'), lock ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'منافذ Uplink (لا تُعزل)'), E('span', {}, ports.length ? upBoxes.map(function(b) { return E('label', { style: 'min-width:0;margin-inline-end:12px' }, [ b, ' ' + b.value ]); }) : 'لا توجد منافذ (الجسر غير جاهز)') ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'الوضع الاحترافي'), pro ]), adv, E('div', { 'class': 'am-row' }, save) ])
		]);
	},

	show: function(s) {
		this.live.textContent = ''; this.events.textContent = '';
		if (!s || !s.running) { this.live.appendChild(E('em', 'الخدمة غير شغّالة أو معطّلة.')); return; }
		var cls = { ok: 'am-ok', storm: 'am-err', loop: 'am-err', isolating: 'am-warn', disabled: 'am-warn' }[s.state] || 'am-msg';
		this.live.appendChild(E('div', { 'class': 'am-msg ' + cls }, 'الحالة العامة: ' + s.state));
		this.live.appendChild(E('table', { 'class': 'am-tbl' }, [ E('tr', [ E('th', 'المنفذ'), E('th', 'RX pps'), E('th', 'Multicast pps'), E('th', 'الحالة') ]) ].concat((s.ports || []).map(function(p) {
			return E('tr', [ E('td', p.name), E('td', '' + p.rx_pps), E('td', '' + p.mc_pps), E('td', p.state) ]); }))));
		if ((s.events || []).length) this.events.appendChild(E('div', {}, [ E('h3', { style: 'margin-top:14px' }, 'آخر الأحداث'), E('table', { 'class': 'am-tbl' }, [ E('tr', [ E('th', 'منذ الإقلاع (ث)'), E('th', 'المنفذ'), E('th', 'السبب'), E('th', 'الإجراء') ]) ].concat(s.events.slice().reverse().map(function(e) {
			return E('tr', [ E('td', '' + e.time), E('td', e.port), E('td', e.reason), E('td', e.action) ]); }))) ]));
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
