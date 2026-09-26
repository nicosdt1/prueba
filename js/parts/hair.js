// Peinados. Cada uno tiene una capa trasera (detrás de la cabeza y el cuerpo)
// y una delantera (flequillo y coronilla). Los puntos están normalizados al
// radio de la cabeza, así que se adaptan a cabezas realistas o chibi.
(() => {
  const U = SC.util, D = SC.draw;

  const CROWN = [[-1.08, 0], [-1.13, -0.38], [-0.8, -0.93], [0, -1.13], [0.8, -0.93], [1.13, -0.38], [1.08, 0]];
  const HAIRLINE = [[1.0, 0.25], [0.93, -0.15], [0.55, -0.55], [0, -0.64], [-0.55, -0.55], [-0.93, -0.15], [-1.0, 0.25]];
  const NAPE = [[-1.13, -0.3], [-0.8, -0.96], [0, -1.15], [0.8, -0.96], [1.13, -0.3], [1.1, 0.42], [0.72, 0.6], [-0.72, 0.6], [-1.1, 0.42]];

  function bumps(cx, cy, r, n, amp, from = 0, to = Math.PI * 2) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = from + (to - from) * (i / n);
      const rr = r * (1 + (i % 2 ? amp : -amp * 0.3));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  }

  const STYLES = {
    corto: {
      name: 'Corto', sideY: 0.3,
      bangs: [[1.0, 0.32], [0.86, -0.12], [0.7, 0.06], [0.5, -0.3], [0.3, -0.02], [0.1, -0.34], [-0.12, -0.06], [-0.35, -0.36], [-0.55, 0.02], [-0.72, -0.2], [-0.87, 0.06], [-1.0, 0.32]],
      back: [NAPE],
    },
    largo: {
      name: 'Largo', sideY: 1.05, soft: true,
      bangs: [[1.14, 1.2], [0.86, 1.02], [0.8, 0.3], [0.72, -0.08], [0.5, 0.08], [0.3, -0.22], [0.08, 0.02], [-0.18, -0.26], [-0.42, 0.06], [-0.7, -0.08], [-0.8, 0.3], [-0.86, 1.02], [-1.14, 1.2]],
      back: [[[-1.15, -0.3], [-0.8, -0.97], [0, -1.15], [0.8, -0.97], [1.15, -0.3], [1.32, 1.0], [1.42, 2.2], [1.25, 2.85], [0.6, 2.95], [0, 2.8], [-0.6, 2.95], [-1.25, 2.85], [-1.42, 2.2], [-1.32, 1.0]]],
    },
    bob: {
      name: 'Media melena', sideY: 0.66,
      bangs: [[1.16, 0.68], [0.9, 0.62], [0.88, 0.0], [0.76, -0.16], [0.5, -0.1], [0.25, -0.16], [0, -0.1], [-0.25, -0.16], [-0.5, -0.1], [-0.76, -0.16], [-0.88, 0.0], [-0.9, 0.62], [-1.16, 0.68]],
      back: [[[-1.15, -0.3], [-0.8, -0.97], [0, -1.15], [0.8, -0.97], [1.15, -0.3], [1.22, 0.5], [1.08, 0.76], [0, 0.82], [-1.08, 0.76], [-1.22, 0.5]]],
    },
    coletas: {
      name: 'Coletas', sideY: 0.4, ties: [[-1.05, -0.6], [1.05, -0.6]],
      bangs: [[1.05, 0.42], [0.9, 0.35], [0.86, -0.05], [0.7, -0.16], [0.45, -0.08], [0.22, -0.2], [0, -0.1], [-0.22, -0.2], [-0.45, -0.08], [-0.7, -0.16], [-0.86, -0.05], [-0.9, 0.35], [-1.05, 0.42]],
      back: [NAPE, ...[-1, 1].map((s) => [[s * 0.85, -0.78], [s * 1.35, -0.62], [s * 1.75, 0.2], [s * 1.88, 1.2], [s * 1.65, 2.3], [s * 1.45, 2.7], [s * 1.38, 1.7], [s * 1.2, 0.55], [s * 0.95, -0.2]])],
    },
    coleta: {
      name: 'Coleta', sideY: 0.3, ties: [[1.0, -0.62]],
      bangs: [...HAIRLINE.slice(0, 3), [0.2, -0.62], [-0.1, -0.2], [-0.3, -0.6], ...HAIRLINE.slice(4)],
      back: [NAPE, [[0.55, -0.95], [1.28, -0.82], [1.62, -0.2], [1.6, 0.8], [1.35, 1.75], [1.28, 0.85], [1.12, 0.05], [0.85, -0.42]]],
    },
    punta: {
      name: 'De punta', sideY: 0.25, spiky: true,
      crown: [[-1.08, 0.25], [-1.38, -0.18], [-1.06, -0.42], [-1.32, -0.86], [-0.72, -0.84], [-0.78, -1.36], [-0.22, -1.04], [0.08, -1.52], [0.36, -1.04], [0.86, -1.36], [0.8, -0.8], [1.36, -0.82], [1.06, -0.4], [1.4, -0.12], [1.08, 0.25]],
      bangs: [[0.98, 0.3], [0.76, -0.18], [0.56, 0.24], [0.36, -0.26], [0.12, 0.14], [-0.14, -0.3], [-0.36, 0.2], [-0.56, -0.24], [-0.76, 0.12], [-0.98, 0.3]],
      back: [NAPE],
    },
    mono: {
      name: 'Moño', sideY: 0.3, soft: true, ties: [[0, -1.12]],
      bangs: [...HAIRLINE],
      back: [bumps(0, -1.38, 0.46, 16, 0.04), NAPE],
    },
    rizado: {
      name: 'Rizado', sideY: 0.35, soft: true,
      crown: bumps(0, -0.2, 1.22, 12, 0.07, Math.PI * 1.02, Math.PI * 1.98),
      bangs: [[1.1, 0.35], [0.9, -0.1], [0.72, -0.28], [0.5, -0.12], [0.3, -0.3], [0.05, -0.14], [-0.2, -0.3], [-0.45, -0.12], [-0.7, -0.28], [-0.9, -0.1], [-1.1, 0.35]],
      back: [bumps(0, -0.15, 1.5, 26, 0.06)],
    },
    rapado: {
      name: 'Rapado', sideY: 0.1, soft: true, thin: true,
      crown: [[-1.02, 0.1], [-1.05, -0.38], [-0.76, -0.9], [0, -1.05], [0.76, -0.9], [1.05, -0.38], [1.02, 0.1]],
      bangs: [[0.98, 0.1], [0.9, -0.3], [0.5, -0.66], [0, -0.72], [-0.5, -0.66], [-0.9, -0.3], [-0.98, 0.1]],
      back: [],
    },
  };

  function frontPath(q, rig, st) {
    const rx = rig.head.w / 2, ry = rig.head.h / 2;
    const P = (p) => ({ x: p[0] * rx, y: p[1] * ry });
    const crown = (st.crown || CROWN.map((p, i) => (i === 0 || i === CROWN.length - 1 ? [p[0], st.sideY] : p))).map(P);
    if (st.spiky) D.poly(q, crown); else D.smooth(q, crown);
    const bangs = st.bangs.map(P);
    if (st.soft) D.smooth(q, [crown[crown.length - 1], ...bangs], false, false);
    else for (const b of bangs) q.lineTo(b.x, b.y);
  }

  function highlight(q, rig) {
    const rx = rig.head.w / 2, ry = rig.head.h / 2;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.2 + i * 0.13);
      D.ellipse(q, Math.cos(a) * rx * 0.72, -ry * 0.25 + Math.sin(a) * ry * 0.52, rx * 0.1, ry * 0.035, a + Math.PI / 2);
    }
  }

  function strands(ctx, rig, c) {
    const rx = rig.head.w / 2, ry = rig.head.h / 2;
    D.detailLine(ctx, rig, U.shade(c.main, -0.35), (q) => {
      for (const x of [-0.6, -0.25, 0.15, 0.5]) {
        q.moveTo(x * 0.4 * rx, -ry * 1.0);
        q.quadraticCurveTo(x * 1.05 * rx, -ry * 0.75, x * 1.25 * rx, -ry * 0.28);
      }
    }, 0.7);
  }

  for (const [id, st] of Object.entries(STYLES)) {
    const colors = { main: { label: 'Pelo', value: '#6b3f2a' } };
    if (st.ties) colors.tie = { label: 'Lazo', value: '#e0445e' };
    SC.registerPart({
      slot: 'hair', id, name: st.name, colors,
      layers: {
        hairBack(ctx, rig, c) {
          const rx = rig.head.w / 2, ry = rig.head.h / 2;
          for (const shape of st.back) {
            D.shape(ctx, rig, U.shade(c.main, -0.08), (q) => D.smooth(q, shape.map((p) => ({ x: p[0] * rx, y: p[1] * ry })), true), {
              shade: (q) => q.rect(-rx * 3, ry * 0.4, rx * 6, ry * 6),
            });
          }
        },
        hairFront(ctx, rig, c) {
          const rx = rig.head.w / 2, ry = rig.head.h / 2;
          if (rig.detail === 'high' && !st.thin) {
            // Sombra del flequillo sobre la frente.
            ctx.save();
            ctx.beginPath(); SC.headPath(ctx, rig); ctx.clip();
            ctx.translate(rx * 0.04, ry * 0.08);
            ctx.beginPath(); frontPath(ctx, rig, st); ctx.closePath();
            ctx.fillStyle = U.shade(rig.skinColor || '#f3cdb0', -0.18);
            ctx.fill();
            ctx.restore();
          }
          D.shape(ctx, rig, c.main, (q) => frontPath(q, rig, st), {
            shade: (q) => { D.ellipse(q, rx * 1.1, ry * 0.2, rx * 0.5, ry * 1.2); },
            light: st.thin ? null : (q) => highlight(q, rig),
          });
          if (!st.thin) strands(ctx, rig, c);
          for (const t of st.ties || []) {
            const x = t[0] * rx, y = t[1] * ry, r = rx * 0.14;
            D.shape(ctx, rig, c.tie, (q) => {
              q.moveTo(x, y);
              q.lineTo(x - r * 1.5, y - r); q.lineTo(x - r * 1.5, y + r); q.closePath();
              q.moveTo(x, y);
              q.lineTo(x + r * 1.5, y - r); q.lineTo(x + r * 1.5, y + r); q.closePath();
            });
            D.shape(ctx, rig, c.tie, (q) => D.ellipse(q, x, y, r * 0.55, r * 0.55));
          }
        },
      },
    });
  }
})();
