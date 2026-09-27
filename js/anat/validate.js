// Validador (sección 12.6 de docs/base-matematica.md). Un error indica que el
// personaje no respeta el canon; un aviso deja continuar.
SC.anatValidate = (() => {
  const M = SC.AM, C = SC.CANON, B = SC.anatBody, R = SC.anatRig;

  function run(cfg, o = {}) {
    const P = B.params(cfg.params || cfg), look = Object.assign({}, SC.engine.DEFAULT_LOOK, cfg.look || {});
    const sk = B.skeleton(P), out = [];
    const add = (level, name, msg) => out.push({ level, name, msg });

    // Estilo posible.
    if (sk.valid) add('ok', 'Estilo', `${C.styles[P.style].name}: tronco ${sk.Ltorso.toFixed(2)} H (mínimo ${C.minTorso} H)`);
    else add('error', 'Estilo', `Tronco de ${sk.Ltorso.toFixed(2)} H: el estilo es imposible`);

    // Simetría.
    let sym = 0;
    for (const [n, j] of Object.entries(sk.joints)) {
      if (!n.endsWith('_L')) continue;
      const r = sk.joints[n.replace(/_L$/, '_R')].rest;
      sym = Math.max(sym, Math.abs(r[0] + j.rest[0]), Math.abs(r[1] - j.rest[1]), Math.abs(r[2] - j.rest[2]));
    }
    add(sym < 1e-6 ? 'ok' : 'error', 'Simetría', sym < 1e-6 ? 'Cada punto derecho es el espejo del izquierdo' : 'Hay puntos asimétricos');

    // Dimorfismo (3.5).
    const { SHR, WHR } = sk.indices, label = B.sexLabel(sk);
    const want = P.s <= 0.2 ? 'masculino' : P.s >= 0.8 ? 'femenino' : null;
    const txt = `SHR ${SHR.toFixed(2)} · WHR ${WHR.toFixed(2)} → ${label}`;
    if (!want) add('ok', 'Dimorfismo', txt + ' (valor intermedio: andrógino)');
    else add(label === want ? 'ok' : 'warn', 'Dimorfismo', label === want ? txt : `${txt}; se esperaba ${want}`);

    // Señales en sprites pequeños (11.2).
    if (o.pixelHeight && o.pixelHeight <= 64) {
      const signals = [
        Math.abs(SHR - 1) > 0.2, /largo|coletas|bob|mono/.test(look.hairStyle),
        /falda|larga/.test(look.bottomStyle) || look.topStyle === 'vestido', P.s > 0.5 && P.bust.c > 0.3,
      ].filter(Boolean).length;
      add(signals >= 2 ? 'ok' : 'warn', 'Legibilidad', `${signals} señal(es) de sexo visibles a ${o.pixelHeight} px (mínimo 2)`);
    }

    // Busto (6.3).
    if (P.s >= 0.35) {
      const c = P.bust.c, r = C.bust.r0 + c * (C.bust.r1 - C.bust.r0), g = P.bust.g, q = P.bust.q;
      const xc = 0.16 + 0.75 * r + 0.04 * q, yc = sk.yT(sk.tau.nipple) + 0.1 * r - 0.25 * r * g, ay = r * (1 + 0.15 * g);
      const errs = [];
      if (yc + ay > sk.yT(sk.tau.axilla) + 1e-6) errs.push('sube por encima de la axila');
      if (xc + r > 0.5 * sk.w.chest + 0.15 + 1e-6) errs.push('sobresale del pecho');
      if (xc - r < 0.02 - 1e-6) errs.push('separación interior insuficiente');
      if (yc - ay < sk.yT(0.5) - 1e-6) errs.push('pliegue por debajo del límite');
      add(errs.length ? 'error' : 'ok', 'Busto', errs.length ? errs.join(', ') : `Tamaño ${c.toFixed(2)}, caída ${g.toFixed(2)}: dentro de los límites`);
    }

    // Longitud de huesos constante y límites articulares en las animaciones.
    const pairs = [['shoulder_L', 'elbow_L'], ['elbow_L', 'wrist_L'], ['hip_R', 'knee_R'], ['knee_R', 'ankle_R']];
    const rest = pairs.map(([a, b]) => M.dist(sk.joints[a].rest, sk.joints[b].rest));
    let worst = 0, clamped = 0;
    for (const id of ['idle', 'walk', 'run', 'jump', 'wave', 'attack']) {
      for (let i = 0; i < 8; i++) {
        const pose = R.animate(sk, id, i / 8);
        for (const [n, a] of Object.entries(pose.joints || {})) {
          const c = R.clampJoint(n, a);
          if (Object.keys(a).some((k) => Math.abs((c[k] || 0) - (a[k] || 0)) > 1e-9)) clamped++;
        }
        const f = R.solve(sk, pose);
        pairs.forEach(([a, b], k) => { worst = Math.max(worst, Math.abs(M.dist(f.pos[a], f.pos[b]) / rest[k] - 1)); });
      }
    }
    add(worst < 0.005 ? 'ok' : 'error', 'Huesos', `Variación máxima de longitud ${(worst * 100).toFixed(2)} % (tolerancia 0,5 %)`);
    add(clamped ? 'warn' : 'ok', 'Límites articulares', clamped ? `${clamped} ángulo(s) recortados a su límite` : 'Todas las poses dentro de los límites');

    // Equilibrio en reposo (8.4).
    const f0 = R.solve(sk, R.animate(sk, 'idle', 0));
    add(R.balanced(f0) ? 'ok' : 'warn', 'Equilibrio', R.balanced(f0) ? 'El centro de masas cae sobre el apoyo en reposo' : 'La pose de reposo se cae');

    // Legibilidad de color (11.5).
    const bad = [];
    for (const [k, hex] of Object.entries({ piel: look.skin, pelo: look.hair, 'ropa A': look.top, 'ropa B': look.bottom })) {
      const L = [-1, 0, 1].map((s) => M.hexToOklch(M.ramp(hex, s))[0]);
      if (L[1] - L[0] < C.ramp.minDL - 0.005 || L[2] - L[1] < C.ramp.minDL - 0.005) bad.push(k);
    }
    add(bad.length ? 'warn' : 'ok', 'Color', bad.length ? `Tonos poco separados en: ${bad.join(', ')}` : 'Rampas legibles (ΔL ≥ 0,06)');
    return out;
  }

  return { run };
})();
