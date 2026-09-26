// Motor anatómico SDF: esqueleto medido (base matemática) → superficie SDF con
// unión suave → G-buffer (WebGL o CPU) → sombreado cel y líneas → cara
// proyectada. Implementa docs/correccion-visual.md; el motor de volúmenes
// anterior se conserva como «clásico» para comparar.
SC.sdfEngine = (() => {
  const M = SC.AM, B = SC.anatBody, R = SC.anatRig;

  const KINDS = { 0: 'skin', 1: 'hair', 2: 'cloth', 3: 'cloth', 4: 'cloth', 5: 'cloth', 6: 'cloth' };

  function config(a) {
    const c = SC.anat.config(a || {});
    return c;
  }

  // Escena completa: cuerpo, ropa y pelo.
  function buildScene(f, look, lod) {
    const body = SC.sdfBuild.scene(f, { lod });
    const clothes = SC.sdfClothes.parts(f, body, look);
    const hair = SC.sdfHair.parts(f, body, look.hairStyle);
    return SC.SDF.finalize({ parts: body.parts.concat(clothes, hair) });
  }

  // 6.5 Encuadres en unidades del modelo.
  function frameBox(sk, frame) {
    const T = sk.T;
    if (frame === 'bust') return { top: T + 0.15, bottom: sk.yT(0.45), width: sk.w.shoulders + 0.8 };
    return { top: T + 0.25, bottom: -0.12, width: Math.max(sk.w.shoulders, sk.w.hip) + 1.6 };
  }

  function gbuffer(scene, cam, o) {
    return (o.cpu ? null : SC.sdfGL.gbuffer(scene, cam, o)) || SC.sdfMarch.gbuffer(scene, cam, o);
  }

  // Render de un fotograma. o: { W, H, view, frame, tilt, pixel, expression, styleOverride, lineScale, cpu }
  function render(a, animId, t, o) {
    const cfg = config(a), look = cfg.look;
    const params = Object.assign({}, cfg.params, o.styleOverride ? { style: o.styleOverride } : {});
    const sk = B.skeleton(params);
    const pose = R.animate(sk, animId || 'idle', t || 0);
    const f = R.solve(sk, pose);
    const box = frameBox(sk, o.frame);
    const scale = Math.min(o.H / (box.top - box.bottom), o.W / box.width);
    const yaw = (SC.VIEWS[o.view || 'front'] || SC.VIEWS.front).yaw;
    const cam = SC.sdfMarch.camera(yaw, o.tilt != null ? o.tilt : 0.05, o.W, o.H, { cx: 0, cy: (box.top + box.bottom) / 2, scale });
    const handPx = sk.bones.hand * scale / (o.ss || 1);
    const scene = buildScene(f, look, handPx);
    const g = gbuffer(scene, cam, { ao: true, shadow: true, cpu: o.cpu });
    const weights = Object.assign({}, SC.CANON.expressions[o.expression] || {}, pose.face || {});
    return { g, scene, f, sk, cam, look, weights, scale };
  }

  const colorsOf = (look) => ({ 0: look.skin, 1: look.hair, 2: look.top, 3: look.bottom, 4: look.shoes, 5: look.tie || '#e0445e', 6: '#3a2b2b' });

  function renderView(ch, W, H, pose, o = {}) {
    const a = (ch && ch.anat) || {};
    const r = render(a, pose && pose.animId, pose && pose.t, Object.assign({}, o, { W, H, expression: o.expression || (ch && ch.expression) }));
    const out = SC.sdfCompose.compose(r.g, { colors: colorsOf(r.look), kinds: KINDS, spriteHeight: H, lineScale: o.lineWidth != null ? o.lineWidth : 1, hairMat: 1 });
    SC.sdfFace.draw(out.canvas.getContext('2d'), r.g, r.scene, r.f, { look: r.look, weights: r.weights, lineW: Math.max(1, 0.004 * H) });
    return out.canvas;
  }

  function renderVN(ch, pose, o = {}) {
    const scale = o.scale || 1, Hh = Math.round((o.height || SC.CANVAS_H) * scale);
    const W = Math.round(Hh * (o.frame === 'bust' ? 0.85 : 0.6));
    return renderView(ch, W, Hh, pose, Object.assign({}, o, { lineWidth: ch && ch.style ? ch.style.lineWidth : 1 }));
  }

  // 11.2 Pixel art: G-buffer a 4× y reducción por mayoría de material (no
  // promedio de color), 3 tonos, línea de 1 px desde el buffer y cara con
  // sellos (cabezas < 16 px) o rasgos reducidos por mayoría.
  function renderPixelGeneric(ch, pose, o, frame) {
    const W = o.w || 48, H = o.h || 64, SS = 4, a = (ch && ch.anat) || {};
    const style = frame === 'full' && o.chibi ? (H <= 48 ? 'chibi' : 'pixel64') : null;
    const r = render(a, pose && pose.animId, pose && pose.t, { W: W * SS, H: H * SS, view: o.view, frame, tilt: frame === 'full' ? 0.2 : 0.05, styleOverride: style, expression: o.expression || (ch && ch.expression), ss: SS, cpu: o.cpu });
    const g = downsample(r.g, SS);
    const out = SC.sdfCompose.compose(g, { colors: colorsOf(r.look), kinds: KINDS, pixel: true, spriteHeight: H, hairMat: 1 });
    const ctx = out.canvas.getContext('2d');
    const headPx = r.sk.H * r.scale / SS;
    if (headPx < 16) SC.sdfFace.stamps(ctx, g, r.scene, r.f, { look: r.look, weights: r.weights }, headPx);
    else {
      // Rasgos dibujados a 4× y reducidos por mayoría sobre la piel.
      const big = SC.render.makeCanvas(W * SS, H * SS);
      SC.sdfFace.draw(big.getContext('2d'), r.g, r.scene, r.f, { look: r.look, weights: r.weights, lineW: SS * 1.1, pixel: true });
      overlayMajority(ctx, big, W, H, SS);
    }
    limitPalette(ctx, W, H, 24);
    return out.canvas;
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

  const renderPixel = (ch, pose, o = {}) => renderPixelGeneric(ch, pose, o, 'full');
  const renderPixelPortrait = (ch, pose, o = {}) => renderPixelGeneric(ch, pose, Object.assign({ w: 128, h: 160 }, o), 'bust');

  function renderAnimation(ch, animId, mode, o = {}) {
    const n = SC.ANIMS[animId] ? SC.ANIMS[animId].frames : 4, frames = [];
    for (let i = 0; i < n; i++) {
      const pose = { animId, t: i / n };
      frames.push(mode === 'pixel' ? (o.portrait ? renderPixelPortrait(ch, pose, o) : renderPixel(ch, pose, o)) : renderVN(ch, pose, o));
    }
    return frames;
  }

  // Vista de depuración del G-buffer (normales, partes, materiales, profundidad).
  function debugView(ch, W, H, pose, o = {}) {
    const r = render((ch && ch.anat) || {}, pose && pose.animId, pose && pose.t, Object.assign({}, o, { W, H }));
    const g = r.g, cv = SC.render.makeCanvas(W, H), x = cv.getContext('2d'), img = x.createImageData(W, H);
    const mode = o.debug || 'normal';
    for (let i = 0; i < W * H; i++) {
      if (Number.isNaN(g.depth[i])) continue;
      let c;
      if (mode === 'normal') c = [(g.nx[i] * 0.5 + 0.5) * 255, (g.ny[i] * 0.5 + 0.5) * 255, (g.nz[i] * 0.5 + 0.5) * 255];
      else if (mode === 'depth') { const v = M.clamp((g.depth[i] - 19) * 120 + 128, 0, 255); c = [v, v, v]; }
      else { const k = mode === 'material' ? g.mat[i] : g.part[i]; c = [(k * 97) % 255, (k * 57 + 80) % 255, (k * 151 + 40) % 255]; }
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    x.putImageData(img, 0, 0);
    return cv;
  }

  return { render, buildScene, limitPalette, renderView, renderVN, renderPixel, renderPixelPortrait, renderAnimation, debugView, downsample, frameBox, KINDS, colorsOf };
})();
