// Anatomía base: torso, brazos, manos, piernas, pies, cabeza y orejas.
//
// Cada extremidad usa perfiles musculares (deltoides, bíceps, tríceps,
// braquiorradial, cuádriceps, isquios, gemelos...) que cambian con el sexo y
// la musculatura. Los detalles (clavículas, esternón, abdomen, rodillas,
// omóplatos, columna) son líneas sobre la superficie 3D, así que se mueven y
// se ocultan correctamente al girar el personaje.
(() => {
  const U = SC.util, Vc = SC.vec, V = SC.V, C = U.curve;

  // ---------- Perfiles musculares [u, multiplicador del radio] ----------
  const ARM = [
    { a: [[0, 1.05], [0.12, 1.14], [0.36, 0.95], [0.7, 0.82], [1, 0.66]],
      a2: [[0, 0.86], [0.3, 0.8], [0.7, 0.72], [1, 0.64]],
      b: [[0, 0.9], [0.3, 0.84], [0.56, 0.9], [0.85, 0.74], [1, 0.62]],
      b2: [[0, 0.96], [0.36, 0.98], [0.7, 0.82], [1, 0.66]], mus: { b: [0.56, 0.16], b2: [0.36, 0.12], a: [0.12, 0.14] } },
    { a: [[0, 0.68], [0.2, 0.77], [0.55, 0.6], [1, 0.44]],
      a2: [[0, 0.66], [0.2, 0.72], [0.55, 0.58], [1, 0.42]],
      b: [[0, 0.62], [0.25, 0.67], [0.6, 0.5], [1, 0.3]],
      b2: [[0, 0.64], [0.2, 0.6], [1, 0.32]], mus: { a: [0.2, 0.1] } },
  ];
  const LEG = [
    { a: [[0, 1.06], [0.15, 1.03], [0.5, 0.87], [0.85, 0.68], [1, 0.6]],
      a2: [[0, 0.9], [0.2, 0.86], [0.6, 0.67], [1, 0.55]],
      b: [[0, 0.93], [0.36, 0.96], [0.8, 0.71], [1, 0.63]],
      b2: [[0, 1.0], [0.12, 0.98], [0.5, 0.83], [1, 0.58]], mus: { b: [0.36, 0.1], a: [0.4, 0.06] } },
    { a: [[0, 0.6], [0.25, 0.65], [0.6, 0.47], [0.9, 0.34], [1, 0.32]],
      a2: [[0, 0.58], [0.3, 0.67], [0.6, 0.48], [0.9, 0.34], [1, 0.32]],
      b: [[0, 0.68], [0.12, 0.57], [0.5, 0.47], [1, 0.3]],
      b2: [[0, 0.56], [0.28, 0.8], [0.6, 0.56], [0.88, 0.34], [1, 0.32]], mus: { b2: [0.28, 0.1] } },
  ];

  // Radio de un perfil en u, con más relieve muscular si procede y más suave en cuerpos femeninos.
  function prof(p, key, u, rig) {
    let r = C(p[key], u);
    const m = p.mus && p.mus[key];
    if (m) r += m[1] * (rig.body.muscle - 0.3) * Math.exp(-((u - m[0]) ** 2) / 0.03);
    return r;
  }

  // Sección de un segmento de extremidad.
  function limbSec(rig, c, d, frontHint, s, radius, profile, u) {
    const v = Vc.orth(frontHint, d, Vc.v(0, -1, 0));
    let uu = Vc.norm(Vc.cross(d, v));
    if (uu.x * s < 0) uu = Vc.mul(uu, -1);
    // En cuerpos femeninos el contorno exterior es más suave.
    const soft = (x) => U.lerp(x, 0.5 * (C(profile.a, u) + C(profile.a2, u)), rig.fem * 0.25);
    return V.sec(c, uu, v,
      radius * soft(prof(profile, 'a', u, rig)), radius * prof(profile, 'a2', u, rig),
      radius * prof(profile, 'b', u, rig), radius * prof(profile, 'b2', u, rig));
  }

  // Especificación de una extremidad de dos segmentos: nivel 0..1 primer hueso, 1..2 segundo.
  // Niveles negativos forman un casquete redondeado en la raíz (hombro, cadera).
  const CAP = 0.16;
  function limb(rig, chain, radius, profiles, fronts, lens) {
    return (l) => {
      if (l < 0) {
        const k = Math.sqrt(Math.max(0.02, 1 - (l / CAP) ** 2));
        const s = limbSec(rig, Vc.madd(chain[0], chain.d[0], l * radius * 5), chain.d[0], fronts[0], chain.s, radius * k, profiles[0], 0);
        return s;
      }
      const i = l < 1 ? 0 : 1, u = U.clamp(l - i, 0, 1);
      return limbSec(rig, Vc.madd(chain[i], chain.d[i], u * lens[i]), chain.d[i], fronts[i], chain.s, radius, profiles[i], u);
    };
  }

  const LEVELS = (n, a, b) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

  // Anillos de una superficie entre dos niveles; topFn/botFn permiten bordes inclinados.
  function shellRings(at, e, l0, l1, o = {}) {
    const n = o.n || 16, steps = Math.max(2, Math.ceil(Math.abs(l1 - l0) * (o.density || 22)));
    const rings = [];
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, ring = [];
      for (let k = 0; k < n; k++) {
        const phi = (k / n) * Math.PI * 2;
        const top = o.topFn ? o.topFn(phi) : l0, bot = o.botFn ? o.botFn(phi) : l1;
        const l = U.lerp(top, bot, t);
        const ee = typeof e === 'function' ? e(l, phi) : e;
        ring.push(V.surf(at(l), phi, ee));
      }
      rings.push(ring);
    }
    return rings;
  }

  function shellVol(rig, at, e, l0, l1, o = {}) {
    const s = at((l0 + l1) / 2);
    return V.fromRings(rig, shellRings(at, e, l0, l1, o), (s.a + s.b) / 2);
  }

  // ---------- Construcción ----------
  function build(rig) {
    const d = rig.dim;
    // Torso
    const T = { at: rig.torso.at, L: rig.torso.L };
    const tl = new Set([...rig.torso.keys.map((k) => k.l), ...LEVELS(40, 0, 1)]);
    T.levels = [...tl].sort((a, b) => a - b);
    T.vol = V.fromSections(rig, T.levels.map((l) => T.at(l)), rig.detail === 'high' ? 24 : 16);
    T.vol.rad = d.chestHalf * 0.8;
    T.shell = (e, l0, l1, o) => shellVol(rig, T.at, e, l0, l1, o);
    T.shellRings = (e, l0, l1, o) => shellRings(T.at, e, l0, l1, o);

    // Piernas
    const legs = rig.legs.map((L) => {
      const chain = [L.J, L.knee];
      chain.d = [L.d1, L.d2];
      chain.s = L.s;
      const at = limb(rig, chain, d.legR, LEG, [Vc.v(0, 0, 1), Vc.v(0, 0, 1)], [d.thighL, d.shinL]);
      const secs = LEVELS(20, 0, 2).map(at);
      const vol = V.fromSections(rig, secs);
      vol.rad = d.legR * 0.8;
      // Pie
      const F = d.footL, fh = d.fh, fd = L.footDir;
      const lat = Vc.norm(Vc.cross(Vc.v(0, -1, 0), fd));
      const bottom = L.ankle.y + fh;
      const footAt = V.spec([
        [-0.22, 0.1, 0.55], [-0.15, 0.13, 0.95], [0.0, 0.15, 1.3], [0.25, 0.17, 0.82],
        [0.5, 0.2, 0.52], [0.66, 0.185, 0.42], [0.78, 0.12, 0.28],
      ].map(([x, w, h]) => {
        const c = Vc.madd(Vc.v(L.ankle.x, bottom - (h * fh) / 2, L.ankle.z), fd, x * F);
        return { l: (x + 0.22) / 1.0, s: V.sec(c, lat, Vc.v(0, -1, 0), w * F, w * F, (h * fh) / 2, (h * fh) / 2) };
      }));
      const footVol = (e = 0, l0 = 0, l1 = 1) => V.fromSections(rig, LEVELS(12, l0, l1).map((l) => {
        const s = footAt(l);
        return Object.assign({}, s, { a: s.a + e, a2: s.a2 + e, b: s.b + e, b2: s.b2 + e * 0.35, c: Vc.madd(s.c, Vc.v(0, -1, 0), e * 0.3) });
      }));
      const pz = V.proj(rig, L.J).z;
      return {
        s: L.s, rig: L, at, vol, footAt, footVol,
        shell: (e, l0, l1, o) => shellVol(rig, at, e, l0, l1, Object.assign({ density: 10 }, o)),
        z: pz - 0.5,
      };
    });

    // Brazos
    const arms = rig.arms.map((A) => {
      const chain = [A.S, A.elbow];
      chain.d = [A.d1, A.d2];
      chain.s = A.s;
      const at = limb(rig, chain, d.armR, ARM, [A.bendDir, A.bendDir], [d.upperL, d.foreL]);
      const secs = LEVELS(4, -CAP, -0.01).concat(LEVELS(20, 0, 2)).map(at);
      const vol = V.fromSections(rig, secs);
      vol.rad = d.armR * 0.8;
      const pz = V.proj(rig, A.S).z;
      return {
        s: A.s, rig: A, at, vol, capL: -CAP,
        shell: (e, l0, l1, o) => shellVol(rig, at, e, Math.max(l0, -CAP), l1, Object.assign({ density: 10 }, o)),
        z: pz + 0.2,
      };
    });

    // Cabeza
    const H = rig.head;
    const hl = [...new Set([...H.keys.map((k) => k.l), ...LEVELS(30, 0, 1)])].sort((a, b) => a - b);
    const nose = noseTube(rig);
    const Hd = { at: H.at, levels: hl };
    Hd.skull = V.fromSections(rig, hl.map((l) => H.at(l)), rig.detail === 'high' ? 32 : 16);
    Hd.vol = V.merge(Hd.skull, nose);
    Hd.vol.rad = H.w * 0.7;
    Hd.shell = (e, l0, l1, o) => shellVol(rig, H.at, e, l0, l1, o);
    Hd.shellRings = (e, l0, l1, o) => shellRings(H.at, e, l0, l1, o);
    Hd.ears = [-1, 1].map((s) => ear(rig, s));
    return { torso: T, legs, arms, head: Hd };
  }

  function noseTube(rig) {
    const H = rig.head, F = rig.face;
    const len = H.w * U.lerp(0.2, 0.15, rig.fem) * (1 - 0.65 * rig.chibi);
    const p0 = V.surf(H.at(F.brow + 0.05), 0, -H.w * 0.02);
    const p1 = V.surf(H.at(F.nose - 0.02), 0, len);
    const p2 = V.surf(H.at(F.nose + 0.05), 0, -H.w * 0.02);
    return V.tube(rig, [p0, Vc.lerp(p0, p1, 0.5), p1, p2], [H.w * 0.05, H.w * 0.07, H.w * 0.06, H.w * 0.04], 1, 8);
  }

  function ear(rig, s) {
    const H = rig.head, F = rig.face;
    const elf = rig.earType === 'elf';
    const l0 = F.brow + 0.08, l1 = F.nose + 0.06;
    const phi = s * (Math.PI / 2 + 0.12);
    const mk = (l, out, back, r1, r2) => {
      const base = H.at(l);
      const c = V.surf(base, phi, out);
      return V.sec(Vc.madd(c, H.dirTo(Vc.v(0, 0, -1)), back), H.dirTo(Vc.v(s, 0, 0)), H.dirTo(Vc.v(0, 0, 1)), r1 * 0.35, r1 * 0.35, r2, r2);
    };
    const secs = [];
    if (elf) secs.push(mk(l0 - 0.22, H.w * 0.34, H.w * 0.28, H.w * 0.04, H.w * 0.03), mk(l0 - 0.08, H.w * 0.18, H.w * 0.12, H.w * 0.12, H.w * 0.1));
    secs.push(mk(l0, H.w * 0.08, 0, H.w * 0.16, H.h * 0.06), mk((l0 + l1) / 2, H.w * 0.07, 0, H.w * 0.2, H.h * 0.065), mk(l1, H.w * 0.02, H.w * 0.02, H.w * 0.12, H.h * 0.04));
    const vol = V.fromSections(rig, secs, 16);
    const dz = V.proj(rig, secs[secs.length - 2].c).z - V.proj(rig, H.c).z;
    return { s, vol, secs, front: dz > H.w * 0.45 };
  }

  // ---------- Dibujo ----------
  function detail(rig, skin, k = 0.32) { return U.shade(skin, -k); }

  function drawTorsoSkin(ctx, rig, c, T) {
    const skin = c.skin, L = T.L, lw = rig.line * 0.7;
    V.fill(ctx, rig, T.vol, skin, { shadeK: 0.3 });
    if (rig.detail !== 'high') return;
    const at = T.at, col = detail(rig, skin), clip = T.vol;
    const dl = (pts, w = lw, cc = col, thr) => V.dline(ctx, rig, at, pts, cc, w, { clip, thr });
    // Sombra de la barbilla sobre el cuello
    V.decal(ctx, rig, at, V.curvePts(12, (t) => [0.01 + 0.07 * Math.sin(t * Math.PI), -1.1 + 2.2 * t]), { fill: U.rgba(U.shade(skin, -0.45), 0.2), clip, minVis: 0.2 });
    // Clavículas
    for (const s of [-1, 1]) {
      dl(V.curvePts(8, (t) => [U.lerp(L.neckBase + 0.035, L.shoulder - 0.005, t) + 0.02 * Math.sin(t * Math.PI), s * U.lerp(0.28, 1.05, t)]), lw * 0.9);
    }
    // Hueco del esternón / cuello masculino
    if (!rig.fem) {
      dl(V.curvePts(6, (t) => [U.lerp(0.25, 0.7, t) * L.neckBase, U.lerp(-0.12, 0.05, t)]), lw * 0.7);
    }
    if (rig.fem) {
      // Pecho: curva inferior y sombra
      for (const s of [-1, 1]) {
        const pts = V.curvePts(10, (t) => [L.underbust - 0.018 + 0.022 * Math.sin(t * Math.PI) * -1 + 0.02, s * U.lerp(0.12, 0.95, t)]);
        V.decal(ctx, rig, at, pts.concat(pts.slice().reverse().map(([l, p]) => [l - 0.03, p])), { fill: U.rgba(U.shade(skin, -0.45), 0.22 + 0.2 * rig.body.bust), clip, minVis: 0.3 });
        dl(V.curvePts(10, (t) => [L.underbust - 0.012 - 0.02 * Math.sin(t * Math.PI) + 0.012, s * U.lerp(0.14, 0.9, t)]), lw * 0.9);
      }
    } else {
      // Pectorales
      for (const s of [-1, 1]) {
        dl(V.curvePts(10, (t) => [L.underbust - 0.02 + 0.012 * Math.sin(t * Math.PI), s * U.lerp(0.06, 0.85, t) ]), lw);
      }
      dl([[L.armpit, 0], [L.underbust + 0.01, 0]], lw * 0.8);
      // Abdominales según musculatura
      if (rig.body.muscle > 0.35) {
        const a = U.clamp((rig.body.muscle - 0.35) / 0.5, 0, 1) * 0.9;
        const acol = U.rgba(col, a);
        dl([[L.underbust + 0.02, 0], [L.navel + 0.05, 0]], lw * 0.8, acol);
        for (const l of [L.underbust + 0.06, L.waist - 0.03, L.waist + 0.04]) {
          for (const s of [-1, 1]) dl(V.curvePts(4, (t) => [l + 0.006 * Math.sin(t * Math.PI), s * U.lerp(0.06, 0.34, t)]), lw * 0.7, acol);
        }
        for (const s of [-1, 1]) dl(V.curvePts(8, (t) => [U.lerp(L.underbust, L.hip, t), s * U.lerp(0.46, 0.36, t)]), lw * 0.6, acol);
      }
    }
    // Ombligo
    V.decal(ctx, rig, at, V.curvePts(8, (t) => [L.navel + 0.012 * Math.sin(t * Math.PI * 2), 0.035 * Math.cos(t * Math.PI * 2)]), { fill: U.rgba(U.shade(skin, -0.55), 0.7), clip, minVis: 0.9 });
    // Cintura / oblicuos
    for (const s of [-1, 1]) dl(V.curvePts(8, (t) => [U.lerp(L.waist - 0.04, L.hip + 0.04, t), s * U.lerp(1.2, 1.0, t)]), lw * 0.5, U.rgba(col, 0.5));
    // Espalda: columna y omóplatos
    dl(V.curvePts(12, (t) => [U.lerp(L.neckBase, L.hip, t), Math.PI]), lw * 0.8, U.rgba(col, 0.8));
    for (const s of [-1, 1]) {
      dl(V.curvePts(8, (t) => [U.lerp(L.shoulder + 0.03, L.underbust, t), s * (Math.PI - U.lerp(0.55, 0.35, t) - 0.12 * Math.sin(t * Math.PI))]), lw * 0.8, U.rgba(col, 0.7));
    }
  }

  function drawLeg(ctx, rig, c, Lg) {
    V.fill(ctx, rig, Lg.vol, c.skin);
    if (rig.detail === 'high') {
      // Rótula y tobillo
      const col = detail(rig, c.skin);
      V.dline(ctx, rig, Lg.at, V.curvePts(8, (t) => [0.98 + 0.08 * Math.sin(t * Math.PI), U.lerp(-0.5, 0.5, t)]), col, rig.line * 0.6, { clip: Lg.vol });
      V.dline(ctx, rig, Lg.at, V.curvePts(6, (t) => [U.lerp(1.3, 1.6, t), 0.1 + 0.05 * Math.sin(t * Math.PI)]), U.rgba(col, 0.5), rig.line * 0.5, { clip: Lg.vol });
    }
    if (!rig.hasShoes) {
      const fv = Lg.footVol();
      V.fill(ctx, rig, fv, c.skin);
      if (rig.detail === 'high') {
        // Dedos
        for (const p of [-0.45, -0.1, 0.25]) {
          V.dline(ctx, rig, Lg.footAt, [[0.85, p * Lg.s], [0.99, p * Lg.s]], detail(rig, c.skin), rig.line * 0.5, { clip: fv, thr: -0.2 });
        }
      }
    }
  }

  function drawArm(ctx, rig, c, A) {
    V.fill(ctx, rig, A.vol, c.skin);
    if (rig.detail === 'high') {
      const col = U.rgba(detail(rig, c.skin), 0.6);
      // Pliegue del codo y línea del deltoides
      V.dline(ctx, rig, A.at, V.curvePts(6, (t) => [1 + 0.03 * Math.sin(t * Math.PI), U.lerp(-0.5, 0.5, t)]), col, rig.line * 0.5, { clip: A.vol });
      V.dline(ctx, rig, A.at, V.curvePts(6, (t) => [U.lerp(0.08, 0.42, t), U.lerp(0.7, 1.3, t)]), col, rig.line * 0.5, { clip: A.vol });
    }
  }

  // Mano: palma, dedos y pulgar como volúmenes; líneas de los dedos por el dorso.
  function drawHand(ctx, rig, c, Ar) {
    const A = Ar.rig, L = rig.dim.handL, dh = A.d2, n = A.palmN;
    const w = Vc.norm(Vc.cross(dh, n));
    const thumbSide = Vc.mul(w, A.s);
    const fist = A.fist || 0;
    const rows = [
      [0, 0.19, 0.09, 0], [0.12, 0.24, 0.1, 0], [0.36, 0.28, 0.11, 0], [0.55, 0.27, 0.1, 0.01],
      [0.74, 0.245, 0.075, 0.06], [0.9, 0.2, 0.06, 0.12], [1.0, 0.14, 0.05, 0.16],
    ].map(([x, hw, th, curl]) => [x * (1 - 0.35 * fist), hw, th + 0.04 * fist, curl + 0.25 * fist]);
    const secs = rows.map(([x, hw, th, curl]) =>
      V.sec(Vc.madd(Vc.madd(A.wrist, dh, x * L), n, curl * L), w, Vc.mul(n, -1), hw * L, hw * L, th * L, th * L));
    const at = V.spec(secs.map((s, i) => ({ l: rows[i][0], s })));
    const palm = V.fromSections(rig, secs, 12);
    palm.rad = L * 0.12;
    const t0 = Vc.madd(Vc.madd(A.wrist, thumbSide, 0.17 * L), dh, 0.12 * L);
    const t1 = Vc.madd(Vc.madd(Vc.madd(A.wrist, thumbSide, 0.3 * L), dh, 0.34 * L), n, 0.08 * L);
    const t2 = Vc.madd(Vc.madd(Vc.madd(A.wrist, thumbSide, 0.3 * L), dh, 0.52 * L), n, 0.15 * L);
    const thumb = V.tube(rig, [t0, t1, t2], [0.085 * L, 0.07 * L, 0.055 * L], 0.85, 10);
    const both = V.merge(palm, thumb);
    V.fill(ctx, rig, both, c.skin, { shadeK: 0.25 });
    if (rig.detail === 'high' && !fist) {
      const col = detail(rig, c.skin, 0.4);
      for (const p of [-0.5, 0, 0.5]) {
        V.dline(ctx, rig, at, [[0.62, p], [0.99, p * 0.8]], col, rig.line * 0.45, { clip: palm, thr: 0.2 });
        V.dline(ctx, rig, at, [[0.62, Math.PI - p], [0.99, Math.PI - p * 0.8]], col, rig.line * 0.45, { clip: palm, thr: 0.2 });
      }
    }
  }

  function drawHead(ctx, rig, c, Hd) {
    V.fill(ctx, rig, Hd.vol, c.skin, { shadeK: 0.22, shadeAmt: 0.13 });
    if (rig.detail !== 'high') return;
    const at = Hd.at, F = rig.face;
    // Pómulo y mandíbula (más marcados en cuerpos masculinos y realistas)
    const k = (1 - rig.chibi) * (rig.fem ? 0.4 : 1);
    if (k > 0.2) {
      for (const s of [-1, 1]) {
        V.dline(ctx, rig, at, V.curvePts(6, (t) => [U.lerp(F.nose, F.mouth + 0.08, t), s * U.lerp(1.05, 0.8, t)]), U.rgba(detail(rig, c.skin, 0.3), 0.35 * k), rig.line * 0.5, { clip: Hd.vol });
      }
    }
  }

  function drawEar(ctx, rig, c, ear) {
    V.fill(ctx, rig, ear.vol, c.skin, { shadeK: 0.3 });
    if (rig.detail === 'high' && ear.front) {
      const s = ear.secs[ear.secs.length - 2];
      const p = V.proj(rig, s.c);
      SC.draw.stroke(ctx, detail(rig, c.skin, 0.4), rig.line * 0.6, (q) => {
        q.moveTo(p.x, p.y - s.b * 0.8);
        q.quadraticCurveTo(p.x + s.b * 0.5 * Math.sign(rig.yawSin || 1), p.y, p.x, p.y + s.b * 0.6);
      });
    }
  }

  SC.anatomy = { build, drawTorsoSkin, drawHand, drawHead, drawEar, shellVol, shellRings, LEVELS };

  // ---------- Pieza "cuerpo" ----------
  const bodyDef = (id, name, earType) => ({
    slot: 'body', id, name, earType,
    colors: {
      skin: { label: 'Piel', value: '#f3cdb0' },
      under: { label: 'Ropa interior', value: '#e9e4dc' },
    },
    leg(ctx, rig, c, L) { drawLeg(ctx, rig, c, L); },
    arm(ctx, rig, c, A) { drawArm(ctx, rig, c, A); },
    // Ropa interior básica (se tapa con la ropa).
    torso(ctx, rig, c, T) {
      const L = T.L, e = rig.B * 0.002;
      const briefs = T.shell(e, L.hip - 0.02, 1, {
        topFn: (p) => L.hip - 0.03 + 0.02 * Math.cos(p),
        botFn: (p) => U.lerp(1.02, L.hip + 0.04, Math.pow(Math.abs(Math.sin(p)), 1.5)),
      });
      V.fill(ctx, rig, briefs, c.under, { shadeK: 0.25 });
      if (rig.fem) {
        const band = T.shell(e * 1.5, L.armpit + 0.01, L.underbust + 0.02, { topFn: (p) => L.armpit + 0.02 + 0.03 * Math.abs(Math.cos(p)) * (Math.cos(p) > 0 ? 1 : 0) });
        V.fill(ctx, rig, band, c.under, { shadeK: 0.25 });
      }
    },
    face(ctx, rig, c, Hd) { SC.face.drawFeatures(ctx, rig, c, Hd); },
  });
  SC.registerPart(bodyDef('humano', 'Humano', 'human'));
  SC.registerPart(bodyDef('elfo', 'Elfo', 'elf'));
})();
