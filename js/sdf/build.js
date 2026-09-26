// Escena SDF del personaje a partir del esqueleto en pose (secciones 2, 4, 6 y 7
// de docs/correccion-visual.md). Las medidas salen de la base matemática; aquí
// sólo cambia cómo se convierten en volumen: masas anatómicas (caja torácica,
// abdomen, pelvis, glúteos, deltoides, trapecios, gemelos...) fundidas con
// unión suave, con el k de la tabla 2.3.
SC.sdfBuild = (() => {
  const M = SC.AM, C = SC.CANON, S = SC.SDF;
  const { cone, ellipsoid, box, plane, INTERSECT } = S;

  // Materiales (el color se decide al componer).
  const MAT = { skin: 0, hair: 1, top: 2, bottom: 3, shoes: 4, tie: 5, sole: 6 };

  // Rotación local→mundo de una articulación, con un giro extra opcional.
  const rotOf = (f, j, extra) => (extra ? M.mm(f.rot[j], extra) : f.rot[j]);

  // ---------- Cabeza (4.1) ----------
  // Espacio de cabeza: u lateral, v desde la coronilla, z hacia delante (en H).
  function headSpace(f) {
    const sk = f.sk, x = f.xf('head');
    return (u, v, z) => x([u, sk.T - v * sk.H, z]);
  }
  function headW(sk) {
    const st = sk.face, s = sk.params.s, e = sk.params.e;
    return M.dimorph(C.head.W[st], s, e) * (st === 'chibi' ? 1.08 : 1);
  }

  function headPart(f) {
    const sk = f.sk, s = sk.params.s, st = sk.face, hs = headSpace(f), W = headW(sk);
    const R = rotOf(f, 'head');
    const chibi = st === 'chibi', anime = st !== 'realista';
    const gon = M.dimorph([0.42, 0.36], s, sk.params.e) * W + sk.params.face.jaw * 0.03;
    const jr = [M.lerp(0.06, 0.045, s), M.lerp(0.05, 0.035, s)];
    const prims = [
      ellipsoid(hs(0, 0.42, -0.04), [W / 2, 0.42, 0.46], { Rm: R }),
      ellipsoid(hs(0, chibi ? 0.64 : 0.62, 0.12), [0.44 * W, chibi ? 0.27 : 0.25, 0.30], { Rm: R, k: 0.10 }),
    ];
    for (const sg of [1, -1]) {
      // (Ajuste: k 0.14 en vez de 0.08 para que la mandíbula no marque una cresta en la mejilla.)
      prims.push(cone(hs(sg * gon, 0.84, -0.05), hs(0, 0.97, chibi ? 0.24 : 0.30), jr[0], jr[1], { k: 0.14 }));
      const earRot = M.mm(R, M.Ry(-sg * M.rad(15)));
      prims.push(ellipsoid(hs(sg * W / 2, 0.58, -0.02), [0.035, 0.15 * (chibi ? 0.8 : 1), 0.09], { Rm: earRot, k: 0.02 }));
    }
    const nr = anime ? [0.01, 0.02] : [0.02, 0.045];
    prims.push(cone(hs(0, 0.50, 0.38), hs(0, 0.70, anime ? 0.45 : 0.48), nr[0], nr[1], { k: 0.03 }));
    // Arco superciliar: sobresale del cráneo para marcar glabela y nasion en el perfil.
    if (s < 0.5 && !chibi) prims.push(cone(hs(-0.30 * W, 0.44, 0.41), hs(0.30 * W, 0.44, 0.41), 0.035 * (1 - s * 2), 0.035 * (1 - s * 2), { k: 0.04 }));
    // Labios y mentón (4.6): labio superior, inferior y barbilla con el surco
    // mentolabial entre ellos. Sólo en realista: en anime la boca se dibuja.
    if (!anime) {
      prims.push(ellipsoid(hs(0, 0.755, 0.37), [0.10, 0.025, 0.035], { Rm: R, k: 0.015 }));
      prims.push(ellipsoid(hs(0, 0.815, 0.355), [0.085, 0.028, 0.035], { Rm: R, k: 0.015 }));
      prims.push(ellipsoid(hs(0, 0.915, 0.32), [0.09, 0.05, 0.06], { Rm: R, k: 0.03 }));
    }
    return { name: 'head', mat: MAT.skin, prims, joinK: 0.08, joinP: f.pos.head, joinR: 0.45 };
  }

  // ---------- Tronco (7.1, 6.3) ----------
  function torsoParts(f) {
    const sk = f.sk, P = sk.params, s = P.s, e = P.e, w = sk.w, ws = sk.widthScale || 1, tau = sk.tau;
    const xc = f.xf('chest'), xs = f.xf('spine'), xp = f.xf('pelvis');
    const dc = M.dimorph(C.depth.chest, s, e) * ws, dw = M.dimorph(C.depth.waist, s, e) * ws, dh = M.dimorph(C.depth.hip, s, e) * ws;
    const lord = M.dimorph([0, 0.035], s, e) * ws;
    const chibi = sk.face === 'chibi';
    const prims = [];
    // Caja torácica: huevo más ancho abajo, inclinado 8° hacia atrás.
    // (Ajuste: centro en τ 0.38 y semialtura 0.27 L_torso para que la caja no
    // suba hasta la barbilla y el cuello se vea al menos 0.3 H, prueba 4.6.)
    const ribY = sk.yT(0.41);
    prims.push(ellipsoid(xc([0, ribY, -0.03]), [0.45 * w.chest, 0.25 * sk.Ltorso, dc / 2], { Rm: rotOf(f, 'chest', M.Rx(-M.rad(8))) }));
    // Abdomen: de τ 0.45 a 0.75, con la curva lumbar. El extremo del cono es
    // una semiesfera de radio w_cintura/2, así que el eje empieza más abajo
    // (τ 0.55) para que la tapa no suba hasta el cuello.
    prims.push(cone(xs([0, sk.yT(0.55), -0.02]), xs([0, sk.yT(0.75), -0.02 - lord]), w.waist / 2 * 0.98, w.waist / 2 * 1.02, { ez: dw / w.waist, k: 0.25 }));
    // Pelvis: caja redondeada inclinada hacia delante (más en mujer).
    const tilt = M.rad(M.dimorph([10, 15], s, 1));
    // (Ajuste: semialtura 0.11 L_torso en lugar de 0.20 para que no baje de la entrepierna.)
    prims.push(box(xp([0, sk.yT(0.82), -0.02]), [0.40 * w.hip * (chibi ? 0.9 : 1), 0.11 * sk.Ltorso, (dh / 2) * 0.9], 0.18 * ws, { Rm: rotOf(f, 'pelvis', M.Rx(tilt)), k: 0.25 }));
    // Glúteos.
    const gk = M.dimorph([1, 1.2], s, e);
    for (const sg of [1, -1]) {
      prims.push(ellipsoid(xp([sg * 0.17 * ws, sk.yT(0.90), -dh * 0.28]), [0.20 * gk * ws, 0.22 * gk * ws, 0.18 * gk * ws], { Rm: f.rot.pelvis, k: 0.10 }));
    }
    // Pectorales (hombre) o busto (mujer, 6.3).
    if (s >= 0.35) {
      const B = P.bust, c = M.clamp(B.c, 0, sk.face === 'realista' ? 1 : C.bust.maxAnime) * M.clamp((s - 0.35) / 0.4, 0, 1);
      if (c > 0.02) {
        const r = (C.bust.r0 + c * (C.bust.r1 - C.bust.r0)) * ws, g = B.g, q = B.q;
        const yc = sk.yT(tau.nipple) + 0.10 * r - 0.25 * r * g;
        const ay = r * (1 + 0.15 * g), pz = 0.65 * r * (1 - 0.3 * g);
        for (const sg of [1, -1]) {
          const x = sg * Math.min(0.16 * ws + 0.75 * r + 0.04 * q, w.chest / 2 + 0.15 - r);
          prims.push(ellipsoid(xc([x * 0.85, yc, dc / 2 - pz * 0.35 - 0.03]), [r * 0.95, ay, pz], { Rm: rotOf(f, 'chest', M.Ry(sg * 0.25)), k: 0.10 }));
        }
      }
    }
    if (s < 0.65) {
      const pk = (1 - s) * (0.7 + 0.3 * (1 + P.b)) * ws;
      for (const sg of [1, -1]) prims.push(ellipsoid(xc([sg * 0.26 * ws, sk.yT(0.24), dc / 2 - 0.1 * ws]), [0.28 * pk, 0.16 * pk, 0.1 * pk], { Rm: f.rot.chest, k: 0.08 }));
    }
    // Trapecios y clavículas.
    const xs0 = sk.joints.shoulder_L.rest[0];
    const yNB = sk.yT(tau.shoulder) + (xs0 - w.neck / 2) * Math.tan(M.rad(M.dimorph(C.shoulderSlope, s, 1))) * 0.8;
    for (const sg of [1, -1]) {
      const S2 = sg > 0 ? 'L' : 'R';
      prims.push(cone(xc([sg * 0.12 * ws, yNB, -0.07]), f.pos['shoulder_' + S2], M.lerp(0.08, 0.05, s) * ws, M.lerp(0.07, 0.045, s) * ws, { k: 0.10 }));
      prims.push(cone(xc([sg * 0.05, sk.yT(0.20), dc * 0.26]), M.add(f.pos['shoulder_' + S2], M.mv(f.rot.chest, [0, 0.02, 0.05])), 0.035 * ws, 0.03 * ws, { k: 0.05 }));
    }
    // Cintura escapular: volumen entre clavículas y trapecios, retrasado para no
    // tapar el cuello por delante (cierra la fosa supraclavicular).
    prims.push(ellipsoid(xc([0, yNB - 0.13, -0.10]), [xs0 * 0.8, 0.13, Math.min(0.2, dc * 0.3)], { Rm: f.rot.chest, k: 0.10 }));
    const torso = { name: 'torso', mat: MAT.skin, prims, hard: true };
    // Cuello inclinado hacia delante, con nuez en el hombre.
    const neckBase = xc([0, yNB - 0.02, -0.02]);
    const neckTop = f.xf('head')([0, sk.T - 0.9 * sk.H, 0.0]);
    const nr = w.neck / 2;
    const nprims = [cone(neckBase, neckTop, nr * 1.05, nr, { ez: 0.9 })];
    if (s < 0.4 && !chibi) nprims.push(ellipsoid(M.lerp3(neckBase, neckTop, 0.62).map((v, i) => v + M.mv(f.rot.neck, [0, 0, nr * 0.85])[i]), [0.03, 0.03, 0.03], { k: 0.02 }));
    const neck = { name: 'neck', mat: MAT.skin, prims: nprims, joinK: 0.2, joinP: neckBase, joinR: 0.55 };
    return [torso, neck];
  }

  // ---------- Brazos y manos (6) ----------
  function armPart(f, S2, lod) {
    const sk = f.sk, s = sk.params.s, w = sk.w, sg = S2 === 'L' ? 1 : -1, ws = sk.widthScale || 1;
    const sh = f.pos['shoulder_' + S2], el = f.pos['elbow_' + S2], wr = f.pos['wrist_' + S2], hd = f.pos['hand_' + S2];
    const prims = [];
    const dk = M.lerp(1, 0.8, s) * ws;
    // Deltoides: envuelve el hombro y baja hasta t = 0.45 del brazo.
    const armDir = M.norm(M.sub(el, sh));
    const out = M.mv(f.rot['shoulder_' + S2], [sg, 0, 0]);
    const dC = M.add(M.add(sh, M.mul(out, 0.05 * ws)), M.mul(armDir, 0.10 * ws + 0.05));
    prims.push(ellipsoid(dC, [0.14 * dk, 0.22 * dk, 0.16 * dk], { Rm: M.fromTo([0, -1, 0], armDir) }));
    prims.push(cone(sh, el, w.upperArm / 2, (w.upperArm / 2) * 0.82, { k: 0.06 }));
    prims.push(cone(el, wr, w.forearm / 2, w.wrist / 2, { ez: 0.8, zHint: M.mv(f.rot['elbow_' + S2], [0, 0, 1]), k: 0.04 }));
    // Olécranon detrás del codo.
    prims.push(ellipsoid(M.add(el, M.mv(f.rot['elbow_' + S2], [0, 0, -0.05 * ws])), [0.05 * ws, 0.06 * ws, 0.05 * ws], { k: 0.03 }));
    prims.push(...handPrims(f, S2, wr, hd, lod));
    return { name: 'arm_' + S2, mat: MAT.skin, prims, joinK: 0.12, joinP: sh, joinR: 0.35 * ws + 0.1 };
  }

  // 6.3 Mano con volumen; nivel de detalle según su tamaño en pantalla (6.5).
  function handPrims(f, S2, wr, tip, lod) {
    const sk = f.sk, s = sk.params.s, Hd = C.hand, sg = S2 === 'L' ? 1 : -1;
    const L = M.dist(wr, tip), Wp = M.dimorph(Hd.omega, s, 1) * L;
    const d = M.norm(M.sub(tip, wr));
    let n = M.mv(f.rot['wrist_' + S2], [-sg, 0, 0]);
    n = M.norm(M.sub(n, M.mul(d, M.dot(n, d))));
    let t = M.norm(M.cross(d, n));
    if (M.dot(t, M.mv(f.rot['wrist_' + S2], [0, 0, 1])) < 0) t = M.mul(t, -1);
    // Marco de la palma: x = hacia el pulgar, y = hacia los dedos, z = normal de la palma.
    const Rm = [t[0], d[0], n[0], t[1], d[1], n[1], t[2], d[2], n[2]];
    const th = M.dimorph([0.12, 0.10], s, 1) * L;
    const prims = [];
    const palmC = M.add(wr, M.mul(d, 0.30 * L));
    const pose = Hd.poses[(f.pose.hands || {})[S2] || 'relajada'] || Hd.poses.relajada;
    if (lod < 6) {
      prims.push(ellipsoid(M.add(wr, M.mul(d, 0.45 * L)), [Wp * 0.55, L * 0.5, th * 1.2], { Rm, k: 0.03 }));
      return prims;
    }
    prims.push(box(palmC, [Wp / 2, 0.28 * L, th / 2], 0.05 * L, { Rm, k: 0.03 }));
    // Eminencia tenar (base del pulgar).
    prims.push(ellipsoid(M.add(M.add(wr, M.mul(d, 0.2 * L)), M.mul(t, 0.3 * Wp)), [0.12 * L, 0.2 * L, 0.08 * L], { Rm, k: 0.02 }));
    const fr = M.dimorph(Hd.thick, s, 1) * L / 2;
    const finger = (base, dir0, len, flex, rad, k) => {
      let p = base, dir = dir0;
      const angs = [90 * flex, 100 * flex, (2 / 3) * 100 * flex];
      Hd.phalanges.forEach((ph, i) => {
        dir = M.mv(M.axisAngle(M.cross(dir, n), M.rad(angs[i])), dir);
        const q = M.add(p, M.mul(dir, ph * len));
        prims.push(cone(p, q, rad * Math.pow(0.9, i), rad * Math.pow(0.9, i + 1), { k }));
        p = q;
      });
      prims.push(ellipsoid(p, [rad * 0.9, rad * 1.1, rad * 0.8], { k }));
    };
    if (lod < 20) {
      // Manopla: un bloque para los cuatro dedos y el pulgar.
      const fl = (pose[1] + pose[2] + pose[3] + pose[4]) / 4;
      finger(M.add(wr, M.mul(d, 0.56 * L)), d, 0.42 * L, fl, Wp * 0.42, 0.01);
    } else {
      Hd.fingers.forEach(([kx, ky, lm, lf, fan], i) => {
        if (lod < 60 && i >= 2) return; // dedos agrupados: índice suelto y los otros tres juntos
        const len = M.dimorph([lm, lf], s, 1) * L;
        const base = M.add(M.add(wr, M.mul(d, ky * L)), M.mul(t, (lod < 60 && i === 1 ? -0.12 : kx) * Wp));
        const dir = M.mv(M.axisAngle(n, M.rad(fan * (0.6 + pose[5] * 0.8))), d);
        finger(base, dir, len, pose[i + 1], lod < 60 && i === 1 ? fr * 2.2 : fr, 0.008);
      });
    }
    // Pulgar: abierto 40° desde la base de la palma.
    const T = Hd.thumb;
    let dir = M.mv(M.axisAngle(n, M.rad(T.spread) * (0.7 + pose[5] * 0.5)), d);
    dir = M.norm(M.add(dir, M.mul(n, 0.3)));
    let p = M.add(M.add(wr, M.mul(d, T.base[1] * L)), M.mul(t, T.base[0] * Wp));
    T.seg.forEach((sl, i) => {
      if (i > 0) dir = M.mv(M.axisAngle(M.cross(dir, n), M.rad(55 * pose[0])), dir);
      const q = M.add(p, M.mul(dir, sl * L));
      prims.push(cone(p, q, fr * 1.25 * Math.pow(0.9, i), fr * 1.25 * Math.pow(0.9, i + 1), { k: i === 0 ? 0.02 : 0.008 }));
      p = q;
    });
    return prims;
  }

  // ---------- Piernas y pies (7.2–7.4) ----------
  function legPart(f, S2) {
    const sk = f.sk, s = sk.params.s, w = sk.w, sg = S2 === 'L' ? 1 : -1, ws = sk.widthScale || 1;
    const hp = f.pos['hip_' + S2], kn = f.pos['knee_' + S2], an = f.pos['ankle_' + S2];
    const RH = f.rot['hip_' + S2], RK = f.rot['knee_' + S2];
    const prims = [];
    // Masa de cadera (trocánter): curva continua cadera-muslo en mujer.
    const hm = s > 0.5 ? [0.16, 0.20, 0.15] : [0.12, 0.18, 0.14];
    prims.push(ellipsoid(M.add(hp, M.mv(RH, [sg * 0.10 * ws, -0.12 * ws, -0.02])), hm.map((v) => v * ws), { Rm: RH }));
    prims.push(cone(hp, kn, w.thigh / 2, w.knee / 2, { ez: 1.05, zHint: M.mv(RH, [0, 0, 1]), k: 0.06 }));
    const along = (a, b, t2) => M.lerp3(a, b, t2);
    // Vasto interno, rótula, gemelos (externo más alto que el interno), tibia y maléolos.
    prims.push(ellipsoid(M.add(along(hp, kn, 0.8), M.mv(RH, [-sg * 0.07 * ws, 0, 0.01])), [0.09 * ws, 0.12 * ws, 0.08 * ws], { Rm: RH, k: 0.03 }));
    prims.push(cone(kn, an, w.knee / 2, w.ankle / 2, { zHint: M.mv(RK, [0, 0, 1]), k: 0.06 }));
    prims.push(ellipsoid(M.add(kn, M.mv(RK, [0, -0.02, 0.07 * ws])), [0.06 * ws, 0.07 * ws, 0.05 * ws], { k: 0.03 }));
    const gc = f.pose.joints && f.pose.joints['knee_' + S2] && f.pose.joints['knee_' + S2].flex > 90 ? 0.9 : 1;
    prims.push(ellipsoid(M.add(along(kn, an, 0.25), M.mv(RK, [sg * 0.04 * ws, 0, -0.08 * ws])), [0.09 * ws * gc, 0.20 * ws, 0.10 * ws * gc], { Rm: RK, k: 0.03 }));
    prims.push(ellipsoid(M.add(along(kn, an, 0.35), M.mv(RK, [-sg * 0.04 * ws, 0, -0.08 * ws])), [0.10 * ws * gc, 0.20 * ws, 0.11 * ws * gc], { Rm: RK, k: 0.03 }));
    prims.push(ellipsoid(M.add(an, M.mv(RK, [sg * 0.06 * ws, 0, 0])), [0.035, 0.035, 0.035], { k: 0.02 }));
    prims.push(ellipsoid(M.add(an, M.mv(RK, [-sg * 0.06 * ws, 0.03, 0])), [0.035, 0.035, 0.035], { k: 0.02 }));
    prims.push(...footPrims(f, S2, 0));
    return { name: 'leg_' + S2, mat: MAT.skin, prims, joinK: s > 0.5 ? 0.16 : 0.12, joinP: hp, joinR: 0.45 * ws + 0.1 };
  }

  // Pie: talón, empeine, bola y dedos, aplanado por la planta. off = holgura (calzado).
  function footPrims(f, S2, off, k = 0.03) {
    const sk = f.sk, Lf = sk.bones.foot * (sk.params.s > 0.5 && sk.face !== 'realista' ? 0.9 : 1), sg = S2 === 'L' ? 1 : -1;
    const a = sk.joints['ankle_' + S2].rest, x = f.xf('ankle_' + S2), R = f.rot['ankle_' + S2];
    const yA = a[1], P = (z, y) => x([a[0], y, z * Lf]);
    const foot = [
      ellipsoid(P(-0.18, 0.08 * Lf + off * 0.5), [0.10 * Lf + off, 0.09 * Lf + off, 0.12 * Lf + off], { Rm: R, k }),
      cone(P(0, yA * 0.85), P(0.55, 0.06 * Lf), 0.12 * Lf + off, 0.07 * Lf + off, { zHint: M.mv(R, [0, 1, 0]), k: 0.04 }),
      ellipsoid(P(0.55, 0.05 * Lf), [0.19 * Lf + off, 0.05 * Lf + off, 0.08 * Lf + off], { Rm: R, k: 0.03 }),
      box(P(0.68, 0.03 * Lf), [0.17 * Lf + off, 0.03 * Lf + off, 0.08 * Lf + off], 0.03 * Lf, { Rm: R, k: 0.03 }),
    ];
    // Planta plana: corte con el plano de la suela (se mueve con el pie).
    const up = M.mv(R, [0, 1, 0]), sole = P(0, -off * 0.4);
    foot.push(plane(M.mul(up, -1), -M.dot(up, sole), { op: INTERSECT, k: 0.01 }));
    void sg;
    return foot;
  }

  // ---------- Escena completa ----------
  // o.lod: largo de la mano en píxeles (decide el nivel de detalle).
  function scene(f, o = {}) {
    const parts = [];
    parts.push(...torsoParts(f));
    parts.push(headPart(f));
    for (const S2 of ['L', 'R']) parts.push(legPart(f, S2));
    for (const S2 of ['L', 'R']) parts.push(armPart(f, S2, o.lod != null ? o.lod : 100));
    if (o.extra) parts.push(...o.extra(f, parts));
    return S.finalize({ parts });
  }

  return { MAT, scene, headSpace, headW, footPrims, headPart, torsoParts, armPart, legPart };
})();
