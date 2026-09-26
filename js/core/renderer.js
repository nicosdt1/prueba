// Renderizado del personaje en dos modos:
//  - Novela visual: vectorial, suavizado, con sombreado y todos los detalles.
//  - Juego: pixel art de baja resolución, con menos detalle, generado a partir
//    del mismo personaje (se dibuja a 4x y se reduce por "moda" de color).
// Sólo usa Canvas 2D, así que funciona en equipos sin tarjeta gráfica dedicada.
SC.render = (() => {
  const U = SC.util;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  // Dibuja el personaje sobre ctx (en coordenadas canónicas 600x1000).
  function drawCharacter(ctx, ch, pose, opts = {}) {
    const expr = SC.EXPRESSIONS[opts.expression || ch.expression] || SC.EXPRESSIONS.neutral;
    const rig = SC.buildRig(ch, pose, Object.assign({}, opts, { expr }));
    const hairSel = ch.slots.hair;
    const hairDef = hairSel && SC.getPart('hair', hairSel.part);
    rig.hairColor = hairDef ? SC.resolveColors(hairDef, hairSel).main : '#4a3226';
    const bodySel = ch.slots.body;
    const bodyDef = bodySel && SC.getPart('body', bodySel.part);
    rig.skinColor = bodyDef ? SC.resolveColors(bodyDef, bodySel).skin : '#f3cdb0';

    const equipped = [];
    for (const slot of SC.SLOTS) {
      const sel = ch.slots[slot.id];
      if (!sel || !sel.part) continue;
      const def = SC.getPart(slot.id, sel.part);
      if (def) equipped.push({ def, colors: SC.resolveColors(def, sel) });
    }
    for (const layer of SC.LAYERS) {
      for (const { def, colors } of equipped) {
        const fn = def.layers[layer.id];
        if (!fn) continue;
        ctx.save();
        if (layer.head) {
          ctx.translate(rig.head.x, rig.head.y);
          ctx.rotate(rig.head.rot);
        }
        fn(ctx, rig, colors);
        ctx.restore();
      }
    }
    return rig;
  }

  // Encuadre de "busto" (cabeza y hombros) para novela visual.
  function bustBox(ch) {
    const rig = SC.buildRig(ch, null);
    const top = rig.head.y - rig.head.h * 0.95;
    const bottom = rig.hip.y - rig.torso.len * 0.15;
    const h = bottom - top, w = h * 0.8;
    return { x: rig.cx - w / 2, y: top, w, h };
  }

  // Novela visual: devuelve un canvas del tamaño pedido.
  function renderVN(ch, pose, o = {}) {
    const scale = o.scale || 1;
    const box = o.frame === 'bust' ? bustBox(ch) : { x: 0, y: 0, w: SC.CANVAS_W, h: SC.CANVAS_H };
    const k = (o.height || SC.CANVAS_H) * scale / box.h;
    const cv = o.canvas || makeCanvas(box.w * k, box.h * k);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(-box.x, -box.y);
    drawCharacter(ctx, ch, pose, {
      detail: 'high',
      line: 3.2 * (ch.style && ch.style.lineWidth != null ? ch.style.lineWidth : 1),
      lineMode: (ch.style && ch.style.lineMode) || 'colored',
      expression: o.expression,
    });
    ctx.restore();
    return cv;
  }

  // Juego: pixel art de w x h píxeles.
  function renderPixel(ch, pose, o = {}) {
    const W = o.w || 48, H = o.h || 64, SS = 4;
    const big = makeCanvas(W * SS, H * SS);
    const bctx = big.getContext('2d');
    const k = (H * SS) / SC.CANVAS_H * (o.fill || 1);
    bctx.save();
    bctx.translate(W * SS / 2, H * SS - (SC.CANVAS_H - 960) * k * 0.5);
    bctx.scale(k, k);
    bctx.translate(-300, -960);
    const bodyOverride = o.chibi ? { heads: 3, height: 1 } : null;
    drawCharacter(bctx, ch, pose, {
      detail: 'low',
      line: o.innerLines === false ? 0 : (SS * 1.05) / k,
      lineMode: o.lineMode || 'colored',
      expression: o.expression,
      bodyOverride,
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
            // Los tonos oscuros (líneas, ojos) pesan más para no perderse.
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

  // Todos los fotogramas de una animación.
  function renderAnimation(ch, animId, mode, o = {}) {
    const anim = SC.ANIMS[animId];
    const frames = [];
    for (let i = 0; i < anim.frames; i++) {
      const pose = anim.pose(i, anim.frames);
      frames.push(mode === 'pixel' ? renderPixel(ch, pose, o) : renderVN(ch, pose, o));
    }
    return frames;
  }

  return { makeCanvas, drawCharacter, renderVN, renderPixel, renderAnimation, bustBox };
})();
