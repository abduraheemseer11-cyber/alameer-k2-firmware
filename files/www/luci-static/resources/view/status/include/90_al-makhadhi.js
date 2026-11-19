'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Firmware'),

	load: function() {
		return Promise.resolve();
	},

	render: function() {
		return E('div', { 'class': 'cbi-section' }, [
			E('p', {}, 'Al-Makhadhi Custom Firmware (Phicomm K2 Edition)'),
			E('p', {}, 'Developed & Customized by Eng. Abdulrahim Al-Makhadhi'),
			E('p', { 'dir': 'rtl' }, '\u0627\u0644\u0645\u0647\u0646\u062f\u0633 \u0639\u0628\u062f \u0627\u0644\u0631\u062d\u064a\u0645 \u0627\u0644\u0645\u0627\u062e\u0630\u064a')
		]);
	}
});
