'use strict';
'require baseclass';
'require ui';

var ICONS = {
	bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
	dashboard: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="8" height="7" rx="1"/>',
	wifi: '<path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
	network: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
	globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
	shield: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
	devices: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M7 20h6M10 16v4M19 8h2v12h-8"/>',
	gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1"/>',
	pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
	more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
	log: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'
};

function children(node) {
	var out = [], c = node && node.children;
	if (!c) return out;
	Object.keys(c).forEach(function(k) {
		if (c[k] && c[k].title) { c[k].name = k; out.push(c[k]); }
	});
	return out.sort(function(a, b) { return (+a.order || 1000) - (+b.order || 1000) || String(a.title).localeCompare(String(b.title)); });
}

function findPath(tree, path) {
	var n = tree;
	for (var i = 0; i < path.length; i++) {
		n = n && n.children && n.children[path[i]];
		if (!n) return null;
	}
	return n;
}

function firstLeaf(node, path) {
	var kids = children(node);
	if (!kids.length) return path;
	var next = kids[0];
	var key = Object.keys(node.children).filter(function(k) { return node.children[k] === next; })[0];
	return firstLeaf(next, path.concat(key));
}

function svg(name) {
	return E('svg', { 'class': 'am-nav-icon', 'viewBox': '0 0 24 24', 'aria-hidden': 'true', 'fill': 'none', 'stroke': 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [ E('g', {}, [ E('path', { 'd': (ICONS[name] || ICONS.more).replace(/<\/?path[^>]*>/g, '') }) ]) ]);
}

return baseclass.extend({
	__init__: function() {
		var self = this;
		this.initMobile();
		ui.menu.load().then(function(tree) { self.render(tree); }).catch(function(err) {
			if (window.console) console.error('ALAMEER menu could not load', err);
		});
	},

	initMobile: function() {
		var btn = document.getElementById('amtoggle');
		var shade = document.getElementById('amscrim');
		if (!btn || !shade) return;
		function close() {
			document.body.classList.remove('am-nav-open');
			btn.setAttribute('aria-expanded', 'false');
		}
		btn.addEventListener('click', function() {
			var open = document.body.classList.toggle('am-nav-open');
			btn.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		shade.addEventListener('click', close);
		document.addEventListener('keydown', function(ev) { if (ev.key === 'Escape') close(); });
	},

	render: function(tree) {
		var admin = tree && tree.children && tree.children.admin;
		if (!admin) return;
		var ul = document.getElementById('mainmenu');
		if (!ul) return;
		ul.innerHTML = '';
		var current = (L.env.dispatchpath || []).join('/');
		var self = this;

		// Always first and separate from Network.
		this.addLink(ul, _('Quick Setup'), L.url('admin', 'quicksetup'), 'bolt', current.indexOf('admin/quicksetup') === 0, 'NEW');
		var overview = findPath(tree, ['admin', 'status', 'overview']);
		var dashboardPath = overview ? ['admin', 'status', 'overview'] : ['admin', 'status'];
		if (findPath(tree, dashboardPath)) this.addLink(ul, _('Dashboard'), L.url.apply(L, dashboardPath), 'dashboard', current.indexOf('admin/status') === 0);

		var network = admin.children && admin.children.network;
		if (network) {
			var netKids = children(network), wifi = null, other = [];
			netKids.forEach(function(n) { if (n.name === 'wireless') wifi = n; else other.push(n); });
			if (wifi) self.addGroup(ul, _('Wi-Fi'), wifi, ['admin', 'network', 'wireless'], 'wifi', current);
			if (other.length) self.addGroup(ul, _('Network'), network, ['admin', 'network'], 'network', current, function(n) { return n.name !== 'wireless'; });
		}

		['vpn', 'devices'].forEach(function(name) {
			var node = admin.children && admin.children[name];
			if (node) self.addGroup(ul, _(node.title), node, ['admin', name], name === 'vpn' ? 'shield' : 'devices', current);
		});
		['system', 'status'].forEach(function(name) {
			var node = admin.children && admin.children[name];
			if (node) self.addGroup(ul, _(node.title), node, ['admin', name], name === 'system' ? 'gear' : 'pulse', current);
		});

		var skip = { quicksetup:1, status:1, network:1, vpn:1, devices:1, system:1, logout:1 };
		children(admin).forEach(function(node) {
			if (skip[node.name]) return;
			self.addGroup(ul, _(node.title), node, ['admin', node.name], 'more', current);
		});
	},

	addLink: function(ul, label, href, iconName, active, badge) {
		var li = E('li', { 'class': 'am-nav-item' + (active ? ' active' : '') });
		var a = E('a', { 'class': 'am-nav-link', 'href': href }, [
			E('span', { 'class': 'am-nav-symbol' }, [ this.icon(iconName) ]),
			E('span', { 'class': 'am-nav-label' }, label)
		]);
		if (badge) a.appendChild(E('span', { 'class': 'am-nav-badge' }, badge));
		li.appendChild(a); ul.appendChild(li);
	},

	addGroup: function(ul, label, node, path, iconName, current, filterFn) {
		var self = this, kids = children(node).filter(function(k) { return !filterFn || filterFn(k); });
		if (!kids.length) { this.addLink(ul, label, L.url.apply(L, path), iconName, current.indexOf(path.join('/')) === 0); return; }
		var active = current.indexOf(path.join('/') + '/') === 0 || current === path.join('/');
		var li = E('li', { 'class': 'am-nav-group' + (active ? ' open active' : '') });
		var head = E('button', { 'class': 'am-nav-link am-nav-toggle', 'type': 'button', 'aria-expanded': active ? 'true' : 'false' }, [
			E('span', { 'class': 'am-nav-symbol' }, [ this.icon(iconName) ]),
			E('span', { 'class': 'am-nav-label' }, label),
			E('span', { 'class': 'am-nav-chevron' }, '›')
		]);
		var sub = E('ul', { 'class': 'am-submenu' });
		kids.forEach(function(k) {
			var key = Object.keys(node.children).filter(function(x) { return node.children[x] === k; })[0];
			var childPath = firstLeaf(k, path.concat(key));
			var href = L.url.apply(L, childPath);
			var on = current.indexOf(childPath.join('/')) === 0 || current.indexOf(path.concat(key).join('/')) === 0;
			var a = E('a', { 'href': href, 'class': on ? 'active' : '' }, _(k.title));
			sub.appendChild(E('li', {}, [a]));
		});
		head.addEventListener('click', function() {
			var open = li.classList.toggle('open');
			head.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		li.appendChild(head); li.appendChild(sub); ul.appendChild(li);
	},

	icon: function(name) {
		var wrapper = E('span', { 'class': 'am-svg' });
		var paths = {
			bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', dashboard: 'M3 3h8v8H3z M14 3h7v5h-7z M14 11h7v10h-7z M3 14h8v7H3z',
			wifi: 'M2 8.5a16 16 0 0 1 20 0 M5 12a11 11 0 0 1 14 0 M8.5 15.5a5 5 0 0 1 7 0 M12 19h.01',
			network: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18 M3 12h18 M12 3a15 15 0 0 1 0 18 M12 3a15 15 0 0 0 0 18',
			shield: 'M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
			devices: 'M3 4h14v12H3z M7 20h6 M10 16v4 M19 8h2v12h-8',
			gear: 'M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1 M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6',
			pulse: 'M3 12h4l3-8 4 16 3-8h4', more: 'M5 12h.01M12 12h.01M19 12h.01'
		};
		var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
		var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', paths[name] || paths.more);
		svg.appendChild(p); wrapper.appendChild(svg); return wrapper;
	}
});
