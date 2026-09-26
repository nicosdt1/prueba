// Render del sistema anatómico: pose → formas → dibujo (sección 11 de
// docs/base-matematica.md). Encuadres de 6.5, orden de dibujo por profundidad
// (9.6), sombreado con rampas OKLCH (11.4–11.5), ropa como capas desplazadas
// sobre las formas medidas y pixel art con la tubería común de la app.
SC.anat = (() => {
  const M = SC.AM, C = SC.CANON, V = SC.V, B = SC.anatBody, RG = SC.anatRig, SH = SC.anatShapes, HD = SC.anatHead;

  const TOPS = {
    camiseta: { name: 'Camiseta', to: 'crest', sleeve: 0.2 },
    larga: { name: 'Manga larga', to: 'crest', sleeve: 0.97 },
    tirantes: { name: 'Tirantes', from: 'axilla', to: 'crest', sleeve: 0 },
    vestido: { name: 'Vestido', to: 'hip', sleeve: 0.18, skirt: 0.45 },
    ninguno: { name: 'Ninguno' },
  };
  const BOTTOMS = {
    falda: { name: 'Falda', skirt: 0.3 },
    larga: { name: 'Falda larga', skirt: 0.85 },
    pantalon: { name: 'Pantalón', leg: 0.97 },
    corto: { name: 'Pantalón corto', leg: 0.3 },
    ninguno: { name: 'Ninguno' },
  };
  const SHOES = { zapatos: { name: 'Zapatos' }, botas: { name: 'Botas', boot: 0.72 }, ninguno: { name: 'Descalzo' } };

  const DEFAULT_LOOK = {
    skin: '#f4d2bb', hair: '#4b3350', eyes: '#3f7fd6', top: '#3b5bdb', bottom: '#2f3542', shoes: '#5a3d2b', tie: '#e0445e',
    hairStyle: 'bob', topStyle: 'camiseta', bottomStyle: 'falda', shoeStyle: 'zapatos',
  };

  function config(a = {}) {
    const look = Object.assign({}, DEFAULT_LOOK, a.look || {});
    return { params: B.params(a.params || a), look };
  }

  // 11.5 La sombra de cada color sale de su rampa OKLCH (más fría y oscura). El
  // motor de volúmenes sombrea multiplicando: se calcula el tinte equivalente.
  const tintCache = new Map();
  function tintFor(hex) {
    if (!tintCache.has(hex)) {
      const a = M.hexToRgb(hex), b = M.hexToRgb(M.ramp(hex, -1.4));
      tintCache.set(hex, M.rgbToHex(...a.map((v, i) => M.clamp((255 * b[i]) / Math.max(1, v), 0, 255))));
    }
    return tintCache.get(hex);
  }

  // 6.5 Encuadres: bordes superior e inferior en unidades del modelo.
  function frameBox(sk, frame) {
    const T = sk.T, H = sk.H;
    if (frame === 'bust') return { top: T + 0.15 * H, bottom: sk.yT(0.45), width: sk.w.shoulders + 0.8 * H };
    if (frame === 'close') return { top: T + 0.1 * H, bottom: sk.yT(0.05), width: sk.w.shoulders * 0.8 };
    return { top: T + 0.2 * H, bottom: -0.1 * H, width: Math.max(sk.w.shoulders, sk.w.hip) + 1.6 * H };
  }

  function render(a, animId, t, o = {}) {
    const cfg = config(a);
    const params = Object.assign({}, cfg.params, o.styleOverride ? { style: o.styleOverride } : {});
    const sk = B.skeleton(params), look = cfg.look;
    const pose = RG.animate(sk, animId || 'idle', t || 0);
    const f = RG.solve(sk, pose);
    const W = o.W, Hpx = o.H;
    const box = frameBox(sk, o.frame);
    const S = Math.min(Hpx / (box.top - box.bottom), W / box.width) * (o.frame === 'bust' ? 1 : 0.97);
    const offY = (Hpx - (box.top - box.bottom) * S) / 2;
    const ground = offY + box.top * S;
    const sp = SH.space(S, W / 2, ground);
    const yaw = (SC.VIEWS[o.view || 'front'] || SC.VIEWS.front).yaw;
    const tilt = o.tilt != null ? o.tilt : 0.06;
    const rig = {
      yawCos: Math.cos(yaw), yawSin: Math.sin(yaw), tiltCos: Math.cos(tilt), tiltSin: Math.sin(tilt),
      cx: W / 2, ground, detail: 'high', pixel: !!o.pixel, B: sk.T * S,
      line: o.pixel ? 0 : Math.max(0.6, S * 0.012 * (o.lineWidth != null ? o.lineWidth : 1)), lineMode: o.lineMode || 'colored',
    };
    const fill = (ctx, vol, color, mat = 'cloth') => V.fill(ctx, rig, vol, color, { mat, tint: tintFor(color) });
    const vol = (secs, n = 14) => V.fromSections(rig, secs, n);

    const top = TOPS[look.topStyle] || TOPS.ninguno, bot = BOTTOMS[look.bottomStyle] || BOTTOMS.ninguno, shoe = SHOES[look.shoeStyle] || SHOES.ninguno;
    const hands = pose.hands || { L: 'relajada', R: 'relajada' };
    const items = [];

    // Piernas (con pantalón y calzado).
    for (const S2 of ['L', 'R']) {
      const leg = vol(SH.legSecs(f, sp, S2)), foot = vol(SH.footSecs(f, sp, S2), 12);
      const pants = bot.leg ? vol(SH.legSecs(f, sp, S2, 0.025, bot.leg, (g) => (g > 0.6 ? (g - 0.6) * 0.05 : 0))) : null;
      const boot = shoe.boot ? vol(SH.legSecs(f, sp, S2, 0.035 + (bot.leg > 0.8 ? 0.02 : 0), 1).slice(-5)) : null;
      const shoeV = shoe === SHOES.ninguno ? null : vol(SH.footSecs(f, sp, S2, 0.03, 0.03), 12);
      items.push({
        z: leg.z, leg: true,
        draw: (ctx) => {
          fill(ctx, leg, look.skin, 'skin');
          if (!shoeV) fill(ctx, foot, look.skin, 'skin');
          if (pants) fill(ctx, pants, look.bottom);
          if (boot) fill(ctx, boot, look.shoes, 'leather');
          if (shoeV) fill(ctx, shoeV, look.shoes, 'leather');
        },
      });
    }
    // Brazos y manos (con manga).
    for (const S2 of ['L', 'R']) {
      const arm = vol(SH.armSecs(f, sp, S2));
      const sleeve = top.sleeve ? vol(SH.armSecs(f, sp, S2, 0.03, top.sleeve)) : null;
      const hand = SH.handShapes(f, sp, rig, S2, hands[S2]);
      items.push({
        z: arm.z,
        draw: (ctx) => {
          fill(ctx, arm, look.skin, 'skin');
          if (sleeve) fill(ctx, sleeve, look.top);
          for (const h of hand) fill(ctx, h, look.skin, 'skin');
        },
      });
    }
    // Tronco: cuello, torso, busto y ropa del tronco.
    const tau = sk.tau;
    const neck = vol(SH.neckSecs(f, sp), 14);
    // Torso y busto forman un solo volumen: un único contorno exterior.
    const torso = V.merge(vol(SH.torsoSecs(f, sp, 0, 1, 0, 14), 18), ...SH.bustVols(f, sp, rig));
    const tops = [];
    if (top.to) {
      const t0 = top.from ? tau[top.from] - 0.05 : 0, t1 = top.to === 'hip' ? tau.hip : tau.crest + 0.05;
      tops.push(V.merge(vol(SH.torsoSecs(f, sp, t0, t1, 0.03, 12), 18), ...SH.bustVols(f, sp, rig, 0.03)));
    }
    const bots = [];
    if (bot.leg) bots.push(vol(SH.torsoSecs(f, sp, tau.waist, 1, 0.025, 8), 18));
    const skirtLen = bot.skirt || top.skirt;
    const skirt = skirtLen ? skirtVol(f, sp, rig, skirtLen, top.skirt && !bot.skirt) : null;
    items.push({
      z: torso.z,
      draw: (ctx) => {
        fill(ctx, neck, look.skin, 'skin');
        fill(ctx, torso, look.skin, 'skin');
        for (const b of bots) fill(ctx, b, look.bottom);
        for (const t2 of tops) fill(ctx, t2, look.top);
        if (skirt) fill(ctx, skirt, top.skirt && !bot.skirt ? look.top : look.bottom);
      },
    });
    // Cabeza, cara y pelo.
    const hm = HD.measure(sk);
    const head = vol(HD.headSecs(f, sp, hm, 0.012, 1, 0, 18), 20);
    const ears = HD.earVols(f, sp, rig, hm);
    const nose = HD.noseVol(f, sp, rig, hm);
    const hair = HD.hairItems(f, sp, rig, hm, look, look.hairStyle, fill);
    const w = Object.assign({}, C.expressions[o.expression] || {}, pose.face || {});
    // El pelo de la espalda va detrás del cuerpo salvo en las vistas de espaldas.
    items.push({ z: rig.yawCos > 0.05 ? -1e9 : torso.z + 1, draw: hair.back });
    items.push({
      z: head.z + 0.35 * S,
      draw: (ctx) => {
        for (const e of ears) if (e.z < head.z) fill(ctx, e, look.skin, 'skin');
        fill(ctx, head, look.skin, 'skin');
        for (const e of ears) if (e.z >= head.z) fill(ctx, e, look.skin, 'skin');
        // La nariz sólo aporta la silueta en perfil: sin contorno ni manchas de sombra.
        V.fill(ctx, rig, nose, look.skin, { mat: 'skin', outline: false, shade: Math.abs(rig.yawSin) > 0.5, tint: tintFor(look.skin) });
        HD.drawFace(ctx, f, sp, rig, hm, look, w);
        hair.cap(ctx);
        hair.front(ctx);
      },
    });

    // 9.6 Orden de dibujo: las piernas primero (la pelvis las tapa), luego por profundidad.
    const legs = items.filter((i) => i.leg).sort((p, q) => p.z - q.z);
    const rest = items.filter((i) => !i.leg).sort((p, q) => p.z - q.z);
    const cv = SC.render.makeCanvas(W, Hpx), ctx = cv.getContext('2d');
    for (const it of legs.concat(rest)) it.draw(ctx);
    if (o.pixel || o.raw) return { canvas: cv, f, sk };
    // Contorno exterior más grueso que las líneas interiores.
    const out = SC.render.makeCanvas(W, Hpx);
    SC.render.outlineImage(out.getContext('2d'), cv, Math.max(1, rig.line * 0.9), '#34263f');
    return { canvas: out, f, sk };
  }

  // Falda: de la cintura hacia abajo, con vuelo; sigue a la pelvis.
  function skirtVol(f, sp, rig, len, fromTop) {
    const sk = f.sk, prof = SH.torsoProfile(sk), out = [];
    const t0 = fromTop ? sk.tau.hip - 0.02 : sk.tau.waist;
    const yEnd = sk.yL(len), y0 = sk.yT(t0), yHip = sk.yT(sk.tau.hip);
    const hip = prof.at(sk.tau.hip);
    // Separación de las piernas a esa altura, para que el vuelo no se atraviese.
    const spread = Math.abs(f.pos.knee_L[0] - f.pos.knee_R[0]) / 2 + sk.w.knee / 2;
    for (let i = 0; i <= 10; i++) {
      const y = M.lerp(y0, yEnd, i / 10);
      let half, front, back, zc;
      if (y >= yHip) {
        const tt = M.clamp((sk.T - sk.H - y) / sk.Ltorso, 0, 1), r = prof.at(tt);
        ({ half, front, back, zc } = r);
      } else {
        const d = yHip - y;
        half = Math.max(hip.half + d * 0.28, spread * Math.min(1, d / 1.2) + 0.05);
        front = hip.front + d * 0.22; back = hip.back + d * 0.2; zc = hip.zc;
      }
      const q = SH.blendXf(f, { pelvis: 1 }, [0, y, zc], [[1, 0, 0], [0, 0, 1]]);
      out.push(SH.sec(sp, q.p, q.axes[0], q.axes[1], half + 0.035, half + 0.035, front + 0.035, back + 0.035));
    }
    return V.fromSections(rig, out, 20);
  }

  // ---------- API de motor (misma que los demás motores de la app) ----------
  const cfgOf = (ch) => (ch && ch.anat) || {};
  const animOf = (pose) => ({ id: (pose && pose.animId) || 'idle', t: (pose && pose.t) || 0 });

  function renderView(ch, W, H, pose, o = {}) {
    const a = animOf(pose);
    return render(cfgOf(ch), a.id, a.t, Object.assign({}, o, { W, H, expression: o.expression || (ch && ch.expression) })).canvas;
  }
  function renderVN(ch, pose, o = {}) {
    const scale = o.scale || 1, Hh = Math.round((o.height || SC.CANVAS_H) * scale);
    const W = Math.round(Hh * (o.frame === 'bust' ? 0.85 : 0.6));
    return renderView(ch, W, Hh, pose, Object.assign({}, o, { lineWidth: ch && ch.style ? ch.style.lineWidth : 1, lineMode: ch && ch.style ? ch.style.lineMode : 'colored' }));
  }
  function renderPixel(ch, pose, o = {}) {
    const W = o.w || 48, H = o.h || 64, a = animOf(pose);
    const style = o.chibi ? (H <= 48 ? 'pixel32' : 'pixel64') : null;
    const big = render(cfgOf(ch), a.id, a.t, { W: W * 4, H: H * 4, view: o.view, frame: 'full', pixel: true, tilt: 0.2, styleOverride: style, expression: o.expression || (ch && ch.expression) }).canvas;
    return SC.render.pixelize(big, W, H, Object.assign({ colors: 32, darkBoost: 0.6 }, o));
  }
  function renderPixelPortrait(ch, pose, o = {}) {
    const W = o.w || 128, H = o.h || 160, a = animOf(pose);
    const big = render(cfgOf(ch), a.id, a.t, { W: W * 4, H: H * 4, view: o.view, frame: 'bust', pixel: true, expression: o.expression || (ch && ch.expression) }).canvas;
    return SC.render.pixelize(big, W, H, Object.assign({ darkBoost: 0.6 }, o));
  }
  function renderAnimation(ch, animId, mode, o = {}) {
    const n = SC.ANIMS[animId] ? SC.ANIMS[animId].frames : 4, frames = [];
    for (let i = 0; i < n; i++) {
      const pose = { animId, t: i / n };
      frames.push(mode === 'pixel' ? (o.portrait ? renderPixelPortrait(ch, pose, o) : renderPixel(ch, pose, o)) : renderVN(ch, pose, o));
    }
    return frames;
  }

  return { render, renderView, renderVN, renderPixel, renderPixelPortrait, renderAnimation, config, frameBox, TOPS, BOTTOMS, SHOES, DEFAULT_LOOK, tintFor };
})();
