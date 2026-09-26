// Peinados en 3D.
//
// Un peinado combina:
//  - "casco": volumen sobre el cráneo que baja hasta la nuca (con el hueco de
//    la cara recortado), así cubre la cabeza por detrás en cualquier vista;
//  - flequillo: polígono pegado a la frente que gira con la cabeza;
//  - melena: lámina que cae por la espalda (detrás del cuerpo de frente,
//    delante de él vista de espaldas);
//  - mechones, coletas, trenza, moño o puntas como volúmenes adicionales.
(() => {
  const U = SC.util, Vc = SC.vec, V = SC.V;
  const PI = Math.PI;

  const STYLES = {
    corto: {
      name: 'Corto', vol: 0.13, hairline: 0.26, side: 0.52, nape: 0.8,
      bangs: [[-1.15, 0.5], [-0.95, 0.36], [-0.8, 0.46], [-0.6, 0.3], [-0.4, 0.42], [-0.2, 0.3], [0, 0.4], [0.2, 0.28], [0.4, 0.4], [0.62, 0.3], [0.82, 0.44], [1.0, 0.34], [1.15, 0.5]],
    },
    largo: {
      name: 'Largo', vol: 0.14, hairline: 0.26, side: 0.74, nape: 0.9, soft: true, hang: true,
      bangs: [[-1.2, 0.62], [-0.95, 0.42], [-0.7, 0.36], [-0.45, 0.42], [-0.2, 0.32], [0.05, 0.4], [0.3, 0.33], [0.55, 0.42], [0.8, 0.36], [1.0, 0.44], [1.2, 0.62]],
      sheet: { len: 2.4, wTop: 1.05, wBot: 1.3 },
      locks: [{ phi: -1.16, len: 1.55, w: 0.22 }, { phi: 1.16, len: 1.55, w: 0.22 }],
    },
    bob: {
      name: 'Media melena', vol: 0.15, hairline: 0.26, side: 0.96, nape: 0.98, faceHalf: 1.05, hang: true,
      bangs: [[-1.1, 0.6], [-0.95, 0.43], [-0.7, 0.4], [-0.45, 0.43], [-0.2, 0.4], [0.05, 0.43], [0.3, 0.4], [0.55, 0.43], [0.8, 0.4], [0.95, 0.43], [1.1, 0.6]],
    },
    coletas: {
      name: 'Coletas', vol: 0.11, hairline: 0.26, side: 0.56, nape: 0.86,
      bangs: [[-1.15, 0.55], [-0.9, 0.38], [-0.65, 0.42], [-0.4, 0.35], [-0.15, 0.42], [0.1, 0.35], [0.35, 0.42], [0.6, 0.35], [0.85, 0.42], [1.15, 0.55]],
      tails: [{ phi: -1.85, level: 0.2, len: 2.2, r: 0.38, tie: true, spread: 0.3 }, { phi: 1.85, level: 0.2, len: 2.2, r: 0.38, tie: true, spread: 0.3 }],
    },
    coleta: {
      name: 'Coleta', vol: 0.1, hairline: 0.2, side: 0.5, nape: 0.72,
      bangs: [[-1.1, 0.46], [-0.85, 0.32], [-0.6, 0.24], [-0.35, 0.34], [-0.15, 0.22], [0.2, 0.26], [0.5, 0.22], [0.8, 0.3], [1.1, 0.46]],
      tails: [{ phi: PI, level: 0.24, len: 1.9, r: 0.28, tie: true }],
    },
    punta: {
      name: 'De punta', vol: 0.15, hairline: 0.26, side: 0.52, nape: 0.8,
      bangs: [[-1.15, 0.52], [-0.9, 0.3], [-0.75, 0.5], [-0.5, 0.28], [-0.3, 0.52], [-0.05, 0.3], [0.15, 0.56], [0.4, 0.3], [0.6, 0.52], [0.85, 0.3], [1.15, 0.52]],
      spikes: [[0, 0.02, 0.75, 0.3], [0.5, 0.06, 0.65, 0.28], [-0.5, 0.06, 0.65, 0.28], [1.2, 0.14, 0.6, 0.28], [-1.2, 0.14, 0.6, 0.28],
        [2.0, 0.2, 0.6, 0.3], [-2.0, 0.2, 0.6, 0.3], [2.7, 0.28, 0.55, 0.3], [-2.7, 0.28, 0.55, 0.3], [PI, 0.12, 0.6, 0.3], [PI, 0.45, 0.45, 0.26]],
    },
    mono: {
      name: 'Moño', vol: 0.1, hairline: 0.22, side: 0.5, nape: 0.76, soft: true,
      bangs: [[-1.1, 0.5], [-0.8, 0.3], [-0.5, 0.26], [-0.2, 0.33], [0.1, 0.24], [0.45, 0.26], [0.8, 0.3], [1.1, 0.5]],
      locks: [{ phi: -1.2, len: 0.75, w: 0.12 }, { phi: 1.2, len: 0.75, w: 0.12 }],
      bun: { phi: PI * 0.92, level: 0.1, r: 0.44 },
    },
    rizado: {
      name: 'Rizado', vol: 0.34, hairline: 0.25, side: 0.8, nape: 0.96, soft: true, curly: 0.14, hang: true,
      bangs: [[-1.2, 0.5], [-0.95, 0.36], [-0.7, 0.42], [-0.45, 0.33], [-0.2, 0.4], [0.05, 0.33], [0.3, 0.4], [0.55, 0.33], [0.8, 0.42], [1.0, 0.36], [1.2, 0.5]],
      sheet: { len: 0.8, wTop: 1.3, wBot: 1.45, curly: true },
    },
    trenza: {
      name: 'Trenza lateral', vol: 0.11, hairline: 0.24, side: 0.6, nape: 0.86, soft: true,
      bangs: [[-1.15, 0.55], [-0.9, 0.4], [-0.6, 0.34], [-0.3, 0.4], [0, 0.33], [0.3, 0.38], [0.6, 0.3], [0.9, 0.4], [1.15, 0.55]],
      tails: [{ phi: 1.35, level: 0.62, len: 1.7, r: 0.26, braid: true, tie: true, front: true }],
    },
    atras: {
      name: 'Hacia atrás', vol: 0.14, hairline: 0.2, side: 0.5, nape: 0.8, swept: true, quiff: 1.4,
    },
    rapado: {
      name: 'Rapado', vol: 0.035, hairline: 0.2, side: 0.45, nape: 0.72, thin: true,
    },
  };

  // Rango de phi visible (la cara mira a la cámara cuando cos(phi + giro) > 0).
  function clampPhi(rig, phi) {
    const yawEff = rig.yaw + rig.pose.headYaw + rig.pose.twist;
    const lo = -PI / 2 - yawEff + 0.08, hi = PI / 2 - yawEff - 0.08;
    return U.clamp(phi, lo, hi);
  }

  function bottomFn(st) {
    return (phi) => {
      const c = Math.cos(phi);
      return c >= 0 ? U.lerp(st.side, st.hairline, Math.pow(c, 0.8)) : U.lerp(st.side, st.nape, Math.pow(-c, 0.8));
    };
  }

  // Grosor del pelo; en peinados que caen rectos se rellena el hueco bajo los pómulos.
  function thickness(rig, st) {
    const base = st.vol * rig.head.w, H = rig.head;
    const hang = (l, phi) => {
      if (!st.hang || l < 0.5) return 0;
      const s = H.at(l), s0 = H.at(0.48);
      const w = Math.abs(Math.sin(phi)), r = (s.a * w + s.b * (1 - w)), r0 = (s0.a * w + s0.b * (1 - w));
      return Math.max(0, r0 - r) * U.smoothstep(0.5, 0.75, l);
    };
    if (st.curly) return (l, phi) => base * (1 + st.curly * 2.2 * Math.sin(phi * 9 + l * 23)) + hang(l, phi);
    if (st.quiff) return (l, phi) => base * (1 + st.quiff * Math.pow(Math.max(0, Math.cos(phi)), 2) * Math.max(0, 1 - l / 0.3) + 0.5 * Math.max(0, 1 - l / 0.25));
    return st.hang ? (l, phi) => base + hang(l, phi) : base;
  }

  // Contorno de la cara (zona sin pelo) proyectado; sigue la superficie de la cabeza.
  function faceCutout(rig, Hd, st) {
    const fh = st.faceHalf || 1.25, top = st.hairline + 0.02, pts = [];
    const push = (l, phi) => pts.push([l, clampPhi(rig, phi), 0]);
    for (let j = 0; j <= 14; j++) push(top + 0.03 * Math.sin((j / 14) * PI), U.lerp(-fh, fh, j / 14));
    for (let i = 1; i <= 8; i++) push(U.lerp(top, 1.1, i / 8), fh * (1 - 0.25 * Math.pow(i / 8, 2)));
    for (let i = 7; i >= 1; i--) push(U.lerp(top, 1.1, i / 8), -fh * (1 - 0.25 * Math.pow(i / 8, 2)));
    const P = V.project(rig, Hd.at, pts);
    return P.filter((p) => p.f > -0.05).length > P.length * 0.4 ? P : null;
  }

  function surfN(rig, Hd, level, phi, out) {
    const s = Hd.at(level), p = V.surf(s, phi, out);
    return { p, n: Vc.norm(Vc.sub(p, s.c)) };
  }

  // Volumen colgante (coleta, trenza, mechón) desde un punto de la cabeza.
  function hangVol(rig, Hd, e, t) {
    const H = rig.head, { p, n } = surfN(rig, Hd, t.level, t.phi, e);
    const nh = Vc.norm(Vc.v(n.x, 0, n.z));
    const pts = [], N = 12, len = t.len * H.h;
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const out = H.w * (0.35 * Math.sqrt(k) + (t.spread || 0.15) * k);
      pts.push(Vc.add(Vc.madd(Vc.madd(p, n, H.w * 0.1 * (1 - k)), nh, out), Vc.v(0, len * Math.pow(k, 1.15) - H.w * 0.12 * Math.sin(k * PI) * (t.front ? 0 : 1), t.front ? H.w * 0.3 * k : 0)));
    }
    const r = t.r * H.w;
    const radius = (k) => {
      let rr = r * (0.55 + 0.6 * Math.sin(PI * Math.min(1, k * 1.25 + 0.1))) * (1 - 0.55 * k);
      if (t.braid) rr *= 0.8 + 0.25 * Math.abs(Math.sin(k * PI * 10));
      return Math.max(rr, r * 0.15);
    };
    return { vol: V.tube(rig, pts, radius, t.w ? 0.4 : 0.9, 14), start: p, pts };
  }

  // Lámina de pelo por la espalda.
  function sheetVol(rig, Hd, st, e) {
    const H = rig.head, sh = st.sheet;
    const top = Vc.madd(H.c, H.dirTo(Vc.v(0, 0, -1)), H.d * 0.2);
    const back = Vc.madd(H.c, H.dirTo(Vc.v(0, 0, -1)), H.d * 0.75);
    const y0 = H.c.y - H.h * 0.25, y1 = H.c.y + H.h * 0.5 + sh.len * H.h;
    const Rt = rig.R(1);
    const u = SC.mat.mv(Rt, Vc.v(1, 0, 0)), v = SC.mat.mv(Rt, Vc.v(0, 0, 1));
    const secs = [];
    const N = 10;
    // Profundidad de la espalda a cada altura.
    const backAt = (y) => {
      const T = rig.torso;
      let best = T.keys[0].s;
      for (const k of T.keys) if (k.s.c.y <= y) best = k.s;
      return best;
    };
    for (let i = 0; i <= N; i++) {
      const k = i / N, y = U.lerp(y0, y1, k);
      const bs = backAt(y);
      const kh = U.smoothstep(y0, H.c.y + H.h * 0.55, y);
      const zBack = y < H.c.y + H.h * 0.45 ? U.lerp(top.z, back.z, kh) : Math.min(V.surf(bs, PI, 0).z, back.z);
      const w = H.w * U.lerp(0.5, U.lerp(sh.wTop, sh.wBot, Math.sqrt(k)), kh) * (k > 0.9 ? 1 - (k - 0.9) * 3 : 1);
      const th = H.w * (k < 0.15 ? 0.45 : 0.22) * (1 - 0.5 * k);
      const c = Vc.v(U.lerp(top.x, bs.c.x, Math.min(1, k * 2)), y, zBack - th - e * 0.5);
      secs.push(V.sec(c, u, v, w, w, th, th, { bump: sh.curly || k > 0.85 ? 0.08 : 0, bumpN: 9 }));
    }
    const vol = V.fromSections(rig, secs, 18);
    return vol;
  }

  for (const [id, st] of Object.entries(STYLES)) {
    const colors = { main: { label: 'Pelo', value: '#6b3f2a' } };
    if ((st.tails || []).some((t) => t.tie) || st.bun) colors.tie = { label: 'Lazo', value: '#e0445e' };

    SC.registerPart({
      slot: 'hair', id, name: st.name, colors,

      hairShell(ctx, rig, c, Hd) {
        const H = rig.head, e = thickness(rig, st);
        let vol = Hd.shell(e, 0, 1, { topFn: () => 0, botFn: bottomFn(st), n: rig.detail === 'high' ? 36 : 18, density: 16 });
        if (st.spikes) {
          const cones = st.spikes.map(([phi, level, len, r]) => {
            const { p, n } = surfN(rig, Hd, level, phi, 0);
            const tip = Vc.add(Vc.madd(p, n, len * H.w), Vc.v(0, -len * H.w * 0.25, 0));
            return V.tube(rig, [p, Vc.lerp(p, tip, 0.5), tip], [r * H.w, r * H.w * 0.5, H.w * 0.02], 1, 10);
          });
          vol = V.merge(vol, ...cones);
        }
        vol.rad = H.w * 0.5;
        const cut = faceCutout(rig, Hd, st);
        ctx.save();
        if (cut) {
          ctx.beginPath();
          ctx.rect(-1e4, -1e4, 2e4, 2e4);
          SC.draw.poly(ctx, cut);
          ctx.clip('evenodd');
        }
        V.fill(ctx, rig, vol, c.main, { shadeK: 0.35 });
        if (cut && rig.line > 0) {
          // Contorno donde el pelo se encuentra con la cara.
          ctx.save();
          V.clip(ctx, vol);
          SC.draw.stroke(ctx, SC.draw.lineColor(rig, c.main), rig.line * 1.4, (q) => SC.draw.poly(q, cut));
          ctx.restore();
        }
        if (rig.detail === 'high' && !st.thin) {
          const hl = U.shade(c.main, 0.32), dk = U.rgba(U.shade(c.main, -0.45), 0.8);
          // Brillo en anillo
          for (let k = 0; k < 6; k++) {
            const a = -1.15 + k * 0.33;
            V.decal(ctx, rig, Hd.at, [[0.17, a, st.vol * H.w], [0.2, a + 0.22, st.vol * H.w], [0.25, a + 0.12, st.vol * H.w], [0.23, a - 0.02, st.vol * H.w]], { fill: hl, clip: vol, minVis: 0.6 });
          }
          // Mechones
          const strands = st.swept ? [-2.2, -1.4, -0.7, 0, 0.7, 1.4, 2.2] : [-2.5, -1.8, -1.1, 1.1, 1.8, 2.5, PI];
          for (const a of strands) {
            V.dline(ctx, rig, Hd.at, V.curvePts(8, (t) => [U.lerp(0.04, st.swept ? 0.55 : bottomFn(st)(a) - 0.05, t), a + (st.swept ? 0.35 * t * Math.sign(a || 1) : 0.15 * t)]), dk, rig.line * 0.6, { clip: vol });
          }
        }
        ctx.restore();
      },

      hairFront(ctx, rig, c, Hd) {
        const H = rig.head, e = st.vol * H.w;
        if (st.bangs) {
          const tips = st.bangs.map(([phi, l]) => [l, clampPhi(rig, phi), e * 0.75]);
          const topEdge = st.bangs.slice().reverse().map(([phi]) => [st.hairline - 0.12, clampPhi(rig, phi * 0.95), e * 0.8]);
          const poly = tips.concat(topEdge);
          // Sombra del flequillo sobre la frente
          if (rig.detail === 'high') {
            V.decal(ctx, rig, Hd.at, st.bangs.map(([phi, l]) => [l + 0.05, clampPhi(rig, phi), 0]).concat(topEdge.map(([l, p]) => [l, p, 0])),
              { fill: U.rgba(U.shade(rig.skinColor, -0.5), 0.3), clip: Hd.skull, smooth: !!st.soft, minVis: 0.25 });
          }
          const P = V.project(rig, Hd.at, poly);
          if (P.filter((p) => p.f > 0.02).length / P.length > 0.25) {
            const build = (q) => (st.soft ? SC.draw.smooth(q, P, true) : SC.draw.poly(q, P));
            const vol = { polys: [P], rad: H.w * 0.25 };
            if (st.soft) {
              // Contorno suave: se dibuja con curvas.
              ctx.lineJoin = 'round';
              ctx.beginPath(); build(ctx);
              ctx.lineWidth = rig.line * 2; ctx.strokeStyle = ctx.fillStyle = SC.draw.lineColor(rig, c.main);
              ctx.stroke(); ctx.fill();
              ctx.beginPath(); build(ctx); ctx.fillStyle = c.main; ctx.fill();
            } else {
              V.fill(ctx, rig, vol, c.main, { shadeK: 0.5 });
            }
            if (rig.detail === 'high') {
              const dk = U.rgba(U.shade(c.main, -0.45), 0.8);
              for (let i = 1; i < st.bangs.length - 1; i += 2) {
                const [phi, l] = st.bangs[i];
                V.dline(ctx, rig, Hd.at, V.curvePts(5, (t) => [U.lerp(st.hairline - 0.08, l - 0.03, t), clampPhi(rig, phi * U.lerp(0.9, 1, t)), e * 0.8]), dk, rig.line * 0.55);
              }
            }
          }
        }
      },

      items(rig, c, body) {
        const Hd = body.head, H = rig.head, e = st.vol * H.w, out = [];
        const hz = V.proj(rig, H.c).z;
        const zOf = (p, front) => (V.proj(rig, p).z - hz > (front ? -0.2 : 0.3) * H.w ? 1004 : -500);
        if (st.sheet) {
          const vol = sheetVol(rig, Hd, st, e);
          out.push({ z: vol.z, draw: (ctx) => V.fill(ctx, rig, vol, U.shade(c.main, -0.06), { shadeK: 0.3 }) });
        }
        for (const lk of st.locks || []) {
          const h = hangVol(rig, Hd, e * 0.6, { phi: lk.phi, level: st.hairline + 0.22, len: lk.len, r: lk.w * 1.5, w: true, front: true, spread: 0.12 });
          out.push({ z: zOf(h.pts[4], true), draw: (ctx) => V.fill(ctx, rig, h.vol, c.main, { shadeK: 0.4 }) });
        }
        for (const t of st.tails || []) {
          const h = hangVol(rig, Hd, e, t);
          out.push({
            z: zOf(h.start, t.front),
            draw: (ctx) => {
              V.fill(ctx, rig, h.vol, c.main, { shadeK: 0.35 });
              if (t.tie) V.fill(ctx, rig, V.tube(rig, [h.pts[0], h.pts[1]], H.w * t.r * 0.45, 1, 10), c.tie, { shadeK: 0.3 });
            },
          });
        }
        if (st.bun) {
          const { p, n } = surfN(rig, Hd, st.bun.level, st.bun.phi, e);
          const r = st.bun.r * H.w;
          const cen = Vc.madd(p, n, r * 0.7);
          const vol = V.fromSections(rig, [-1, -0.6, 0, 0.6, 1].map((k) => V.sec(Vc.madd(cen, n, k * r), Vc.norm(Vc.cross(n, Vc.v(0, 1, 0))), Vc.v(0, -1, 0), r * Math.sqrt(1 - k * k * 0.9), r * Math.sqrt(1 - k * k * 0.9), r * Math.sqrt(1 - k * k * 0.9), r * Math.sqrt(1 - k * k * 0.9), { bump: 0.05, bumpN: 7 })));
          out.push({
            z: zOf(cen) === 1004 ? 1004 : 999.5,
            draw: (ctx) => {
              V.fill(ctx, rig, vol, c.main, { shadeK: 0.35 });
              V.fill(ctx, rig, V.tube(rig, [Vc.madd(p, n, r * 0.05), Vc.madd(p, n, r * 0.3)], r * 0.5, 1, 10), c.tie, { shadeK: 0.3 });
            },
          });
        }
        return out;
      },
    });
  }
})();
