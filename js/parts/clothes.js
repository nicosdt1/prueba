// Ropa: parte superior, abrigos, parte inferior y calzado.
//
// Las prendas son "capas" sobre las superficies 3D del cuerpo (torso, brazos,
// piernas, pies) con un grosor de tela, así que siguen la anatomía, se
// adaptan a cualquier cuerpo y funcionan en todas las vistas y animaciones.
(() => {
  const U = SC.util, Vc = SC.vec, V = SC.V;
  const PI = Math.PI;
  const E = (rig, k = 1) => rig.B * 0.0035 * k;

  // ---------- Utilidades de prendas ----------
  // Prenda de torso: de un escote (función de phi) hasta un bajo; si el bajo
  // queda por debajo de la cadera continúa como falda recta o acampanada.
  function garment(rig, T, o) {
    const L = T.L, e = o.e;
    const hemL = o.hemL != null ? o.hemL : L.hip2;
    const rings = T.shellRings(e, 0, Math.min(hemL, L.hip2), { topFn: o.top, n: 20, density: 26 });
    const secs = [];
    if (o.hemY) {
      const s0 = T.at(L.hip2), y0 = s0.c.y, n = 8;
      for (let i = 1; i <= n; i++) {
        const k = i / n, fl = U.lerp(1, o.flare || 1, Math.pow(k, 1.2));
        const y = U.lerp(y0, o.hemY, k);
        const s = rig.torso.ringAt(y, (s0.a + e) * fl, (s0.b + e) * fl * 1.05, (s0.b2 + e) * fl, k > 0.85 ? o.bump || 0 : 0);
        s.bumpN = 11;
        secs.push(s);
        rings.push(V.ring(s, 20));
      }
    }
    const vol = V.fromRings(rig, rings, rig.dim.chestHalf * 0.8);
    vol.skirt = secs;
    return vol;
  }

  // Falda desde un nivel del torso con sus propias secciones (para decorarla).
  function skirt(rig, T, e, fromL, hemY, flare, bump) {
    const s0 = T.at(fromL), secs = [s0].map((s) => V.sec(s.c, s.u, s.v, s.a + e, s.a2 + e, s.b + e, s.b2 + e));
    const n = 10;
    const hipS = T.at(T.L.hip2);
    for (let i = 1; i <= n; i++) {
      const k = i / n, y = U.lerp(s0.c.y, hemY, k);
      const base = y < hipS.c.y ? T.at(U.lerp(fromL, T.L.hip2, (y - s0.c.y) / (hipS.c.y - s0.c.y))) : hipS;
      const fl = U.lerp(1, flare, Math.pow(Math.max(0, (y - s0.c.y) / (hemY - s0.c.y)), 1.1));
      const s = rig.torso.ringAt(y, (Math.max(base.a, hipS.a * 0.98) + e) * fl, (base.b + e) * fl * 1.05, (Math.max(base.b2, hipS.b2) + e) * fl, k > 0.9 ? bump : 0);
      s.bumpN = 12;
      secs.push(s);
    }
    const at = V.spec(secs.map((s, i) => ({ l: i / n, s })));
    return { vol: V.fromSections(rig, secs, 20), at };
  }

  function fill(ctx, rig, vol, color, o) { V.fill(ctx, rig, vol, color, Object.assign({ cast: 0.007 }, o)); }
  const neckRound = (L, depth = 0.03) => (phi) => L.neckBase + 0.03 + depth * Math.pow(Math.max(0, Math.cos(phi)), 2);

  function sleeve(ctx, rig, A, color, l1, e, cuff) {
    const vol = A.shell(e, A.capL, l1);
    fill(ctx, rig, vol, color);
    if (cuff) fill(ctx, rig, A.shell((l) => (typeof e === 'function' ? e(l) : e) * 1.25, l1 - 0.07, l1), cuff);
    return vol;
  }

  function folds(ctx, rig, at, lines, color, clip) {
    if (rig.detail !== 'high') return;
    for (const pts of lines) V.dline(ctx, rig, at, pts, U.rgba(U.shade(color, -0.4), 0.7), rig.line * 0.55, { clip });
  }

  function vNeck(ctx, rig, T, c, depthL, width, clip, edge) {
    const L = T.L;
    const pts = [[L.neckBase + 0.01, -width], [depthL, 0], [L.neckBase + 0.01, width], [L.neckBase - 0.03, width * 0.5], [L.neckBase - 0.03, -width * 0.5]];
    V.decal(ctx, rig, T.at, pts, { fill: rig.skinColor, clip });
    V.dline(ctx, rig, T.at, pts.slice(0, 3), SC.draw.lineColor(rig, edge), rig.line, { clip, thr: 0 });
  }

  const reg = (d) => SC.registerPart(d);

  // ---------- Parte superior ----------
  reg({
    slot: 'top', id: 'camiseta', name: 'Camiseta',
    colors: { main: { label: 'Tela', value: '#4f86d9' }, print: { label: 'Estampado', value: '#ffd35c' } },
    torso(ctx, rig, c, T) {
      const L = T.L;
      const vol = garment(rig, T, { e: E(rig, 1.2), top: neckRound(L, 0.035), hemL: L.hip2 - 0.01 });
      fill(ctx, rig, vol, c.main);
      const star = V.curvePts(10, (t) => { const a = t * 2 * PI - PI / 2, r = Math.round(t * 10) % 2 ? 0.45 : 1; return [L.bust - 0.01 + Math.sin(a) * 0.05 * r, Math.cos(a) * 0.2 * r, E(rig, 1.2)]; });
      V.decal(ctx, rig, T.at, star, { fill: c.print, stroke: rig.detail === 'high' ? SC.draw.lineColor(rig, c.print) : null, width: rig.line * 0.6, clip: vol });
      folds(ctx, rig, T.at, [
        V.curvePts(4, (t) => [U.lerp(L.waist, L.hip2 - 0.02, t), -0.9 + 0.1 * t]),
        V.curvePts(4, (t) => [U.lerp(L.underbust + 0.04, L.waist + 0.02, t), 1.0 - 0.15 * t]),
      ], c.main, vol);
    },
    arm(ctx, rig, c, A) { sleeve(ctx, rig, A, c.main, 0.4, (l) => E(rig, 1.6 + 5 * l)); },
  });

  reg({
    slot: 'top', id: 'camisa', name: 'Camisa',
    colors: { main: { label: 'Tela', value: '#f2f2f5' }, detail: { label: 'Botones', value: '#7f8aa6' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 1.3);
      const vol = garment(rig, T, { e, top: () => L.neckBase + 0.005, hemL: L.hip2 });
      fill(ctx, rig, vol, c.main);
      vNeck(ctx, rig, T, c, L.armpit - 0.01, 0.42, vol, c.main);
      for (const s of [-1, 1]) {
        V.decal(ctx, rig, T.at, [[L.neckBase - 0.025, s * 0.3, e * 2], [L.neckBase + 0.02, s * 1.05, e * 2], [L.armpit - 0.03, s * 0.42, e * 2], [L.armpit - 0.005, s * 0.03, e * 2]],
          { fill: U.shade(c.main, -0.03), stroke: SC.draw.lineColor(rig, c.main), width: rig.line * 0.9, clip: null, minVis: 0.3 });
      }
      V.dline(ctx, rig, T.at, [[L.armpit, 0.03, e], [L.hip2, 0.03, e]], U.rgba(U.shade(c.main, -0.4), 0.8), rig.line * 0.6, { clip: vol });
      for (let i = 0; i < 4; i++) {
        const l = U.lerp(L.armpit + 0.04, L.hip - 0.02, i / 3);
        V.decal(ctx, rig, T.at, V.curvePts(8, (t) => [l + 0.008 * Math.sin(t * 2 * PI), 0.07 + 0.035 * Math.cos(t * 2 * PI), e * 1.5]), { fill: c.detail, clip: vol, minVis: 0.9 });
      }
      folds(ctx, rig, T.at, [V.curvePts(4, (t) => [U.lerp(L.underbust, L.waist + 0.05, t), -0.7 - 0.2 * t])], c.main, vol);
    },
    arm(ctx, rig, c, A) { sleeve(ctx, rig, A, c.main, 1.93, (l) => E(rig, 1.8 + 1.5 * Math.sin(l * 1.6)), U.shade(c.main, -0.05)); },
  });

  reg({
    slot: 'top', id: 'sudadera', name: 'Sudadera',
    colors: { main: { label: 'Tela', value: '#8e5bc8' }, detail: { label: 'Cordones', value: '#f5f0ff' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 3);
      const vol = garment(rig, T, { e, top: neckRound(L, 0.02), hemL: L.hip2 + 0.02 });
      fill(ctx, rig, vol, c.main);
      fill(ctx, rig, T.shell(e * 1.3, L.hip2 - 0.035, L.hip2 + 0.02), U.shade(c.main, -0.08));
      // Capucha plegada sobre los hombros
      const hood = V.curvePts(14, (t) => { const phi = U.lerp(1.15, 2 * PI - 1.15, t); return V.surf(T.at(L.neckBase + 0.025), phi, e + rig.dim.neckR * 0.45); });
      fill(ctx, rig, V.tube(rig, hood, (k) => rig.dim.neckR * (0.45 + 0.25 * Math.sin(k * PI)), 1, 10), U.shade(c.main, -0.06));
      // Bolsillo canguro y cordones
      V.decal(ctx, rig, T.at, [[L.waist + 0.02, -0.45, e], [L.waist + 0.02, 0.45, e], [L.hip2 - 0.04, 0.72, e], [L.hip2 - 0.04, -0.72, e]],
        { stroke: SC.draw.lineColor(rig, c.main), width: rig.line * 0.8, clip: vol });
      for (const s of [-1, 1]) V.dline(ctx, rig, T.at, [[L.neckBase + 0.035, s * 0.18, e * 1.5], [L.armpit + 0.02, s * 0.2, e * 1.5]], c.detail, rig.line * 1.1, { clip: vol });
    },
    arm(ctx, rig, c, A) { sleeve(ctx, rig, A, c.main, 1.92, (l) => E(rig, 2.6 + 1.6 * Math.sin(l * 1.4)), U.shade(c.main, -0.1)); },
  });

  reg({
    slot: 'top', id: 'marinero', name: 'Uniforme marinero',
    colors: { main: { label: 'Blusa', value: '#f4f5fa' }, collar: { label: 'Cuello', value: '#27386f' }, bow: { label: 'Lazo', value: '#d63a4a' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 1.5);
      const vol = garment(rig, T, { e, top: () => L.neckBase + 0.005, hemL: L.hip - 0.02 });
      fill(ctx, rig, vol, c.main);
      vNeck(ctx, rig, T, c, L.bust, 0.45, vol, c.main);
      const col = SC.draw.lineColor(rig, c.collar), ee = e * 2;
      for (const s of [-1, 1]) {
        V.decal(ctx, rig, T.at, [[L.neckBase + 0.005, s * 0.4, ee], [L.neckBase, s * 1.25, ee], [L.shoulder + 0.03, s * 0.95, ee], [L.bust + 0.005, s * 0.03, ee]],
          { fill: c.collar, stroke: col, width: rig.line * 0.8, minVis: 0.25 });
        V.dline(ctx, rig, T.at, [[L.neckBase + 0.012, s * 1.15, ee], [L.shoulder + 0.025, s * 0.88, ee], [L.bust - 0.025, s * 0.1, ee]], '#ffffff', rig.line * 0.8, { thr: 0 });
      }
      // Cuello cuadrado por la espalda
      V.decal(ctx, rig, T.at, [[L.neckBase, 1.3, ee], [L.underbust - 0.03, 1.4, ee], [L.underbust - 0.03, 2 * PI - 1.4, ee], [L.neckBase, 2 * PI - 1.3, ee]],
        { fill: c.collar, stroke: col, width: rig.line * 0.8, minVis: 0.3 });
      V.dline(ctx, rig, T.at, [[L.neckBase + 0.01, 1.45, ee], [L.underbust - 0.045, 1.5, ee], [L.underbust - 0.045, 2 * PI - 1.5, ee], [L.neckBase + 0.01, 2 * PI - 1.45, ee]], '#ffffff', rig.line * 0.8, { thr: 0 });
      // Lazo
      const b = L.bust + 0.005, bw = rig.line;
      const bow = [[[b, 0], [b - 0.03, -0.3], [b + 0.03, -0.28]], [[b, 0], [b - 0.03, 0.3], [b + 0.03, 0.28]], [[b, -0.04], [b + 0.12, -0.12], [b + 0.11, 0.0], [b, 0.04]], [[b, 0.04], [b + 0.12, 0.12], [b + 0.11, 0.0]]];
      for (const p of bow) V.decal(ctx, rig, T.at, p.map(([l, ph]) => [l, ph, ee * 1.5]), { fill: c.bow, stroke: SC.draw.lineColor(rig, c.bow), width: bw * 0.8, minVis: 0.5 });
    },
    arm(ctx, rig, c, A) { sleeve(ctx, rig, A, c.main, 1.9, (l) => E(rig, 1.8 + 2 * Math.sin(l * 1.5)), c.collar); },
  });

  reg({
    slot: 'top', id: 'vestido', name: 'Vestido',
    colors: { main: { label: 'Tela', value: '#e87a9b' }, detail: { label: 'Cinta', value: '#fff3f6' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 1.2);
      const sk = skirt(rig, T, e, L.waist, rig.legs[0].knee.y + rig.dim.legR * 0.2, 1.9, 0.05);
      fill(ctx, rig, sk.vol, c.main);
      folds(ctx, rig, sk.at, [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4, PI].map((p) => [[0.25, p], [0.98, p * 1.02]]), c.main, sk.vol);
      const vol = garment(rig, T, { e, top: (phi) => L.neckBase + 0.05 + 0.06 * Math.max(0, Math.cos(phi)), hemL: L.waist + 0.02 });
      fill(ctx, rig, vol, c.main);
      fill(ctx, rig, T.shell(e * 2, L.waist - 0.03, L.waist + 0.025), c.detail, { shadeK: 0.2 });
    },
    arm(ctx, rig, c, A) {
      fill(ctx, rig, A.shell((l) => E(rig, 2) + rig.dim.armR * 0.55 * Math.sin(PI * U.clamp((l + 0.16) / 0.46, 0, 1)), A.capL, 0.3), c.main);
    },
  });

  reg({
    slot: 'top', id: 'kimono', name: 'Kimono',
    colors: { main: { label: 'Tela', value: '#c8485a' }, obi: { label: 'Obi', value: '#f0c75e' }, collar: { label: 'Cuello', value: '#f7f2e8' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 2);
      const hemY = rig.ground - rig.dim.fh * 1.2;
      const vol = garment(rig, T, { e, top: () => L.neckBase, hemY, flare: 1.08 });
      fill(ctx, rig, vol, c.main);
      // Cruce del cuello (izquierda sobre derecha)
      V.decal(ctx, rig, T.at, [[L.neckBase + 0.01, -0.5], [L.underbust + 0.02, 0.28], [L.neckBase + 0.01, 0.5], [L.neckBase - 0.03, 0]], { fill: rig.skinColor, clip: vol });
      V.dline(ctx, rig, T.at, [[L.neckBase + 0.005, 0.45, e * 1.5], [L.underbust, -0.15, e * 1.5]], c.collar, rig.line * 3, { clip: vol, thr: 0 });
      V.dline(ctx, rig, T.at, [[L.neckBase + 0.005, -0.5, e * 1.5], [L.underbust + 0.03, 0.3, e * 1.5], [L.waist, 0.32, e * 1.5]], c.collar, rig.line * 3, { clip: vol, thr: 0 });
      V.dline(ctx, rig, T.at, [[L.neckBase + 0.02, -0.46, e * 2], [L.underbust + 0.04, 0.26, e * 2], [L.waist, 0.28, e * 2], [L.crotch, 0.25, e * 2]], SC.draw.lineColor(rig, c.main), rig.line, { clip: vol, thr: 0 });
      if (vol.skirt.length) {
        const at = V.spec(vol.skirt.map((s, i) => ({ l: i / (vol.skirt.length - 1), s })));
        V.dline(ctx, rig, at, [[0, 0.25], [1, 0.22]], SC.draw.lineColor(rig, c.main), rig.line, { clip: vol, thr: 0 });
      }
      // Obi
      const obi = T.shell(e * 3, L.underbust + 0.05, L.navel + 0.02);
      fill(ctx, rig, obi, c.obi, { shadeK: 0.25 });
      V.dline(ctx, rig, T.at, V.curvePts(20, (t) => [(L.underbust + L.navel) / 2 + 0.03, U.lerp(-PI, PI, t), e * 3.2]), U.shade(c.obi, -0.35), rig.line * 0.8, { clip: obi });
    },
    arm(ctx, rig, c, A) {
      // Mangas anchas que cuelgan
      const e = (l) => E(rig, 2) + rig.dim.armR * (0.2 + 1.3 * U.smoothstep(0.2, 1.1, l));
      fill(ctx, rig, A.shell(e, A.capL, 1.25), c.main);
    },
  });

  reg({
    slot: 'top', id: 'tunica', name: 'Túnica',
    colors: { main: { label: 'Tela', value: '#5f8f4e' }, belt: { label: 'Cinturón', value: '#6b4a2b' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 2.2);
      const vol = garment(rig, T, { e, top: () => L.neckBase + 0.01, hemY: T.at(L.hip2).c.y + rig.legLen * 0.28, flare: 1.18, bump: 0.04 });
      fill(ctx, rig, vol, c.main);
      vNeck(ctx, rig, T, c, L.armpit + 0.02, 0.4, vol, c.main);
      const belt = T.shell(e * 1.8, L.waist - 0.02, L.waist + 0.035);
      fill(ctx, rig, belt, c.belt, { shadeK: 0.25 });
      V.decal(ctx, rig, T.at, [[L.waist - 0.03, -0.14, e * 2.5], [L.waist - 0.03, 0.14, e * 2.5], [L.waist + 0.045, 0.14, e * 2.5], [L.waist + 0.045, -0.14, e * 2.5]], { fill: '#d9b44a', stroke: SC.draw.lineColor(rig, '#d9b44a'), width: rig.line * 0.7, minVis: 0.8 });
    },
    arm(ctx, rig, c, A) { sleeve(ctx, rig, A, c.main, 1.9, (l) => E(rig, 2.2 + 2.5 * l), U.shade(c.main, -0.15)); },
  });

  reg({
    slot: 'top', id: 'armadura', name: 'Armadura',
    colors: { main: { label: 'Metal', value: '#aab6c6' }, trim: { label: 'Adornos', value: '#d6a93b' }, cloth: { label: 'Tela', value: '#5b4a82' } },
    torso(ctx, rig, c, T) {
      const L = T.L;
      const cloth = garment(rig, T, { e: E(rig, 1.5), top: () => L.neckTop + 0.12, hemY: T.at(L.hip2).c.y + rig.legLen * 0.22, flare: 1.1 });
      fill(ctx, rig, cloth, c.cloth);
      const plate = garment(rig, T, { e: E(rig, 5), top: neckRound(L, 0.02), hemL: L.navel + 0.02 });
      fill(ctx, rig, plate, c.main, { mat: 'metal' });
      if (rig.detail === 'high') {
        V.decal(ctx, rig, T.at, [[L.armpit, -0.7, E(rig, 5)], [L.armpit, -0.35, E(rig, 5)], [L.underbust, -0.3, E(rig, 5)], [L.underbust, -0.65, E(rig, 5)]], { fill: U.rgba('#ffffff', 0.45), clip: plate });
      }
      const tr = (pts, w = 1.6) => V.dline(ctx, rig, T.at, pts.map(([l, p]) => [l, p, E(rig, 5.2)]), c.trim, rig.line * w, { clip: plate, thr: 0 });
      tr([[L.neckBase + 0.05, 0], [L.navel, 0]]);
      tr(V.curvePts(12, (t) => [L.underbust + 0.02 - 0.03 * Math.sin(t * PI), U.lerp(-1.1, 1.1, t)]));
      tr(V.curvePts(20, (t) => [L.navel, U.lerp(-PI, PI, t)]), 2.2);
      // Faldar de placas
      const fauld = skirt(rig, T, E(rig, 6), L.navel + 0.01, T.at(L.hip2).c.y + rig.legLen * 0.1, 1.15, 0);
      fill(ctx, rig, fauld.vol, U.shade(c.main, -0.05), { mat: 'metal' });
      folds(ctx, rig, fauld.at, [-1.2, -0.4, 0.4, 1.2].map((p) => [[0.1, p], [1, p]]).concat([V.curvePts(16, (t) => [0.5, U.lerp(-PI, PI, t)])]), c.main, fauld.vol);
    },
    arm(ctx, rig, c, A) {
      sleeve(ctx, rig, A, c.cloth, 1.9, E(rig, 1.8));
      fill(ctx, rig, A.shell(E(rig, 4), 1.4, 1.93), c.main, { mat: 'metal' });
      const pauldron = A.shell((l) => rig.dim.armR * (0.75 - 0.9 * Math.max(0, l)), A.capL, 0.42);
      fill(ctx, rig, pauldron, c.main, { mat: 'metal' });
      V.dline(ctx, rig, A.at, V.curvePts(12, (t) => [0.38, U.lerp(-PI, PI, t), rig.dim.armR * (0.75 - 0.9 * 0.38)]), c.trim, rig.line * 1.4, { clip: pauldron, thr: 0 });
    },
  });

  // ---------- Abrigos (abiertos por delante) ----------
  const opening = (topW, bottomW, lapelL) => (rig, T) => {
    const L = T.L;
    return [[L.neckBase - 0.01, -topW], [lapelL, -bottomW], [1.0, -bottomW * 0.8], [1.0, bottomW * 0.8], [lapelL, bottomW], [L.neckBase - 0.01, topW]];
  };
  function lapels(ctx, rig, c, T, e, lapelL, color) {
    const L = T.L;
    for (const s of [-1, 1]) {
      V.decal(ctx, rig, T.at, [[L.neckBase - 0.02, s * 0.4, e], [L.neckBase + 0.03, s * 1.0, e], [L.armpit + 0.02, s * 0.62, e], [lapelL, s * 0.16, e]],
        { fill: color, stroke: SC.draw.lineColor(rig, color), width: rig.line * 0.8, minVis: 0.3 });
    }
  }
  const edgeLines = (ctx, rig, c, P) => {
    SC.draw.stroke(ctx, SC.draw.lineColor(rig, c.main), rig.line, (q) => {
      q.moveTo(P[0].x, P[0].y); q.lineTo(P[1].x, P[1].y); q.lineTo(P[2].x, P[2].y);
      q.moveTo(P[5].x, P[5].y); q.lineTo(P[4].x, P[4].y); q.lineTo(P[3].x, P[3].y);
    });
  };

  reg({
    slot: 'outer', id: 'chaqueta', name: 'Chaqueta',
    colors: { main: { label: 'Tela', value: '#3c4c63' } },
    opening: opening(0.5, 0.2, 0.36),
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 4);
      T.clothVol = garment(rig, T, { e, top: () => L.neckBase - 0.01, hemL: L.hip2 + 0.03 });
      fill(ctx, rig, T.clothVol, c.main);
    },
    openingEdge(ctx, rig, c, T, P) {
      edgeLines(ctx, rig, c, P);
      lapels(ctx, rig, c, T, E(rig, 4.5), T.L.bust + 0.03, U.shade(c.main, -0.1));
    },
    arm(ctx, rig, c, A) { sleeve(ctx, rig, A, c.main, 1.88, (l) => E(rig, 3.5 + 1.2 * Math.sin(l * 1.5)), U.shade(c.main, -0.1)); },
  });

  reg({
    slot: 'outer', id: 'chaleco', name: 'Chaleco',
    colors: { main: { label: 'Tela', value: '#7a3b3b' }, detail: { label: 'Botones', value: '#e2c065' } },
    opening: opening(0.36, 0.06, 0.34),
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 3);
      T.clothVol = garment(rig, T, { e, top: () => L.neckBase + 0.005, hemL: L.hip + 0.03 });
      fill(ctx, rig, T.clothVol, c.main);
    },
    openingEdge(ctx, rig, c, T, P) {
      edgeLines(ctx, rig, c, P);
      for (let i = 0; i < 3; i++) {
        const l = U.lerp(T.L.bust + 0.04, T.L.hip - 0.02, i / 2);
        V.decal(ctx, rig, T.at, V.curvePts(8, (t) => [l + 0.009 * Math.sin(t * 2 * PI), -0.12 + 0.04 * Math.cos(t * 2 * PI), E(rig, 3.5)]), { fill: c.detail, minVis: 0.9 });
      }
    },
  });

  reg({
    slot: 'outer', id: 'gabardina', name: 'Abrigo largo',
    colors: { main: { label: 'Tela', value: '#9b7a52' }, belt: { label: 'Cinturón', value: '#5a4128' } },
    opening: opening(0.5, 0.22, 0.34),
    torso(ctx, rig, c, T) {
      const L = T.L, e = E(rig, 4.5);
      T.clothVol = garment(rig, T, { e, top: () => L.neckBase - 0.015, hemY: rig.legs[0].knee.y + rig.legLen * 0.14, flare: 1.3 });
      fill(ctx, rig, T.clothVol, c.main);
      if (T.clothVol.skirt.length) {
        const at = V.spec(T.clothVol.skirt.map((s, i) => ({ l: i / (T.clothVol.skirt.length - 1), s })));
        for (const s of [-1, 1]) V.dline(ctx, rig, at, [[0, s * 0.16], [1, s * 0.14]], SC.draw.lineColor(rig, c.main), rig.line, { clip: T.clothVol, thr: 0 });
        V.decal(ctx, rig, at, [[0.02, -0.15], [0.02, 0.15], [1, 0.13], [1, -0.13]], { fill: U.shade(c.main, -0.25), clip: T.clothVol });
      }
    },
    openingEdge(ctx, rig, c, T, P) {
      edgeLines(ctx, rig, c, P);
      lapels(ctx, rig, c, T, E(rig, 5), T.L.bust + 0.02, U.shade(c.main, -0.08));
      const band = T.shell(E(rig, 5.5), T.L.waist - 0.015, T.L.waist + 0.03);
      ctx.save();
      V.clip(ctx, band);
      V.fill(ctx, rig, band, c.belt, { shadeK: 0.2 });
      ctx.restore();
    },
    arm(ctx, rig, c, A) { sleeve(ctx, rig, A, c.main, 1.88, (l) => E(rig, 4 + 1.5 * Math.sin(l * 1.5)), U.shade(c.main, -0.12)); },
  });

  // ---------- Parte inferior ----------
  function pantsTorso(ctx, rig, c, T, e) {
    const L = T.L;
    const vol = T.shell(e, L.waist + 0.01, 1, {
      topFn: (p) => L.waist + 0.01 + 0.015 * Math.cos(p),
      botFn: (p) => U.lerp(1.03, L.hip2, Math.pow(Math.abs(Math.sin(p)), 1.5)),
    });
    fill(ctx, rig, vol, c.main);
    V.dline(ctx, rig, T.at, [[L.waist + 0.04, 0.05, e], [L.crotch - 0.01, 0.02, e]], U.rgba(U.shade(c.main, -0.4), 0.8), rig.line * 0.6, { clip: vol });
    V.dline(ctx, rig, T.at, V.curvePts(20, (t) => [L.waist + 0.03 + 0.015 * Math.cos(U.lerp(-PI, PI, t)), U.lerp(-PI, PI, t), e]), U.rgba(U.shade(c.main, -0.4), 0.6), rig.line * 0.5, { clip: vol });
  }
  reg({
    slot: 'bottom', id: 'pantalon', name: 'Pantalón',
    colors: { main: { label: 'Tela', value: '#34405e' } },
    torso(ctx, rig, c, T) { pantsTorso(ctx, rig, c, T, E(rig, 1.6)); },
    leg(ctx, rig, c, Lg) {
      const vol = Lg.shell((l) => E(rig, 1.8 + 2.5 * Math.max(0, l - 1)), 0, 1.97);
      fill(ctx, rig, vol, c.main);
      folds(ctx, rig, Lg.at, [V.curvePts(4, (t) => [U.lerp(0.9, 1.1, t), U.lerp(-0.6, 0.4, t), E(rig, 2)]), V.curvePts(4, (t) => [U.lerp(1.75, 1.9, t), U.lerp(0.3, -0.3, t), E(rig, 4)])], c.main, vol);
    },
  });
  reg({
    slot: 'bottom', id: 'shorts', name: 'Pantalón corto',
    colors: { main: { label: 'Tela', value: '#c79a5a' } },
    torso(ctx, rig, c, T) { pantsTorso(ctx, rig, c, T, E(rig, 1.8)); },
    leg(ctx, rig, c, Lg) { fill(ctx, rig, Lg.shell((l) => E(rig, 2.2 + 6 * l), 0, 0.72), c.main); },
  });
  reg({
    slot: 'bottom', id: 'falda', name: 'Falda',
    colors: { main: { label: 'Tela', value: '#2f3f74' }, stripe: { label: 'Franja', value: '#f2f2f2' } },
    torso(ctx, rig, c, T) {
      const sk = skirt(rig, T, E(rig, 1.6), T.L.waist + 0.02, T.at(T.L.hip2).c.y + rig.legLen * 0.3, 1.45, 0);
      fill(ctx, rig, sk.vol, c.main);
      folds(ctx, rig, sk.at, [-2.6, -1.9, -1.3, -0.65, 0, 0.65, 1.3, 1.9, 2.6, PI].map((p) => [[0.2, p], [1, p * 1.03]]), c.main, sk.vol);
      V.dline(ctx, rig, sk.at, V.curvePts(30, (t) => [0.88, U.lerp(-PI, PI, t)]), c.stripe, rig.line * 1.6, { clip: sk.vol, thr: 0 });
    },
  });
  reg({
    slot: 'bottom', id: 'faldaLarga', name: 'Falda larga',
    colors: { main: { label: 'Tela', value: '#6a4c93' } },
    torso(ctx, rig, c, T) {
      const sk = skirt(rig, T, E(rig, 1.6), T.L.waist, rig.ground - rig.dim.fh * 1.5, 1.8, 0.05);
      fill(ctx, rig, sk.vol, c.main);
      folds(ctx, rig, sk.at, [-2.2, -1.2, -0.4, 0.5, 1.4, 2.4].map((p) => [[0.3, p], [1, p * 1.05]]), c.main, sk.vol);
    },
  });

  // ---------- Calzado ----------
  function shoeVol(rig, Lg, e, raise = 0) {
    const secs = SC.anatomy.LEVELS(12, 0, 1).map((l) => {
      const s = Lg.footAt(l);
      return V.sec(Vc.add(s.c, Vc.v(0, -e * 0.6 - raise, 0)), s.u, s.v, s.a + e, s.a2 + e, s.b + e * 0.8, s.b2 + e * 0.2 + raise);
    });
    return { vol: V.fromSections(rig, secs), at: V.spec(secs.map((s, i) => ({ l: i / 12, s }))) };
  }

  reg({
    slot: 'shoes', id: 'zapatillas', name: 'Zapatillas',
    colors: { main: { label: 'Tela', value: '#e04848' }, sole: { label: 'Suela', value: '#f5f5f5' } },
    leg(ctx, rig, c, Lg) {
      const e = E(rig, 3);
      fill(ctx, rig, Lg.shell(e, 1.88, 2), c.main);
      const sole = shoeVol(rig, Lg, e * 1.2, -e * 0.2);
      fill(ctx, rig, sole.vol, c.sole, { shadeK: 0.2 });
      const up = shoeVol(rig, Lg, e, e * 0.8);
      fill(ctx, rig, up.vol, c.main);
      if (rig.detail === 'high') {
        for (const l of [0.32, 0.42, 0.52]) V.dline(ctx, rig, up.at, [[l, -0.35], [l, 0.35]], c.sole, rig.line * 0.9, { clip: up.vol });
      }
    },
  });
  reg({
    slot: 'shoes', id: 'botas', name: 'Botas', rank: 25,
    colors: { main: { label: 'Cuero', value: '#6b4630' } },
    leg(ctx, rig, c, Lg) {
      const e = E(rig, 3.5);
      const shaft = Lg.shell((l) => e + E(rig, 1.5) * (l < 1.45 ? 1 : 0), 1.35, 2);
      fill(ctx, rig, shaft, c.main, { mat: 'leather' });
      fill(ctx, rig, Lg.shell(e * 1.6, 1.35, 1.42), U.shade(c.main, 0.12), { shadeK: 0.2 });
      fill(ctx, rig, shoeVol(rig, Lg, e * 1.1, -e * 0.3).vol, U.shade(c.main, -0.45));
      fill(ctx, rig, shoeVol(rig, Lg, e, e * 0.5).vol, c.main);
    },
  });
  reg({
    slot: 'shoes', id: 'zapatos', name: 'Zapatos',
    colors: { main: { label: 'Cuero', value: '#2b2233' } },
    leg(ctx, rig, c, Lg) {
      const e = E(rig, 2.5);
      const sh = shoeVol(rig, Lg, e, 0);
      fill(ctx, rig, sh.vol, c.main, { mat: 'leather' });
      if (rig.detail === 'high') V.decal(ctx, rig, sh.at, [[0.55, -0.25], [0.7, -0.1], [0.72, -0.3]], { fill: U.rgba('#ffffff', 0.5), clip: sh.vol, minVis: 0.3 });
    },
  });

  SC.clothes = { garment, skirt, E };
})();
