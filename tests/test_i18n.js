'use strict';
/* Every user-visible string that the theme adds must have an Arabic translation. */
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = path.join(__dirname, '../files/www/luci-static/resources');
const load = (p, extra) => new Function('baseclass', 'document', '_', fs.readFileSync(path.join(R, p), 'utf8'));
const doc = lang => ({ documentElement: { getAttribute: () => lang } });
const T_ar = load('almakhdhi/i18n.js')({ extend: o => o }, doc('ar'), s => '[luci]' + s);
const T_en = load('almakhdhi/i18n.js')({ extend: o => o }, doc('en'), s => s);
const V = new Function('baseclass', fs.readFileSync(path.join(R, 'almakhdhi/qsvalidate.js'), 'utf8'))({ extend: o => o });

const IDENTICAL_OK = new Set([ 'AlMakhdhi SoftWare' ]);
const missing = [];
function check(key, where) {
	if (IDENTICAL_OK.has(key)) return;
	const tr = T_ar.t(key);
	if (tr === key) missing.push(key + '   (' + where + ')');
}

/* 1. literals passed to T.t / T.f / T.menu in the JS sources */
[ 'view/almakhdhi/dashboard.js', 'view/almakhdhi/quicksetup.js', 'menu-almakhdhi.js' ].forEach(f => {
	const s = fs.readFileSync(path.join(R, f), 'utf8');
	for (const m of s.matchAll(/T\.(?:t|f|menu)\(\s*'((?:[^'\\]|\\.)*)'/g)) check(m[1].replace(/\\'/g, "'"), f);
	/* table headers and stat labels are passed as plain strings and translated later */
	for (const m of s.matchAll(/\[\s*((?:'[^']+'\s*,\s*)+'[^']+')\s*\]/g)) {
		if (!/Radio|Interface/.test(m[1])) continue;
		for (const k of m[1].matchAll(/'([^']+)'/g)) check(k[1], f + ' (table head)');
	}
	for (const m of s.matchAll(/stat\('([^']+)'\)/g)) check(m[1], f + ' (stat label)');
});
/* 2. fixed strings used through helper functions */
[ 'Memory (RAM)', 'Storage (flash)', 'System load', 'Wi-Fi radios', 'Network interfaces', 'Connected', 'Not reachable', 'No default route', 'Unknown',
  'Welcome', 'LAN', 'Wireless', 'Review & apply', 'd', 'h', 'm', 'Clients', 'Status', 'Active', 'Off', 'Up', 'Down', 'Disabled', 'Channel', 'TX power', 'SSID', 'Band', 'Radio',
  'Protocol', 'IPv4 address', 'Load average', 'of', 'used', 'free' ].forEach(k => check(k, 'helper'));

/* 3. validator messages and plan labels */
const msgs = [];
[ V.validateLan('', '', 'x'), V.validateLan('127.0.0.1', '255.0.255.0', ''), V.validateLan('192.168.1.0', '255.255.255.255', ''),
  V.validateLan('192.168.1.20', '255.255.255.0', '10.0.0.1'), V.validateLan('192.168.1.20', '255.255.255.0', '192.168.1.20'),
  V.validateLan('192.168.1.20', '255.255.255.0', '192.168.1.255'), V.validateLan('192.168.1.255', '255.255.255.0', ''),
  V.validateLan('1.1.1.1', '255.255.255.254', ''), V.validateLan('192.168.1.20', '255.255.255.0', 'zz') ]
	.forEach(o => Object.values(o).forEach(v => msgs.push(v)));
[ V.validateSSID(''), V.validateSSID('a'.repeat(40)), V.validateSSID('x\ty'), V.validateKey('short'), V.validateKey(null) ].forEach(v => v && msgs.push(v));
msgs.forEach(m => check(m, 'validator'));

const plan = V.buildPlan({ lan: { ip: '1.1.1.2', mask: '255.0.0.0', gateway: '1.1.1.1' }, ifaces: [
	{ sid: 'a', mode: 'ap', band: '2g', ssid: 'x', encryption: 'psk2', key: 'k' }, { sid: 'b', mode: 'ap', band: '5g', ssid: 'y', encryption: 'none' } ] },
	{ ip: '192.168.1.20', mask: '255.255.255.0', gateway: '', ssid2g: 'n2', ssid5g: 'n5', security: 'psk2', key: 'longenough' });
plan.changes.forEach(c => check(c.label, 'plan label'));
const plan2 = V.buildPlan({ lan: { ip: '1.1.1.2', mask: '255.0.0.0', gateway: '' }, ifaces: [ { sid: 'a', mode: 'ap', band: '2g', ssid: 'x', encryption: 'psk2', key: 'k' } ] },
	{ ip: '1.1.1.2', mask: '255.0.0.0', gateway: '', ssid2g: 'x', security: 'none', key: '' });
plan2.changes.forEach(c => check(c.label, 'plan label'));

/* 4. English passthrough and %s formatting */
assert.strictEqual(T_en.t('Dashboard'), 'Dashboard');
assert.strictEqual(T_ar.t('Dashboard'), 'لوحة المعلومات');
assert.strictEqual(T_ar.f('Failed to apply settings: %s', 'x'), 'فشل تطبيق الإعدادات: x');
assert.strictEqual(T_en.f('Failed to apply settings: %s', 'x'), 'Failed to apply settings: x');
assert.strictEqual(T_ar.f('Warning: the router address changes from %s to %s. The connection will drop for a moment. Afterwards open http://%s/ - DHCP is disabled, so your computer may need a fixed address in the same subnet.', 'A', 'B', 'B').includes('http://B/'), true);
assert.strictEqual(T_ar.isRTL(), true); assert.strictEqual(T_en.isRTL(), false);
assert.strictEqual(T_ar.menu('Dashboard'), 'لوحة المعلومات');
assert.strictEqual(T_ar.menu('Status'), 'الحالة');            /* own dictionary ('Status' is defined) */
assert.strictEqual(T_ar.menu('Network'), '[luci]Network');    /* falls back to the official catalog */

if (missing.length) { console.error('Missing Arabic translations:\n  ' + [ ...new Set(missing) ].join('\n  ')); process.exit(1); }
console.log('all theme strings have Arabic translations');
