'use strict';
'require view';
'require rpc';
'require poll';

var callSurvey = rpc.declare({ object: 'alameer', method: 'survey', params: ['radio'] });
var callScan = rpc.declare({ object: 'iwinfo', method: 'scan', params: ['device'], expect: { results: [] } });

function chOf(freq) { return freq < 3000 ? (freq === 2484 ? 14 : (freq - 2407) / 5) : (freq - 5000) / 5; }
function color(i) { return 'hsl(' + ((i * 67) % 360) + ',80%,60%)'; }

function score(ch, band, aps, survey) {
	var load = 0, f = band === '2g' ? 2407 + ch * 5 : 5000 + ch * 5, w = band === '2g' ? 22 : 80;
	aps.forEach(function (a) {
		var d = Math.abs(a.freq - f);
		if (d < w) load += Math.max(0, a.signal + 95) / 65 * (1 - d / w);
	});
	var s = survey.filter(function (x) { return x.freq === f; })[0] || {};
	var busy = s.active ? s.busy / s.active * 100 : 0, noise = s.noise ? Math.max(0, s.noise + 95) * 2 : 0;
	return { score: Math.min(100, Math.round(load * 25 + busy * 0.6 + noise)), busy: Math.round(busy), noise: s.noise };
}

function draw(cv, band, aps) {
	var W = cv.width = cv.clientWidth * 2, H = cv.height = cv.clientHeight * 2, c = cv.getContext('2d');
	c.clearRect(0, 0, W, H); c.font = '22px sans-serif'; c.fillStyle = '#8b93b5'; c.strokeStyle = '#232c55';
	var lo = band === '2g' ? 2400 : 5150, hi = band === '2g' ? 2490 : 5850, X = function (f) { return (f - lo) / (hi - lo) * W; }, Y = function (s) { return H - 40 - (s + 100) / 70 * (H - 70); };
	for (var s = -100; s <= -30; s += 10) { c.beginPath(); c.moveTo(0, Y(s)); c.lineTo(W, Y(s)); c.stroke(); c.fillText(s, 4, Y(s) - 4); }
	var chs = band === '2g' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] : [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 149, 153, 157, 161, 165];
	chs.forEach(function (ch) { var f = band === '2g' ? 2407 + ch * 5 : 5000 + ch * 5; c.fillText(ch, X(f) - 10, H - 10); });
	aps.forEach(function (a, i) {
		var w = (band === '2g' ? 22 : (a.width || 20)) / 2, x0 = X(a.freq - w), x1 = X(a.freq + w), top = Y(a.signal), base = Y(-100);
		c.beginPath(); c.moveTo(x0, base); c.quadraticCurveTo((x0 + x1) / 2, top - (base - top) * 0.35, x1, base);
		c.strokeStyle = color(i); c.lineWidth = 3; c.stroke(); c.fillStyle = color(i) + ''; c.fillText(a.ssid || '(hidden)', (x0 + x1) / 2 - 40, top - 8);
	});
}

return view.extend({
	render: function () {
		var self = this, state = { band: '2g' };
		var cv = E('canvas', { 'class': 'al-canvas' }), info = E('div', { 'class': 'al-card' }), tbl = E('div', { 'class': 'al-card' });
		var tabs = E('div', { 'class': 'al-row' }, ['2g', '5g'].map(function (b) {
			return E('button', { 'class': 'cbi-button', click: function () { state.band = b; refresh(); } }, b === '2g' ? '2.4 GHz (radio0)' : '5 GHz (radio1)');
		}));
		function refresh() {
			var radio = state.band === '2g' ? 'radio0' : 'radio1';
			info.textContent = _('Scanning…');
			return callSurvey(radio).then(function (sv) {
				return callScan(sv.ifname).then(function (res) {
					var aps = (res || []).map(function (a) { return { ssid: a.ssid, bssid: a.bssid, signal: a.signal, freq: a.mode ? 0 : 0, ch: a.channel, width: 20 }; });
					aps.forEach(function (a) { a.freq = state.band === '2g' ? 2407 + a.ch * 5 : 5000 + a.ch * 5; });
					aps = aps.filter(function (a) { return state.band === '2g' ? a.ch <= 14 : a.ch > 14; });
					draw(cv, state.band, aps);
					var cands = state.band === '2g' ? [1, 6, 11] : [36, 40, 44, 48, 149, 153, 157, 161], best = null, rows = [];
					cands.forEach(function (ch) { var s = score(ch, state.band, aps, sv.survey); rows.push([ch, s]); if (!best || s.score < best.s.score) best = { ch: ch, s: s }; });
					info.innerHTML = '';
					info.appendChild(E('h3', {}, _('Congestion score per non-overlapping channel (lower is better)')));
					info.appendChild(E('div', { 'class': 'al-grid' }, rows.map(function (r) {
						return E('div', { 'class': 'al-stat' }, [E('b', {}, String(r[1].score)), E('span', {}, 'CH ' + r[0] + ' · busy ' + r[1].busy + '% · noise ' + (r[1].noise || '?') + ' dBm')]);
					})));
					info.appendChild(E('p', { 'class': 'al-on' }, _('Suggested channel: ') + best.ch));
					tbl.innerHTML = '';
					tbl.appendChild(E('h3', {}, _('Nearby networks (') + aps.length + ')'));
					tbl.appendChild(E('div', { style: 'overflow-x:auto' }, E('table', { 'class': 'table' }, [E('tr', { 'class': 'tr' }, ['SSID', 'BSSID', 'CH', 'dBm'].map(function (h) { return E('th', { 'class': 'th' }, h); }))].concat(aps.sort(function (a, b) { return b.signal - a.signal; }).map(function (a) {
						return E('tr', { 'class': 'tr' }, [a.ssid || '(hidden)', a.bssid, a.ch, a.signal].map(function (x) { return E('td', { 'class': 'td' }, String(x)); }));
					})))));
				});
			}).catch(function (e) { info.textContent = _('Scan failed: ') + e; });
		}
		refresh();
		return E('div', {}, [E('h2', {}, _('WiFi Analyzer')), tabs, E('div', { 'class': 'al-card' }, cv), info, tbl]);
	},
	handleSave: null, handleSaveApply: null, handleReset: null
});
