// Cara anime proyectada (sección 4.2–4.4 de docs/correccion-visual.md).
// Ojos, cejas, boca, nariz y rubor son trazos diseñados en un plano frontal:
// se anclan con un rayo sobre la superficie de la cabeza, se dibujan en un
// marco tangente con escorzo estilizado f = 0.55 + 0.45·max(0, n·v) y se
// recortan con la máscara de la cabeza. En pixel art pequeño se usan sellos.
SC.sdfFace = (() => {
  const M = SC.AM, C = SC.CANON;
  const W8 = (w, k, d = 0) => (w[k] != null ? w[k] : d);

  // Ancla un rasgo (u, v en espacio de cabeza) sobre la superficie.
  function anchor(f, scene, headIdx, cam, u, v) {
    const hs = SC.sdfBuild.headSpace(f), fwd = M.mv(f.rot.head, [0, 0, 1]);
    const hit = SC.sdfMarch.raycast(scene, hs(u, v, 1.6), M.mul(fwd, -1), 3, [headIdx]);
    if (!hit) return null;
    const P = cam.project(hit.p);
    const right = M.mv(f.rot.head, [1, 0, 0]), up = M.mv(f.rot.head, [0, 1, 0]);
    const pr = cam.project(M.add(hit.p, M.mul(right, 0.1))), pu = cam.project(M.add(hit.p, M.mul(up, 0.1)));
    let rx = pr.x - P.x, ry = pr.y - P.y, ux = pu.x - P.x, uy = pu.y - P.y;
    const lr = Math.hypot(rx, ry) || 1, lu = Math.hypot(ux, uy) || 1;
    rx /= lr; ry /= lr; ux /= lu; uy /= lu;
    const nv = M.dot(hit.n, cam.f);
    return { x: P.x, y: P.y, z: P.z, rx, ry, ux, uy, nv, fs: 0.55 + 0.45 * Math.max(0, nv), p: hit.p };
  }

  // Marco local: x+ = derecha de la cabeza escorzada, y+ = hacia abajo; unidad = 1 px.
  function withFrame(ctx, A, mirror, fn) {
    ctx.save();
    ctx.setTransform(A.rx * A.fs * mirror, A.ry * A.fs * mirror, -A.ux, -A.uy, A.x, A.y);
    fn();
    ctx.restore();
  }

  // Oculto si algo (nariz, pelo) queda delante del ancla en el G-buffer.
  function visible(g, A, tol = 0.04) {
    if (A.nv < -0.05) return false;
    const x = Math.round(A.x - 0.5), y = Math.round(A.y - 0.5);
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) return false;
    const d = g.depth[y * g.W + x];
    return !Number.isNaN(d) && d <= A.z + tol;
  }

  // ---------- 4.3 Ojo anime ----------
  function drawEye(ctx, o) {
    const { ew, open0, iris, skin, lineC, lw, male, smile, openW, lightSign, pix, chibi } = o;
    const open = M.clamp(openW * (1 - 0.5 * smile), 0, 1.25);
    const hw = ew / 2, eh = ew * (male ? 0.7 : 1.0) * (chibi ? 1.1 : 0.9) * open0;
    if (open < 0.12) {
      SC.draw.stroke(ctx, lineC, lw * 1.6, (q) => { q.moveTo(-hw, 0); q.quadraticCurveTo(0, smile > 0.3 ? -eh * 0.55 : eh * 0.3, hw, smile > 0.3 ? 0 : -eh * 0.05); });
      if (!male && !pix) SC.draw.stroke(ctx, lineC, lw, (q) => { q.moveTo(hw * 0.95, 0); q.lineTo(hw * 1.25, -eh * 0.15); });
      return;
    }
    const top = -eh * 0.62 * open, bot = eh * 0.38 * Math.min(1, open + 0.1) - smile * eh * 0.3;
    const lift = male ? 0.05 : 0.12;
    const upper = (q) => { q.moveTo(-hw, eh * 0.02); q.bezierCurveTo(-hw * 0.55, top * 1.08, hw * 0.4, top * 1.1, hw, top * (0.35 + lift)); };
    const shape = (q) => {
      upper(q);
      q.bezierCurveTo(hw * 0.9, bot * 0.55, hw * 0.35, bot, -hw * 0.1, bot);
      q.bezierCurveTo(-hw * 0.6, bot, -hw * 0.95, eh * 0.3, -hw, eh * 0.02);
      q.closePath();
    };
    SC.draw.fill(ctx, '#fbf8fc', shape);
    ctx.save();
    ctx.beginPath(); shape(ctx); ctx.clip();
    // Iris: elipse vertical, ancho 0.6 e_w (0.5 en hombre), alto 95 % de la apertura, cortado por el párpado.
    const iw = ew * (male ? 0.25 : 0.3) * (chibi ? 1.2 : 1), ih = (bot - top) * 0.95 / 2 / Math.max(0.6, open) * 1.05;
    const ix = W8(o, 'look', 0) * hw * 0.3, iy = (top + bot) / 2 + (bot - top) * 0.04;
    const g = ctx.createLinearGradient(0, iy - ih, 0, iy + ih);
    g.addColorStop(0, M.ramp(iris, -2)); g.addColorStop(0.5, iris); g.addColorStop(1, M.ramp(iris, 1.2));
    ctx.fillStyle = g;
    ctx.beginPath(); SC.draw.ellipse(ctx, ix, iy, iw, ih); ctx.fill();
    SC.draw.stroke(ctx, M.ramp(iris, -2.5), lw * 0.5, (q) => SC.draw.ellipse(q, ix, iy, iw, ih));
    // Pupila: 45 % del iris, un 5 % más arriba.
    SC.draw.fill(ctx, M.ramp(iris, -3), (q) => SC.draw.ellipse(q, ix, iy - ih * 0.05, iw * 0.45, ih * 0.45));
    // Sombra bajo el párpado superior (15 % del alto).
    ctx.globalAlpha = 0.4;
    SC.draw.fill(ctx, M.ramp(skin, -1.5), (q) => q.rect(-hw * 1.2, top - eh, hw * 2.4, eh + (bot - top) * 0.15 + 1));
    ctx.globalAlpha = 1;
    // Brillos: uno grande arriba del lado de la luz (20 %) y uno pequeño abajo (8 %).
    SC.draw.fill(ctx, '#ffffff', (q) => SC.draw.ellipse(q, ix + lightSign * iw * 0.35, iy - ih * 0.4, iw * 0.42, ih * 0.26));
    if (!pix) SC.draw.fill(ctx, 'rgba(255,255,255,0.85)', (q) => SC.draw.ellipse(q, ix - lightSign * iw * 0.35, iy + ih * 0.45, iw * 0.2, ih * 0.12));
    ctx.restore();
    // Párpado superior grueso (2–3× en el extremo exterior); pestañas en mujer.
    SC.draw.stroke(ctx, lineC, lw * 1.4, upper);
    SC.draw.fill(ctx, lineC, (q) => { q.moveTo(hw * 0.35, top * 1.08); q.quadraticCurveTo(hw * 0.8, top * 0.95, hw * 1.05, top * (0.35 + lift) - lw); q.lineTo(hw * 0.95, top * (0.35 + lift) + lw * 1.4); q.quadraticCurveTo(hw * 0.7, top * 0.8, hw * 0.3, top * 0.95); q.closePath(); });
    if (!male) {
      for (let i = 0; i < (pix ? 1 : 3); i++) {
        const t = 0.62 + i * 0.16;
        SC.draw.stroke(ctx, lineC, lw * 0.9, (q) => { q.moveTo(hw * t, top * (1.05 - i * 0.2)); q.lineTo(hw * (t + 0.28), top * (1.3 - i * 0.28) - eh * 0.05 * i); });
      }
    }
    // Párpado inferior: línea fina sólo en el 40 % exterior.
    SC.draw.stroke(ctx, lineC, lw * 0.6, (q) => { q.moveTo(hw * 0.95, bot * 0.55); q.quadraticCurveTo(hw * 0.6, bot * 1.02, hw * 0.2, bot * 1.0); });
  }

  // Ceja: trazo con extremos afilados.
  function drawBrow(ctx, ew, w, col, lw, male) {
    const up = W8(w, 'brow_up'), frown = W8(w, 'brow_frown'), sad = W8(w, 'brow_sad');
    const hw = ew * 0.62, th = Math.max(1, lw * (male ? 1.6 : 1.1));
    const inner = -up * ew * 0.3 + frown * ew * 0.2 - sad * ew * 0.32;
    const outer = -up * ew * 0.3 - frown * ew * 0.12 + sad * ew * 0.12;
    const arch = male ? -ew * 0.02 : -ew * 0.12;
    const pts = [[-hw, inner], [0, arch + (inner + outer) / 2], [hw, outer + ew * 0.05]];
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.quadraticCurveTo(pts[1][0], pts[1][1] - th, pts[2][0], pts[2][1]);
    ctx.quadraticCurveTo(pts[1][0], pts[1][1] + th * 0.8, pts[0][0], pts[0][1] + th * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  function drawMouth(ctx, mw, w, skin, lw, pix) {
    const open = W8(w, 'mouth_open'), smile = W8(w, 'mouth_smile') - W8(w, 'mouth_frown'), smirk = W8(w, 'smirk');
    const wide = 1 + 0.25 * W8(w, 'mouth_wide');
    const hw = (mw / 2) * wide, lc = SC.sdfCompose.lineColor(skin, 'skin');
    const cy = -smile * hw * 0.25, sm = smirk * hw * 0.3;
    if (open > 0.08) {
      const h = open * hw * 1.1;
      const shape = (q) => { q.moveTo(-hw, cy); q.quadraticCurveTo(0, cy - h * 0.15 + smile * hw * 0.2, hw, cy - sm); q.quadraticCurveTo(0, cy + h + smile * hw * 0.2, -hw, cy); q.closePath(); };
      SC.draw.fill(ctx, '#6a2330', shape);
      ctx.save(); ctx.beginPath(); shape(ctx); ctx.clip();
      SC.draw.fill(ctx, '#df6f7d', (q) => SC.draw.ellipse(q, 0, cy + h * 0.9, hw * 0.55, h * 0.4));
      if (smile > 0.3) SC.draw.fill(ctx, '#ffffff', (q) => q.rect(-hw * 0.7, cy - h * 0.3, hw * 1.4, h * 0.3));
      ctx.restore();
      SC.draw.stroke(ctx, lc, lw * 0.8, shape);
      return;
    }
    SC.draw.stroke(ctx, lc, lw * (pix ? 1.5 : 1), (q) => { q.moveTo(-hw, cy - smile * hw * 0.1); q.quadraticCurveTo(0, cy + smile * hw * 0.5, hw, cy - smile * hw * 0.1 - sm); });
  }

  // Máscara de la cabeza (y del pelo) para recortar los rasgos.
  function mask(g, test) {
    const cv = SC.render.makeCanvas(g.W, g.H), x = cv.getContext('2d'), img = x.createImageData(g.W, g.H);
    for (let i = 0; i < g.W * g.H; i++) if (test(i)) img.data[i * 4 + 3] = 255;
    x.putImageData(img, 0, 0);
    return cv;
  }

  // Dibuja la cara. o: { look, weights, lineW, pixel }
  function draw(ctx, g, scene, f, o) {
    const cam = g.cam, sk = f.sk, s = sk.params.s, male = s < 0.5, st = sk.face, chibi = st === 'chibi';
    const headIdx = scene.parts.findIndex((p) => p.name === 'head');
    if (headIdx < 0) return;
    const W = SC.sdfBuild.headW(sk), G = C.head.guides[st], w = o.weights || {}, look = o.look;
    const S = cam.scale, alpha = C.head.alpha[st];
    const ew = alpha * W * S * (sk.params.face.eyeScale || 1) * (male ? 1 : C.head.eyeSizeF) * (chibi ? 1.25 : 1);
    const lw = Math.max(1, o.lineW || 0.004 * g.H);
    const skin = look.skin, lineC = SC.sdfCompose.lineColor(look.hair, 'hair');
    const layer = SC.render.makeCanvas(g.W, g.H), lx = layer.getContext('2d');
    // Rubor (4.4): elipse difusa en la mejilla.
    const blush = W8(w, 'blush') + (male ? 0.1 : 0.3);
    for (const sg of [1, -1]) {
      const A = anchor(f, scene, headIdx, cam, sg * 0.28 * W, 0.66);
      if (!A || !visible(g, A)) continue;
      withFrame(lx, A, 1, () => {
        const r = ew * 0.7, gr = lx.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, `rgba(255,110,130,${0.45 * M.clamp(blush, 0, 1)})`); gr.addColorStop(1, 'rgba(255,110,130,0)');
        lx.fillStyle = gr; lx.beginPath(); lx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2); lx.fill();
      });
    }
    // Luz desde la izquierda de la pantalla: lado de los brillos en cada ojo.
    const lightSide = (A, mirror) => -Math.sign(A.rx * mirror || 1);
    for (const sg of [1, -1]) {
      const A = anchor(f, scene, headIdx, cam, sg * (chibi ? 0.3 : 0.24) * W * (male ? 0.95 : 1), G.eye);
      if (!A || !visible(g, A, 0.06)) continue;
      const openW = sg > 0 ? W8(w, 'eye_open_L', W8(w, 'eye_open', 1)) : W8(w, 'eye_open_R', W8(w, 'eye_open', 1));
      withFrame(lx, A, sg, () => drawEye(lx, { ew, open0: 1, iris: look.eyes, skin, lineC, lw, male, smile: W8(w, 'eye_smile'), openW, lightSign: lightSide(A, sg), pix: o.pixel, chibi, look: W8(w, 'look') }));
    }
    // Nariz: sombra pequeña en el lado contrario a la luz (anime) o aletas (realista).
    const N = anchor(f, scene, headIdx, cam, 0, G.noseBase - 0.03);
    if (N && visible(g, N, 0.1) && !chibi) {
      const col = SC.sdfCompose.tones(skin, 'skin').deep;
      withFrame(lx, N, 1, () => {
        if (st === 'realista') SC.draw.stroke(lx, col, lw * 0.8, (q) => { q.moveTo(-ew * 0.25, 0); q.quadraticCurveTo(0, ew * 0.12, ew * 0.25, 0); });
        else SC.draw.fill(lx, col, (q) => { q.moveTo(ew * 0.02, -ew * 0.14); q.lineTo(ew * 0.12, ew * 0.05); q.lineTo(-ew * 0.04, ew * 0.06); q.closePath(); });
      });
    } else if (N && chibi) withFrame(lx, N, 1, () => SC.draw.fill(lx, SC.sdfCompose.tones(skin, 'skin').deep, (q) => SC.draw.ellipse(q, 0, 0, lw, lw)));
    const Mo = anchor(f, scene, headIdx, cam, 0, G.mouth);
    if (Mo && visible(g, Mo, 0.08)) withFrame(lx, Mo, 1, () => drawMouth(lx, chibi ? 0.15 * W * S : M.dimorph(C.head.mouthW, s, 1) * ew * 0.55, w, skin, lw, o.pixel));
    // Recorte con la máscara de la cabeza.
    lx.globalCompositeOperation = 'destination-in';
    lx.drawImage(mask(g, (i) => g.part[i] === headIdx), 0, 0);
    ctx.drawImage(layer, 0, 0);
    // Cejas: sobre la piel y, al 50 %, por encima del flequillo.
    const browLayer = SC.render.makeCanvas(g.W, g.H), bx = browLayer.getContext('2d');
    for (const sg of [1, -1]) {
      const A = anchor(f, scene, headIdx, cam, sg * 0.25 * W, G.brow - (male ? 0 : C.head.browLift));
      if (!A || A.nv < 0.05) continue;
      withFrame(bx, A, sg, () => drawBrow(bx, ew, w, SC.sdfCompose.lineColor(look.hair, 'hair'), lw, male));
    }
    const hair = SC.sdfBuild.MAT.hair;
    const onSkin = SC.render.makeCanvas(g.W, g.H), sx = onSkin.getContext('2d');
    sx.drawImage(browLayer, 0, 0); sx.globalCompositeOperation = 'destination-in'; sx.drawImage(mask(g, (i) => g.part[i] === headIdx), 0, 0);
    ctx.drawImage(onSkin, 0, 0);
    const onHair = SC.render.makeCanvas(g.W, g.H), hx = onHair.getContext('2d');
    hx.drawImage(browLayer, 0, 0); hx.globalCompositeOperation = 'destination-in'; hx.drawImage(mask(g, (i) => g.mat[i] === hair), 0, 0);
    ctx.globalAlpha = 0.5; ctx.drawImage(onHair, 0, 0); ctx.globalAlpha = 1;
  }

  // 11.3 Sellos para caras de pixel art pequeñas (matrices de índices:
  // 1 = línea, 2 = iris, 3 = brillo, 4 = boca).
  const STAMPS = {
    6: { eye: [[1], [1]], eyeClosed: [[1]], mouth: [[4]] },
    9: { eye: [[1, 1], [2, 3], [2, 2]], eyeClosed: [[1, 1]], mouth: [[4, 4]] },
    13: { eye: [[1, 1, 1], [2, 3, 2], [2, 2, 2], [0, 2, 0]], eyeClosed: [[1, 1, 1]], mouth: [[4, 4, 4]] },
  };
  function stamp(img, W, x0, y0, m, pal, mirror) {
    m.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const xx = mirror ? x0 - x : x0 + x, i = ((y0 + y) * W + xx) * 4;
      if (i < 0 || i >= img.data.length) return;
      const c = M.hexToRgb(pal[v]);
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }));
  }
  function stamps(ctx, g, scene, f, o, headPx) {
    const cam = g.cam, sk = f.sk, headIdx = scene.parts.findIndex((p) => p.name === 'head');
    const size = headPx >= 13 ? 13 : headPx >= 9 ? 9 : 6, set = STAMPS[size];
    const W = SC.sdfBuild.headW(sk), G = C.head.guides[sk.face], w = o.weights || {};
    const img = ctx.getImageData(0, 0, g.W, g.H);
    const pal = { 1: SC.sdfCompose.lineColor(o.look.hair, 'hair'), 2: o.look.eyes, 3: '#ffffff', 4: SC.sdfCompose.lineColor(o.look.skin, 'skin') };
    const closed = W8(w, 'eye_open', 1) < 0.2;
    for (const sg of [1, -1]) {
      const A = anchor(f, scene, headIdx, cam, sg * 0.26 * W, G.eye);
      if (!A || !visible(g, A, 0.2)) continue;
      const m = closed ? set.eyeClosed : set.eye;
      stamp(img, g.W, Math.round(A.x - m[0].length / 2), Math.round(A.y - m.length / 2), m, pal, false);
    }
    const Mo = anchor(f, scene, headIdx, cam, 0, G.mouth);
    if (Mo && visible(g, Mo, 0.08) && W8(w, 'mouth_open') > 0.3) stamp(img, g.W, Math.round(Mo.x - 1), Math.round(Mo.y), set.mouth, pal, false);
    ctx.putImageData(img, 0, 0);
  }

  return { anchor, draw, stamps, STAMPS };
})();
