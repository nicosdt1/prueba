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

  // Volumen a partir de anillos de puntos 3D.
  function fromRings(rig, rings, rad) {
    const P = rings.map((r) => r.map((p) => proj(rig, p)));
    const polys = [];
    if (P.length === 1) polys.push(hull(P[0]));
    for (let i = 0; i < P.length - 1; i++) polys.push(hull(P[i].concat(P[i + 1])));
    let z = 0, n = 0;
    for (const r of P) for (const p of r) { z += p.z; n++; }
    return { polys, rad: rad || 10, z: n ? z / n : 0 };
  }

  function fromSections(rig, secs, n = 16) {
    const rad = secs.reduce((s, q) => s + (q.a + q.a2 + q.b + q.b2) / 4, 0) / Math.max(1, secs.length);
    return fromRings(rig, secs.map((s) => ring(s, n)), rad);
  }

  function merge(...vols) {
    const vs = vols.filter(Boolean);
    return { polys: [].concat(...vs.map((v) => v.polys)), rad: vs.reduce((s, v) => s + v.rad, 0) / Math.max(1, vs.length), z: vs.length ? vs[0].z : 0 };
  }

  // Tubo que sigue una polilínea 3D (colas de pelo, correas, espadas...).
  function tubeSections(pts, radii, flat = 1) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const d = Vc.norm(Vc.sub(b, a));
      const v = Vc.orth(Vc.v(0, 0, 1), d, Vc.v(1, 0, 0));
      const u = Vc.norm(Vc.cross(d, v));
      const r = typeof radii === 'function' ? radii(i / (pts.length - 1)) : radii[i];
      out.push(sec(pts[i], u, v, r, r, r * flat, r * flat));
    }
    return out;
  }
  const tube = (rig, pts, radii, flat, n = 12) => fromSections(rig, tubeSections(pts, radii, flat), n);

  function path(ctx, vol) {
    for (const poly of vol.polys) {
      if (poly.length < 2) continue;
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
    }
  }

  function clip(ctx, vol) {
    ctx.beginPath();
    path(ctx, vol);
    ctx.clip();
  }

  // Rellena un volumen con contorno exterior único y sombra propia.
  function fill(ctx, rig, vol, color, o = {}) {
    if (!vol || !vol.polys.length) return;
    const line = o.line != null ? o.line : rig.line;
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
    if (o.shade !== false) {
      const k = (o.shadeK != null ? o.shadeK : 0.35) * vol.rad;
      const amt = o.shadeAmt != null ? o.shadeAmt : 0.17;
      ctx.save();
      clip(ctx, vol);
      ctx.fillStyle = U.shade(color, -amt);
      ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
      ctx.translate(-k * 0.8, -k * 0.55);
      ctx.beginPath();
      path(ctx, vol);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
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

  return { proj, sec, lerpSec, surf, ring, facing, hull, fromRings, fromSections, merge, tubeSections, tube, path, clip, fill, spec, project, decal, dline, curvePts };
})();
