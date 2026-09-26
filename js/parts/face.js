// Rasgos faciales: ojos (varios estilos anime), cejas, nariz, boca y rubor.
//
// Cada rasgo se coloca en un punto de la superficie 3D de la cabeza y se dibuja
// en un marco local que se escorza (foreshortening) al girar: en 3/4 el ojo
// lejano se estrecha y en perfil sólo se ve el cercano.
(() => {
  const U = SC.util, V = SC.V, D = SC.draw;

  // Marco local de un punto de la cara: posición, rotación y escorzo horizontal.
  function frame(rig, Hd, level, phi, out = 0) {
    const s = Hd.at(level), p = V.surf(s, phi, out), q = V.proj(rig, p);
    const dp = 0.05;
    const pa = V.proj(rig, V.surf(Hd.at(level), phi - dp, out)), pb = V.proj(rig, V.surf(Hd.at(level), phi + dp, out));
    const va = V.proj(rig, V.surf(Hd.at(level - 0.03), phi, out)), vb = V.proj(rig, V.surf(Hd.at(level + 0.03), phi, out));
    const r = SC.vec.len(SC.vec.sub(p, s.c)) || 1;
    const fs = U.clamp(Math.hypot(pb.x - pa.x, pb.y - pa.y) / (2 * dp * r), 0, 1.05);
    const ang = Math.atan2(vb.y - va.y, vb.x - va.x) - Math.PI / 2;
    return { x: q.x, y: q.y, fs, ang, facing: V.facing(rig, s, p), dir: Math.sign(pb.x - pa.x) || 1 };
  }

  function withFrame(ctx, f, mirror, fn) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);
    ctx.scale(Math.max(0.12, f.fs) * mirror * f.dir, 1);
    fn();
    ctx.restore();
  }

  function cubicPts(p0, p1, p2, p3, n = 16) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, m = 1 - t;
      out.push({
        x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
        y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
      });
    }
    return out;
  }

  // ---------- Estilos de ojos ----------
  // size: tamaño, h: alto, lift: esquina exterior (+arriba), drop: esquina interior,
  // peak: dónde está el punto alto del párpado (-interior, +exterior), lash: grosor
  // de la línea superior, wing: rabillo, lashes: pestañas sueltas, lower: pestaña inferior,
  // iris: radio del iris, aspect: iris ovalado, pupil: tamaño/forma, hl: brillos,
  // crease: pliegue del párpado, ring: anillo interior, cover: párpado caído.
  const STYLES = {
    shoujo: { name: 'Shōjo', size: 1.22, h: 1.3, lift: 0.1, drop: 0.12, peak: 0.1, lash: 2.6, wing: 0.35, lashes: 3, lower: 0.8, iris: 0.72, aspect: 1.2, pupil: 0.42, hl: 3, crease: true, ring: true },
    shonen: { name: 'Shōnen', size: 1.0, h: 0.95, lift: 0.2, drop: 0.08, peak: 0.35, lash: 1.9, wing: 0.12, lashes: 0, lower: 0.35, iris: 0.56, aspect: 1.1, pupil: 0.4, hl: 1, angular: true },
    tsurime: { name: 'Tsurime (rasgados)', size: 1.05, h: 0.85, lift: 0.6, drop: 0.2, peak: 0.45, lash: 2.3, wing: 0.3, lashes: 1, lower: 0.4, iris: 0.6, aspect: 1.1, pupil: 0.4, hl: 2, crease: false },
    tareme: { name: 'Tareme (caídos)', size: 1.12, h: 1.05, lift: -0.4, drop: -0.05, peak: -0.35, lash: 2.1, wing: 0.18, lashes: 1, lower: 0.6, iris: 0.66, aspect: 1.15, pupil: 0.44, hl: 2, crease: true },
    jitome: { name: 'Jitome (entornados)', size: 1.05, h: 1.0, lift: 0.05, drop: 0.05, peak: 0, lash: 2.3, wing: 0.1, lashes: 0, lower: 0.45, iris: 0.62, aspect: 1.1, pupil: 0.4, hl: 1, cover: 0.45 },
    sanpaku: { name: 'Sanpaku', size: 1.0, h: 1.0, lift: 0.15, drop: 0.1, peak: 0.2, lash: 1.8, wing: 0.1, lashes: 0, lower: 0.55, iris: 0.4, aspect: 1.0, irisY: -0.25, pupil: 0.35, hl: 1 },
    seinen: { name: 'Seinen (realista)', size: 0.8, h: 0.62, lift: 0.08, drop: 0.12, peak: 0.1, lash: 1.5, wing: 0.05, lashes: 0, lower: 0.45, iris: 0.46, aspect: 1.0, pupil: 0.38, hl: 1, crease: true, duct: true },
    kawaii: { name: 'Kawaii (grandes)', size: 1.38, h: 1.45, lift: 0.0, drop: 0.1, peak: 0, lash: 2.3, wing: 0.15, lashes: 2, lower: 0.5, iris: 0.8, aspect: 1.15, pupil: 0.46, hl: 3, ring: true },
    felino: { name: 'Felino', size: 1.08, h: 0.95, lift: 0.5, drop: 0.2, peak: 0.4, lash: 2.2, wing: 0.3, lashes: 1, lower: 0.4, iris: 0.72, aspect: 1.1, pupil: 0.8, slit: true, hl: 2 },
    kitsune: { name: 'Kitsune (afilados)', size: 1.0, h: 0.55, lift: 0.55, drop: 0.25, peak: 0.5, lash: 2.4, wing: 0.4, lashes: 0, lower: 0.3, iris: 0.66, aspect: 1.0, pupil: 0.4, hl: 1 },
    puntos: { name: 'Puntos', dots: true, size: 1 },
  };

  function eyeState(rig, sideSign) {
    if (rig.pose.blink) return 'closed';
    const st = rig.expr.eyes;
    if (st === 'wink') return sideSign > 0 ? 'happy' : 'open';
    return st;
  }

  function arc(ctx, rig, ew, eh, up, col) {
    D.stroke(ctx, col, rig.line * (rig.detail === 'high' ? 1.7 : 1.5), (q) => {
      q.moveTo(-ew, 0);
      q.quadraticCurveTo(0, up ? -eh * 1.3 : eh * 0.8, ew, up ? 0 : -eh * 0.1);
    });
  }

  // Dibuja un ojo en coordenadas locales (x+ = lado exterior, y+ = abajo).
  function drawEye(ctx, rig, st, state, c, ew, eh) {
    const dark = U.mix(U.shade(rig.hairColor || '#3a2a2a', -0.7), '#1c1422', 0.5);
    if (state === 'closed') return arc(ctx, rig, ew, eh, false, dark);
    if (state === 'happy') return arc(ctx, rig, ew, eh, true, dark);
    const look = state === 'side' ? ew * 0.28 : 0;

    if (st.dots || rig.detail !== 'high') {
      const k = { wide: 1.15, half: 0.55, narrow: 0.6, narrowSoft: 0.75 }[state] || 1;
      const rx = st.dots ? ew * 0.36 : ew * 0.55, ry = (st.dots ? ew * 0.52 : Math.max(ew * 0.8, eh * 0.9)) * k;
      D.fill(ctx, dark, (q) => D.ellipse(q, look, eh * 0.1, rx, ry));
      if (!st.dots) D.fill(ctx, c.iris, (q) => D.ellipse(q, look, eh * 0.1 + ry * 0.4, rx * 0.75, ry * 0.45));
      if (rig.detail === 'high') D.fill(ctx, '#fff', (q) => D.ellipse(q, look - rx * 0.3, -ry * 0.3, rx * 0.35, rx * 0.35));
      return;
    }

    const open = { open: 1, wide: 1.15, half: 1, narrow: 1, narrowSoft: 1, side: 0.95 }[state] || 1;
    const cover = U.clamp((st.cover || 0) + { half: 0.45, narrow: 0.35, narrowSoft: 0.2 }[state] || 0, 0, 0.8) + (st.cover && state === 'half' ? 0 : 0);
    const angry = state === 'narrow';
    const I = { x: -ew, y: st.drop * eh + (angry ? eh * 0.1 : 0) };
    const O = { x: ew, y: -st.lift * eh };
    const topY = -eh * 1.3 * open * (1 - cover);
    const upper = [I,
      { x: -ew * (0.55 - 0.3 * st.peak), y: topY + (angry ? eh * 0.45 : 0) + I.y * 0.5 },
      { x: ew * (0.45 + 0.3 * st.peak), y: topY * (st.angular ? 1.08 : 1) + O.y * 0.5 },
      O];
    const lower = [O, { x: ew * 0.5, y: eh * 1.05 + O.y * 0.3 }, { x: -ew * 0.45, y: eh * 1.1 + I.y * 0.3 }, I];
    const shape = (q) => {
      q.moveTo(I.x, I.y);
      q.bezierCurveTo(upper[1].x, upper[1].y, upper[2].x, upper[2].y, O.x, O.y);
      q.bezierCurveTo(lower[1].x, lower[1].y, lower[2].x, lower[2].y, I.x, I.y);
      q.closePath();
    };

    // Blanco del ojo
    D.fill(ctx, '#fbfbff', shape);
    ctx.save();
    ctx.beginPath(); shape(ctx); ctx.clip();
    const rx = ew * st.iris * (state === 'wide' ? 0.82 : 1);
    const ry = rx * st.aspect;
    const ix = look + ew * 0.02, iy = eh * (0.1 + (st.irisY || 0));
    const g = ctx.createLinearGradient(0, iy - ry, 0, iy + ry);
    g.addColorStop(0, U.shade(c.iris, -0.62));
    g.addColorStop(0.5, c.iris);
    g.addColorStop(1, U.shade(c.iris, 0.42));
    ctx.fillStyle = g;
    ctx.beginPath(); D.ellipse(ctx, ix, iy, rx, ry); ctx.fill();
    if (st.ring) D.stroke(ctx, U.rgba(U.shade(c.iris, 0.5), 0.55), rx * 0.12, (q) => D.ellipse(q, ix, iy + ry * 0.1, rx * 0.66, ry * 0.66));
    D.stroke(ctx, U.shade(c.iris, -0.65), rig.line * 0.7, (q) => D.ellipse(q, ix, iy, rx, ry));
    // Pupila
    const pc = U.shade(c.iris, -0.8);
    if (st.slit) D.fill(ctx, pc, (q) => D.ellipse(q, ix, iy, rx * 0.16, ry * st.pupil));
    else D.fill(ctx, pc, (q) => D.ellipse(q, ix, iy + ry * 0.05, rx * st.pupil, ry * st.pupil));
    // Sombra del párpado superior
    D.stroke(ctx, 'rgba(50,20,70,0.22)', eh * 0.55, (q) => {
      q.moveTo(I.x, I.y);
      q.bezierCurveTo(upper[1].x, upper[1].y, upper[2].x, upper[2].y, O.x, O.y);
    });
    // Brillos
    D.fill(ctx, '#ffffff', (q) => D.ellipse(q, ix - rx * 0.38, iy - ry * 0.38, rx * 0.3, ry * 0.22, -0.4));
    if (st.hl > 1) D.fill(ctx, '#ffffff', (q) => D.ellipse(q, ix + rx * 0.38, iy + ry * 0.42, rx * 0.14, rx * 0.14));
    if (st.hl > 2) D.fill(ctx, 'rgba(255,255,255,0.8)', (q) => D.ellipse(q, ix + rx * 0.05, iy + ry * 0.62, rx * 0.22, ry * 0.08));
    ctx.restore();

    // Línea superior con grosor variable (más gruesa hacia el exterior) y rabillo
    const up = cubicPts(I, upper[1], upper[2], O, 18);
    const thick = (t) => rig.line * st.lash * (0.3 + 0.7 * Math.pow(t, 0.8)) * (rig.fem ? 1 : 0.75);
    const topEdge = up.map((p, i) => {
      const t = i / (up.length - 1);
      const a = up[Math.max(0, i - 1)], b = up[Math.min(up.length - 1, i + 1)];
      let nx = b.y - a.y, ny = -(b.x - a.x);
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      if (ny > 0) { nx = -nx; ny = -ny; }
      return { x: p.x + nx * thick(t), y: p.y + ny * thick(t) };
    });
    const wingLen = st.wing * ew * (rig.fem ? 1 : 0.6);
    ctx.beginPath();
    ctx.moveTo(up[0].x, up[0].y);
    for (const p of up) ctx.lineTo(p.x, p.y);
    if (wingLen > 0) ctx.lineTo(O.x + wingLen, O.y - wingLen * 0.55 - st.lift * eh * 0.2);
    for (let i = topEdge.length - 1; i >= 0; i--) ctx.lineTo(topEdge[i].x, topEdge[i].y);
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();
    // Pestañas sueltas
    const nl = rig.fem ? st.lashes : Math.min(st.lashes, 0);
    for (let i = 0; i < nl; i++) {
      const t = 0.72 + i * 0.1, p = topEdge[Math.round(t * (topEdge.length - 1))];
      D.stroke(ctx, dark, rig.line * 0.8, (q) => {
        q.moveTo(p.x, p.y);
        q.quadraticCurveTo(p.x + ew * 0.12, p.y - eh * 0.25, p.x + ew * 0.28, p.y - eh * 0.28 + i * eh * 0.08);
      });
    }
    // Línea inferior
    const lo = cubicPts(O, lower[1], lower[2], I, 14);
    D.stroke(ctx, U.rgba(dark, 0.35 + 0.5 * st.lower), rig.line * (0.5 + 0.5 * st.lower), (q) => {
      q.moveTo(lo[1].x, lo[1].y);
      for (let i = 2; i < 8; i++) q.lineTo(lo[i].x, lo[i].y);
    });
    // Pliegue del párpado
    if (st.crease) {
      D.stroke(ctx, U.rgba(dark, 0.45), rig.line * 0.55, (q) => {
        for (let i = 4; i < up.length - 2; i++) {
          const p = up[i];
          if (i === 4) q.moveTo(p.x, p.y - eh * 0.42); else q.lineTo(p.x, p.y - eh * 0.42 - (i / up.length) * eh * 0.05);
        }
      });
    }
    if (st.duct) D.fill(ctx, 'rgba(220,120,130,0.6)', (q) => D.ellipse(q, I.x + ew * 0.06, I.y + eh * 0.05, ew * 0.06, eh * 0.12));
  }

  // ---------- Cejas, nariz, boca y rubor ----------
  function drawBrow(ctx, rig, c, ew, eh, kind, sideSign) {
    const col = U.shade(rig.hairColor || '#4a3226', -0.3);
    const fem = rig.fem;
    let inner = 0, outer = 0, lift = 0;
    if (kind === 'raised') lift = eh * 0.35;
    if (kind === 'angry') { inner = eh * 0.55; outer = -eh * 0.15; }
    if (kind === 'sad') { inner = -eh * 0.45; outer = eh * 0.15; }
    if (kind === 'low') { inner = eh * 0.2; lift = -eh * 0.1; }
    if (kind === 'tilt' && sideSign > 0) lift = eh * 0.4;
    const th0 = ew * (fem ? 0.13 : 0.22), th1 = ew * (fem ? 0.04 : 0.1);
    const arch = eh * (fem ? 0.45 : 0.18);
    const x0 = -ew * 0.95, x1 = ew * 1.1;
    const y0 = inner - lift, y1 = outer - lift + eh * (fem ? 0.2 : 0.05);
    const mid = { x: ew * 0.25, y: (y0 + y1) / 2 - arch };
    ctx.beginPath();
    ctx.moveTo(x0, y0 - th0 / 2);
    ctx.quadraticCurveTo(mid.x, mid.y - th0 * 0.4, x1, y1);
    ctx.quadraticCurveTo(mid.x, mid.y + th0 * 0.6, x0, y0 + th0 / 2);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    void th1;
  }

  function drawMouth(ctx, rig, c, mw, kind) {
    const line = SC.draw.lineColor(rig, c.skin);
    const inside = '#7a2a35', lw = rig.line * 1.05;
    const stroke = (b, w = lw) => D.stroke(ctx, line, w, b);
    const filled = (b, teeth) => {
      ctx.beginPath(); b(ctx); ctx.closePath();
      ctx.fillStyle = inside; ctx.fill();
      if (teeth && rig.detail === 'high') {
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#fff'; ctx.fillRect(-mw * 2, -mw, mw * 4, mw * 0.72);
        D.fill(ctx, '#e46a7a', (q) => D.ellipse(q, 0, mw * 0.75, mw * 0.55, mw * 0.3));
        ctx.restore();
        ctx.beginPath(); b(ctx); ctx.closePath();
      }
      ctx.lineWidth = rig.line; ctx.strokeStyle = line; ctx.stroke();
    };
    switch (kind) {
      case 'smile': stroke((q) => { q.moveTo(-mw, -mw * 0.15); q.quadraticCurveTo(0, mw * 0.55, mw, -mw * 0.15); }); break;
      case 'smirk': stroke((q) => { q.moveTo(-mw * 0.7, mw * 0.05); q.quadraticCurveTo(mw * 0.2, mw * 0.2, mw * 0.8, -mw * 0.25); }); break;
      case 'grin': filled((q) => { q.moveTo(-mw * 1.1, -mw * 0.25); q.quadraticCurveTo(0, -mw * 0.1, mw * 1.1, -mw * 0.25); q.quadraticCurveTo(0, mw * 1.3, -mw * 1.1, -mw * 0.25); }, true); break;
      case 'frown': stroke((q) => { q.moveTo(-mw * 0.8, mw * 0.25); q.quadraticCurveTo(0, -mw * 0.35, mw * 0.8, mw * 0.25); }); break;
      case 'angry': filled((q) => { q.moveTo(-mw * 0.9, mw * 0.3); q.quadraticCurveTo(0, -mw * 0.4, mw * 0.9, mw * 0.3); q.quadraticCurveTo(0, mw * 0.15, -mw * 0.9, mw * 0.3); }, true); break;
      case 'o': filled((q) => D.ellipse(q, 0, mw * 0.1, mw * 0.4, mw * 0.55)); break;
      case 'talkA': filled((q) => D.ellipse(q, 0, mw * 0.1, mw * 0.65, mw * 0.5), true); break;
      case 'talkB': filled((q) => D.ellipse(q, 0, mw * 0.05, mw * 0.5, mw * 0.22)); break;
      case 'wavy': stroke((q) => { q.moveTo(-mw * 0.9, 0); for (let i = 1; i <= 4; i++) q.lineTo(-mw * 0.9 + i * mw * 0.45, i % 2 ? -mw * 0.18 : mw * 0.18); }); break;
      case 'flat': stroke((q) => { q.moveTo(-mw * 0.55, mw * 0.03); q.lineTo(mw * 0.55, -mw * 0.03); }); break;
      default: stroke((q) => { q.moveTo(-mw * 0.6, 0); q.quadraticCurveTo(0, mw * 0.18, mw * 0.6, 0); });
    }
    // Labio inferior insinuado
    if (rig.detail === 'high' && !/grin|angry|o|talk/.test(kind)) {
      D.stroke(ctx, U.rgba(U.shade(c.skin, -0.35), rig.fem ? 0.7 : 0.4), rig.line * 0.6, (q) => {
        q.moveTo(-mw * 0.3, mw * 0.55); q.quadraticCurveTo(0, mw * 0.68, mw * 0.3, mw * 0.55);
      });
    }
  }

  function drawFeatures(ctx, rig, c, Hd) {
    const F = rig.face, e = rig.expr, H = rig.head;
    c = Object.assign({ skin: rig.skinColor }, c);
    const ew = H.w * (0.27 + 0.08 * rig.chibi);
    // Rubor
    if (e.blush > 0) {
      for (const s of [-1, 1]) {
        const f = frame(rig, Hd, F.eye + 0.13, s * (F.eyePhi + 0.1));
        if (f.facing < 0.05) continue;
        ctx.save();
        ctx.globalAlpha = rig.detail === 'high' ? 0.3 * e.blush + 0.1 : 0.6;
        withFrame(ctx, f, 1, () => D.fill(ctx, '#ff6f86', (q) => D.ellipse(q, 0, 0, ew * 0.8, ew * 0.3)));
        ctx.restore();
      }
    }
    // Cejas
    const eyeSt = STYLES[(rig.equipped.find((p) => p.slot === 'eyes') || { def: { id: 'shoujo' } }).def.id] || STYLES.shoujo;
    const eh = ew * (eyeSt.h || 1) * 0.62;
    if (rig.detail === 'high' || /angry|sad/.test(e.brows)) {
      for (const s of [-1, 1]) {
        const f = frame(rig, Hd, F.brow, s * (F.eyePhi + 0.03));
        if (f.facing < 0.05) continue;
        withFrame(ctx, f, s, () => drawBrow(ctx, rig, c, ew * 1.05, eh, e.brows, s));
      }
    }
    // Nariz
    const fn = frame(rig, Hd, F.nose, 0);
    const mw = H.w * (rig.fem ? 0.15 : 0.18);
    if (rig.detail === 'high' && fn.facing > -0.3) {
      const col = U.shade(c.skin, -0.38);
      const front = fn.fs > 0.8;
      withFrame(ctx, fn, 1, () => {
        if (front) {
          D.stroke(ctx, col, rig.line * 0.7, (q) => { q.moveTo(mw * 0.1, -mw * 0.45); q.lineTo(mw * 0.18, -mw * 0.05); q.lineTo(-mw * 0.05, mw * 0.02); });
        } else {
          D.stroke(ctx, col, rig.line * 0.7, (q) => { q.moveTo(-mw * 0.25, mw * 0.05); q.quadraticCurveTo(mw * 0.05, mw * 0.15, mw * 0.15, -mw * 0.02); });
        }
      });
    }
    // Boca
    const fm = frame(rig, Hd, F.mouth, 0);
    if (fm.facing > -0.15) withFrame(ctx, fm, 1, () => drawMouth(ctx, rig, c, mw, rig.pose.mouth || e.mouth));
  }

  SC.face = { frame, withFrame, drawFeatures, STYLES };

  for (const [id, st] of Object.entries(STYLES)) {
    SC.registerPart({
      slot: 'eyes', id, name: st.name,
      colors: { iris: { label: 'Iris', value: '#3f7fd6' } },
      face(ctx, rig, c, Hd) {
        const F = rig.face, H = rig.head;
        const ew = H.w * (0.27 + 0.08 * rig.chibi) * (st.size || 1) * (rig.fem ? 1 : 0.94);
        const eh = ew * (st.h || 1) * 0.62;
        for (const s of [-1, 1]) {
          const f = frame(rig, Hd, F.eye, s * F.eyePhi);
          if (f.facing < 0.02) continue;
          withFrame(ctx, f, s, () => drawEye(ctx, rig, st, eyeState(rig, s), c, ew, eh));
        }
      },
    });
  }
})();
