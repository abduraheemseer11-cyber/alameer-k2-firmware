'use strict';
'require view';
'require form';
'require uci';
'require ui';

var MODES = [
	[ 'ap', _('Access Point') ],
	[ 'ap-wds', _('Access Point WDS') ],
	[ 'mesh', _('Mesh') ],
	[ 'client-wds', _('Client WDS') ]
];

function el(tag, attrs, children) {
	var node = E(tag, attrs || {});
	(children || []).forEach(function(child) { node.appendChild(child); });
	return node;
}

return view.extend({
	load: function() {
		return Promise.all([uci.load('wireless'), uci.load('network'), uci.load('dhcp')]);
	},

	render: function() {
		var self = this;
		var root = E('div', { 'class': 'alameer-quicksetup' });
		var state = {
			'2g': { device: 'radio0', mode: 'ap', base: 'AbduRaheem_2G', count: 1, upstream: '', key: '', meshid: 'Alameer-Mesh-2G', names: [] },
			'5g': { device: 'radio1', mode: 'ap', base: 'AbduRaheem_5G', count: 1, upstream: '', key: '', meshid: 'Alameer-Mesh-5G', names: [] }
		};

		function field(label, control, hint) {
			var wrap = E('div', { 'class': 'al-field' });
			wrap.appendChild(E('label', { 'class': 'al-label' }, [ label ]));
			wrap.appendChild(control);
			if (hint) wrap.appendChild(E('small', { 'class': 'al-hint' }, [ hint ]));
			return wrap;
		}

		function input(value, type, onChange) {
			var n = E('input', { 'class': 'al-input', 'type': type || 'text', 'value': value || '' });
			n.addEventListener('input', function(ev) { onChange(ev.target.value); });
			return n;
		}

		function select(options, value, onChange) {
			var n = E('select', { 'class': 'al-select' });
			options.forEach(function(opt) {
				var o = E('option', { 'value': opt[0] }, [ opt[1] ]);
				if (opt[0] === value) o.selected = true;
				n.appendChild(o);
			});
			n.addEventListener('change', function(ev) { onChange(ev.target.value); });
			return n;
		}

		function renderBand(key, title, subtitle) {
			var s = state[key];
			var card = E('section', { 'class': 'al-band-card' });
			card.appendChild(E('div', { 'class': 'al-band-head' }, [
				E('div', {}, [ E('h2', {}, [ title ]), E('p', {}, [ subtitle ]) ]),
				E('span', { 'class': 'al-band-pill' }, [ key === '2g' ? '2.4 GHz' : '5 GHz' ])
			]));

			card.appendChild(field(_('Mode'), select(MODES, s.mode, function(v) { s.mode = v; rerender(); })));

			if (s.mode === 'ap' || s.mode === 'ap-wds') {
				var baseNameInput = input(s.base, 'text', function(v) { s.base = v; updateNames(key); });
				baseNameInput.addEventListener('change', function() { rerender(); });
				card.appendChild(field(_('Base network name (SSID)'), baseNameInput, _('Additional SSIDs are generated as +2, +3, +4.')));
				card.appendChild(field(_('Number of broadcasts'), select([['1','1'],['2','2'],['3','3'],['4','4']], String(s.count), function(v) { s.count = Number(v); updateNames(key); rerender(); }), _('Maximum 4 virtual SSIDs per radio.')));
				var names = E('div', { 'class': 'al-ssid-list' });
				updateNames(key);
				s.names.slice(0, s.count).forEach(function(name, i) {
					names.appendChild(field(_('SSID ') + (i + 1), input(name, 'text', function(v) { s.names[i] = v; })));
				});
				card.appendChild(names);
			}
			else if (s.mode === 'mesh') {
				card.appendChild(field(_('Mesh ID'), input(s.meshid, 'text', function(v) { s.meshid = v; })));
				card.appendChild(field(_('Mesh security key (optional)'), input(s.key, 'password', function(v) { s.key = v; }), _('Mesh peers must use the same Mesh ID and security settings.')));
			}
			else {
				card.appendChild(field(_('Upstream Wi-Fi name'), input(s.upstream, 'text', function(v) { s.upstream = v; })));
				card.appendChild(field(_('Upstream Wi-Fi password'), input(s.key, 'password', function(v) { s.key = v; }), _('Leave empty only if the upstream network is open.')));
			}

			if (key === '2g') {
				card.appendChild(field(_('Channel'), E('input', { 'class': 'al-input', 'value': '6', 'disabled': 'disabled' })));
				card.appendChild(field(_('Channel width'), E('input', { 'class': 'al-input', 'value': '20 MHz', 'disabled': 'disabled' })));
				card.appendChild(field(_('Requested maximum TX power'), E('input', { 'class': 'al-input', 'value': '30 dBm', 'disabled': 'disabled' })));
			}
			else {
				card.appendChild(field(_('Channel'), E('input', { 'class': 'al-input', 'value': '36', 'disabled': 'disabled' })));
				card.appendChild(field(_('Channel width'), E('input', { 'class': 'al-input', 'value': '40 MHz', 'disabled': 'disabled' })));
				card.appendChild(field(_('Requested maximum TX power'), E('input', { 'class': 'al-input', 'value': '24 dBm', 'disabled': 'disabled' })));
			}
			return card;
		}

		function updateNames(key) {
			var s = state[key];
			var previous = s.names.slice();
			s.names = [];
			for (var i = 0; i < s.count; i++)
				s.names.push(previous[i] || (i === 0 ? s.base : s.base + '+' + (i + 1)));
		}

		function rerender() {
			while (root.firstChild) root.removeChild(root.firstChild);
			root.appendChild(E('div', { 'class': 'al-hero' }, [
				E('img', { 'src': '/luci-static/alameer/logo.png', 'alt': 'ALAMEER SOFTWARE' }),
				E('div', {}, [ E('h1', {}, [ _('Quick Setup') ]), E('p', {}, [ _('Configure both wireless bands independently.') ]) ])
			]));
			var grid = E('div', { 'class': 'al-band-grid' });
			grid.appendChild(renderBand('2g', _('2.4 GHz Wireless'), _('MT7620 radio')));
			grid.appendChild(renderBand('5g', _('5 GHz Wireless'), _('MT7612E radio')));
			root.appendChild(grid);
			var actions = E('div', { 'class': 'al-actions' });
			var reset = E('button', { 'class': 'al-btn al-btn-muted', 'type': 'button' }, [ _('Reset') ]);
			reset.addEventListener('click', function() {
				state['2g'] = { device: 'radio0', mode: 'ap', base: 'AbduRaheem_2G', count: 1, upstream: '', key: '', meshid: 'Alameer-Mesh-2G', names: [] };
				state['5g'] = { device: 'radio1', mode: 'ap', base: 'AbduRaheem_5G', count: 1, upstream: '', key: '', meshid: 'Alameer-Mesh-5G', names: [] };
				rerender();
			});
			var save = E('button', { 'class': 'al-btn al-btn-secondary', 'type': 'button' }, [ _('Save') ]);
			var apply = E('button', { 'class': 'al-btn al-btn-primary', 'type': 'button' }, [ _('Save & Apply') ]);
			save.addEventListener('click', function() { self.applyConfig(false); });
			apply.addEventListener('click', function() { self.applyConfig(true); });
			actions.appendChild(reset); actions.appendChild(save); actions.appendChild(apply);
			root.appendChild(actions);
		}

		this.state = state;
		this.renderRoot = root;
		rerender();
		return root;
	},

	applyConfig: function(applyNow) {
		var self = this;
		var state = this.state;
		var error = null;
		['2g', '5g'].forEach(function(key) {
			var s = state[key];
			if ((s.mode === 'ap' || s.mode === 'ap-wds') && (!s.names.length || s.names.some(function(n) { return !n || n.length > 32; }))) error = _('SSID must contain 1–32 characters.');
			if (s.mode === 'client-wds' && !s.upstream) error = _('Enter the upstream Wi-Fi name for Client WDS.');
			if (s.mode === 'mesh' && !s.meshid) error = _('Enter a Mesh ID.');
			if (s.key && s.key.length < 8 && s.mode !== 'ap' && s.mode !== 'ap-wds') error = _('Wireless keys must contain at least 8 characters.');
		});
		if (error) { ui.addNotification(null, E('p', {}, [ error ]), 'error'); return; }

		['2g', '5g'].forEach(function(key) {
			var s = state[key], device = s.device;
			uci.sections('wireless', 'wifi-iface').forEach(function(section) {
				if (section.device === device) uci.remove('wireless', section['.name']);
			});
			if (s.mode === 'ap' || s.mode === 'ap-wds') {
				s.names.slice(0, s.count).forEach(function(ssid, idx) {
					var name = uci.add('wireless', 'wifi-iface');
					uci.set('wireless', name, 'device', device);
					uci.set('wireless', name, 'mode', 'ap');
					uci.set('wireless', name, 'network', 'lan');
					uci.set('wireless', name, 'ssid', ssid);
					uci.set('wireless', name, 'encryption', 'none');
					uci.set('wireless', name, 'disabled', '0');
					if (s.mode === 'ap-wds') uci.set('wireless', name, 'wds', '1');
				});
			}
			else {
				var name = uci.add('wireless', 'wifi-iface');
				uci.set('wireless', name, 'device', device);
				uci.set('wireless', name, 'network', 'lan');
				uci.set('wireless', name, 'disabled', '0');
				if (s.mode === 'mesh') {
					uci.set('wireless', name, 'mode', 'mesh');
					uci.set('wireless', name, 'mesh_id', s.meshid);
					uci.set('wireless', name, 'mesh_fwding', '1');
					uci.set('wireless', name, 'encryption', s.key ? 'sae' : 'none');
					if (s.key) uci.set('wireless', name, 'key', s.key);
				}
				else {
					uci.set('wireless', name, 'mode', 'sta');
					uci.set('wireless', name, 'ssid', s.upstream);
					uci.set('wireless', name, 'wds', '1');
					uci.set('wireless', name, 'encryption', s.key ? 'psk2' : 'none');
					if (s.key) uci.set('wireless', name, 'key', s.key);
				}
			}
		});

		var task = uci.save();
		if (applyNow) task = task.then(function() { return uci.apply(90); });
		task.then(function() {
			ui.addNotification(null, E('p', {}, [ applyNow ? _('Wireless configuration applied. Reconnect using the new settings.') : _('Wireless configuration saved. Press Save & Apply to activate it.') ]), 'success');
		}).catch(function(e) {
			ui.addNotification(null, E('p', {}, [ _('Unable to update wireless settings: ') + (e.message || e) ]), 'error');
		});
	}
});
