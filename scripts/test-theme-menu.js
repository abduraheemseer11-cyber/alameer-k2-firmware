// ALAMEER SOFTWARE - unit test for the sidebar model (pure function, no browser needed).
// Run: node scripts/test-theme-menu.js
'use strict';
const assert = require('assert');
const path = require('path');
const { buildModel } = require(path.join(__dirname, '..', 'packages', 'luci-theme-alameer', 'files', 'www', 'luci-static', 'alameer', 'alameer.js'));
const url = (p) => '/cgi-bin/luci/' + p.join('/');
const n = (title, order, children) => ({ title, order, children });

// Tree shaped like the LuCI 22.03 admin menu plus the ALAMEER entries
const tree = { children: { admin: { children: {
	status:  n('Status', 10, { overview: n('Overview', 1), routes: n('Routing', 3), syslog: n('System Log', 4), dmesg: n('Kernel Log', 5), alameer_x: n('ALAMEER Extra', 9) }),
	system:  n('System', 20, { system: n('System', 1), admin: n('Administration', 2), flash: n('Backup / Flash Firmware', 5), alameer_about: n('About ALAMEER', 99) }),
	network: n('Network', 30, { network: n('Interfaces', 1), wireless: n('Wireless', 2), dhcp: n('DHCP and DNS', 3), diagnostics: n('Diagnostics', 4) }),
	services: n('Services', 40, { lldpd: n('LLDP', 1) }),
	alameer: n('Quick Setup', 1),
	dashboard: n('Dashboard', 2),
	logout: n('Logout', 999),
	hidden: { children: { x: n('x', 1) } }      // untitled node must be ignored
} } } };

const m = buildModel(tree, url);
const ids = m.items.map(i => i.id);
assert.deepStrictEqual(ids, ['setup', 'dash', 'network', 'wireless', 'system', 'status', 'security', 'logs'], 'sidebar order/ids: ' + ids);
assert.strictEqual(m.items[0].badge, 'NEW', 'Quick Setup has NEW badge');
assert.strictEqual(m.items[0].url, '/cgi-bin/luci/admin/alameer', 'Quick Setup is top-level');
const by = (id) => m.items.find(i => i.id === id);
assert.ok(!by('network').children.some(c => c.label === 'Wireless'), 'Wireless excluded from Network group');
assert.strictEqual(by('wireless').url, '/cgi-bin/luci/admin/network/wireless');
assert.ok(!by('system').children.some(c => c.label === 'Administration'), 'Administration moved to Security');
assert.strictEqual(by('security').url, '/cgi-bin/luci/admin/system/admin');
assert.ok(!by('status').children.some(c => /Log/.test(c.label)), 'logs moved to System Logs');
assert.strictEqual(by('logs').url, '/cgi-bin/luci/admin/status/syslog', 'logs fall back to status/syslog');
assert.strictEqual(by('network').url, by('network').children[0].url, 'group url = first child');
assert.deepStrictEqual(m.more.map(x => x.label), ['Services'], 'unmapped top-level goes to More: ' + JSON.stringify(m.more.map(x => x.label)));
assert.strictEqual(m.logout, '/cgi-bin/luci/admin/logout');

// Missing nodes must be skipped, never crash (e.g. package not installed)
const t2 = { children: { admin: { children: { status: n('Status', 1, { overview: n('Overview', 1) }) } } } };
const m2 = buildModel(t2, url);
assert.deepStrictEqual(m2.items.map(i => i.id), ['status'], 'only available items are shown');
assert.strictEqual(m2.logout, null);
// Empty tree
assert.deepStrictEqual(buildModel({ children: {} }, url).items, []);
console.log('PASS  sidebar model (' + ids.join(' > ') + ')');
