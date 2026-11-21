'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '../files/www/luci-static/resources/almakhdhi/qsvalidate.js'), 'utf8');
const V = new Function('baseclass', src)({ extend: o => o });

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }

t('parseIPv4 accepts/rejects', () => {
	assert.strictEqual(V.parseIPv4('192.168.1.20'), 3232235796);
	['', '1.2.3', '1.2.3.4.5', '256.1.1.1', '01.2.3.4', '1.2.3.-4', 'a.b.c.d', '1.2.3.4 5'].forEach(s => assert.strictEqual(V.parseIPv4(s), null, s));
	assert.strictEqual(V.parseIPv4(null), null);
});
t('maskToPrefix', () => {
	assert.strictEqual(V.maskToPrefix('255.255.255.0'), 24);
	assert.strictEqual(V.maskToPrefix('255.255.0.0'), 16);
	assert.strictEqual(V.maskToPrefix('255.255.255.252'), 30);
	assert.strictEqual(V.maskToPrefix('255.0.255.0'), null);
	assert.strictEqual(V.maskToPrefix('0.0.0.0'), 0);
	assert.strictEqual(V.maskToPrefix('255.255.255.255'), 32);
});
t('prefixToMask', () => {
	assert.strictEqual(V.prefixToMask(24), '255.255.255.0');
	assert.strictEqual(V.prefixToMask('16'), '255.255.0.0');
	assert.strictEqual(V.prefixToMask(0), '0.0.0.0');
	assert.strictEqual(V.prefixToMask(33), '');
});
t('validateLan valid project defaults', () => {
	assert.deepStrictEqual(V.validateLan('192.168.1.20', '255.255.255.0', ''), {});
	assert.deepStrictEqual(V.validateLan('192.168.1.20', '255.255.255.0', '192.168.1.1'), {});
	assert.deepStrictEqual(V.validateLan('10.0.0.5', '255.255.0.0', ' 10.0.0.1 '), {});
});
t('validateLan rejects bad input', () => {
	assert.ok(V.validateLan('', '255.255.255.0', '').ip);
	assert.ok(V.validateLan('127.0.0.1', '255.255.255.0', '').ip);
	assert.ok(V.validateLan('224.0.0.1', '255.255.255.0', '').ip);
	assert.ok(V.validateLan('0.1.2.3', '255.255.255.0', '').ip);
	assert.ok(V.validateLan('192.168.1.0', '255.255.255.0', '').ip);      /* network */
	assert.ok(V.validateLan('192.168.1.255', '255.255.255.0', '').ip);    /* broadcast */
	assert.ok(V.validateLan('192.168.1.20', '255.0.255.0', '').mask);
	assert.ok(V.validateLan('192.168.1.20', '255.255.255.255', '').mask);
	assert.ok(V.validateLan('192.168.1.20', '128.0.0.0', '').mask);
	assert.ok(V.validateLan('192.168.1.20', 'abc', '').mask);
	assert.ok(V.validateLan('192.168.1.20', '255.255.255.0', '192.168.2.1').gateway);  /* other subnet */
	assert.ok(V.validateLan('192.168.1.20', '255.255.255.0', '192.168.1.20').gateway); /* same as router */
	assert.ok(V.validateLan('192.168.1.20', '255.255.255.0', '192.168.1.255').gateway);
	assert.ok(V.validateLan('192.168.1.20', '255.255.255.0', 'x').gateway);
});
t('SSID validation', () => {
	assert.strictEqual(V.validateSSID('AbduRaheem_2G'), null);
	assert.strictEqual(V.validateSSID('ABDURAHEEM_5G'), null);
	assert.strictEqual(V.validateSSID('شبكة الأمير'), null);
	assert.ok(V.validateSSID(''));
	assert.ok(V.validateSSID('a'.repeat(33)));
	assert.strictEqual(V.validateSSID('a'.repeat(32)), null);
	assert.ok(V.validateSSID('ا'.repeat(17)));                 /* 17 x 2 bytes = 34 */
	assert.strictEqual(V.validateSSID('ا'.repeat(16)), null);  /* 32 bytes */
	assert.ok(V.validateSSID('bad\nname'));
});
t('Wi-Fi key validation', () => {
	assert.strictEqual(V.validateKey('12345678'), null);
	assert.strictEqual(V.validateKey('a'.repeat(63)), null);
	assert.strictEqual(V.validateKey('f'.repeat(64)), null);
	assert.ok(V.validateKey('1234567'));
	assert.ok(V.validateKey('g'.repeat(64)));   /* 64 chars but not hex */
	assert.ok(V.validateKey('كلمةمرورطويلة'));
});
t('bandOf', () => {
	assert.strictEqual(V.bandOf({ band: '2g' }), '2g');
	assert.strictEqual(V.bandOf({ band: '5g' }), '5g');
	assert.strictEqual(V.bandOf({ hwmode: '11a' }), '5g');
	assert.strictEqual(V.bandOf({ hwmode: '11g' }), '2g');
	assert.strictEqual(V.bandOf({ channel: '36' }), '5g');
	assert.strictEqual(V.bandOf({ channel: '6' }), '2g');
	assert.strictEqual(V.bandOf({ channel: 'auto' }), null);
});
t('normalizeLan', () => {
	assert.deepStrictEqual(V.normalizeLan('192.168.1.20', '255.255.255.0'), { ip: '192.168.1.20', mask: '255.255.255.0' });
	assert.deepStrictEqual(V.normalizeLan('192.168.1.1/24', undefined), { ip: '192.168.1.1', mask: '255.255.255.0' });
	assert.deepStrictEqual(V.normalizeLan([ '10.0.0.2/16', '10.0.0.3/16' ], undefined), { ip: '10.0.0.2', mask: '255.255.0.0' });
	assert.deepStrictEqual(V.normalizeLan(undefined, undefined), { ip: '', mask: '' });
});

const base = () => ({
	lan: { ip: '192.168.1.20', mask: '255.255.255.0', gateway: '' },
	ifaces: [
		{ sid: 'default_radio0', mode: 'ap', band: '2g', ssid: 'AbduRaheem_2G', encryption: 'none' },
		{ sid: 'default_radio1', mode: 'ap', band: '5g', ssid: 'ABDURAHEEM_5G', encryption: 'none' }
	]
});
const same = () => ({ ip: '192.168.1.20', mask: '255.255.255.0', gateway: '', ssid2g: 'AbduRaheem_2G', ssid5g: 'ABDURAHEEM_5G', security: 'none', key: '' });

t('plan: no change -> no operations', () => {
	const p = V.buildPlan(base(), same());
	assert.strictEqual(p.ops.length, 0); assert.strictEqual(p.lanChanged, false);
});
t('plan: LAN change sets static ipaddr/netmask/gateway', () => {
	const i = same(); i.ip = '192.168.50.2'; i.gateway = '192.168.50.1';
	const p = V.buildPlan(base(), i);
	assert.strictEqual(p.lanChanged, true);
	const o = p.ops.map(x => `${x.op}:${x.config}.${x.sid}.${x.opt}=${x.val}`);
	assert.ok(o.includes('set:network.lan.proto=static'));
	assert.ok(o.includes('set:network.lan.ipaddr=192.168.50.2'));
	assert.ok(o.includes('set:network.lan.netmask=255.255.255.0'));
	assert.ok(o.includes('set:network.lan.gateway=192.168.50.1'));
});
t('plan: clearing the gateway unsets it', () => {
	const b = base(); b.lan.gateway = '192.168.1.1';
	const p = V.buildPlan(b, same());
	assert.deepStrictEqual(p.ops, [ { op: 'unset', config: 'network', sid: 'lan', opt: 'gateway' } ]);
});
t('plan: SSIDs per band', () => {
	const i = same(); i.ssid2g = 'New_2G'; i.ssid5g = 'New_5G';
	const p = V.buildPlan(base(), i);
	assert.deepStrictEqual(p.ops.map(x => x.sid + '.' + x.opt + '=' + x.val), [ 'default_radio0.ssid=New_2G', 'default_radio1.ssid=New_5G' ]);
});
t('plan: WPA2 password on both bands', () => {
	const i = same(); i.security = 'psk2'; i.key = 'secret1234';
	const p = V.buildPlan(base(), i);
	const o = p.ops.map(x => `${x.sid}.${x.opt}=${x.val}`);
	assert.ok(o.includes('default_radio0.encryption=psk2') && o.includes('default_radio0.key=secret1234'));
	assert.ok(o.includes('default_radio1.encryption=psk2') && o.includes('default_radio1.key=secret1234'));
	assert.ok(p.changes.every(c => c.to !== 'secret1234'), 'password must never appear in the review list');
});
t('plan: switching to open removes key', () => {
	const b = base(); b.ifaces.forEach(f => { f.encryption = 'psk2'; f.key = 'oldpass123'; });
	const p = V.buildPlan(b, same());
	assert.ok(p.ops.some(x => x.op === 'set' && x.opt === 'encryption' && x.val === 'none'));
	assert.ok(p.ops.some(x => x.op === 'unset' && x.opt === 'key'));
});
t('plan: keeps existing WPA3/mixed encryption, blank key keeps old key', () => {
	const b = base(); b.ifaces.forEach(f => { f.encryption = 'sae-mixed'; f.key = 'oldpass123'; });
	const i = same(); i.security = 'psk2'; i.key = '';
	assert.strictEqual(V.buildPlan(b, i).ops.length, 0);
	i.key = 'newpass123';
	const p = V.buildPlan(b, i);
	assert.ok(p.ops.every(x => x.opt === 'key'));
});
t('plan: client-mode interfaces are never touched', () => {
	const b = base(); b.ifaces.push({ sid: 'sta0', mode: 'sta', band: '2g', ssid: 'Uplink', encryption: 'psk2', key: 'x' });
	const i = same(); i.ssid2g = 'Other';
	assert.ok(V.buildPlan(b, i).ops.every(x => x.sid !== 'sta0'));
});
t('plan: single-band device (no 5 GHz) works', () => {
	const b = base(); b.ifaces = [ b.ifaces[0] ];
	const i = same(); i.ssid5g = null; i.ssid2g = 'Only2G';
	const p = V.buildPlan(b, i);
	assert.deepStrictEqual(p.ops.map(x => x.sid), [ 'default_radio0' ]);
});

console.log(`\n${n} tests passed`);
