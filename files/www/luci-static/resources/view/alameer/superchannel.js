'use strict';
'require view';
'require uci';
'require ui';

var COUNTRIES = ['JP', 'US', 'DE', 'ZZ'];

return view.extend({
	load: function () { return uci.load(['wireless', 'alameer']); },
	render: function () {
		var radios = uci.sections('wireless', 'wifi-device');
		var ack = E('input', { type: 'checkbox', id: 'sc_ack' });
		var cards = radios.map(function (r) {
			var n = r['.name'];
			return E('div', { 'class': 'al-card' }, [E('h3', {}, n + (n === 'radio0' ? ' — 2.4GHz (MT7620A)' : ' — 5GHz (MT7612E)')),
				E('div', { 'class': 'al-row' }, [E('label', {}, _('Country code')), E('select', { id: 'sc_cc_' + n }, COUNTRIES.map(function (c) { return E('option', { value: c, selected: c === r.country }, c + (c === 'ZZ' ? ' (custom regdb)' : '')); }))]),
				E('div', { 'class': 'al-row' }, [E('label', {}, _('TX power (dBm)')), E('input', { id: 'sc_tx_' + n, type: 'number', min: 1, max: 30, value: r.txpower || 20 })]),
				E('div', { 'class': 'al-row' }, [E('label', {}, _('Current')), E('span', {}, (r.country || '-') + ' / ' + (r.txpower || 'auto') + ' dBm')])]);
		});
		return E('div', {}, [E('h2', {}, _('Super Channel')), 
			E('div', { 'class': 'al-warn' }, _('ZZ opens extra channels and up to 30 dBm and needs the custom regulatory.db (build with BUILD_REGDB=1). Operating outside your national regulations may be illegal; you are solely responsible.')),
		].concat(cards, [
			E('div', { 'class': 'al-row' }, [ack, E('label', { 'for': 'sc_ack' }, _('I accept responsibility for compliance with local regulations'))]),
			E('div', { 'class': 'al-row' }, [
				E('button', { 'class': 'cbi-button cbi-button-action', click: function () {
					if (!document.getElementById('sc_ack').checked) return ui.addNotification(null, E('p', _('You must accept responsibility first.')), 'warning');
					radios.forEach(function (r) {
						var n = r['.name'];
						uci.set('alameer', 'superchannel', 'prev_' + n + '_country', r.country || '');
						uci.set('alameer', 'superchannel', 'prev_' + n + '_txpower', r.txpower || '');
						uci.set('wireless', n, 'country', document.getElementById('sc_cc_' + n).value);
						uci.set('wireless', n, 'txpower', document.getElementById('sc_tx_' + n).value);
					});
					uci.set('alameer', 'superchannel', 'has_backup', '1');
					uci.save(); return ui.changes.apply(true);
				} }, _('Apply')),
				E('button', { 'class': 'cbi-button cbi-button-negative', click: function () {
					if (uci.get('alameer', 'superchannel', 'has_backup') !== '1') return ui.addNotification(null, E('p', _('No previous settings saved.')), 'info');
					radios.forEach(function (r) {
						var n = r['.name'], c = uci.get('alameer', 'superchannel', 'prev_' + n + '_country'), t = uci.get('alameer', 'superchannel', 'prev_' + n + '_txpower');
						c ? uci.set('wireless', n, 'country', c) : uci.unset('wireless', n, 'country');
						t ? uci.set('wireless', n, 'txpower', t) : uci.unset('wireless', n, 'txpower');
					});
					uci.save(); return ui.changes.apply(true);
				} }, _('Rollback'))])]));
	},
	handleSave: null, handleSaveApply: null, handleReset: null
});
