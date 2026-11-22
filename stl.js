(() => {
	const PIXEL = 2;
	const TILT = 0.45;
	const SHADES = [[58, 42, 0], [122, 85, 0], [192, 132, 0], [255, 176, 0]];
	const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => v / 16);
	const LIGHT = normalize([-0.4, 0.6, 0.7]);
	const REST = 0.6;

	function normalize(v) {
		const l = Math.hypot(...v) || 1;
		return v.map(c => c / l);
	}

	function parseStl(buf) {
		const view = new DataView(buf);
		const count = buf.byteLength >= 84 ? view.getUint32(80, true) : 0;
		const tris = [];
		if (84 + count * 50 === buf.byteLength) {
			for (let i = 0; i < count; i++) {
				const o = 84 + i * 50 + 12;
				const t = [];
				for (let k = 0; k < 9; k++) t.push(view.getFloat32(o + k * 4, true));
				tris.push(t);
			}
		} else {
			const verts = new TextDecoder().decode(buf).match(/vertex(\s+\S+){3}/g) || [];
			for (let i = 0; i + 2 < verts.length; i += 3) {
				tris.push(verts.slice(i, i + 3).flatMap(v => v.trim().split(/\s+/).slice(1).map(Number)));
			}
		}
		return tris;
	}

	function prepare(tris, flip) {
		if (flip) tris = tris.map(t => t.map((v, k) => k % 3 ? -v : v));
		const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
		for (const t of tris) for (let k = 0; k < 9; k++) {
			min[k % 3] = Math.min(min[k % 3], t[k]);
			max[k % 3] = Math.max(max[k % 3], t[k]);
		}
		const c = min.map((m, a) => (m + max[a]) / 2);
		let r = 0;
		for (const t of tris) for (let k = 0; k < 9; k += 3) {
			r = Math.max(r, Math.hypot(t[k] - c[0], t[k + 1] - c[1], t[k + 2] - c[2]));
		}
		return tris.map(t => {
			const p = t.map((v, k) => (v - c[k % 3]) / r);
			const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]];
			const v = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
			const n = normalize([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
			return { p, n };
		});
	}

	// STL is Z-up; the view spins around Z and looks slightly down, giving [right, up, toward viewer].
	function toView(x, y, z, ca, sa) {
		const rx = x * ca - y * sa, ry = x * sa + y * ca;
		const ct = Math.cos(TILT), st = Math.sin(TILT);
		return [rx, z * ct + ry * st, z * st - ry * ct];
	}

	function render(canvas, model, angle) {
		const w = Math.max(1, Math.round(canvas.clientWidth / PIXEL));
		const h = Math.max(1, Math.round(canvas.clientHeight / PIXEL));
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		const ctx = canvas.getContext('2d');
		const img = ctx.createImageData(w, h);
		const depth = new Float32Array(w * h).fill(-Infinity);
		// The placement attributes are for wide screens; a phone centres the model and keeps it inside the width.
		const narrow = canvas.clientWidth < 640 && canvas.dataset.x;
		const scale = Math.min(w, h) * (narrow ? 0.42 : Number(canvas.dataset.scale) || 0.48);
		const ca = Math.cos(angle), sa = Math.sin(angle);
		const cx = narrow ? 0.5 : Number(canvas.dataset.x) || 0.5, cy = Number(canvas.dataset.y) || 0.5;

		for (const { p, n } of model) {
			const vn = toView(n[0], n[1], n[2], ca, sa);
			const facing = vn[2] < 0 ? -1 : 1;
			const light = 0.2 + 0.8 * Math.max(0, facing * (vn[0] * LIGHT[0] + vn[1] * LIGHT[1] + vn[2] * LIGHT[2]));
			const s = [];
			for (let k = 0; k < 9; k += 3) {
				const v = toView(p[k], p[k + 1], p[k + 2], ca, sa);
				s.push(w * cx + v[0] * scale, h * cy - v[1] * scale, v[2]);
			}
			const [x0, y0, z0, x1, y1, z1, x2, y2, z2] = s;
			const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
			if (area === 0) continue;
			const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
			const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
			const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
			const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
			for (let y = minY; y <= maxY; y++) {
				for (let x = minX; x <= maxX; x++) {
					const px = x + 0.5, py = y + 0.5;
					const a = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
					const b = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
					const c = 1 - a - b;
					if (a < 0 || b < 0 || c < 0) continue;
					const z = a * z0 + b * z1 + c * z2;
					const i = y * w + x;
					if (z <= depth[i]) continue;
					depth[i] = z;
					const level = Math.min(SHADES.length - 1, Math.floor(light * (SHADES.length - 1) + BAYER[(y % 4) * 4 + (x % 4)]));
					const [r, g, bl] = SHADES[level];
					img.data[i * 4] = r;
					img.data[i * 4 + 1] = g;
					img.data[i * 4 + 2] = bl;
					img.data[i * 4 + 3] = 255;
				}
			}
		}
		ctx.putImageData(img, 0, 0);
	}

	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Every model turns while it is on screen; the hero's has a pause button.
	function mount(canvas, model) {
		let angle = REST, last = 0, frame = 0, visible = false, paused = false;
		const pause = canvas.parentElement.querySelector('.loop-pause');
		const runs = () => !still && visible && !paused;
		const tick = t => {
			if (last) angle += (t - last) * 0.0006;
			last = t;
			render(canvas, model, angle);
			frame = runs() ? requestAnimationFrame(tick) : 0;
			if (!frame) last = 0;
		};
		const wake = () => { if (runs() && !frame) frame = requestAnimationFrame(tick); };
		render(canvas, model, angle);
		addEventListener('resize', () => render(canvas, model, angle));
		new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(canvas);
		if (pause) {
			if (still) pause.hidden = true;
			pause.addEventListener('click', () => {
				paused = !paused;
				pause.setAttribute('aria-pressed', String(paused));
				pause.setAttribute('aria-label', paused ? 'Play the turning model' : 'Pause the turning model');
				pause.querySelector('path').setAttribute('d', paused ? 'M3 1h2v12H3zM5 3h2v8H5zM7 5h2v4H7zM9 6h2v2H9z' : 'M3 2h3v10H3zM8 2h3v10H8z');
				wake();
			});
		}
	}

	for (const canvas of document.querySelectorAll('canvas[data-stl]')) {
		fetch(canvas.dataset.stl)
			.then(r => r.arrayBuffer())
			.then(buf => mount(canvas, prepare(parseStl(buf), 'flip' in canvas.dataset)));
	}
})();
