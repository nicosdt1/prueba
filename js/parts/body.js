// Cuerpo base: piernas, torso, brazos, cabeza y rasgos faciales (cejas, nariz, boca).
(() => {
  const U = SC.util, D = SC.draw, S = SC.shapes;

  // Medidas de la cara en coordenadas locales de la cabeza.
  SC.faceMetrics = (rig) => {
    const { w, h } = rig.head, k = rig.chibi;
    const ew = w * (0.115 + 0.035 * k);
    return {
      ew, eh: ew * 1.2,
      eyeY: h * (0.1 + 0.03 * k),
      eyeDX: w * (0.2 + 0.02 * k),
      browY: h * (0.1 + 0.03 * k) - ew * 1.55,
      noseY: h * (0.24 + 0.02 * k),
      mouthY: h * (0.33 + 0.01 * k),
      mw: w * 0.1,
    };
  };

  function headPath(ctx, rig) {
    const { w, h } = rig.head, k = rig.chibi;
    D.smooth(ctx, [
      { x: 0, y: -h * 0.5 },
      { x: w * 0.4, y: -h * 0.38 },
      { x: w * 0.5, y: -h * 0.06 },
      { x: w * (0.46 + 0.03 * k), y: h * 0.18 },
      { x: w * (0.3 + 0.08 * k), y: h * 0.39 },
      { x: 0, y: h * 0.5 },
      { x: -w * (0.3 + 0.08 * k), y: h * 0.39 },
      { x: -w * (0.46 + 0.03 * k), y: h * 0.18 },
      { x: -w * 0.5, y: -h * 0.06 },
      { x: -w * 0.4, y: -h * 0.38 },
    ], true);
  }
  SC.headPath = headPath;

  function ear(ctx, rig, skin, s, elf) {
    const { w, h } = rig.head;
    const x = s * w * 0.47, y = h * 0.06;
    D.shape(ctx, rig, skin, (c) => {
      if (elf) {
        c.moveTo(x, y - h * 0.1);
        c.quadraticCurveTo(x + s * w * 0.2, y - h * 0.12, x + s * w * 0.3, y - h * 0.3);
        c.quadraticCurveTo(x + s * w * 0.14, y + h * 0.02, x, y + h * 0.12);
      } else {
        D.ellipse(c, x + s * w * 0.03, y, w * 0.075, h * 0.1);
      }
    });
    D.detailLine(ctx, rig, U.shade(skin, -0.3), (c) => {
      c.moveTo(x + s * w * 0.03, y - h * 0.05);
      c.quadraticCurveTo(x + s * w * 0.07, y, x + s * w * 0.02, y + h * 0.05);
    }, 0.8);
  }

  function foot(ctx, rig, leg, color) {
    const fl = rig.sizes.footL, s = leg.s;
    D.shape(ctx, rig, color, (c) => D.ellipse(c, leg.foot.x + s * fl * 0.12, leg.foot.y - fl * 0.12, fl * 0.5, fl * 0.26));
  }
  SC.footShape = foot;

  function drawBrows(ctx, rig, c, m, kind) {
    const col = U.shade(c.hair, -0.25);
    const bw = m.ew * 1.25;
    for (const s of [-1, 1]) {
      let inner = 0, outer = 0, lift = 0;
      if (kind === 'raised') lift = m.eh * 0.3;
      if (kind === 'angry') { inner = m.eh * 0.45; outer = -m.eh * 0.15; }
      if (kind === 'sad') { inner = -m.eh * 0.35; outer = m.eh * 0.1; }
      if (kind === 'tilt' && s === 1) lift = m.eh * 0.35;
      const cx = s * m.eyeDX, y = m.browY - lift;
      const ix = cx - s * bw * 0.55, ox = cx + s * bw * 0.55;
      ctx.beginPath();
      ctx.moveTo(ix, y + inner);
      ctx.quadraticCurveTo(cx, y - m.eh * 0.25 + (inner + outer) / 2, ox, y + outer + m.eh * 0.1);
      ctx.lineWidth = rig.detail === 'high' ? rig.line * 1.6 : rig.line * 1.3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = col;
      ctx.stroke();
    }
  }

  function drawMouth(ctx, rig, c, m, kind) {
    const y = m.mouthY, mw = m.mw;
    const line = D.lineColor(rig, c.skin);
    const inside = '#7a2a35';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = (build, wd = 1.1) => {
      ctx.beginPath(); build(ctx);
      ctx.lineWidth = rig.line * wd; ctx.strokeStyle = line; ctx.stroke();
    };
    const filled = (build, teeth) => {
      ctx.beginPath(); build(ctx); ctx.closePath();
      ctx.fillStyle = inside; ctx.fill();
      if (teeth && rig.detail === 'high') {
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-mw * 2, y - mw, mw * 4, mw * 0.72);
        ctx.fillStyle = '#e46a7a';
        D.ellipse(ctx, 0, y + mw * 0.75, mw * 0.55, mw * 0.3); ctx.fill();
        ctx.restore();
        ctx.beginPath(); build(ctx); ctx.closePath();
      }
      ctx.lineWidth = rig.line; ctx.strokeStyle = line; ctx.stroke();
    };
    switch (kind) {
      case 'smile':
        stroke((q) => { q.moveTo(-mw, y - mw * 0.15); q.quadraticCurveTo(0, y + mw * 0.55, mw, y - mw * 0.15); });
        break;
      case 'grin':
        filled((q) => { q.moveTo(-mw * 1.1, y - mw * 0.25); q.quadraticCurveTo(0, y - mw * 0.1, mw * 1.1, y - mw * 0.25); q.quadraticCurveTo(0, y + mw * 1.3, -mw * 1.1, y - mw * 0.25); }, true);
        break;
      case 'frown':
        stroke((q) => { q.moveTo(-mw * 0.8, y + mw * 0.25); q.quadraticCurveTo(0, y - mw * 0.35, mw * 0.8, y + mw * 0.25); });
        break;
      case 'angry':
        filled((q) => { q.moveTo(-mw * 0.9, y + mw * 0.3); q.quadraticCurveTo(0, y - mw * 0.4, mw * 0.9, y + mw * 0.3); q.quadraticCurveTo(0, y + mw * 0.15, -mw * 0.9, y + mw * 0.3); }, true);
        break;
      case 'o':
        filled((q) => D.ellipse(q, 0, y + mw * 0.1, mw * 0.4, mw * 0.55));
        break;
      case 'talkA':
        filled((q) => D.ellipse(q, 0, y + mw * 0.1, mw * 0.65, mw * 0.5), true);
        break;
      case 'talkB':
        filled((q) => D.ellipse(q, 0, y + mw * 0.05, mw * 0.5, mw * 0.22));
        break;
      case 'wavy':
        stroke((q) => {
          q.moveTo(-mw * 0.9, y);
          for (let i = 1; i <= 4; i++) q.lineTo(-mw * 0.9 + i * mw * 0.45, y + (i % 2 ? -mw * 0.18 : mw * 0.18));
        });
        break;
      case 'flat':
        stroke((q) => { q.moveTo(-mw * 0.3, y + mw * 0.05); q.lineTo(mw * 0.7, y - mw * 0.05); });
        break;
      default:
        stroke((q) => { q.moveTo(-mw * 0.6, y); q.quadraticCurveTo(0, y + mw * 0.18, mw * 0.6, y); });
    }
  }

  SC.registerPart({
    slot: 'body', id: 'humano', name: 'Humano',
    colors: { skin: { label: 'Piel', value: '#f3cdb0' }, under: { label: 'Ropa interior', value: '#e9e4dc' } },
    layers: {
      legs(ctx, rig, c) {
        for (const leg of rig.legs) {
          D.limb(ctx, rig, [leg.top, leg.knee, leg.foot], rig.sizes.legW, c.skin);
          foot(ctx, rig, leg, c.skin);
        }
      },
      neck(ctx, rig, c) {
        D.limb(ctx, rig, [rig.neck.base, rig.neck.top], rig.neck.w, c.skin, { shade: false });
        if (rig.detail === 'high') {
          // Sombra que proyecta la barbilla.
          ctx.fillStyle = U.shade(c.skin, -0.2);
          ctx.beginPath();
          D.ellipse(ctx, rig.neck.top.x, rig.neck.top.y + rig.neck.w * 0.1, rig.neck.w * 0.5, rig.neck.w * 0.35, rig.head.rot);
          ctx.fill();
        }
      },
      torso(ctx, rig, c) {
        D.shape(ctx, rig, c.skin, (q) => S.torso(q, rig, { hem: 1 }), {
          shade: (q) => D.ellipse(q, rig.hip.x + rig.sizes.shoulderHalf * 1.25, rig.hip.y - rig.torso.len * 0.5, rig.sizes.shoulderHalf * 0.75, rig.torso.len * 0.9),
        });
        D.shape(ctx, rig, c.under, (q) => S.pelvis(q, rig, 1, 0.6));
      },
      arms(ctx, rig, c) {
        for (const a of rig.arms) {
          D.limb(ctx, rig, [a.sh, a.el, a.hand], rig.sizes.armW, c.skin);
          const r = rig.sizes.handR;
          const dx = Math.sin(a.a2) * a.s, dy = Math.cos(a.a2);
          D.shape(ctx, rig, c.skin, (q) => D.ellipse(q, a.hand.x + dx * r * 0.5, a.hand.y + dy * r * 0.5, r * 0.8, r * 1.05, Math.atan2(dy, dx) - Math.PI / 2));
        }
      },
      head(ctx, rig, c) {
        for (const s of [-1, 1]) ear(ctx, rig, c.skin, s, false);
        D.shape(ctx, rig, c.skin, (q) => headPath(q, rig), {
          shade: (q) => D.ellipse(q, rig.head.w * 0.62, rig.head.h * 0.05, rig.head.w * 0.3, rig.head.h * 0.75),
        });
      },
      face(ctx, rig, c) { SC.drawFace(ctx, rig, c); },
    },
  });

  // Variante élfica: igual que la humana pero con orejas puntiagudas.
  const human = SC.getPart('body', 'humano');
  SC.registerPart({
    slot: 'body', id: 'elfo', name: 'Elfo',
    colors: human.colors,
    layers: Object.assign({}, human.layers, {
      head(ctx, rig, c) {
        for (const s of [-1, 1]) ear(ctx, rig, c.skin, s, true);
        D.shape(ctx, rig, c.skin, (q) => headPath(q, rig), {
          shade: (q) => D.ellipse(q, rig.head.w * 0.62, rig.head.h * 0.05, rig.head.w * 0.3, rig.head.h * 0.75),
        });
      },
    }),
  });

  // Rasgos comunes de la cara (los ojos los dibuja la pieza de ojos).
  SC.drawFace = function drawFace(ctx, rig, c) {
    const m = SC.faceMetrics(rig);
    const e = rig.expr;
    c = Object.assign({ hair: rig.hairColor || '#5a3a2a' }, c);
    if (e.blush > 0) {
      ctx.save();
      ctx.globalAlpha = rig.detail === 'high' ? 0.35 * e.blush + 0.1 : 0.6;
      ctx.fillStyle = '#ff6f86';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        D.ellipse(ctx, s * m.eyeDX * 1.1, m.eyeY + m.eh * 1.25, m.ew * 0.8, m.eh * 0.35);
        ctx.fill();
      }
      ctx.restore();
    }
    if (rig.detail === 'high') {
      drawBrows(ctx, rig, c, m, e.brows);
      D.detailLine(ctx, rig, U.shade(c.skin, -0.35), (q) => {
        q.moveTo(m.mw * 0.05, m.noseY - m.mw * 0.3);
        q.lineTo(m.mw * 0.15, m.noseY + m.mw * 0.1);
        q.lineTo(-m.mw * 0.08, m.noseY + m.mw * 0.15);
      }, 0.9);
    } else if (e.brows === 'angry' || e.brows === 'sad') {
      drawBrows(ctx, rig, c, m, e.brows);
    }
    drawMouth(ctx, rig, c, m, rig.pose.mouth || e.mouth);
  };
})();
