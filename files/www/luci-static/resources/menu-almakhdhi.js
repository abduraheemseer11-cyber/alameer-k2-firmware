'use strict';
'require baseclass';
'require ui';
'require rpc';
'require almakhdhi.i18n as T';

/*
 * AlMakhdhi SoftWare sidebar / header controller.
 *
 * It does NOT replace LuCI's own menu code: the stock menu (menu-bootstrap)
 * keeps running underneath and is only hidden by CSS once this sidebar was
 * built successfully (body.amk-ready). If anything here fails, the stock
 * bootstrap navigation stays visible, so no page can become unreachable.
 *
 * The sidebar is generated from LuCI's real menu tree (ui.menu), so every page
 * of every installed package appears automatically.
 */

var LOGO = '/luci-static/almakhdhi/logo.png';
var MOBILE = '(max-width: 900px)';

var ICONS = {
	dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
	quicksetup: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66L13 3h1l-1 7h3.5c.49 0 .56.33.47.51L11 21z',
	status: 'M3 13h2v8H3zm4-8h2v16H7zm4-2h2v18h-2zm4 4h2v14h-2zm4-2h2v16h-2z',
	system: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
	network: 'M13 22h8v-7h-3v-4h-5V9h3V2H8v7h3v2H6v4H3v7h8v-7H8v-2h8v2h-3z',
	services: 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
	vpn: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
	logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
	_default: 'M12 4a8 8 0 100 16 8 8 0 000-16z'
};

var callUciSet = rpc.declare({ object: 'uci', method: 'set', params: [ 'config', 'section', 'values' ] });
var callUciCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ] });

function icon(name) {
	var s = document.createElement('span');
	s.className = 'amk-ico';
	/* path data comes from the constant table above */
	s.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + (ICONS[name] || ICONS._default) + '"/></svg>';
	return s;
}

function store(key, val) {
	try { if (val == null) return window.localStorage.getItem(key); window.localStorage.setItem(key, val); } catch (e) {}
	return null;
}

return baseclass.extend({
	__init__: function() {
		var self = this;
		this.mq = window.matchMedia ? window.matchMedia(MOBILE) : { matches: false };
		this.decorateHeader();

		ui.menu.load().then(function(tree) {
			self.render(tree);
		}).catch(function() {
			self.markLogin();
		});
	},

	isMobile: function() {
		var sw = (window.screen && window.screen.width) ? window.screen.width : window.innerWidth;
		return !!(this.mq.matches || sw <= 700);
	},

	/* ---------- header ---------- */
	decorateHeader: function() {
		var self = this;
		var header = document.querySelector('body > header') || document.querySelector('header');
		if (!header) {
			header = document.createElement('header');
			document.body.insertBefore(header, document.body.firstChild);
		}
		header.classList.add('amk-header');
		this.header = header;

		var host = header.querySelector('.container') || header;
		var side = header.querySelector('.showSide');
		if (side) side.style.display = 'none';

		var brand = header.querySelector('.brand');
		var hostname = brand ? brand.textContent.trim() : '';
		if (!brand) {
			brand = document.createElement('a');
			host.appendChild(brand);
		}
		brand.className = 'brand amk-brand';
		brand.setAttribute('href', L.url('admin'));
		brand.textContent = '';
		brand.appendChild(E('span', { 'class': 'amk-logo' }, E('img', { 'src': LOGO, 'alt': 'ALAMEER SOFTWARE', 'width': '38', 'height': '38' })));
		brand.appendChild(E('span', { 'class': 'amk-brand-text' }, 'AlMakhdhi SoftWare'));

		this.burger = E('button', { 'type': 'button', 'class': 'amk-burger', 'aria-label': T.t('Toggle menu'), 'aria-expanded': 'false',
			'click': function() { self.toggle(); } }, [ E('span'), E('span'), E('span') ]);
		host.insertBefore(this.burger, host.firstChild);

		var tools = header.querySelector('.pull-right');
		if (!tools) {
			tools = E('div', { 'class': 'pull-right' });
			host.appendChild(tools);
		}
		tools.classList.add('amk-tools');

		var lang = T.lang();
		var langBtn = E('button', { 'type': 'button', 'class': 'amk-tool', 'title': T.t('Switch language'), 'click': function() { self.switchLanguage(lang === 'ar' ? 'en' : 'ar'); } },
			lang === 'ar' ? 'English' : '\u0627\u0644\u0639\u0631\u0628\u064a\u0629');   /* native language names, never translated */
		var dark = store('amk-theme') === 'dark';
		var themeBtn = E('button', { 'type': 'button', 'class': 'amk-tool amk-tool-icon', 'title': T.t('Toggle dark mode'), 'aria-pressed': String(dark),
			'click': function() { self.toggleTheme(themeBtn); } }, '◐');

		tools.insertBefore(themeBtn, tools.firstChild);
		tools.insertBefore(langBtn, tools.firstChild);
		if (hostname) tools.insertBefore(E('span', { 'class': 'amk-hostname' }, hostname), tools.firstChild);

		/* restore the desktop collapsed state */
		if (!this.isMobile() && store('amk-nav') === 'collapsed')
			document.body.classList.add('amk-nav-collapsed');
		this.syncBurger();
	},

	switchLanguage: function(next) {
		callUciSet('luci', 'main', { lang: next }).then(function() {
			return callUciCommit('luci');
		}).then(function() {
			window.location.reload();
		}).catch(function(err) {
			ui.addNotification(null, E('p', T.f('Could not change the language: %s', (err && err.message) ? err.message : err)), 'danger');
		});
	},

	toggleTheme: function(btn) {
		var dark = store('amk-theme') !== 'dark';
		store('amk-theme', dark ? 'dark' : 'light');
		var d = document.documentElement;
		d.setAttribute('data-amk-theme', dark ? 'dark' : 'light');
		d.setAttribute('data-darkmode', dark ? 'true' : 'false');
		btn.setAttribute('aria-pressed', String(dark));
	},

	/* ---------- sidebar ---------- */
	render: function(tree) {
		var self = this, path = L.env.dispatchpath || [];
		var kids = tree.children || {};
		var admin = kids[path[0]] || kids.admin;
		if (!admin) return;

		var activeTop = path[1], activeSub = path[2];
		var list = E('ul', { 'class': 'amk-menu' });

		ui.menu.getChildren(admin).forEach(function(top) {
			var subs = ui.menu.getChildren(top);
			var isActive = (top.name === activeTop);
			var title = T.menu(top.title);

			if (!subs.length) {
				list.appendChild(E('li', { 'class': 'amk-leaf' + (isActive ? ' active' : '') }, E('a', { 'href': L.url('admin', top.name) }, [
					icon(top.name), E('span', { 'class': 'amk-label' }, title)
				])));
				return;
			}

			var sub = E('ul', { 'class': 'amk-sub' });
			subs.forEach(function(k) {
				var on = isActive && k.name === activeSub;
				sub.appendChild(E('li', { 'class': on ? 'active' : '' }, E('a', { 'href': L.url('admin', top.name, k.name) }, T.menu(k.title))));
			});

			var li = E('li', { 'class': 'amk-group' + (isActive ? ' open active' : '') });
			var btn = E('button', { 'type': 'button', 'class': 'amk-group-btn', 'aria-expanded': String(isActive), 'click': function() {
				var open = li.classList.toggle('open');
				btn.setAttribute('aria-expanded', String(open));
			} }, [ icon(top.name), E('span', { 'class': 'amk-label' }, title), E('span', { 'class': 'amk-caret' }) ]);
			li.appendChild(btn);
			li.appendChild(sub);
			list.appendChild(li);
		});

		var aside = E('aside', { 'id': 'amk-sidebar', 'class': 'amk-sidebar' }, [
			E('nav', { 'class': 'amk-nav' }, list),
			E('div', { 'class': 'amk-side-foot' }, 'AlMakhdhi SoftWare')
		]);
		var overlay = E('div', { 'id': 'amk-overlay', 'class': 'amk-overlay', 'click': function() { self.setOpen(false); } });

		aside.addEventListener('click', function(ev) {
			var a = ev.target.closest ? ev.target.closest('a') : null;
			if (a && self.isMobile()) self.setOpen(false);
		});
		document.addEventListener('keydown', function(ev) { if (ev.key === 'Escape') self.setOpen(false); });
		window.addEventListener('resize', function() { document.body.classList.remove('amk-nav-open'); self.syncBurger(); });

		document.body.appendChild(overlay);
		document.body.appendChild(aside);
		document.body.classList.add('amk-ready');

		var active = aside.querySelector('li.active > a');
		if (active && active.scrollIntoView && !this.isMobile()) { try { active.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
	},

	toggle: function() {
		var b = document.body;
		if (this.isMobile()) this.setOpen(!b.classList.contains('amk-nav-open'));
		else {
			var c = b.classList.toggle('amk-nav-collapsed');
			store('amk-nav', c ? 'collapsed' : 'open');
			this.syncBurger();
		}
	},

	setOpen: function(open) {
		document.body.classList.toggle('amk-nav-open', !!open);
		this.syncBurger();
	},

	syncBurger: function() {
		if (!this.burger) return;
		var b = document.body;
		var expanded = this.isMobile() ? b.classList.contains('amk-nav-open') : !b.classList.contains('amk-nav-collapsed');
		this.burger.setAttribute('aria-expanded', String(expanded));
	},

	/* ---------- login page ---------- */
	markLogin: function() {
		document.body.classList.add('amk-login');
		var form = document.querySelector('#maincontent form') || document.querySelector('form');
		if (!form || document.querySelector('.amk-login-brand')) return;
		var hero = E('div', { 'class': 'amk-login-brand' }, [
			E('span', { 'class': 'amk-logo amk-logo-lg' }, E('img', { 'src': LOGO, 'alt': 'ALAMEER SOFTWARE', 'width': '120', 'height': '120' })),
			E('h1', {}, 'AlMakhdhi SoftWare')
		]);
		form.parentNode.insertBefore(hero, form);
	}
});
