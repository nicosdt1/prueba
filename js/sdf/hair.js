// Pelo por mechones (sección 5 de docs/correccion-visual.md): una base que
// envuelve el cráneo a una distancia τ dentro de la zona con pelo y mechones
// que nacen en el cuero cabelludo, caen con la gravedad, esquivan la cabeza y
// el cuerpo (colisión con la propia SDF) y terminan en punta.
SC.sdfHair = (() => {
  const M = SC.AM, S = SC.SDF, B = () => SC.sdfBuild;
  const { cone, ellipsoid, plane, INTERSECT } = S;

  // 5.4 Recetas: τ de la base, grupos de mechones, rigidez y longitudes (en H).
  const RECIPES = {
    corto: { name: 'Corto', tau: 0.06, bangs: 5, bangTo: 'brow', sides: 0.75, back: 10, backLen: 0.45, stiff: 0.35, crown: 6 },
    bob: { name: 'Media melena', tau: 0.08, bangs: 7, bangTo: 'brow', sides: 1.02, back: 10, backLen: 0.8, stiff: 0.14 },
    largo: { name: 'Largo', tau: 0.09, bangs: 7, bangTo: 'brow', sides: 1.1, back: 14, backLen: 2.6, stiff: 0.12, front: 2 },
    coleta: { name: 'Coleta', tau: 0.06, bangs: 5, bangTo: 'brow', sides: 0.8, back: 0, tie: [[0, 0.32, -1]], bundle: 7, bundleLen: 2.0, stiff: 0.15 },
    coletas: { name: 'Coletas', tau: 0.06, bangs: 6, bangTo: 'brow', sides: 0.85, back: 0, tie: [[1, 0.3, 0], [-1, 0.3, 0]], bundle: 6, bundleLen: 2.2, stiff: 0.15 },
    mono: { name: 'Moño', tau: 0.05, bangs: 5, bangTo: 'brow', sides: 0.9, back: 0, bun: [0, 0.12, -0.55], stiff: 0.2 },
    rapado: { name: 'Rapado', tau: 0.015, bangs: 0, sides: 0, back: 0 },
  };

  // Espina de un mechón paso a paso (5.2): x_{i+1} = x_i + Δ d_i,
  // d_{i+1} = norm(d_i + Δ/κ g + c_i), con colisión contra la SDF del cuerpo.
  function spine(start, dir0, L, stiff, dist, tauMin, target, steps = 5) {
    const pts = [start];
    let x = start, d = M.norm(dir0);
    const D = L / steps;
    for (let i = 0; i < steps; i++) {
      x = M.add(x, M.mul(d, D));
      // Colisión: si queda cerca de la cabeza o el cuerpo, se empuja hacia fuera.
      for (let k = 0; k < 3; k++) {
        const dd = dist(x);
        if (dd >= tauMin) break;
        const e = 0.01, n = M.norm([dist([x[0] + e, x[1], x[2]]) - dist([x[0] - e, x[1], x[2]]), dist([x[0], x[1] + e, x[2]]) - dist([x[0], x[1] - e, x[2]]), dist([x[0], x[1], x[2] + e]) - dist([x[0], x[1], x[2] - e])]);
        x = M.add(x, M.mul(n, tauMin - dd));
      }
      pts.push(x);
      let g = [0, -1, 0];
      if (target) g = M.norm(M.sub(target, x)); // coletas y moños: hacia el lazo
      d = M.norm(M.add(d, M.mul(g, D / Math.max(0.2, stiff))));
    }
    return pts;
  }

  // Cadena de conos aplanados (sección elíptica, grosor = ancho / 3).
  function strandPrims(pts, w0, outward, region, k = 0.02) {
    const out = [], n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const r0 = (w0 * Math.pow(1 - t0, 0.7)) / 2, r1 = Math.max(0.004, (w0 * Math.pow(1 - t1, 0.7)) / 2);
      out.push(cone(pts[i], pts[i + 1], r0, r1, { ez: 0.34, zHint: outward, k: i === 0 ? k : 0.004, region }));
    }
    return out;
  }

  function parts(f, body, style) {
    const R = RECIPES[style] || RECIPES.corto, sk = f.sk, hs = B().headSpace(f), W = B().headW(sk);
    const Rh = f.rot.head, T = sk.T;
    const g = C_guides(sk);
    const bodyDist = (p) => S.sceneDist(body, p, null);
    const out = [];
    let region = 100;
    const HAIR = B().MAT.hair;
    // 5.1 Base: cráneo desplazado τ, recortado a la zona con pelo (nacimiento
    // delante, nuca detrás, por encima de las orejas a los lados).
    const tau = R.tau;
    const vL = (z) => 0.475 - 0.61 * z; // línea del pelo en espacio de cabeza (v según z)
    const nRest = M.norm([0, -1, 0.61]), p0 = hs(0, vL(0) + (style === 'rapado' ? 0.02 : 0), 0);
    const nW = M.mv(Rh, nRest);
    const base = [
      ellipsoid(hs(0, 0.42, -0.05), [W / 2 + tau * 0.7, 0.42 + tau, 0.46 + tau], { Rm: Rh, region }),
      ellipsoid(hs(0, 0.2, -0.1), [W / 2 * 0.9 + tau, 0.28 + tau * 0.8, 0.4 + tau], { Rm: Rh, k: 0.08, region }),
      plane(nW, M.dot(nW, p0), { op: INTERSECT, k: 0.04 }),
    ];
    out.push({ name: 'hair_base', mat: HAIR, prims: base, hard: true, region });
    region++;
    if (style === 'rapado') return out;
    const forward = M.mv(Rh, [0, 0, 1]), up = M.mv(Rh, [0, 1, 0]), right = M.mv(Rh, [1, 0, 0]);
    const surfAt = (u, v, zSign = 1) => {
      // Punto sobre la base (rayo desde delante o desde detrás de la cabeza).
      const o = hs(u, v, zSign * 1.4), dir = M.mul(forward, -zSign);
      let t = 0, p = o;
      for (let i = 0; i < 80; i++) { p = M.add(o, M.mul(dir, t)); const d = S.partDist(out[0], p); if (d < 0.002) break; t += d * 0.9; }
      return p;
    };
    const tauMin = 0.03;
    const hairDist = (p) => Math.min(bodyDist(p), S.partDist(out[0], p) + 0.01);
    // 5.3 Flequillo: longitudes alternas, puntas hacia abajo y un poco al centro.
    const bang = [];
    const vBrow = g.brow, vEye = g.eye;
    const L0 = (R.bangTo === 'eye' ? vEye - 0.02 : vBrow + 0.02) - g.hairline + 0.1;
    for (let i = 0; i < R.bangs; i++) {
      const k = R.bangs === 1 ? 0 : (i / (R.bangs - 1)) * 2 - 1;
      const u = k * W * 0.4;
      const root = M.add(surfAt(u, g.hairline - 0.06), M.mul(forward, 0.01));
      const L = L0 * (1 + 0.15 * Math.sin(2.3 * i + 1.7)) * (1 - 0.18 * Math.abs(k));
      const dir = M.norm(M.add(M.add(M.mul(up, -1), M.mul(forward, 0.35)), M.mul(right, -k * 0.18)));
      const pts = spine(root, dir, L, 0.5, hairDist, tauMin, null, 5);
      bang.push(...strandPrims(pts, W * 1.15 / R.bangs + 0.05, forward, region++));
    }
    if (bang.length) out.push({ name: 'hair_bangs', mat: HAIR, prims: bang, joinK: 0.03, joinP: hs(0, g.hairline, 0.3), joinR: 0.5, region: 100 });
    // Mechones laterales delante de las orejas.
    const side = [];
    if (R.sides) {
      for (const sg of [1, -1]) {
        for (let j = 0; j < 2; j++) {
          const root = surfAt(sg * W * (0.42 + j * 0.06), 0.32 + j * 0.04);
          const dir = M.norm(M.add(M.add(M.mul(up, -1), M.mul(right, sg * 0.15)), M.mul(forward, 0.1 - j * 0.1)));
          const pts = spine(root, dir, R.sides * (1 - j * 0.1), R.stiff || 0.3, hairDist, tauMin, null, 5);
          side.push(...strandPrims(pts, 0.24 - j * 0.05, M.norm(M.add(forward, M.mul(right, sg * 0.4))), region++));
        }
      }
      out.push({ name: 'hair_sides', mat: HAIR, prims: side, joinK: 0.03, joinP: hs(0, 0.35, 0), joinR: 0.6, region: 100 });
    }
    // Mechones traseros: nacen en la coronilla y caen hasta la nuca o la cintura.
    const back = [];
    for (let i = 0; i < (R.back || 0); i++) {
      const a = -1.25 + (2.5 * i) / Math.max(1, R.back - 1);
      const u = Math.sin(a) * W * 0.45, zSign = -1;
      const root = surfAt(u, 0.25 + 0.08 * Math.abs(Math.sin(a)), zSign);
      const dir = M.norm(M.add(M.add(M.mul(up, -1), M.mul(forward, -0.12)), M.mul(right, Math.sin(a) * 0.25)));
      const L = R.backLen * (0.9 + 0.12 * Math.sin(3.1 * i));
      const pts = spine(root, dir, L, R.stiff, hairDist, tauMin + 0.01, null, R.backLen > 1 ? 6 : 5);
      back.push(...strandPrims(pts, 0.4, M.mul(forward, -1), region++));
    }
    // Pelo corto: mechones cortos de la coronilla hacia atrás y arriba.
    for (let i = 0; i < (R.crown || 0); i++) {
      const a = (i / R.crown) * Math.PI * 2;
      const root = surfAt(Math.cos(a) * W * 0.25, 0.1, Math.sin(a) > 0 ? 1 : -1);
      const dir = M.norm(M.add(M.mul(forward, -0.8), M.mul(right, Math.cos(a) * 0.5)));
      back.push(...strandPrims(spine(root, dir, 0.3, 0.6, hairDist, tauMin, null, 4), 0.22, up, region++));
    }
    // Mechones delante de los hombros (pelo largo).
    for (let i = 0; i < (R.front || 0); i++) {
      const sg = i % 2 ? 1 : -1;
      const root = surfAt(sg * W * 0.47, 0.55, -1);
      const pts = spine(root, M.norm(M.add(M.mul(up, -1), M.mul(forward, 0.5))), 2.2, 0.15, hairDist, tauMin + 0.02, null, 6);
      back.push(...strandPrims(pts, 0.28, M.mul(right, sg), region++));
    }
    // Coleta(s): los mechones del cráneo van al lazo y del lazo cae un haz.
    for (const [side, v, z] of R.tie || []) {
      const tieP = z < 0 ? surfAt(0, v, -1) : surfAt(side * W * 0.5, v, 1);
      const outward = z < 0 ? M.mul(forward, -1) : M.mul(right, side);
      const tp = M.add(tieP, M.mul(outward, 0.05));
      out.push({ name: 'hair_tie', mat: B().MAT.tie, prims: [ellipsoid(tp, [0.09, 0.09, 0.09])], hard: true });
      for (let j = 0; j < R.bundle; j++) {
        const a = (j / R.bundle) * Math.PI * 2;
        const off = M.add(M.mul(right, Math.cos(a) * 0.05), M.mul(forward, Math.sin(a) * 0.05));
        const dir = M.norm(M.add(M.add(outward, M.mul(up, -0.3)), M.mul(off, 3)));
        const pts = spine(M.add(tp, off), dir, R.bundleLen * (0.9 + 0.1 * Math.sin(j * 2.1)), R.stiff, hairDist, tauMin, null, 6);
        back.push(...strandPrims(pts, 0.2, outward, region++));
      }
    }
    if (R.bun) {
      const bp = surfAt(0, R.bun[1] + 0.1, -1);
      back.push(ellipsoid(M.add(bp, M.add(M.mul(forward, -0.12), M.mul(up, 0.1))), [0.26, 0.24, 0.24], { Rm: Rh, k: 0.05, region: region++ }));
    }
    if (back.length) out.push({ name: 'hair_back', mat: HAIR, prims: back, joinK: 0.03, joinP: hs(0, 0.3, -0.4), joinR: 0.7, region: 100 });
    void T;
    return out;
  }

  function C_guides(sk) { return SC.CANON.head.guides[sk.face]; }

  return { RECIPES, parts, spine, strandPrims };
})();
