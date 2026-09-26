// Ropa: parte superior, abrigos, parte inferior y calzado.
// Todas las prendas se construyen a partir del rig, por lo que siguen al
// cuerpo en cualquier proporción (chibi o realista) y en cualquier animación.
(() => {
  const U = SC.util, D = SC.draw, S = SC.shapes;

  const torsoShade = (rig, k = 1) => (q) => D.ellipse(q, rig.hip.x + rig.sizes.shoulderHalf * 1.3 * k, rig.hip.y - rig.torso.len * 0.4,
    rig.sizes.shoulderHalf * 0.75, rig.torso.len * 1.2);

  // Línea que cierra el extremo de un trazo con terminación plana.
  function endCap(ctx, rig, pts, width, color) {
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len * width / 2, ny = (b.x - a.x) / len * width / 2;
    D.detailLine(ctx, rig, D.lineColor(rig, color), (q) => { q.moveTo(b.x + nx, b.y + ny); q.lineTo(b.x - nx, b.y - ny); }, 1, true);
  }

  function sleeves(ctx, rig, color, from, to, wk, cuff) {
    for (const a of rig.arms) {
      const w = rig.sizes.armW * wk, pts = S.armSeg(a, from, to);
      D.shape(ctx, rig, color, (q) => D.ellipse(q, a.sh.x, a.sh.y, w / 2, w / 2));
      D.limb(ctx, rig, pts, w, color, { cap: 'butt' });
      endCap(ctx, rig, pts, w, color);
      if (cuff) {
        const cp = S.armSeg(a, to - 0.07, to);
        D.limb(ctx, rig, cp, w * 1.04, cuff, { shade: false, cap: 'butt' });
        endCap(ctx, rig, cp, w * 1.04, cuff);
      }
    }
  }

  function folds(ctx, rig, color, pts) {
    D.detailLine(ctx, rig, U.shade(color, -0.3), (q) => {
      for (const [a, b] of pts) { q.moveTo(a.x, a.y); q.lineTo(b.x, b.y); }
    }, 0.7);
  }

  function button(ctx, rig, color, x, y, r) {
    D.shape(ctx, rig, color, (q) => D.ellipse(q, x, y, r, r), { lineScale: 0.6 });
  }

  // Falda acampanada desde la cintura (fr: fracción de pierna que cubre).
  function skirt(ctx, rig, color, fr, flare, opts = {}) {
    const t = rig.torso, top = opts.fromWaist ? 0.45 : 0.8;
    const wL = U.lerpPt(t.L.waist, t.L.hip, top), wR = U.lerpPt(t.R.waist, t.R.hip, top);
    const y = rig.hip.y + rig.legLen * fr;
    const half = rig.sizes.hipHalf * flare;
    const bL = { x: rig.hip.x - half, y }, bR = { x: rig.hip.x + half, y };
    const build = (q) => {
      q.moveTo(wL.x, wL.y);
      q.lineTo(wR.x, wR.y);
      q.quadraticCurveTo(t.R.hip.x + half * 0.12, rig.hip.y, bR.x, bR.y);
      if (rig.detail === 'high' && opts.scallop) {
        const n = 6;
        for (let i = 1; i <= n; i++) {
          const x0 = bR.x - (bR.x - bL.x) * ((i - 0.5) / n), x1 = bR.x - (bR.x - bL.x) * (i / n);
          q.quadraticCurveTo(x0, y + rig.sizes.legW * 0.35, x1, y);
        }
      } else {
        q.quadraticCurveTo(rig.hip.x, y + rig.sizes.legW * 0.25, bL.x, bL.y);
      }
      q.quadraticCurveTo(t.L.hip.x - half * 0.12, rig.hip.y, wL.x, wL.y);
    };
    D.shape(ctx, rig, color, build, { shade: (q) => q.rect(rig.hip.x + half * 0.4, 0, 9999, 9999) });
    const pleats = [];
    for (const f of [-0.6, -0.2, 0.2, 0.6]) {
      pleats.push([{ x: rig.hip.x + f * (wR.x - wL.x) * 0.5, y: wL.y + (y - wL.y) * 0.25 }, { x: rig.hip.x + f * half * 0.95, y: y - 2 }]);
    }
    folds(ctx, rig, color, pleats);
    if (opts.stripe) {
      D.detailLine(ctx, rig, opts.stripe, (q) => {
        const yy = y - rig.sizes.legW * 0.35;
        q.moveTo(bL.x + half * 0.06, yy);
        q.quadraticCurveTo(rig.hip.x, yy + rig.sizes.legW * 0.25, bR.x - half * 0.06, yy);
      }, 2.2, true);
    }
    return { wL, wR, y };
  }

  const reg = (d) => SC.registerPart(d);

  // ---------- Parte superior ----------
  reg({
    slot: 'top', id: 'camiseta', name: 'Camiseta',
    colors: { main: { label: 'Tela', value: '#4f86d9' }, print: { label: 'Estampado', value: '#ffd35c' } },
    layers: {
      top(ctx, rig, c) {
        D.shape(ctx, rig, c.main, (q) => S.torso(q, rig, { expand: rig.sizes.armW * 0.12, neck: 'round', hem: 1.06 }), { shade: torsoShade(rig) });
        if (rig.detail === 'high') {
          const x = rig.hip.x - rig.sizes.shoulderHalf * 0.05, y = rig.torso.top.y + rig.torso.len * 0.42, r = rig.torso.len * 0.1;
          D.shape(ctx, rig, c.print, (q) => {
            for (let i = 0; i < 10; i++) {
              const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
              q.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            }
          }, { lineScale: 0.7 });
        } else {
          D.shape(ctx, rig, c.print, (q) => D.ellipse(q, rig.hip.x, rig.torso.top.y + rig.torso.len * 0.42, rig.torso.len * 0.08, rig.torso.len * 0.08), { stroke: false });
        }
      },
      sleeves(ctx, rig, c) { sleeves(ctx, rig, c.main, 0, 0.3, 1.45); },
    },
  });

  reg({
    slot: 'top', id: 'camisa', name: 'Camisa',
    colors: { main: { label: 'Tela', value: '#f2f2f5' }, detail: { label: 'Botones', value: '#7f8aa6' } },
    layers: {
      top(ctx, rig, c) {
        const t = rig.torso;
        D.shape(ctx, rig, c.main, (q) => S.torso(q, rig, { expand: rig.sizes.armW * 0.12, neck: 'v', hem: 1.1 }), { shade: torsoShade(rig) });
        // Cuello de la camisa
        const V = { x: t.top.x, y: t.top.y + t.len * 0.2 };
        for (const s of [-1, 1]) {
          const n = s < 0 ? t.L.neck : t.R.neck;
          D.shape(ctx, rig, U.shade(c.main, -0.04), (q) => {
            q.moveTo(n.x + s * rig.neck.w * 0.1, n.y - rig.neck.w * 0.25);
            q.lineTo(n.x + s * rig.neck.w * 0.75, n.y + t.len * 0.1);
            q.lineTo(V.x + s * rig.neck.w * 0.1, V.y - t.len * 0.02);
          });
        }
        D.detailLine(ctx, rig, U.shade(c.main, -0.25), (q) => { q.moveTo(V.x, V.y); q.lineTo(rig.hip.x, rig.hip.y + rig.sizes.legW * 0.3); }, 0.8, true);
        const n = rig.detail === 'high' ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          button(ctx, rig, c.detail, U.lerp(V.x, rig.hip.x, f) + rig.line * 1.2, U.lerp(V.y, rig.hip.y, f), rig.sizes.armW * 0.1);
        }
      },
      sleeves(ctx, rig, c) { sleeves(ctx, rig, c.main, 0, 0.92, 1.3, U.shade(c.main, -0.05)); },
    },
  });

  reg({
    slot: 'top', id: 'sudadera', name: 'Sudadera',
    colors: { main: { label: 'Tela', value: '#8e5bc8' }, detail: { label: 'Cordones', value: '#f5f0ff' } },
    layers: {
      top(ctx, rig, c) {
        const t = rig.torso, e = rig.sizes.armW * 0.3;
        D.shape(ctx, rig, c.main, (q) => S.torso(q, rig, { expand: e, neck: 'round', hem: 1.16 }), { shade: torsoShade(rig) });
        // Capucha plegada alrededor del cuello
        D.limb(ctx, rig, [t.L.neck, { x: t.top.x, y: t.top.y + t.len * 0.12 }, t.R.neck], rig.neck.w * 0.45, U.shade(c.main, -0.08));
        // Bolsillo canguro
        const y1 = rig.hip.y - t.len * 0.26, y2 = rig.hip.y + rig.sizes.legW * 0.1, hw = rig.sizes.waistHalf * 0.7;
        D.shape(ctx, rig, c.main, (q) => {
          q.moveTo(rig.hip.x - hw * 0.6, y1); q.lineTo(rig.hip.x + hw * 0.6, y1);
          q.lineTo(rig.hip.x + hw, y2); q.lineTo(rig.hip.x - hw, y2);
        }, { lineScale: 0.8 });
        for (const s of [-1, 1]) {
          D.detailLine(ctx, rig, c.detail, (q) => {
            q.moveTo(t.top.x + s * rig.neck.w * 0.25, t.top.y + t.len * 0.12);
            q.lineTo(t.top.x + s * rig.neck.w * 0.3, t.top.y + t.len * 0.36);
          }, 1.1, true);
        }
      },
      sleeves(ctx, rig, c) { sleeves(ctx, rig, c.main, 0, 0.93, 1.55, U.shade(c.main, -0.12)); },
    },
  });

  reg({
    slot: 'top', id: 'marinero', name: 'Uniforme marinero',
    colors: { main: { label: 'Blusa', value: '#f4f5fa' }, collar: { label: 'Cuello', value: '#27386f' }, bow: { label: 'Lazo', value: '#d63a4a' } },
    layers: {
      top(ctx, rig, c) {
        const t = rig.torso;
        D.shape(ctx, rig, c.main, (q) => S.torso(q, rig, { expand: rig.sizes.armW * 0.12, neck: 'v', hem: 0.95 }), { shade: torsoShade(rig) });
        const V = { x: t.top.x, y: t.top.y + t.len * 0.3 };
        for (const s of [-1, 1]) {
          const T = s < 0 ? t.L : t.R;
          const sh = U.lerpPt(T.neck, T.shoulder, 0.8);
          D.shape(ctx, rig, c.collar, (q) => {
            q.moveTo(T.neck.x, T.neck.y);
            q.lineTo(sh.x, sh.y);
            q.lineTo(sh.x - s * rig.sizes.armW * 0.2, T.armpit.y - t.len * 0.04);
            q.lineTo(V.x, V.y);
          });
          D.detailLine(ctx, rig, '#ffffff', (q) => {
            const a = U.lerpPt(sh, { x: sh.x - s * rig.sizes.armW * 0.2, y: T.armpit.y - t.len * 0.04 }, 0.2);
            q.moveTo(a.x - s * rig.sizes.armW * 0.12, a.y);
            q.lineTo(V.x, V.y - t.len * 0.07);
          }, 0.9);
        }
        const r = t.len * 0.075;
        D.shape(ctx, rig, c.bow, (q) => {
          q.moveTo(V.x, V.y); q.lineTo(V.x - r * 1.6, V.y - r * 0.8); q.lineTo(V.x - r * 1.4, V.y + r * 0.9); q.closePath();
          q.moveTo(V.x, V.y); q.lineTo(V.x + r * 1.6, V.y - r * 0.8); q.lineTo(V.x + r * 1.4, V.y + r * 0.9); q.closePath();
          q.moveTo(V.x - r * 0.3, V.y); q.lineTo(V.x - r * 0.9, V.y + r * 2.6); q.lineTo(V.x - r * 0.2, V.y + r * 2.3);
          q.lineTo(V.x + r * 0.2, V.y + r * 2.3); q.lineTo(V.x + r * 0.9, V.y + r * 2.6); q.lineTo(V.x + r * 0.3, V.y);
        });
        D.shape(ctx, rig, c.bow, (q) => D.ellipse(q, V.x, V.y, r * 0.45, r * 0.45));
      },
      sleeves(ctx, rig, c) { sleeves(ctx, rig, c.main, 0, 0.9, 1.35, c.collar); },
    },
  });

  reg({
    slot: 'top', id: 'vestido', name: 'Vestido',
    colors: { main: { label: 'Tela', value: '#e87a9b' }, detail: { label: 'Cinta', value: '#fff3f6' } },
    layers: {
      top(ctx, rig, c) {
        const sk = skirt(ctx, rig, c.main, 0.55, 1.9, { fromWaist: true, scallop: true });
        D.shape(ctx, rig, c.main, (q) => S.torso(q, rig, { expand: rig.sizes.armW * 0.1, neck: 'round', hem: 0.5 }), { shade: torsoShade(rig) });
        D.limb(ctx, rig, [{ x: sk.wL.x - 2, y: sk.wL.y - rig.torso.len * 0.02 }, { x: sk.wR.x + 2, y: sk.wR.y - rig.torso.len * 0.02 }], rig.torso.len * 0.07, c.detail, { cap: 'butt', shade: false });
      },
      sleeves(ctx, rig, c) {
        for (const a of rig.arms) {
          const p = U.lerpPt(a.sh, a.el, 0.25);
          D.shape(ctx, rig, c.main, (q) => D.ellipse(q, p.x, p.y, rig.sizes.armW * 0.95, rig.sizes.armW * 0.85, a.s * a.a1));
        }
      },
    },
  });

  reg({
    slot: 'top', id: 'tunica', name: 'Túnica',
    colors: { main: { label: 'Tela', value: '#5f8f4e' }, belt: { label: 'Cinturón', value: '#6b4a2b' } },
    layers: {
      top(ctx, rig, c) {
        const t = rig.torso;
        D.shape(ctx, rig, c.main, (q) => S.torso(q, rig, { expand: rig.sizes.armW * 0.2, neck: 'v', hem: 1.5 }), { shade: torsoShade(rig) });
        D.detailLine(ctx, rig, U.shade(c.main, 0.35), (q) => {
          q.moveTo(t.L.neck.x, t.L.neck.y); q.lineTo(t.top.x, t.top.y + t.len * 0.2); q.lineTo(t.R.neck.x, t.R.neck.y);
        }, 1.4);
        const y = rig.hip.y - t.len * 0.12;
        D.limb(ctx, rig, [{ x: t.L.waist.x - rig.sizes.armW * 0.25, y }, { x: t.R.waist.x + rig.sizes.armW * 0.25, y }], t.len * 0.08, c.belt, { cap: 'butt', shade: false });
        D.shape(ctx, rig, '#d9b44a', (q) => q.rect(rig.hip.x - t.len * 0.05, y - t.len * 0.05, t.len * 0.1, t.len * 0.1), { lineScale: 0.7 });
      },
      sleeves(ctx, rig, c) { sleeves(ctx, rig, c.main, 0, 0.9, 1.4, U.shade(c.main, -0.15)); },
    },
  });

  reg({
    slot: 'top', id: 'armadura', name: 'Armadura',
    colors: { main: { label: 'Metal', value: '#aab6c6' }, trim: { label: 'Adornos', value: '#d6a93b' }, cloth: { label: 'Tela', value: '#5b4a82' } },
    layers: {
      top(ctx, rig, c) {
        const t = rig.torso;
        D.shape(ctx, rig, c.cloth, (q) => S.torso(q, rig, { expand: rig.sizes.armW * 0.15, neck: 'high', hem: 1.3 }));
        D.shape(ctx, rig, c.main, (q) => S.torso(q, rig, { expand: rig.sizes.armW * 0.3, neck: 'round', hem: 0.85 }), {
          shade: torsoShade(rig),
          light: (q) => D.ellipse(q, rig.hip.x - rig.sizes.shoulderHalf * 0.4, t.top.y + t.len * 0.35, rig.sizes.shoulderHalf * 0.18, t.len * 0.2),
        });
        D.detailLine(ctx, rig, c.trim, (q) => {
          q.moveTo(t.top.x, t.top.y + t.len * 0.13); q.lineTo(rig.hip.x, rig.hip.y - t.len * 0.2);
          const y = t.top.y + t.len * 0.55;
          q.moveTo(t.L.chest.x + rig.sizes.armW * 0.2, y); q.quadraticCurveTo(rig.hip.x, y + t.len * 0.1, t.R.chest.x - rig.sizes.armW * 0.2, y);
        }, 1.8, true);
      },
      sleeves(ctx, rig, c) {
        sleeves(ctx, rig, c.cloth, 0, 0.9, 1.3, c.main);
        for (const a of rig.arms) {
          const p = U.lerpPt(a.sh, a.el, 0.18), r = rig.sizes.armW * 1.25;
          D.shape(ctx, rig, c.main, (q) => {
            q.ellipse(p.x, p.y, r, r * 0.9, a.s * a.a1, Math.PI, Math.PI * 2);
            q.quadraticCurveTo(p.x, p.y + r * 0.5, p.x - r * Math.cos(a.s * a.a1), p.y - r * Math.sin(a.s * a.a1));
          }, { light: (q) => D.ellipse(q, p.x - r * 0.3, p.y - r * 0.4, r * 0.3, r * 0.15), shade: (q) => q.rect(p.x + r * 0.3, p.y - r * 2, r * 3, r * 4) });
          D.detailLine(ctx, rig, c.trim, (q) => q.ellipse(p.x, p.y, r * 0.98, r * 0.88, a.s * a.a1, Math.PI * 1.05, Math.PI * 1.95), 1.4, true);
        }
      },
    },
  });

  // ---------- Abrigos (se abren por delante) ----------
  function openFront(ctx, rig, color, o) {
    const t = rig.torso, gap = rig.neck.w * (o.gap || 0.35);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.beginPath();
      const cxTop = t.top.x + s * gap, cxBot = rig.hip.x + s * gap * 0.7;
      ctx.moveTo(cxTop, t.top.y - 999); ctx.lineTo(cxTop, t.top.y);
      ctx.lineTo(cxBot, rig.ground + 999); ctx.lineTo(cxBot + s * 9999, rig.ground + 999); ctx.lineTo(cxTop + s * 9999, t.top.y - 999);
      ctx.clip();
      D.shape(ctx, rig, color, (q) => S.torso(q, rig, { expand: rig.sizes.armW * o.expand, neck: 'v', hem: o.hem }), { shade: s > 0 ? torsoShade(rig, 0.7) : null });
      ctx.restore();
      // Borde de la apertura
      const hemY = o.hem > 1 ? rig.torso.R.hip.y + (o.hem - 1) * rig.legLen * 0.6 : U.lerp(t.R.waist.y, t.R.hip.y, o.hem);
      D.detailLine(ctx, rig, D.lineColor(rig, color), (q) => {
        q.moveTo(cxTop, t.top.y + t.len * 0.2 * 0.9);
        q.lineTo(U.lerp(cxTop, cxBot, 1), hemY);
      }, 1, true);
      if (o.lapel) {
        const n = s < 0 ? t.L.neck : t.R.neck;
        D.shape(ctx, rig, U.shade(color, -0.1), (q) => {
          q.moveTo(n.x + s * rig.sizes.armW * 0.3, n.y);
          q.lineTo(n.x + s * rig.neck.w * 0.9, n.y + t.len * 0.12);
          q.lineTo(cxTop + s * rig.neck.w * 0.35, t.top.y + t.len * 0.42);
          q.lineTo(cxTop, t.top.y + t.len * 0.4);
          q.lineTo(cxTop, t.top.y + t.len * 0.15);
        });
      }
    }
  }

  reg({
    slot: 'outer', id: 'chaqueta', name: 'Chaqueta',
    colors: { main: { label: 'Tela', value: '#3c4c63' } },
    layers: {
      outer(ctx, rig, c) { openFront(ctx, rig, c.main, { expand: 0.42, hem: 1.12, lapel: true, gap: 0.55 }); },
      outerSleeves(ctx, rig, c) { sleeves(ctx, rig, c.main, 0, 0.9, 1.55, U.shade(c.main, -0.1)); },
    },
  });

  reg({
    slot: 'outer', id: 'chaleco', name: 'Chaleco',
    colors: { main: { label: 'Tela', value: '#7a3b3b' }, detail: { label: 'Botones', value: '#e2c065' } },
    layers: {
      outer(ctx, rig, c) {
        openFront(ctx, rig, c.main, { expand: 0.3, hem: 1.02, gap: 0.2 });
        const t = rig.torso;
        for (let i = 0; i < 3; i++) {
          const y = U.lerp(t.top.y + t.len * 0.4, rig.hip.y - t.len * 0.1, i / 2);
          button(ctx, rig, c.detail, rig.hip.x - rig.neck.w * 0.35, y, rig.sizes.armW * 0.11);
        }
      },
    },
  });

  reg({
    slot: 'outer', id: 'gabardina', name: 'Abrigo largo',
    colors: { main: { label: 'Tela', value: '#9b7a52' }, belt: { label: 'Cinturón', value: '#5a4128' } },
    layers: {
      outer(ctx, rig, c) {
        openFront(ctx, rig, c.main, { expand: 0.5, hem: 2.25, lapel: true, gap: 0.5 });
        const y = rig.hip.y - rig.torso.len * 0.2;
        for (const s of [-1, 1]) {
          const T = s < 0 ? rig.torso.L : rig.torso.R;
          D.limb(ctx, rig, [{ x: T.waist.x + s * rig.sizes.armW * 0.5, y }, { x: rig.hip.x + s * rig.neck.w * 0.6, y }], rig.torso.len * 0.06, c.belt, { cap: 'butt', shade: false });
        }
      },
      outerSleeves(ctx, rig, c) { sleeves(ctx, rig, c.main, 0, 0.9, 1.6, U.shade(c.main, -0.12)); },
    },
  });

  // ---------- Parte inferior ----------
  function pants(ctx, rig, color, to, wk) {
    for (const leg of rig.legs) D.limb(ctx, rig, S.legSeg(leg, 0, to), rig.sizes.legW * wk, color);
    D.shape(ctx, rig, color, (q) => S.pelvis(q, rig, rig.sizes.legW * 0.15, 1.3), {
      shade: (q) => q.rect(rig.hip.x + rig.sizes.hipHalf * 0.4, 0, 9999, 9999),
    });
    const t = rig.torso;
    D.detailLine(ctx, rig, U.shade(color, -0.35), (q) => {
      q.moveTo(rig.hip.x, U.lerp(t.L.waist.y, t.L.hip.y, 0.3)); q.lineTo(rig.hip.x, t.crotch.y);
    }, 0.8);
  }

  reg({
    slot: 'bottom', id: 'pantalon', name: 'Pantalón',
    colors: { main: { label: 'Tela', value: '#34405e' } },
    layers: { bottom(ctx, rig, c) { pants(ctx, rig, c.main, 0.97, 1.3); } },
  });
  reg({
    slot: 'bottom', id: 'shorts', name: 'Pantalón corto',
    colors: { main: { label: 'Tela', value: '#c79a5a' } },
    layers: { bottom(ctx, rig, c) { pants(ctx, rig, c.main, 0.4, 1.45); } },
  });
  reg({
    slot: 'bottom', id: 'falda', name: 'Falda',
    colors: { main: { label: 'Tela', value: '#2f3f74' }, stripe: { label: 'Franja', value: '#f2f2f2' } },
    layers: { bottom(ctx, rig, c) { skirt(ctx, rig, c.main, 0.36, 1.75, { stripe: c.stripe }); } },
  });
  reg({
    slot: 'bottom', id: 'faldaLarga', name: 'Falda larga',
    colors: { main: { label: 'Tela', value: '#6a4c93' } },
    layers: { bottom(ctx, rig, c) { skirt(ctx, rig, c.main, 0.9, 2.3, { scallop: true }); } },
  });

  // ---------- Calzado ----------
  function shoe(ctx, rig, leg, color, sole) {
    const fl = rig.sizes.footL * 1.15, s = leg.s;
    const x = leg.foot.x + s * fl * 0.08, y = leg.foot.y + rig.line;
    D.shape(ctx, rig, color, (q) => {
      q.moveTo(x - fl * 0.52, y);
      q.lineTo(x + fl * 0.52, y);
      q.quadraticCurveTo(x + fl * 0.6, y - fl * 0.42, x, y - fl * 0.5);
      q.quadraticCurveTo(x - fl * 0.6, y - fl * 0.42, x - fl * 0.52, y);
    }, { light: (q) => D.ellipse(q, x - fl * 0.2, y - fl * 0.32, fl * 0.15, fl * 0.07) , shade: (q) => q.rect(x + fl * 0.15, y - fl, fl, fl * 2) });
    if (sole) D.limb(ctx, rig, [{ x: x - fl * 0.5, y: y - fl * 0.06 }, { x: x + fl * 0.5, y: y - fl * 0.06 }], fl * 0.12, sole, { shade: false });
  }

  reg({
    slot: 'shoes', id: 'zapatillas', name: 'Zapatillas',
    colors: { main: { label: 'Tela', value: '#e04848' }, sole: { label: 'Suela', value: '#f5f5f5' } },
    layers: {
      shoes(ctx, rig, c) {
        for (const leg of rig.legs) {
          D.limb(ctx, rig, S.legSeg(leg, 0.9, 1), rig.sizes.legW * 1.05, c.main, { shade: false });
          shoe(ctx, rig, leg, c.main, c.sole);
          D.detailLine(ctx, rig, c.sole, (q) => {
            const fl = rig.sizes.footL * 1.15, x = leg.foot.x + leg.s * fl * 0.08, y = leg.foot.y;
            for (const k of [0.3, 0.42]) { q.moveTo(x - fl * 0.12, y - fl * k); q.lineTo(x + fl * 0.12, y - fl * k); }
          }, 1);
        }
      },
    },
  });
  reg({
    slot: 'shoes', id: 'botas', name: 'Botas',
    colors: { main: { label: 'Cuero', value: '#6b4630' } },
    layers: {
      shoesOver(ctx, rig, c) {
        for (const leg of rig.legs) {
          D.limb(ctx, rig, S.legSeg(leg, 0.66, 0.98), rig.sizes.legW * 1.28, c.main);
          shoe(ctx, rig, leg, c.main, U.shade(c.main, -0.4));
          D.limb(ctx, rig, S.legSeg(leg, 0.66, 0.7), rig.sizes.legW * 1.42, U.shade(c.main, 0.1), { shade: false, cap: 'butt' });
        }
      },
    },
  });
  reg({
    slot: 'shoes', id: 'zapatos', name: 'Zapatos',
    colors: { main: { label: 'Cuero', value: '#2b2233' } },
    layers: {
      shoes(ctx, rig, c) { for (const leg of rig.legs) shoe(ctx, rig, leg, c.main, null); },
    },
  });
})();
