'use strict';
'require view';
'require rpc';
'require poll';

var callLoop = rpc.declare({ object: 'alameer', method: 'loopstatus' });
var callPorts = rpc.declare({ object: 'alameer', method: 'ports' });

return view.extend({
	render: function () {
		var grid = E('div', { 'class': 'al-grid' }), log = E('pre', { style: 'max-height:260px;overflow:auto;color:#cbd5e1' }), lim = E('p', { style: 'color:#8b93b5' });
		var tick = function () {
			return Promise.all([callLoop(), callPorts()]).then(function (r) {
				var d = r[0], links = {}; ((r[1] || {}).ports || []).forEach(function (p) { links['p' + p.port] = p.up; });
				grid.innerHTML = '';
				(d.ports || []).forEach(function (p) {
					var warn = p.isolated ? 'al-off' : (p.strikes ? 'al-warn' : 'al-on');
					var up = links[p.name] === undefined ? '' : (links[p.name] ? ' ▲ link' : ' ▽ no link');
					grid.appendChild(E('div', { 'class': 'al-stat' }, [E('b', { 'class': warn }, p.rx_pps + ' pps'), E('span', {}, p.name + up), E('br'), E('span', {}, 'MC ' + p.mc_pps + ' pps' + (p.isolated ? ' · ISOLATED' : (p.strikes ? ' · strikes ' + p.strikes : '')))]));
				});
				if (d.limits) lim.textContent = _('Limits: ') + d.limits.pps + ' pps total / ' + d.limits.mc + ' pps multicast for ' + d.limits.strikes + ' s → isolate ' + d.limits.isolate_secs + ' s. Uplink ' + d.uplink + ' is exempt.';
				log.textContent = (d.events || []).join('\n') || _('No events.');
				if (d.error) log.textContent = d.error;
			});
		};
		poll.add(tick, 2); tick();
		return E('div', {}, [E('h2', {}, _('Loop Guard')), E('div', { 'class': 'al-card' }, [grid, lim]), E('div', { 'class': 'al-card' }, [E('h3', {}, _('Events')), log])]);
	},
	handleSave: null, handleSaveApply: null, handleReset: null
});
