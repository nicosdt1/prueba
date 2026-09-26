// Motor de volúmenes 2.5D.
//
// Cada parte del cuerpo (y cada prenda) se describe como una serie de
// SECCIONES transversales: elipses asimétricas colocadas en 3D
//   { c: centro, u: eje lateral, v: eje frontal, a/a2: radio lateral (+u/-u),
//     b/b2: radio frontal/trasero (+v/-v) }
// Se proyectan en ortográfica girando alrededor del eje vertical (la vista) y
// la silueta es la unión de las envolventes convexas de cada par de secciones
// consecutivas. Así una misma definición sirve para frente, 3/4, perfil y
// espalda, y los contornos anatómicos (pecho, glúteos, gemelos...) aparecen solos.
SC.V = (() => {
  const U = SC.util, Vc = SC.vec;
  const TAU = Math.PI * 2;

  // Proyección ortográfica: giro alrededor del eje vertical (vista) y una
  // ligera inclinación de cámara hacia abajo para que los anillos (bajos,
  // cinturones, cuellos) se vean como elipses y no como líneas rectas.
  function proj(rig, p) {
    const c = rig.yawCos, s = rig.yawSin;
    const Z = -p.x * s + p.z * c;
    return { x: rig.cx + p.x * c + p.z * s, y: rig.ground + (p.y - rig.ground) * rig.tiltCos + Z * rig.tiltSin, z: Z };
  }

  const sec = (c, u, v, a, a2 = a, b = a, b2 = b, extra) => Object.assign({ c, u, v, a, a2, b, b2 }, extra);

  function lerpSec(A, B, t) {
    return {
      c: Vc.lerp(A.c, B.c, t), u: Vc.norm(Vc.lerp(A.u, B.u, t)), v: Vc.norm(Vc.lerp(A.v, B.v, t)),
      a: U.lerp(A.a, B.a, t), a2: U.lerp(A.a2, B.a2, t), b: U.lerp(A.b, B.b, t), b2: U.lerp(A.b2, B.b2, t),
      bump: A.bump || B.bump ? U.lerp(A.bump || 0, B.bump || 0, t) : 0,
    };
  }

  // Punto de la superficie. phi = 0 delante (+v), PI/2 hacia +u, PI detrás.
  function surf(s, phi, out = 0) {
    const sp = Math.sin(phi), cp = Math.cos(phi);
    let ru = (sp >= 0 ? s.a : s.a2) + out, rv = (cp >= 0 ? s.b : s.b2) + out;
    if (s.bump) { const m = 1 + s.bump * Math.cos(phi * (s.bumpN || 9) + (s.bumpP || 0)); ru *= m; rv *= m; }
    return Vc.add(Vc.add(s.c, Vc.mul(s.u, ru * sp)), Vc.mul(s.v, rv * cp));
  }

  function ring(s, n = 16) {
    const pts = [];
    for (let k = 0; k < n; k++) pts.push(surf(s, (k / n) * TAU));
    return pts;
  }

  // Cuánto mira un punto de la superficie hacia la cámara (>0 visible).
  function facing(rig, s, p) {
    const r = Math.max(s.a, s.a2, s.b, s.b2, 1e-6);
    return (proj(rig, p).z - proj(rig, s.c).z) / r;
  }

  function hull(points) {
    const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (pts.length < 3) return pts;
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [], upper = [];
    for (const p of pts) {
      while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  // Luz en espacio de vista: desde arriba a la izquierda y algo de frente.
  const LIGHT = (() => { const l = Math.hypot(-0.5, -0.68, 0.55); return { x: -0.5 / l, y: -0.68 / l, z: 0.55 / l }; })();

  // Volumen a partir de anillos de puntos 3D. Además de la silueta guarda,
  // por cada punto, la orientación respecto a la cámara (f) y a la luz (l),
  // que se usan para sombrear con el terminador real de la forma.
  function fromRings(rig, rings, rad) {
    const c = rig.yawCos, s = rig.yawSin, tc = rig.tiltCos, ts = rig.tiltSin;
    const R = rings.length;
    const cen = rings.map((r) => {
      let x = 0, y = 0, z = 0;
      for (const p of r) { x += p.x; y += p.y; z += p.z; }
      return Vc.v(x / r.length, y / r.length, z / r.length);
    });
    // Normal real de la superficie: producto vectorial de las tangentes a lo
    // largo del anillo y a lo largo del eje, orientada hacia fuera.
    const P = rings.map((r, i) => r.map((p, k) => {
      const n0 = r.length;
      const tr = Vc.sub(r[(k + 1) % n0], r[(k - 1 + n0) % n0]);
      const ra = rings[Math.min(R - 1, i + 1)], rb = rings[Math.max(0, i - 1)];
      let n;
      if (R > 1 && ra.length === n0 && rb.length === n0 && ra !== rb) {
        n = Vc.cross(tr, Vc.sub(ra[k], rb[k]));
        const out = Vc.sub(p, cen[i]);
        if (Vc.dot(n, out) < 0) n = Vc.mul(n, -1);
        if (Vc.len(n) < 1e-6) n = out;
      } else n = Vc.sub(p, cen[i]);
      n = Vc.norm(n);
      const nx = n.x * c + n.z * s, nz = -n.x * s + n.z * c;
      const q = proj(rig, p);
      q.f = nz * tc - n.y * ts;
      q.l = nx * LIGHT.x + n.y * LIGHT.y + nz * LIGHT.z;
      return q;
    }));
    const polys = [];
    if (P.length === 1) polys.push(hull(P[0]));
    for (let i = 0; i < P.length - 1; i++) polys.push(hull(P[i].concat(P[i + 1])));
    let z = 0, n = 0;
    for (const r of P) for (const p of r) { z += p.z; n++; }
    return { polys, rings: [P], rad: rad || 10, z: n ? z / n : 0 };
  }

  function fromSections(rig, secs, n = 16) {
    const rad = secs.reduce((s, q) => s + (q.a + q.a2 + q.b + q.b2) / 4, 0) / Math.max(1, secs.length);
    return fromRings(rig, secs.map((s) => ring(s, n)), rad);
  }

  function merge(...vols) {
    const vs = vols.filter(Boolean);
    return {
      polys: [].concat(...vs.map((v) => v.polys)),
      rings: [].concat(...vs.map((v) => v.rings || [])),
      rad: vs.reduce((s, v) => s + v.rad, 0) / Math.max(1, vs.length),
      z: vs.length ? vs[0].z : 0,
    };
  }

  // Zona visible de la superficie que cumple una condición sobre la luz
  // (sombra, sombra profunda, brillo). Cada celda de la malla (entre dos
  // anillos) se recorta por el umbral interpolando el punto exacto del
  // terminador, así el borde de la sombra sigue la forma real.
  function clipCell(q, key, test, thr, out) {
    const ins = [test(q[0][key]), test(q[1][key]), test(q[2][key]), test(q[3][key])];
    if (!ins[0] && !ins[1] && !ins[2] && !ins[3]) return;
    if (ins[0] && ins[1] && ins[2] && ins[3]) { out.push(q); return; }
    const poly = [];
    for (let j = 0; j < 4; j++) {
      const a = q[j], b = q[(j + 1) % 4];
      if (ins[j]) poly.push(a);
      if (ins[j] !== ins[(j + 1) % 4]) {
        const t = (thr - a[key]) / ((b[key] - a[key]) || 1e-6);
        poly.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    if (poly.length >= 3) out.push(poly);
  }

  // Varias bandas de luz en una sola pasada por las celdas.
  function patchBands(vol, bands, key = 'l') {
    const outs = bands.map(() => []);
    for (const P of vol.rings || []) {
      for (let i = 0; i < P.length - 1; i++) {
        const A = P[i], B = P[i + 1];
        if (A.length !== B.length) continue;
        const n = A.length;
        for (let k = 0; k < n; k++) {
          const q = [A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]];
          const f = (q[0].f + q[1].f + q[2].f + q[3].f) / 4;
          for (let b = 0; b < bands.length; b++) {
            const bd = bands[b];
            if (f < (bd.fMin != null ? bd.fMin : -0.3)) continue;
            clipCell(q, key, bd.test, bd.thr, outs[b]);
          }
        }
      }
    }
    return outs;
  }

  const patches = (vol, key, test, thr, fMin = -0.3) => patchBands(vol, [{ test, thr, fMin }], key)[0];

  // Tubo que sigue una polilínea 3D (colas de pelo, correas, espadas...).
  function tubeSections(pts, radii, flat = 1) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = Vc.norm(Vc.sub(b, a));
      const v = Vc.orth(Vc.v(0, 0, 1), d, Vc.v(1, 0, 0));
      const u = Vc.norm(Vc.cross(d, v));
      const r = typeof radii === 'function' ? radii(i / (pts.length - 1)) : typeof radii === 'number' ? radii : radii[i];
      out.push(sec(pts[i], u, v, r, r, r * flat, r * flat));
    }
    return out;
  }
  const tube = (rig, pts, radii, flat, n = 12) => fromSections(rig, tubeSections(pts, radii, flat), n);

  function tracePoly(ctx, poly) {
    if (poly.length < 3) return;
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
  }

  function path(ctx, vol) {
    for (const poly of vol.polys) tracePoly(ctx, poly);
  }

  function clip(ctx, vol) {
    ctx.beginPath();
    path(ctx, vol);
    ctx.clip();
  }

  function fillPolys(ctx, polys, style) {
    if (!polys.length) return;
    ctx.beginPath();
    for (const p of polys) tracePoly(ctx, p);
    ctx.fillStyle = style;
    ctx.fill();
  }

  function bbox(vol) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of vol.polys) for (const q of p) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    return { x0, y0, x1, y1 };
  }

  // Materiales: tinte de la sombra (multiplicar), brillo especular y sombra proyectada.
  const MATERIALS = {
    cloth: { tint: '#b3a0cc', gloss: 0.1, deep: 0.35 },
    skin: { tint: '#efbfb6', gloss: 0.1, deep: 0.2 },
    hair: { tint: '#a894c4', gloss: 0.35, deep: 0.45 },
    metal: { tint: '#8f95b8', gloss: 0.75, deep: 0.55, bias: 0.15 },
    leather: { tint: '#a68fae', gloss: 0.4, deep: 0.45 },
  };

  // Rellena un volumen: contorno único, sombra con terminador 3D, sombra
  // profunda, brillo, degradado suave y (opcional) sombra proyectada.
  function fill(ctx, rig, vol, color, o = {}) {
    if (!vol || !vol.polys.length) return;
    if (SC.ID) {
      ctx.beginPath(); path(ctx, vol);
      ctx.fillStyle = SC.ID.color(color);
      ctx.fill();
      return;
    }
    const mat = Object.assign({}, MATERIALS[o.mat || 'cloth'], o);
    const hi = rig.detail === 'high';
    const line = o.line != null ? o.line : rig.line;
    // Sombra proyectada sobre lo que ya está dibujado debajo (el propio
    // volumen se pinta después y la tapa en su zona).
    if (hi && o.cast) {
      const k = o.cast * rig.B;
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.translate(k * 0.45, k);
      ctx.beginPath();
      path(ctx, vol);
      ctx.fillStyle = U.rgba(U.multiply('#8a6f9a', mat.tint), 0.3);
      ctx.fill();
      ctx.restore();
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (line > 0 && o.outline !== false) {
      ctx.beginPath();
      path(ctx, vol);
      ctx.lineWidth = line * 2;
      ctx.strokeStyle = ctx.fillStyle = o.lineColor || SC.draw.lineColor(rig, color);
      ctx.stroke();
      ctx.fill();
    }
    ctx.beginPath();
    path(ctx, vol);
    ctx.fillStyle = color;
    ctx.fill();
    if (o.shade === false) return;

    // En pixel art se usan 3 tonos bien separados (luz, base, sombra).
    const shadow = rig.pixel ? U.multiply(U.multiply(color, mat.tint), '#d6c8e4') : U.multiply(color, mat.tint);
    const bias = (mat.bias || 0) + (o.shadeAmt ? (o.shadeAmt - 0.17) * 0.8 : 0);
    ctx.save();
    clip(ctx, vol);
    const bb = bbox(vol);
    if (hi && Number.isFinite(bb.x0 + bb.x1 + bb.y0 + bb.y1)) {
      // Degradado suave: luz arriba-izquierda, penumbra abajo-derecha.
      const b = bb, w = Math.max(1, b.x1 - b.x0, b.y1 - b.y0);
      const g = ctx.createLinearGradient(b.x0, b.y0, b.x0 + w * 0.8, b.y0 + w);
      g.addColorStop(0, 'rgba(255,248,240,0.16)');
      g.addColorStop(0.55, 'rgba(255,255,255,0)');
      g.addColorStop(1, U.rgba(U.multiply(color, mat.tint), 0.35));
      ctx.fillStyle = g;
      ctx.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
    }
    const t1 = 0.12 + bias, t2 = -0.42 + bias;
    const t3 = hi ? 0.8 - mat.gloss * 0.15 : mat.gloss >= 0.35 ? 0.7 : 0.78;
    const bands = [{ test: (v) => v < t1, thr: t1 }];
    if (hi) bands.push({ test: (v) => v < t2, thr: t2 });
    if (!hi || mat.gloss > 0) bands.push({ test: (v) => v > t3, thr: t3, fMin: 0.2 });
    const res = patchBands(vol, bands);
    fillPolys(ctx, res[0], shadow);
    if (hi) {
      fillPolys(ctx, res[1], U.rgba(U.multiply(shadow, mat.tint), mat.deep));
      if (mat.gloss > 0) fillPolys(ctx, res[2], U.rgba(U.shade(color, 0.6), mat.gloss));
    } else {
      fillPolys(ctx, res[1], U.shade(color, mat.gloss >= 0.35 ? 0.32 : 0.2));
    }
    ctx.restore();
  }

  // Especificación paramétrica: at(level) interpola secciones clave.
  function spec(keys) {
    return (l) => {
      if (l <= keys[0].l) return keys[0].s;
      for (let i = 1; i < keys.length; i++) {
        if (l <= keys[i].l) {
          const A = keys[i - 1], B = keys[i];
          return lerpSec(A.s, B.s, (l - A.l) / (B.l - A.l));
        }
      }
      return keys[keys.length - 1].s;
    };
  }

  // Proyecta puntos [nivel, phi, extra] de una superficie.
  function project(rig, at, pts) {
    return pts.map(([l, phi, out = 0]) => {
      const s = at(l), p = surf(s, phi, out), q = proj(rig, p);
      q.f = facing(rig, s, p);
      return q;
    });
  }

  // "Calcomanía": polígono dibujado sobre la superficie, recortado a la silueta.
  function decal(ctx, rig, at, pts, o = {}) {
    const P = project(rig, at, pts);
    const vis = P.filter((p) => p.f > 0.05).length / P.length;
    if (vis < (o.minVis != null ? o.minVis : 0.35)) return false;
    ctx.save();
    if (o.clip) clip(ctx, o.clip);
    ctx.beginPath();
    if (o.smooth) SC.draw.smooth(ctx, P, o.closed !== false);
    else SC.draw.poly(ctx, P, o.closed !== false);
    if (SC.ID) {
      if (o.fill) { ctx.fillStyle = SC.ID.color(o.fill); ctx.fill(); }
      ctx.restore();
      return true;
    }
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) {
      ctx.lineWidth = o.width || rig.line;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = o.stroke;
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  // Línea sobre la superficie: sólo se dibujan los tramos visibles.
  function dline(ctx, rig, at, pts, color, width, o = {}) {
    if (SC.ID) return;
    const P = project(rig, at, pts);
    const thr = o.thr != null ? o.thr : 0.08;
    ctx.save();
    if (o.clip) clip(ctx, o.clip);
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < P.length; i++) {
      if (P[i].f > thr) {
        if (!open) { ctx.moveTo(P[i].x, P[i].y); open = true; } else ctx.lineTo(P[i].x, P[i].y);
      } else open = false;
    }
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
  }

  // Genera puntos [nivel, phi] a lo largo de una curva paramétrica.
  const curvePts = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));

  return { proj, sec, lerpSec, surf, ring, facing, hull, fromRings, fromSections, merge, tubeSections, tube, path, tracePoly, clip, fill, spec, project, decal, dline, curvePts, patches, MATERIALS };
})();
