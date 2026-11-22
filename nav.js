(() => {
	const nav = document.querySelector('.nav');
	const toggle = nav && nav.querySelector('.nav__toggle');
	if (!toggle) return;
	const bars = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 3h12v2H1zM1 9h12v2H1z"/></svg>';
	const cross = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2h2v2H2zM4 4h2v2H4zM6 6h2v2H6zM8 8h2v2H8zM10 10h2v2h-2zM10 2h2v2h-2zM8 4h2v2H8zM4 8h2v2H4zM2 10h2v2H2z"/></svg>';
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
