// Renderizado del personaje.
//
// Se construye una lista de elementos con profundidad (z) — piernas, torso,
// brazos, cabeza, pelo, capas... — y se pintan de atrás hacia delante
// (algoritmo del pintor). Como la profundidad se calcula tras girar el
// personaje, el orden correcto sale solo en cualquier vista.
//
// Modos:
//  - Novela visual: vectorial, suavizado, con sombreado y todos los detalles.
//  - Juego: pixel art de baja resolución generado a partir del mismo personaje.
SC.render = (() => {
  const U = SC.util, V = SC.V;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function equippedParts(ch) {
    const list = [];
    for (const slot of SC.SLOTS) {
      const sel = ch.slots[slot.id];
      if (!sel || !sel.part) continue;
      const def = SC.getPart(slot.id, sel.part);
      if (def) list.push({ slot: slot.id, def, c: SC.resolveColors(def, sel) });
    }
    return list;
  }

  function drawCharacter(ctx, ch, pose, opts = {}) {
    const expr = SC.EXPRESSIONS[opts.expression || ch.expression] || SC.EXPRESSIONS.neutral;
    const view = SC.VIEWS[opts.view || 'front'] || SC.VIEWS.front;
    const rig = SC.buildRig(ch, pose, Object.assign({}, opts, { expr, yaw: view.yaw }));
    const parts = equippedParts(ch);
    const get = (slot) => parts.find((p) => p.slot === slot);
    const bodyP = get('body'), hairP = get('hair');
    rig.skinColor = bodyP ? bodyP.c.skin : '#f3cdb0';
    rig.hairColor = hairP ? hairP.c.main : '#4a3226';
    rig.equipped = parts;
    rig.hasShoes = !!get('shoes');
    rig.earType = bodyP ? bodyP.def.earType : 'human';

    const body = SC.anatomy.build(rig);
    const items = [];
    const byRank = (fn) => parts.filter((p) => p.def[fn]).sort((a, b) => a.def.rank - b.def.rank);
    const call = (fn, ...args) => { for (const p of byRank(fn)) p.def[fn](ctx, rig, p.c, ...args); };

    // Piernas
    for (const L of body.legs) {
      items.push({ z: L.z, draw: () => { call('leg', L); } });
    }
    const zLegMax = Math.max(...body.legs.map((l) => l.z));

    // Torso: piel (detrás de las piernas cercanas) y ropa (delante).
    const T = body.torso;
    items.push({ z: -1, draw: () => SC.anatomy.drawTorsoSkin(ctx, rig, bodyP.c, T) });
    items.push({
      z: zLegMax + 0.1,
      draw: () => {
        for (const p of byRank('torso')) {
          p.def.torso(ctx, rig, p.c, T);
          if (p.def.opening) {
            const pts = p.def.opening(rig, T);
            const P = V.project(rig, T.at, pts);
            if (P.filter((q) => q.f > 0.05).length / P.length > 0.3) {
              ctx.save();
              V.clip(ctx, T.clothVol || T.vol);
              ctx.beginPath(); SC.draw.poly(ctx, P); ctx.clip();
              SC.anatomy.drawTorsoSkin(ctx, rig, bodyP.c, T);
              for (const q of byRank('torso')) if (q.def.rank < p.def.rank) q.def.torso(ctx, rig, q.c, T);
              ctx.restore();
              if (p.def.openingEdge) p.def.openingEdge(ctx, rig, p.c, T, P);
            }
          }
        }
      },
    });

    // Brazos
    for (const A of body.arms) {
      items.push({ z: A.z, draw: () => { call('arm', A); SC.anatomy.drawHand(ctx, rig, bodyP.c, A); } });
    }

    // Cabeza y pelo
    const Hd = body.head;
    for (const ear of Hd.ears) items.push({ z: ear.front ? 1000.5 : 999, draw: () => SC.anatomy.drawEar(ctx, rig, bodyP.c, ear) });
    items.push({
      z: 1000,
      draw: () => {
        SC.anatomy.drawHead(ctx, rig, bodyP.c, Hd);
      },
    });
    items.push({
      z: 1000.6,
      draw: () => {
        ctx.save();
        V.clip(ctx, Hd.vol);
        call('face', Hd);
        ctx.restore();
      },
    });
    items.push({ z: 1000.7, draw: () => call('glasses', Hd) });
    items.push({ z: 1001, draw: () => call('hairShell', Hd) });
    items.push({ z: 1002, draw: () => call('hairFront', Hd) });
    items.push({ z: 1003, draw: () => call('hat', Hd) });

    for (const p of parts) if (p.def.items) for (const it of p.def.items(rig, p.c, body)) items.push(it);

    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      ctx.save();
      it.draw(ctx);
      ctx.restore();
    }
    return rig;
  }

  function vnDrawOpts(ch, o = {}) {
    return {
      detail: 'high',
      line: 2.6 * (ch.style && ch.style.lineWidth != null ? ch.style.lineWidth : 1),
      lineMode: (ch.style && ch.style.lineMode) || 'colored',
      expression: o.expression,
      view: o.view,
    };
  }

  // Encuadre de "busto" (cabeza y hombros) para novela visual.
  function bustBox(ch) {
    const rig = SC.buildRig(ch, null);
    const top = rig.head.c.y - rig.head.h * 0.85;
    const bottom = rig.torso.at(rig.torso.L.underbust).c.y;
    const h = bottom - top, w = h * 0.85;
    return { x: rig.cx - w / 2, y: top, w, h };
  }

  function renderVN(ch, pose, o = {}) {
    const scale = o.scale || 1;
    const box = o.frame === 'bust' ? bustBox(ch) : { x: 0, y: 0, w: SC.CANVAS_W, h: SC.CANVAS_H };
    const k = ((o.height || SC.CANVAS_H) * scale) / box.h;
    const cv = o.canvas || makeCanvas(box.w * k, box.h * k);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-box.x, -box.y);
    drawCharacter(ctx, ch, pose, vnDrawOpts(ch, o));
    ctx.restore();
    return cv;
  }

  // Juego: pixel art de w x h píxeles.
  function renderPixel(ch, pose, o = {}) {
    const W = o.w || 48, H = o.h || 64, SS = 4;
    const big = makeCanvas(W * SS, H * SS);
    const bctx = big.getContext('2d');
    const k = ((H * SS) / SC.CANVAS_H) * (o.fill || 1);
    bctx.save();
    bctx.translate((W * SS) / 2, H * SS - (SC.CANVAS_H - SC.GROUND) * k * 0.5);
    bctx.scale(k, k);
    bctx.translate(-300, -SC.GROUND);
    drawCharacter(bctx, ch, pose, {
      detail: 'low',
      line: o.innerLines === false ? 0 : (SS * 0.9) / k,
      lineMode: o.lineMode || 'colored',
      expression: o.expression,
      view: o.view,
      bodyOverride: o.chibi ? { heads: 3, height: 1 } : null,
    });
    bctx.restore();

    const small = makeCanvas(W, H);
    const src = bctx.getImageData(0, 0, W * SS, H * SS).data;
    const sctx = small.getContext('2d');
    const out = sctx.createImageData(W, H);
    const dst = out.data;
    const counts = new Map();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        counts.clear();
        let opaque = 0;
        for (let yy = 0; yy < SS; yy++) {
          for (let xx = 0; xx < SS; xx++) {
            const i = ((y * SS + yy) * W * SS + (x * SS + xx)) * 4;
            if (src[i + 3] < 110) continue;
            opaque++;
            const r = src[i], g = src[i + 1], b = src[i + 2];
            const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
            const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
            const wgt = 1 + (lum < 0.3 ? 1.6 : 0);
            const e = counts.get(key);
            if (e) e.n += wgt; else counts.set(key, { n: wgt, r, g, b });
          }
        }
        const j = (y * W + x) * 4;
        if (opaque < SS * SS * 0.42) continue;
        let best = null;
        for (const e of counts.values()) if (!best || e.n > best.n) best = e;
        dst[j] = best.r; dst[j + 1] = best.g; dst[j + 2] = best.b; dst[j + 3] = 255;
      }
    }
    if (o.outline !== false) {
      const oc = U.hexToRgb(o.outlineColor || '#1e1628');
      const copy = new Uint8ClampedArray(dst);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const j = (y * W + x) * 4;
          if (copy[j + 3]) continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            return nx >= 0 && ny >= 0 && nx < W && ny < H && copy[(ny * W + nx) * 4 + 3];
          });
          if (near) { dst[j] = oc.r; dst[j + 1] = oc.g; dst[j + 2] = oc.b; dst[j + 3] = 255; }
        }
      }
    }
    sctx.putImageData(out, 0, 0);
    return small;
  }

  function renderAnimation(ch, animId, mode, o = {}) {
    const anim = SC.ANIMS[animId];
    const frames = [];
    for (let i = 0; i < anim.frames; i++) {
      const pose = anim.pose(i, anim.frames);
      frames.push(mode === 'pixel' ? renderPixel(ch, pose, o) : renderVN(ch, pose, o));
    }
    return frames;
  }

  return { makeCanvas, drawCharacter, vnDrawOpts, renderVN, renderPixel, renderAnimation, bustBox };
})();
