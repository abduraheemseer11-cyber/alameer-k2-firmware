'use strict';
'require baseclass';

/* ALAMEER SOFTWARE status information panel. */
return baseclass.extend({
	title: _('ALAMEER SOFTWARE'),
	render: function() {
		var rows = [
			[ _('Brand'), 'ALAMEER SOFTWARE' ],
			[ _('Developer'), 'Eng. Abdulrahim Al-Makhadhi (المهندس عبد الرحيم الماخذي)' ],
			[ _('Device'), 'Phicomm K2 · V22.5' ],
			[ _('Firmware'), 'OpenWrt 25.12.6 · ALAMEER Professional' ],
			[ _('Management IP'), '192.168.1.20' ]
		];
		return E('div', { 'class': 'table' }, rows.map(function(r) {
			return E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td left', 'data-title': _('Information') }, r[0]),
				E('div', { 'class': 'td left' }, r[1])
			]);
		}));
	}
});
