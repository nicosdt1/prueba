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
      items.push({ z: L.z, group: 'lower', draw: () => { call('leg', L); } });
    }
    const zLegMax = Math.max(...body.legs.map((l) => l.z));

    // Torso: piel (detrás de las piernas cercanas) y ropa (delante).
    const T = body.torso;
    items.push({ z: -1, group: 'lower', draw: () => SC.anatomy.drawTorsoSkin(ctx, rig, bodyP.c, T) });
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
    for (const ear of Hd.ears) items.push({ z: ear.front ? 1000.5 : 999, group: 'head', draw: () => SC.anatomy.drawEar(ctx, rig, bodyP.c, ear) });
    items.push({
      group: 'head',
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
    items.forEach((it, i) => {
      if (SC.ID) SC.ID.item = it.group || i;
      ctx.save();
      it.draw(ctx);
      ctx.restore();
    });
    rig.bodyModel = body;
    return rig;
  }

  function vnDrawOpts(ch, o = {}) {
    return {
      detail: 'high',
      line: 1.7 * (ch.style && ch.style.lineWidth != null ? ch.style.lineWidth : 1),
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

  // Dibuja el personaje en un lienzo auxiliar y lo compone con un contorno
  // exterior grueso (las líneas interiores quedan finas, como en ilustración).
  let _off = null, _sil = null;
  function paintVN(ctx, W, H, transform, ch, pose, o = {}) {
    if (!_off) { _off = makeCanvas(W, H); _sil = makeCanvas(W, H); }
    if (_off.width !== W || _off.height !== H) { _off.width = _sil.width = W; _off.height = _sil.height = H; }
    const octx = _off.getContext('2d');
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, W, H);
    octx.setTransform(...transform);
    const rig = drawCharacter(octx, ch, pose, vnDrawOpts(ch, o));
    const lw = ch.style && ch.style.lineWidth != null ? ch.style.lineWidth : 1;
    const r = 1.7 * lw * transform[0];
    if (r > 0.3) {
      const sctx = _sil.getContext('2d');
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, W, H);
      sctx.globalCompositeOperation = 'source-over';
      sctx.drawImage(_off, 0, 0);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = (ch.style && ch.style.lineMode) === 'dark' ? '#1e1628' : '#3b2a44';
      sctx.fillRect(0, 0, W, H);
      sctx.globalCompositeOperation = 'source-over';
      const n = 10;
      for (let i = 0; i < n; i++) ctx.drawImage(_sil, Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r);
    }
    ctx.drawImage(_off, 0, 0);
    return rig;
  }

  function renderVN(ch, pose, o = {}) {
    const scale = o.scale || 1;
    const box = o.frame === 'bust' ? bustBox(ch) : { x: 0, y: 0, w: SC.CANVAS_W, h: SC.CANVAS_H };
    const k = ((o.height || SC.CANVAS_H) * scale) / box.h;
    const cv = o.canvas || makeCanvas(box.w * k, box.h * k);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    paintVN(ctx, cv.width, cv.height, [k, 0, 0, k, -box.x * k, -box.y * k], ch, pose, o);
    return cv;
  }

  // ---------- Pixel art ----------
  // Tubería: (1) pase de identificadores, cada volumen con un color único;
  // (2) pase de color con sombreado plano; (3) reducción por bloques eligiendo
  // la pieza dominante y su color; (4) limpieza de píxeles sueltos;
  // (5) ojos y boca dibujados píxel a píxel; (6) contornos: por fuera y entre
  // piezas (la línea va en la pieza que queda detrás, como en el pixel art a mano).
  function makeIds() {
    const list = [null];
    return {
      item: 0, list,
      color(c) {
        const id = list.length;
        list.push({ color: c, item: this.item });
        return `rgb(${id & 255},${(id >> 8) & 255},${(id >> 16) & 255})`;
      },
    };
  }

  function renderPixel(ch, pose, o = {}) {
    const W = o.w || 48, H = o.h || 64, SS = 4;
    const k = ((H * SS) / SC.CANVAS_H) * (o.fill || 1);
    const ty = H * SS - (SC.CANVAS_H - SC.GROUND) * k * 0.5;
    const opts = {
      detail: 'low', line: 0, pixel: true,
      expression: o.expression, view: o.view,
      bodyOverride: o.chibi ? { heads: 3, height: 1 } : null,
      tilt: 0.2,
    };
    const pass = (ids) => {
      const cv = makeCanvas(W * SS, H * SS), c = cv.getContext('2d');
      c.translate((W * SS) / 2, ty);
      c.scale(k, k);
      c.translate(-300, -SC.GROUND);
      SC.ID = ids;
      let rig;
      try { rig = drawCharacter(c, ch, pose, opts); } finally { SC.ID = null; }
      return { data: c.getImageData(0, 0, W * SS, H * SS).data, rig };
    };
    const ids = makeIds();
    const idPass = pass(ids), colPass = pass(null);
    const rig = colPass.rig;
    const idd = idPass.data, cd = colPass.data;

    // (3) Reducción
    const N = W * H, pid = new Int32Array(N), pr = new Uint8ClampedArray(N * 4);
    const cnt = new Map(), cc = new Map();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        cnt.clear();
        for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
          const i = ((y * SS + yy) * W * SS + (x * SS + xx)) * 4;
          if (idd[i + 3] < 128) continue;
          const id = idd[i] | (idd[i + 1] << 8) | (idd[i + 2] << 16);
          if (!ids.list[id]) continue;
          cnt.set(id, (cnt.get(id) || 0) + 1);
        }
        let best = 0, bn = 0, tot = 0;
        for (const [id, n] of cnt) { tot += n; if (n > bn) { bn = n; best = id; } }
        const j = y * W + x;
        if (tot < SS * SS * 0.45 || !best) continue;
        cc.clear();
        let bc = null, bcn = 0;
        for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) {
          const i = ((y * SS + yy) * W * SS + (x * SS + xx)) * 4;
          const id = idd[i] | (idd[i + 1] << 8) | (idd[i + 2] << 16);
          if (id !== best || cd[i + 3] < 128) continue;
          const key = (cd[i] << 16) | (cd[i + 1] << 8) | cd[i + 2];
          const n = (cc.get(key) || 0) + 1;
          cc.set(key, n);
          if (n > bcn) { bcn = n; bc = key; }
        }
        if (bc == null) { const c0 = U.hexToRgb(ids.list[best].color); bc = (c0.r << 16) | (c0.g << 8) | c0.b; }
        pid[j] = best;
        pr[j * 4] = (bc >> 16) & 255; pr[j * 4 + 1] = (bc >> 8) & 255; pr[j * 4 + 2] = bc & 255; pr[j * 4 + 3] = 255;
      }
    }
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : pid[y * W + x]);
    const setPx = (x, y, hex) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const c = U.hexToRgb(hex), j = (y * W + x) * 4;
      pr[j] = c.r; pr[j + 1] = c.g; pr[j + 2] = c.b; pr[j + 3] = 255;
    };
    const getHex = (x, y) => { const j = (y * W + x) * 4; return U.rgbToHex(pr[j], pr[j + 1], pr[j + 2]); };

    // (4) Píxeles sueltos: si los 4 vecinos son de otra misma pieza, se unen a ella.
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const j = y * W + x, a = pid[j];
        const n = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
        if (a && n[0] && n.every((v) => v === n[0]) && n[0] !== a) {
          pid[j] = n[0];
          const s2 = ((y * W + x + 1) * 4);
          pr[j * 4] = pr[s2]; pr[j * 4 + 1] = pr[s2 + 1]; pr[j * 4 + 2] = pr[s2 + 2];
        }
      }
    }

    // (5) Cara píxel a píxel
    const mapX = (x) => ((W * SS) / 2 + (x - 300) * k) / SS;
    const mapY = (y) => (ty + (y - SC.GROUND) * k) / SS;
    pixelFace(rig, ids, pid, W, H, mapX, mapY, (rig.head.h * k) / SS, setPx);

    // (6) Contornos
    const inner = o.innerLines !== false, outer = o.outline !== false;
    const dark = o.lineMode === 'dark';
    const out = new Uint8ClampedArray(pr);
    const joinable = (a, b) => {
      const A = ids.list[a], B = ids.list[b];
      return A.item === B.item && A.color === B.color;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j = y * W + x, a = pid[j];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        if (!a) {
          if (!outer) continue;
          for (const [dx, dy] of nb) {
            const b = at(x + dx, y + dy);
            if (!b) continue;
            const col = dark ? '#1e1628' : U.multiply(getHex(x + dx, y + dy), '#4d3d5c');
            const c = U.hexToRgb(col), q = j * 4;
            out[q] = c.r; out[q + 1] = c.g; out[q + 2] = c.b; out[q + 3] = 255;
            break;
          }
          continue;
        }
        if (!inner || !ids.list[a]) continue;
        for (const [dx, dy] of nb) {
          const b = at(x + dx, y + dy);
          if (!b || b <= a || !ids.list[b] || joinable(a, b)) continue;
          const c = U.hexToRgb(U.multiply(getHex(x, y), dark ? '#5a4a66' : '#8a7494')), q = j * 4;
          out[q] = c.r; out[q + 1] = c.g; out[q + 2] = c.b;
          break;
        }
      }
    }
    const small = makeCanvas(W, H), sctx = small.getContext('2d');
    const img = sctx.createImageData(W, H);
    img.data.set(out);
    sctx.putImageData(img, 0, 0);
    return small;
  }

  // Ojos, boca y rubor colocados a mano sobre la rejilla de píxeles.
  function pixelFace(rig, ids, pid, W, H, mapX, mapY, hp, setPx) {
    const Hd = rig.bodyModel.head, F = rig.face, e = rig.expr;
    const skin = rig.skinColor;
    const isSkin = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const id = pid[y * W + x];
      return id && ids.list[id] && ids.list[id].color === skin;
    };
    const eyesPart = rig.equipped.find((p) => p.slot === 'eyes');
    const iris = eyesPart ? eyesPart.c.iris : '#3f7fd6';
    const lash = U.mix(U.shade(rig.hairColor, -0.7), '#1c1422', 0.5);
    const big = hp >= 18, mid = hp >= 12;
    for (const s of [-1, 1]) {
      const f = SC.face.frame(rig, Hd, F.eye, s * F.eyePhi);
      if (f.facing < 0.12) continue;
      const cx = Math.round(mapX(f.x) - 0.5), cy = Math.round(mapY(f.y) - (big ? 1.5 : 1));
      const w = mid && f.fs > 0.6 ? 2 : 1, x0 = cx - (w === 2 && s * f.dir < 0 ? 1 : 0);
      let state = rig.pose.blink ? 'closed' : e.eyes;
      if (state === 'wink') state = s > 0 ? 'happy' : 'open';
      if (!isSkin(cx, cy + 1)) continue;
      if (state === 'closed' || state === 'happy') {
        for (let i = 0; i < w; i++) setPx(x0 + i, cy + 1, lash);
        continue;
      }
      const hgt = big ? 3 : 2;
      for (let i = 0; i < w; i++) {
        setPx(x0 + i, cy, lash);
        for (let r = 1; r < hgt; r++) setPx(x0 + i, cy + r, r === hgt - 1 && big ? U.shade(iris, 0.25) : iris);
      }
      if (big && w === 2) setPx(x0 + (s * f.dir > 0 ? 0 : 1), cy + 1, '#ffffff');
      if (rig.fem && mid) setPx(s * f.dir > 0 ? x0 + w : x0 - 1, cy, lash);
      if (e.blush > 0 && mid && isSkin(x0, cy + hgt + 1)) setPx(x0 + (s * f.dir > 0 ? 1 : 0), cy + hgt + 1, U.mix(skin, '#ff6f86', 0.45));
    }
    if (mid) {
      const fm = SC.face.frame(rig, Hd, F.mouth, 0);
      const mx = Math.round(mapX(fm.x) - 0.5), my = Math.round(mapY(fm.y) - 0.5);
      if (fm.facing > 0.1 && isSkin(mx, my)) {
        const kind = rig.pose.mouth || e.mouth;
        if (/grin|o|talkA|angry/.test(kind)) { setPx(mx, my, '#7a2a35'); if (big) setPx(mx + 1, my, '#7a2a35'); } else if (big) setPx(mx, my, U.multiply(skin, '#c58a8a'));
      }
    }
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

  return { makeCanvas, drawCharacter, vnDrawOpts, paintVN, renderVN, renderPixel, renderAnimation, bustBox };
})();
