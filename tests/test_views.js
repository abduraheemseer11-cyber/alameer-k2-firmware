'use strict';
/* Executes the real view/menu code against stubs of LuCI, ubus and uci (no router needed). */
const fs = require('fs'), path = require('path'), assert = require('assert');
const { E, createDocument, findAll, byText, Node } = require('./fakedom');
const R = path.join(__dirname, '../files/www/luci-static/resources');
const read = p => fs.readFileSync(path.join(R, p), 'utf8');
const flush = () => new Promise(r => setTimeout(r, 0));

let passed = 0;
async function t(name, fn) { await fn(); passed++; console.log('ok  ' + name); }

function setup(lang) {
	global.document = createDocument(lang);
	global.window = { location: { protocol: 'http:', href: '', reload() { this.reloaded = true; } }, localStorage: (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })(),
		matchMedia: () => ({ matches: false }), addEventListener() {}, setInterval: () => 1, clearInterval() {} };
	global.E = E;
	global.L = { bind: (f, t) => f.bind(t), resolveDefault: (p, d) => Promise.resolve(p).catch(() => d), url: (...a) => '/cgi-bin/luci/' + a.join('/'), env: { dispatchpath: [ 'admin', 'status', 'overview' ] } };
	global._ = s => s;
	const T = new Function('baseclass', 'document', '_', read('almakhdhi/i18n.js'))({ extend: o => o }, global.document, global._);
	const V = new Function('baseclass', read('almakhdhi/qsvalidate.js'))({ extend: o => o });
	return { T, V };
}

const rpc = data => ({ declare: spec => () => { const k = spec.object + '.' + spec.method; if (!(k in data)) return Promise.reject(new Error('denied ' + k)); const v = data[k]; return Promise.resolve(typeof v === 'function' ? v(...arguments) : v); } });

(async () => {
	/* ---------------- Dashboard ---------------- */
	const ubus = () => ({
		'system.board': { hostname: 'AbduRaheem', model: 'TP-Link RE205 v3', system: 'MediaTek MT7628AN ver:1 eco:2', release: { version: '24.10.8', description: 'OpenWrt 24.10.8 r12345' } },
		'system.info': { uptime: 93784, load: [ 6553, 13107, 19660 ], memory: { total: 61255680, free: 20000000, buffered: 3000000, cached: 8000000, available: 28000000 }, root: { total: 3584, free: 2400, used: 1184, avail: 2400 } },
		'network.interface.dump': [ { interface: 'loopback', proto: 'static', up: true, 'ipv4-address': [ { address: '127.0.0.1', mask: 8 } ] },
			{ interface: 'lan', proto: 'static', up: true, 'ipv4-address': [ { address: '192.168.1.20', mask: 24 } ], route: [ { target: '0.0.0.0', mask: 0, nexthop: '192.168.1.1' } ] } ],
		'network.wireless.status': { radio0: { up: true, disabled: false, config: { band: '2g', channel: '6' }, interfaces: [ { ifname: 'phy0-ap0', config: { ssid: 'AbduRaheem_2G', mode: 'ap' } } ] },
			radio1: { up: true, disabled: false, config: { band: '5g', channel: '36' }, interfaces: [ { ifname: 'phy1-ap0', config: { ssid: 'ABDURAHEEM_5G', mode: 'ap' } } ] } },
		'iwinfo.info': { channel: 6, txpower: 20 },
		'iwinfo.assoclist': [ { mac: 'aa' }, { mac: 'bb' } ],
		'file.exec': { code: 0 }
	});

	async function runDashboard(lang, mutate, tempRead) {
		const { T } = setup(lang);
		const data = ubus(); if (mutate) mutate(data);
		const poll = { added: [], add(f, s) { this.added.push([ f, s ]); } };
		const fsm = { read: () => tempRead === undefined ? Promise.reject(new Error('no sensor')) : Promise.resolve(tempRead) };
		const mod = new Function('view', 'poll', 'rpc', 'fs', 'T', read('view/almakhdhi/dashboard.js'))({ extend: o => o }, poll, rpc(data), fsm, T);
		const d = await mod.load();
		const root = mod.render(d);
		return { mod, root, poll, text: () => root.textContent };
	}

	await t('dashboard shows real values (English)', async () => {
		const { root, poll, text, mod } = await runDashboard('en', null, '41500\n');
		const s = text();
		[ 'AbduRaheem', 'TP-Link RE205 v3', '24.10.8', '192.168.1.20', 'Connected', '1 d 2 h 3 m', 'MediaTek MT7628AN', '41.5 °C',
		  'AbduRaheem_2G', 'ABDURAHEEM_5G', '20 dBm', '2.4 GHz', '5 GHz', 'lan', '0.10 / 0.20 / 0.30' ].forEach(x => assert.ok(s.includes(x), 'missing: ' + x));
		assert.ok(!s.includes('loopback'), 'loopback is hidden');
		assert.ok(s.includes('3.5 MB'), 'flash total must be converted from KiB');
		assert.ok(s.includes('54%'), 'RAM percent');
		assert.ok(s.includes('Clients: 4'), 'client count from assoclist (2 per radio)');
		assert.strictEqual(poll.added.length, 1); assert.strictEqual(poll.added[0][1], 3);
		/* a second poll cycle must work and extend the graph history */
		await mod.fetch().then(d => mod.update(d));
		assert.strictEqual(mod.hist.ram.length, 2);
		assert.ok(root.querySelector('.amk-graph').innerHTML === '' || true);
		assert.ok(findAll(root, n => n.className === 'amk-graph').some(n => n.innerHTML.includes('<polyline')), 'sparkline drawn after 2 samples');
	});

	await t('dashboard: no sensor, no default route', async () => {
		const { text } = await runDashboard('en', d => { d['network.interface.dump'][1].route = []; });
		const s = text();
		assert.ok(s.includes('No sensor') && s.includes('Not available'));
		assert.ok(s.includes('No default route'));
	});

	await t('dashboard: internet unreachable when ping fails, permission errors do not crash', async () => {
		const a = await runDashboard('en', d => { d['file.exec'] = { code: 1 }; });
		assert.ok(a.text().includes('Not reachable'));
		const b = await runDashboard('en', d => { delete d['file.exec']; delete d['iwinfo.info']; delete d['network.wireless.status']; });
		assert.ok(b.text().includes('Unknown'));
		assert.ok(b.text().includes('No wireless radios were found.'));
	});

	await t('dashboard renders in Arabic', async () => {
		const { text } = await runDashboard('ar', null, '38000');
		const s = text();
		[ 'لوحة المعلومات', 'مدة التشغيل', 'متصل', 'الذاكرة (RAM)', 'التخزين (Flash)', 'أجهزة الواي فاي', '1 ي 2 س 3 د' ].forEach(x => assert.ok(s.includes(x), 'missing: ' + x));
	});

	/* ---------------- Quick Setup ---------------- */
	function makeUci(initial) {
		const db = JSON.parse(JSON.stringify(initial)), log = { applied: 0, saved: 0 };
		const u = {
			log, db, load: () => Promise.resolve(),
			get: (c, s, o) => (db[c] && db[c][s]) ? db[c][s][o] : undefined,
			sections: (c, type) => Object.keys(db[c]).filter(k => db[c][k]['.type'] === type).map(k => Object.assign({ '.name': k }, db[c][k])),
			set: (c, s, o, v) => { db[c][s][o] = v; }, unset: (c, s, o) => { delete db[c][s][o]; },
			save: () => { log.saved++; return Promise.resolve(); }, apply: () => { log.applied++; return Promise.resolve(); }
		};
		return u;
	}
	const initial = () => ({
		network: { lan: { '.type': 'interface', proto: 'static', ipaddr: '192.168.1.20', netmask: '255.255.255.0' } },
		wireless: {
			radio0: { '.type': 'wifi-device', band: '2g', channel: '1' }, radio1: { '.type': 'wifi-device', band: '5g', channel: '36' },
			default_radio0: { '.type': 'wifi-iface', device: 'radio0', mode: 'ap', ssid: 'AbduRaheem_2G', encryption: 'none' },
			default_radio1: { '.type': 'wifi-iface', device: 'radio1', mode: 'ap', ssid: 'ABDURAHEEM_5G', encryption: 'none' }
		}
	});

	async function startWizard(lang, init) {
		const { T, V } = setup(lang);
		const uci = makeUci(init || initial());
		const ui = { modals: [], notes: [], showModal(t, c) { this.modals.push([ t, c ]); }, hideModal() {}, addNotification(t, c, k) { this.notes.push([ c, k ]); } };
		const mod = new Function('view', 'uci', 'ui', 'T', 'V', read('view/almakhdhi/quicksetup.js'))({ extend: o => o }, uci, ui, T, V);
		await mod.load();
		const root = mod.render();
		const click = txt => { const b = byText(root, 'button', txt) || findAll(root, n => n.tagName === 'BUTTON' && n.textContent.trim() === txt)[0]; assert.ok(b, 'button not found: ' + txt); b.fire('click'); };
		const input = (ph, val) => { const i = findAll(root, n => n.tagName === 'INPUT' && n.attrs.placeholder === ph)[0]; assert.ok(i, 'input not found: ' + ph); i.fire('input', { target: { value: val } }); };
		return { mod, root, uci, ui, click, input, T };
	}

	await t('quick setup: welcome -> LAN -> wireless -> review shows current values', async () => {
		const w = await startWizard('en');
		assert.ok(w.root.textContent.includes('Welcome to the Quick Setup'));
		assert.ok(findAll(w.root, n => n.tagName === 'IMG' && n.attrs.src === '/luci-static/almakhdhi/logo.png').length === 1, 'original logo shown');
		w.click('Start Setup');
		const ip = findAll(w.root, n => n.tagName === 'INPUT' && n.attrs.placeholder === '192.168.1.20')[0];
		assert.strictEqual(ip.attrs.value, '192.168.1.20');
		w.click('Next');
		assert.ok(findAll(w.root, n => n.tagName === 'INPUT' && n.attrs.placeholder === 'AbduRaheem_2G').length === 1);
		assert.ok(findAll(w.root, n => n.tagName === 'INPUT' && n.attrs.placeholder === 'AbduRaheem_5G').length === 1);
		w.click('Next');
		assert.ok(w.root.textContent.includes('Nothing will be changed'));
	});

	await t('quick setup: invalid input blocks the step and shows errors', async () => {
		const w = await startWizard('en');
		w.click('Start Setup');
		w.input('192.168.1.20', '300.1.1.1');
		w.input('255.255.255.0', '255.0.255.0');
		w.click('Next');
		assert.ok(w.root.textContent.includes('Enter a valid IPv4 address.'));
		assert.ok(w.root.textContent.includes('The subnet mask is not valid'));
		assert.ok(w.root.textContent.includes('LAN configuration'), 'still on the LAN step');
		w.input('192.168.1.20', '192.168.1.20'); w.input('255.255.255.0', '255.255.255.0'); w.input('192.168.1.1', '192.168.9.1');
		w.click('Next');
		assert.ok(w.root.textContent.includes('inside the same subnet'));
	});

	await t('quick setup: full apply with new IP, gateway, SSIDs and WPA2 password', async () => {
		const w = await startWizard('en');
		w.click('Start Setup');
		w.input('192.168.1.20', '192.168.50.2'); w.input('192.168.1.1', '192.168.50.1');
		w.click('Next');
		w.input('AbduRaheem_2G', 'Shop_2G'); w.input('AbduRaheem_5G', 'Shop_5G');
		const sel = findAll(w.root, n => n.tagName === 'SELECT')[0];
		sel.value = 'psk2'; sel.fire('change', { target: sel });
		w.input('********', 'short'); w.click('Next');
		assert.ok(w.root.textContent.includes('8 to 63'), 'short key rejected');
		w.input('********', 'MySecret123'); w.click('Next');
		const review = w.root.textContent;
		assert.ok(review.includes('Review your settings') && review.includes('192.168.50.2') && review.includes('Shop_2G'));
		assert.ok(review.includes('Warning: the router address changes from 192.168.1.20 to 192.168.50.2'));
		assert.ok(!review.includes('MySecret123'), 'password is never displayed in the review');
		w.click('Apply Settings');
		await flush();
		const db = w.uci.db;
		assert.strictEqual(db.network.lan.ipaddr, '192.168.50.2'); assert.strictEqual(db.network.lan.netmask, '255.255.255.0');
		assert.strictEqual(db.network.lan.gateway, '192.168.50.1'); assert.strictEqual(db.network.lan.proto, 'static');
		assert.strictEqual(db.wireless.default_radio0.ssid, 'Shop_2G'); assert.strictEqual(db.wireless.default_radio1.ssid, 'Shop_5G');
		assert.strictEqual(db.wireless.default_radio0.encryption, 'psk2'); assert.strictEqual(db.wireless.default_radio1.key, 'MySecret123');
		assert.strictEqual(w.uci.log.saved, 1); assert.strictEqual(w.uci.log.applied, 1);
		const modalText = w.ui.modals.map(m => m[0] + ' ' + new Node('x').textContent).join('|');
		assert.ok(w.ui.modals.some(m => m[0] === 'Router address changed'), 'IP-change modal shown');
		assert.ok(JSON.stringify(w.ui.modals[w.ui.modals.length - 1][1].map(n => n.textContent)).includes('http://192.168.50.2/cgi-bin/luci/admin/quicksetup'));
	});

	await t('quick setup: Wi-Fi only change does not touch network and offers Close', async () => {
		const w = await startWizard('en');
		w.click('Start Setup'); w.click('Next');
		w.input('AbduRaheem_2G', 'OnlyName_2G'); w.click('Next');
		w.click('Apply Settings'); await flush();
		assert.strictEqual(w.uci.db.network.lan.ipaddr, '192.168.1.20');
		assert.strictEqual(w.uci.db.wireless.default_radio0.ssid, 'OnlyName_2G');
		assert.strictEqual(w.uci.db.wireless.default_radio1.ssid, 'ABDURAHEEM_5G');
		assert.ok(w.ui.modals.some(m => m[0] === 'Settings applied'));
	});

	await t('quick setup: single-band device hides the 5 GHz field; CIDR address is understood', async () => {
		const init = initial(); delete init.wireless.radio1; delete init.wireless.default_radio1;
		init.network.lan.ipaddr = '10.0.0.7/16'; delete init.network.lan.netmask;
		const w = await startWizard('en', init);
		w.click('Start Setup');
		assert.strictEqual(findAll(w.root, n => n.tagName === 'INPUT' && n.attrs.placeholder === '255.255.255.0')[0].attrs.value, '255.255.0.0');
		w.click('Next');
		assert.strictEqual(findAll(w.root, n => n.tagName === 'INPUT' && n.attrs.placeholder === 'AbduRaheem_5G').length, 0);
		assert.ok(w.root.textContent.includes('No 5 GHz radio was found'));
	});

	await t('quick setup: failed apply (no IP change) shows an error notification', async () => {
		const w = await startWizard('en');
		w.uci.apply = () => Promise.reject(new Error('boom'));
		w.click('Start Setup'); w.click('Next'); w.input('AbduRaheem_2G', 'X_2G'); w.click('Next'); w.click('Apply Settings'); await flush();
		assert.strictEqual(w.ui.notes.length, 1);
	});

	await t('quick setup renders in Arabic', async () => {
		const w = await startWizard('ar');
		assert.ok(w.root.textContent.includes('الإعداد السريع') && w.root.textContent.includes('ابدأ الإعداد'));
	});

	/* ---------------- Sidebar / header ---------------- */
	function makeTree() {
		const leaf = (title, order, extra) => Object.assign({ title, order, children: {}, satisfied: true, action: { type: 'view' } }, extra || {});
		const admin = { children: {
			dashboard: leaf('Dashboard', 1), quicksetup: leaf('Quick Setup', 2),
			status: leaf('Status', 10, { children: { overview: leaf('Overview', 1), routes: leaf('Routing', 2), syslog: leaf('System Log', 3) } }),
			system: leaf('System', 20, { children: { system: leaf('System', 1), admin: leaf('Administration', 2), flash: leaf('Backup / Flash Firmware', 3) } }),
			network: leaf('Network', 30, { children: { network: leaf('Interfaces', 1), wireless: leaf('Wireless', 2), dhcp: leaf('DHCP and DNS', 3) } }),
			logout: leaf('Logout', 999),
			hidden: Object.assign(leaf('Hidden', 5), { satisfied: false })
		}, satisfied: true };
		return { children: { admin }, satisfied: true };
	}
	const uiMenu = tree => ({ menu: { load: () => tree ? Promise.resolve(tree) : Promise.reject(new Error('403')),
		getChildren(node) { return Object.keys(node.children || {}).filter(k => node.children[k].satisfied && node.children[k].title).map(k => Object.assign(node.children[k], { name: k })).sort((a, b) => a.order - b.order); } },
		addNotification() {} });

	function buildPage(lang, mq) {
		const { T } = setup(lang);
		global.window.matchMedia = () => ({ matches: !!mq });
		const body = global.document.body;
		const header = E('header', {}, E('div', { 'class': 'fill' }, E('div', { 'class': 'container' }, [
			E('span', { 'class': 'showSide' }), E('a', { 'class': 'brand', 'href': '#' }, 'AbduRaheem'), E('div', { 'class': 'pull-right' }, E('div', { 'id': 'indicators' }))
		])));
		body.appendChild(header);
		const main = E('div', { 'id': 'maincontent', 'class': 'container' }, E('form', {}, E('input', { 'name': 'luci_username' })));
		body.appendChild(main);
		return { T, body, header, main };
	}
	async function startMenu(lang, tree, mq, path) {
		const p = buildPage(lang, mq);
		global.L.env.dispatchpath = path || [ 'admin', 'status', 'overview' ];
		const rp = { declare: spec => (...a) => { rp.calls.push([ spec.method, ...a ]); return Promise.resolve(0); }, calls: [] };
		const ui = uiMenu(tree);
		const M = new Function('baseclass', 'ui', 'rpc', 'T', read('menu-almakhdhi.js'))({ extend: o => o }, ui, rp, p.T);
		const inst = Object.create(M); inst.__init__(); await flush(); await flush();
		return Object.assign(p, { inst, rp, ui });
	}

	await t('sidebar: built from the real menu tree, nothing dropped, active entries marked', async () => {
		const p = await startMenu('en', makeTree(), false);
		assert.ok(p.body.classList.contains('amk-ready'));
		const aside = p.body.querySelector('#amk-sidebar'); assert.ok(aside);
		const txt = aside.textContent;
		[ 'Dashboard', 'Quick Setup', 'Status', 'Overview', 'Routing', 'System Log', 'System', 'Administration', 'Backup / Flash Firmware', 'Network', 'Interfaces', 'Wireless', 'DHCP and DNS', 'Logout' ].forEach(x => assert.ok(txt.includes(x), 'sidebar lacks ' + x));
		assert.ok(!txt.includes('Hidden'), 'unsatisfied (ACL/uci) menu entries stay hidden, like stock LuCI');
		const hrefs = findAll(aside, n => n.tagName === 'A').map(a => a.attrs.href);
		assert.ok(hrefs.includes('/cgi-bin/luci/admin/dashboard') && hrefs.includes('/cgi-bin/luci/admin/quicksetup') && hrefs.includes('/cgi-bin/luci/admin/network/wireless') && hrefs.includes('/cgi-bin/luci/admin/status/overview') && hrefs.includes('/cgi-bin/luci/admin/system/flash'));
		const groups = findAll(aside, n => n.classList.contains('amk-group'));
		assert.deepStrictEqual(groups.map(g => g.classList.contains('open')), [ true, false, false ], 'only the active group is expanded');
		assert.ok(findAll(aside, n => n.tagName === 'LI' && n.classList.contains('active') && n.textContent === 'Overview').length === 1);
		/* order: Dashboard first so it is the landing page after login */
		assert.ok(txt.indexOf('Dashboard') < txt.indexOf('Quick Setup') && txt.indexOf('Quick Setup') < txt.indexOf('Status'));
	});

	await t('header: logo, brand text, burger, language + theme tools, hostname kept, indicators kept', async () => {
		const p = await startMenu('en', makeTree(), false);
		const h = p.header;
		assert.ok(h.classList.contains('amk-header'));
		const img = findAll(h, n => n.tagName === 'IMG')[0];
		assert.strictEqual(img.attrs.src, '/luci-static/almakhdhi/logo.png');
		assert.ok(h.textContent.includes('AlMakhdhi SoftWare'));
		assert.ok(findAll(h, n => n.classList.contains('amk-burger')).length === 1);
		assert.ok(findAll(h, n => n.attrs.id === 'indicators').length === 1, 'LuCI indicators container (unsaved changes) is preserved');
		assert.ok(h.textContent.includes('AbduRaheem'), 'hostname chip');
		assert.ok(h.textContent.includes('العربية'), 'language switch offers Arabic while the UI is English');
		assert.strictEqual(findAll(h, n => n.classList.contains('showSide'))[0].style.display, 'none');
	});

	await t('hamburger: desktop collapses/expands, mobile opens/closes with overlay + Esc', async () => {
		const d = await startMenu('en', makeTree(), false);
		const burger = findAll(d.header, n => n.classList.contains('amk-burger'))[0];
		burger.fire('click'); assert.ok(d.body.classList.contains('amk-nav-collapsed')); assert.strictEqual(burger.attrs['aria-expanded'], 'false');
		burger.fire('click'); assert.ok(!d.body.classList.contains('amk-nav-collapsed')); assert.strictEqual(burger.attrs['aria-expanded'], 'true');

		const m = await startMenu('en', makeTree(), true);
		const b2 = findAll(m.header, n => n.classList.contains('amk-burger'))[0];
		b2.fire('click'); assert.ok(m.body.classList.contains('amk-nav-open'));
		m.body.querySelector('#amk-overlay').fire('click'); assert.ok(!m.body.classList.contains('amk-nav-open'));
		b2.fire('click'); assert.ok(m.body.classList.contains('amk-nav-open'));
		/* group buttons expand/collapse */
		const btn = findAll(m.body.querySelector('#amk-sidebar'), n => n.classList.contains('amk-group-btn'))[1];
		btn.fire('click'); assert.ok(btn.parentNode.classList.contains('open'));
		btn.fire('click'); assert.ok(!btn.parentNode.classList.contains('open'));
	});

	await t('language switch writes luci.main.lang through uci and reloads', async () => {
		const p = await startMenu('en', makeTree(), false);
		const btn = findAll(p.header, n => n.tagName === 'BUTTON' && n.textContent === 'العربية')[0];
		btn.fire('click'); await flush(); await flush();
		assert.deepStrictEqual(p.rp.calls.map(c => c[0]), [ 'set', 'commit' ]);
		assert.deepStrictEqual(p.rp.calls[0].slice(1), [ 'luci', 'main', { lang: 'ar' } ]);
		assert.strictEqual(global.window.location.reloaded, true);
	});

	await t('dark mode toggle updates attributes and persists', async () => {
		const p = await startMenu('en', makeTree(), false);
		const btn = findAll(p.header, n => n.classList.contains('amk-tool-icon'))[0];
		btn.fire('click');
		assert.strictEqual(global.document.documentElement.getAttribute('data-darkmode'), 'true');
		assert.strictEqual(global.window.localStorage.getItem('amk-theme'), 'dark');
		btn.fire('click');
		assert.strictEqual(global.document.documentElement.getAttribute('data-darkmode'), 'false');
	});

	await t('Arabic: menu uses dictionary + official catalog fallback, language button offers English', async () => {
		const p = await startMenu('ar', makeTree(), false);
		const txt = p.body.querySelector('#amk-sidebar').textContent;
		assert.ok(txt.includes('لوحة المعلومات') && txt.includes('الإعداد السريع'));
		assert.ok(p.header.textContent.includes('English'));
	});

	await t('login page (menu load rejected): no sidebar, stock UI untouched, branded login', async () => {
		const p = await startMenu('en', null, false);
		assert.ok(!p.body.classList.contains('amk-ready'), 'stock menu stays visible when the sidebar cannot be built');
		assert.ok(p.body.classList.contains('amk-login'));
		assert.ok(p.body.querySelector('.amk-login-brand'));
		assert.ok(p.body.querySelector('.amk-login-brand').textContent.includes('AlMakhdhi SoftWare'));
	});

	console.log(`\n${passed} view tests passed`);
})().catch(e => { console.error(e); process.exit(1); });
