// Sistema de piezas (sección 9 de docs/base-matematica.md): una pieza nunca
// guarda su posición, guarda anclajes; aquí se calcula la transformación que
// los lleva a las articulaciones del esqueleto y se mide si encaja.
SC.anatParts = (() => {
  const M = SC.AM;

  // Transformación afín 2D como [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
  const apply = (T, p) => [T[0] * p[0] + T[2] * p[1] + T[4], T[1] * p[0] + T[3] * p[1] + T[5]];
  const compose = (A, B) => [
    A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
  ];
  const Tr = (x, y) => [1, 0, 0, 1, x, y];
  const Rot = (t) => [Math.cos(t), Math.sin(t), -Math.sin(t), Math.cos(t), 0, 0];
  const Sc = (sx, sy) => [sx, 0, 0, sy, 0, 0];

  // 9.2 Colocación con dos anclajes (miembros): estiramiento a lo largo (s∥) y
  // a lo ancho (s⊥) por separado. Fuera de [0.8, 1.25] hace falta otra variante.
  function placeTwo(anch, j0, j1, wTarget) {
    const { pivot: p0, tip: p1, width_a: wa, width_b: wb } = anch;
    const sPar = Math.hypot(j1[0] - j0[0], j1[1] - j0[1]) / Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const sPerp = wa && wb ? wTarget / Math.hypot(wa[0] - wb[0], wa[1] - wb[1]) : sPar;
    const thP = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), thJ = Math.atan2(j1[1] - j0[1], j1[0] - j0[0]);
    // M = T(j0) R(θj) S(s∥, s⊥) R(−θp) T(−p0)
    const T = [Tr(j0[0], j0[1]), Rot(thJ), Sc(sPar, sPerp), Rot(-thP), Tr(-p0[0], -p0[1])].reduce(compose);
    const ok = sPar >= 0.8 && sPar <= 1.25 && sPerp >= 0.8 && sPerp <= 1.25;
    return { T, sPar, sPerp, ok };
  }

  // 9.3 Similitud de mínimos cuadrados (Procrustes 2D) con n ≥ 2 pares.
  function procrustes(P, Q) {
    const n = P.length;
    const mp = [0, 0], mq = [0, 0];
    for (let i = 0; i < n; i++) { mp[0] += P[i][0] / n; mp[1] += P[i][1] / n; mq[0] += Q[i][0] / n; mq[1] += Q[i][1] / n; }
    let a = 0, b = 0, d = 0;
    for (let i = 0; i < n; i++) {
      const px = P[i][0] - mp[0], py = P[i][1] - mp[1], qx = Q[i][0] - mq[0], qy = Q[i][1] - mq[1];
      a += px * qx + py * qy; b += px * qy - py * qx; d += px * px + py * py;
    }
    a /= d; b /= d;
    const s = Math.hypot(a, b), theta = Math.atan2(b, a);
    const t = [mq[0] - (a * mp[0] - b * mp[1]), mq[1] - (b * mp[0] + a * mp[1])];
    const T = [a, b, -b, a, t[0], t[1]];
    let err = 0;
    for (let i = 0; i < n; i++) { const r = apply(T, P[i]); err += (r[0] - Q[i][0]) ** 2 + (r[1] - Q[i][1]) ** 2; }
    const eps = Math.sqrt(err / n);
    return { s, theta, t, T, eps };
  }

  // Resultado del control de calidad (ε en unidades de H).
  const fitLevel = (eps) => (eps < 0.02 ? 'encaja' : eps <= 0.05 ? 'aviso' : 'rechazada');

  // 9.4 Lectura automática de anclajes con momentos de imagen.
  // mask: función (x, y) → true si el píxel es opaco.
  function readAnchors(W, H, mask) {
    let n = 0, sx = 0, sy = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask(x, y)) { n++; sx += x; sy += y; }
    if (!n) return null;
    const cx = sx / n, cy = sy / n;
    let m20 = 0, m02 = 0, m11 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask(x, y)) { const dx = x - cx, dy = y - cy; m20 += dx * dx; m02 += dy * dy; m11 += dx * dy; }
    const phi = 0.5 * Math.atan2(2 * m11, m20 - m02);
    const ax = [Math.cos(phi), Math.sin(phi)], nx = [-ax[1], ax[0]];
    let lo = Infinity, hi = -Infinity, pivot = null, tip = null, wlo = Infinity, whi = -Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask(x, y)) continue;
      const u = (x - cx) * ax[0] + (y - cy) * ax[1];
      if (u < lo) { lo = u; pivot = [x, y]; }
      if (u > hi) { hi = u; tip = [x, y]; }
      if (Math.abs(u) < 0.75) { const v = (x - cx) * nx[0] + (y - cy) * nx[1]; wlo = Math.min(wlo, v); whi = Math.max(whi, v); }
    }
    const wa = [cx + nx[0] * wlo, cy + nx[1] * wlo], wb = [cx + nx[0] * whi, cy + nx[1] * whi];
    return { centroid: [cx, cy], phi, pivot, tip, width_a: wa, width_b: wb };
  }

  // 9.5 Pesos de piel por distancia inversa al cuadrado a los huesos cercanos.
  function skinWeights(dists, radius) {
    const near = dists.map((d) => (d < radius ? d : Infinity));
    if (!near.some(Number.isFinite)) return dists.map((d, i) => (i === dists.indexOf(Math.min(...dists)) ? 1 : 0));
    const w = near.map((d) => (Number.isFinite(d) ? 1 / Math.max(1e-9, d * d) : 0));
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / sum);
  }

  return { apply, compose, placeTwo, procrustes, fitLevel, readAnchors, skinWeights, M };
})();
