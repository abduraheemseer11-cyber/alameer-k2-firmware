'use strict';
'require view';
'require uci';
'require ui';
'require almakhdhi.i18n as T';
'require almakhdhi.qsvalidate as V';

/*
 * Quick Setup wizard. Reads the real configuration with the LuCI uci module,
 * validates the input (qsvalidate.js), stages the changes with uci.save() and
 * applies them with uci.apply() - the same mechanism "Save & Apply" uses.
 */

var STEPS = [ 'Welcome', 'LAN', 'Wireless', 'Review & apply' ];
var LOGO = '/luci-static/almakhdhi/logo.png';

function field(label, input, hint, error) {
	var kids = [ E('label', { 'class': 'amk-label' }, label), input ];
	if (hint) kids.push(E('div', { 'class': 'amk-hint' }, hint));
	var errNode = E('div', { 'class': 'amk-error', 'role': 'alert' }, error ? T.t(error) : '');
	kids.push(errNode);
	var wrap = E('div', { 'class': 'amk-field' + (error ? ' has-error' : '') }, kids);
	return wrap;
}

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function() {
		return uci.load([ 'network', 'wireless' ]);
	},

	readCurrent: function() {
		var lan = V.normalizeLan(uci.get('network', 'lan', 'ipaddr'), uci.get('network', 'lan', 'netmask'));
		lan.gateway = uci.get('network', 'lan', 'gateway') || '';

		var radios = {};
		uci.sections('wireless', 'wifi-device').forEach(function(s) {
			radios[s['.name']] = V.bandOf(s);
		});

		var ifaces = uci.sections('wireless', 'wifi-iface').map(function(s) {
			return {
				sid: s['.name'], device: s.device, mode: s.mode || 'ap', ssid: s.ssid,
				encryption: s.encryption || 'none', key: s.key, band: radios[s.device] || null
			};
		}).filter(function(i) { return i.mode === 'ap'; });

		var bands = {};
		Object.keys(radios).forEach(function(k) { if (radios[k]) bands[radios[k]] = true; });
		var withAp = {};
		ifaces.forEach(function(i) { if (i.band) withAp[i.band] = true; });
		var missingAp = Object.keys(bands).some(function(b) { return !withAp[b]; });

		return { lan: lan, ifaces: ifaces, bands: bands, withAp: withAp, missingAp: missingAp };
	},

	render: function() {
		this.cur = this.readCurrent();
		var c = this.cur;
		var first = function(band) { var i = c.ifaces.filter(function(x) { return x.band === band; })[0]; return i || null; };
		var f2 = first('2g'), f5 = first('5g'), any = f2 || f5;

		this.data = {
			ip: c.lan.ip, mask: c.lan.mask, gateway: c.lan.gateway,
			ssid2g: f2 ? (f2.ssid || '') : '', ssid5g: f5 ? (f5.ssid || '') : '',
			security: (any && any.encryption !== 'none') ? 'psk2' : 'none', key: ''
		};
		this.step = 0;
		this.errors = {};
		this.root = E('div', { 'class': 'amk-wizard' });
		this.draw();
		return this.root;
	},

	draw: function() {
		var self = this;
		var stepper = E('ol', { 'class': 'amk-steps' }, STEPS.map(function(n, i) {
			var cls = i === self.step ? 'current' : (i < self.step ? 'done' : '');
			return E('li', { 'class': cls }, [ E('span', { 'class': 'amk-step-no' }, String(i + 1)), E('span', { 'class': 'amk-step-name' }, T.t(n)) ]);
		}));

		var body;
		switch (this.step) {
		case 0: body = this.stepWelcome(); break;
		case 1: body = this.stepLan(); break;
		case 2: body = this.stepWireless(); break;
		default: body = this.stepReview();
		}

		this.root.textContent = '';
		this.root.appendChild(E('div', { 'class': 'amk-page-head' }, [ E('h2', {}, T.t('Quick Setup')) ]));
		this.root.appendChild(stepper);
		this.root.appendChild(E('div', { 'class': 'amk-card amk-panel' }, body));
	},

	buttons: function(next) {
		var self = this, kids = [];
		if (this.step > 0)
			kids.push(E('button', { 'class': 'cbi-button', 'type': 'button', 'click': function() { self.step--; self.errors = {}; self.draw(); } }, T.t('Back')));
		kids.push(next);
		return E('div', { 'class': 'amk-actions' }, kids);
	},

	input: function(key, attrs) {
		var self = this;
		var a = Object.assign({ 'type': 'text', 'class': 'cbi-input-text amk-ltr', 'value': this.data[key] || '', 'autocomplete': 'off',
			'input': function(ev) { self.data[key] = ev.target.value; } }, attrs || {});
		return E('input', a);
	},

	stepWelcome: function() {
		var self = this;
		return [
			E('div', { 'class': 'amk-welcome' }, [
				E('img', { 'class': 'amk-welcome-logo', 'src': LOGO, 'alt': 'ALAMEER SOFTWARE' }),
				E('h3', {}, T.t('Welcome to the Quick Setup')),
				E('p', { 'class': 'amk-muted' }, T.t('This wizard changes the router address and the Wi-Fi settings in a few simple steps. Settings are validated and applied with the standard OpenWrt UCI system.'))
			]),
			E('div', { 'class': 'amk-actions amk-center' }, [
				E('button', { 'class': 'cbi-button cbi-button-action important', 'type': 'button', 'click': function() { self.step = 1; self.draw(); } }, T.t('Start Setup'))
			])
		];
	},

	stepLan: function() {
		var self = this, e = this.errors;
		var next = E('button', { 'class': 'cbi-button cbi-button-action important', 'type': 'button', 'click': function() {
			var err = V.validateLan(self.data.ip, self.data.mask, self.data.gateway);
			self.errors = err;
			if (Object.keys(err).length) { self.draw(); return; }
			self.data.ip = self.data.ip.trim(); self.data.mask = self.data.mask.trim(); self.data.gateway = (self.data.gateway || '').trim();
			self.step = 2; self.draw();
		} }, T.t('Next'));
		return [
			E('h3', {}, T.t('LAN configuration')),
			field(T.t('Router IP address'), this.input('ip', { 'inputmode': 'decimal', 'placeholder': '192.168.1.20' }), null, e.ip),
			field(T.t('Subnet mask'), this.input('mask', { 'inputmode': 'decimal', 'placeholder': '255.255.255.0' }), null, e.mask),
			field(T.t('Gateway (optional)'), this.input('gateway', { 'inputmode': 'decimal', 'placeholder': '192.168.1.1' }), T.t('Leave empty if the router does not need a gateway.'), e.gateway),
			this.buttons(next)
		];
	},

	stepWireless: function() {
		var self = this, e = this.errors, c = this.cur, kids = [ E('h3', {}, T.t('Wireless configuration')) ];

		if (c.bands['2g'] && c.withAp['2g'])
			kids.push(field(T.t('Wi-Fi name 2.4 GHz'), this.input('ssid2g', { 'class': 'cbi-input-text', 'placeholder': 'AbduRaheem_2G', 'maxlength': '32' }), null, e.ssid2g));
		if (c.bands['5g'] && c.withAp['5g'])
			kids.push(field(T.t('Wi-Fi name 5 GHz'), this.input('ssid5g', { 'class': 'cbi-input-text', 'placeholder': 'AbduRaheem_5G', 'maxlength': '32' }), null, e.ssid5g));
		else if (!c.bands['5g'])
			kids.push(E('p', { 'class': 'amk-muted' }, T.t('No 5 GHz radio was found on this device.')));
		if (c.missingAp)
			kids.push(E('p', { 'class': 'amk-hint warn' }, T.t('No access point is defined on a radio. Create one under Network > Wireless.')));

		var sec = E('select', { 'class': 'cbi-input-select', 'change': function(ev) { self.data.security = ev.target.value; self.errors = {}; self.draw(); } }, [
			E('option', { 'value': 'none' }, T.t('Open network (no password)')),
			E('option', { 'value': 'psk2' }, T.t('WPA2 password'))
		]);
		sec.value = this.data.security;
		kids.push(field(T.t('Wi-Fi security'), sec));

		if (this.data.security === 'psk2') {
			var keyIn = this.input('key', { 'type': 'password', 'placeholder': '********', 'autocomplete': 'new-password' });
			var show = E('label', { 'class': 'amk-inline' }, [
				E('input', { 'type': 'checkbox', 'change': function(ev) { keyIn.type = ev.target.checked ? 'text' : 'password'; } }),
				' ', T.t('Show password')
			]);
			var hasKey = this.cur.ifaces.some(function(i) { return i.encryption !== 'none' && i.key; });
			kids.push(field(T.t('Wi-Fi password'), keyIn, hasKey ? T.t('Leave empty to keep the current password.') : null, e.key));
			kids.push(show);
		}

		var next = E('button', { 'class': 'cbi-button cbi-button-action important', 'type': 'button', 'click': function() { self.validateWireless(); } }, T.t('Next'));
		kids.push(this.buttons(next));
		return kids;
	},

	validateWireless: function() {
		var d = this.data, c = this.cur, err = {}, m;
		if (c.bands['2g'] && c.withAp['2g'] && (m = V.validateSSID(d.ssid2g))) err.ssid2g = m;
		if (c.bands['5g'] && c.withAp['5g'] && (m = V.validateSSID(d.ssid5g))) err.ssid5g = m;
		if (d.security === 'psk2') {
			var hasKey = c.ifaces.some(function(i) { return i.encryption !== 'none' && i.key; });
			if (d.key) { if ((m = V.validateKey(d.key))) err.key = m; }
			else if (!hasKey) err.key = 'Enter the Wi-Fi password.';
		}
		this.errors = err;
		if (!Object.keys(err).length) this.step = 3;
		this.draw();
	},

	getPlan: function() {
		var d = this.data;
		return V.buildPlan({ lan: this.cur.lan, ifaces: this.cur.ifaces }, {
			ip: d.ip, mask: d.mask, gateway: d.gateway,
			ssid2g: this.cur.withAp['2g'] ? d.ssid2g : null,
			ssid5g: this.cur.withAp['5g'] ? d.ssid5g : null,
			security: d.security, key: d.key
		});
	},

	stepReview: function() {
		var self = this, plan = this.getPlan(), d = this.data, kids = [ E('h3', {}, T.t('Review your settings')) ];

		if (!plan.changes.length && !plan.ops.length) {
			kids.push(E('p', { 'class': 'amk-muted' }, T.t('Nothing will be changed - all values are already applied.')));
			kids.push(this.buttons(E('span')));
			return kids;
		}

		var seen = {};
		var rows = plan.changes.filter(function(ch) { var k = ch.label + '|' + ch.to; if (seen[k]) return false; seen[k] = 1; return true; }).map(function(ch) {
			/* labels carry the band as suffix, e.g. "Wi-Fi name 2.4 GHz" */
			return E('tr', {}, [ E('td', {}, T.t(ch.label)), E('td', { 'class': 'amk-ltr' }, ch.from || '-'), E('td', { 'class': 'amk-ltr' }, ch.to || '-') ]);
		});
		kids.push(E('table', { 'class': 'amk-table' }, [
			E('thead', {}, E('tr', {}, [ E('th', {}, T.t('Setting')), E('th', {}, T.t('Current')), E('th', {}, T.t('New')) ])),
			E('tbody', {}, rows)
		]));

		if (plan.lanChanged)
			kids.push(E('div', { 'class': 'amk-alert warn' }, T.f('Warning: the router address changes from %s to %s. The connection will drop for a moment. Afterwards open http://%s/ - DHCP is disabled, so your computer may need a fixed address in the same subnet.', this.cur.lan.ip, d.ip, d.ip)));
		if (plan.changes.some(function(ch) { return /^Wi-Fi/.test(ch.label); }))
			kids.push(E('div', { 'class': 'amk-alert info' }, T.t('Wi-Fi clients will be disconnected briefly while the wireless network restarts.')));
		if (d.security === 'none' && this.cur.ifaces.length)
			kids.push(E('div', { 'class': 'amk-alert warn' }, T.t('The Wi-Fi network will be open: anyone in range can connect.')));

		var apply = E('button', { 'class': 'cbi-button cbi-button-apply important', 'type': 'button', 'click': function() { self.doApply(plan); } }, T.t('Apply Settings'));
		kids.push(this.buttons(apply));
		return kids;
	},

	doApply: function(plan) {
		var self = this;
		if (!plan.ops.length) return;

		ui.showModal(T.t('Applying settings…'), [ E('p', { 'class': 'spinning' }, T.t('Saving and applying the configuration. Please wait.')) ]);

		plan.ops.forEach(function(o) {
			if (o.op === 'set') uci.set(o.config, o.sid, o.opt, o.val);
			else uci.unset(o.config, o.sid, o.opt);
		});

		return uci.save().then(function() {
			return uci.apply();
		}).then(function() {
			self.applied(plan);
		}).catch(function(err) {
			/* when the LAN address changes the connection may drop before the reply arrives */
			if (plan.lanChanged) return self.applied(plan);
			ui.hideModal();
			ui.addNotification(null, E('p', T.f('Failed to apply settings: %s', (err && err.message) ? err.message : err)), 'danger');
		});
	},

	applied: function(plan) {
		var self = this;
		if (plan.lanChanged) {
			var url = window.location.protocol + '//' + this.data.ip + L.url('admin', 'quicksetup');
			var left = 12;
			var counter = E('p', {}, T.f('Reconnecting to the new address in %s seconds…', String(left)));
			ui.showModal(T.t('Router address changed'), [
				counter,
				E('p', { 'class': 'amk-ltr' }, E('a', { 'href': url }, url)),
				E('div', { 'class': 'right' }, E('a', { 'class': 'cbi-button cbi-button-action', 'href': url }, T.t('Open the new address now')))
			]);
			var timer = window.setInterval(function() {
				left--;
				counter.textContent = T.f('Reconnecting to the new address in %s seconds…', String(left));
				if (left <= 0) { window.clearInterval(timer); window.location.href = url; }
			}, 1000);
			return;
		}
		ui.showModal(T.t('Settings applied'), [
			E('p', {}, T.t('The new settings are active.')),
			E('div', { 'class': 'right' }, E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() {
				ui.hideModal();
				window.location.reload();
			} }, T.t('Close')))
		]);
	}
});
