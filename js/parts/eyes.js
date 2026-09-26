// Estilos de ojos. Cada estilo reacciona al estado de la expresión:
// open, wide, half, narrow, happy, side, wink y parpadeo (pose.blink).
(() => {
  const U = SC.util, D = SC.draw;

  const STYLES = {
    anime: { name: 'Anime', ratio: 1.3, iris: 0.68, lash: 2.3, highlights: 2, wing: true },
    redondos: { name: 'Redondos', ratio: 1.05, iris: 0.55, lash: 1.5, highlights: 1, wing: false },
    afilados: { name: 'Afilados', ratio: 0.72, iris: 0.62, lash: 2, highlights: 1, wing: true, slant: 0.35 },
    puntos: { name: 'Puntos', dots: true },
  };

  function eyeState(rig, s) {
    if (rig.pose.blink) return 'closed';
    const st = rig.expr.eyes;
    if (st === 'wink') return s === 1 ? 'happy' : 'open';
    return st;
  }

  function closedArc(ctx, rig, x, y, ew, up, col) {
    ctx.beginPath();
    ctx.moveTo(x - ew, y);
    ctx.quadraticCurveTo(x, y + (up ? -ew * 0.9 : ew * 0.55), x + ew, y);
    ctx.lineWidth = rig.line * (rig.detail === 'high' ? 1.8 : 1.6);
    ctx.lineCap = 'round';
    ctx.strokeStyle = col;
    ctx.stroke();
  }

  function drawEye(ctx, rig, st, s, c) {
    const m = SC.faceMetrics(rig);
    const state = eyeState(rig, s);
    const x = s * m.eyeDX, y = m.eyeY;
    const ew = m.ew;
    const lashCol = U.shade(c.iris, -0.85);

    if (state === 'closed') return closedArc(ctx, rig, x, y, ew * 0.9, false, lashCol);
    if (state === 'happy') return closedArc(ctx, rig, x, y, ew * 0.9, true, lashCol);

    const look = state === 'side' ? ew * 0.3 : 0;

    // Versión sencilla: pixel art o estilo "puntos".
    if (st.dots || rig.detail !== 'high') {
      const k = state === 'wide' ? 1.15 : state === 'half' ? 0.55 : state === 'narrow' ? 0.6 : 1;
      const rx = st.dots ? ew * 0.34 : ew * 0.55, ry = (st.dots ? ew * 0.5 : ew * 0.8) * k;
      ctx.fillStyle = st.dots || rig.detail !== 'high' ? lashCol : U.shade(c.iris, -0.35);
      ctx.beginPath(); D.ellipse(ctx, x + look, y + ew * 0.1, rx, ry); ctx.fill();
      if (!st.dots) {
        ctx.fillStyle = c.iris;
        ctx.beginPath(); D.ellipse(ctx, x + look, y + ew * 0.1 + ry * 0.4, rx * 0.75, ry * 0.45); ctx.fill();
      }
      if (rig.detail === 'high') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); D.ellipse(ctx, x + look - rx * 0.3, y - ry * 0.35, rx * 0.35, rx * 0.35); ctx.fill();
      }
      return;
    }

    const eh = ew * st.ratio;
    let open = { open: 1, wide: 1.12, half: 0.5, narrow: 0.62, side: 0.9 }[state] || 1;
    const slant = (st.slant || 0) * ew + (state === 'narrow' ? eh * 0.3 : 0);
    const ix = x - s * ew * 0.95, ox = x + s * ew;
    const innerY = y + (state === 'narrow' ? eh * 0.15 : 0);
    const outerY = y - slant * 0.5;
    const topY = y - eh * 1.75 * open;
    const lidPath = (q) => {
      q.moveTo(ox, outerY);
      q.quadraticCurveTo(x + s * ew * 0.15, topY, ix, innerY - eh * 0.1);
    };
    const eyePath = (q) => {
      lidPath(q);
      q.quadraticCurveTo(x, y + eh * 1.75, ox, outerY);
      q.closePath();
    };

    // Blanco del ojo
    ctx.beginPath(); eyePath(ctx);
    ctx.fillStyle = '#fbfbff'; ctx.fill();

    ctx.save();
    ctx.beginPath(); eyePath(ctx); ctx.clip();
    const irx = ew * st.iris * (state === 'wide' ? 0.8 : 1), iry = eh * 0.82 * (state === 'wide' ? 0.85 : 1);
    const ixc = x + look - s * ew * 0.05, iyc = y + eh * 0.12;
    const grad = ctx.createLinearGradient(0, iyc - iry, 0, iyc + iry);
    grad.addColorStop(0, U.shade(c.iris, -0.55));
    grad.addColorStop(0.55, c.iris);
    grad.addColorStop(1, U.shade(c.iris, 0.45));
    ctx.fillStyle = grad;
    ctx.beginPath(); D.ellipse(ctx, ixc, iyc, irx, iry); ctx.fill();
    ctx.lineWidth = rig.line * 0.7; ctx.strokeStyle = U.shade(c.iris, -0.6); ctx.stroke();
    ctx.fillStyle = U.shade(c.iris, -0.75);
    ctx.beginPath(); D.ellipse(ctx, ixc, iyc + iry * 0.05, irx * 0.42, iry * 0.5); ctx.fill();
    // Sombra del párpado sobre el ojo
    ctx.fillStyle = 'rgba(40,20,60,0.18)';
    ctx.beginPath(); lidPath(ctx); ctx.lineTo(ix, y - eh * 2); ctx.lineTo(ox, y - eh * 2); ctx.closePath(); ctx.fill();
    ctx.lineWidth = eh * 0.35; ctx.strokeStyle = 'rgba(40,20,60,0.15)';
    ctx.beginPath(); lidPath(ctx); ctx.stroke();
    // Brillos
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); D.ellipse(ctx, ixc - s * irx * 0.1 - irx * 0.3, iyc - iry * 0.4, irx * 0.3, iry * 0.22); ctx.fill();
    if (st.highlights > 1) {
      ctx.beginPath(); D.ellipse(ctx, ixc + irx * 0.35, iyc + iry * 0.45, irx * 0.14, irx * 0.14); ctx.fill();
    }
    ctx.restore();

    // Pestañas superiores
    ctx.beginPath(); lidPath(ctx);
    if (st.wing) {
      ctx.moveTo(ox, outerY);
      ctx.lineTo(ox + s * ew * 0.28, outerY - eh * 0.28);
    }
    ctx.lineWidth = rig.line * st.lash;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = lashCol;
    ctx.stroke();
    // Línea inferior
    ctx.beginPath();
    ctx.moveTo(ox - s * ew * 0.25, y + eh * 0.72);
    ctx.quadraticCurveTo(x, y + eh * 0.95, ix + s * ew * 0.3, y + eh * 0.6);
    ctx.lineWidth = rig.line * 0.7;
    ctx.strokeStyle = U.shade(c.iris, -0.5);
    ctx.stroke();
  }

  for (const [id, st] of Object.entries(STYLES)) {
    SC.registerPart({
      slot: 'eyes', id, name: st.name,
      colors: { iris: { label: 'Iris', value: '#3f7fd6' } },
      layers: {
        face(ctx, rig, c) {
          for (const s of [-1, 1]) drawEye(ctx, rig, st, s, c);
        },
      },
    });
  }
})();
