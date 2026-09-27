// Motor anatómico (camino B de docs/auditoria.md): malla de MakeHuman con sus
// morphs → proporciones del estilo → pose del rig propio → G-buffer en CPU →
// sombreado cel y líneas (js/render/compose.js) → cara anime proyectada
// (js/render/face.js) → pixel art (js/render/pixel.js).
SC.engine = (() => {
  const B = SC.anatBody, R = SC.anatRig, MH = SC.mhModel;

  const MAT = { skin: 0, hair: 1, top: 2, bottom: 3, shoes: 4, tie: 5, sole: 6 };
  const KINDS = { 0: 'skin', 1: 'hair', 2: 'cloth', 3: 'cloth', 4: 'cloth', 5: 'cloth', 6: 'cloth' };
  const DEFAULT_LOOK = {
    skin: '#f4d2bb', hair: '#4b3350', eyes: '#3f7fd6', top: '#3b5bdb', bottom: '#2f3542', shoes: '#5a3d2b', tie: '#e0445e',
    hairStyle: 'bob', topStyle: 'camiseta', bottomStyle: 'falda', shoeStyle: 'zapatos',
  };
  const colorsOf = (look) => ({ 0: look.skin, 1: look.hair, 2: look.top, 3: look.bottom, 4: look.shoes, 5: look.tie || '#e0445e', 6: '#3a2b2b' });

  function config(a = {}) {
    return { params: B.params(a.params || a), look: Object.assign({}, DEFAULT_LOOK, a.look || {}) };
  }

  // 6.5 Encuadres en unidades del modelo.
  function frameBox(sk, frame) {
    const T = sk.T;
    if (frame === 'bust') return { top: T + 0.15, bottom: sk.yT(0.45), width: sk.w.shoulders + 0.8 };
    return { top: T + 0.25, bottom: -0.12, width: Math.max(sk.w.shoulders, sk.w.hip) + 1.6 };
  }

  // Triángulos de la cabeza (para anclar los rasgos con rayos).
  let headTris = null;
  function headTriangles() {
    if (headTris) return headTris;
    const D = MH.data(), t = D.tris.body, h = MH.PARTS.indexOf('head'), out = [];
    for (let i = 0; i < t.length; i += 3) if (D.part[t[i]] === h && D.part[t[i + 1]] === h && D.part[t[i + 2]] === h) out.push(t[i], t[i + 1], t[i + 2]);
    return (headTris = new Uint16Array(out));
  }

  // Personaje posado: mallas listas para rasterizar y proveedor de la cabeza.
  function build(a, animId, t, o = {}) {
    const cfg = config(a), look = cfg.look;
    const P = Object.assign({}, cfg.params, o.styleOverride ? { style: o.styleOverride } : {});
    // Sólo las rotaciones del rig: el apoyo en el suelo se calcula con la malla
    // (los ajustes de apoyo del rig están pensados para sus propias piernas).
    // Las poses se calculan con un esqueleto adulto del mismo sexo: el equilibrio
    // del rig usa sus anchos de cadera y en chibi exageraría la pierna libre.
    const sk = B.skeleton(P), psk = sk.N < 5 ? B.skeleton(Object.assign({}, P, { style: 'anime' })) : sk;
    // o.fk: pose ya calculada (pruebas y poses fijas).
    const pose = o.fk ? o.fk.pose : R.animate(psk, animId || 'idle', t || 0), f = o.fk || R.fk(psk, pose);
    const LAYERS = ['body', 'eyes', 'tights', 'skirt'];
    const r = MH.pose(P, f), D = MH.data(), nrm = MH.smoothNormals(MH.orientedNormals(r.pos, LAYERS), LAYERS, o.smooth != null ? o.smooth : 6);
    const headIdx = MH.PARTS.indexOf('head'), faceW = r.rest.face.w;
    const meshes = [
      { name: 'body', pos: r.pos, nrm, tris: D.tris.body, mat: MAT.skin, part: D.part, faceW },
      { name: 'eyes', pos: r.pos, nrm, tris: D.tris.eyes, mat: MAT.skin, part: headIdx, faceW, shadow: false },
    ];
    const head = r.head = Object.assign({}, r.head, {
      idx: headIdx, hairMat: MAT.hair,
      raycast: (orig, dir) => SC.mhRaster.raycast(r.pos, headTriangles(), orig, dir),
    });
    const parts = MH.PARTS.slice();
    SC.mhDress.add(meshes, parts, r, sk, look, MAT);
    return { P, sk, pose, f, model: r, meshes, parts, head, look };
  }

  function render(a, animId, t, o) {
    const b = build(a, animId, t, o);
    const box = frameBox(b.sk, o.frame);
    const scale = Math.min(o.H / (box.top - box.bottom), o.W / box.width);
    const yaw = (SC.VIEWS[o.view || 'front'] || SC.VIEWS.front).yaw;
    const cam = SC.camera(yaw, o.tilt != null ? o.tilt : 0.05, o.W, o.H, { cx: 0, cy: (box.top + box.bottom) / 2, scale });
    const g = SC.mhRaster.gbuffer(b.meshes, cam, { shadow: true, faceNormal: b.head.faceNormal });
    const weights = Object.assign({}, SC.CANON.expressions[o.expression] || {}, b.pose.face || {});
    return Object.assign(b, { g, cam, weights, scale });
  }

  function renderView(ch, W, H, pose, o = {}) {
    const a = (ch && ch.anat) || {};
    const r = render(a, pose && pose.animId, pose && pose.t, Object.assign({}, o, { W, H, expression: o.expression || (ch && ch.expression) }));
    const out = SC.compose.compose(r.g, { colors: colorsOf(r.look), kinds: KINDS, spriteHeight: H, lineScale: o.lineWidth != null ? o.lineWidth : 1, lineMode: o.lineMode, hairMat: MAT.hair });
    SC.faceDraw.draw(out.canvas.getContext('2d'), r.g, r.head, r.sk, { look: r.look, weights: r.weights, lineW: Math.max(1, 0.004 * H) });
    return out.canvas;
  }

  function renderVN(ch, pose, o = {}) {
    const scale = o.scale || 1, Hh = Math.round((o.height || SC.CANVAS_H) * scale);
    const W = Math.round(Hh * (o.frame === 'bust' ? 0.85 : 0.6));
    return renderView(ch, W, Hh, pose, Object.assign({}, o, { lineWidth: ch && ch.style ? ch.style.lineWidth : 1, lineMode: ch && ch.style ? ch.style.lineMode : 'colored' }));
  }

  // 11.2 Pixel art: G-buffer a 4×, reducción por mayoría, 3 tonos, línea de
  // 1 px, cara con sellos (cabezas < 16 px) o rasgos reducidos, ≤ 24 colores.
  function renderPixelGeneric(ch, pose, o, frame) {
    const W = o.w || 48, H = o.h || 64, SS = 4, a = (ch && ch.anat) || {};
    const style = frame === 'full' && o.chibi ? (H <= 48 ? 'chibi' : 'pixel64') : null;
    const r = render(a, pose && pose.animId, pose && pose.t, { W: W * SS, H: H * SS, view: o.view, frame, tilt: frame === 'full' ? 0.2 : 0.05, styleOverride: style, expression: o.expression || (ch && ch.expression) });
    const g = SC.pixel.downsample(r.g, SS);
    const out = SC.compose.compose(g, { colors: colorsOf(r.look), kinds: KINDS, pixel: true, spriteHeight: H, hairMat: MAT.hair, lineMode: o.lineMode, outline: o.outline, innerLines: o.innerLines });
    const ctx = out.canvas.getContext('2d');
    const headPx = r.sk.H * r.scale / SS;
    if (headPx < 16) SC.faceDraw.stamps(ctx, g, r.head, r.sk, { look: r.look, weights: r.weights }, headPx);
    else {
      const big = SC.makeCanvas(W * SS, H * SS);
      SC.faceDraw.draw(big.getContext('2d'), r.g, r.head, r.sk, { look: r.look, weights: r.weights, lineW: SS * 1.1, pixel: true });
      SC.pixel.overlayMajority(ctx, big, W, H, SS);
    }
    SC.pixel.limitPalette(ctx, W, H, 24);
    return out.canvas;
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
    const g = r.g, cv = SC.makeCanvas(W, H), x = cv.getContext('2d'), img = x.createImageData(W, H);
    const mode = o.debug || 'normal';
    let z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < W * H; i++) if (!Number.isNaN(g.depth[i])) { z0 = Math.min(z0, g.depth[i]); z1 = Math.max(z1, g.depth[i]); }
    for (let i = 0; i < W * H; i++) {
      if (Number.isNaN(g.depth[i])) continue;
      let c;
      if (mode === 'normal') c = [(g.nx[i] * 0.5 + 0.5) * 255, (g.ny[i] * 0.5 + 0.5) * 255, (g.nz[i] * 0.5 + 0.5) * 255];
      else if (mode === 'depth') { const v = 40 + 215 * (g.depth[i] - z0) / Math.max(1e-6, z1 - z0); c = [v, v, v]; }
      else { const k = mode === 'material' ? g.mat[i] : g.part[i]; c = [(k * 97) % 255, (k * 57 + 80) % 255, (k * 151 + 40) % 255]; }
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    x.putImageData(img, 0, 0);
    return cv;
  }

  return { MAT, KINDS, DEFAULT_LOOK, config, frameBox, build, render, renderView, renderVN, renderPixel, renderPixelPortrait, renderAnimation, debugView, colorsOf };
})();
