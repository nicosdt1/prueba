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

  // Las longitudes del pelo se dan en cabezas de un cuerpo de 6,5 cabezas;
  // en chibi la cabeza es enorme, así que se acortan para no llegar al suelo.
  const lenK = (rig) => U.clamp(rig.body.heads / 6.5, 0.4, 1.25);

  // Rango de phi visible (la cara mira a la cámara cuando cos(phi + giro) > 0).
  function clampPhi(rig, phi) {
    const yawEff = rig.yaw + rig.pose.headYaw + rig.pose.twist;
    const lo = -PI / 2 - yawEff + 0.08, hi = PI / 2 - yawEff - 0.08;
    return U.clamp(phi, lo, hi);
  }

  function bottomFn(st, trim = 0) {
    return (phi) => {
      const c = Math.cos(phi);
      return (c >= 0 ? U.lerp(st.side, st.hairline, Math.pow(c, 0.8)) : U.lerp(st.side, st.nape, Math.pow(-c, 0.8))) - trim * (1 - Math.max(0, c));
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
    const pts = [], N = 12, len = t.len * H.h * lenK(rig);
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
    const y0 = H.c.y - H.h * 0.25, y1 = H.c.y + H.h * 0.5 + sh.len * H.h * lenK(rig);
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

  // ---------- Mechones ----------
  // El pelo "dibujado" está hecho de mechones: cada uno nace en el cuero
  // cabelludo, sigue la superficie de la cabeza, cae por gravedad sin
  // atravesar el cuerpo y termina en punta. Cada mechón tiene su sombra
  // (lado contrario a la luz), un brillo cerca de la raíz y su contorno.

  // Empuja un punto fuera del torso (el pelo largo cae sobre hombros y espalda).
  function outsideBody(rig, p) {
    const keys = rig.torso.keys;
    let s = null;
    for (const k of keys) if (k.s.c.y <= p.y) s = k.s;
    if (!s || p.y > keys[keys.length - 1].s.c.y) return p;
    const dx = p.x - s.c.x, dz = p.z - s.c.z;
    const bz = dz >= 0 ? s.b : s.b2;
    const d = Math.hypot(dx / (s.a * 1.12), dz / (bz * 1.12 + 1e-6));
    if (d >= 1) return p;
    const k = 1 / Math.max(d, 0.05);
    return Vc.v(s.c.x + dx * k, p.y, s.c.z + dz * k);
  }

  function clumpPts(rig, Hd, c) {
    const H = rig.head, pts = [], N = c.n || 10, lh = 0.86;
    for (let i = 0; i <= N; i++) {
      const t = i / N, l = U.lerp(c.l0, c.l1, t);
      const phi = c.phi + (c.drift || 0) * t + (c.wave || 0) * Math.sin(t * PI * 3);
      const out = c.out * (1 - 0.3 * t) + (c.flare || 0) * H.w * t * t;
      let p = V.surf(Hd.at(Math.min(l, lh)), phi, out);
      if (l > lh) {
        const s = Hd.at(lh), n = Vc.sub(p, s.c);
        const nh = Vc.norm(Vc.v(n.x, 0, n.z));
        p = Vc.add(p, Vc.v(nh.x * H.w * 0.12 * (c.spread || 1), (l - lh) * H.h, nh.z * H.w * 0.12 * (c.spread || 1)));
        p = outsideBody(rig, p);
      }
      if (c.lift) p = Vc.add(p, Vc.v(0, -c.lift * H.h * t * t, 0));
      pts.push(p);
    }
    return pts;
  }

  // Genera los mechones de un peinado (determinista para cada estilo).
  function makeClumps(rig, st, id) {
    if (st.thin) return [];
    const r = U.rng([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
    const H = rig.head, e = st.vol * H.w, out = [];
    const longL = st.sheet ? 1 + st.sheet.len * lenK(rig) : null;
    const add = (o) => out.push(Object.assign({ out: e * 0.9, w: 0.3 }, o));
    // Flequillo: un mechón por cada punta del perfil del flequillo.
    (st.bangs || []).forEach(([phi, l], i, arr) => {
      const gap = i ? Math.abs(phi - arr[i - 1][0]) : Math.abs(arr[1][0] - phi);
      add({ phi: phi * 0.8 + (r() - 0.5) * 0.06, drift: phi * 0.22 + (r() - 0.5) * 0.12, l0: st.hairline - 0.2, l1: l + 0.02 + (r() - 0.5) * 0.04, w: gap * (1.1 + r() * 0.4), out: e * 0.85, kind: 'bang', wave: st.curly ? 0.06 : 0.02, root: 0.35 });
    });
    if (st.swept) {
      for (let i = 0; i < 9; i++) {
        const phi = -1.2 + (2.4 * i) / 8;
        add({ phi, drift: 0.35 * Math.sign(phi || 1) + (r() - 0.5) * 0.2, l0: st.hairline - 0.05, l1: 0.35 + r() * 0.1, w: 0.42, out: e * 1.1, flare: 0.1, kind: 'bang' });
      }
    }
    // Coronilla: mechones radiales desde el remolino.
    const nc = st.spikes ? 10 : 8;
    for (let i = 0; i < nc; i++) {
      const phi = (i / nc) * PI * 2 + r() * 0.3;
      add({ phi, drift: (r() - 0.5) * 0.4, l0: 0.05, l1: 0.3 + r() * 0.12, w: 0.5, out: e * 0.8, flare: st.spikes ? 0.35 : 0.03, lift: st.spikes ? 0.12 : 0, kind: 'crown', root: 0.25 });
    }
    // Laterales y nuca.
    const sideEnd = st.hang && !longL ? st.side + 0.08 : st.side + 0.05;
    // Mechones delanteros largos que caen sobre el pecho.
    for (const lk of st.locks || []) {
      for (let j = 0; j < 2; j++) {
        add({ phi: lk.phi * (1 + j * 0.1), drift: Math.sign(lk.phi) * 0.1, l0: st.hairline + 0.02, l1: 1 + lk.len * lenK(rig) * (0.85 + j * 0.15), w: lk.w * 1.6, out: e * 0.8, kind: 'side', spread: 0.6 });
      }
    }
    for (const sgn of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const long = longL && i > 0;
        const phi = sgn * ((long ? 1.75 : 1.25) + i * 0.28 + r() * 0.08);
        add({ phi, drift: sgn * 0.08, l0: 0.12 + r() * 0.08, l1: long ? longL * (0.8 + r() * 0.25) : sideEnd + r() * 0.08, w: 0.42, out: e, kind: 'side', flare: st.spikes ? 0.25 : 0, wave: st.curly ? 0.08 : 0 });
      }
    }
    const nb = longL ? 11 : 8;
    for (let i = 0; i < nb; i++) {
      const phi = 1.95 + ((2 * PI - 3.9) * i) / (nb - 1) + (r() - 0.5) * 0.12;
      const l1 = longL ? longL * (0.85 + r() * 0.2) : st.nape + 0.04 + r() * 0.08;
      add({ phi, drift: (r() - 0.5) * 0.15, l0: 0.08 + r() * 0.1, l1, w: longL ? 0.5 : 0.45, out: e, kind: 'back', spread: longL ? 1.4 : 1, flare: st.spikes ? 0.3 : 0, wave: st.curly ? 0.08 : 0 });
    }
    return out;
  }

  // Dibuja un mechón como polígono afilado con sombra, brillo y contorno.
  function drawClump(ctx, rig, P, width, color, rootW) {
    const n = P.length, L = [], R = [], nrm = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l; ty /= l;
      const t = i / (n - 1);
      const r0 = rootW != null ? rootW : 0.75;
      const w = width * (t < 0.2 ? r0 + ((1 - r0) * t) / 0.2 : 1) * Math.pow(1 - t, 0.75) + (i === n - 1 ? 0 : 0.2);
      nrm.push({ x: -ty, y: tx, w });
      L.push({ x: P[i].x - ty * w, y: P[i].y + tx * w });
      R.push({ x: P[i].x + ty * w, y: P[i].y - tx * w });
    }
    const outline = L.concat(R.slice().reverse());
    const hi = rig.detail === 'high';
    const trace = (q, pts) => (hi ? SC.draw.smooth(q, pts, true) : SC.draw.poly(q, pts));
    if (SC.ID) { SC.draw.fill(ctx, color, (q) => SC.draw.poly(q, outline)); return; }
    if (rig.line > 0) SC.draw.stroke(ctx, SC.draw.lineColor(rig, color), rig.line * 1.6, (q) => trace(q, outline));
    ctx.beginPath(); trace(ctx, outline); ctx.fillStyle = color; ctx.fill();
    // Lado en sombra: el opuesto a la luz (arriba-izquierda).
    const mid = Math.floor(n / 2), lit = nrm[mid].x * -0.55 + nrm[mid].y * -0.83 > 0 ? -1 : 1;
    const side = lit > 0 ? L : R, sh = [];
    for (let i = 1; i < n; i++) sh.push({ x: U.lerp(P[i].x, side[i].x, 0.15), y: U.lerp(P[i].y, side[i].y, 0.15) });
    const shadow = U.multiply(color, V.MATERIALS.hair.tint);
    ctx.save();
    ctx.beginPath(); trace(ctx, outline); ctx.clip();
    SC.draw.fill(ctx, rig.pixel ? U.multiply(shadow, '#d6c8e4') : shadow, (q) => SC.draw.poly(q, sh.concat(side.slice(1).reverse())));
    // Brillo junto a la raíz, en el lado iluminado.
    const other = lit > 0 ? R : L, i0 = Math.round(n * 0.12), i1 = Math.round(n * (hi ? 0.42 : 0.35));
    const hl = [];
    for (let i = i0; i <= i1; i++) hl.push({ x: U.lerp(P[i].x, other[i].x, 0.25), y: U.lerp(P[i].y, other[i].y, 0.25) });
    for (let i = i1; i >= i0; i--) hl.push({ x: U.lerp(P[i].x, other[i].x, 0.7), y: U.lerp(P[i].y, other[i].y, 0.7) });
    SC.draw.fill(ctx, hi ? U.rgba(U.shade(color, 0.45), 0.75) : U.shade(color, 0.3), (q) => SC.draw.poly(q, hl));
    ctx.restore();
    if (hi && rig.line > 0) SC.draw.stroke(ctx, U.rgba(U.shade(color, -0.5), 0.5), rig.line * 0.5, (q) => SC.draw.poly(q, P.slice(Math.round(n * 0.3), n - 1), false));
  }

  // Proyecta y clasifica los mechones en visibles (delante) y ocultos (detrás).
  function clumpSet(rig, Hd, st, id) {
    const H = rig.head, hz = V.proj(rig, H.c).z, front = [], back = [];
    for (const c of makeClumps(rig, st, id)) {
      const pts = clumpPts(rig, Hd, c);
      const P = pts.map((p) => V.proj(rig, p));
      let zr = 0;
      for (let i = 0; i < pts.length; i++) {
        const onHead = pts[i].y < H.c.y + H.h * 0.4;
        zr += onHead ? P[i].z - hz : P[i].z - V.proj(rig, Vc.v(rig.pivot.x, pts[i].y, 0)).z;
      }
      // Se clasifica por la raíz: un mechón que nace detrás de la cabeza queda detrás.
      const nr = Math.max(2, Math.round(pts.length * 0.35));
      let zroot = 0;
      for (let i = 0; i < nr; i++) zroot += P[i].z - hz;
      zroot /= nr;
      zr = c.l1 > 1 ? zroot : zr / pts.length;
      const item = { P, z: zr, w: c.w * H.w * 0.5, kind: c.kind, root: c.root };
      (zr > (c.l1 > 1.2 ? 0.2 : -0.12) * H.w ? front : back).push(item);
    }
    const ORDER = { back: 0, side: 1, crown: 2, bang: 3 };
    front.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.z - b.z);
    back.sort((a, b) => a.z - b.z);
    return { front, back };
  }

  for (const [id, st] of Object.entries(STYLES)) {
    const colors = { main: { label: 'Pelo', value: '#6b3f2a' } };
    if ((st.tails || []).some((t) => t.tie) || st.bun) colors.tie = { label: 'Lazo', value: '#e0445e' };

    SC.registerPart({
      slot: 'hair', id, name: st.name, colors,

      hairShell(ctx, rig, c, Hd) {
        const H = rig.head, e = thickness(rig, st);
        let vol = Hd.shell(e, 0, 1, { topFn: () => 0, botFn: bottomFn(st, st.thin ? 0 : 0.12), n: rig.detail === 'high' ? 36 : 18, density: 16 });
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
        V.fill(ctx, rig, vol, st.thin ? c.main : U.shade(c.main, -0.12), { mat: 'hair', cast: 0.01 });
        if (cut && rig.line > 0) {
          // Contorno donde el pelo se encuentra con la cara.
          ctx.save();
          V.clip(ctx, vol);
          SC.draw.stroke(ctx, SC.draw.lineColor(rig, c.main), rig.line * 1.4, (q) => SC.draw.poly(q, cut));
          ctx.restore();
        }
        ctx.restore();
      },

      hairFront(ctx, rig, c, Hd) {
        if (st.bangs && rig.detail === 'high') {
          // Sombra del flequillo sobre la frente
          const topEdge = st.bangs.slice().reverse().map(([phi]) => [st.hairline - 0.12, clampPhi(rig, phi * 0.95), 0]);
          V.decal(ctx, rig, Hd.at, st.bangs.map(([phi, l]) => [l + 0.06, clampPhi(rig, phi), 0]).concat(topEdge),
            { fill: U.rgba(U.shade(rig.skinColor, -0.5), 0.3), clip: Hd.skull, smooth: true, minVis: 0.25 });
        }
        for (const cl of clumpSet(rig, Hd, st, id).front) drawClump(ctx, rig, cl.P, cl.w, c.main, cl.root);
      },

      items(rig, c, body) {
        const Hd = body.head, H = rig.head, e = st.vol * H.w, out = [];
        const hz = V.proj(rig, H.c).z;
        const zOf = (p, front) => (V.proj(rig, p).z - hz > (front ? -0.2 : 0.3) * H.w ? 1004 : -500);
        const back = clumpSet(rig, Hd, st, id).back;
        if (back.length) out.push({ z: -450, draw: (ctx) => { for (const cl of back) drawClump(ctx, rig, cl.P, cl.w, U.shade(c.main, -0.05), cl.root); } });
        if (st.sheet) {
          const vol = sheetVol(rig, Hd, st, e);
          out.push({ z: vol.z, draw: (ctx) => V.fill(ctx, rig, vol, U.shade(c.main, -0.06), { mat: 'hair', cast: 0.006 }) });
        }
        for (const t of st.tails || []) {
          const h = hangVol(rig, Hd, e, t);
          out.push({
            z: zOf(h.start, t.front),
            draw: (ctx) => {
              V.fill(ctx, rig, h.vol, c.main, { mat: 'hair', cast: 0.006 });
              if (t.tie) V.fill(ctx, rig, V.tube(rig, [h.pts[0], h.pts[1]], H.w * t.r * 0.45, 1, 10), c.tie, { mat: 'hair', cast: 0.006 });
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
              V.fill(ctx, rig, vol, c.main, { mat: 'hair', cast: 0.006 });
              V.fill(ctx, rig, V.tube(rig, [Vc.madd(p, n, r * 0.05), Vc.madd(p, n, r * 0.3)], r * 0.5, 1, 10), c.tie, { mat: 'hair', cast: 0.006 });
            },
          });
        }
        return out;
      },
    });
  }
})();
