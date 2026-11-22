(() => {
	const nav = document.querySelector('.nav');
	const toggle = nav && nav.querySelector('.nav__toggle');
	if (!toggle) return;
	const set = open => {
		nav.classList.toggle('is-open', open);
		document.body.classList.toggle('nav-locked', open);
		toggle.setAttribute('aria-expanded', String(open));
	};
	toggle.addEventListener('click', () => set(!nav.classList.contains('is-open')));
	nav.querySelectorAll('.nav__links a').forEach(a => a.addEventListener('click', () => set(false)));
	addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
	matchMedia('(min-width: 1024px)').addEventListener('change', () => set(false));
})();
