// Ropa y pelo sobre la malla de MakeHuman (camino B de docs/auditoria.md).
//
// Ropa: las prendas salen de las mallas auxiliares de MakeHuman, que siguen a
// los morphs y tienen pesos de skinning (el traje ceñido «tights» y la falda
// «skirt»). Cada vértice lleva coordenadas anatómicas (τ del tronco, fracción
// a lo largo del brazo y de la pierna, distancia al cuello) y la prenda es la
// parte de la malla donde un campo es ≤ 0, recortada con cortes rectos y
// separada del cuerpo con una holgura. La falda se abomba con las piernas
// porque sus vértices siguen a los muslos.
//
// Pelo: el casco es el cuero cabelludo desplazado (su borde se funde con la
// piel en el nacimiento del pelo) y los mechones son tiras que caen con la
// gravedad y esquivan el cuerpo (docs/correccion-visual.md, sección 5).
SC.mhDress = (() => {
  const M = SC.AM, MH = SC.mhModel;

  // ---------- Tablas (las usa también el panel de la app) ----------
  const TOPS = {
    camiseta: { name: 'Camiseta', sleeve: 0.35, end: 0.78, e: 0.035 },
    larga: { name: 'Manga larga', sleeve: 0.98, end: 0.78, e: 0.035 },
    tirantes: { name: 'Tirantes', sleeve: -0.1, end: 0.78, e: 0.03, low: true },
    abullonada: { name: 'Manga abullonada', sleeve: 0.3, end: 0.78, e: 0.035, puff: 0.06 },
    vestido: { name: 'Vestido', sleeve: 0.3, end: 0.6, e: 0.035, dress: 0.4 },
    ninguno: { name: 'Ninguno' },
  };
  const BOTTOMS = {
    falda: { name: 'Falda', skirt: 0.35, flare: 0.25 },
    capa: { name: 'Falda de capa', skirt: 0.4, flare: 0.6 },
    larga: { name: 'Falda larga', skirt: 0.85, flare: 0.2 },
    pantalon: { name: 'Pantalón', leg: 0.97 },
    corto: { name: 'Pantalón corto', leg: 0.25 },
    ninguno: { name: 'Ninguno' },
  };
  const SHOES = { zapatos: { name: 'Zapatos', top: 0.93 }, botas: { name: 'Botas', top: 0.62 }, ninguno: { name: 'Descalzo' } };
  // 5.4 Recetas de pelo: grosor del casco τ, mechones y longitudes (en H).
  const RECIPES = {
    corto: { name: 'Corto', tau: 0.05, back: 0.62, bangs: 5, sides: 0.55, backN: 10, backLen: 0.4, stiff: 0.35, crown: 6 },
    bob: { name: 'Media melena', tau: 0.07, back: 0.8, bangs: 7, sides: 0.95, backN: 12, backLen: 0.75, stiff: 0.14 },
    largo: { name: 'Largo', tau: 0.08, back: 0.8, bangs: 7, sides: 1.1, backN: 14, backLen: 2.4, stiff: 0.12, front: 2 },
    coleta: { name: 'Coleta', tau: 0.05, back: 0.78, bangs: 5, sides: 0.7, backN: 0, tie: [[0, 0.32, -1]], bundle: 7, bundleLen: 1.8, stiff: 0.15 },
    coletas: { name: 'Coletas', tau: 0.05, back: 0.78, bangs: 6, sides: 0.75, backN: 0, tie: [[1, 0.3, 0], [-1, 0.3, 0]], bundle: 6, bundleLen: 2.0, stiff: 0.15 },
    mono: { name: 'Moño', tau: 0.045, back: 0.75, bangs: 5, sides: 0.8, backN: 0, bun: [0, 0.12, -0.55], stiff: 0.2 },
    rapado: { name: 'Rapado', tau: 0.015, back: 0.7, bangs: 0, sides: 0, backN: 0 },
  };

  // ---------- Coordenadas anatómicas de cada vértice (en reposo) ----------
  const fcache = new WeakMap();
  function fields(R) {
    if (fcache.has(R)) return fcache.get(R);
    const D = MH.data(), pos = R.pos, m = R.meas, nv = D.nv, J = (n) => MH.jointPos(pos, n);
    const tau = new Float32Array(nv), arm = new Float32Array(nv).fill(-1), leg = new Float32Array(nv).fill(-1), neck = new Float32Array(nv);
    const hu = new Float32Array(nv), hv = new Float32Array(nv), hz = new Float32Array(nv);
    const P = MH.PARTS, pi = (n) => P.indexOf(n);
    const seg = (p, a, b) => { const ab = M.sub(b, a), t = M.clamp(M.dot(M.sub(p, a), ab) / M.dot(ab, ab), 0, 1); return { t, d: M.dist(p, M.add(a, M.mul(ab, t))) }; };
    const chain = (p, a, b, c) => { const s1 = seg(p, a, b), s2 = seg(p, b, c); return s1.d <= s2.d ? 0.5 * s1.t : 0.5 + 0.5 * s2.t; };
    const arms = {}, legs = {};
    for (const S of ['L', 'R']) {
      arms[S] = [J(`upperarm01.${S}____head`), J(`lowerarm01.${S}____head`), J(`wrist.${S}____head`)];
      legs[S] = [J(`upperleg01.${S}____head`), J(`lowerleg01.${S}____head`), J(`foot.${S}____head`)];
    }
    const nk = J('neck01____head');
    let hz0 = 1e9, hz1 = -1e9;
    for (let i = 0; i < nv; i++) if (D.part[i] === pi('head')) { hz0 = Math.min(hz0, pos[i * 3 + 2]); hz1 = Math.max(hz1, pos[i * 3 + 2]); }
    const hzc = (hz0 + hz1) / 2 - 0.1 * m.H;
    for (let i = 0; i < nv; i++) {
      const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], part = P[D.part[i]];
      tau[i] = (m.chin - p[1]) / (m.chin - m.crotch);
      neck[i] = Math.hypot(p[0] - nk[0], p[2] - nk[2]) / m.H;
      const S = p[0] >= 0 ? 'L' : 'R';
      if (/^arm/.test(part)) arm[i] = chain(p, ...arms[S]);
      else if (/^hand/.test(part)) arm[i] = 1.2;
      if (/^leg/.test(part)) leg[i] = chain(p, ...legs[S]);
      else if (/^foot/.test(part)) leg[i] = 1.1;
      hu[i] = p[0] / m.H; hv[i] = (m.top - p[1]) / m.H; hz[i] = (p[2] - hzc) / m.H;
    }
    const out = { tau, arm, leg, neck, hu, hv, hz };
    fcache.set(R, out);
    return out;
  }

  // ---------- Mallas locales y recorte por campos ----------
  // Submalla con los vértices de 'tris' (índices globales) y sus campos.
  function submesh(tris, pos, nrm, flds) {
    const map = new Map(), P = [], N = [], F = flds.map(() => []), T = [];
    for (const i of tris) {
      let j = map.get(i);
      if (j == null) {
        j = P.length / 3; map.set(i, j);
        P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); N.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
        flds.forEach((f, k) => F[k].push(f[i]));
      }
      T.push(j);
    }
    return { P, N, F, T };
  }
  // Conserva donde el campo k es ≤ 0; los triángulos cortados se parten con
  // vértices nuevos sobre las aristas (compartidos, sin grietas).
  function clip(m, k) {
    const f = m.F[k], T = [], cache = new Map();
    const cut = (a, b) => {
      const key = a < b ? a * 1e6 + b : b * 1e6 + a;
      if (cache.has(key)) return cache.get(key);
      const t = f[a] / (f[a] - f[b]), j = m.P.length / 3;
      for (let c = 0; c < 3; c++) { m.P.push(M.lerp(m.P[a * 3 + c], m.P[b * 3 + c], t)); m.N.push(M.lerp(m.N[a * 3 + c], m.N[b * 3 + c], t)); }
      m.F.forEach((g) => g.push(M.lerp(g[a], g[b], t)));
      cache.set(key, j);
      return j;
    };
    for (let i = 0; i < m.T.length; i += 3) {
      const v = [m.T[i], m.T[i + 1], m.T[i + 2]], ins = v.map((x) => f[x] <= 0), n = ins.filter(Boolean).length;
      if (n === 3) { T.push(...v); continue; }
      if (n === 0) continue;
      // Rotar para que el caso sea siempre el mismo (conserva la orientación).
      let r = 0;
      if (n === 1) while (!ins[(r) % 3]) r++; else while (ins[r % 3]) r++;
      const a = v[r % 3], b = v[(r + 1) % 3], c = v[(r + 2) % 3];
      if (n === 1) T.push(a, cut(a, b), cut(a, c)); // a dentro
      else { const ab = cut(a, b), ac = cut(a, c); T.push(ab, b, c, ab, c, ac); } // a fuera
    }
    m.T = T;
    return m;
  }
  // A malla para el rasterizado, desplazada 'e' a lo largo de la normal.
  function finish(m, e, mat, part, region, extra = {}) {
    const n = m.P.length / 3, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const ex = typeof e === 'function' ? e(i) : e;
      const l = Math.hypot(m.N[i * 3], m.N[i * 3 + 1], m.N[i * 3 + 2]) || 1;
      for (let c = 0; c < 3; c++) { nrm[i * 3 + c] = m.N[i * 3 + c] / l; pos[i * 3 + c] = m.P[i * 3 + c] + nrm[i * 3 + c] * ex; }
    }
    return Object.assign({ pos, nrm, tris: new Uint32Array(m.T), mat, part, region }, extra);
  }

  // ---------- Formas simples para mechones y adornos ----------
  // Tira de sección elíptica (ancho w, grosor w/3) a lo largo de una espina.
  function strand(pts, w0, outward) {
    const P = [], N = [], T = [], K = 6, n = pts.length;
    for (let i = 0; i < n; i++) {
      const tg = M.norm(M.sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
      let side = M.cross(tg, outward);
      if (M.len(side) < 1e-6) side = M.cross(tg, [1, 0, 0]);
      side = M.norm(side);
      const up = M.norm(M.cross(side, tg)), t = i / (n - 1), w = (w0 * (1 - 0.92 * Math.pow(t, 1.6))) / 2;
      for (let k = 0; k < K; k++) {
        const a = (k / K) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const d = M.add(M.mul(side, c * w), M.mul(up, s * w * 0.34));
        P.push(...M.add(pts[i], d)); N.push(...M.norm(M.add(M.mul(side, c * 0.34), M.mul(up, s))));
      }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < K; k++) {
      const a = i * K + k, b = i * K + ((k + 1) % K), c = a + K, d = b + K;
      T.push(a, b, d, a, d, c);
    }
    return { P, N, T };
  }
  function sphere(c, r, rot, seg = 10) {
    const P = [], N = [], T = [];
    for (let i = 0; i <= seg; i++) for (let j = 0; j <= seg; j++) {
      const th = (i / seg) * Math.PI, ph = (j / seg) * Math.PI * 2;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)], nw = rot ? M.mv(rot, n) : n;
      P.push(...M.add(c, M.mul(nw, r))); N.push(...nw);
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      T.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return { P, N, T };
  }
  const toMesh = (g, mat, part, region, extra = {}) => Object.assign({ pos: new Float32Array(g.P), nrm: new Float32Array(g.N), tris: new Uint32Array(g.T), mat, part, region }, extra);

  // Colisión aproximada con el cuerpo posado: vértices en una rejilla hash;
  // un punto a menos de 'min' de la piel se empuja por la normal.
  function bodyCollider(pos, nrm, D) {
    const cell = 0.15, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
    for (let i = 0; i < D.nv; i++) {
      if (!D.inMesh.body[i]) continue;
      const k = key(Math.floor(pos[i * 3] / cell), Math.floor(pos[i * 3 + 1] / cell), Math.floor(pos[i * 3 + 2] / cell));
      const l = grid.get(k); if (l) l.push(i); else grid.set(k, [i]);
    }
    return (p, min) => {
      const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
      let best = -1, bd = Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const i of grid.get(key(cx + dx, cy + dy, cz + dz)) || []) {
          const d = (pos[i * 3] - p[0]) ** 2 + (pos[i * 3 + 1] - p[1]) ** 2 + (pos[i * 3 + 2] - p[2]) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
      }
      if (best < 0) return p;
      const n = [nrm[best * 3], nrm[best * 3 + 1], nrm[best * 3 + 2]], v = [pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2]];
      const sd = M.dot(M.sub(p, v), n);
      return sd < min ? M.add(p, M.mul(n, min - sd)) : p;
    };
  }

  // 5.2 Espina de un mechón: x_{i+1} = x_i + Δ d_i, d_{i+1} = norm(d_i + Δ/κ g),
  // empujada fuera del cuerpo en cada paso.
  function spine(start, dir0, L, stiff, collide, min, target, steps = 6) {
    const pts = [start];
    let x = start, d = M.norm(dir0);
    const Dl = L / steps;
    for (let i = 0; i < steps; i++) {
      x = collide(M.add(x, M.mul(d, Dl)), min);
      pts.push(x);
      const g = target ? M.norm(M.sub(target, x)) : [0, -1, 0];
      d = M.norm(M.add(d, M.mul(g, Dl / Math.max(0.2, stiff))));
    }
    return pts;
  }

  // ---------- Montaje ----------
  // Añade a 'meshes' la ropa y el pelo del personaje (r = salida de MH.pose).
  function add(meshes, parts, r, sk, look, MAT) {
    const D = MH.data(), F = fields(r.rest), body = meshes[0], pos = r.pos, nrm = body.nrm;
    const partOf = (name) => { let i = parts.indexOf(name); if (i < 0) { parts.push(name); i = parts.length - 1; } return i; };
    const PI = (n) => MH.PARTS.indexOf(n);
    const isArm = (i) => D.part[i] === PI('arm_L') || D.part[i] === PI('arm_R');
    const isHand = (i) => D.part[i] === PI('hand_L') || D.part[i] === PI('hand_R');
    const isLeg = (i) => D.part[i] === PI('leg_L') || D.part[i] === PI('leg_R');
    const isFoot = (i) => D.part[i] === PI('foot_L') || D.part[i] === PI('foot_R');
    const isTrunk = (i) => D.part[i] === PI('torso') || D.part[i] === PI('neck');
    const tights = D.tris.tights, nv = D.nv;
    const top = TOPS[look.topStyle] || TOPS.ninguno, bot = BOTTOMS[look.bottomStyle] || BOTTOMS.ninguno, shoe = SHOES[look.shoeStyle] || SHOES.ninguno;
    const tauW = sk.tau.waist;

    // Parte superior: tronco hasta τ_fin sin el hueco del cuello, y mangas.
    const skirtLen = bot.skirt || top.dress;
    if (top.e) {
      // Con falda la camiseta va por dentro: termina justo bajo la cintura.
      let end = top.end;
      if (skirtLen) {
        const m0 = r.rest.meas, rp = r.rest.pos;
        let yTop = -1e9;
        for (const i of D.tris.skirt) yTop = Math.max(yTop, rp[i * 3 + 1]);
        const tauTop = Math.max(tauW, (m0.chin - yTop) / (m0.chin - m0.crotch));
        end = Math.min(top.end, tauTop + 0.05);
      }
      const f = new Float32Array(nv).fill(1);
      const neckR = 0.42, tauN = top.low ? 0.24 : 0.1;
      for (let i = 0; i < nv; i++) {
        if (D.part[i] === PI('neck')) f[i] = 1;
        else if (isTrunk(i)) f[i] = Math.max(F.tau[i] - end, Math.min(neckR - F.neck[i], tauN - F.tau[i]) * (top.low ? 0.6 : 2));
        else if (isArm(i)) f[i] = F.arm[i] - top.sleeve;
        else if (isLeg(i)) f[i] = F.tau[i] - end; // el bajo sigue τ también sobre la cadera
      }
      const m = clip(submesh(tights, pos, nrm, [f, F.arm]), 0);
      const puff = top.puff || 0;
      meshes.push(finish(m, (i) => top.e + (puff && m.F[1][i] >= 0 ? puff * Math.sin(Math.PI * M.clamp(m.F[1][i] / top.sleeve, 0, 1)) : 0), MAT.top, partOf('top'), 0));
    }
    // Pantalón: desde la cintura, piernas hasta 'leg'.
    if (bot.leg) {
      const f = new Float32Array(nv).fill(1);
      for (let i = 0; i < nv; i++) {
        if (isTrunk(i)) f[i] = tauW - F.tau[i];
        else if (isLeg(i)) f[i] = F.leg[i] - bot.leg;
      }
      meshes.push(finish(clip(submesh(tights, pos, nrm, [f]), 0), 0.03, MAT.bottom, partOf('pants'), 0));
    }
    // Falda (o la falda del vestido): la falda de MakeHuman recortada a su
    // largo, abierta según el vuelo y separada de las caderas.
    if (skirtLen) {
      const flare = bot.flare != null ? bot.flare : 0.25, m0 = r.rest.meas;
      const hem = m0.crotch - skirtLen * m0.leg, f = new Float32Array(nv).fill(1), drop = new Float32Array(nv), wst = new Float32Array(nv);
      const rpos = r.rest.pos, waistY = m0.chin - tauW * (m0.chin - m0.crotch);
      for (let i = 0; i < nv; i++) { f[i] = hem - rpos[i * 3 + 1]; wst[i] = rpos[i * 3 + 1] - waistY; drop[i] = M.clamp((m0.crotch + 0.1 * m0.torso - rpos[i * 3 + 1]) / m0.leg, 0, 1); }
      // Recortada en el bajo y, recta, en la cintura.
      const m = clip(clip(submesh(D.tris.skirt, pos, nrm, [f, drop, wst]), 0), 2);
      // 8.2 La falda reacciona a las piernas: sus vértices se empujan fuera de
      // cápsulas alrededor de muslo y pierna (radio del canon + holgura).
      const caps = [];
      for (const S of ['L', 'R']) {
        const J = (b, j) => r.at(b, MH.jointPos(r.rest.pos, j));
        const hip = J(`upperleg01.${S}`, `upperleg01.${S}____head`), knee = J(`lowerleg01.${S}`, `lowerleg01.${S}____head`), ankle = J(`foot.${S}`, `foot.${S}____head`);
        caps.push([hip, knee, sk.w.thigh * 0.5 + 0.1, sk.w.knee * 0.5 + 0.09], [knee, ankle, sk.w.knee * 0.5 + 0.09, sk.w.ankle * 0.5 + 0.08]);
      }
      for (let i = 0; i < m.P.length / 3; i++) {
        let p = [m.P[i * 3], m.P[i * 3 + 1], m.P[i * 3 + 2]];
        for (const [a0, b0, ra, rb] of caps) {
          const ab = M.sub(b0, a0), t = M.clamp(M.dot(M.sub(p, a0), ab) / M.dot(ab, ab), 0, 1);
          const c = M.add(a0, M.mul(ab, t)), d = M.sub(p, c), l = M.len(d), rr = M.lerp(ra, rb, t);
          if (l < rr && l > 1e-6) p = M.add(c, M.mul(d, rr / l));
        }
        m.P[i * 3] = p[0]; m.P[i * 3 + 1] = p[1]; m.P[i * 3 + 2] = p[2];
      }
      // Vuelo: se abre en horizontal desde el eje del cuerpo, más cuanto más abajo.
      const c = r.at('spine05', MH.jointPos(r.rest.pos, 'spine05____head'));
      const cz = c[2];
      for (let i = 0; i < m.P.length / 3; i++) {
        const k = flare * m.F[1][i] * 1.6;
        m.P[i * 3] = c[0] + (m.P[i * 3] - c[0]) * (1 + k);
        m.P[i * 3 + 2] = cz + (m.P[i * 3 + 2] - cz) * (1 + k * 0.8);
      }
      meshes.push(finish(m, 0.045, top.dress && !bot.skirt ? MAT.top : MAT.bottom, partOf('skirt'), 0));
    }
    // Calzado: pies y, en botas, la caña hasta 'top'.
    if (shoe.top) {
      const f = new Float32Array(nv).fill(1);
      for (let i = 0; i < nv; i++) { if (isFoot(i)) f[i] = -1; else if (isLeg(i)) f[i] = shoe.top - F.leg[i]; }
      meshes.push(finish(clip(submesh(tights, pos, nrm, [f]), 0), 0.035, MAT.shoes, partOf('shoes'), 0));
    }
    void isHand;
    hair(meshes, partOf, r, sk, look, MAT, F, body);
  }

  // ---------- Pelo ----------
  function hair(meshes, partOf, r, sk, look, MAT, F, body) {
    const R = RECIPES[look.hairStyle] || RECIPES.corto, D = MH.data(), hd = r.head, W = hd.W;
    const G = SC.CANON.head.guides[sk.face], pos = r.pos, nrm = body.nrm, nv = D.nv, head = MH.PARTS.indexOf('head');
    // Casco: cuero cabelludo (delante hasta el nacimiento, a los lados sobre las
    // orejas, detrás hasta la nuca), desplazado τ y fundido a 0 en el borde.
    const hairline = G.hairline - 0.02, f = new Float32Array(nv).fill(1);
    const sm = (t) => { t = M.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    const neckP = MH.PARTS.indexOf('neck'), inCap = (i) => D.inMesh.body[i] && (D.part[i] === head || (D.part[i] === neckP && F.hz[i] < -0.1));
    for (let i = 0; i < nv; i++) {
      if (!inCap(i)) continue;
      const z = F.hz[i], u = Math.abs(F.hu[i]);
      const front = sm((z - 0.05) / 0.25), back = sm((-z - 0.05) / 0.2);
      let lim = M.lerp(0.36, hairline, front);
      lim = M.lerp(lim, R.back, back);
      if (u > 0.26 && z > -0.05) lim = Math.min(lim, 0.36); // sobre las orejas
      f[i] = F.hv[i] - lim;
    }
    const tris = D.tris.body, list = [];
    for (let t = 0; t < tris.length; t += 3) if (inCap(tris[t]) && inCap(tris[t + 1]) && inCap(tris[t + 2])) list.push(tris[t], tris[t + 1], tris[t + 2]);
    const cap = clip(submesh(list, pos, nrm, [f]), 0);
    const tau = R.tau;
    const capMesh = finish(cap, (i) => tau * sm(-cap.F[0][i] / 0.06), MAT.hair, partOf('hair'), 100, { hair: true });
    meshes.push(capMesh);
    if (look.hairStyle === 'rapado') return;
    // Mechones.
    const collide = bodyCollider(pos, nrm, D), min = tau + 0.025;
    const Rh = hd.rot, fwd = M.mv(Rh, [0, 0, 1]), up = M.mv(Rh, [0, 1, 0]), right = M.mv(Rh, [1, 0, 0]);
    const surfAt = (u, v, zs = 1) => {
      const hit = hd.raycast(hd.hs(u, v, zs * 1.6), M.mul(fwd, -zs));
      return hit ? M.add(hit.p, M.mul(hit.n, tau * 0.9)) : hd.hs(u, v, zs * 0.4);
    };
    let region = 101;
    const push = (pts, w, out) => meshes.push(toMesh(strand(pts, w, out), MAT.hair, partOf('hair'), region++, { hair: true }));
    // Flequillo: longitudes alternas, puntas hacia abajo y un poco al centro.
    const L0 = G.brow + 0.02 - G.hairline + 0.1;
    for (let i = 0; i < R.bangs; i++) {
      const k = R.bangs === 1 ? 0 : (i / (R.bangs - 1)) * 2 - 1;
      const root = surfAt(k * W * 0.4, G.hairline - 0.05);
      const L = L0 * (1 + 0.15 * Math.sin(2.3 * i + 1.7)) * (1 - 0.18 * Math.abs(k));
      const dir = M.norm(M.add(M.add(M.mul(up, -1), M.mul(fwd, 0.35)), M.mul(right, -k * 0.18)));
      push(spine(root, dir, L, 0.5, collide, min, null, 5), (W * 1.5) / R.bangs + 0.07, fwd);
    }
    // Mechones laterales delante de las orejas.
    for (const sg of R.sides ? [1, -1] : []) {
      for (let j = 0; j < 2; j++) {
        const root = surfAt(sg * W * (0.42 + j * 0.05), 0.3 + j * 0.05);
        const dir = M.norm(M.add(M.add(M.mul(up, -1), M.mul(right, sg * 0.15)), M.mul(fwd, -0.12 - j * 0.1)));
        push(spine(root, dir, R.sides * (1 - j * 0.1), R.stiff || 0.3, collide, min, null, 6), 0.3 - j * 0.05, M.norm(M.add(M.mul(fwd, 0.4), M.mul(right, sg))));
      }
    }
    // Mechones traseros: de la coronilla hacia la nuca o la espalda.
    for (let i = 0; i < (R.backN || 0); i++) {
      const a = -1.3 + (2.6 * i) / Math.max(1, R.backN - 1);
      const root = surfAt(Math.sin(a) * W * 0.45, 0.22 + 0.1 * Math.abs(Math.sin(a)), -1);
      const dir = M.norm(M.add(M.add(M.mul(up, -1), M.mul(fwd, -0.15)), M.mul(right, Math.sin(a) * 0.3)));
      const L = R.backLen * (0.9 + 0.12 * Math.sin(3.1 * i));
      push(spine(root, dir, L, R.stiff, collide, min + 0.01, null, R.backLen > 1 ? 9 : 6), 0.48, M.mul(fwd, -1));
    }
    // Pelo corto: mechones de la coronilla hacia atrás.
    for (let i = 0; i < (R.crown || 0); i++) {
      const a = (i / R.crown) * Math.PI * 2;
      const root = surfAt(Math.cos(a) * W * 0.25, 0.1, Math.sin(a) > 0 ? 1 : -1);
      const dir = M.norm(M.add(M.mul(fwd, -0.8), M.mul(right, Math.cos(a) * 0.5)));
      push(spine(root, dir, 0.3, 0.6, collide, min, null, 4), 0.2, up);
    }
    // Pelo largo: dos mechones delante de los hombros.
    for (let i = 0; i < (R.front || 0); i++) {
      const sg = i % 2 ? 1 : -1;
      const root = surfAt(sg * W * 0.46, 0.5, -1);
      push(spine(root, M.norm(M.add(M.mul(up, -1), M.mul(fwd, 0.45))), 2.0, 0.15, collide, min + 0.02, null, 8), 0.26, M.mul(right, sg));
    }
    // Coleta(s): lazo y haz de mechones que cae de él.
    for (const [side, v, z] of R.tie || []) {
      const tieP = z < 0 ? surfAt(0, v, -1) : surfAt(side * W * 0.5, v, 1);
      const out = z < 0 ? M.mul(fwd, -1) : M.mul(right, side), tp = M.add(tieP, M.mul(out, 0.04));
      meshes.push(toMesh(sphere(tp, 0.08, Rh, 8), MAT.tie, partOf('hair'), 0));
      for (let j = 0; j < R.bundle; j++) {
        const a = (j / R.bundle) * Math.PI * 2, off = M.add(M.mul(right, Math.cos(a) * 0.05), M.mul(fwd, Math.sin(a) * 0.05));
        const dir = M.norm(M.add(M.add(out, M.mul(up, -0.3)), M.mul(off, 3)));
        push(spine(M.add(tp, off), dir, R.bundleLen * (0.9 + 0.1 * Math.sin(j * 2.1)), R.stiff, collide, min, null, 8), 0.2, out);
      }
    }
    if (R.bun) {
      const bp = surfAt(0, R.bun[1] + 0.1, -1);
      meshes.push(toMesh(sphere(M.add(bp, M.add(M.mul(fwd, -0.14), M.mul(up, 0.08))), 0.24, Rh, 12), MAT.hair, partOf('hair'), region++, { hair: true }));
    }
  }

  return { TOPS, BOTTOMS, SHOES, RECIPES, add, fields, clip, submesh };
})();
