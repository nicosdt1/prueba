// Núcleo matemático del sistema anatómico (docs/base-matematica.md).
// Sin dibujo ni DOM: vectores, rotaciones, interpolaciones y color OKLCH.
SC.AM = (() => {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;

  // ---------- 3.4 Parámetros continuos ----------
  // Interpola un par [hombre, mujer] con el sexo s y la exageración e.
  function dimorph(pair, s, e = 1) {
    const [m, f] = pair, ws = m + s * (f - m), wb = (m + f) / 2;
    return wb + e * (ws - wb);
  }
  // Ancho final: dimorfismo y complexión b (tejido blando).
  const width = (triple, s, e, b) => dimorph(triple, s, e) * (1 + triple[2] * b);

  // ---------- Vectores 3D ----------
  const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const dist = (a, b) => len(sub(a, b));

  // ---------- Matrices de rotación 3×3 (filas) ----------
  const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
  function mm(A, B) {
    const C = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return C;
  }
  const mv = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2], M[3] * p[0] + M[4] * p[1] + M[5] * p[2], M[6] * p[0] + M[7] * p[1] + M[8] * p[2]];
  const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
  const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  // 10.1 Orden Euler Y → X → Z (giro, flexión, ladeo).
  const euler = (yaw, pitch, roll) => mm(mm(Ry(yaw), Rx(pitch)), Rz(roll));
  // Rotación que lleva la dirección a a la dirección b (Rodrigues).
  function fromTo(a, b) {
    a = norm(a); b = norm(b);
    const v = cross(a, b), c = dot(a, b);
    if (c < -0.999999) { const ax = norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])); return axisAngle(ax, Math.PI); }
    const k = 1 / (1 + c);
    return [
      v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1],
      v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0],
      v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c,
    ];
  }
  function axisAngle(ax, a) {
    const [x, y, z] = norm(ax), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
  }

  // ---------- 5.4 Catmull-Rom centrípeta (Barry-Goldman) ----------
  // Devuelve puntos 2D/3D (arrays) que pasan exactamente por los de control.
  function catmullRom(pts, { alpha = 0.5, closed = false, samples = 8 } = {}) {
    const n = pts.length;
    if (n < 2) return pts.slice();
    const P = closed ? [pts[n - 1], ...pts, pts[0], pts[1]]
      : [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts[n - 1].map((v, i) => 2 * v - pts[n - 2][i])];
    const D = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    const out = [];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
      const t0 = 0, t1 = t0 + Math.max(1e-6, D(p0, p1) ** alpha), t2 = t1 + Math.max(1e-6, D(p1, p2) ** alpha), t3 = t2 + Math.max(1e-6, D(p2, p3) ** alpha);
      for (let k = 0; k < samples; k++) {
        const t = t1 + ((t2 - t1) * k) / samples;
        const L = (a, b, ta, tb) => a.map((v, j) => ((tb - t) / (tb - ta)) * v + ((t - ta) / (tb - ta)) * b[j]);
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
        const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }

  // ---------- 6.1 Hermite cúbico monótono (Fritsch–Carlson) ----------
  // Interpola y(x) sin sobrepasar nunca los valores dados (sin bultos).
  function monotone(xs, ys) {
    const n = xs.length;
    if (n === 1) return () => ys[0];
    const d = [], m = new Array(n);
    for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
    for (let k = 0; k < n - 1; k++) {
      if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
      const a = m[k] / d[k], b = m[k + 1] / d[k], s2 = a * a + b * b;
      if (s2 > 9) { const t = 3 / Math.sqrt(s2); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let k = 0;
      while (k < n - 2 && x > xs[k + 1]) k++;
      const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }

  // ---------- 10.3 Interpolación de ángulos y suavizados ----------
  const angleLerp = (a, b, u) => { const d = ((((b - a + 180) % 360) + 360) % 360) - 180; return a + d * u; };
  const ease = { step: (u) => (u < 1 ? 0 : 1), linear: (u) => u, smooth: (u) => u * u * (3 - 2 * u) };

  // ---------- 11.5 Color OKLCH ----------
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const toSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);
  function hexToOklch(hex) {
    const [r, g, b] = hexToRgb(hex).map(toLin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return [L, Math.hypot(A, B), ((deg(Math.atan2(B, A)) % 360) + 360) % 360];
  }
  function oklchToHex([L, C, h]) {
    // Reduce el croma hasta que el color quepa en sRGB.
    for (let c = C; c >= 0; c -= 0.005) {
      const A = c * Math.cos(rad(h)), B = c * Math.sin(rad(h));
      const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
      const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
      const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
      const rgb = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
      ];
      if (rgb.every((v) => v >= -1e-4 && v <= 1.0001) || c <= 0) return rgbToHex(...rgb.map(toSrgb));
    }
    return '#000000';
  }
  // Rampa de tonos: k < 0 sombras (hacia azul-violeta), k > 0 luces (hacia amarillo).
  function ramp(hex, k, R = SC.CANON.ramp) {
    const [L, C, h] = hexToOklch(hex);
    const target = k > 0 ? R.warm : R.cool;
    const dh = ((((target - h + 180) % 360) + 360) % 360) - 180;
    const hk = h + Math.sign(dh) * Math.min(Math.abs(dh), R.hueStep * Math.abs(k));
    // Cerca del blanco o del negro el paso se reparte en el espacio que queda,
    // para que los tonos no se fundan.
    const step = k > 0 ? Math.min(R.dL, (0.985 - L) / 2) : Math.min(R.dL, (L - 0.04) / 2);
    return oklchToHex([clamp(L + Math.max(step, 0.03) * k, 0, 1), C * Math.max(0, 1 - R.dC * Math.abs(k)), hk]);
  }

  return {
    clamp, lerp, rad, deg, dimorph, width,
    v3, add, sub, mul, dot, cross, len, norm, lerp3, dist,
    I3, mm, mv, Rx, Ry, Rz, euler, fromTo, axisAngle,
    catmullRom, monotone, angleLerp, ease,
    hexToRgb, rgbToHex, hexToOklch, oklchToHex, ramp,
  };
})();
