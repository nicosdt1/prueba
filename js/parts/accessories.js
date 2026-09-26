// Accesorios de cabeza, cara, cuello y espalda (todos en 3D).
(() => {
  const U = SC.util, Vc = SC.vec, V = SC.V, D = SC.draw;
  const PI = Math.PI;
  const reg = (d) => SC.registerPart(d);
  const fill = (ctx, rig, vol, color, o) => V.fill(ctx, rig, vol, color, Object.assign({ cast: 0.005 }, o));
  const hairOut = (rig) => {
    const h = rig.equipped.find((p) => p.slot === 'hair');
    return rig.head.w * (h ? 0.16 : 0.02);
  };
  // Punto en coordenadas locales de la cabeza (x: ancho, y: alto, z: fondo).
  const HL = (rig, x, y, z) => rig.head.x(Vc.v(x * rig.head.w, y * rig.head.h, z * rig.head.d));

  // ---------- Cabeza ----------
  reg({
    slot: 'headAcc', id: 'gorra', name: 'Gorra',
    colors: { main: { label: 'Tela', value: '#d94141' }, visor: { label: 'Visera', value: '#f2f2f2' } },
    hat(ctx, rig, c, Hd) {
      const e = hairOut(rig) * 1.2;
      const cap = Hd.shell(e, 0, 0.36, { topFn: () => 0, botFn: (p) => 0.3 + 0.08 * (1 - Math.cos(p)) / 2, n: 20 });
      fill(ctx, rig, cap, c.main);
      const arc = [], arcOut = [];
      for (let i = 0; i <= 10; i++) {
        const phi = U.lerp(-1.15, 1.15, i / 10), s = Hd.at(0.3), p = V.surf(s, phi, e);
        arc.push(p);
        arcOut.push(Vc.add(V.surf(s, phi * 0.85, e + rig.head.w * 0.55 * Math.cos(phi * 0.9)), rig.head.dirTo(Vc.v(0, rig.head.h * 0.06, 0))));
      }
      fill(ctx, rig, V.fromRings(rig, [arc, arcOut], rig.head.w * 0.2), c.visor, { shadeK: 0.4 });
      fill(ctx, rig, V.tube(rig, [V.surf(Hd.at(0), 0, e * 0.8), V.surf(Hd.at(0), 0, e * 1.3)], rig.head.w * 0.08, 1, 8), c.main);
    },
  });

  reg({
    slot: 'headAcc', id: 'bruja', name: 'Sombrero de mago',
    colors: { main: { label: 'Tela', value: '#3a2b63' }, band: { label: 'Cinta', value: '#e0b042' } },
    hat(ctx, rig, c) {
      const H = rig.head, n = 24, ring = (y, r, dz = 0) => Array.from({ length: n }, (_, k) => {
        const a = (k / n) * 2 * PI;
        return HL(rig, Math.cos(a) * r, y, Math.sin(a) * r * 0.95 + dz);
      });
      fill(ctx, rig, V.fromRings(rig, [ring(-0.3, 2.05), ring(-0.33, 1.9)], H.w), c.main, { shadeK: 0.15 });
      const secs = [];
      for (let i = 0; i <= 8; i++) {
        const k = i / 8, r = U.lerp(1.08, 0.04, Math.pow(k, 0.85));
        const bend = Math.pow(k, 2.2);
        secs.push(V.sec(HL(rig, bend * 0.9, -0.34 - k * 1.7 + bend * 0.25, -bend * 0.6), H.dirTo(Vc.v(1, 0, 0)), H.dirTo(Vc.v(0, 0, 1)), r * H.w, r * H.w, r * H.d * 0.9, r * H.d * 0.9));
      }
      fill(ctx, rig, V.fromSections(rig, secs, 16), c.main, { shadeK: 0.3 });
      fill(ctx, rig, V.fromSections(rig, secs.slice(0, 2).map((s, i) => Object.assign({}, s, { a: s.a * 1.03, a2: s.a2 * 1.03, b: s.b * 1.03, b2: s.b2 * 1.03, c: i ? Vc.lerp(secs[0].c, secs[1].c, 0.6) : s.c })), 16), c.band, { shadeK: 0.2 });
    },
  });

  reg({
    slot: 'headAcc', id: 'lazo', name: 'Lazo grande',
    colors: { main: { label: 'Lazo', value: '#e2465f' } },
    hat(ctx, rig, c, Hd) {
      const f = SC.face.frame(rig, Hd, 0.14, 0.95, hairOut(rig));
      if (f.facing < -0.25) return;
      const r = rig.head.w * 0.34, line = D.lineColor(rig, c.main);
      SC.face.withFrame(ctx, f, 1, () => {
        ctx.rotate(0.35 * f.dir);
        for (const s of [-1, 1]) {
          D.fill(ctx, c.main, (q) => { q.moveTo(0, 0); q.bezierCurveTo(s * r * 1.2, -r * 1.3, s * r * 2, -r * 0.5, s * r * 1.6, r * 0.2); q.quadraticCurveTo(s * r * 1.2, r * 0.8, 0, 0); });
          if (rig.line > 0 && !SC.ID) { ctx.lineWidth = rig.line; ctx.strokeStyle = line; ctx.stroke(); }
          D.fill(ctx, U.shade(c.main, -0.18), (q) => D.ellipse(q, s * r * 1.15, r * 0.25, r * 0.45, r * 0.25));
          D.fill(ctx, c.main, (q) => { q.moveTo(0, 0); q.lineTo(s * r * 0.7, r * 1.4); q.lineTo(s * r * 0.2, r * 1.3); q.closePath(); });
          if (rig.line > 0 && !SC.ID) ctx.stroke();
        }
        D.fill(ctx, U.shade(c.main, -0.1), (q) => D.ellipse(q, 0, 0, r * 0.35, r * 0.4));
        if (rig.line > 0 && !SC.ID) ctx.stroke();
      });
    },
  });

  reg({
    slot: 'headAcc', id: 'gato', name: 'Orejas de gato',
    colors: { main: { label: 'Pelaje', value: '#3b2c2a' }, inner: { label: 'Interior', value: '#f3a3b5' } },
    hat(ctx, rig, c, Hd) {
      const e = hairOut(rig);
      for (const s of [-1, 1]) {
        const s0 = Hd.at(0.1), p = V.surf(s0, s * 0.8, e * 0.6);
        const tip = Vc.add(p, rig.head.dirTo(Vc.v(s * rig.head.w * 0.18, -rig.head.h * 0.3, -rig.head.d * 0.05)));
        const secs = [0, 0.5, 1].map((k) => V.sec(Vc.lerp(p, tip, k), rig.head.dirTo(Vc.v(1, 0, 0)), rig.head.dirTo(Vc.v(0, 0, 1)),
          rig.head.w * 0.3 * (1 - k * 0.95), rig.head.w * 0.3 * (1 - k * 0.95), rig.head.w * 0.1 * (1 - k * 0.9), rig.head.w * 0.1 * (1 - k * 0.9)));
        fill(ctx, rig, V.fromSections(rig, secs, 10), c.main);
        const inner = secs.map((q) => Object.assign({}, q, { c: Vc.add(q.c, rig.head.dirTo(Vc.v(0, q.a * 0.25, q.b * 0.9))), a: q.a * 0.55, a2: q.a2 * 0.55, b: q.b * 0.3, b2: q.b2 * 0.3 }));
        if (V.proj(rig, rig.head.dirTo(Vc.v(0, 0, 1))).z - V.proj(rig, Vc.v(0, 0, 0)).z > -0.2) fill(ctx, rig, V.fromSections(rig, inner.slice(0, 2), 10), c.inner, { outline: false, shade: false });
      }
    },
  });

  reg({
    slot: 'headAcc', id: 'corona', name: 'Corona',
    colors: { main: { label: 'Oro', value: '#e8b93a' }, gem: { label: 'Gemas', value: '#d8324c' } },
    hat(ctx, rig, c, Hd) {
      const e = hairOut(rig) * 1.1, H = rig.head;
      const band = Hd.shell(e, 0.13, 0.2, { n: 24 });
      const spikes = [];
      for (let k = 0; k < 10; k++) {
        const phi = (k / 10) * 2 * PI, p = V.surf(Hd.at(0.13), phi, e);
        spikes.push(V.tube(rig, [p, Vc.add(p, H.dirTo(Vc.v(0, -H.h * 0.16, 0)))], (t) => H.w * 0.1 * (1 - t * 0.85), 0.5, 8));
      }
      fill(ctx, rig, V.merge(band, ...spikes), c.main, { mat: 'metal' });
      for (const phi of [-0.6, 0, 0.6]) V.decal(ctx, rig, Hd.at, V.curvePts(8, (t) => [0.165 + 0.018 * Math.sin(t * 2 * PI), phi + 0.07 * Math.cos(t * 2 * PI), e * 1.1]), { fill: c.gem, minVis: 0.9 });
    },
  });

  reg({
    slot: 'headAcc', id: 'diadema', name: 'Diadema',
    colors: { main: { label: 'Diadema', value: '#f0f0f5' } },
    hat(ctx, rig, c) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const a = PI * (0.02 + (0.96 * i) / 14);
        pts.push(HL(rig, -Math.cos(a) * 1.06, -0.1 - Math.sin(a) * 0.5, 0.08));
      }
      fill(ctx, rig, V.tube(rig, pts, rig.head.w * 0.065, 1, 8), c.main);
    },
  });

  // ---------- Cara ----------
  function lensFrames(rig, Hd) {
    const F = rig.face;
    return [-1, 1].map((s) => ({ s, f: SC.face.frame(rig, Hd, F.eye, s * F.eyePhi, rig.head.w * 0.08) }));
  }
  function temples(ctx, rig, Hd, color, w) {
    const F = rig.face;
    for (const s of [-1, 1]) {
      const a = V.surf(Hd.at(F.eye - 0.02), s * (F.eyePhi + 0.55), rig.head.w * 0.08), b = V.surf(Hd.at(F.eye + 0.02), s * 1.75, rig.head.w * 0.03);
      const pa = V.proj(rig, a), pb = V.proj(rig, b);
      if (V.facing(rig, Hd.at(F.eye), b) > -0.1) D.stroke(ctx, color, w, (q) => { q.moveTo(pa.x, pa.y); q.lineTo(pb.x, pb.y); });
    }
  }
  reg({
    slot: 'faceAcc', id: 'gafas', name: 'Gafas',
    colors: { main: { label: 'Montura', value: '#3a2e4a' } },
    glasses(ctx, rig, c, Hd) {
      const r = rig.head.w * 0.3, w = rig.line * (rig.detail === 'high' ? 1.2 : 1);
      temples(ctx, rig, Hd, c.main, w);
      const L = lensFrames(rig, Hd);
      for (const { s, f } of L) {
        if (f.facing < 0) continue;
        SC.face.withFrame(ctx, f, s, () => {
          D.fill(ctx, 'rgba(200,225,255,0.18)', (q) => D.ellipse(q, 0, 0, r, r * 0.85));
          D.stroke(ctx, c.main, w, (q) => D.ellipse(q, 0, 0, r, r * 0.85));
        });
      }
      if (L[0].f.facing > 0 && L[1].f.facing > 0) {
        const a = L[0].f, b = L[1].f;
        D.stroke(ctx, c.main, w, (q) => { q.moveTo(a.x + (b.x - a.x) * 0.3, a.y - r * 0.2); q.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - r * 0.45, b.x - (b.x - a.x) * 0.3, b.y - r * 0.2); });
      }
    },
  });
  reg({
    slot: 'faceAcc', id: 'gafasSol', name: 'Gafas de sol',
    colors: { main: { label: 'Cristal', value: '#1d1b26' } },
    glasses(ctx, rig, c, Hd) {
      const r = rig.head.w * 0.32;
      temples(ctx, rig, Hd, c.main, rig.line * 1.4);
      const L = lensFrames(rig, Hd);
      for (const { s, f } of L) {
        if (f.facing < 0) continue;
        SC.face.withFrame(ctx, f, s, () => {
          D.fill(ctx, c.main, (q) => { q.moveTo(-r, -r * 0.5); q.lineTo(r, -r * 0.55); q.quadraticCurveTo(r, r * 0.8, 0, r * 0.75); q.quadraticCurveTo(-r, r * 0.8, -r, -r * 0.5); });
          D.fill(ctx, 'rgba(255,255,255,0.35)', (q) => D.ellipse(q, -r * 0.35, -r * 0.15, r * 0.25, r * 0.1, -0.5));
        });
      }
      if (L[0].f.facing > 0 && L[1].f.facing > 0) D.stroke(ctx, c.main, rig.line * 1.4, (q) => { q.moveTo(L[0].f.x, L[0].f.y - r * 0.4); q.lineTo(L[1].f.x, L[1].f.y - r * 0.4); });
    },
  });
  reg({
    slot: 'faceAcc', id: 'parche', name: 'Parche',
    colors: { main: { label: 'Parche', value: '#222026' } },
    glasses(ctx, rig, c, Hd) {
      const F = rig.face;
      V.dline(ctx, rig, Hd.at, V.curvePts(30, (t) => { const phi = U.lerp(-PI, PI, t); return [F.eye - 0.08 - 0.12 * Math.max(0, -Math.cos(phi)) + 0.06 * Math.max(0, Math.sin(phi)), phi, rig.head.w * 0.05]; }), c.main, rig.line * 1.3);
      const f = SC.face.frame(rig, Hd, F.eye, F.eyePhi, rig.head.w * 0.06);
      if (f.facing > 0) SC.face.withFrame(ctx, f, 1, () => {
        const r = rig.head.w * 0.3;
        D.fill(ctx, c.main, (q) => D.ellipse(q, 0, r * 0.1, r, r * 0.85));
      });
    },
  });

  // ---------- Cuello ----------
  reg({
    slot: 'neckAcc', id: 'bufanda', name: 'Bufanda',
    colors: { main: { label: 'Lana', value: '#d8513f' }, stripe: { label: 'Rayas', value: '#f4e1c1' } },
    torso(ctx, rig, c, T) {
      const L = T.L, r = rig.dim.neckR * 0.7;
      const ring = V.curvePts(20, (t) => V.surf(T.at(L.neckBase - 0.01), U.lerp(-PI, PI, t), SC.clothes.E(rig, 4) + r * 0.6));
      const tail = [V.surf(T.at(L.neckBase + 0.01), -0.55, r * 1.2), V.surf(T.at(L.armpit), -0.6, r * 1.2 + SC.clothes.E(rig, 4)), V.surf(T.at(L.underbust + 0.06), -0.55, r + SC.clothes.E(rig, 4))];
      const tv = V.tube(rig, tail, (k) => r * (1.1 - 0.1 * k), 0.4, 10);
      const rv = V.tube(rig, ring, r, 0.8, 12);
      const tailFront = V.facing(rig, T.at(L.armpit), tail[1]) > 0;
      if (!tailFront) fill(ctx, rig, tv, c.main);
      fill(ctx, rig, rv, c.main);
      if (tailFront) {
        fill(ctx, rig, tv, c.main);
        for (const k of [0.75, 0.88]) {
          const p = V.proj(rig, Vc.lerp(tail[1], tail[2], k)), w = r * 0.9;
          D.stroke(ctx, c.stripe, rig.line * 2, (q) => { q.moveTo(p.x - w * 0.7, p.y); q.lineTo(p.x + w * 0.7, p.y); });
        }
      }
    },
  });
  reg({
    slot: 'neckAcc', id: 'corbata', name: 'Corbata',
    colors: { main: { label: 'Corbata', value: '#b8323f' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = SC.clothes.E(rig, 4);
      const line = D.lineColor(rig, c.main);
      V.decal(ctx, rig, T.at, [[L.neckBase + 0.03, -0.1, e], [L.waist + 0.02, -0.16, e], [L.waist + 0.06, 0, e], [L.waist + 0.02, 0.16, e], [L.neckBase + 0.03, 0.1, e]], { fill: c.main, stroke: line, width: rig.line * 0.8, minVis: 0.5 });
      V.decal(ctx, rig, T.at, [[L.neckBase, -0.13, e * 1.4], [L.neckBase, 0.13, e * 1.4], [L.neckBase + 0.035, 0.09, e * 1.4], [L.neckBase + 0.035, -0.09, e * 1.4]], { fill: U.shade(c.main, -0.1), stroke: line, width: rig.line * 0.8, minVis: 0.5 });
    },
  });
  reg({
    slot: 'neckAcc', id: 'colgante', name: 'Colgante',
    colors: { main: { label: 'Cadena', value: '#e2c065' }, gem: { label: 'Gema', value: '#39b3a8' } },
    torso(ctx, rig, c, T) {
      const L = T.L, e = SC.clothes.E(rig, 3);
      const pts = V.curvePts(24, (t) => { const phi = U.lerp(-PI, PI, t); return [L.neckBase + 0.005 + Math.max(0, Math.cos(phi)) * 0.13, phi, e]; });
      V.dline(ctx, rig, T.at, pts, c.main, rig.line * 0.9, { thr: 0 });
      const l = L.neckBase + 0.14;
      V.decal(ctx, rig, T.at, [[l, 0, e], [l + 0.025, 0.1, e], [l + 0.06, 0, e], [l + 0.025, -0.1, e]], { fill: c.gem, stroke: D.lineColor(rig, c.gem), width: rig.line * 0.6, minVis: 0.7 });
    },
  });

  // ---------- Espalda ----------
  function backSheet(rig, T, e, widthTop, widthBot, yBot, wave) {
    const L = T.L, Rt = rig.R(1);
    const u = SC.mat.mv(Rt, Vc.v(1, 0, 0)), v = SC.mat.mv(Rt, Vc.v(0, 0, 1));
    const top = T.at(L.shoulder), n0 = T.at(L.neckBase + 0.01);
    const rings = [V.ring(Object.assign({}, n0, { a: n0.a + e, a2: n0.a2 + e, b: n0.b + e, b2: n0.b2 + e }), 20)];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8, y = U.lerp(top.c.y, yBot, k);
      const w = U.lerp(widthTop, widthBot, Math.sqrt(k));
      const back = V.surf(top, PI, 0).z - e;
      const s = V.sec(Vc.v(U.lerp(top.c.x, rig.pivot.x, k), y, back - rig.dim.backD * (0.2 + 0.6 * k)), u, v, w, w, rig.dim.backD * (0.6 - 0.3 * k) + e, rig.dim.backD * 0.3, { bump: k > 0.9 ? wave : 0, bumpN: 10 });
      rings.push(V.ring(s, 20));
    }
    return V.fromRings(rig, rings, widthTop * 0.5);
  }
  reg({
    slot: 'backAcc', id: 'capa', name: 'Capa',
    colors: { main: { label: 'Tela', value: '#a3263a' }, clasp: { label: 'Broche', value: '#e2c065' } },
    items(rig, c, body) {
      const T = body.torso;
      const vol = backSheet(rig, T, SC.clothes.E(rig, 6), rig.dim.shoulderHalf * 1.15, rig.dim.shoulderHalf * 1.9, rig.ground - rig.legLen * 0.12, 0.06);
      return [{ z: vol.z - 2, draw: (ctx) => fill(ctx, rig, vol, c.main, { shadeK: 0.25 }) }];
    },
    torso(ctx, rig, c, T) {
      const L = T.L, e = SC.clothes.E(rig, 6);
      for (const s of [-1, 1]) V.dline(ctx, rig, T.at, [[L.neckBase + 0.01, s * 1.3, e], [L.neckBase + 0.05, s * 0.2, e]], U.shade(c.clasp, -0.2), rig.line * 1.3, { thr: 0 });
      V.decal(ctx, rig, T.at, V.curvePts(10, (t) => [L.neckBase + 0.055 + 0.02 * Math.sin(t * 2 * PI), 0.1 * Math.cos(t * 2 * PI), e * 1.2]), { fill: c.clasp, stroke: D.lineColor(rig, c.clasp), width: rig.line * 0.7, minVis: 0.7 });
    },
  });

  reg({
    slot: 'backAcc', id: 'alas', name: 'Alas',
    colors: { main: { label: 'Plumas', value: '#f7f4ff' } },
    items(rig, c, body) {
      const T = body.torso, B = rig.B, Rt = rig.R(1);
      const out = [];
      for (const s of [-1, 1]) {
        const root = V.surf(T.at(T.L.armpit), PI - s * 0.35, 0);
        const loc = (x, y, z) => Vc.add(root, SC.mat.mv(Rt, Vc.v(s * x * B, y * B, -z * B)));
        const outline = [loc(0, 0, 0.02), loc(0.14, -0.2, 0.08), loc(0.4, -0.28, 0.16), loc(0.55, -0.2, 0.2)];
        for (let i = 1; i <= 5; i++) outline.push(loc(0.55 - i * 0.075, -0.2 + i * 0.12, 0.2 - i * 0.03), loc(0.55 - i * 0.075 - 0.02, -0.2 + i * 0.12 - 0.05, 0.19 - i * 0.03));
        outline.push(loc(0.05, 0.2, 0.05));
        const P = outline.map((p) => V.proj(rig, p));
        const z = P.reduce((a, p) => a + p.z, 0) / P.length;
        out.push({
          z,
          draw: (ctx) => {
            if (rig.line > 0 && !SC.ID) {
              ctx.beginPath(); D.smooth(ctx, P, true);
              ctx.lineWidth = rig.line * 2; ctx.strokeStyle = ctx.fillStyle = D.lineColor(rig, c.main); ctx.stroke(); ctx.fill();
            }
            ctx.beginPath(); D.smooth(ctx, P, true); ctx.fillStyle = D.paint(c.main); ctx.fill();
            if (rig.detail === 'high') {
              ctx.save(); ctx.clip();
              for (let i = 1; i <= 4; i++) {
                const a = V.proj(rig, loc(0.06 * i, -0.05, 0.05)), b = V.proj(rig, loc(0.5 - i * 0.07, -0.1 + i * 0.12, 0.18));
                D.stroke(ctx, U.shade(c.main, -0.2), rig.line * 0.7, (q) => { q.moveTo(a.x, a.y); q.lineTo(b.x, b.y); });
              }
              ctx.restore();
            }
          },
        });
      }
      return out;
    },
  });

  reg({
    slot: 'backAcc', id: 'mochila', name: 'Mochila',
    colors: { main: { label: 'Tela', value: '#e2a23a' }, strap: { label: 'Correas', value: '#6b4630' } },
    items(rig, c, body) {
      const T = body.torso, L = T.L, Rt = rig.R(1), d = rig.dim;
      const u = SC.mat.mv(Rt, Vc.v(1, 0, 0)), v = SC.mat.mv(Rt, Vc.v(0, 0, 1));
      const secs = [L.shoulder + 0.02, L.shoulder + 0.05, L.bust, L.waist, L.waist + 0.06].map((l, i) => {
        const s = T.at(l), back = V.surf(s, PI, 0);
        const r = [0.7, 0.95, 1, 1, 0.8][i];
        return V.sec(Vc.add(back, Vc.mul(v, -d.backD * 0.9)), u, v, d.shoulderHalf * 0.78 * r, d.shoulderHalf * 0.78 * r, d.backD * 0.9 * r, d.backD * 0.9 * r);
      });
      const vol = V.fromSections(rig, secs, 12);
      return [{ z: vol.z, draw: (ctx) => fill(ctx, rig, vol, c.main, { shadeK: 0.3 }) }];
    },
    torso(ctx, rig, c, T) {
      const L = T.L, e = SC.clothes.E(rig, 6);
      for (const s of [-1, 1]) {
        const pts = [[L.neckBase + 0.02, s * 1.9], [L.neckBase + 0.02, s * 1.2], [L.armpit, s * 0.75], [L.underbust + 0.02, s * 0.8], [L.waist, s * 1.1]].map(([l, p]) => V.surf(T.at(l), p, e));
        fill(ctx, rig, V.tube(rig, pts, rig.dim.armR * 0.28, 0.35, 8), c.strap, { shadeK: 0.2 });
      }
    },
  });

  reg({
    slot: 'backAcc', id: 'espada', name: 'Espada',
    colors: { main: { label: 'Hoja', value: '#cfd8e3' }, hilt: { label: 'Empuñadura', value: '#5a3d2b' } },
    items(rig, c, body) {
      const T = body.torso, B = rig.B, Rt = rig.R(1);
      const back = (l, phi, dz) => Vc.add(V.surf(T.at(l), phi, 0), SC.mat.mv(Rt, Vc.v(0, 0, -dz)));
      const a = Vc.add(back(T.L.neckBase, PI - 0.6, B * 0.05), SC.mat.mv(Rt, Vc.v(B * 0.06, -B * 0.1, 0)));
      const g = back(T.L.shoulder + 0.02, PI - 0.45, B * 0.05);
      const b = Vc.add(back(T.L.hip2, PI + 0.9, B * 0.05), SC.mat.mv(Rt, Vc.v(-B * 0.1, B * 0.12, 0)));
      const blade = V.tube(rig, [g, Vc.lerp(g, b, 0.9), b], [B * 0.018, B * 0.017, B * 0.004], 0.3, 8);
      const hilt = V.tube(rig, [a, g], B * 0.011, 1, 8);
      const dir = Vc.norm(Vc.sub(b, a)), side = Vc.norm(Vc.cross(dir, SC.mat.mv(Rt, Vc.v(0, 0, 1))));
      const guard = V.tube(rig, [Vc.madd(g, side, B * 0.045), Vc.madd(g, side, -B * 0.045)], B * 0.009, 1, 8);
      const z = (blade.z + hilt.z) / 2;
      return [{
        z,
        draw: (ctx) => {
          fill(ctx, rig, blade, c.main, { mat: 'metal' });
          fill(ctx, rig, hilt, c.hilt);
          fill(ctx, rig, guard, '#d9b44a');
          fill(ctx, rig, V.tube(rig, [Vc.madd(a, dir, -B * 0.012), a], B * 0.016, 1, 8), '#d9b44a');
        },
      }];
    },
  });
})();
