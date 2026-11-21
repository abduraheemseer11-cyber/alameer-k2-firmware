'use strict';
'require baseclass';

/* Extra block on Status → Overview: firmware / developer credit */

return baseclass.extend({
	title: _('Alameer Software'),

	render: function() {
		var rows = [
			[ _('Brand'), 'Alameer Software' ],
			[ _('Engineer'), 'AbduRaheem Al-Maakhathi (عبد الرحيم الماخذي)' ],
			[ _('Contact / WhatsApp'), '776538297' ],
			[ _('Firmware'), 'OpenWrt 25.12.6 · Phicomm K2 v22.5 · WISP edition' ]
		];

		return E('div', { 'class': 'table' }, rows.map(function(r) {
			return E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td left', 'width': '33%', 'data-title': _('Info') }, r[0]),
				E('div', { 'class': 'td left' }, r[1])
			]);
		}));
	}
});
