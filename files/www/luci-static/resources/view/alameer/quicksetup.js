'use strict';
'require view';
'require fs';
'require rpc';
'require uci';
'require ui';

/* Alameer Software – Quick Setup wizard (real UCI writer, no static mock-up).
   The wizard collects values, writes /tmp/alameer-qs.json and runs
   /usr/libexec/alameer/quicksetup-apply which edits network/wireless/dhcp/
   system/firewall and reloads services. The admin password is set through
   the standard LuCI rpc call. */

var callScan = rpc.declare({ object: 'iwinfo', method: 'scan', params: [ 'device' ], nobatch: true, expect: { results: [] } });
var callWifiStatus = rpc.declare({ object: 'network.wireless', method: 'status', expect: { '': {} } });
var callSetPassword = rpc.declare({ object: 'luci', method: 'setPassword', params: [ 'username', 'password' ], expect: { result: true } });

var MODES = [
	{ id: 'ap',       title: _('Access Point (Bridge)'), desc: _('No DHCP, WAN + LAN bridged. Optional management VLAN.') },
	{ id: 'router',   title: _('Router'),                desc: _('NAT router with PPPoE, DHCP or static WAN.') },
	{ id: 'repeater', title: _('Repeater / WISP'),       desc: _('Connect to an upstream Wi-Fi (client) and rebroadcast.') },
	{ id: 'mesh',     title: _('Mesh Node (802.11s)'),   desc: _('Wireless backhaul between access points.') }
];

function isIp(v) { return /^(\d{1,3}\.){3}\d{1,3}$/.test(v) && v.split('.').every(function(o) { return +o <= 255; }); }
function clean(v) { return /^[^\x00-\x1f]*$/.test(v); }

return view.extend({
	load: function() {
		return Promise.all([
			uci.load([ 'system', 'network', 'wireless' ]),
			L.resolveDefault(fs.read('/etc/alameer/mode'), '')
		]);
	},

	render: function(data) {
		var lanip = uci.get('network', 'lan', 'ipaddr') || '192.168.1.20';
		if (Array.isArray(lanip)) lanip = lanip[0];
		lanip = String(lanip).split('/')[0];

		this.s = {
			mode: (data[1] || '').trim() || 'router',
			hostname: uci.get('system', '@system[0]', 'hostname') || 'Alameer-K2',
			ssid2g: 'AbduRaheem_2G', ssid5g: 'AbduRaheem_5G', wifi_key: '',
			admin_pass: '', admin_pass2: '',
			lan_proto: 'static', lan_ip: lanip, lan_mask: uci.get('network', 'lan', 'netmask') || '255.255.255.0', lan_gw: '', lan_dns: '',
			mgmt_vlan: '', mgmt_ip: '', mgmt_mask: '255.255.255.0', mgmt_gw: '',
			wan_proto: 'dhcp', pppoe_user: '', pppoe_pass: '', wan_ip: '', wan_mask: '255.255.255.0', wan_gw: '', wan_dns: '',
			sta_ssid: '', sta_bssid: '', sta_key: '', sta_enc: 'psk2', sta_band: '2g', sta_type: 'relay',
			mesh_id: 'Alameer-Mesh', mesh_key: '', mesh_radio: '5g', mesh_role: 'node'
		};
		this.step = 0;
		this.scan = [];
		this.root = E('div', { 'class': 'am-wizard' });
		this.draw();
		return this.root;
	},

	/* ---------- small UI helpers ---------- */
	row: function(label, node, hint) {
		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, label),
			E('div', { 'class': 'cbi-value-field' }, [ node, hint ? E('div', { 'class': 'cbi-value-description' }, hint) : '' ])
		]);
	},

	input: function(key, type, ph) {
		var self = this;
		return E('input', {
			'class': 'cbi-input-text', 'type': type || 'text', 'value': this.s[key], 'placeholder': ph || '',
			'autocomplete': 'off', 'autocapitalize': 'off', 'spellcheck': 'false',
			'input': function(ev) { self.s[key] = (type === 'password') ? ev.target.value : ev.target.value.trim(); }
		});
	},

	select: function(key, opts, onchange) {
		var self = this;
		return E('select', {
			'class': 'cbi-input-select',
			'change': function(ev) { self.s[key] = ev.target.value; if (onchange) onchange(); }
		}, opts.map(function(o) { return E('option', { 'value': o[0], 'selected': self.s[key] === o[0] ? '' : null }, o[1]); }));
	},

	draw: function() {
		var self = this,
		    steps = [ _('Mode'), _('Wi-Fi & Admin'), _('Mode settings'), _('Review') ],
		    bar = E('ul', { 'class': 'tabs' }, steps.map(function(t, i) {
			    return E('li', { 'class': i === self.step ? 'active' : '' }, E('a', { 'href': '#', 'click': function(ev) { ev.preventDefault(); } }, (i + 1) + '. ' + t));
		    })),
		    body = [ this.stepMode, this.stepWifi, this.stepSettings, this.stepReview ][this.step].call(this),
		    nav = E('div', { 'class': 'cbi-page-actions' }, [
			    this.step > 0 ? E('button', { 'class': 'btn cbi-button', 'click': function() { self.step--; self.draw(); } }, _('Back')) : '',
			    this.step < 3 ? E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function() { self.next(); } }, _('Next')) :
				E('button', { 'class': 'btn cbi-button cbi-button-save important', 'click': function() { self.apply(); } }, _('Save & Apply'))
		    ]);

		this.root.innerHTML = '';
		this.root.appendChild(E('h2', {}, _('Quick Setup')));
		this.root.appendChild(bar);
		this.root.appendChild(body);
		this.root.appendChild(nav);
	},

	/* ---------- step 1: mode ---------- */
	stepMode: function() {
		var self = this;
		return E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-descr' }, _('Choose how this router will be used.')),
			E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:10px' }, MODES.map(function(m) {
				var on = self.s.mode === m.id;
				return E('div', {
					'style': 'flex:1 1 220px;cursor:pointer;padding:12px;border-radius:10px;border:2px solid ' + (on ? '#7b2cbf' : '#e6dcef') + ';background:' + (on ? '#f4ecfa' : '#fff'),
					'click': function() { self.s.mode = m.id; self.draw(); }
				}, [ E('b', { 'style': 'color:#3b0d54' }, m.title), E('div', { 'style': 'margin-top:4px' }, m.desc) ]);
			}))
		]);
	},

	/* ---------- step 2: wifi + admin ---------- */
	stepWifi: function() {
		return E('div', { 'class': 'cbi-section' }, [
			this.row(_('Hostname'), this.input('hostname')),
			this.row(_('2.4 GHz SSID'), this.input('ssid2g')),
			this.row(_('5 GHz SSID'), this.input('ssid5g')),
			this.row(_('Wi-Fi password'), this.input('wifi_key', 'password'), _('8–63 characters. Leave empty for an open network (not recommended).')),
			this.row(_('New admin password'), this.input('admin_pass', 'password'), _('Optional – leave empty to keep the current one.')),
			this.row(_('Repeat admin password'), this.input('admin_pass2', 'password'))
		]);
	},

	lanFields: function() {
		var self = this, box = E('div');
		var fill = function() {
			box.innerHTML = '';
			box.appendChild(self.row(_('LAN address mode'), self.select('lan_proto', [ [ 'static', _('Static') ], [ 'dhcp', _('DHCP client') ] ], fill)));
			if (self.s.lan_proto === 'static') {
				box.appendChild(self.row(_('LAN IP address'), self.input('lan_ip')));
				box.appendChild(self.row(_('LAN netmask'), self.input('lan_mask')));
				if (self.s.mode === 'ap' || self.s.mode === 'mesh' || (self.s.mode === 'repeater' && self.s.sta_type === 'relay')) {
					box.appendChild(self.row(_('Gateway'), self.input('lan_gw'), _('Optional')));
					box.appendChild(self.row(_('DNS'), self.input('lan_dns'), _('Optional')));
				}
			}
		};
		fill();
		return box;
	},

	vlanFields: function() {
		return E('div', {}, [
			E('h3', {}, _('Management VLAN (optional)')),
			E('div', { 'class': 'cbi-section-descr' }, _('Adds a tagged management interface. The untagged LAN stays reachable, so you cannot lock yourself out.')),
			this.row(_('VLAN ID'), this.input('mgmt_vlan', 'number', '2-4094')),
			this.row(_('Management IP'), this.input('mgmt_ip')),
			this.row(_('Management netmask'), this.input('mgmt_mask')),
			this.row(_('Management gateway'), this.input('mgmt_gw'))
		]);
	},

	/* ---------- step 3: mode specific ---------- */
	stepSettings: function() {
		var self = this, s = this.s, sec = E('div', { 'class': 'cbi-section' });

		if (s.mode === 'ap') {
			sec.appendChild(E('div', { 'class': 'cbi-section-descr' }, _('Bridge mode: DHCP server is disabled and the WAN port joins the LAN.')));
			sec.appendChild(this.lanFields());
			sec.appendChild(this.vlanFields());
		}
		else if (s.mode === 'router') {
			var wan = E('div'), fill = function() {
				wan.innerHTML = '';
				wan.appendChild(self.row(_('WAN protocol'), self.select('wan_proto', [ [ 'dhcp', _('Dynamic IP (DHCP)') ], [ 'pppoe', 'PPPoE' ], [ 'static', _('Static IP') ] ], fill)));
				if (s.wan_proto === 'pppoe') {
					wan.appendChild(self.row(_('PPPoE username'), self.input('pppoe_user')));
					wan.appendChild(self.row(_('PPPoE password'), self.input('pppoe_pass', 'password')));
				}
				else if (s.wan_proto === 'static') {
					wan.appendChild(self.row(_('WAN IP'), self.input('wan_ip')));
					wan.appendChild(self.row(_('WAN netmask'), self.input('wan_mask')));
					wan.appendChild(self.row(_('WAN gateway'), self.input('wan_gw')));
					wan.appendChild(self.row(_('WAN DNS'), self.input('wan_dns'), _('Optional')));
				}
			};
			fill();
			sec.appendChild(wan);
			s.lan_proto = 'static';
			sec.appendChild(E('h3', {}, _('LAN')));
			sec.appendChild(this.row(_('LAN IP address'), this.input('lan_ip')));
			sec.appendChild(this.row(_('LAN netmask'), this.input('lan_mask')));
		}
		else if (s.mode === 'repeater') {
			sec.appendChild(this.repeaterFields());
		}
		else {
			sec.appendChild(this.row(_('Mesh ID'), this.input('mesh_id')));
			sec.appendChild(this.row(_('Mesh key (SAE)'), this.input('mesh_key', 'password'), _('At least 8 characters. All nodes need the same ID and key.')));
			sec.appendChild(this.row(_('Mesh radio'), this.select('mesh_radio', [ [ '5g', '5 GHz' ], [ '2g', '2.4 GHz' ], [ 'both', _('Both') ] ])));
			sec.appendChild(this.row(_('Role'), this.select('mesh_role', [ [ 'node', _('Node (bridge, no DHCP)') ], [ 'gateway', _('Gateway (router + DHCP)') ] ])));
			sec.appendChild(this.lanFields());
			sec.appendChild(this.vlanFields());
		}
		return sec;
	},

	repeaterFields: function() {
		var self = this, s = this.s, list = E('div', { 'class': 'table' }), box = E('div');

		var showList = function() {
			list.innerHTML = '';
			self.scan.forEach(function(n) {
				var sig = n.signal != null ? n.signal + ' dBm' : '',
				    enc = n.encryption && n.encryption.enabled ? _('Encrypted') : _('Open');
				list.appendChild(E('div', { 'class': 'tr', 'style': 'cursor:pointer' }, [
					E('div', { 'class': 'td', 'data-title': _('SSID') }, n.ssid || _('(hidden)')),
					E('div', { 'class': 'td', 'data-title': _('Signal') }, sig),
					E('div', { 'class': 'td', 'data-title': _('Channel') }, String(n.channel || '')),
					E('div', { 'class': 'td', 'data-title': _('Security') }, enc),
					E('div', { 'class': 'td cbi-section-actions' }, E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function(ev) {
						ev.preventDefault();
						s.sta_ssid = n.ssid || ''; s.sta_bssid = n.bssid || ''; s.sta_band = n._band || s.sta_band;
						var e = n.encryption || {};
						s.sta_enc = !e.enabled ? 'none' : ((e.authentication || []).indexOf('sae') > -1 ? 'sae' : 'psk2');
						self.draw();
					} }, _('Select')))
				]));
			});
		};

		var scanBtn = E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': function(ev) {
			ev.preventDefault();
			scanBtn.disabled = true; scanBtn.textContent = _('Scanning…');
			self.doScan().then(function(res) { self.scan = res; showList(); scanBtn.disabled = false; scanBtn.textContent = _('Scan'); if (!res.length) ui.addNotification(null, E('p', _('No networks found. Make sure a radio is enabled and try again.'))); });
		} }, _('Scan'));

		box.appendChild(E('div', { 'class': 'cbi-section-descr' }, _('Scan for the upstream network or type it manually.')));
		box.appendChild(scanBtn);
		showList();
		box.appendChild(list);
		box.appendChild(this.row(_('Upstream SSID'), this.input('sta_ssid')));
		box.appendChild(this.row(_('BSSID (optional)'), this.input('sta_bssid')));
		box.appendChild(this.row(_('Encryption'), this.select('sta_enc', [ [ 'psk2', 'WPA2-PSK' ], [ 'sae', 'WPA3-SAE' ], [ 'sae-mixed', 'WPA2/WPA3' ], [ 'psk', 'WPA-PSK' ], [ 'none', _('Open') ] ])));
		box.appendChild(this.row(_('Upstream password'), this.input('sta_key', 'password')));
		box.appendChild(this.row(_('Client radio'), this.select('sta_band', [ [ '2g', '2.4 GHz' ], [ '5g', '5 GHz' ] ])));
		box.appendChild(this.row(_('Type'), this.select('sta_type', [ [ 'relay', _('Transparent bridge (relayd, no double NAT)') ], [ 'routed', _('Routed WISP (NAT)') ] ], function() { self.draw(); })));
		box.appendChild(this.lanFields());
		return box;
	},

	doScan: function() {
		return callWifiStatus().then(function(st) {
			var jobs = [];
			Object.keys(st || {}).forEach(function(radio) {
				var ifs = (st[radio].interfaces || []), ifn = ifs.length ? ifs[0].ifname : null,
				    band = uci.get('wireless', radio, 'band') || '2g';
				if (ifn)
					jobs.push(callScan(ifn).then(function(r) { return (r || []).map(function(x) { x._band = band; return x; }); }).catch(function() { return []; }));
			});
			return Promise.all(jobs);
		}).then(function(all) {
			return [].concat.apply([], all).sort(function(a, b) { return (b.signal || -200) - (a.signal || -200); });
		});
	},

	/* ---------- validation ---------- */
	validate: function() {
		var s = this.s, e = null;
		if (this.step === 1) {
			if (!s.hostname || !/^[A-Za-z0-9._-]+$/.test(s.hostname)) e = _('Invalid hostname.');
			else if (!s.ssid2g || s.ssid2g.length > 32 || !clean(s.ssid2g)) e = _('Invalid 2.4 GHz SSID.');
			else if (!s.ssid5g || s.ssid5g.length > 32 || !clean(s.ssid5g)) e = _('Invalid 5 GHz SSID.');
			else if (s.wifi_key && (s.wifi_key.length < 8 || s.wifi_key.length > 63)) e = _('Wi-Fi password must be 8–63 characters.');
			else if (s.admin_pass !== s.admin_pass2) e = _('Admin passwords do not match.');
		}
		else if (this.step === 2) {
			if (s.lan_proto === 'static' && !isIp(s.lan_ip)) e = _('Invalid LAN IP.');
			else if (s.lan_proto === 'static' && !isIp(s.lan_mask)) e = _('Invalid LAN netmask.');
			else if (s.mode === 'router' && s.wan_proto === 'pppoe' && !s.pppoe_user) e = _('PPPoE username required.');
			else if (s.mode === 'router' && s.wan_proto === 'static' && !(isIp(s.wan_ip) && isIp(s.wan_gw))) e = _('Invalid static WAN settings.');
			else if (s.mode === 'repeater' && !s.sta_ssid) e = _('Select or type the upstream network.');
			else if (s.mode === 'repeater' && s.sta_enc !== 'none' && s.sta_key.length < 8) e = _('Upstream password must be at least 8 characters.');
			else if (s.mode === 'mesh' && (!s.mesh_id || s.mesh_key.length < 8)) e = _('Mesh ID and a key of 8+ characters are required.');
			else if ((s.mode === 'ap' || s.mode === 'mesh') && s.mgmt_vlan) {
				var v = +s.mgmt_vlan;
				if (!(v >= 2 && v <= 4094)) e = _('VLAN ID must be 2–4094.');
				else if (!isIp(s.mgmt_ip)) e = _('Management VLAN needs a valid IP.');
			}
		}
		if (e) ui.addNotification(null, E('p', e), 'danger');
		return !e;
	},

	next: function() {
		if (this.step > 0 && !this.validate()) return;
		this.step++;
		this.draw();
	},

	/* ---------- step 4: review + apply ---------- */
	stepReview: function() {
		var s = this.s, rows = [
			[ _('Mode'), (MODES.filter(function(m) { return m.id === s.mode; })[0] || {}).title ],
			[ _('Hostname'), s.hostname ],
			[ _('SSIDs'), s.ssid2g + ' / ' + s.ssid5g ],
			[ _('Wi-Fi security'), s.wifi_key ? 'WPA2-PSK' : _('Open') ],
			[ _('Admin password'), s.admin_pass ? _('will be changed') : _('unchanged') ],
			[ _('LAN'), s.lan_proto === 'dhcp' ? _('DHCP client') : s.lan_ip + ' / ' + s.lan_mask ]
		];
		if (s.mode === 'router') rows.push([ _('WAN'), s.wan_proto ]);
		if (s.mode === 'repeater') rows.push([ _('Upstream'), s.sta_ssid + ' (' + s.sta_type + ', ' + s.sta_band + ')' ]);
		if (s.mode === 'mesh') rows.push([ _('Mesh'), s.mesh_id + ' (' + s.mesh_radio + ', ' + s.mesh_role + ')' ]);
		if (s.mgmt_vlan && (s.mode === 'ap' || s.mode === 'mesh')) rows.push([ _('Management VLAN'), s.mgmt_vlan + ' → ' + s.mgmt_ip ]);

		return E('div', { 'class': 'cbi-section' }, [
			E('div', { 'class': 'cbi-section-descr' }, _('Network and Wi-Fi will restart. If the LAN address changes, reconnect to the new address.')),
			E('div', { 'class': 'table' }, rows.map(function(r) {
				return E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left', 'width': '35%', 'data-title': _('Setting') }, r[0]), E('div', { 'class': 'td left' }, r[1]) ]);
			}))
		]);
	},

	apply: function() {
		var self = this, s = this.s,
		    payload = JSON.stringify(s, function(k, v) { return (k === 'admin_pass' || k === 'admin_pass2') ? undefined : v; });

		ui.showModal(_('Applying configuration…'), [ E('p', { 'class': 'spinning' }, _('Writing settings')) ]);

		var pw = s.admin_pass ? callSetPassword('root', s.admin_pass) : Promise.resolve(true);

		pw.then(function(ok) {
			if (!ok) throw new Error(_('Failed to set the admin password.'));
			return fs.write('/tmp/alameer-qs.json', payload + '\n', 384);
		}).then(function() {
			return fs.exec('/usr/libexec/alameer/quicksetup-apply', []);
		}).then(function(res) {
			if (res.code !== 0)
				throw new Error((res.stderr || res.stdout || _('Unknown error')).trim());

			var ip = (s.lan_proto === 'static' ? s.lan_ip : null),
			    left = 25,
			    msg = E('p', {}, ''),
			    tick = function() {
				    msg.textContent = ip ? _('Settings applied. Reconnecting to %s in %d s…').format(ip, left) :
					    _('Settings applied. The router now gets its address by DHCP – look up its new IP on your gateway.');
				    if (ip && left-- <= 0) { window.location.href = 'http://' + ip + '/cgi-bin/luci/admin/quicksetup'; return; }
				    if (ip) window.setTimeout(tick, 1000);
			    };
			ui.showModal(_('Done'), [ E('div', { 'class': 'spinning' }), msg ]);
			tick();
		}).catch(function(err) {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Setup failed: %s').format(err.message || err)), 'danger');
		});
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
