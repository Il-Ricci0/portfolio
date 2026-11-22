(() => {
	const SHADES = [null, [58, 42, 0], [122, 85, 0], [192, 132, 0], [255, 176, 0]];
	const GRAVITY = 600;
	const JUMP = 190;
	const AIRTIME = 2 * JUMP / GRAVITY;
	const SPEED_START = 70;
	const SPEED_END = 115;

	// Sprites as rows of shade digits: 0 empty, 1 darkest to 4 brightest. Facing right.
	const sprite = rows => rows.map(r => [...r].map(Number));
	const HOG_BODY = sprite([
		'0000202020200000',
		'0020232323220000',
		'0223232323232000',
		'2232323232324400',
		'2323232323244440',
		'3232323232441440',
		'2323232323444441',
		'0232323234444400',
		'0034444444444000',
	]);
	const HOG_LEGS = [
		sprite(['0040400000404000', '0040000000040000']),
		sprite(['0004040000040400', '0000400000004000']),
	];
	const OBSTACLES = {
		mushroom: sprite([
			'00444400',
			'04414440',
			'44444144',
			'41444444',
			'00033000',
			'00033000',
			'00033000',
			'00333300',
		]),
		rock: sprite([
			'0002333000',
			'0233333320',
			'2333433332',
			'2334443332',
			'2233333322',
			'1222222221',
		]),
		stump: sprite([
			'0333333000000',
			'3444444300044',
			'3433334300434',
			'3333333304340',
			'2323232302400',
			'3232323222000',
			'2323232320000',
			'3232323200000',
			'2323232300000',
			'3232323200000',
			'2323232300000',
			'3232323200000',
			'2232323200000',
			'1222222100000',
		]),
		pair: sprite([
			'004444000444400',
			'044144404414440',
			'444441444441444',
			'000330000033000',
			'000330000033000',
			'003333000333300',
		]),
	};
	const CLOUD = sprite([
		'0001111000000',
		'0111111110000',
		'1111111111110',
	]);
	const DIGITS = {
		0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
		2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
		4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
		6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
		8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
		H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'], ' ': ['000', '000', '000', '000', '000'],
	};

	// The level: gaps (in pixels before each obstacle) and kinds, played in order and then from the top.
	const LEVEL = [
		[120, 'mushroom'], [110, 'rock'], [150, 'stump'], [95, 'mushroom'], [140, 'pair'],
		[100, 'rock'], [130, 'mushroom'], [160, 'stump'], [105, 'rock'], [120, 'pair'],
		[90, 'mushroom'], [140, 'stump'], [110, 'rock'], [150, 'pair'], [100, 'mushroom'],
		[130, 'stump'], [95, 'rock'], [160, 'pair'], [110, 'mushroom'], [180, 'stump'],
	];
	const LEVEL_LENGTH = LEVEL.reduce((sum, [gap]) => sum + gap, 0);

	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

	function mount(canvas) {
		const ctx = canvas.getContext('2d');
		const pause = canvas.parentElement.querySelector('.loop-pause');
		let w = 0, h = 0, ground = 0, hogX = 0, right = 4, sky = 6;
		let img, data;
		let state;

		function reset() {
			state = { dist: 0, next: 0, lastAt: w * 0.6, obstacles: [], y: 0, vy: 0, step: 0, roll: 0, clouds: [], best: state ? state.best : 0 };
			for (let i = 0; i < 4; i++) state.clouds.push({ x: (i + 0.3) * w / 3, y: sky + (i * 7) % 18 });
		}

		function resize() {
			const px = Math.max(2, Math.round(Math.min(canvas.clientHeight, canvas.clientWidth * 0.8, 480) / 72));
			w = Math.max(1, Math.round(canvas.clientWidth / px));
			h = Math.max(1, Math.round(canvas.clientHeight / px));
			canvas.width = w;
			canvas.height = h;
			ground = h - 12;
			// Behind the hero's words the sky starts lower, so the score and clouds stay clear of the text.
			sky = Math.max(6, ground - 45);
			// The hedgehog and the score sit on the page's content edges while the ground runs the full width.
			const wrap = canvas.closest('.hero')?.querySelector('.wrap');
			const box = canvas.getBoundingClientRect(), lines = wrap ? wrap.getBoundingClientRect() : box;
			hogX = Math.max(2, Math.round((lines.left - box.left) / px));
			right = Math.max(2, Math.round((box.right - lines.right) / px));
			img = ctx.createImageData(w, h);
			data = img.data;
		}

		function plot(x, y, shade) {
			x = Math.round(x);
			y = Math.round(y);
			if (!shade || x < 0 || y < 0 || x >= w || y >= h) return;
			const i = (y * w + x) * 4, c = SHADES[shade];
			data[i] = c[0];
			data[i + 1] = c[1];
			data[i + 2] = c[2];
			data[i + 3] = 255;
		}

		function blit(rows, x, y) {
			rows.forEach((row, j) => row.forEach((s, i) => plot(x + i, y + j, s)));
		}

		function text(str, x, y, shade) {
			for (const ch of str) {
				DIGITS[ch].forEach((row, j) => [...row].forEach((on, i) => { if (on === '1') plot(x + i, y + j, shade); }));
				x += 4;
			}
		}

		// The jump: the hedgehog curls into a ball whose spines turn as it rolls.
		function ball(cx, cy, turn) {
			for (let y = -6; y <= 6; y++) {
				for (let x = -6; x <= 6; x++) {
					const r = Math.hypot(x, y);
					if (r > 6.2) continue;
					const a = Math.atan2(y, x) + turn;
					const spine = (Math.floor(a / (Math.PI / 5) + 10) + Math.floor(r / 2)) % 2;
					plot(cx + x, cy + y, r > 5.2 ? 2 : spine ? 3 : 2);
				}
			}
			plot(cx + 3, cy - 1, 4);
			plot(cx + 4, cy - 1, 4);
			plot(cx + 4, cy, 1);
		}

		function speed() {
			return SPEED_START + (SPEED_END - SPEED_START) * (state.dist / LEVEL_LENGTH);
		}

		function update(dt) {
			const v = speed();
			state.dist += v * dt;
			if (state.dist >= LEVEL_LENGTH) {
				state.best = Math.max(state.best, Math.floor(state.dist / 4));
				reset();
				return;
			}
			while (state.next < LEVEL.length) {
				const [gap, kind] = LEVEL[state.next];
				const at = state.lastAt + gap;
				if (at - state.dist > w + 40) break;
				state.obstacles.push({ at, kind });
				state.lastAt = at;
				state.next++;
			}
			state.obstacles = state.obstacles.filter(o => o.at - state.dist > -30);

			// Jump so the top of the arc sits over the middle of the next obstacle.
			if (state.y === 0) {
				const next = state.obstacles.find(o => o.at - state.dist + OBSTACLES[o.kind][0].length > hogX);
				if (next) {
					const ow = OBSTACLES[next.kind][0].length;
					const gapToCentre = next.at - state.dist + ow / 2 - (hogX + 8);
					if (gapToCentre <= v * AIRTIME / 2) state.vy = JUMP;
				}
			}
			if (state.vy !== 0 || state.y > 0) {
				state.y += state.vy * dt;
				state.vy -= GRAVITY * dt;
				if (state.y <= 0) {
					state.y = 0;
					state.vy = 0;
				}
				state.roll += v * dt / 6;
			} else {
				state.step += v * dt;
			}
			for (const c of state.clouds) {
				c.x -= v * 0.15 * dt;
				if (c.x < -CLOUD[0].length) c.x += w + CLOUD[0].length * 2;
			}
		}

		function draw() {
			data.fill(0);
			for (const c of state.clouds) blit(CLOUD, c.x, c.y);
			for (let x = 0; x < w; x++) {
				const g = Math.floor(x + state.dist);
				plot(x, ground, g % 23 < 19 ? 2 : 1);
				if (g % 7 === 0) plot(x, ground + 3, 1);
				if (g % 13 === 4) plot(x, ground + 6, 1);
				if (g % 17 === 9) plot(x, ground + 10, 1);
			}
			for (const o of state.obstacles) {
				const s = OBSTACLES[o.kind];
				blit(s, o.at - state.dist, ground - s.length + 1);
			}
			if (state.y > 0) {
				ball(hogX + 8, ground - 6 - state.y, state.roll);
			} else {
				const legs = HOG_LEGS[Math.floor(state.step / 6) % 2];
				blit(HOG_BODY, hogX, ground - HOG_BODY.length - legs.length + 1);
				blit(legs, hogX, ground - legs.length + 1);
			}
			const score = String(Math.floor(state.dist / 4)).padStart(5, '0');
			const best = state.best ? `HI ${String(state.best).padStart(5, '0')}  ` : '';
			text(best + score, w - (best.length + 5) * 4 + 1 - right, sky - 2, 3);
			ctx.putImageData(img, 0, 0);
		}

		resize();
		reset();
		if (still) {
			state.dist = 60;
			update(0);
			state.obstacles = state.obstacles.slice(0, 3);
		}
		draw();

		let frame = 0, last = 0, visible = false, paused = false;
		const runs = () => !still && visible && !paused;
		const tick = t => {
			const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
			last = t;
			update(dt);
			draw();
			frame = runs() ? requestAnimationFrame(tick) : 0;
			if (!frame) last = 0;
		};
		const wake = () => { if (runs() && !frame) frame = requestAnimationFrame(tick); };
		const refit = () => { resize(); draw(); };
		new ResizeObserver(refit).observe(canvas);
		addEventListener('load', refit);
		new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(canvas);
		if (pause) {
			if (still) pause.hidden = true;
			pause.addEventListener('click', () => {
				paused = !paused;
				pause.setAttribute('aria-pressed', String(paused));
				pause.setAttribute('aria-label', paused ? 'Play the hedgehog run' : 'Pause the hedgehog run');
				pause.querySelector('path').setAttribute('d', paused ? 'M3 1h2v12H3zM5 3h2v8H5zM7 5h2v4H7zM9 6h2v2H9z' : 'M3 2h3v10H3zM8 2h3v10H8z');
				wake();
			});
		}
	}

	for (const canvas of document.querySelectorAll('canvas[data-runner]')) mount(canvas);
})();
