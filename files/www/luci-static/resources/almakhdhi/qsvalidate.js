'use strict';
'require baseclass';

/*
 * AlMakhdhi SoftWare - pure helpers for the Quick Setup wizard.
 * No DOM / no RPC here, so everything in this file is unit-tested offline
 * (tests/test_qsvalidate.js).
 */

var IP_PART = /^(0|[1-9][0-9]{0,2})$/;

return baseclass.extend({
	parseIPv4: function(s) {
		if (typeof(s) !== 'string') return null;
		var p = s.trim().split('.');
		if (p.length !== 4) return null;
		var n = 0;
		for (var i = 0; i < 4; i++) {
			if (!IP_PART.test(p[i])) return null;
			var v = parseInt(p[i], 10);
			if (v > 255) return null;
			n = n * 256 + v;
		}
		return n;
	},

	formatIPv4: function(n) {
		return [ (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255 ].join('.');
	},

	maskToPrefix: function(mask) {
		var n = this.parseIPv4(mask);
		if (n === null) return null;
		var inv = (~n) >>> 0;
		if (((inv & (inv + 1)) >>> 0) !== 0) return null;   /* not contiguous */
		var bits = 0;
		while (inv > 0) { bits++; inv = Math.floor(inv / 2); }
		return 32 - bits;
	},

	prefixToMask: function(prefix) {
		prefix = parseInt(prefix, 10);
		if (isNaN(prefix) || prefix < 0 || prefix > 32) return '';
		var n = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0);
		return this.formatIPv4(n);
	},

	/* returns an object of error message keys; empty object = valid */
	validateLan: function(ip, mask, gw) {
		var err = {};
		var ipn = this.parseIPv4(ip), mn = this.parseIPv4(mask), pre;

		if (ipn === null) {
			err.ip = 'Enter a valid IPv4 address.';
		}
		else {
			var first = ipn >>> 24;
			if (first === 0 || first === 127 || first >= 224)
				err.ip = 'This address range cannot be used for the router.';
		}

		if (mn === null) {
			err.mask = 'Enter a valid subnet mask.';
		}
		else {
			pre = this.maskToPrefix(mask);
			if (pre === null)
				err.mask = 'The subnet mask is not valid (example: 255.255.255.0).';
			else if (pre < 8 || pre > 30)
				err.mask = 'The subnet prefix must be between /8 and /30.';
		}

		var net = null, bc = null;
		if (!err.ip && !err.mask) {
			net = (ipn & mn) >>> 0;
			bc = (net | ((~mn) >>> 0)) >>> 0;
			if (ipn === net)
				err.ip = 'The address cannot be the network address of the subnet.';
			else if (ipn === bc)
				err.ip = 'The address cannot be the broadcast address of the subnet.';
		}

		gw = (gw || '').trim();
		if (gw !== '') {
			var gn = this.parseIPv4(gw);
			if (gn === null)
				err.gateway = 'Enter a valid IPv4 address.';
			else if (net !== null) {
				if (((gn & mn) >>> 0) !== net)
					err.gateway = 'The gateway must be inside the same subnet as the router address.';
				else if (gn === ipn)
					err.gateway = 'The gateway cannot be the same as the router address.';
				else if (gn === net || gn === bc)
					err.gateway = 'The gateway cannot be the network or broadcast address.';
			}
		}
		return err;
	},

	utf8Length: function(s) {
		var len = 0;
		for (var i = 0; i < s.length; i++) {
			var c = s.charCodeAt(i);
			if (c < 0x80) len += 1;
			else if (c < 0x800) len += 2;
			else if (c >= 0xD800 && c <= 0xDBFF) { len += 4; i++; }
			else len += 3;
		}
		return len;
	},

	validateSSID: function(ssid) {
		if (typeof(ssid) !== 'string' || ssid.length === 0)
			return 'The network name (SSID) cannot be empty.';
		if (/[\u0000-\u001f\u007f]/.test(ssid))
			return 'The network name contains invalid characters.';
		if (this.utf8Length(ssid) > 32)
			return 'The network name must not exceed 32 bytes.';
		return null;
	},

	validateKey: function(key) {
		if (typeof(key) !== 'string') return 'Enter the Wi-Fi password.';
		if (/^[0-9a-fA-F]{64}$/.test(key)) return null;
		if (key.length < 8 || key.length > 63 || !/^[\x20-\x7e]+$/.test(key))
			return 'The password must be 8 to 63 printable ASCII characters.';
		return null;
	},

	bandOf: function(dev) {
		var b = String(dev.band || '').toLowerCase();
		if (b === '2g' || b === '5g') return b;
		if (dev.hwmode === '11a') return '5g';
		if (dev.hwmode === '11g' || dev.hwmode === '11b') return '2g';
		var ch = parseInt(dev.channel, 10);
		if (!isNaN(ch)) return ch > 14 ? '5g' : '2g';
		return null;
	},

	normalizeLan: function(ipaddr, netmask) {
		var ip = Array.isArray(ipaddr) ? ipaddr[0] : ipaddr;
		ip = String(ip || '');
		var mask = Array.isArray(netmask) ? netmask[0] : netmask;
		var m = ip.match(/^([^\/]+)\/([0-9]{1,2})$/);
		if (m) {
			ip = m[1];
			if (!mask) mask = this.prefixToMask(m[2]);
		}
		return { ip: ip, mask: mask || '' };
	},

	/*
	 * current: { lan: {ip, mask, gateway}, ifaces: [ {sid, mode, band, ssid, encryption, key} ] }
	 * input:   { ip, mask, gateway, ssid2g, ssid5g, security: 'none'|'psk2', key }
	 * returns: { ops: [...], changes: [ {label, from, to} ], lanChanged: bool }
	 * Only values that really differ produce an operation.
	 */
	buildPlan: function(current, input) {
		var ops = [], changes = [], self = this;
		var cur = current.lan || {};
		var gw = (input.gateway || '').trim();

		function setOpt(config, sid, opt, val, label, from, to) {
			ops.push({ op: 'set', config: config, sid: sid, opt: opt, val: val });
			if (label) changes.push({ label: label, from: from, to: to });
		}
		function unsetOpt(config, sid, opt, label, from, to) {
			ops.push({ op: 'unset', config: config, sid: sid, opt: opt });
			if (label) changes.push({ label: label, from: from, to: to });
		}

		var lanChanged = (cur.ip !== input.ip) || (cur.mask !== input.mask);
		if (lanChanged) {
			setOpt('network', 'lan', 'proto', 'static');
			setOpt('network', 'lan', 'ipaddr', input.ip, 'LAN IP address', cur.ip || '-', input.ip);
			setOpt('network', 'lan', 'netmask', input.mask, 'Subnet mask', cur.mask || '-', input.mask);
		}
		if ((cur.gateway || '') !== gw) {
			if (gw) setOpt('network', 'lan', 'gateway', gw, 'Gateway', cur.gateway || '-', gw);
			else unsetOpt('network', 'lan', 'gateway', 'Gateway', cur.gateway || '-', '-');
		}

		(current.ifaces || []).forEach(function(ifc) {
			if ((ifc.mode || 'ap') !== 'ap') return;
			var ssid = ifc.band === '2g' ? input.ssid2g : ifc.band === '5g' ? input.ssid5g : null;
			if (ssid == null) return;
			var band = ifc.band === '2g' ? '2.4 GHz' : '5 GHz';

			if (ifc.ssid !== ssid)
				setOpt('wireless', ifc.sid, 'ssid', ssid, 'Wi-Fi name ' + band, ifc.ssid || '-', ssid);

			var enc = ifc.encryption || 'none';
			if (input.security === 'none') {
				if (enc !== 'none') {
					setOpt('wireless', ifc.sid, 'encryption', 'none', 'Wi-Fi security ' + band, enc, 'none');
					if (ifc.key != null) unsetOpt('wireless', ifc.sid, 'key');
				}
			}
			else {
				var keepEnc = /^(psk|sae)/.test(enc);
				var newEnc = keepEnc ? enc : 'psk2';
				if (!keepEnc)
					setOpt('wireless', ifc.sid, 'encryption', newEnc, 'Wi-Fi security ' + band, enc, newEnc);
				if (input.key && input.key !== ifc.key)
					setOpt('wireless', ifc.sid, 'key', input.key, 'Wi-Fi password ' + band, '', '********');
			}
		});

		return { ops: ops, changes: changes, lanChanged: lanChanged };
	}
});
