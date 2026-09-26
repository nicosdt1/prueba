// Utilidades de color, vectores 3D, matrices de rotación y dibujo 2D.
// Se usa un espacio de nombres global (SC) para que la app funcione abriendo
// index.html directamente, sin servidor ni módulos ES.
window.SC = window.SC || {};

SC.util = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function hexToRgb(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    const t = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + t(r) + t(g) + t(b);
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(lerp(A.r, B.r, t), lerp(A.g, B.g, t), lerp(A.b, B.b, t));
  }
  // Sombra "anime": oscurece hacia un violeta cálido en vez de hacia negro puro.
  function shade(hex, amt) {
    if (amt < 0) return mix(hex, '#3a1f3f', -amt);
    return mix(hex, '#fffaf0', amt);
  }
  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Interpola una tabla [[x, y], ...] ordenada por x.
  function curve(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      if (x <= table[i][0]) {
        const [x0, y0] = table[i - 1], [x1, y1] = table[i];
        return lerp(y0, y1, smoothstep(0, 1, (x - x0) / (x1 - x0)));
      }
    }
    return table[table.length - 1][1];
  }

  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  return { clamp, lerp, smoothstep, hexToRgb, rgbToHex, mix, shade, rgba, rng, curve, deepClone };
})();

// Vectores 3D { x, y, z }. Eje y hacia abajo (como la pantalla), z hacia el espectador.
SC.vec = (() => {
  const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, k) => v(a.x * k, a.y * k, a.z * k);
  const madd = (a, b, k) => v(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const len = (a) => Math.hypot(a.x, a.y, a.z);
  const norm = (a) => { const l = len(a) || 1; return v(a.x / l, a.y / l, a.z / l); };
  const lerp = (a, b, t) => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  // Componente de h perpendicular a d (normalizada); fallback si son paralelos.
  function orth(h, d, fallback) {
    const p = sub(h, mul(d, dot(h, d)));
    if (len(p) < 1e-4) return fallback ? orth(fallback, d) : orth(v(0, -1, 0), d, v(1, 0, 0));
    return norm(p);
  }
  return { v, add, sub, mul, madd, dot, cross, len, norm, lerp, orth };
})();

// Matrices 3x3 (filas) para rotaciones.
SC.mat = (() => {
  const I = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  function mm(A, B) {
    const R = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    }
    return R;
  }
  const mv = (M, p) => ({
    x: M[0] * p.x + M[1] * p.y + M[2] * p.z,
    y: M[3] * p.x + M[4] * p.y + M[5] * p.z,
    z: M[6] * p.x + M[7] * p.y + M[8] * p.z,
  });
  // Giro (yaw), inclinación adelante (pitch>0 = hacia delante) y lateral (roll).
  const ypr = (yaw, pitch, roll) => mm(rz(roll), mm(rx(-pitch), ry(yaw)));
  return { I, rx, ry, rz, mm, mv, ypr };
})();

// Primitivas 2D (para rasgos de la cara y detalles planos).
SC.draw = (() => {
  const U = SC.util;
  function lineColor(rig, color) {
    return rig.lineMode === 'dark' ? '#1e1628' : U.shade(color, -0.6);
  }
  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.ellipse(x, y, Math.max(0.01, Math.abs(rx)), Math.max(0.01, Math.abs(ry)), rot, 0, Math.PI * 2);
  }
  function poly(ctx, pts, closed = true) {
    if (!pts.length) return;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (closed) ctx.closePath();
  }
  // Curva suave que pasa por los puntos (Catmull-Rom convertida a Bézier).
  function smooth(ctx, pts, closed = false, moveTo = true) {
    const n = pts.length;
    if (n < 2) return;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[U.clamp(i, 0, n - 1)]);
    if (moveTo) ctx.moveTo(pts[0].x, pts[0].y);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
    }
    if (closed) ctx.closePath();
  }
  function stroke(ctx, color, width, build) {
    ctx.beginPath();
    build(ctx);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  function fill(ctx, color, build) {
    ctx.beginPath();
    build(ctx);
    ctx.fillStyle = color;
    ctx.fill();
  }
  return { lineColor, ellipse, poly, smooth, stroke, fill };
})();
