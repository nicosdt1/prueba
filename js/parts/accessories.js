// Accesorios de cabeza, cara, cuello y espalda.
(() => {
  const U = SC.util, D = SC.draw;
  const reg = (d) => SC.registerPart(d);
  const R = (rig) => ({ rx: rig.head.w / 2, ry: rig.head.h / 2 });

  // ---------- Cabeza (coordenadas locales de la cabeza) ----------
  reg({
    slot: 'headAcc', id: 'gorra', name: 'Gorra',
    colors: { main: { label: 'Tela', value: '#d94141' }, visor: { label: 'Visera', value: '#f2f2f2' } },
    layers: {
      headAcc(ctx, rig, c) {
        const { rx, ry } = R(rig);
        D.shape(ctx, rig, c.main, (q) => {
          q.moveTo(-rx * 1.14, -ry * 0.3);
          q.bezierCurveTo(-rx * 1.18, -ry * 1.45, rx * 1.18, -ry * 1.45, rx * 1.14, -ry * 0.3);
          q.quadraticCurveTo(0, -ry * 0.45, -rx * 1.14, -ry * 0.3);
        }, { shade: (q) => q.rect(rx * 0.4, -ry * 2, rx * 2, ry * 3), light: (q) => D.ellipse(q, -rx * 0.45, -ry * 0.95, rx * 0.25, ry * 0.1, -0.4) });
        D.shape(ctx, rig, c.visor, (q) => {
          q.moveTo(-rx * 1.1, -ry * 0.32);
          q.quadraticCurveTo(0, -ry * 0.48, rx * 1.1, -ry * 0.32);
          q.quadraticCurveTo(rx * 1.2, -ry * 0.12, 0, -ry * 0.1);
          q.quadraticCurveTo(-rx * 1.2, -ry * 0.12, -rx * 1.1, -ry * 0.32);
        });
        D.shape(ctx, rig, c.main, (q) => D.ellipse(q, 0, -ry * 1.16, rx * 0.12, ry * 0.06));
      },
    },
  });

  reg({
    slot: 'headAcc', id: 'bruja', name: 'Sombrero de mago',
    colors: { main: { label: 'Tela', value: '#3a2b63' }, band: { label: 'Cinta', value: '#e0b042' } },
    layers: {
      headAcc(ctx, rig, c) {
        const { rx, ry } = R(rig);
        D.shape(ctx, rig, c.main, (q) => D.ellipse(q, 0, -ry * 0.62, rx * 1.95, ry * 0.3), { shade: (q) => q.rect(-rx * 3, -ry * 0.62, rx * 6, ry) });
        D.shape(ctx, rig, c.main, (q) => {
          q.moveTo(-rx * 0.95, -ry * 0.66);
          q.quadraticCurveTo(-rx * 0.5, -ry * 1.8, rx * 0.2, -ry * 2.5);
          q.quadraticCurveTo(rx * 0.6, -ry * 2.75, rx * 1.2, -ry * 2.35);
          q.quadraticCurveTo(rx * 0.55, -ry * 2.3, rx * 0.55, -ry * 1.9);
          q.quadraticCurveTo(rx * 0.9, -ry * 1.1, rx * 0.95, -ry * 0.66);
          q.quadraticCurveTo(0, -ry * 0.5, -rx * 0.95, -ry * 0.66);
        }, { shade: (q) => q.rect(rx * 0.3, -ry * 3, rx * 2, ry * 3) });
        D.limb(ctx, rig, [{ x: -rx * 0.9, y: -ry * 0.82 }, { x: 0, y: -ry * 0.74 }, { x: rx * 0.9, y: -ry * 0.82 }], ry * 0.16, c.band, { cap: 'butt', shade: false });
      },
    },
  });

  reg({
    slot: 'headAcc', id: 'lazo', name: 'Lazo grande',
    colors: { main: { label: 'Lazo', value: '#e2465f' } },
    layers: {
      headAcc(ctx, rig, c) {
        const { rx, ry } = R(rig);
        ctx.save();
        ctx.translate(rx * 0.6, -ry * 0.88);
        ctx.rotate(0.35);
        const r = rx * 0.32;
        for (const s of [-1, 1]) {
          D.shape(ctx, rig, c.main, (q) => {
            q.moveTo(0, 0);
            q.bezierCurveTo(s * r * 1.2, -r * 1.3, s * r * 2, -r * 0.5, s * r * 1.6, r * 0.2);
            q.quadraticCurveTo(s * r * 1.2, r * 0.8, 0, 0);
          }, { shade: (q) => D.ellipse(q, s * r * 1.2, r * 0.3, r * 0.6, r * 0.35) });
        }
        D.shape(ctx, rig, U.shade(c.main, -0.1), (q) => D.ellipse(q, 0, 0, r * 0.35, r * 0.4));
        ctx.restore();
      },
    },
  });

  reg({
    slot: 'headAcc', id: 'gato', name: 'Orejas de gato',
    colors: { main: { label: 'Pelaje', value: '#3b2c2a' }, inner: { label: 'Interior', value: '#f3a3b5' } },
    layers: {
      headAcc(ctx, rig, c) {
        const { rx, ry } = R(rig);
        for (const s of [-1, 1]) {
          const bx = s * rx * 0.62, by = -ry * 0.82;
          const tri = (k) => (q) => {
            q.moveTo(bx - s * rx * 0.36 * k, by + ry * 0.12 * k);
            q.quadraticCurveTo(bx + s * rx * 0.05, by - ry * 0.7 * k, bx + s * rx * 0.36 * k, by - ry * 0.55 * k);
            q.quadraticCurveTo(bx + s * rx * 0.35 * k, by - ry * 0.1, bx + s * rx * 0.28 * k, by + ry * 0.2 * k);
          };
          D.shape(ctx, rig, c.main, tri(1));
          D.shape(ctx, rig, c.inner, tri(0.6), { stroke: false });
        }
      },
    },
  });

  reg({
    slot: 'headAcc', id: 'corona', name: 'Corona',
    colors: { main: { label: 'Oro', value: '#e8b93a' }, gem: { label: 'Gemas', value: '#d8324c' } },
    layers: {
      headAcc(ctx, rig, c) {
        const { rx, ry } = R(rig);
        const y0 = -ry * 0.78, y1 = -ry * 1.35, w = rx * 0.75;
        D.shape(ctx, rig, c.main, (q) => {
          q.moveTo(-w, y0);
          const n = 5;
          for (let i = 0; i <= n * 2; i++) {
            const x = -w + (2 * w * i) / (n * 2);
            q.lineTo(x, i % 2 ? y1 + ry * 0.25 : y1);
          }
          q.lineTo(w, y0);
          q.quadraticCurveTo(0, y0 + ry * 0.12, -w, y0);
        }, { light: (q) => q.rect(-w, y0 - ry * 0.18, w * 2, ry * 0.06) });
        for (const x of [-0.5, 0, 0.5]) {
          D.shape(ctx, rig, c.gem, (q) => D.ellipse(q, x * w, y0 - ry * 0.1, rx * 0.07, rx * 0.07), { lineScale: 0.6 });
        }
      },
    },
  });

  reg({
    slot: 'headAcc', id: 'diadema', name: 'Diadema',
    colors: { main: { label: 'Diadema', value: '#f0f0f5' } },
    layers: {
      headAcc(ctx, rig, c) {
        const { rx, ry } = R(rig);
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const a = Math.PI * (1.08 + (0.84 * i) / 12);
          pts.push({ x: Math.cos(a) * rx * 1.08, y: -ry * 0.15 + Math.sin(a) * ry * 0.98 });
        }
        D.limb(ctx, rig, pts, ry * 0.1, c.main, { shade: false });
      },
    },
  });

  // ---------- Cara ----------
  reg({
    slot: 'faceAcc', id: 'gafas', name: 'Gafas',
    colors: { main: { label: 'Montura', value: '#3a2e4a' } },
    layers: {
      faceAcc(ctx, rig, c) {
        const m = SC.faceMetrics(rig);
        const r = m.ew * 1.25;
        ctx.save();
        ctx.fillStyle = 'rgba(200,225,255,0.18)';
        for (const s of [-1, 1]) { ctx.beginPath(); D.ellipse(ctx, s * m.eyeDX, m.eyeY, r, r * 0.9); ctx.fill(); }
        ctx.restore();
        D.detailLine(ctx, rig, c.main, (q) => {
          for (const s of [-1, 1]) { q.moveTo(s * m.eyeDX + r, m.eyeY); D.ellipse(q, s * m.eyeDX, m.eyeY, r, r * 0.9); }
          q.moveTo(-m.eyeDX + r, m.eyeY - r * 0.2);
          q.quadraticCurveTo(0, m.eyeY - r * 0.5, m.eyeDX - r, m.eyeY - r * 0.2);
        }, rig.detail === 'high' ? 1.2 : 1, true);
      },
    },
  });

  reg({
    slot: 'faceAcc', id: 'gafasSol', name: 'Gafas de sol',
    colors: { main: { label: 'Cristal', value: '#1d1b26' } },
    layers: {
      faceAcc(ctx, rig, c) {
        const m = SC.faceMetrics(rig);
        const r = m.ew * 1.3;
        for (const s of [-1, 1]) {
          D.shape(ctx, rig, c.main, (q) => {
            const x = s * m.eyeDX;
            q.moveTo(x - r, m.eyeY - r * 0.55);
            q.lineTo(x + r, m.eyeY - r * 0.55);
            q.quadraticCurveTo(x + r, m.eyeY + r * 0.8, x, m.eyeY + r * 0.75);
            q.quadraticCurveTo(x - r, m.eyeY + r * 0.8, x - r, m.eyeY - r * 0.55);
          }, { light: (q) => D.ellipse(q, s * m.eyeDX - r * 0.4, m.eyeY - r * 0.2, r * 0.25, r * 0.12, -0.5) });
        }
        D.detailLine(ctx, rig, c.main, (q) => { q.moveTo(-m.eyeDX + r, m.eyeY - r * 0.4); q.lineTo(m.eyeDX - r, m.eyeY - r * 0.4); }, 1.5, true);
      },
    },
  });

  reg({
    slot: 'faceAcc', id: 'parche', name: 'Parche',
    colors: { main: { label: 'Parche', value: '#222026' } },
    layers: {
      faceAcc(ctx, rig, c) {
        const m = SC.faceMetrics(rig);
        const { rx, ry } = R(rig);
        const x = m.eyeDX, r = m.ew * 1.3;
        D.detailLine(ctx, rig, c.main, (q) => {
          q.moveTo(-rx * 1.02, -ry * 0.3); q.lineTo(x, m.eyeY - r * 0.4);
          q.moveTo(x, m.eyeY); q.lineTo(rx * 1.02, m.eyeY - ry * 0.05);
        }, 1.4, true);
        D.shape(ctx, rig, c.main, (q) => D.ellipse(q, x, m.eyeY + r * 0.1, r, r * 0.85));
      },
    },
  });

  // ---------- Cuello ----------
  reg({
    slot: 'neckAcc', id: 'bufanda', name: 'Bufanda',
    colors: { main: { label: 'Lana', value: '#d8513f' }, stripe: { label: 'Rayas', value: '#f4e1c1' } },
    layers: {
      neckAcc(ctx, rig, c) {
        const t = rig.torso, nw = rig.neck.w;
        const tail = [{ x: t.top.x + nw * 0.55, y: t.top.y }, { x: t.top.x + nw * 0.75, y: t.top.y + t.len * 0.3 }, { x: t.top.x + nw * 0.7, y: t.top.y + t.len * 0.62 }];
        D.limb(ctx, rig, tail, nw * 0.62, c.main, { cap: 'butt' });
        D.detailLine(ctx, rig, c.stripe, (q) => {
          for (const f of [0.78, 0.9]) {
            const p = U.lerpPt(tail[1], tail[2], f);
            q.moveTo(p.x - nw * 0.3, p.y); q.lineTo(p.x + nw * 0.3, p.y);
          }
        }, 2, true);
        D.limb(ctx, rig, [U.lerpPt(t.L.neck, t.L.shoulder, 0.3), { x: t.top.x, y: t.top.y + nw * 0.15 }, U.lerpPt(t.R.neck, t.R.shoulder, 0.3)], nw * 0.7, c.main);
      },
    },
  });

  reg({
    slot: 'neckAcc', id: 'corbata', name: 'Corbata',
    colors: { main: { label: 'Corbata', value: '#b8323f' } },
    layers: {
      neckAcc(ctx, rig, c) {
        const t = rig.torso, x = t.top.x, y = t.top.y + t.len * 0.05, w = rig.neck.w * 0.3;
        D.shape(ctx, rig, c.main, (q) => {
          q.moveTo(x - w * 0.7, y + w * 1.1);
          q.lineTo(x - w * 1.1, y + t.len * 0.55);
          q.lineTo(x, y + t.len * 0.64);
          q.lineTo(x + w * 1.1, y + t.len * 0.55);
          q.lineTo(x + w * 0.7, y + w * 1.1);
        }, { shade: (q) => q.rect(x + w * 0.2, y, w * 2, t.len) });
        D.shape(ctx, rig, U.shade(c.main, -0.1), (q) => { q.moveTo(x - w, y); q.lineTo(x + w, y); q.lineTo(x + w * 0.7, y + w * 1.2); q.lineTo(x - w * 0.7, y + w * 1.2); });
      },
    },
  });

  reg({
    slot: 'neckAcc', id: 'colgante', name: 'Colgante',
    colors: { main: { label: 'Cadena', value: '#e2c065' }, gem: { label: 'Gema', value: '#39b3a8' } },
    layers: {
      neckAcc(ctx, rig, c) {
        const t = rig.torso, p = { x: t.top.x, y: t.top.y + t.len * 0.28 };
        D.detailLine(ctx, rig, c.main, (q) => {
          q.moveTo(t.L.neck.x, t.L.neck.y); q.quadraticCurveTo(t.L.neck.x, p.y, p.x, p.y);
          q.quadraticCurveTo(t.R.neck.x, p.y, t.R.neck.x, t.R.neck.y);
        }, 0.9, true);
        const r = rig.neck.w * 0.22;
        D.shape(ctx, rig, c.gem, (q) => { q.moveTo(p.x, p.y); q.lineTo(p.x + r, p.y + r * 1.2); q.lineTo(p.x, p.y + r * 2.6); q.lineTo(p.x - r, p.y + r * 1.2); },
          { light: (q) => D.ellipse(q, p.x - r * 0.3, p.y + r, r * 0.25, r * 0.4) });
      },
    },
  });

  // ---------- Espalda ----------
  reg({
    slot: 'backAcc', id: 'capa', name: 'Capa',
    colors: { main: { label: 'Tela', value: '#a3263a' }, clasp: { label: 'Broche', value: '#e2c065' } },
    layers: {
      backAcc(ctx, rig, c) {
        const t = rig.torso, y = rig.ground - rig.legLen * 0.15, half = rig.sizes.shoulderHalf * 1.9;
        D.shape(ctx, rig, c.main, (q) => {
          q.moveTo(t.L.neck.x, t.L.neck.y);
          q.lineTo(t.R.neck.x, t.R.neck.y);
          q.quadraticCurveTo(t.R.shoulder.x + rig.sizes.armW, t.R.shoulder.y, rig.hip.x + half, y);
          const n = 5;
          for (let i = 1; i <= n; i++) {
            const x0 = rig.hip.x + half - (2 * half * (i - 0.5)) / n, x1 = rig.hip.x + half - (2 * half * i) / n;
            q.quadraticCurveTo(x0, y + rig.sizes.legW * (i % 2 ? 0.5 : -0.2), x1, y);
          }
          q.quadraticCurveTo(t.L.shoulder.x - rig.sizes.armW, t.L.shoulder.y, t.L.neck.x, t.L.neck.y);
        }, { shade: (q) => q.rect(0, 0, 9999, 9999) });
      },
      neckAcc(ctx, rig, c) {
        const t = rig.torso;
        for (const s of [-1, 1]) {
          const T = s < 0 ? t.L : t.R;
          D.limb(ctx, rig, [U.lerpPt(T.neck, T.shoulder, 0.8), { x: t.top.x, y: t.top.y + t.len * 0.12 }], rig.neck.w * 0.12, U.shade(c.clasp, -0.2), { shade: false });
        }
        D.shape(ctx, rig, c.clasp, (q) => D.ellipse(q, t.top.x, t.top.y + t.len * 0.12, rig.neck.w * 0.22, rig.neck.w * 0.22));
      },
    },
  });

  reg({
    slot: 'backAcc', id: 'alas', name: 'Alas',
    colors: { main: { label: 'Plumas', value: '#f7f4ff' } },
    layers: {
      backAcc(ctx, rig, c) {
        const t = rig.torso, B = rig.B;
        for (const s of [-1, 1]) {
          const root = { x: t.top.x + s * rig.sizes.shoulderHalf * 0.4, y: t.top.y + t.len * 0.25 };
          D.shape(ctx, rig, c.main, (q) => {
            q.moveTo(root.x, root.y);
            q.quadraticCurveTo(root.x + s * B * 0.2, t.top.y - t.len * 0.7, root.x + s * B * 0.5, t.top.y - t.len * 0.55);
            const tip = { x: root.x + s * B * 0.5, y: t.top.y - t.len * 0.55 };
            const n = 5;
            for (let i = 1; i <= n; i++) {
              const p = { x: tip.x - s * B * 0.07 * i, y: tip.y + t.len * 0.3 * i };
              const mid = { x: (tip.x - s * B * 0.07 * (i - 0.5)) + s * B * 0.03, y: tip.y + t.len * 0.3 * (i - 0.5) + t.len * 0.12 };
              q.quadraticCurveTo(mid.x, mid.y, p.x, p.y);
            }
            q.quadraticCurveTo(root.x + s * B * 0.08, root.y + t.len * 0.3, root.x, root.y);
          }, { shade: (q) => q.rect(root.x + (s < 0 ? -9999 : 0), t.top.y + t.len * 0.25, 9999, 9999) });
        }
      },
    },
  });

  reg({
    slot: 'backAcc', id: 'mochila', name: 'Mochila',
    colors: { main: { label: 'Tela', value: '#e2a23a' }, strap: { label: 'Correas', value: '#6b4630' } },
    layers: {
      backAcc(ctx, rig, c) {
        const t = rig.torso, w = rig.sizes.shoulderHalf * 1.2;
        D.shape(ctx, rig, c.main, (q) => {
          const x = rig.hip.x - w, y = t.top.y + t.len * 0.05, h = t.len * 0.85, r = w * 0.3;
          q.moveTo(x + r, y); q.lineTo(x + 2 * w - r, y); q.quadraticCurveTo(x + 2 * w, y, x + 2 * w, y + r);
          q.lineTo(x + 2 * w, y + h); q.lineTo(x, y + h); q.lineTo(x, y + r); q.quadraticCurveTo(x, y, x + r, y);
        }, { shade: (q) => q.rect(rig.hip.x + w * 0.6, 0, 9999, 9999) });
      },
      neckAcc(ctx, rig, c) {
        const t = rig.torso;
        for (const s of [-1, 1]) {
          const T = s < 0 ? t.L : t.R;
          D.limb(ctx, rig, [U.lerpPt(T.neck, T.shoulder, 0.55), U.lerpPt(T.armpit, T.chest, 0.5), U.lerpPt(T.chest, T.waist, 0.6)], rig.sizes.armW * 0.35, c.strap, { shade: false });
        }
      },
    },
  });

  reg({
    slot: 'backAcc', id: 'espada', name: 'Espada',
    colors: { main: { label: 'Hoja', value: '#cfd8e3' }, hilt: { label: 'Empuñadura', value: '#5a3d2b' } },
    layers: {
      backAcc(ctx, rig, c) {
        const t = rig.torso, B = rig.B;
        const a = { x: t.top.x + rig.sizes.shoulderHalf * 1.2, y: t.top.y - t.len * 0.35 };
        const b = { x: rig.hip.x - rig.sizes.hipHalf * 1.5, y: rig.hip.y + rig.legLen * 0.15 };
        const g = U.lerpPt(a, b, 0.2);
        D.limb(ctx, rig, [g, b], B * 0.035, c.main, { cap: 'butt' });
        D.limb(ctx, rig, [a, g], B * 0.022, c.hilt, { shade: false });
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        const nx = -dy / len, ny = dx / len;
        D.limb(ctx, rig, [{ x: g.x + nx * B * 0.05, y: g.y + ny * B * 0.05 }, { x: g.x - nx * B * 0.05, y: g.y - ny * B * 0.05 }], B * 0.02, '#d9b44a', { shade: false });
        D.shape(ctx, rig, '#d9b44a', (q) => D.ellipse(q, a.x, a.y, B * 0.018, B * 0.018));
      },
    },
  });

})();
