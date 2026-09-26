// Composición a partir del G-buffer (secciones 3 y 9 de docs/correccion-visual.md):
// iluminación cel con umbral suavizado por región, limpieza de manchas
// pequeñas, sombras proyectadas y oclusión, color por material con rampas
// OKLCH, y líneas detectadas en el buffer (silueta, oclusión, cambio de
// material, pliegue) con grosor variable. Nunca hay línea donde dos
// primitivas del mismo material se funden: así desaparecen las costuras.
SC.sdfCompose = (() => {
  const M = SC.AM;

  // ---------- 9.4 Color de sombra por material ----------
  function tones(hex, kind) {
    const [L, C, h] = M.hexToOklch(hex);
    const dark = L < 0.35;
    if (kind === 'skin') {
      // Hacia rojo-rosa con algo más de croma: nunca gris ni azul.
      const toward = (h2, a) => h2 + ((((25 - h2 + 540) % 360) - 180) * a);
      return {
        hi: M.oklchToHex([Math.min(0.98, L + 0.05), C * 0.95, h]),
        base: hex,
        shadow: M.oklchToHex([L - 0.10, C * 1.1 + 0.01, toward(h, 0.35)]),
        deep: M.oklchToHex([L - 0.19, C * 1.15 + 0.01, toward(h, 0.5)]),
      };
    }
    if (dark) {
      // Negro o gris oscuro: luz más clara y azulada, sombra con L ≥ 0.18.
      const Lb = Math.max(L, 0.24);
      return {
        hi: M.oklchToHex([Lb + 0.18, C + 0.02, h]),
        base: M.oklchToHex([Lb + 0.12, C + 0.015, 255]),
        shadow: M.oklchToHex([Math.max(0.18, Lb), C, 265]),
        deep: M.oklchToHex([Math.max(0.18, Lb - 0.04), C, 270]),
      };
    }
    return { hi: M.ramp(hex, 0.6), base: hex, shadow: M.ramp(hex, -1), deep: M.ramp(hex, -2) };
  }

  // 3.3 Color de línea: el relleno oscurecido (L × 0.45, C × 0.8), piel hacia el rojo.
  function lineColor(hex, kind) {
    const [L, C, h] = M.hexToOklch(hex);
    const hh = kind === 'skin' ? h + ((((25 - h + 540) % 360) - 180) > 0 ? 10 : -10) : h;
    return M.oklchToHex([Math.max(0.12, L * 0.45), C * 0.8, hh]);
  }

  // Desenfoque de la iluminación sólo dentro de la misma región (9.2).
  function regionBlur(I, key, W, H, r) {
    if (r < 1) return I;
    const tmp = new Float32Array(I.length), out = new Float32Array(I.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = key[i];
      if (k < 0) continue;
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= W) continue; const j = i + d; if (key[j] === k) { s += I[j]; n++; } }
      tmp[i] = s / n;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = key[i];
      if (k < 0) continue;
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= H) continue; const j = i + d * W; if (key[j] === k) { s += tmp[j]; n++; } }
      out[i] = s / n;
    }
    return out;
  }

  // Apertura morfológica simple: las islas de tono más pequeñas que minArea
  // toman el tono dominante de su borde (9.2). Recorre cada componente entera.
  function removeIslands(T, key, W, H, minArea) {
    const seen = new Uint8Array(T.length), stack = [], comp = [];
    for (let s = 0; s < T.length; s++) {
      if (key[s] < 0 || seen[s]) continue;
      comp.length = 0; stack.length = 0; stack.push(s); seen[s] = 1;
      const t0 = T[s], k0 = key[s], border = new Map();
      while (stack.length) {
        const i = stack.pop();
        comp.push(i);
        const x = i % W;
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          if (j < 0 || j >= T.length || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
          if (key[j] !== k0) continue;
          if (T[j] === t0) { if (!seen[j]) { seen[j] = 1; stack.push(j); } } else border.set(T[j], (border.get(T[j]) || 0) + 1);
        }
      }
      if (comp.length > minArea || !border.size) continue;
      let best = t0, bn = -1;
      for (const [t, n] of border) if (n > bn) { bn = n; best = t; }
      for (const i of comp) T[i] = best;
    }
  }

  // o: { colors: {mat: hex}, kinds: {mat: 'skin'|'hair'|'cloth'}, lineScale, pixel, style: 'anime'|'painted' }
  // Iluminación y tonos por píxel (sin dibujar): se puede probar sin navegador.
  function shade(g, o) {
    const { W, H } = g, N = W * H, cam = g.cam, L = cam.light, Hu = cam.scale; // píxeles por H
    const pixel = !!o.pixel;
    const matKey = new Int16Array(N);
    for (let i = 0; i < N; i++) matKey[i] = Number.isNaN(g.depth[i]) ? -1 : g.region[i] >= 100 ? g.region[i] : g.mat[i];
    // 9.1 Iluminación envolvente y sombra proyectada.
    let I = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (matKey[i] < 0) continue;
      const ndl = g.nx[i] * L[0] + g.ny[i] * L[1] + g.nz[i] * L[2];
      // Sombra proyectada con borde limpio y sin ennegrecer: sólo baja un tono.
      const sh = M.clamp((g.shadow[i] - 0.2) / 0.4, 0, 1);
      I[i] = M.clamp((ndl + 0.3) / 1.3, 0, 1) * (0.4 + 0.6 * sh);
    }
    if (!pixel) I = regionBlur(I, matKey, W, H, Math.round(0.01 * Hu));
    // Tonos: 0 luz, 1 sombra, 2 sombra profunda (oclusión); en pixel art 3 tonos.
    const T = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (matKey[i] < 0) continue;
      if (pixel) T[i] = I[i] > 0.65 ? 3 : I[i] > 0.30 ? 0 : 1;
      else T[i] = I[i] > 0.45 ? 0 : 1;
      if (g.ao[i] < 0.45 && T[i] === 1) T[i] = 2;
    }
    // 5.5 Anillo de brillo del pelo: donde n·h > 0.85 (h entre la luz y la vista).
    if (o.hairMat != null) {
      const hh = M.norm([L[0], L[1], L[2] + 1]);
      for (let i = 0; i < N; i++) {
        if (g.mat[i] !== o.hairMat || T[i] === 2) continue;
        if (g.nx[i] * hh[0] + g.ny[i] * hh[1] + g.nz[i] * hh[2] > 0.85 && g.shadow[i] > 0.5) T[i] = 3;
      }
    }
    // Limpieza al final, para que tampoco queden motas del brillo. Dos pasadas:
    // una isla absorbida puede dejar otra suelta dentro.
    if (!pixel) for (let k = 0; k < 2; k++) removeIslands(T, matKey, W, H, Math.max(3, Math.round(0.002 * Hu * Hu)));
    return { T, I, matKey };
  }

  function compose(g, o) {
    const { W, H } = g, N = W * H;
    const { T, I, matKey } = shade(g, o);
    // Color.
    const pal = {};
    for (const [m, hex] of Object.entries(o.colors)) pal[m] = tones(hex, o.kinds[m]);
    const cv = SC.render.makeCanvas(W, H), ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), px = img.data;
    const rgbCache = new Map();
    const rgb = (hex) => { let v = rgbCache.get(hex); if (!v) { v = M.hexToRgb(hex); rgbCache.set(hex, v); } return v; };
    for (let i = 0; i < N; i++) {
      const m = g.mat[i];
      if (matKey[i] < 0 || !pal[m]) continue;
      const p = pal[m], t = T[i];
      const c = rgb(t === 0 ? p.base : t === 1 ? p.shadow : t === 2 ? p.deep : p.hi);
      px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    drawLines(ctx, g, matKey, I, pal, o);
    return { canvas: cv, T, I, matKey };
  }

  // ---------- 3 Líneas ----------
  // 3.1 Detección de líneas en el G-buffer: silueta, oclusión (salto de
  // profundidad > 0.05 H), cambio de material, mechones y pliegues (> 50°).
  function detectLines(g, matKey, I, o = {}) {
    // Umbrales en H, pero nunca por debajo de lo que sube una superficie
    // inclinada en un píxel: en sprites pequeños (≈12 px por cabeza) 0.05 H es
    // menos de un píxel y toda la cara saldría rayada.
    const { W, H } = g, pixel = !!o.pixel, px = 1 / g.cam.scale;
    const depthJump = Math.max(0.05, 2.5 * px), hairJump = Math.max(0.01, 1.2 * px);
    const n = (i) => [g.nx[i], g.ny[i], g.nz[i]];
    const marks = []; // [índice, factor de grosor, tipo]
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (matKey[i] < 0) {
          continue;
        }
        let best = 0, type = '';
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) { if (best < 1) { best = 1; type = 'silueta'; } continue; }
          const j = yy * W + xx;
          if (matKey[j] < 0) { if (best < 1) { best = 1; type = 'silueta'; } continue; } // silueta exterior
          const dz = g.depth[i] - g.depth[j];
          if (dz > depthJump) { if (best < 0.75) { best = 0.75; type = 'oclusion'; } continue; } // oclusión: la línea va en lo que está delante
          if (dz < -depthJump) continue;
          if (g.mat[i] !== g.mat[j]) { if ((g.mat[i] > g.mat[j] || g.depth[i] >= g.depth[j]) && best < 0.5) { best = 0.5; type = 'material'; } continue; }
          if (matKey[i] !== matKey[j]) { if (Math.abs(dz) > hairJump && dz > 0 && best < 0.5) { best = 0.5; type = 'mechon'; } continue; }
          if (!pixel && o.creases !== false) {
            const a = n(i), b = n(j);
            if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0.64 && dz >= 0 && best < 0.35) { best = 0.35; type = 'pliegue'; }
          }
        }
        if (best > 0) marks.push([i, best, type]);
      }
    }
    return marks;
  }

  function drawLines(ctx, g, matKey, I, pal, o) {
    const { W, H } = g;
    const pixel = !!o.pixel;
    const P = o.spriteHeight || H;
    const Wb = pixel ? 1 : Math.max(1, 0.004 * P) * (o.lineScale != null ? o.lineScale : 1);
    // Profundidad normalizada para adelgazar lo lejano.
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < g.depth.length; i++) if (matKey[i] >= 0) { zmin = Math.min(zmin, g.depth[i]); zmax = Math.max(zmax, g.depth[i]); }
    const zr = Math.max(1e-6, zmax - zmin);
    const lc = new Map();
    const colorOf = (i) => {
      const m = g.mat[i], key = m + (o.kinds[m] || '');
      if (!lc.has(key)) lc.set(key, pal[m] ? lineColor(pal[m].base, o.kinds[m]) : '#3a2a3a');
      return lc.get(key);
    };
    const marks = detectLines(g, matKey, I, o).map(([i, factor, type]) => {
      const x = i % W, y = (i - x) / W;
      const zN = (zmax - g.depth[i]) / zr;
      const wf = pixel ? 1 : Wb * factor * (0.7 + 0.6 * (1 - I[i])) * (1 - 0.3 * zN);
      return [x, y, wf, colorOf(i), type];
    });
    if (pixel) {
      // Contorno selectivo de 1 px: en el lado iluminado usa el tono de sombra del material.
      const img = ctx.getImageData(0, 0, W, H), d = img.data;
      for (const [x, y, , col] of marks) {
        const i = y * W + x, lit = I[i] > 0.6 && pal[g.mat[i]];
        const c = M.hexToRgb(lit ? pal[g.mat[i]].deep : col);
        d.set([c[0], c[1], c[2], 255], i * 4);
      }
      ctx.putImageData(img, 0, 0);
      return;
    }
    for (const [x, y, w, col] of marks) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, Math.max(0.5, w / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { compose, shade, detectLines, tones, lineColor };
})();
