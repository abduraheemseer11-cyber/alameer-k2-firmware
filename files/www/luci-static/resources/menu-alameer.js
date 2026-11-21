'use strict';
'require baseclass';
'require ui';

/* Menu renderer for the Alameer Software theme.
   Sidebar (accordion) + tab bar for third-level pages + hamburger toggle. */

return baseclass.extend({
	__init__: function() {
		this.initToggle();
		ui.menu.load().then(L.bind(this.render, this));
	},

	initToggle: function() {
		var body = document.body,
		    mq = window.matchMedia('(max-width: 900px)'),
		    btn = document.getElementById('amtoggle'),
		    scrim = document.getElementById('amscrim');

		btn.addEventListener('click', function() {
			if (mq.matches)
				body.classList.toggle('nav-open');
			else
				body.classList.toggle('nav-collapsed');
		});

		scrim.addEventListener('click', function() {
			body.classList.remove('nav-open');
		});
	},

	render: function(tree) {
		var path = L.env.dispatchpath || [],
		    mode = path[0] || 'admin',
		    modeNode = tree.children ? tree.children[mode] : null;

		if (!modeNode)
			return;

		this.renderSidebar(modeNode, mode, path);

		if (path.length >= 3) {
			var node = modeNode.children && modeNode.children[path[1]];
			node = node && node.children && node.children[path[2]];

			if (node)
				this.renderTabs(node, mode + '/' + path[1] + '/' + path[2], 0);
		}
	},

	renderSidebar: function(modeNode, mode, path) {
		var ul = document.getElementById('mainmenu'),
		    cats = ui.menu.getChildren(modeNode);

		for (var i = 0; i < cats.length; i++) {
			var cat = cats[i],
			    subs = ui.menu.getChildren(cat),
			    catActive = (path[1] == cat.name),
			    li = E('li', { 'class': 'amcat' + (catActive ? ' active open' : '') });

			if (subs.length) {
				var head = E('a', { 'href': '#', 'class': 'amhead' }, [ E('span', {}, _(cat.title)), E('em', { 'class': 'amcaret' }) ]);

				head.addEventListener('click', function(ev) {
					ev.preventDefault();
					this.parentNode.classList.toggle('open');
				});

				var sub = E('ul', { 'class': 'amsub' });

				for (var j = 0; j < subs.length; j++) {
					var isSub = (catActive && path[2] == subs[j].name);

					sub.appendChild(E('li', { 'class': isSub ? 'active' : '' }, [
						E('a', { 'href': L.url(mode, cat.name, subs[j].name) }, [ _(subs[j].title) ])
					]));
				}

				li.appendChild(head);
				li.appendChild(sub);
			}
			else {
				li.appendChild(E('a', { 'href': L.url(mode, cat.name), 'class': 'amhead amleaf' }, [ E('span', {}, _(cat.title)) ]));
			}

			ul.appendChild(li);
		}
	},

	renderTabs: function(node, url, level) {
		var container = document.getElementById('tabmenu'),
		    children = ui.menu.getChildren(node),
		    path = L.env.dispatchpath || [],
		    active = null;

		if (!children.length)
			return;

		var ul = E('ul', { 'class': 'tabs' });

		for (var i = 0; i < children.length; i++) {
			var isActive = (path[level + 3] == children[i].name);

			if (isActive)
				active = children[i];

			ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
				E('a', { 'href': L.url(url, children[i].name) }, [ _(children[i].title) ])
			]));
		}

		container.appendChild(ul);
		container.style.display = '';

		if (active)
			this.renderTabs(active, url + '/' + active.name, level + 1);
	}
});
