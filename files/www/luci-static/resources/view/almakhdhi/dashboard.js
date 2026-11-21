'use strict';
'require view';
'require poll';
'require rpc';
'require fs';
'require almakhdhi.i18n as T';

/* All values shown here come from the router (ubus / sysfs). Nothing is simulated. */

var callBoard  = rpc.declare({ object: 'system', method: 'board' });
var callInfo   = rpc.declare({ object: 'system', method: 'info' });
var callIfaces = rpc.declare({ object: 'network.interface', method: 'dump', expect: { interface: [] } });
var callWifi   = rpc.declare({ object: 'network.wireless', method: 'status' });
var callIwinfo = rpc.declare({ object: 'iwinfo', method: 'info', params: [ 'device' ] });
var callAssoc  = rpc.declare({ object: 'iwinfo', method: 'assoclist', params: [ 'device' ], expect: { results: [] } });
var callExec   = rpc.declare({ object: 'file', method: 'exec', params: [ 'command', 'params' ] });

var HISTORY = 60;

function el(tag, cls, text) {
	var e = E(tag, { 'class': cls || '' });
	if (text != null) e.textContent = text;
	return e;
}

function setText(node, text) {
	if (node && node.textContent !== String(text)) node.textContent = String(text);
}

function fmtBytes(n) {
	n = Number(n);
	if (!isFinite(n) || n < 0) return '-';
	var u = [ 'B', 'KB', 'MB', 'GB' ], i = 0;
	while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
	return n.toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
}

function fmtUptime(s) {
	s = Number(s);
	if (!isFinite(s)) return '-';
	var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
	var out = [];
	if (d) out.push(d + ' ' + T.t('d'));
	if (d || h) out.push(h + ' ' + T.t('h'));
	out.push(m + ' ' + T.t('m'));
	return out.join(' ');
}

/* ubus "system info" reports root/tmp in KiB; guard against a bytes build */
function rootBytes(v) {
	v = Number(v) || 0;
	return (v * 1024 > 1073741824) ? v : v * 1024;
}

function spark(vals, max) {
	var w = 240, h = 60, n = vals.length;
	if (n < 2) return '';
	var pts = vals.map(function(v, i) {
		var x = (i * (w / (HISTORY - 1))) + (w - (n - 1) * (w / (HISTORY - 1)));
		var y = h - (Math.max(0, Math.min(v, max)) / max) * (h - 4) - 2;
		return x.toFixed(1) + ',' + y.toFixed(1);
	});
	var first = pts[0].split(',')[0], last = pts[n - 1].split(',')[0];
	return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" class="amk-spark" aria-hidden="true">' +
		'<polygon fill="currentColor" fill-opacity="0.12" points="' + first + ',' + h + ' ' + pts.join(' ') + ' ' + last + ',' + h + '"/>' +
		'<polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="' + pts.join(' ') + '"/></svg>';
}

function badge(text, kind) {
	return el('span', 'amk-badge ' + (kind || 'muted'), text);
}

function stat(label) {
	var v = el('div', 'amk-stat-value', '-');
	var sub = el('div', 'amk-stat-sub');
	return { node: el('div', 'amk-card amk-stat'), value: v, sub: sub, label: label };
}

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function() {
		this.hist = { ram: [], load: [] };
		this.inet = null;
		return this.fetch();
	},

	fetch: function() {
		var self = this;
		return Promise.all([
			L.resolveDefault(callBoard(), {}),
			L.resolveDefault(callInfo(), {}),
			L.resolveDefault(callIfaces(), []),
			L.resolveDefault(callWifi(), {}),
			L.resolveDefault(fs.read('/sys/class/thermal/thermal_zone0/temp'), null)
		]).then(function(r) {
			var d = { board: r[0] || {}, info: r[1] || {}, ifaces: r[2] || [], wifi: r[3] || {}, temp: r[4], radios: [] };
			var jobs = [];

			Object.keys(d.wifi).forEach(function(rname) {
				var rd = d.wifi[rname] || {};
				var radio = { name: rname, up: !!rd.up, disabled: !!rd.disabled, config: rd.config || {}, nets: [] };
				d.radios.push(radio);
				(rd.interfaces || []).forEach(function(n) {
					var net = { ifname: n.ifname, ssid: (n.config || {}).ssid, mode: (n.config || {}).mode, info: {}, clients: null };
					radio.nets.push(net);
					if (!n.ifname) return;
					jobs.push(L.resolveDefault(callIwinfo(n.ifname), {}).then(function(i) { net.info = i || {}; }));
					jobs.push(L.resolveDefault(callAssoc(n.ifname), []).then(function(a) { net.clients = Array.isArray(a) ? a.length : null; }));
				});
			});

			jobs.push(self.checkInternet(d).then(function() { d.inet = self.inet; }));
			return Promise.all(jobs).then(function() { return d; });
		});
	},

	checkInternet: function(d) {
		var self = this, now = Date.now();
		var hasRoute = (d.ifaces || []).some(function(i) {
			return (i.route || []).some(function(r) { return r.target === '0.0.0.0' && Number(r.mask) === 0; });
		});
		if (!hasRoute) { this.inet = { state: 'noroute', ts: now }; return Promise.resolve(); }
		if (this.inet && this.inet.state !== 'noroute' && (now - this.inet.ts) < 30000) return Promise.resolve();
		return L.resolveDefault(callExec('/bin/ping', [ '-c', '1', '-W', '2', '1.1.1.1' ]), null).then(function(r) {
			self.inet = { state: r ? (r.code === 0 ? 'ok' : 'down') : 'unknown', ts: Date.now() };
		});
	},

	render: function(d) {
		var self = this;
		this.u = {};

		var s = {
			host: stat('Hostname'), version: stat('Firmware'), uptime: stat('Uptime'), ip: stat('LAN address'),
			inet: stat('Internet'), wifi: stat('Wi-Fi'), cpu: stat('Processor'), temp: stat('Temperature')
		};
		var grid = el('div', 'amk-grid amk-grid-4');
		[ 'host', 'version', 'uptime', 'ip', 'inet', 'wifi', 'cpu', 'temp' ].forEach(function(k) {
			var st = s[k];
			st.node.appendChild(el('div', 'amk-stat-label', T.t(st.label)));
			st.node.appendChild(st.value);
			st.node.appendChild(st.sub);
			grid.appendChild(st.node);
			self.u[k] = st;
		});

		/* RAM + flash + load */
		this.u.ramBar = el('div', 'amk-bar-fill');
		this.u.ramTxt = el('div', 'amk-muted');
		this.u.ramPct = el('span', 'amk-big', '-');
		this.u.ramGraph = el('div', 'amk-graph');
		this.u.flashBar = el('div', 'amk-bar-fill');
		this.u.flashTxt = el('div', 'amk-muted');
		this.u.flashPct = el('span', 'amk-big', '-');
		this.u.loadTxt = el('span', 'amk-big', '-');
		this.u.loadGraph = el('div', 'amk-graph');

		function barCard(title, pct, bar, txt, graph) {
			var kids = [ el('h3', null, T.t(title)), E('div', { 'class': 'amk-row' }, [ pct ]), E('div', { 'class': 'amk-bar' }, [ bar ]), txt ];
			if (graph) kids.push(graph);
			return E('div', { 'class': 'amk-card' }, kids);
		}

		var loadCard = E('div', { 'class': 'amk-card' }, [
			el('h3', null, T.t('System load')),
			E('div', { 'class': 'amk-row' }, [ this.u.loadTxt ]),
			this.u.loadGraph
		]);

		var grid2 = E('div', { 'class': 'amk-grid amk-grid-3' }, [
			barCard('Memory (RAM)', this.u.ramPct, this.u.ramBar, this.u.ramTxt, this.u.ramGraph),
			barCard('Storage (flash)', this.u.flashPct, this.u.flashBar, this.u.flashTxt, null),
			loadCard
		]);

		this.u.radios = E('div', { 'class': 'amk-table-wrap' });
		this.u.ifaces = E('div', { 'class': 'amk-table-wrap' });

		var root = E('div', { 'class': 'amk-dashboard' }, [
			E('div', { 'class': 'amk-page-head' }, [
				el('h2', null, T.t('Dashboard')),
				el('p', 'amk-muted', T.t('Live data from this router, refreshed every 3 seconds.'))
			]),
			grid,
			grid2,
			E('div', { 'class': 'amk-card' }, [ el('h3', null, T.t('Wi-Fi radios')), this.u.radios ]),
			E('div', { 'class': 'amk-card' }, [ el('h3', null, T.t('Network interfaces')), this.u.ifaces ])
		]);

		this.update(d);
		poll.add(L.bind(function() { return this.fetch().then(L.bind(this.update, this)); }, this), 3);
		return root;
	},

	update: function(d) {
		var u = this.u, board = d.board || {}, info = d.info || {}, rel = board.release || {};

		setText(u.host.value, board.hostname || '-');
		setText(u.host.sub, board.model || '');
		setText(u.version.value, rel.version || '-');
		setText(u.version.sub, rel.description || '');
		setText(u.uptime.value, fmtUptime(info.uptime));

		/* LAN address: prefer "lan", else the first up interface with IPv4 */
		var ifs = (d.ifaces || []).filter(function(i) { return i.interface !== 'loopback'; });
		var lan = ifs.filter(function(i) { return i.interface === 'lan'; })[0] ||
			ifs.filter(function(i) { return (i['ipv4-address'] || []).length; })[0];
		var a4 = lan && (lan['ipv4-address'] || [])[0];
		setText(u.ip.value, a4 ? a4.address : '-');
		setText(u.ip.sub, a4 ? ('/' + a4.mask + (lan.interface ? '  (' + lan.interface + ')' : '')) : '');

		/* internet */
		var st = d.inet ? d.inet.state : 'unknown';
		var map = { ok: [ 'Connected', 'ok' ], down: [ 'Not reachable', 'bad' ], noroute: [ 'No default route', 'warn' ], unknown: [ 'Unknown', 'muted' ] };
		var m = map[st] || map.unknown;
		u.inet.value.textContent = '';
		u.inet.value.appendChild(badge(T.t(m[0]), m[1]));

		/* Wi-Fi summary */
		var total = 0, active = 0, clients = 0;
		(d.radios || []).forEach(function(r) {
			total++;
			if (r.up) active++;
			r.nets.forEach(function(n) { if (n.clients) clients += n.clients; });
		});
		u.wifi.value.textContent = '';
		u.wifi.value.appendChild(badge(total ? (active + ' / ' + total + ' ' + T.t('Active')) : T.t('Not available'), active ? 'ok' : 'muted'));
		setText(u.wifi.sub, total ? (T.t('Clients') + ': ' + clients) : '');

		/* CPU */
		setText(u.cpu.value, board.system || '-');
		var ld = info.load || [];
		var l1 = ld.length ? ld[0] / 65536 : null;
		setText(u.cpu.sub, ld.length ? (T.t('Load average') + ': ' + ld.map(function(x) { return (x / 65536).toFixed(2); }).join(' / ')) : '');

		/* temperature (MT7628 usually has no sensor) */
		var t = parseInt(String(d.temp || '').trim(), 10);
		if (isFinite(t)) {
			if (Math.abs(t) > 1000) t = t / 1000;
			setText(u.temp.value, t.toFixed(1) + ' °C');
			setText(u.temp.sub, '');
		}
		else {
			setText(u.temp.value, T.t('Not available'));
			setText(u.temp.sub, T.t('No sensor'));
		}

		/* memory */
		var mem = info.memory || {};
		if (mem.total) {
			var avail = (mem.available != null) ? mem.available : (mem.free + (mem.buffered || 0) + (mem.cached || 0));
			var used = Math.max(0, mem.total - avail), pct = Math.round(used * 100 / mem.total);
			setText(u.ramPct, pct + '%');
			u.ramBar.style.width = pct + '%';
			setText(u.ramTxt, fmtBytes(used) + ' ' + T.t('used') + ' ' + T.t('of') + ' ' + fmtBytes(mem.total) + '  -  ' + fmtBytes(avail) + ' ' + T.t('free'));
			this.hist.ram.push(pct);
		}
		/* flash */
		var root = info.root || {};
		if (root.total) {
			var tot = rootBytes(root.total), usd = rootBytes(root.used), fr = Math.max(0, tot - usd);
			var fp = Math.round(usd * 100 / tot);
			setText(u.flashPct, fp + '%');
			u.flashBar.style.width = fp + '%';
			setText(u.flashTxt, fmtBytes(usd) + ' ' + T.t('used') + ' ' + T.t('of') + ' ' + fmtBytes(tot) + '  -  ' + fmtBytes(fr) + ' ' + T.t('free'));
		}
		/* load */
		if (l1 != null) {
			setText(u.loadTxt, l1.toFixed(2));
			this.hist.load.push(l1);
		}
		[ 'ram', 'load' ].forEach(function(k) { if (this.hist[k].length > HISTORY) this.hist[k].shift(); }, this);
		var lmax = Math.max(1, Math.max.apply(null, this.hist.load.length ? this.hist.load : [ 1 ]));
		u.ramGraph.innerHTML = spark(this.hist.ram, 100);
		u.loadGraph.innerHTML = spark(this.hist.load, lmax);

		this.renderRadios(d);
		this.renderIfaces(ifs);
	},

	table: function(head, rows, emptyText) {
		if (!rows.length) return el('p', 'amk-muted', emptyText);
		var thead = E('tr', {}, head.map(function(h) { return E('th', {}, T.t(h)); }));
		var tbody = rows.map(function(r) {
			return E('tr', {}, r.map(function(c) {
				return E('td', {}, (c && c.nodeType) ? c : String(c == null ? '-' : c));
			}));
		});
		return E('table', { 'class': 'amk-table' }, [ E('thead', {}, thead), E('tbody', {}, tbody) ]);
	},

	renderRadios: function(d) {
		var rows = [];
		(d.radios || []).forEach(function(r) {
			var band = String(r.config.band || '').replace('2g', '2.4 GHz').replace('5g', '5 GHz') || '-';
			if (!r.nets.length) {
				rows.push([ r.name, band, '-', r.config.channel || '-', '-', '-', badge(r.up ? T.t('Active') : T.t('Off'), r.up ? 'ok' : 'muted') ]);
				return;
			}
			r.nets.forEach(function(n) {
				var i = n.info || {};
				rows.push([
					r.name, band, n.ssid || i.ssid || '-',
					i.channel != null ? i.channel : (r.config.channel || '-'),
					i.txpower != null ? (i.txpower + ' dBm') : '-',
					n.clients != null ? n.clients : '-',
					badge(r.disabled ? T.t('Disabled') : (r.up ? T.t('Active') : T.t('Off')), r.up ? 'ok' : 'muted')
				]);
			});
		});
		var t = this.table([ 'Radio', 'Band', 'SSID', 'Channel', 'TX power', 'Clients', 'Status' ], rows, T.t('No wireless radios were found.'));
		this.u.radios.textContent = '';
		this.u.radios.appendChild(t);
	},

	renderIfaces: function(ifs) {
		var rows = ifs.map(function(i) {
			var a = (i['ipv4-address'] || []).map(function(x) { return x.address + '/' + x.mask; }).join(', ');
			return [ i.interface, i.proto || '-', a || '-', badge(i.up ? T.t('Up') : T.t('Down'), i.up ? 'ok' : 'bad') ];
		});
		var t = this.table([ 'Interface', 'Protocol', 'IPv4 address', 'Status' ], rows, T.t('No interfaces were found.'));
		this.u.ifaces.textContent = '';
		this.u.ifaces.appendChild(t);
	}
});
