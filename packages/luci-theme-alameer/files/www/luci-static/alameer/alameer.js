/* ALAMEER SOFTWARE - sidebar for LuCI (Lua LuCI 21.02/22.03).
 * Builds a fixed sidebar from the real LuCI menu tree (ui.menu), so every page stays reachable:
 * Quick Setup, Dashboard, Network, Wireless, System, Status, Security, System Logs (+ "More" for anything else).
 * If anything fails, the stock Bootstrap menu stays visible (graceful fallback).
 * Developed by Eng. Abdulrahim Al-Makhadhi */
(function (root) {
	'use strict';

	var ICONS = {
		bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
		dash: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
		net: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
		wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
		gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
		pulse: '<polyline points="3,12 7,12 10,4 14,20 17,12 21,12"/>',
		shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
		log: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
		more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
		out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>'
	};

	/* Declarative layout. 'path' = LuCI menu path under the tree root. */
	var LAYOUT = [
		{ id: 'setup',    label: 'Quick Setup',  icon: 'bolt',   path: ['admin', 'alameer'], badge: 'NEW' },
		{ id: 'dash',     label: 'Dashboard',    icon: 'dash',   path: ['admin', 'dashboard'] },
		{ id: 'network',  label: 'Network',      icon: 'net',    path: ['admin', 'network'], exclude: ['wireless'] },
		{ id: 'wireless', label: 'Wireless',     icon: 'wifi',   path: ['admin', 'network', 'wireless'] },
		{ id: 'system',   label: 'System',       icon: 'gear',   path: ['admin', 'system'], exclude: ['admin'] },
		{ id: 'status',   label: 'Status',       icon: 'pulse',  path: ['admin', 'status'], exclude: ['logs', 'syslog', 'dmesg'] },
		{ id: 'security', label: 'Security',     icon: 'shield', path: ['admin', 'system', 'admin'] },
		{ id: 'logs',     label: 'System Logs',  icon: 'log',    path: ['admin', 'status', 'logs'], alt: [['admin', 'status', 'syslog']] }
	];
	/* top-level admin nodes that LAYOUT already covers (everything else goes to "More") */
	var COVERED = { alameer: 1, dashboard: 1, network: 1, system: 1, status: 1, logout: 1 };

	function sortedChildren(node) {
		var out = [], k, c = node && node.children;
		if (!c) return out;
		for (k in c) if (Object.prototype.hasOwnProperty.call(c, k) && c[k] && c[k].title) out.push({ name: k, node: c[k] });
		out.sort(function (a, b) {
			var oa = a.node.order == null ? 1000 : a.node.order, ob = b.node.order == null ? 1000 : b.node.order;
			return oa - ob || String(a.node.title).localeCompare(String(b.node.title));
		});
		return out;
	}
	function getNode(tree, path) {
		var n = tree, i;
		for (i = 0; i < path.length; i++) {
			n = n && n.children && n.children[path[i]];
			if (!n) return null;
		}
		return n;
	}
	/* first reachable leaf below a node (so a group header always has a valid target) */
	function firstLeafPath(node, path) {
		var kids = sortedChildren(node);
		return kids.length ? firstLeafPath(kids[0].node, path.concat(kids[0].name)) : path;
	}

	/* Pure function: LuCI tree -> sidebar model. urlFn(pathArray) -> URL string. */
	function buildModel(tree, urlFn) {
		var items = [], i, j, def, node, path, kids, ch, p;
		for (i = 0; i < LAYOUT.length; i++) {
			def = LAYOUT[i];
			path = def.path; node = getNode(tree, path);
			if (!node && def.alt) {
				for (j = 0; j < def.alt.length && !node; j++) { node = getNode(tree, def.alt[j]); if (node) path = def.alt[j]; }
			}
			if (!node || !node.title) continue;
			kids = sortedChildren(node);
			ch = [];
			if (def.id === 'network' || def.id === 'system' || def.id === 'status') {
				for (j = 0; j < kids.length; j++) {
					if ((def.exclude || []).indexOf(kids[j].name) >= 0) continue;
					p = firstLeafPath(kids[j].node, path.concat(kids[j].name));
					ch.push({ label: kids[j].node.title, url: urlFn(p) });
				}
				if (!ch.length) continue;
				items.push({ id: def.id, label: def.label, icon: def.icon, children: ch, url: ch[0].url });
			} else {
				items.push({ id: def.id, label: def.label, icon: def.icon, badge: def.badge, children: [], url: urlFn(firstLeafPath(node, path)) });
			}
		}
		var more = [], admin = getNode(tree, ['admin']), top = sortedChildren(admin);
		for (i = 0; i < top.length; i++) {
			if (COVERED[top[i].name]) continue;
			more.push({ label: top[i].node.title, url: urlFn(firstLeafPath(top[i].node, ['admin', top[i].name])),
				children: sortedChildren(top[i].node).map(function (k) { return { label: k.node.title, url: urlFn(firstLeafPath(k.node, ['admin', top[i].name, k.name])) }; }) });
		}
		var lo = getNode(tree, ['admin', 'logout']);
		return { items: items, more: more, logout: lo ? urlFn(['admin', 'logout']) : null };
	}

	/* ---- browser part ---------------------------------------------------- */
	function el(doc, tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
	function icon(doc, name) {
		var s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
		s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'al-ico'); s.setAttribute('aria-hidden', 'true');
		s.innerHTML = ICONS[name] || ICONS.more;
		return s;
	}
	function isActive(url, cur) { return url && cur.indexOf(url.split('?')[0]) === 0; }

	function render(doc, model) {
		var cur = doc.location.pathname, side = el(doc, 'nav', 'al-side'), brand = el(doc, 'div', 'al-brand'), img = el(doc, 'img'), t = el(doc, 'div', 'al-brand-t');
		side.id = 'al-sidebar'; side.setAttribute('aria-label', 'Main menu');
		img.src = '/luci-static/alameer/logo-160.png'; img.alt = 'ALAMEER SOFTWARE';
		t.appendChild(el(doc, 'strong', null, 'ALAMEER SOFTWARE')); t.appendChild(el(doc, 'span', null, 'Professional Firmware'));
		brand.appendChild(img); brand.appendChild(t); side.appendChild(brand);

		var ul = el(doc, 'ul', 'al-nav');
		function addItem(it, ico) {
			var li = el(doc, 'li', 'al-item'), a = el(doc, 'a', 'al-link'), act = isActive(it.url, cur), kids = it.children || [];
			var anyKid = kids.some(function (k) { return isActive(k.url, cur); });
			a.href = it.url; a.appendChild(icon(doc, ico || it.icon)); a.appendChild(el(doc, 'span', 'al-lbl', it.label));
			if (it.badge) a.appendChild(el(doc, 'span', 'al-badge', it.badge));
			if (act || anyKid) li.className += ' al-active';
			li.appendChild(a);
			if (kids.length) {
				var sub = el(doc, 'ul', 'al-sub');
				kids.forEach(function (k) { var sl = el(doc, 'li'), sa = el(doc, 'a', isActive(k.url, cur) ? 'al-sub-act' : '', k.label); sa.href = k.url; sl.appendChild(sa); sub.appendChild(sl); });
				a.className += ' al-has-sub'; li.appendChild(sub);
				if (act || anyKid) li.className += ' al-open';
				a.addEventListener('click', function (ev) { ev.preventDefault(); li.classList.toggle('al-open'); });
			}
			ul.appendChild(li);
		}
		model.items.forEach(function (it) { addItem(it); });
		if (model.more.length) {
			ul.appendChild(el(doc, 'li', 'al-sep', 'More'));
			model.more.forEach(function (it) { addItem(it, 'more'); });
		}
		side.appendChild(ul);
		var foot = el(doc, 'div', 'al-side-foot');
		if (model.logout) { var lo = el(doc, 'a', 'al-logout'); lo.href = model.logout; lo.appendChild(icon(doc, 'out')); lo.appendChild(el(doc, 'span', null, 'Logout')); foot.appendChild(lo); }
		foot.appendChild(el(doc, 'small', null, 'ALAMEER SOFTWARE | Eng. Abdulrahim Al-Makhadhi'));
		side.appendChild(foot);

		var burger = el(doc, 'button', 'al-burger', '\u2630'); burger.type = 'button'; burger.setAttribute('aria-label', 'Menu');
		var shade = el(doc, 'div', 'al-shade');
		function toggle() { doc.body.classList.toggle('al-open-menu'); }
		burger.addEventListener('click', toggle); shade.addEventListener('click', toggle);
		doc.body.appendChild(side); doc.body.appendChild(shade); doc.body.appendChild(burger);
		doc.body.classList.add('al-ready');   // hides the stock Bootstrap menu only now
	}

	function start() {
		if (!root.L || !root.L.require || !document.getElementById('maincontent')) return;
		root.L.require('ui').then(function (ui) {
			return ui.menu.load();
		}).then(function (tree) {
			var model = buildModel(tree, function (p) { return root.L.url.apply(root.L, p); });
			if (model.items.length) render(document, model);
		}).catch(function () { /* keep stock menu */ });
	}

	if (typeof module !== 'undefined' && module.exports) { module.exports = { buildModel: buildModel, LAYOUT: LAYOUT }; }
	else if (typeof document !== 'undefined') {
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
	}
})(typeof window !== 'undefined' ? window : this);
