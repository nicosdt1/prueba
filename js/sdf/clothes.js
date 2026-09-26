// Ropa como capa del cuerpo (sección 8 de docs/correccion-visual.md):
// prenda = primitivas del cuerpo que cubre, rehechas con un k mayor (la tela
// cuelga de los salientes) y desplazadas una holgura, recortadas por planos
// perpendiculares al hueso. La manga pertenece al mismo hueso que el brazo;
// el pantalón funde las perneras en la entrepierna; la falda se abomba en la
// dirección de la pierna que empuja.
SC.sdfClothes = (() => {
  const M = SC.AM, S = SC.SDF;
  const { cone, plane, INTERSECT, SUBTRACT } = S;

  const TOPS = {
    camiseta: { name: 'Camiseta', sleeve: 0.35, end: 'crest', e: 0.03 },
    larga: { name: 'Manga larga', sleeve: 1.0, end: 'crest', e: 0.03 },
    tirantes: { name: 'Tirantes', sleeve: 0, end: 'crest', e: 0.02, low: true },
    abullonada: { name: 'Manga abullonada', sleeve: 0.3, puff: 0.05, end: 'crest', e: 0.03 },
    vestido: { name: 'Vestido', sleeve: 0.3, end: 'crest', e: 0.03, dress: 0.45 },
    ninguno: { name: 'Ninguno' },
  };
  const BOTTOMS = {
    falda: { name: 'Falda', skirt: 0.35, flare: 15 },
    capa: { name: 'Falda de capa', skirt: 0.4, flare: 30 },
    larga: { name: 'Falda larga', skirt: 0.85, flare: 12 },
    pantalon: { name: 'Pantalón', leg: 1.0 },
    corto: { name: 'Pantalón corto', leg: 0.25 },
    ninguno: { name: 'Ninguno' },
  };
  const SHOES = { zapatos: { name: 'Zapatos' }, botas: { name: 'Botas', boot: 0.35 }, ninguno: { name: 'Descalzo' } };

  // Copia inflada de una primitiva (holgura e y fusión k).
  const inflate = (P, e, k) => Object.assign({}, P, { inflate: (P.inflate || 0) + e, k: P.k ? Math.max(P.k, k) : P.k, region: 0 });

  // Plano de corte perpendicular a un hueso: se conserva el lado de 'keep'.
  function cut(a, b, t, keepTowardA = true, k = 0.01) {
    const d = M.norm(M.sub(b, a)), p = M.lerp3(a, b, t);
    const n = keepTowardA ? d : M.mul(d, -1);
    return plane(n, M.dot(n, p), { op: INTERSECT, k });
  }

  function parts(f, body, look) {
    const sk = f.sk, MAT = SC.sdfBuild.MAT, out = [];
    const byName = (n) => body.parts.find((p) => p.name === n);
    const torso = byName('torso'), neck = byName('neck');
    const top = TOPS[look.topStyle] || TOPS.ninguno, bot = BOTTOMS[look.bottomStyle] || BOTTOMS.ninguno, shoe = SHOES[look.shoeStyle] || SHOES.ninguno;
    const up = M.mv(f.rot.spine, [0, 1, 0]);

    // ---------- Parte superior ----------
    if (top.e) {
      const e = top.e;
      // Misma k que el cuerpo (+0.02): con una k mayor la tela se hincha por encima
      // de los hombros y el hueco del cuello deja ver a través.
      const prims = torso.prims.filter((P) => P.op === S.UNION).map((P) => inflate(P, e, (P.k || 0) + 0.02));
      // Bajo: plano perpendicular al tronco (a la altura de la cresta ilíaca o la cadera).
      const yEnd = sk.yT(top.dress ? sk.tau.waist : sk.tau.crest + 0.06);
      const pEnd = f.xf('pelvis')([0, yEnd, 0]);
      prims.push(plane(M.mul(up, -1), -M.dot(up, pEnd), { op: INTERSECT, k: 0.01 }));
      // Cuello: hueco alrededor del cuello (o escote de tirantes).
      const nk = neck.prims[0];
      const a = nk.o, b = M.add(nk.o, M.mul([nk.R[3], nk.R[4], nk.R[5]], nk.L));
      const down = M.sub(a, M.mul(M.norm(M.sub(b, a)), top.low ? 0.45 : 0.12));
      // Holgura pequeña: un hueco ancho deja ver el fondo por detrás de los hombros.
      prims.push(cone(down, b, nk.ra + (top.low ? 0.18 : 0.025), nk.rb + 0.025, { op: SUBTRACT, k: 0.02 }));
      out.push({ name: 'top', mat: MAT.top, prims, hard: true });
      // Mangas: sobre el brazo, hasta t_fin, con abullonado opcional (8.1).
      if (top.sleeve) {
        for (const S2 of ['L', 'R']) {
          const arm = byName('arm_' + S2), sh = f.pos['shoulder_' + S2], el = f.pos['elbow_' + S2], wr = f.pos['wrist_' + S2];
          const sp = [inflate(arm.prims[0], e, 0.06)];
          const upper = arm.prims[1], fore = arm.prims[2];
          const end = top.sleeve;
          if (end <= 0.5) {
            const puff = top.puff || 0;
            sp.push(inflate(upper, e + puff, 0.12));
            sp.push(cut(sh, el, Math.min(1, end * 2), true));
          } else {
            sp.push(inflate(upper, e, 0.12), inflate(fore, e, 0.06));
            if (end < 1) sp.push(cut(el, wr, (end - 0.5) * 2, true));
          }
          out.push({ name: 'sleeve_' + S2, mat: MAT.top, prims: sp, joinK: 0.1, joinP: sh, joinR: 0.35 });
        }
      }
    }

    // ---------- Parte inferior ----------
    if (bot.leg) {
      const e = 0.03;
      // Todas las primitivas del tronco (misma unión suave) con holgura, cortadas en la cintura.
      const pel = torso.prims.filter((P) => P.op === S.UNION).map((P) => inflate(P, e, (P.k || 0) + 0.02));
      const pW = f.xf('pelvis')([0, sk.yT(sk.tau.waist + 0.04), 0]);
      pel.push(plane(up, M.dot(up, pW), { op: INTERSECT, k: 0.01 }));
      out.push({ name: 'pants_hip', mat: MAT.bottom, prims: pel, hard: true });
      for (const S2 of ['L', 'R']) {
        const leg = byName('leg_' + S2), hp = f.pos['hip_' + S2], kn = f.pos['knee_' + S2], an = f.pos['ankle_' + S2];
        const thigh = leg.prims[1], shin = leg.prims[3];
        const lp = [inflate(leg.prims[0], e, 0.1), inflate(thigh, e, 0.1)];
        const end = bot.leg;
        if (end > 0.5) {
          lp.push(Object.assign(inflate(shin, e + 0.02, 0.08), { rb: shin.rb + 0.05 }));
          if (end < 1) lp.push(cut(kn, an, (end - 0.5) * 2, true));
          else lp.push(cut(kn, an, 0.97, true));
        } else lp.push(cut(hp, kn, end * 2, true));
        // Las perneras se funden en la entrepierna (k = 0.08).
        out.push({ name: 'pants_' + S2, mat: MAT.bottom, prims: lp, joinK: 0.08, joinP: f.xf('pelvis')([0, sk.yT(1), 0]), joinR: 0.4 });
      }
    }
    const skirtLen = bot.skirt || top.dress;
    if (skirtLen) out.push(...skirt(f, torso, byName, skirtLen, bot.flare || 15, top.dress && !bot.skirt ? MAT.top : MAT.bottom));

    // ---------- Calzado (8.4) ----------
    if (shoe !== SHOES.ninguno) {
      for (const S2 of ['L', 'R']) {
        const sp = SC.sdfBuild.footPrims(f, S2, 0.025, 0.05);
        if (shoe.boot) {
          // Caña de la bota: la pierna con holgura, cortada a la altura pedida.
          const kn = f.pos['knee_' + S2], an = f.pos['ankle_' + S2], leg = byName('leg_' + S2);
          out.push({ name: 'boot_' + S2, mat: MAT.shoes, prims: [inflate(leg.prims[3], 0.035, 0.06), cut(an, kn, Math.min(1, shoe.boot * 2), true)], hard: true });
        }
        out.push({ name: 'shoe_' + S2, mat: MAT.shoes, prims: sp, hard: true });
      }
    }
    return out;
  }

  // 8.2 Falda que reacciona a las piernas: cono de patrón desde la cintura,
  // más conos que siguen a los muslos (la falda se abomba donde empuja la
  // pierna), fundidos con k grande y cortados en la cintura y en el bajo.
  function skirt(f, torso, byName, len, flare, mat) {
    const sk = f.sk, x = f.xf('pelvis'), up = M.mv(f.rot.pelvis, [0, 1, 0]);
    const yW = sk.yT(sk.tau.waist), yH = sk.yL(len);
    const top = x([0, yW, -0.02]), bottom = x([0, yH, -0.02]);
    const rTop = sk.w.waist / 2 + 0.04, h = M.dist(top, bottom);
    const rBot = Math.max(sk.w.hip / 2 + 0.05, rTop + h * Math.tan(M.rad(flare)));
    const prims = [cone(bottom, top, rBot, rTop, { ez: 0.82 })];
    const hip = torso.prims[2];
    prims.push(inflate(hip, 0.045, 0.2));
    for (const S2 of ['L', 'R']) {
      const leg = byName('leg_' + S2), th = leg.prims[1];
      prims.push(Object.assign(inflate(th, 0.06, 0.25), { rb: th.rb + 0.12 }));
    }
    prims.push(plane(M.mul(up, -1), -M.dot(up, bottom), { op: INTERSECT, k: 0.015 }));
    prims.push(plane(up, M.dot(up, top), { op: INTERSECT, k: 0.01 }));
    return [{ name: 'skirt', mat, prims, hard: true, pad: 0.2 }];
  }

  return { TOPS, BOTTOMS, SHOES, parts };
})();
