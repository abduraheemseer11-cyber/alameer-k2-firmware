'use strict';
'require view';
'require uci';
'require ui';

var MODES = {
	ap:    ['Access Point', 'All 5 ports in br-lan, static IP, DHCP off'],
	pppoe: ['PPPoE Dial-up', 'eth0.2 = WAN (PPPoE), DHCP on the 4 LAN ports'],
	wds:   ['WDS Bridge', 'Client (sta + wds) bridged into br-lan'],
	mesh:  ['MESH System', '802.11s + batman-adv, bat0 bridged to br-lan']
};

function lanDev() {
	var r = null;
	uci.sections('network', 'device', function (s) { if (s.name === 'br-lan') r = s['.name']; });
	return r;
}
function setPorts(list) { var d = lanDev(); if (d) uci.set('network', d, 'ports', list); }
function addPort(p) {
	var d = lanDev(); if (!d) return;
	var l = uci.get('network', d, 'ports') || []; if (!Array.isArray(l)) l = [l];
	if (l.indexOf(p) < 0) l.push(p); uci.set('network', d, 'ports', l);
}
function dropIfaces(prefixes) {
	uci.sections('wireless', 'wifi-iface', function (s) {
		prefixes.forEach(function (p) { if ((s['.name'] || '').indexOf(p) === 0) uci.remove('wireless', s['.name']); });
	});
}
function radios() { return uci.sections('wireless', 'wifi-device').map(function (s) { return s['.name']; }); }
function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
function resetSpecial() {
	dropIfaces(['alameer_sta', 'alameer_mesh']);
	['bat0', 'bat0_hardif'].forEach(function (n) { uci.remove('network', n); });
	uci.remove('network', 'wan');
}

var apply = {
	ap: function () {
		resetSpecial(); setPorts(['eth0.1', 'eth0.2']);
		uci.set('network', 'lan', 'proto', 'static');
		uci.set('network', 'lan', 'ipaddr', val('f_ip') || '192.168.1.20');
		uci.set('network', 'lan', 'netmask', val('f_mask') || '255.255.255.0');
		uci.set('network', 'lan', 'gateway', val('f_gw') || '192.168.1.1');
		uci.set('network', 'lan', 'dns', [val('f_gw') || '192.168.1.1']);
		uci.set('dhcp', 'lan', 'ignore', '1');
	},
	pppoe: function () {
		resetSpecial(); setPorts(['eth0.1']);
		uci.set('network', 'lan', 'proto', 'static');
		uci.set('network', 'lan', 'ipaddr', val('f_ip') || '192.168.1.1');
		uci.set('network', 'lan', 'netmask', '255.255.255.0');
		uci.unset('network', 'lan', 'gateway'); uci.unset('network', 'lan', 'dns');
		uci.set('network', 'wan', 'interface');
		uci.set('network', 'wan', 'proto', 'pppoe');
		uci.set('network', 'wan', 'device', 'eth0.2');
		uci.set('network', 'wan', 'username', val('f_user'));
		uci.set('network', 'wan', 'password', val('f_pass'));
		uci.set('network', 'wan', 'ipv6', '0');
		uci.unset('dhcp', 'lan', 'ignore');
		uci.set('dhcp', 'lan', 'start', '100'); uci.set('dhcp', 'lan', 'limit', '150'); uci.set('dhcp', 'lan', 'leasetime', '12h');
		uci.sections('firewall', 'zone', function (z) {
			if (z.name === 'wan') { var n = z.network || []; if (!Array.isArray(n)) n = [n]; if (n.indexOf('wan') < 0) n.push('wan'); uci.set('firewall', z['.name'], 'network', n); }
		});
	},
	wds: function () {
		resetSpecial(); apply.ap();
		var r = val('f_radio') || 'radio0', s = 'alameer_sta';
		uci.add('wireless', 'wifi-iface', s);
		uci.set('wireless', s, 'device', r); uci.set('wireless', s, 'mode', 'sta'); uci.set('wireless', s, 'wds', '1');
		uci.set('wireless', s, 'network', 'lan'); uci.set('wireless', s, 'ssid', val('f_ssid'));
		uci.set('wireless', s, 'encryption', val('f_key') ? 'psk2' : 'none'); if (val('f_key')) uci.set('wireless', s, 'key', val('f_key'));
	},
	mesh: function () {
		resetSpecial(); apply.ap();
		var r = val('f_radio') || 'radio0', s = 'alameer_mesh';
		uci.add('network', 'interface', 'bat0'); uci.set('network', 'bat0', 'proto', 'batadv');
		uci.set('network', 'bat0', 'routing_algo', 'BATMAN_IV'); uci.set('network', 'bat0', 'bridge_loop_avoidance', '1');
		uci.add('network', 'interface', 'bat0_hardif'); uci.set('network', 'bat0_hardif', 'proto', 'batadv_hardif');
		uci.set('network', 'bat0_hardif', 'master', 'bat0'); uci.set('network', 'bat0_hardif', 'mtu', '1536');
		addPort('bat0');
		uci.add('wireless', 'wifi-iface', s);
		uci.set('wireless', s, 'device', r); uci.set('wireless', s, 'mode', 'mesh');
		uci.set('wireless', s, 'mesh_id', val('f_meshid') || 'AlameerMesh'); uci.set('wireless', s, 'mesh_fwding', '0');
		uci.set('wireless', s, 'network', 'bat0_hardif');
		uci.set('wireless', s, 'encryption', val('f_key') ? 'sae' : 'none'); if (val('f_key')) uci.set('wireless', s, 'key', val('f_key'));
	}
};

function applyGuests() {
	uci.sections('wireless', 'wifi-iface', function (s) { if ((s['.name'] || '').indexOf('alameer_guest') === 0) uci.remove('wireless', s['.name']); });
	for (var i = 1; i <= 3; i++) {
		['guest' + i].forEach(function (n) { uci.remove('network', n); uci.remove('dhcp', n); uci.remove('firewall', 'zone_' + n); uci.remove('firewall', 'fwd_' + n); uci.remove('firewall', 'dhcp_' + n); uci.remove('firewall', 'dns_' + n); });
	}
	var cnt = parseInt(val('g_count')) || 0, base = val('g_ssid') || 'Guest', key = val('g_key');
	var bands = { radio0: document.getElementById('g_2g').checked, radio1: document.getElementById('g_5g').checked };
	for (var i = 1; i <= cnt && i <= 3; i++) {
		var n = 'guest' + i, ip = '192.168.' + (100 + i) + '.1';
		uci.add('network', 'interface', n); uci.set('network', n, 'proto', 'static'); uci.set('network', n, 'ipaddr', ip); uci.set('network', n, 'netmask', '255.255.255.0');
		uci.add('dhcp', 'dhcp', n); uci.set('dhcp', n, 'interface', n); uci.set('dhcp', n, 'start', '10'); uci.set('dhcp', n, 'limit', '200'); uci.set('dhcp', n, 'leasetime', '2h');
		uci.add('firewall', 'zone', 'zone_' + n); uci.set('firewall', 'zone_' + n, 'name', n); uci.set('firewall', 'zone_' + n, 'network', [n]);
		uci.set('firewall', 'zone_' + n, 'input', 'REJECT'); uci.set('firewall', 'zone_' + n, 'output', 'ACCEPT'); uci.set('firewall', 'zone_' + n, 'forward', 'REJECT');
		uci.add('firewall', 'forwarding', 'fwd_' + n); uci.set('firewall', 'fwd_' + n, 'src', n); uci.set('firewall', 'fwd_' + n, 'dest', 'wan');
		uci.add('firewall', 'rule', 'dhcp_' + n); uci.set('firewall', 'dhcp_' + n, 'name', 'Allow-DHCP-' + n); uci.set('firewall', 'dhcp_' + n, 'src', n);
		uci.set('firewall', 'dhcp_' + n, 'proto', 'udp'); uci.set('firewall', 'dhcp_' + n, 'dest_port', '67-68'); uci.set('firewall', 'dhcp_' + n, 'target', 'ACCEPT');
		uci.add('firewall', 'rule', 'dns_' + n); uci.set('firewall', 'dns_' + n, 'name', 'Allow-DNS-' + n); uci.set('firewall', 'dns_' + n, 'src', n);
		uci.set('firewall', 'dns_' + n, 'proto', 'tcp udp'); uci.set('firewall', 'dns_' + n, 'dest_port', '53'); uci.set('firewall', 'dns_' + n, 'target', 'ACCEPT');
		Object.keys(bands).forEach(function (r) {
			if (!bands[r]) return;
			var w = 'alameer_' + n + (r === 'radio0' ? '_2g' : '_5g');
			uci.add('wireless', 'wifi-iface', w); uci.set('wireless', w, 'device', r); uci.set('wireless', w, 'mode', 'ap'); uci.set('wireless', w, 'network', n);
			uci.set('wireless', w, 'ssid', base + (cnt > 1 ? '_' + i : '')); uci.set('wireless', w, 'isolate', '1');
			uci.set('wireless', w, 'encryption', key.length >= 8 ? 'psk2' : 'none'); if (key.length >= 8) uci.set('wireless', w, 'key', key);
		});
	}
}

function applyVlans() {
	uci.sections('network', 'device', function (s) { if (/^(eth0\.1\.\d+|br-vlan\d+)$/.test(s.name || '')) uci.remove('network', s['.name']); });
	uci.sections('network', 'interface', function (s) { if (/^vlan\d+$/.test(s['.name'])) uci.remove('network', s['.name']); });
	val('v_ids').split(/[\s,]+/).filter(function (x) { var v = parseInt(x); return v >= 2 && v <= 4094; }).forEach(function (v) {
		var d = 'dev_vlan' + v, b = 'brdev_vlan' + v;
		uci.add('network', 'device', d); uci.set('network', d, 'type', '8021q'); uci.set('network', d, 'ifname', 'eth0.1'); uci.set('network', d, 'vid', v); uci.set('network', d, 'name', 'eth0.1.' + v);
		uci.add('network', 'device', b); uci.set('network', b, 'type', 'bridge'); uci.set('network', b, 'name', 'br-vlan' + v); uci.set('network', b, 'ports', ['eth0.1.' + v]);
		uci.add('network', 'interface', 'vlan' + v); uci.set('network', 'vlan' + v, 'proto', 'none'); uci.set('network', 'vlan' + v, 'device', 'br-vlan' + v);
	});
}

function field(label, id, ph, type, v) {
	return E('div', { 'class': 'al-row', 'data-f': id }, [E('label', {}, label), E('input', { id: id, type: type || 'text', placeholder: ph || '', value: v || '' })]);
}

return view.extend({
	load: function () { return uci.load(['network', 'wireless', 'dhcp', 'firewall', 'alameer']); },
	render: function () {
		var mode = 'ap', rs = radios(), self = this;
		var box = E('div', { 'class': 'al-card' });
		var fields = E('div');
		var radioSel = E('div', { 'class': 'al-row' }, [E('label', {}, _('Radio')), E('select', { id: 'f_radio' }, rs.map(function (r) { return E('option', { value: r }, r + (r === 'radio0' ? ' (2.4GHz)' : ' (5GHz)')); }))]);
		function draw() {
			var items = [];
			if (mode === 'ap') items = [field(_('IP address'), 'f_ip', '192.168.1.20', 'text', '192.168.1.20'), field(_('Netmask'), 'f_mask', '255.255.255.0', 'text', '255.255.255.0'), field(_('Gateway / DNS'), 'f_gw', '192.168.1.1', 'text', '192.168.1.1')];
			if (mode === 'pppoe') items = [field(_('PPPoE username'), 'f_user'), field(_('PPPoE password'), 'f_pass', '', 'password'), field(_('LAN IP'), 'f_ip', '192.168.1.1', 'text', '192.168.1.1')];
			if (mode === 'wds') items = [field(_('IP address'), 'f_ip', '', 'text', '192.168.1.20'), field(_('Gateway / DNS'), 'f_gw', '', 'text', '192.168.1.1'), radioSel, field(_('Upstream SSID'), 'f_ssid'), field(_('Upstream key'), 'f_key', '', 'password')];
			if (mode === 'mesh') items = [field(_('IP address'), 'f_ip', '', 'text', '192.168.1.20'), field(_('Gateway / DNS'), 'f_gw', '', 'text', '192.168.1.1'), radioSel, field(_('Mesh ID'), 'f_meshid', 'AlameerMesh', 'text', 'AlameerMesh'), field(_('Mesh key (SAE)'), 'f_key', '', 'password')];
			fields.innerHTML = ''; items.forEach(function (i) { fields.appendChild(i); });
			modes.querySelectorAll('.al-mode').forEach(function (m) { m.classList.toggle('sel', m.dataset.m === mode); });
		}
		var modes = E('div', { 'class': 'al-modes' }, Object.keys(MODES).map(function (k) {
			return E('div', { 'class': 'al-mode', 'data-m': k, click: function () { mode = k; draw(); } }, [E('b', {}, MODES[k][0]), E('small', {}, MODES[k][1])]);
		}));
		var go = E('button', { 'class': 'cbi-button cbi-button-action', click: function () {
			apply[mode](); uci.save(); return ui.changes.apply(true);
		} }, _('Apply mode'));
		box.appendChild(E('h3', {}, _('Operating mode'))); box.appendChild(modes); box.appendChild(fields); box.appendChild(go);

		var g = E('div', { 'class': 'al-card' }, [E('h3', {}, _('Guest networks (up to 3, isolated)')),
			field(_('Number of guest SSIDs'), 'g_count', '0-3', 'number', '0'), field(_('Base SSID'), 'g_ssid', 'Guest', 'text', 'Guest'), field(_('Key (8+ chars)'), 'g_key', '', 'password'),
			E('div', { 'class': 'al-row' }, [E('label', {}, _('Bands')), E('label', {}, [E('input', { type: 'checkbox', id: 'g_2g', checked: 'checked' }), ' 2.4GHz ']), E('label', {}, [E('input', { type: 'checkbox', id: 'g_5g', checked: 'checked' }), ' 5GHz'])]),
			E('button', { 'class': 'cbi-button cbi-button-action', click: function () { applyGuests(); uci.save(); return ui.changes.apply(true); } }, _('Apply guest networks'))]);

		var v = E('div', { 'class': 'al-card' }, [E('h3', {}, _('VLAN isolation (802.1q on eth0.1)')),
			field(_('VLAN IDs (comma separated)'), 'v_ids', '10,20'),
			E('div', { 'class': 'al-warn' }, _('Creates eth0.1.<VID> and br-vlan<VID>. Attach bridges to SSIDs/firewall afterwards in Network settings.')),
			E('button', { 'class': 'cbi-button cbi-button-action', click: function () { applyVlans(); uci.save(); return ui.changes.apply(true); } }, _('Apply VLANs'))]);
		draw();
		return E('div', {}, [E('h2', {}, _('Alameer Quick Setup')), box, g, v]);
	},
	handleSave: null, handleSaveApply: null, handleReset: null
});
