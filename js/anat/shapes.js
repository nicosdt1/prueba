// Formas del cuerpo a partir del esqueleto medido (secciones 6, 7 y 8 de
// docs/base-matematica.md): torso con silueta Hermite monótona, busto y
// pectorales paramétricos, brazos y piernas con perfiles asimétricos, manos de
// 15 articulaciones, pies y ropa como capas desplazadas sobre esas mismas formas.
//
// Las formas se describen como secciones transversales y se dibujan con el
// motor de volúmenes (SC.V): así cualquier vista y pose sale de la misma medida.
SC.anatShapes = (() => {
  const M = SC.AM, C = SC.CANON, V = SC.V;

  // Espacio de dibujo: el modelo (unidades H, +Y arriba) pasa a píxeles (+Y abajo).
  function space(S, cx, ground) {
    return {
      S, cx, ground,
      p: (a) => ({ x: a[0] * S, y: ground - a[1] * S, z: a[2] * S }),
      d: (a) => ({ x: a[0], y: -a[1], z: a[2] }),
    };
  }
  // Sección en espacio modelo → sección del motor de volúmenes.
  const sec = (sp, c, u, v, a, a2, b, b2) => V.sec(sp.p(c), sp.d(M.norm(u)), sp.d(M.norm(v)), a * sp.S, a2 * sp.S, b * sp.S, b2 * sp.S);

  // Ejes de un segmento: a lo largo del hueso, lateral (hacia fuera) y frontal.
  function frame(f, j, along, sg) {
    const d = M.norm(along);
    const fwd = M.mv(f.rot[j], [0, 0, 1]);
    let v = M.sub(fwd, M.mul(d, M.dot(fwd, d)));
    if (M.len(v) < 1e-6) v = M.mv(f.rot[j], [0, 1, 0]);
    v = M.norm(v);
    let u = M.norm(M.cross(v, d));
    // u apunta hacia fuera del cuerpo (+x en el lado izquierdo).
    const out = M.mv(f.rot[j], [sg, 0, 0]);
    if (M.dot(u, out) < 0) u = M.mul(u, -1);
    return { d, u, v };
  }

  // ---------- 6.1 Torso ----------
  // Filas (tau, semiancho, delante, detrás, z del centro) medidas en el esqueleto.
  function torsoRows(sk) {
    const { w, tau, params } = sk, s = params.s, e = params.e;
    const ws = sk.widthScale || 1;
    const dc = M.dimorph(C.depth.chest, s, e) * ws, dw = M.dimorph(C.depth.waist, s, e) * ws, dh = M.dimorph(C.depth.hip, s, e) * ws;
    const xs = sk.joints.shoulder_L.rest[0];
    const slope = M.rad(M.dimorph(C.shoulderSlope, s, 1));
    const neckHalf = w.neck / 2;
    const yNB = sk.yT(tau.shoulder) + (xs - neckHalf) * Math.tan(slope);
    const tNB = M.clamp((sk.T - sk.H - yNB) / sk.Ltorso, 0.0, tau.shoulder - 0.02);
    const lord = M.dimorph([0, 0.035], s, e);
    const glute = M.dimorph([0.55, 0.62], s, e);
    const L = M.lerp;
    return [
      [tNB, neckHalf * 1.1, neckHalf * 0.95, neckHalf * 1.05, -0.06],
      [tNB + (tau.shoulder - tNB) * 0.55, L(neckHalf * 1.1, xs, 0.72), dc * 0.36, dc * 0.46, -0.05],
      [tau.shoulder, xs + 0.1 * w.upperArm, dc * 0.42, dc * 0.5, -0.03],
      [tau.axilla, w.chest / 2, dc * 0.5, dc * 0.5, -0.02],
      [tau.nipple, (w.chest / 2) * 0.97, dc * 0.52, dc * 0.46, -0.01],
      [tau.underbust, L(w.chest, w.waist, 0.35) / 2, dc * 0.48, dc * 0.46, -0.01],
      [tau.waist, w.waist / 2, dw * 0.46, dw * 0.54, -0.02 - lord],
      [tau.navel, L(w.waist, w.hip, 0.25) / 2, dw * 0.48, dw * 0.52, -0.02 - lord * 0.6],
      [tau.crest, L(w.waist, w.hip, 0.72) / 2, dh * 0.44, dh * 0.56, -0.02],
      [tau.hip, w.hip / 2, dh * (1 - glute), dh * glute, -0.02],
      [1.0, w.hip * 0.40, dh * 0.34, dh * 0.40, -0.01],
    ];
  }

  // Interpolación monótona de todas las columnas en función de tau.
  function torsoProfile(sk) {
    const rows = torsoRows(sk), xs = rows.map((r) => r[0]);
    const f = [1, 2, 3, 4].map((k) => M.monotone(xs, rows.map((r) => r[k])));
    return { t0: xs[0], at: (t) => ({ half: f[0](t), front: f[1](t), back: f[2](t), zc: f[3](t) }) };
  }

  // Segmento que mueve cada altura del torso (mezcla suave entre pecho, espalda y pelvis).
  function torsoWeights(t) {
    const sm = (a, b, x) => { const u = M.clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
    const toSpine = sm(0.28, 0.5, t), toPelvis = sm(0.66, 0.84, t);
    return { chest: 1 - toSpine, spine: toSpine * (1 - toPelvis), pelvis: toPelvis };
  }
  function blendXf(f, W, p, axisVecs) {
    let out = [0, 0, 0];
    const ax = axisVecs.map(() => [0, 0, 0]);
    for (const [j, w] of Object.entries(W)) {
      if (w <= 0) continue;
      out = M.add(out, M.mul(f.xf(j)(p), w));
      axisVecs.forEach((a, i) => { ax[i] = M.add(ax[i], M.mul(f.dir(j)(a), w)); });
    }
    return { p: out, axes: ax.map(M.norm) };
  }

  // Anillos del torso entre dos alturas, con un desplazamiento (ropa) opcional.
  function torsoSecs(f, sp, t0, t1, off = 0, n = 12, flare = null) {
    const sk = f.sk, prof = torsoProfile(sk), out = [];
    const a = Math.max(t0, prof.t0);
    for (let i = 0; i <= n; i++) {
      const t = M.lerp(a, t1, i / n), r = prof.at(t);
      const W = torsoWeights(t);
      const { p, axes } = blendXf(f, W, [0, sk.yT(t), r.zc], [[1, 0, 0], [0, 0, 1]]);
      const k = flare ? flare(t) : 0;
      out.push(sec(sp, p, axes[0], axes[1], r.half + off + k, r.half + off + k, r.front + off + k * 0.6, r.back + off + k * 0.6));
    }
    return out;
  }

  // ---------- 6.3 Busto / 6.2 pectorales ----------
  function bustVols(f, sp, rig, off = 0) {
    const sk = f.sk, P = sk.params, s = P.s;
    if (s < 0.35) return [];
    const B = P.bust, c = M.clamp(B.c, 0, sk.face === 'realista' ? 1 : C.bust.maxAnime) * M.clamp((s - 0.35) / 0.4, 0, 1);
    if (c <= 0.02) return [];
    const r = C.bust.r0 + c * (C.bust.r1 - C.bust.r0), g = B.g, q = B.q;
    const yN = sk.yT(sk.tau.nipple);
    const yc = Math.max(yN + 0.10 * r - 0.25 * r * g, sk.yT(0.5) + r * (1 + 0.15 * g));
    const ay = r * (1 + 0.15 * g), pz = 0.65 * r * (1 - 0.3 * g);
    const prof = torsoProfile(sk), tN = sk.tau.nipple, row = prof.at(tN);
    const zFront = row.zc + row.front;
    const out = [];
    for (const sg of [1, -1]) {
      const xc = sg * Math.min(0.16 + 0.75 * r + 0.04 * q, sk.w.chest / 2 + 0.15 - r);
      const secs = [];
      for (let k = -1; k <= 1.0001; k += 0.25) {
        const y = yc + k * ay * 0.95, h = Math.sqrt(Math.max(0.02, 1 - k * k));
        const cz = zFront - pz * 0.55 + (k < 0 ? 0 : k * 0.05 * r);
        const pRest = [xc, y, cz];
        const W = torsoWeights(tN);
        const { p, axes } = blendXf(f, W, pRest, [[1, 0, 0], [0, 0, 1]]);
        secs.push(sec(sp, p, axes[0], axes[1], r * h + off, r * h + off, pz * h + off, pz * 0.6 * h + off));
      }
      out.push(V.fromSections(rig, secs, 14));
    }
    return out;
  }

  // ---------- Miembros: perfil de anchos a lo largo de dos huesos ----------
  // g ∈ [0, 1] recorre el miembro entero (0.5 = codo o rodilla). rows: filas
  // [g, exterior, interior, delante, detrás] en unidades H (anchos totales).
  function limb(f, sp, J, rows, off, g0, g1, n, flareFn) {
    const [j0, j1, j2] = J, sg = /_L$/.test(j0) ? 1 : -1;
    const P0 = f.pos[j0], P1 = f.pos[j1], P2 = f.pos[j2];
    const F1 = frame(f, j0, M.sub(P1, P0), sg), F2 = frame(f, j1, M.sub(P2, P1), sg);
    const gs = rows.map((r) => r[0]);
    const col = [1, 2, 3, 4].map((k) => M.monotone(gs, rows.map((r) => r[k])));
    const out = [];
    const G = [];
    for (let i = 0; i <= n; i++) G.push(M.lerp(g0, g1, i / n));
    for (const g of rows.map((r) => r[0])) if (g > g0 && g < g1 && !G.some((q) => Math.abs(q - g) < 0.02)) G.push(g);
    G.sort((x, y) => x - y);
    for (const g of G) {
      const up = g <= 0.5, t = up ? g / 0.5 : (g - 0.5) / 0.5;
      const p = up ? M.lerp3(P0, P1, t) : M.lerp3(P1, P2, t);
      // Cerca de la articulación los ejes se mezclan para que no haya pliegues.
      const k = M.clamp((g - 0.42) / 0.16, 0, 1);
      const u = M.norm(M.lerp3(F1.u, F2.u, k)), v = M.norm(M.lerp3(F1.v, F2.v, k));
      const fl = flareFn ? flareFn(g) : 0;
      out.push(sec(sp, p, u, v, col[0](g) / 2 + off + fl, col[1](g) / 2 + off + fl, col[2](g) / 2 + off + fl, col[3](g) / 2 + off + fl));
    }
    return out;
  }

  // 7.1 Brazo: deltoides y bíceps con asimetrías, codo, antebrazo y muñeca.
  function armRows(sk) {
    const s = sk.params.s, w = sk.w, A = C.armProfile;
    const del = M.dimorph(A.deltoid, s, 1), bic = M.dimorph(A.bicepsFront, s, 1);
    const ua = w.upperArm, fa = w.forearm, wr = w.wrist;
    return [
      [-0.09, ua * 0.55, ua * 0.5, ua * 0.5, ua * 0.5],
      [-0.03, ua * 1.0, ua * 0.95, ua * 0.93, ua * 0.93],
      [0.05, ua * del * 1.1, ua * del, ua * del * 0.95, ua * del * 0.95],
      [0.225, ua * 1.0, ua * 0.98, ua * bic * 0.95, ua * 0.92],
      [0.39, ua * 0.9, ua * 0.88, ua * 0.85, ua * 0.86],
      [0.5, ua * A.elbow, ua * A.elbow, ua * 0.8, ua * 0.82],
      [0.625, fa * 1.08, fa, fa * 0.85, fa * 0.85],
      [0.8, fa * 0.82, fa * 0.8, fa * 0.72, fa * 0.72],
      [1.0, wr, wr, wr * 0.7, wr * 0.7],
    ];
  }
  const armSecs = (f, sp, S, off = 0, g1 = 1, flare = null) => limb(f, sp, ['shoulder_' + S, 'elbow_' + S, 'wrist_' + S], armRows(f.sk), off, -0.09, g1, 11, flare);

  // ---------- 7.2–7.4 Mano ----------
  function handShapes(f, sp, rig, S, poseName) {
    const sk = f.sk, sg = S === 'L' ? 1 : -1, s = sk.params.s, Hd = C.hand;
    const L = sk.bones.hand, Wp = M.dimorph(Hd.omega, s, 1) * L, th = M.dimorph(Hd.thick, s, 1) * L;
    const wr = f.pos['wrist_' + S], tip = f.pos['hand_' + S];
    const d = M.norm(M.sub(tip, wr));
    // Palma hacia el cuerpo y pulgar hacia delante en reposo.
    let n = M.mv(f.rot['wrist_' + S], [-sg, 0, 0]);
    n = M.norm(M.sub(n, M.mul(d, M.dot(n, d))));
    let t = M.norm(M.cross(d, n));
    if (M.dot(t, M.mv(f.rot['wrist_' + S], [0, 0, 1])) < 0) t = M.mul(t, -1);
    const pose = Hd.poses[poseName] || Hd.poses.relajada;
    const vols = [];
    // Palma: de la muñeca a los nudillos, algo más ancha en los nudillos.
    const palm = [];
    for (const [k, wk, tk] of [[0, Hd.wristW, 1.1], [0.25, 0.95, 1.05], [0.5, 1.0, 1.0], [0.56, 0.98, 0.9]]) {
      const c = M.add(wr, M.mul(d, k * L));
      palm.push(sec(sp, M.add(c, M.mul(t, 0.03 * Wp)), t, n, (Wp * wk) / 2, (Wp * wk) / 2, th * 0.9 * tk, th * 0.7 * tk));
    }
    vols.push(V.fromSections(rig, palm, 12));
    // Dedos: cada uno encadena sus tres falanges con la flexión acoplada.
    Hd.fingers.forEach(([kx, ky, lm, lf, fan], i) => {
      const fl = pose[i + 1], len = M.dimorph([lm, lf], s, 1) * L;
      const base = M.add(M.add(wr, M.mul(d, ky * L)), M.mul(t, kx * Wp));
      let dir = M.mv(M.axisAngle(n, M.rad(fan * (0.6 + pose[5] * 0.8)) * 1), d);
      const angs = [90 * fl, 100 * fl, (2 / 3) * 100 * fl];
      const pts = [base];
      let p = base;
      Hd.phalanges.forEach((ph, k) => {
        dir = M.mv(M.axisAngle(M.cross(dir, n), M.rad(angs[k])), dir);
        p = M.add(p, M.mul(dir, ph * len));
        pts.push(p);
      });
      const r = (u) => (th / 2) * (1 - 0.2 * u) * (i === 3 ? 0.9 : 1);
      vols.push(V.tube(rig, pts.map(sp.p), (u) => r(u) * sp.S, 0.85, 8));
    });
    // Pulgar: sale de la base de la palma abierto 40° y girado 60°.
    const T = Hd.thumb, fT = pose[0];
    let dir = M.mv(M.axisAngle(n, M.rad(T.spread) * (0.7 + pose[5] * 0.5)), d);
    dir = M.norm(M.add(dir, M.mul(n, 0.25)));
    let p = M.add(M.add(wr, M.mul(d, T.base[1] * L)), M.mul(t, T.base[0] * Wp));
    const pts = [p];
    T.seg.forEach((sl, k) => {
      if (k > 0) dir = M.mv(M.axisAngle(M.cross(dir, n), M.rad(55 * fT)), dir);
      p = M.add(p, M.mul(dir, sl * L));
      pts.push(p);
    });
    vols.push(V.tube(rig, pts.map(sp.p), (u) => (th / 2) * (1.15 - 0.3 * u) * sp.S, 0.85, 8));
    return vols;
  }

  // 8.1–8.2 Pierna: muslo (curva de cadera continua en mujer), vasto interno
  // sobre la rodilla, gemelo externo más alto que el interno, tobillo.
  function legRows(sk) {
    const s = sk.params.s, w = sk.w;
    const th = w.thigh, kn = w.knee, ca = w.calf, an = w.ankle;
    const hipF = M.dimorph([1.0, 1.08], s, 1);
    return [
      [-0.05, th * 1.02, th, th * 0.95, th * 1.0],
      [0.075, th * hipF, th, th * 0.95, th * 1.02],
      [0.25, th * 0.9, th * 0.92, th * 0.88, th * 0.9],
      [0.4, th * 0.72, th * 0.8, th * 0.72, th * 0.72],
      [0.5, kn, kn, kn * 0.95, kn * 0.9],
      [0.625, ca * 1.0, ca * 0.92, ca * 0.8, ca * 1.15],
      [0.675, ca * 0.95, ca * 1.0, ca * 0.78, ca * 1.1],
      [0.9, ca * 0.6, ca * 0.6, ca * 0.6, ca * 0.62],
      [1.0, an, an, an * 0.95, an],
    ];
  }
  const legSecs = (f, sp, S, off = 0, g1 = 1, flare = null) => limb(f, sp, ['hip_' + S, 'knee_' + S, 'ankle_' + S], legRows(f.sk), off, -0.05, g1, 10, flare);

  // ---------- 8.3 Pie (y calzado como desplazamiento) ----------
  function footSecs(f, sp, S, off = 0, high = 0) {
    const sk = f.sk, s = sk.params.s, Ft = C.foot, Lf = sk.bones.foot;
    const a = sk.joints['ankle_' + S].rest, x = f.xf('ankle_' + S), dir = f.dir('ankle_' + S);
    const hA = a[1], wMax = M.dimorph(Ft.width, s, 1) * Lf;
    const rows = [ // z (× Lf), ancho (× wMax), alto, altura del centro
      [Ft.heel, Ft.heelW, 0.55, 0.28], [0, 0.72, 1.0, 0.5], [0.3, 0.9, 0.62, 0.32], [Ft.ball, 1.0, 0.34, 0.18], [Ft.toe, 0.62, 0.2, 0.1],
    ];
    const out = [];
    for (const [z, wk, hk, yk] of rows) {
      const hh = hA * hk + high * (z < 0.2 ? 1 : 0.3);
      const c = x([a[0], a[1] - hA + hA * yk + high * 0.3, z * Lf]);
      out.push(sec(sp, c, dir([1, 0, 0]), dir([0, 1, 0]), (wk * wMax) / 2 + off, (wk * wMax) / 2 + off, hh / 2 + off, hh / 2 + off));
    }
    return out;
  }

  // Cuello: del pecho a la cabeza.
  function neckSecs(f, sp, off = 0) {
    const sk = f.sk, r = sk.w.neck / 2, prof = torsoProfile(sk), t0 = prof.t0;
    const bottom = blendXf(f, { chest: 1 }, [0, sk.yT(t0) - 0.05, -0.06], [[1, 0, 0], [0, 0, 1]]);
    const mid = blendXf(f, { neck: 1 }, [0, sk.T - 1.08, -0.07], [[1, 0, 0], [0, 0, 1]]);
    const top = blendXf(f, { head: 1 }, [0, sk.T - 0.84, -0.09], [[1, 0, 0], [0, 0, 1]]);
    return [bottom, mid, top].map((q, i) => sec(sp, q.p, q.axes[0], q.axes[1], r * (i === 0 ? 1.08 : 1) + off, r * (i === 0 ? 1.08 : 1) + off, r * 0.95 + off, r * 1.02 + off));
  }

  return { space, sec, frame, torsoRows, torsoProfile, torsoSecs, torsoWeights, blendXf, bustVols, limb, armRows, armSecs, handShapes, legRows, legSecs, footSecs, neckSecs };
})();
