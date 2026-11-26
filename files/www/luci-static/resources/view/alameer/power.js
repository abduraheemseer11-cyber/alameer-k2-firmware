'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';

var callSys = rpc.declare({ object: 'alameer', method: 'sysinfo' });
var callCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ] });
var callSetCpu = rpc.declare({ object: 'alameer', method: 'set_cpu', params: [ 'governor', 'max_freq', 'min_freq' ] });

function fmtUp(s) { var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + 'ي ' : '') + h + 'س ' + m + 'د'; }
function stat(label, val) { return E('div', { 'class': 'am-stat' }, [ E('b', val), E('span', label) ]); }
function mhz(k) { return k ? Math.round(parseInt(k, 10) / 1000) + ' MHz' : '-'; }

return view.extend({
	load: function() { return Promise.all([ uci.load('alameer'), callSys() ]); },

	render: function(d) {
		var self = this;
		this.grid = E('div', { 'class': 'am-grid' });
		this.ctl = E('div', { 'class': 'am-card' });
		this.fill(d[1]);
		poll.add(function() { return callSys().then(function(s) { self.fill(s, true); }); }, 3);
		return E('div', { 'class': 'am-page' }, [ E('h2', 'الأداء والطاقة (Performance & Power)'),
			E('div', { 'class': 'am-card' }, [ E('h3', 'الحالة الحية'), this.grid ]), this.ctl ]);
	},

	fill: function(s, live) {
		var g = this.grid; g.textContent = '';
		var cf = s.cpufreq || {};
		var freq = cf.supported ? mhz(cf.cur_khz) : (s.fixed_mhz ? s.fixed_mhz + ' MHz (ثابت)' : 'غير معروف');
		var used = s.mem_total_kb ? Math.round(100 * (s.mem_total_kb - s.mem_avail_kb) / s.mem_total_kb) : 0;
		[ [ 'الطراز', s.model || '-' ], [ 'المعالج', s.soc || '-' ], [ 'التردد الحالي', freq ], [ 'الحمل (1/5/15)', s.load ],
		  [ 'الحرارة', s.temp_mc != null ? (s.temp_mc / 1000).toFixed(1) + ' °C' : 'لا يوجد حساس' ],
		  [ 'الذاكرة المستخدمة', used + '% (' + Math.round((s.mem_total_kb - s.mem_avail_kb) / 1024) + '/' + Math.round(s.mem_total_kb / 1024) + ' MB)' ],
		  [ 'مدة التشغيل', fmtUp(s.uptime) ] ].forEach(function(x) { g.appendChild(stat(x[0], x[1])); });
		if (live && this.ctlBuilt) return;
		this.ctlBuilt = true; this.buildCtl(s);
	},

	buildCtl: function(s) {
		var self = this, cf = s.cpufreq || {}, c = this.ctl; c.textContent = '';
		c.appendChild(E('h3', 'التحكم في تردد المعالج (cpufreq)'));
		if (!cf.supported) {
			c.appendChild(E('div', { 'class': 'am-msg am-warn' }, 'هذا الجهاز لا يدعم تغيير تردد المعالج. معالج MT7628 يعمل بتردد ثابت (580 MHz) ولا يوفّر نواة OpenWrt لهذا الشريحة واجهة cpufreq، لذلك لا توجد ملفات في /sys/devices/system/cpu/cpu0/cpufreq. تم تعطيل عناصر التحكم بدل إظهار خيارات لا تعمل. المراقبة أعلاه تعمل بشكل كامل.'));
			return;
		}
		var govs = (cf.governors || '').split(/\s+/).filter(Boolean), freqs = (cf.frequencies || '').split(/\s+/).filter(Boolean);
		var mode = E('select', {}, [ E('option', { value: 'static' }, 'ثابت (حاكم واحد)'), E('option', { value: 'auto' }, 'تلقائي حسب الحمل') ]);
		mode.value = uci.get('alameer', 'cpu', 'mode') || 'static';
		var gov = E('select', {}, govs.map(function(g) { return E('option', { value: g }, g); })); gov.value = cf.governor;
		var fopts = function(cur) { return freqs.map(function(f) { return E('option', { value: f }, mhz(f)); }); };
		var max = E('select', {}, fopts()); max.value = cf.max_khz; var min = E('select', {}, fopts()); min.value = cf.min_khz;
		var hi = E('input', { type: 'number', min: 10, max: 400, value: uci.get('alameer', 'cpu', 'load_high') || 70 });
		var lo = E('input', { type: 'number', min: 1, max: 200, value: uci.get('alameer', 'cpu', 'load_low') || 25 });
		[ [ 'نمط التحكم', mode ], [ 'الحاكم (Governor)', gov ], [ 'أقصى تردد', max ], [ 'أدنى تردد', min ], [ 'حد رفع الأداء (حمل %)', hi ], [ 'حد خفض الطاقة (حمل %)', lo ] ]
			.forEach(function(x) { c.appendChild(E('div', { 'class': 'am-row' }, [ E('label', x[0]), x[1] ])); });
		c.appendChild(E('button', { 'class': 'btn cbi-button-save', 'click': function() {
			uci.set('alameer', 'cpu', 'mode', mode.value); uci.set('alameer', 'cpu', 'governor', gov.value);
			uci.set('alameer', 'cpu', 'max_freq', max.value); uci.set('alameer', 'cpu', 'min_freq', min.value);
			uci.set('alameer', 'cpu', 'load_high', hi.value); uci.set('alameer', 'cpu', 'load_low', lo.value);
			return uci.save().then(function() { return callCommit('alameer'); }).then(function() {
				return callSetCpu(gov.value, max.value, min.value); }).then(function(r) {
				ui.addNotification(null, E('p', r && r.ok ? 'تم الحفظ والتطبيق.' : 'خطأ: ' + (r && r.error)), r && r.ok ? 'info' : 'danger'); });
		} }, 'حفظ وتطبيق'));
		c.appendChild(E('p', { 'class': 'help-block' }, 'هذه الإعدادات لا تغيّر درايفرات الواي فاي ولا تؤثر على بث الإشارة.'));
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
