'use strict';
'require view';
'require rpc';
'require uci';
'require ui';

var callWifiStatus = rpc.declare({ object: 'network.wireless', method: 'status', expect: { '': {} } });
var callCaps = rpc.declare({ object: 'alameer', method: 'capabilities' });

function ip2int(s) {
	var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s || '');
	if (!m) return null;
	var o = m.slice(1).map(Number);
	if (o.some(function(x) { return x > 255; })) return null;
	return ((o.at(0) * 16777216) + (o.at(1) << 16) + (o.at(2) << 8) + o.at(3)) >>> 0;
}

function validMask(s) {
	var n = ip2int(s);
	if (n === null || n === 0) return false;
	var inv = (~n) >>> 0;
	return (inv & (inv + 1)) === 0;
}

var MODES = [
	{ id: 'pppoe', t: 'PPPoE Dial-up', c: 'mode-pppoe', color: '#ef4444', icon: '☁️', desc: 'Standard PPPoE Router mode with NAT and DHCP server.' },
	{ id: 'ap', t: 'Access Point', c: 'mode-ap', color: '#22c55e', icon: '📡', desc: 'Standard Access Point mode with VLAN support.' },
	{ id: 'wds', t: 'WDS Bridge', c: 'mode-wds', color: '#3b82f6', icon: '⇄', desc: 'Wireless WDS Repeater / Bridge mode extending an upstream AP.' },
	{ id: 'mesh', t: 'MESH System', c: 'mode-mesh', color: '#a855f7', icon: '◎', desc: '802.11s MESH node mode for multi-hop wireless roaming.' }
];

var CH_2G = [
	['auto', 'Auto'],
	['1', '1 (2412 MHz)'], ['2', '2 (2417 MHz)'], ['3', '3 (2422 MHz)'],
	['4', '4 (2427 MHz)'], ['5', '5 (2432 MHz)'], ['6', '6 (2437 MHz)'],
	['7', '7 (2442 MHz)'], ['8', '8 (2447 MHz)'], ['9', '9 (2452 MHz)'],
	['10', '10 (2457 MHz)'], ['11', '11 (2462 MHz)'], ['12', '12 (2467 MHz)'],
	['13', '13 (2472 MHz)']
];

var CH_5G = [
	['auto', 'Auto'],
	['36', '36 (5180 MHz)'], ['40', '40 (5200 MHz)'], ['44', '44 (5220 MHz)'], ['48', '48 (5240 MHz)'],
	['52', '52 (5260 MHz)'], ['56', '56 (5280 MHz)'], ['60', '60 (5300 MHz)'], ['64', '64 (5320 MHz)'],
	['100', '100 (5500 MHz)'], ['104', '104 (5520 MHz)'], ['108', '108 (5540 MHz)'], ['112', '112 (5560 MHz)'],
	['116', '116 (5580 MHz)'], ['120', '120 (5600 MHz)'], ['124', '124 (5620 MHz)'], ['128', '128 (5640 MHz)'],
	['132', '132 (5660 MHz)'], ['136', '136 (5680 MHz)'], ['140', '140 (5700 MHz)'],
	['149', '149 (5745 MHz)'], ['153', '153 (5765 MHz)'], ['157', '157 (5785 MHz)'], ['161', '161 (5805 MHz)'], ['165', '165 (5825 MHz)']
];

return view.extend({
	load: function() {
		return Promise.all([
			uci.load([ 'network', 'wireless', 'dhcp', 'alameer' ]),
			callWifiStatus().catch(function() { return {}; }),
			callCaps().catch(function() { return {}; })
		]);
	},

	render: function(d) {
		var self = this;
		this.caps = d.at(2) || {};
		this.mode = uci.get('alameer', 'main', 'mode') || 'ap';
		this.activeTab = 'mode';

		var g = function(c, s, o, def) {
			var v = uci.get(c, s, o);
			return v == null ? def : v;
		};
		var inp = function(type, val, ph) {
			return E('input', { type: type, value: val == null ? '' : val, placeholder: ph || '' });
		};
		var sel = function(opts, cur) {
			return E('select', {}, opts.map(function(o) {
				return E('option', {
					value: o.at(0),
					selected: String(o.at(0)) === String(cur) ? 'selected' : null
				}, o.at(1));
			}));
		};

		var F = this.f = {};

		// Operation Mode Select (synced with cards)
		F.op_mode = sel(MODES.map(function(m) { return [m.id, m.t]; }), this.mode);

		// LAN / IPv4 Settings (preserves current IP)
		F.ip = inp('text', g('network', 'lan', 'ipaddr', '192.168.1.20'));
		F.mask = inp('text', g('network', 'lan', 'netmask', '255.255.255.0'));

		// PPPoE Settings
		F.pppoe_user = inp('text', g('network', 'wan', 'username', ''), 'PPPoE Username');
		F.pppoe_pass = inp('password', g('network', 'wan', 'password', ''), 'PPPoE Password');

		// Wireless Settings
		F.ssid2 = inp('text', g('wireless', 'alameer_2g', 'ssid', 'AbduRaheem_2G'), '2.4GHz SSID');
		F.ssid5 = inp('text', g('wireless', 'alameer_5g', 'ssid', 'AbduRaheem_5G'), '5GHz SSID');
		F.ch2 = sel(CH_2G, g('wireless', 'radio0', 'channel', '6'));
		F.ch5 = sel(CH_5G, g('wireless', 'radio1', 'channel', '36'));

		// MORE GUEST.SSID
		var existingGuests = 0;
		for (var idx = 1; idx <= 3; idx++) {
			if (uci.get('wireless', 'alameer_guest2_' + idx)) existingGuests = idx;
		}
		F.guest_count = sel([
			['0', 'None - 0'],
			['1', '1 Guest Network (+2.4G & 5G)'],
			['2', '2 Guest Networks (+2.4G & 5G)'],
			['3', '3 Guest Networks (+2.4G & 5G)']
		], String(existingGuests));

		this.guestBox = E('div', { style: 'margin-top:10px;' });
		F.guest_inputs = [];
		for (var i = 1; i <= 3; i++) {
			var g2 = inp('text', g('wireless', 'alameer_guest2_' + i, 'ssid', 'Guest_' + i + '_2G'), 'Guest ' + i + ' (2.4GHz SSID)');
			var g5 = inp('text', g('wireless', 'alameer_guest5_' + i, 'ssid', 'Guest_' + i + '_5G'), 'Guest ' + i + ' (5GHz SSID)');
			var row = E('div', { 'class': 'am-row' + (i > existingGuests ? ' am-hide' : '') }, [
				E('label', 'Guest SSID #' + i), g2, g5
			]);
			F.guest_inputs.push({ row: row, s2: g2, s5: g5 });
			this.guestBox.appendChild(row);
		}
		F.guest_count.addEventListener('change', function() {
			var cnt = parseInt(F.guest_count.value, 10) || 0;
			F.guest_inputs.forEach(function(item, k) {
				item.row.classList.toggle('am-hide', (k + 1) > cnt);
			});
		});

		// Add VLAN (Creates 802.1q br-lan.VID -> Bridge br-vlanVID -> Unmanaged interface vlanVID -> Assigns Wi-Fi network)
		var savedVlanId = g('alameer', 'main', 'vlan_id', '');
		if (!savedVlanId) {
			var net2g = g('wireless', 'alameer_2g', 'network', 'lan');
			var mVlan = /^vlan(\d+)$/.exec(net2g);
			if (mVlan) savedVlanId = mVlan.at(1);
		}
		F.vlan = E('input', { type: 'checkbox', checked: savedVlanId ? 'checked' : null });
		F.vlan_id = inp('number', savedVlanId, 'VLAN ID (e.g. 55)');
		F.vlan_id.classList.toggle('am-hide', !savedVlanId);
		F.vlan.addEventListener('change', function() {
			F.vlan_id.classList.toggle('am-hide', !F.vlan.checked);
		});

		// Wifi-Password Protection
		F.key = inp('password', g('wireless', 'alameer_2g', 'key', ''), 'Leave empty = Open Network');

		// WDS & Mesh Settings
		F.wds_ssid = inp('text', g('wireless', 'alameer_sta', 'ssid', ''), 'Target Uplink SSID');
		F.wds_key = inp('password', g('wireless', 'alameer_sta', 'key', ''), 'Target Uplink Password');
		F.meshid = inp('text', g('wireless', 'alameer_mesh', 'mesh_id', 'AlMakhdhi-Mesh'), 'Mesh ID');
		F.meshkey = inp('password', g('wireless', 'alameer_mesh', 'key', ''), 'Leave empty = Open; else SAE');

		// Status Display Elements
		this.statusIcon = E('div', { 'class': 'qs-status-badge' });
		this.statusTitle = E('h3', { style: 'margin:0 0 4px;' });
		this.statusDesc = E('small');

		this.modeSelectorCard = E('div', { 'class': 'am-card' });
		var cards = MODES.map(function(m) {
			var card = E('div', {
				'class': 'mode-card ' + m.c + (m.id === self.mode ? ' selected' : ''),
				'click': function() { self.selectMode(m.id); }
			}, [ E('i', {}, m.icon), E('span', {}, m.t) ]);
			return card;
		});
		this.modeCards = cards;
		this.modeSelectorCard.appendChild(E('h3', { style: 'text-align:center;' }, 'Select Operation Mode'));
		this.modeSelectorCard.appendChild(E('p', { style: 'text-align:center;color:var(--amuted);margin-top:0;' }, 'Choose the wireless operation mode for your device:'));
		this.modeSelectorCard.appendChild(E('div', { 'class': 'mode-grid' }, cards));

		F.op_mode.addEventListener('change', function() { self.selectMode(F.op_mode.value); });

		// Tab Navigation
		var tabs = [
			{ id: 'mode', label: 'Current Mode' },
			{ id: 'wan', label: 'WAN / LAN Settings' },
			{ id: 'wireless', label: 'Wireless' }
		];
		this.tabBtns = {};
		var tabBar = E('div', { 'class': 'qs-tabs' }, tabs.map(function(tb) {
			var b = E('button', {
				'type': 'button',
				'class': 'qs-tab' + (tb.id === 'mode' ? ' active' : ''),
				'click': function() { self.switchTab(tb.id); }
			}, tb.label);
			self.tabBtns[tb.id] = b;
			return b;
		}));

		// Tab Panels
		this.panels = {
			mode: E('div', { 'class': 'am-card' }, [
				E('h3', 'Current Mode Status'),
				E('div', { 'class': 'qs-status-box' }, [
					E('div', { 'class': 'qs-status-info' }, [
						this.statusIcon,
						E('div', {}, [ this.statusTitle, this.statusDesc ])
					]),
					E('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;' }, [
						E('button', {
							'type': 'button',
							'class': 'btn qs-btn-green',
							'click': function() { self.switchTab('wireless'); }
						}, '⚙ Go to Wireless Settings'),
						E('button', {
							'type': 'button',
							'class': 'btn qs-btn-orange',
							'click': function() { self.modeSelectorCard.scrollIntoView({ behavior: 'smooth' }); }
						}, '↻ Change Mode')
					])
				]),
				E('div', { 'class': 'am-row', style: 'margin-top:16px;' }, [
					E('label', 'Operation Mode'), F.op_mode
				])
			]),

			wan: E('div', { 'class': 'am-card am-hide' }, [
				E('h3', 'Network & IPv4 Configuration'),
				E('div', { 'class': 'am-row' }, [ E('label', 'IPv4 address'), F.ip ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'IPv4 netmask'), F.mask ]),
				this.pppoeBox = E('div', { 'class': this.mode === 'pppoe' ? '' : 'am-hide' }, [
					E('hr'),
					E('h3', 'PPPoE Dial-up Credentials'),
					E('div', { 'class': 'am-row' }, [ E('label', 'PPPoE Username'), F.pppoe_user ]),
					E('div', { 'class': 'am-row' }, [ E('label', 'PPPoE Password'), F.pppoe_pass ])
				])
			]),

			wireless: E('div', { 'class': 'am-card am-hide' }, [
				E('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;' }, [
					E('h3', { style: 'margin:0;' }, 'Wireless & Broadcast Settings'),
					E('button', {
						'type': 'button',
						'class': 'btn qs-btn-orange',
						'click': function() { self.switchTab('mode'); }
					}, '↻ Change Mode')
				]),
				E('div', { 'class': 'am-row' }, [ E('label', 'SSID (2.4GHz)'), F.ssid2 ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'SSID (5GHz - AC)'), F.ssid5 ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'Channel-2GHz'), F.ch2 ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'Channel-5GHz'), F.ch5 ]),
				E('hr'),
				E('div', { 'class': 'am-row' }, [ E('label', 'MORE GUEST.SSID'), F.guest_count ]),
				E('small', { style: 'display:block;margin-bottom:8px;' }, 'Additional broadcast points will be created on the 2.4 GHz and 5GHz frequencies. They will use the same main network password if set, but with separate names.'),
				this.guestBox,
				E('hr'),
				E('div', { 'class': 'am-row' }, [ E('label', 'Add VLAN'), F.vlan, F.vlan_id ]),
				E('div', { 'class': 'am-row' }, [ E('label', 'Wifi-Password Protection'), F.key ]),
				this.wdsBox = E('div', { 'class': this.mode === 'wds' ? '' : 'am-hide' }, [
					E('hr'),
					E('h3', 'WDS Bridge Uplink'),
					E('div', { 'class': 'am-row' }, [ E('label', 'Target SSID'), F.wds_ssid ]),
					E('div', { 'class': 'am-row' }, [ E('label', 'Target Password'), F.wds_key ])
				]),
				this.meshBox = E('div', { 'class': this.mode === 'mesh' ? '' : 'am-hide' }, [
					E('hr'),
					E('h3', 'MESH System Settings'),
					E('div', { 'class': 'am-row' }, [ E('label', 'Mesh ID'), F.meshid ]),
					E('div', { 'class': 'am-row' }, [ E('label', 'Mesh Password (SAE)'), F.meshkey ])
				])
			])
		};

		this.selectMode(this.mode);
		this.out = E('div');

		var btnApply = E('button', { 'class': 'btn cbi-button-save', 'click': function() { self.applyAll(true); } }, 'Save & Apply');
		var btnSave = E('button', { 'class': 'btn qs-btn-save', 'click': function() { self.applyAll(false); } }, 'Save');
		var btnReset = E('button', { 'class': 'btn qs-btn-orange', 'click': function() { window.location.reload(); } }, 'Reset');

		return E('div', { 'class': 'am-page' }, [
			E('h2', 'Quick Setup'),
			E('p', { style: 'color:var(--amuted);margin-top:-6px;' }, 'Configure your device settings based on the selected mode.'),
			this.modeSelectorCard,
			tabBar,
			this.panels.mode,
			this.panels.wan,
			this.panels.wireless,
			this.out,
			E('div', { 'class': 'cbi-page-actions' }, [ btnApply, btnSave, btnReset ])
		]);
	},

	switchTab: function(id) {
		var self = this;
		this.activeTab = id;
		Object.keys(this.tabBtns).forEach(function(k) {
			self.tabBtns[k].classList.toggle('active', k === id);
			self.panels[k].classList.toggle('am-hide', k !== id);
		});
	},

	selectMode: function(id) {
		this.mode = id;
		this.f.op_mode.value = id;
		var info = MODES.filter(function(m) { return m.id === id; }).at(0) || MODES.at(1);
		this.modeCards.forEach(function(c, idx) {
			c.classList.toggle('selected', MODES.at(idx).id === id);
		});
		this.statusIcon.style.background = info.color;
		this.statusIcon.textContent = info.icon;
		this.statusTitle.textContent = info.t;
		this.statusDesc.textContent = info.desc;
		if (this.pppoeBox) this.pppoeBox.classList.toggle('am-hide', id !== 'pppoe');
		if (this.wdsBox) this.wdsBox.classList.toggle('am-hide', id !== 'wds');
		if (this.meshBox) this.meshBox.classList.toggle('am-hide', id !== 'mesh');
	},

	applyAll: function(apply) {
		var F = this.f, mode = this.mode;
		var v = function(k) { return (F[k].value || '').trim(); };

		if (ip2int(v('ip')) === null || !validMask(v('mask'))) {
			ui.addNotification(null, E('p', 'يرجى إدخال عنوان IPv4 وقناع شبكة صحيحين.'), 'danger');
			return;
		}

		var useVlan = F.vlan.checked && /^\d+$/.test(v('vlan_id'));
		var vid = useVlan ? v('vlan_id') : '';
		var wifiNet = useVlan ? ('vlan' + vid) : 'lan';

		if (F.vlan.checked && !useVlan) {
			ui.addNotification(null, E('p', 'يرجى إدخال رقم VLAN صحيح (أرقام فقط، مثل 55).'), 'danger');
			return;
		}

		var ops = [];
		var set = function(c, s, o, val, type) { ops.push({ t: 'set', c: c, s: s, o: o, v: val, stype: type || 'interface' }); };
		var unset = function(c, s, o) { ops.push({ t: 'unset', c: c, s: s, o: o }); };
		var del = function(c, s) { ops.push({ t: 'del', c: c, s: s }); };

		// Save current mode & VLAN state
		set('alameer', 'main', 'mode', mode, 'alameer');

		// Clean up previously created Quick Setup VLAN devices & interfaces
		var prevVid = uci.get('alameer', 'main', 'vlan_id');
		if (prevVid && prevVid !== vid) {
			del('network', 'alameer_vdev_' + prevVid);
			del('network', 'alameer_vbr_' + prevVid);
			del('network', 'vlan' + prevVid);
		}
		if (vid) {
			del('network', 'alameer_vdev_' + vid);
			del('network', 'alameer_vbr_' + vid);
			del('network', 'vlan' + vid);
		}

		// LAN Settings (keep br-lan clean on IPv4)
		set('network', 'lan', 'proto', 'static', 'interface');
		set('network', 'lan', 'ipaddr', v('ip'), 'interface');
		set('network', 'lan', 'netmask', v('mask'), 'interface');
		unset('network', 'lan', 'ifname');

		if (useVlan) {
			var rawVlanDev = 'br-lan.' + vid;
			var bridgeName = 'br-vlan' + vid;
			var ifaceName = 'vlan' + vid;

			// 1. Add device configuration: VLAN (802.1q) -> br-lan.<VID>
			set('network', 'alameer_vdev_' + vid, 'type', '8021q', 'device');
			set('network', 'alameer_vdev_' + vid, 'ifname', 'br-lan', 'device');
			set('network', 'alameer_vdev_' + vid, 'vid', vid, 'device');
			set('network', 'alameer_vdev_' + vid, 'name', rawVlanDev, 'device');

			// 2. Add device configuration: Bridge device -> br-vlan<VID>, Port: br-lan.<VID>, IPv6 disabled
			set('network', 'alameer_vbr_' + vid, 'type', 'bridge', 'device');
			set('network', 'alameer_vbr_' + vid, 'name', bridgeName, 'device');
			set('network', 'alameer_vbr_' + vid, 'ports', [rawVlanDev], 'device');
			set('network', 'alameer_vbr_' + vid, 'ipv6', '0', 'device');

			// 3. Add new interface: vlan<VID>, Protocol: Unmanaged (none), Device: br-vlan<VID>
			set('network', ifaceName, 'proto', 'none', 'interface');
			set('network', ifaceName, 'device', bridgeName, 'interface');
			set('network', ifaceName, 'auto', '1', 'interface');

			set('alameer', 'main', 'vlan_id', vid, 'alameer');
		} else {
			unset('alameer', 'main', 'vlan_id');
		}

		// Cleanup old dynamic interfaces & guest SSIDs
		['alameer_sta', 'alameer_mesh', 'wwan', 'bat0', 'alameer_guest2_1', 'alameer_guest5_1', 'alameer_guest2_2', 'alameer_guest5_2', 'alameer_guest2_3', 'alameer_guest5_3'].forEach(function(s) {
			del('network', s);
			del('wireless', s);
		});

		// Enforce 20dBm on both radios & 802.11ac (VHT80) on 5GHz
		set('wireless', 'radio0', 'disabled', '0', 'wifi-device');
		set('wireless', 'radio0', 'channel', v('ch2'), 'wifi-device');
		set('wireless', 'radio0', 'htmode', 'HT20', 'wifi-device');
		set('wireless', 'radio0', 'txpower', '20', 'wifi-device');

		set('wireless', 'radio1', 'disabled', '0', 'wifi-device');
		set('wireless', 'radio1', 'channel', v('ch5'), 'wifi-device');
		set('wireless', 'radio1', 'hwmode', '11a', 'wifi-device');
		set('wireless', 'radio1', 'htmode', 'VHT80', 'wifi-device');
		set('wireless', 'radio1', 'txpower', '20', 'wifi-device');

		var enc = F.key.value ? 'psk2' : 'none';

		// Primary 2.4GHz & 5GHz APs assigned to wifiNet ('vlan<VID>' if VLAN enabled, else 'lan')
		set('wireless', 'alameer_2g', 'device', 'radio0', 'wifi-iface');
		set('wireless', 'alameer_2g', 'mode', 'ap', 'wifi-iface');
		set('wireless', 'alameer_2g', 'network', wifiNet, 'wifi-iface');
		set('wireless', 'alameer_2g', 'ssid', v('ssid2'), 'wifi-iface');
		set('wireless', 'alameer_2g', 'encryption', enc, 'wifi-iface');
		if (F.key.value) set('wireless', 'alameer_2g', 'key', v('key'), 'wifi-iface');
		else unset('wireless', 'alameer_2g', 'key');

		set('wireless', 'alameer_5g', 'device', 'radio1', 'wifi-iface');
		set('wireless', 'alameer_5g', 'mode', 'ap', 'wifi-iface');
		set('wireless', 'alameer_5g', 'network', wifiNet, 'wifi-iface');
		set('wireless', 'alameer_5g', 'ssid', v('ssid5'), 'wifi-iface');
		set('wireless', 'alameer_5g', 'encryption', enc, 'wifi-iface');
		if (F.key.value) set('wireless', 'alameer_5g', 'key', v('key'), 'wifi-iface');
		else unset('wireless', 'alameer_5g', 'key');

		// MORE GUEST.SSID interfaces (2.4GHz + 5GHz)
		var gCount = parseInt(F.guest_count.value, 10) || 0;
		for (var gIdx = 1; gIdx <= gCount; gIdx++) {
			var item = F.guest_inputs.at(gIdx - 1);
			var gs2 = (item.s2.value || '').trim() || ('Guest_' + gIdx + '_2G');
			var gs5 = (item.s5.value || '').trim() || ('Guest_' + gIdx + '_5G');

			set('wireless', 'alameer_guest2_' + gIdx, 'device', 'radio0', 'wifi-iface');
			set('wireless', 'alameer_guest2_' + gIdx, 'mode', 'ap', 'wifi-iface');
			set('wireless', 'alameer_guest2_' + gIdx, 'network', wifiNet, 'wifi-iface');
			set('wireless', 'alameer_guest2_' + gIdx, 'ssid', gs2, 'wifi-iface');
			set('wireless', 'alameer_guest2_' + gIdx, 'encryption', enc, 'wifi-iface');
			if (F.key.value) set('wireless', 'alameer_guest2_' + gIdx, 'key', v('key'), 'wifi-iface');

			set('wireless', 'alameer_guest5_' + gIdx, 'device', 'radio1', 'wifi-iface');
			set('wireless', 'alameer_guest5_' + gIdx, 'mode', 'ap', 'wifi-iface');
			set('wireless', 'alameer_guest5_' + gIdx, 'network', wifiNet, 'wifi-iface');
			set('wireless', 'alameer_guest5_' + gIdx, 'ssid', gs5, 'wifi-iface');
			set('wireless', 'alameer_guest5_' + gIdx, 'encryption', enc, 'wifi-iface');
			if (F.key.value) set('wireless', 'alameer_guest5_' + gIdx, 'key', v('key'), 'wifi-iface');
		}

		// Mode-specific network settings
		if (mode === 'pppoe') {
			set('network', 'wan', 'proto', 'pppoe', 'interface');
			set('network', 'wan', 'username', v('pppoe_user'), 'interface');
			set('network', 'wan', 'password', v('pppoe_pass'), 'interface');
			set('dhcp', 'lan', 'ignore', '0', 'dhcp');
		} else if (mode === 'wds') {
			set('wireless', 'alameer_sta', 'device', 'radio0', 'wifi-iface');
			set('wireless', 'alameer_sta', 'mode', 'sta', 'wifi-iface');
			set('wireless', 'alameer_sta', 'wds', '1', 'wifi-iface');
			set('wireless', 'alameer_sta', 'network', 'wwan', 'wifi-iface');
			set('wireless', 'alameer_sta', 'ssid', v('wds_ssid'), 'wifi-iface');
			set('wireless', 'alameer_sta', 'encryption', F.wds_key.value ? 'psk2' : 'none', 'wifi-iface');
			if (F.wds_key.value) set('wireless', 'alameer_sta', 'key', v('wds_key'), 'wifi-iface');
			set('network', 'wwan', 'proto', 'dhcp', 'interface');
			set('dhcp', 'lan', 'ignore', '1', 'dhcp');
		} else if (mode === 'ap') {
			del('network', 'wan');
			set('dhcp', 'lan', 'ignore', '1', 'dhcp');
		} else if (mode === 'mesh') {
			set('wireless', 'alameer_mesh', 'device', 'radio0', 'wifi-iface');
			set('wireless', 'alameer_mesh', 'mode', 'mesh', 'wifi-iface');
			set('wireless', 'alameer_mesh', 'mesh_id', v('meshid'), 'wifi-iface');
			set('wireless', 'alameer_mesh', 'network', 'bat0_hardif', 'wifi-iface');
			set('wireless', 'alameer_mesh', 'encryption', F.meshkey.value ? 'sae' : 'none', 'wifi-iface');
			if (F.meshkey.value) set('wireless', 'alameer_mesh', 'key', v('meshkey'), 'wifi-iface');
			set('network', 'bat0', 'proto', 'batadv', 'interface');
			set('dhcp', 'lan', 'ignore', '1', 'dhcp');
		}

		ops.forEach(function(o) {
			if (o.t === 'del') {
				if (uci.get(o.c, o.s)) uci.remove(o.c, o.s);
			} else if (o.t === 'set') {
				if (!uci.get(o.c, o.s)) uci.add(o.c, o.stype, o.s);
				uci.set(o.c, o.s, o.o, o.v);
			} else if (o.t === 'unset') {
				if (uci.get(o.c, o.s)) uci.unset(o.c, o.s, o.o);
			}
		});

		uci.save().then(function() {
			if (apply) {
				return ui.changes.apply().then(function() {
					ui.addNotification(null, E('p', 'تم حفظ وتطبيق الإعدادات بنجاح!'), 'info');
				});
			} else {
				ui.addNotification(null, E('p', 'تم حفظ الإعدادات فقط.'), 'info');
			}
		}).catch(function(e) {
			ui.addNotification(null, E('p', 'حدث خطأ: ' + e), 'danger');
		});
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
