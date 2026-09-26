// Cabeza, cara, expresiones y pelo (sección 5 de docs/base-matematica.md).
//
// Espacio de la cabeza: v ∈ [0, 1] de la coronilla a la barbilla, u horizontal
// y z hacia delante, en unidades H. El volumen se construye con anillos: el
// semiancho sale del contorno frontal (Catmull-Rom centrípeta, 5.4) y la
// profundidad del perfil (5.6), así frente, 3/4 y perfil son coherentes. Los
// rasgos se colocan sobre las líneas guía (5.2) y se escorzan con la normal.
SC.anatHead = (() => {
  const M = SC.AM, C = SC.CANON, V = SC.V, SH = SC.anatShapes;
  const HC = C.head;

  // ---------- Medidas ----------
  function measure(sk) {
    const s = sk.params.s, e = sk.params.e, st = sk.face, face = sk.params.face;
    const W = M.dimorph(HC.W[st], s, e);
    const g = HC.guides[st];
    // Contorno: mezcla hombre/mujer punto a punto; la mandíbula se ajusta con face.jaw.
    const pts = HC.contour.m.map((pm, i) => {
      const pf = HC.contour.f[i];
      const u = M.dimorph([pm[0], pf[0]], s, e), v = M.dimorph([pm[1], pf[1]], s, e);
      const jaw = i === 5 || i === 4 ? face.jaw * 0.04 : 0;
      return [Math.max(0, u + jaw), Math.min(1, v)];
    });
    const curve = M.catmullRom(pts, { samples: 12 });
    const vs = [], us = [];
    for (const [u, v] of curve) { if (!vs.length || v > vs[vs.length - 1] + 1e-4) { vs.push(v); us.push(u * W); } }
    const half = (v) => {
      if (v <= vs[0]) return us[0];
      for (let i = 1; i < vs.length; i++) if (v <= vs[i]) return M.lerp(us[i - 1], us[i], (v - vs[i - 1]) / (vs[i] - vs[i - 1]));
      return us[us.length - 1];
    };
    const fp = HC.femaleProfile;
    const front = HC.profileFront.map(([z, v]) => {
      let dz = 0;
      if (Math.abs(v - 0.44) < 0.01) dz = fp.brow * s;
      if (v > 0.95) dz = fp.chin * s;
      return [v, z + dz];
    });
    const zf = M.monotone(front.map((q) => q[0]), front.map((q) => q[1]));
    const zb = M.monotone(HC.profileBack.map((q) => q[1]), HC.profileBack.map((q) => q[0]));
    const alpha = HC.alpha[st];
    const ew = alpha * W * (face.eyeScale || 1) * (1 + (HC.eyeSizeF - 1) * s);
    return {
      W, g, half, zf, zb, ew, style: st,
      eyeH: M.dimorph(HC.eyeH[st], s, 1) * ew,
      noseW: M.dimorph(HC.noseW, s, 1) * ew, mouthW: M.dimorph(HC.mouthW, s, 1) * ew,
      lipH: M.dimorph(HC.lipH, s, 1) * ew, browThick: M.dimorph(HC.browThick, s, 1) * ew,
      browLift: HC.browLift * s,
    };
  }

  // Punto de la superficie de la cabeza en reposo (modelo) y su normal.
  function surf(sk, hm, u, v, out = 0) {
    const a = Math.max(1e-4, hm.half(v)), zf = hm.zf(v), zb = hm.zb(v);
    const zc = (zf + zb) / 2, b = Math.max(1e-4, (zf - zb) / 2);
    const k = M.clamp(u / (a + out), -0.999, 0.999);
    const z = zc + (b + out) * Math.sqrt(1 - k * k);
    const p = [u, sk.T - v * sk.H, z];
    const n = M.norm([u / ((a + out) ** 2), 0, (z - zc) / ((b + out) ** 2)]);
    return { p, n };
  }

  // Anillos del volumen de la cabeza (con desplazamiento para el pelo).
  function headSecs(f, sp, hm, v0 = 0.012, v1 = 1, off = 0, n = 16, backOnly = 0) {
    const sk = f.sk, x = f.xf('head'), dr = f.dir('head'), out = [];
    for (let i = 0; i <= n; i++) {
      const v = M.lerp(v0, v1, i / n);
      const a = hm.half(v), zf = hm.zf(v), zb = hm.zb(v);
      const zc = (zf + zb) / 2 - backOnly, b = (zf - zb) / 2;
      const c = x([0, sk.T - v * sk.H, zc]);
      out.push(SH.sec(sp, c, dr([1, 0, 0]), dr([0, 0, 1]), a + off, a + off, Math.max(0.01, b + off - backOnly), b + off));
    }
    return out;
  }

  function earVols(f, sp, rig, hm) {
    const sk = f.sk, x = f.xf('head'), dr = f.dir('head'), g = hm.g, out = [];
    const vc = (g.earTop + g.earBottom) / 2, h = (g.earBottom - g.earTop) * sk.H;
    for (const sg of [1, -1]) {
      const secs = [];
      for (let k = -1; k <= 1.001; k += 0.5) {
        const v = vc + (k * h) / 2 / sk.H, r = Math.sqrt(1 - k * k * 0.8);
        const c = x([sg * (hm.half(v) + 0.01), sk.T - v * sk.H, -0.06 - 0.02 * k]);
        secs.push(SH.sec(sp, c, dr([0, 0, 1]), dr([sg, 0, 0]), 0.075 * r, 0.06 * r, 0.035 * r, 0.02 * r));
      }
      out.push(V.fromSections(rig, secs, 10));
    }
    return out;
  }

  // Nariz: pequeña en anime (sólo se nota en perfil), con puente en realista.
  function noseVol(f, sp, rig, hm) {
    const sk = f.sk, x = f.xf('head'), dr = f.dir('head'), g = hm.g;
    const real = hm.style === 'realista', s = sk.params.s;
    const tipZ = (real ? HC.noseTip[0] : 0.47) + HC.femaleProfile.nose * s;
    const v0 = g.eye + 0.02, v1 = g.noseBase - 0.02;
    const secs = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4, v = M.lerp(v0, v1, t);
      const base = surf(sk, hm, 0, v).p;
      const z = M.lerp(base[2] - 0.01, tipZ, Math.pow(t, 1.4));
      const w = (real ? 0.05 : 0.03) + t * (real ? 0.05 : 0.035);
      secs.push(SH.sec(sp, x([0, base[1], z - w * 0.6]), dr([1, 0, 0]), dr([0, 0, 1]), w, w, w * 0.7, w * 0.7));
    }
    return V.fromSections(rig, secs, 10);
  }

  // ---------- Rasgos (5.2–5.7) ----------
  // Marco local de un rasgo: posición en pantalla, giro, escorzo (n_z) y visibilidad.
  function featureFrame(f, sp, rig, hm, u, v, out = 0) {
    const sk = f.sk, x = f.xf('head'), dr = f.dir('head');
    const q = surf(sk, hm, u, v, out);
    const P = V.proj(rig, sp.p(x(q.p)));
    const du = 0.02, dv = 0.02;
    const Pu = V.proj(rig, sp.p(x(surf(sk, hm, u + du, v, out).p))), Pd = V.proj(rig, sp.p(x(surf(sk, hm, u, v + dv, out).p)));
    const n = dr(q.n), N = V.proj(rig, sp.p(M.add(x(q.p), M.mul(n, 0.3))));
    const facing = (N.z - P.z) / (0.3 * sp.S);
    const sx = Math.hypot(Pu.x - P.x, Pu.y - P.y) / (du * sp.S);
    const ang = Math.atan2(Pd.y - P.y, Pd.x - P.x) - Math.PI / 2;
    return { x: P.x, y: P.y, fs: M.clamp(sx, 0, 1.05), ang, facing, dir: Math.sign(Pu.x - P.x) || 1 };
  }

  function withFrame(ctx, F, mirror, fn) {
    ctx.save();
    ctx.translate(F.x, F.y);
    ctx.rotate(F.ang);
    ctx.scale(Math.max(0.15, F.fs) * mirror * F.dir, 1);
    fn();
    ctx.restore();
  }

  const W8 = (w, k, d = 0) => (w[k] != null ? w[k] : d);

  // Ojo anime/realista en coordenadas locales (x+ = lado exterior, y+ = abajo).
  function drawEye(ctx, sk, hm, look, ew, eh, w, side, pix) {
    const U = SC.util;
    const s = sk.params.s, real = hm.style === 'realista';
    const openKey = side > 0 ? 'eye_open_L' : 'eye_open_R';
    const open = M.clamp(W8(w, openKey, W8(w, 'eye_open', 1)) * (1 - 0.55 * W8(w, 'eye_smile', 0)), 0, 1.25);
    const smile = W8(w, 'eye_smile', 0);
    const lineC = U.mix(U.shade(look.hair, -0.75), '#1d1420', 0.55);
    const lw = Math.max(1, ew * (real ? 0.07 : 0.11) * (pix ? 1.6 : 1));
    const hw = ew / 2, top = -eh * 0.55 * open, bot = eh * 0.45 * Math.min(1, open + 0.1) - smile * eh * 0.25;
    if (open < 0.12) {
      // Cerrado: arco (feliz hacia arriba, normal hacia abajo).
      SC.draw.stroke(ctx, lineC, lw, (q) => { q.moveTo(-hw, 0); q.quadraticCurveTo(0, smile > 0.3 ? -eh * 0.6 : eh * 0.35, hw, smile > 0.3 ? 0 : -eh * 0.05); });
      if (s > 0.5 && !pix) SC.draw.stroke(ctx, lineC, lw * 0.6, (q) => { q.moveTo(hw * 0.95, -eh * 0.02); q.lineTo(hw * 1.25, -eh * 0.18); });
      return;
    }
    const lift = real ? 0.08 : 0.12;
    const upper = (q) => { q.moveTo(-hw, eh * 0.05); q.bezierCurveTo(-hw * 0.6, top * 1.05, hw * 0.35, top * 1.1, hw, top * (0.25 + lift)); };
    const shape = (q) => {
      upper(q);
      q.bezierCurveTo(hw * 0.85, bot * 0.6, hw * 0.3, bot, -hw * 0.1, bot);
      q.bezierCurveTo(-hw * 0.6, bot, -hw * 0.95, eh * 0.35, -hw, eh * 0.05);
      q.closePath();
    };
    // Blanco del ojo.
    SC.draw.fill(ctx, '#fbf7fb', shape);
    ctx.save();
    ctx.beginPath(); shape(ctx); ctx.clip();
    // Iris con degradado (oscuro arriba), pupila, anillo y brillos.
    const look2 = W8(w, 'look', 0) * hw * 0.35 * side;
    const ir = real ? eh * 0.55 : eh * 0.62, iry = ir * (real ? 1 : 1.12), ix = look2 + hw * 0.05, iy = (top + bot) / 2 + eh * 0.04;
    const iris = look.eyes;
    const g = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
    g.addColorStop(0, U.shade(iris, -0.55)); g.addColorStop(0.55, iris); g.addColorStop(1, U.shade(iris, 0.35));
    ctx.fillStyle = g;
    ctx.beginPath(); SC.draw.ellipse(ctx, ix, iy, ir, iry); ctx.fill();
    SC.draw.stroke(ctx, U.shade(iris, -0.6), lw * 0.45, (q) => SC.draw.ellipse(q, ix, iy, ir, iry));
    SC.draw.fill(ctx, U.shade(iris, -0.75), (q) => SC.draw.ellipse(q, ix, iy + iry * 0.05, ir * 0.42, iry * 0.48));
    // Sombra del párpado sobre el ojo.
    ctx.globalAlpha = 0.35;
    SC.draw.fill(ctx, U.shade(look.skin, -0.45), (q) => { q.rect(-hw * 1.2, top - eh, hw * 2.4, eh * 1.0 + eh * 0.28); });
    ctx.globalAlpha = 1;
    SC.draw.fill(ctx, '#ffffff', (q) => SC.draw.ellipse(q, ix - ir * 0.32, iy - iry * 0.38, ir * 0.3, iry * 0.24));
    if (!pix) SC.draw.fill(ctx, 'rgba(255,255,255,0.8)', (q) => SC.draw.ellipse(q, ix + ir * 0.35, iy + iry * 0.42, ir * 0.14, iry * 0.1));
    ctx.restore();
    // Párpado superior grueso con rabillo; pestañas en mujer; inferior fino.
    SC.draw.stroke(ctx, lineC, lw * 1.35, upper);
    if (s > 0.5) {
      SC.draw.stroke(ctx, lineC, lw, (q) => { q.moveTo(hw * 0.9, top * (0.25 + lift)); q.lineTo(hw * 1.28, top * (0.25 + lift) - eh * 0.2); });
      if (!pix) SC.draw.stroke(ctx, lineC, lw * 0.7, (q) => { q.moveTo(hw * 0.62, top * 0.85); q.lineTo(hw * 0.86, top * 1.25); });
    }
    SC.draw.stroke(ctx, U.rgba(lineC, 0.7), lw * 0.55, (q) => { q.moveTo(hw * 0.75, bot * 0.7); q.bezierCurveTo(hw * 0.35, bot * 1.02, -hw * 0.2, bot * 1.02, -hw * 0.55, bot * 0.8); });
    // Pliegue del párpado.
    if (!pix && (real || s > 0.5)) SC.draw.stroke(ctx, U.rgba(U.shade(look.skin, -0.45), 0.8), lw * 0.45, (q) => { q.moveTo(-hw * 0.5, top * 1.35); q.quadraticCurveTo(0, top * 1.6, hw * 0.7, top * 1.2); });
  }

  function drawBrow(ctx, hm, look, ew, w, side) {
    const U = SC.util;
    const up = W8(w, 'brow_up', 0), frown = W8(w, 'brow_frown', 0), sad = W8(w, 'brow_sad', 0);
    const hw = ew * 0.62, th = Math.max(1, hm.browThick * 2.2);
    const inner = -up * ew * 0.25 + frown * ew * 0.18 - sad * ew * 0.3;
    const outer = -up * ew * 0.25 - frown * ew * 0.12 + sad * ew * 0.1;
    const arch = -ew * (0.08 + hm.browLift * 2 + 0.06 * (1 - frown));
    const smirk = W8(w, 'smirk', 0) * (side > 0 ? -ew * 0.12 : 0);
    const col = U.shade(look.hair, -0.35);
    ctx.lineCap = 'round';
    SC.draw.stroke(ctx, col, th, (q) => { q.moveTo(-hw, inner); q.quadraticCurveTo(0, arch + (inner + outer) / 2 + smirk, hw, outer + ew * 0.05 + smirk); });
  }

  function drawMouth(ctx, sk, hm, look, w, pix) {
    const U = SC.util;
    const mw = hm.mouthW * 0.5 * (1 + 0.25 * W8(w, 'mouth_wide', 0)), open = W8(w, 'mouth_open', 0);
    const smile = W8(w, 'mouth_smile', 0) - W8(w, 'mouth_frown', 0), smirk = W8(w, 'smirk', 0);
    const lc = U.shade(look.skin, -0.62), lw = Math.max(1, mw * (pix ? 0.3 : 0.14));
    const cy = -smile * mw * 0.35, sm = smirk * mw * 0.25;
    if (open > 0.08) {
      const h = open * mw * 0.9;
      const shape = (q) => { q.moveTo(-mw, cy); q.quadraticCurveTo(0, cy - h * 0.2 + smile * mw * 0.2, mw, cy - sm); q.quadraticCurveTo(0, cy + h + smile * mw * 0.2, -mw, cy); q.closePath(); };
      SC.draw.fill(ctx, '#6d2530', shape);
      ctx.save(); ctx.beginPath(); shape(ctx); ctx.clip();
      SC.draw.fill(ctx, '#e0707e', (q) => SC.draw.ellipse(q, 0, cy + h * 0.85, mw * 0.55, h * 0.4));
      if (smile > 0.3) SC.draw.fill(ctx, '#ffffff', (q) => q.rect(-mw * 0.7, cy - h * 0.3, mw * 1.4, h * 0.28));
      ctx.restore();
      SC.draw.stroke(ctx, lc, lw * 0.8, shape);
      return;
    }
    SC.draw.stroke(ctx, lc, lw, (q) => { q.moveTo(-mw, cy - smile * mw * 0.1); q.quadraticCurveTo(0, cy + smile * mw * 0.55, mw, cy - smile * mw * 0.1 - sm); });
    // Labio inferior insinuado (más lleno en mujer).
    if (!pix && hm.style !== 'chibi') {
      ctx.globalAlpha = 0.45 + 0.3 * sk.params.s;
      SC.draw.stroke(ctx, U.shade(look.skin, -0.3), lw * 0.7, (q) => { q.moveTo(-mw * 0.4, cy + hm.lipH * 1.4); q.quadraticCurveTo(0, cy + hm.lipH * 2.2, mw * 0.4, cy + hm.lipH * 1.4); });
      ctx.globalAlpha = 1;
    }
  }

  // Cara completa: rubor, ojos, cejas, nariz y boca sobre sus líneas guía.
  function drawFace(ctx, f, sp, rig, hm, look, w) {
    const U = SC.util, sk = f.sk, g = hm.g, S = sp.S, pix = !!rig.pixel;
    const ew = hm.ew * S * (pix ? 1.25 : 1), eh = hm.eyeH * S * (pix ? 1.2 : 1);
    const blush = W8(w, 'blush', 0) + (sk.params.s > 0.5 ? 0.25 : 0.1);
    for (const side of [1, -1]) {
      const F = featureFrame(f, sp, rig, hm, side * hm.ew * 1.35, g.eye + 0.1);
      if (F.facing < 0.1) continue;
      ctx.save(); ctx.globalAlpha = M.clamp(blush, 0, 1) * 0.45;
      withFrame(ctx, F, 1, () => SC.draw.fill(ctx, '#ff7a8a', (q) => SC.draw.ellipse(q, 0, 0, ew * 0.75, ew * 0.28)));
      ctx.restore();
    }
    for (const side of [1, -1]) {
      const F = featureFrame(f, sp, rig, hm, side * hm.ew, g.eye);
      if (F.facing < 0.05) continue;
      withFrame(ctx, F, side, () => drawEye(ctx, sk, hm, look, ew, eh, w, side, pix));
      const B = featureFrame(f, sp, rig, hm, side * hm.ew * 1.05, g.brow - hm.browLift, 0.005);
      if (B.facing > 0.05) withFrame(ctx, B, side, () => drawBrow(ctx, hm, look, ew, w, side));
    }
    // Nariz: sombra de la punta (anime) o puente y aletas (realista).
    const N = featureFrame(f, sp, rig, hm, 0, g.noseBase - 0.02, 0.02);
    if (N.facing > -0.2 && !pix) {
      const col = U.shade(look.skin, -0.4), nw = hm.noseW * S * 0.5;
      withFrame(ctx, N, 1, () => {
        if (hm.style === 'realista') {
          SC.draw.stroke(ctx, U.rgba(col, 0.7), Math.max(1, nw * 0.08), (q) => { q.moveTo(-nw * 0.6, 0); q.quadraticCurveTo(-nw * 0.2, nw * 0.25, 0, nw * 0.12); q.quadraticCurveTo(nw * 0.2, nw * 0.25, nw * 0.6, 0); });
        } else {
          SC.draw.fill(ctx, U.rgba(col, 0.55), (q) => { q.moveTo(nw * 0.05, -nw * 0.35); q.lineTo(nw * 0.28, nw * 0.1); q.lineTo(-nw * 0.1, nw * 0.12); q.closePath(); });
        }
      });
    }
    const Mo = featureFrame(f, sp, rig, hm, 0, g.mouth, 0.01);
    if (Mo.facing > -0.1) withFrame(ctx, Mo, 1, () => drawMouth(ctx, sk, hm, look, w, pix));
  }

  // ---------- Pelo paramétrico ----------
  // Cada peinado: grosor, casco hasta la línea del pelo, masa trasera hasta la
  // nuca, flequillo (mechones afilados), mechones laterales, melena larga y colas.
  const HAIR = {
    corto: { name: 'Corto', t: 0.07, nape: 0.8, bangs: 6, bangLen: -0.02, side: 0.7 },
    bob: { name: 'Media melena', t: 0.08, nape: 1.0, bangs: 7, bangLen: 0.02, side: 1.02, flare: 0.08 },
    largo: { name: 'Largo', t: 0.08, nape: 0.98, bangs: 7, bangLen: 0.03, side: 1.0, long: 0.62 },
    coleta: { name: 'Coleta', t: 0.05, nape: 0.8, bangs: 5, bangLen: -0.01, side: 0.8, tails: [[0, 0.3, 'back']] },
    coletas: { name: 'Coletas', t: 0.06, nape: 0.82, bangs: 6, bangLen: 0.01, side: 0.85, tails: [[1, 0.28, 'side'], [-1, 0.28, 'side']] },
    mono: { name: 'Moño', t: 0.05, nape: 0.78, bangs: 5, bangLen: -0.02, side: 0.75, bun: true },
    rapado: { name: 'Rapado', t: 0.02, nape: 0.76, bangs: 0, side: 0 },
  };

  function hairItems(f, sp, rig, hm, look, styleId, fill) {
    const st = HAIR[styleId] || HAIR.corto, sk = f.sk, g = hm.g, x = f.xf('head'), dr = f.dir('head');
    const col = look.hair, items = { back: [], cap: [], front: [] };
    const t = st.t;
    // Casco sobre el cráneo hasta la línea del pelo.
    items.cap.push(V.fromSections(rig, headSecs(f, sp, hm, 0.012, g.hairline + 0.03, t, 8), 18));
    // Masa trasera (queda detrás de la cara): del cráneo a la nuca.
    const backSecs = [];
    for (let i = 0; i <= 8; i++) {
      const v = M.lerp(0.1, st.nape, i / 8), a = hm.half(v), zf = hm.zf(v), zb = hm.zb(v);
      const fl = (st.flare || 0) * Math.max(0, (v - 0.5) / 0.5);
      const c = x([0, sk.T - v * sk.H, (zf + zb) / 2 - 0.08]);
      const b = (zf - zb) / 2;
      backSecs.push(SH.sec(sp, c, dr([1, 0, 0]), dr([0, 0, 1]), a + t + fl, a + t + fl, Math.max(0.05, b - 0.05), b + t + fl * 0.5));
    }
    items.back.push(V.fromSections(rig, backSecs, 18));
    // Melena larga por la espalda (sigue al pecho).
    if (st.long) {
      const secs = [], prof = SH.torsoProfile(sk), yTop = sk.T - st.nape * sk.H + 0.05;
      const yEnd = sk.yT(st.long);
      for (let i = 0; i <= 8; i++) {
        const y = M.lerp(yTop, yEnd, i / 8), tau = M.clamp((sk.T - sk.H - y) / sk.Ltorso, 0, 1);
        const r = tau > 0 ? prof.at(tau) : { half: sk.w.neck / 2, back: 0.25, zc: -0.08 };
        // Más ancha que el cuello: asoma a los lados de los hombros vista de frente.
        const wHalf = M.lerp(hm.half(0.8) + t + 0.08, Math.max(r.half * 0.92, sk.w.shoulders * 0.36), Math.min(1, i / 3)) * (i === 8 ? 0.85 : 1);
        const W = i < 2 ? { head: 1 } : SH.torsoWeights(tau);
        const q = SH.blendXf(f, W, [0, y, r.zc - r.back - 0.06], [[1, 0, 0], [0, 0, 1]]);
        secs.push(SH.sec(sp, q.p, q.axes[0], q.axes[1], wHalf, wHalf, 0.06, 0.1));
      }
      items.back.push(V.fromSections(rig, secs, 14));
    }
    // Colas (coleta y coletas) y moño.
    for (const [side, v0, kind] of st.tails || []) {
      const start = kind === 'back' ? surf(sk, hm, 0, v0, t) : surf(sk, hm, side * hm.half(v0) * 0.9, v0, t);
      const p0 = x(start.p);
      const outDir = kind === 'back' ? dr([0, 0, -1]) : dr([side, 0, -0.2]);
      const len = kind === 'back' ? 2.1 : 2.3;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push(M.add(M.add(p0, M.mul(outDir, 0.25 * Math.sin(Math.min(1, u * 2) * Math.PI / 2) + 0.05 * u)), [0, -len * u * sk.H * 0.9, -0.05 * u]));
      }
      const r = (u) => (0.14 + 0.1 * Math.sin(Math.min(1, u * 1.3) * Math.PI) - 0.12 * u) * sp.S;
      const vol = V.tube(rig, pts.map(sp.p), (u) => Math.max(0.02 * sp.S, r(u)), 0.8, 12);
      const tie = V.tube(rig, pts.slice(0, 2).map(sp.p), 0.09 * sp.S, 1, 10);
      items.back.push(vol);
      items.ties = (items.ties || []).concat([tie]);
    }
    if (st.bun) {
      const q = surf(sk, hm, 0, 0.18, t);
      const c = x(M.add(q.p, [0, 0.08, -0.12]));
      const secs = [-1, -0.5, 0, 0.5, 1].map((k) => SH.sec(sp, M.add(c, [0, k * 0.2, 0]), dr([1, 0, 0]), dr([0, 0, 1]), 0.24 * Math.sqrt(1 - k * k * 0.9), 0.24 * Math.sqrt(1 - k * k * 0.9), 0.22 * Math.sqrt(1 - k * k * 0.9), 0.22 * Math.sqrt(1 - k * k * 0.9)));
      items.back.push(V.fromSections(rig, secs, 14));
    }
    // Flequillo: mechones afilados de la línea del pelo a las cejas, sobre la frente.
    const nb = st.bangs;
    for (let i = 0; i < nb; i++) {
      const k = nb === 1 ? 0 : (i / (nb - 1)) * 2 - 1;
      const u0 = k * hm.half(g.hairline) * 0.85, u1 = k * hm.half(g.brow) * (0.95 + 0.05 * Math.abs(k));
      // El flequillo acaba por encima de los ojos para no taparlos.
      const vEnd = Math.min(g.brow + st.bangLen, g.eye - hm.eyeH * 0.62) - 0.04 * Math.abs(k) + (i % 2 ? 0.02 : 0);
      const pts = [];
      for (let j = 0; j <= 5; j++) {
        const u = j / 5, v = M.lerp(g.hairline - 0.12, vEnd, u);
        pts.push(x(surf(sk, hm, M.lerp(u0, u1, u) + k * 0.02 * Math.sin(u * Math.PI), v, t * (1 - 0.5 * u) + 0.01).p));
      }
      const wB = (hm.half(g.brow) * 2) / nb * 0.75;
      items.front.push(V.tube(rig, pts.map(sp.p), (u) => Math.max(0.01, wB * (1 - u) ** 0.8) * sp.S, 0.35, 8));
    }
    // Mechones laterales delante de las orejas.
    if (st.side) {
      for (const sg of [1, -1]) {
        const pts = [];
        const vEnd = st.side;
        for (let j = 0; j <= 6; j++) {
          const u = j / 6, v = M.lerp(0.3, Math.min(0.99, vEnd), u);
          const vv = Math.min(v, 0.9);
          const q = surf(sk, hm, sg * (hm.half(vv) + t * 0.6), vv, t * 0.8);
          if (v > 0.9) q.p[1] -= (v - 0.9) * sk.H;
          pts.push(x(M.add(q.p, [0, 0, 0.02])));
        }
        if (st.sideLong) {
          const last = pts[pts.length - 1];
          for (let j = 1; j <= 3; j++) pts.push(M.add(last, [sg * 0.05 * j, -0.35 * j, 0.1 * j]));
        }
        items.front.push(V.tube(rig, pts.map(sp.p), (u) => ((st.sideLong ? 0.13 : 0.085) * (1 - u * 0.7)) * sp.S, 0.45, 10));
      }
    }
    return {
      back: (ctx) => { for (const v of items.back) fill(ctx, v, col, 'hair'); for (const v of items.ties || []) fill(ctx, v, look.tie || '#e0445e', 'cloth'); },
      cap: (ctx) => { for (const v of items.cap) fill(ctx, v, col, 'hair'); },
      front: (ctx) => { for (const v of items.front) fill(ctx, v, col, 'hair'); },
      backZ: items.back.length ? items.back[0].z : -1e9,
      hasTails: !!(st.tails || st.long || st.bun),
    };
  }

  return { measure, surf, headSecs, earVols, noseVol, featureFrame, drawFace, hairItems, HAIR };
})();
