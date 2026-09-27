// Conversión a pixel art (docs/correccion-visual.md 11.2): el G-buffer se
// calcula a 4× y se reduce por mayoría de parte y material (no promediando
// colores), los rasgos de la cara se reducen igual y la paleta final se
// limita a 24 colores. Todo sin semitransparencias.
SC.pixel = (() => {
  const M = SC.AM;

  // Reducción del G-buffer por mayoría: cada píxel toma la parte/material/región
  // más frecuente de su bloque si cubre al menos la mitad.
  function downsample(g, SS) {
    const W = g.W / SS, H = g.H / SS, N = W * H;
    const o = {
      W, H,
      // Cámara reducida: project/view son cierres sobre la cámara grande, así
      // que se envuelven para trabajar en píxeles del sprite.
      cam: Object.assign({}, g.cam, {
        W, H, scale: g.cam.scale / SS,
        project: (p) => { const q = g.cam.project(p); return { x: q.x / SS, y: q.y / SS, z: q.z }; },
        view: (px, py) => g.cam.view((px + 0.5) * SS - 0.5, (py + 0.5) * SS - 0.5),
      }),
      depth: new Float32Array(N).fill(NaN), nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N),
      part: new Int16Array(N).fill(-1), mat: new Int8Array(N).fill(-1), region: new Int16Array(N).fill(-1), ao: new Float32Array(N).fill(1), shadow: new Float32Array(N).fill(1),
    };
    const counts = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      counts.clear();
      let hits = 0;
      for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
        const i = (y * SS + yy) * g.W + x * SS + xx;
        if (Number.isNaN(g.depth[i])) continue;
        hits++;
        const key = g.part[i] * 100000 + g.region[i];
        const c = counts.get(key);
        if (c) c.push(i); else counts.set(key, [i]);
      }
      if (hits < SS * SS * 0.5) continue;
      let best = null;
      for (const v of counts.values()) if (!best || v.length > best.length) best = v;
      const j = y * W + x;
      let d = 0, nx = 0, ny = 0, nz = 0, ao = 0, sh = 0;
      for (const i of best) { d += g.depth[i]; nx += g.nx[i]; ny += g.ny[i]; nz += g.nz[i]; ao += g.ao[i]; sh += g.shadow[i]; }
      const n = best.length, l = Math.hypot(nx, ny, nz) || 1;
      o.depth[j] = d / n; o.nx[j] = nx / l; o.ny[j] = ny / l; o.nz[j] = nz / l; o.ao[j] = ao / n; o.shadow[j] = sh / n;
      o.part[j] = g.part[best[0]]; o.mat[j] = g.mat[best[0]]; o.region[j] = g.region[best[0]];
    }
    return o;
  }

  function overlayMajority(ctx, big, W, H, SS) {
    const src = big.getContext('2d').getImageData(0, 0, W * SS, H * SS).data;
    const img = ctx.getImageData(0, 0, W, H);
    const counts = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      counts.clear();
      let n = 0;
      for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
        const i = ((y * SS + yy) * W * SS + x * SS + xx) * 4;
        if (src[i + 3] < 160) continue;
        n++;
        const key = ((src[i] >> 4) << 8) | ((src[i + 1] >> 4) << 4) | (src[i + 2] >> 4);
        const c = counts.get(key);
        if (c) c.n++; else counts.set(key, { n: 1, i });
      }
      if (n < 4) continue;
      let best = null;
      for (const v of counts.values()) if (!best || v.n > best.n) best = v;
      const j = (y * W + x) * 4;
      img.data[j] = src[best.i]; img.data[j + 1] = src[best.i + 1]; img.data[j + 2] = src[best.i + 2]; img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  // 11.2 Paleta máxima: mientras haya más de 'max' colores, el menos usado se
  // funde con el más parecido (distancia en OKLab).
  function limitPalette(ctx, W, H, max) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data, count = new Map();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; count.set(k, (count.get(k) || 0) + 1); }
    if (count.size <= max) return;
    const lab = new Map([...count.keys()].map((k) => {
      const [L, C, h] = M.hexToOklch(M.rgbToHex(k >> 16, (k >> 8) & 255, k & 255));
      return [k, [L, C * Math.cos(M.rad(h)), C * Math.sin(M.rad(h))]];
    }));
    const map = new Map();
    while (count.size > max) {
      let worst = null;
      for (const [k, n] of count) if (!worst || n < worst[1]) worst = [k, n];
      const a = lab.get(worst[0]);
      let best = null;
      for (const k of count.keys()) {
        if (k === worst[0]) continue;
        const b = lab.get(k), e = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        if (!best || e < best[1]) best = [k, e];
      }
      count.delete(worst[0]);
      count.set(best[0], count.get(best[0]) + worst[1]);
      map.set(worst[0], best[0]);
      for (const [from, to] of map) if (to === worst[0]) map.set(from, best[0]);
    }
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] !== 255) continue;
      const to = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (to != null) { d[i] = to >> 16; d[i + 1] = (to >> 8) & 255; d[i + 2] = to & 255; }
    }
    ctx.putImageData(img, 0, 0);
  }

  return { downsample, overlayMajority, limitPalette };
})();
