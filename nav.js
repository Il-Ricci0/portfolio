(() => {
	const nav = document.querySelector('.nav');
	const toggle = nav && nav.querySelector('.nav__toggle');
	if (!toggle) return;
	const bars = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
	const cross = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
	const set = open => {
		nav.classList.toggle('is-open', open);
		document.body.classList.toggle('nav-locked', open);
		toggle.setAttribute('aria-expanded', String(open));
		toggle.innerHTML = open ? cross : bars;
	};
	toggle.addEventListener('click', () => set(!nav.classList.contains('is-open')));
	nav.querySelectorAll('.nav__item').forEach(item => {
		const link = item.querySelector('.nav__link');
		if (!link || !item.querySelector('.nav__menu')) return;
		const btn = document.createElement('button');
		btn.className = 'nav__expand';
		btn.type = 'button';
		btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
		btn.setAttribute('aria-label', `Show ${link.textContent.trim()} links`);
		btn.setAttribute('aria-expanded', 'false');
		link.after(btn);
		btn.addEventListener('click', () => {
			const open = !item.classList.contains('is-expanded');
			item.classList.toggle('is-expanded', open);
			btn.setAttribute('aria-expanded', String(open));
		});
	});
	nav.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => set(false)));
	addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
	matchMedia('(min-width: 1024px)').addEventListener('change', () => set(false));
})();
