/* Runs in <head>: enforce a real device-width viewport before first paint. */
(function () {
	var d = document.documentElement, t = 'light';

	/* Some mobile browsers can request a desktop layout viewport. Restore the
	 * device-width viewport even when the user agent requests desktop pages. */
	var viewport = document.querySelector('meta[name="viewport"]');
	if (!viewport && document.head) {
		viewport = document.createElement('meta');
		viewport.name = 'viewport';
		document.head.appendChild(viewport);
	}
	if (viewport)
		viewport.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');

	function syncViewportClass() {
		var sw = (window.screen && window.screen.width) ? window.screen.width : window.innerWidth;
		var mobile = (sw <= 700) || (window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
		d.classList.toggle('amk-mobile-viewport', !!mobile);
	}

	try { t = window.localStorage.getItem('amk-theme') || 'light'; } catch (e) {}
	d.setAttribute('data-amk-theme', t);
	d.setAttribute('data-darkmode', t === 'dark' ? 'true' : 'false');
	var l = String(d.getAttribute('lang') || '').slice(0, 2).toLowerCase();
	if (['ar', 'he', 'fa', 'ur'].indexOf(l) > -1) d.setAttribute('dir', 'rtl');

	syncViewportClass();
	window.addEventListener('resize', syncViewportClass);
	window.addEventListener('orientationchange', syncViewportClass);
})();
