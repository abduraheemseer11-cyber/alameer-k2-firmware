'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var callWifiStatus = rpc.declare({ object: 'network.wireless', method: 'status', expect: { '': {} } });
var callScan = rpc.declare({ object: 'iwinfo', method: 'scan', params: [ 'device' ], expect: { results: [] } });
var callSurvey = rpc.declare({ object: 'alameer', method: 'survey', params: [ 'device' ] });

var CH5 = [36,40,44,48,52,56,60,64,100,104,108,112,116,120,124,128,132,136,140,144,149,153,157,161,165];
var PREF24 = [1, 6, 11];
var PREF5 = [36,40,44,48,149,153,157,161,165];

function chFreq(ch) { return ch <= 14 ? (ch === 14 ? 2484 : 2407 + 5 * ch) : 5000 + 5 * ch; }
function colorOf(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }

return view.extend({
	load: function() { return callWifiStatus().catch(function() { return {}; }); },

	render: function(status) {
		var self = this, radios = [];
		Object.keys(status || {}).forEach(function(r) {
			var ifs = (status[r].interfaces || []);
			if (ifs.length && ifs[0].ifname) radios.push({ radio: r, ifname: ifs[0].ifname });
		});
		this.nets = []; this.survey = [];

		var sel = E('select', { 'change': function() { self.scan(); } },
			radios.map(function(r) { return E('option', { value: r.ifname }, r.radio + ' (' + r.ifname + ')'); }));
		var auto = E('input', { type: 'checkbox', id: 'am-auto' });
		this.statusBox = E('div', { 'class': 'am-msg' }, 'اضغط «مسح» لبدء تحليل الشبكات المحيطة.');
		this.canvas = E('canvas', { 'class': 'am-canvas' });
		this.recBox = E('div');
		this.netTbl = E('div', { 'class': 'am-tablewrap' });
		this.survTbl = E('div', { 'class': 'am-tablewrap' });
		this.sel = sel; this.auto = auto;

		var btn = E('button', { 'class': 'btn cbi-button', 'click': function() { self.scan(); } }, 'مسح الآن');

		poll.add(function() { if (auto.checked) return self.scan(true); }, 15);
		window.addEventListener('resize', function() { self.draw(); });

		if (!radios.length) {
			return E('div', { 'class': 'am-page' }, [ E('h2', 'محلل الواي فاي'),
				E('div', { 'class': 'am-msg am-err' }, 'لا توجد واجهات لاسلكية فعّالة. فعّل الراديو من صفحة Wireless أولاً.') ]);
		}

		return E('div', { 'class': 'am-page' }, [
			E('h2', 'محلل المجال اللاسلكي (WiFi Analyzer)'),
			E('div', { 'class': 'am-card' }, [
				E('div', { 'class': 'am-row' }, [ E('label', 'الراديو'), sel, btn,
					E('label', { 'for': 'am-auto' }, [ auto, ' تحديث تلقائي كل 15 ثانية' ]) ]),
				E('div', { 'class': 'am-msg am-warn' }, 'ملاحظة: المسح على واجهة AP يقطع الإرسال لثوانٍ معدودة. هذا تحليل عبر مسح الشبكات وإحصاءات المسح (survey) وليس محلل طيف SDR حقيقي.'),
				this.statusBox ]),
			E('div', { 'class': 'am-card' }, [ E('h3', 'الرسم البياني للقنوات'), this.canvas ]),
			E('div', { 'class': 'am-card' }, [ E('h3', 'ازدحام القنوات والتوصية'), this.recBox ]),
			E('div', { 'class': 'am-card' }, [ E('h3', 'الشبكات المكتشفة'), this.netTbl ]),
			E('div', { 'class': 'am-card' }, [ E('h3', 'إحصاءات القنوات (Noise / Busy)'), this.survTbl ])
		]);
	},

	scan: function(quiet) {
		var self = this, dev = this.sel.value;
		if (!quiet) this.statusBox.textContent = 'جارٍ المسح...';
		return Promise.all([ callScan(dev), callSurvey(dev).catch(function() { return { channels: [] }; }) ]).then(function(r) {
			self.nets = (r[0] || []).filter(function(n) { return typeof n.signal === 'number' && n.channel; });
			self.survey = (r[1] && r[1].channels) || [];
			self.statusBox.textContent = 'تم العثور على ' + self.nets.length + ' شبكة — ' + new Date().toLocaleTimeString();
			self.statusBox.className = 'am-msg am-ok';
			self.draw(); self.tables();
		}).catch(function(e) {
			self.statusBox.textContent = 'فشل المسح: ' + (e && e.message ? e.message : e);
			self.statusBox.className = 'am-msg am-err';
		});
	},

	band: function() {
		var n = this.nets.length ? this.nets[0].channel : (this.survey[0] ? (this.survey[0].freq < 3000 ? 1 : 36) : 1);
		return n <= 14 ? 2 : 5;
	},

	draw: function() {
		var c = this.canvas; if (!c || !c.parentNode) return;
		var dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
		c.width = W * dpr; c.height = H * dpr;
		var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
		var is24 = this.band() === 2, fmin = is24 ? 2395 : 5160, fmax = is24 ? 2495 : 5835;
		var L = 42, R = 10, T = 12, B = 30, sMin = -100, sMax = -20;
		var X = function(f) { return L + (f - fmin) / (fmax - fmin) * (W - L - R); };
		var Y = function(s) { return T + (sMax - Math.max(sMin, Math.min(sMax, s))) / (sMax - sMin) * (H - T - B); };
		g.font = '11px sans-serif'; g.fillStyle = '#cbd5e1'; g.strokeStyle = '#3e1d6b'; g.lineWidth = 1;
		for (var s = sMin; s <= sMax; s += 20) { g.beginPath(); g.moveTo(L, Y(s)); g.lineTo(W - R, Y(s)); g.stroke(); g.fillText(s + '', 6, Y(s) + 4); }
		var chans = is24 ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14] : CH5;
		chans.forEach(function(ch) { var x = X(chFreq(ch)); g.fillText(ch + '', x - 6, H - 12); g.beginPath(); g.moveTo(x, H - B); g.lineTo(x, H - B + 4); g.stroke(); });
		this.nets.forEach(function(n) {
			var f = chFreq(n.channel), hw = is24 ? 11 : 10, x0 = X(f - hw), x1 = X(f + hw), xc = X(f), yTop = Y(n.signal), yb = Y(sMin);
			var h = colorOf(n.ssid || n.bssid || '');
			g.beginPath(); g.moveTo(x0, yb); g.quadraticCurveTo(x0 + (xc - x0) * 0.25, yTop, xc, yTop); g.quadraticCurveTo(x1 - (x1 - xc) * 0.25, yTop, x1, yb); g.closePath();
			g.fillStyle = 'hsla(' + h + ',80%,60%,0.22)'; g.fill(); g.strokeStyle = 'hsl(' + h + ',80%,65%)'; g.lineWidth = 1.5; g.stroke();
			g.fillStyle = '#f8fafc'; g.fillText((n.ssid || '(hidden)').substring(0, 14), xc - 22, yTop - 4);
		});
	},

	congestion: function() {
		var is24 = this.band() === 2, chans = is24 ? [1,2,3,4,5,6,7,8,9,10,11,12,13] : CH5, nets = this.nets, surv = this.survey, span = is24 ? 22 : 20;
		return chans.map(function(ch) {
			var f = chFreq(ch), score = 0, cnt = 0, busy = null, noise = null;
			nets.forEach(function(n) {
				var d = Math.abs(chFreq(n.channel) - f);
				if (d < span) { var w = 1 - d / span; score += w * Math.pow(10, (n.signal + 100) / 20); cnt++; }
			});
			surv.forEach(function(s) { if (s.freq === f && s.active > 0) { busy = Math.round(100 * s.busy / s.active); noise = s.noise; } });
			if (busy !== null) score += busy * 0.6;
			return { ch: ch, score: score, count: cnt, busy: busy, noise: noise };
		});
	},

	tables: function() {
		var cong = this.congestion(), is24 = this.band() === 2, pref = is24 ? PREF24 : PREF5;
		var max = Math.max.apply(null, cong.map(function(c) { return c.score; }).concat([1]));
		var best = cong.filter(function(c) { return pref.indexOf(c.ch) >= 0; }).sort(function(a, b) { return a.score - b.score; })[0];
		this.recBox.textContent = '';
		if (best) this.recBox.appendChild(E('div', { 'class': 'am-msg am-ok' }, 'القناة الموصى بها: ' + best.ch + ' (أقل ازدحاماً بين القنوات غير المتداخلة)'));
		this.recBox.appendChild(E('div', { 'class': 'am-tablewrap' }, E('table', { 'class': 'am-tbl' }, [
			E('tr', [ E('th', 'القناة'), E('th', 'شبكات متداخلة'), E('th', 'Busy %'), E('th', 'Noise'), E('th', 'مؤشر الازدحام') ]) ].concat(cong.map(function(c) {
			return E('tr', [ E('td', '' + c.ch), E('td', '' + c.count), E('td', c.busy === null ? '-' : c.busy + '%'), E('td', c.noise === null ? '-' : c.noise + ' dBm'),
				E('td', E('div', { 'class': 'am-bar' }, E('i', { style: 'width:' + Math.round(100 * c.score / max) + '%' }))) ]);
		})))));
		var nets = this.nets.slice().sort(function(a, b) { return b.signal - a.signal; });
		this.netTbl.textContent = '';
		this.netTbl.appendChild(E('table', { 'class': 'am-tbl' }, [ E('tr', [ E('th', 'SSID'), E('th', 'BSSID'), E('th', 'القناة'), E('th', 'الإشارة'), E('th', 'SNR*'), E('th', 'التشفير') ]) ].concat(nets.map(function(n) {
			var noise = -95; this.survey.forEach(function(s) { if (s.freq === chFreq(n.channel) && s.noise != null) noise = s.noise; });
			var enc = n.encryption ? (n.encryption.enabled ? (n.encryption.description || 'مشفر') : 'مفتوح') : '-';
			return E('tr', [ E('td', n.ssid || '(hidden)'), E('td', n.bssid || ''), E('td', '' + n.channel), E('td', n.signal + ' dBm'), E('td', (n.signal - noise) + ' dB'), E('td', enc) ]);
		}, this))));
		this.netTbl.appendChild(E('small', '* SNR = الإشارة − الضجيج المقاس على القناة (أو −95 dBm تقديرياً عند عدم توفر القياس).'));
		this.survTbl.textContent = '';
		if (!this.survey.length) { this.survTbl.appendChild(E('em', 'لا تتوفر إحصاءات survey (قد لا يدعمها الدرايفر أو الحزمة iw غير مثبتة).')); return; }
		this.survTbl.appendChild(E('table', { 'class': 'am-tbl' }, [ E('tr', [ E('th', 'التردد'), E('th', 'Noise'), E('th', 'Busy %'), E('th', 'القناة الحالية') ]) ].concat(this.survey.map(function(s) {
			return E('tr', [ E('td', s.freq + ' MHz'), E('td', s.noise === null ? '-' : s.noise + ' dBm'), E('td', s.active ? Math.round(100 * s.busy / s.active) + '%' : '-'), E('td', s.in_use ? '✔' : '') ]);
		}))));
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
