/* Alameer: replaces LuCI bootstrap nav with fixed top bar + sliding drawer */
(function () {
	'use strict';
	
	// Detect login page and add the 'sysauth' class to body for custom styling
	if (document.querySelector('form[action*="login"]') || document.querySelector('input[name="luci_username"]')) {
		document.body.classList.add('sysauth');
		return; // Stop execution on the login page
	}

	function collect() {
		var root = document.querySelector('#mainmenu') || document.querySelector('ul.nav');
		var groups = [];
		if (!root) return groups;
		root.querySelectorAll(':scope > li').forEach(function (li) {
			var top = li.querySelector(':scope > a');
			var subs = [];
			li.querySelectorAll(':scope > ul a').forEach(function (a) { subs.push({ t: a.textContent.trim(), h: a.getAttribute('href') }); });
			if (top) groups.push({ t: top.textContent.trim(), h: top.getAttribute('href'), s: subs });
		});
		return groups;
	}
	function close() { document.body.classList.remove('al-open'); }
	function render() {
		var groups = collect();
		if (!groups.length) return false;
		var old = document.getElementById('al-top');
		if (old) { old.remove(); document.getElementById('al-drawer').remove(); document.getElementById('al-ov').remove(); }
		var ind = document.getElementById('indicators');
		var top = document.createElement('div'); top.id = 'al-top';
		top.innerHTML = '<button class="al-burger" aria-label="menu">&#9776;</button>' +
			'<a class="al-brand" href="/cgi-bin/luci/admin/status/overview"><img src="/luci-static/alameer/logo.png" alt=""><span class="al-title">Alameer / WrtMax</span></a><span class="al-sp"></span>';
		if (ind) top.appendChild(ind); /* keeps LuCI unsaved-changes indicator */
		var ov = document.createElement('div'); ov.id = 'al-ov'; ov.onclick = close;
		var dr = document.createElement('nav'); dr.id = 'al-drawer';
		var html = '<div class="al-head"><img src="/luci-static/alameer/logo.png" alt=""><div>WrtMax Firmware</div></div>';
		var here = location.pathname + location.search;
		groups.forEach(function (g) {
			html += '<h4>' + g.t.replace(/</g, '&lt;') + '</h4>';
			if (!g.s.length && g.h) html += '<a href="' + g.h + '">' + g.t + '</a>';
			g.s.forEach(function (s) {
				html += '<a href="' + s.h + '"' + (here.indexOf(s.h) >= 0 ? ' class="active"' : '') + '>' + s.t.replace(/</g, '&lt;') + '</a>';
			});
		});
		dr.innerHTML = html;
		dr.addEventListener('click', function (e) { if (e.target.tagName === 'A') close(); });
		document.body.appendChild(top); document.body.appendChild(ov); document.body.appendChild(dr);
		top.querySelector('.al-burger').onclick = function () { document.body.classList.toggle('al-open'); };
		return true;
	}
	function init() {
		if (render()) return;
		var tries = 0, mo = new MutationObserver(function () {
			if (render() || ++tries > 50) mo.disconnect();
		});
		mo.observe(document.body, { childList: true, subtree: true });
	}
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
