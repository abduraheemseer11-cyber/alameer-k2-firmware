'use strict';
'require view';
'require rpc';
'require poll';

var callInfo = rpc.declare({ object: 'alameer', method: 'sysinfo' });
function fmtUp(s) { var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + 'd ' : '') + h + 'h ' + m + 'm'; }
function stat(id, label) { return E('div', { 'class': 'al-stat' }, [E('b', { id: id }, '…'), E('span', {}, label)]); }

return view.extend({
	render: function () {
		var cpuSel = E('select', { id: 'pw_gov', disabled: 'disabled' }, E('option', {}, 'fixed'));
		var root = E('div', {}, [E('h2', {}, _('Performance & Power')),
			E('div', { 'class': 'al-card' }, [E('div', { 'class': 'al-grid' }, [stat('pw_up', _('Uptime')), stat('pw_load', _('Load (1/5/15)')), stat('pw_mem', _('RAM used')), stat('pw_cpu', _('CPU clock'))]),
				E('div', { style: 'margin-top:12px' }, [E('div', { 'class': 'al-bar' }, E('i', { id: 'pw_bar', style: 'width:0%' }))]), E('p', { id: 'pw_memtxt', 'class': 'al-stat' })]),
			E('div', { 'class': 'al-card' }, [E('h3', {}, _('CPU frequency')), E('div', { 'class': 'al-row' }, [E('label', {}, _('Governor / frequency')), cpuSel]),
				E('p', { id: 'pw_note', style: 'color:#8b93b5' })]), E('div', { 'class': 'al-card', id: 'pw_sys' })]);
		var tick = function () {
			return callInfo().then(function (i) {
				var used = i.mem_total - i.mem_free - i.mem_buffers - i.mem_cached, pct = Math.round(used / i.mem_total * 100);
				document.getElementById('pw_up').textContent = fmtUp(i.uptime);
				document.getElementById('pw_load').textContent = i.load;
				document.getElementById('pw_mem').textContent = pct + '%';
				document.getElementById('pw_cpu').textContent = i.cpu_mhz + ' MHz';
				document.getElementById('pw_bar').style.width = pct + '%';
				document.getElementById('pw_memtxt').textContent = (used / 1024).toFixed(1) + ' / ' + (i.mem_total / 1024).toFixed(1) + ' MB';
				document.getElementById('pw_note').textContent = i.cpu_fixed ? _('MT7620A runs at a fixed 580 MHz; frequency scaling is not supported by the hardware, so the control is disabled.') : '';
				document.getElementById('pw_sys').innerHTML = '<b>' + (i.model || '') + '</b><br>' + (i.release || '') + ' · kernel ' + i.kernel + '<br>' + (i.cpu || '') + ' · RAM ' + i.ram + ' · Flash ' + i.flash;
			});
		};
		poll.add(tick, 3); tick();
		return root;
	},
	handleSave: null, handleSaveApply: null, handleReset: null
});
