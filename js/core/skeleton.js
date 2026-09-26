// Esqueleto 2D (vista frontal). A partir de las proporciones del personaje y
// de una pose calcula las posiciones de todas las articulaciones. Las piezas
// (ropa, pelo, etc.) se dibujan siempre relativas a este "rig", así que
// cualquier prenda se adapta sola a cualquier cuerpo y animación.
//
// Espacio canónico: 600 x 1000 unidades, suelo en y = 960, centro en x = 300.
SC.CANVAS_W = 600;
SC.CANVAS_H = 1000;

SC.defaultPose = () => ({
  bob: 0,        // desplazamiento vertical de la cadera (fracción del cuerpo)
  sway: 0,       // desplazamiento lateral de la cadera
  lean: 0,       // inclinación lateral del torso (radianes)
  breathe: 0,    // 0..1 respiración (hombros suben)
  jump: 0,       // altura del salto (fracción del cuerpo)
  crouch: 0,     // 0..1 flexión de rodillas
  headTilt: 0,   // radianes
  arms: [        // [izquierda de pantalla, derecha de pantalla]
    { a: 0.07, e: -0.04 },  // a: apertura del brazo, e: flexión del codo
    { a: 0.07, e: -0.04 },
  ],
  legs: [
    { lift: 0, spread: 0 },
    { lift: 0, spread: 0 },
  ],
  blink: false,  // fuerza ojos cerrados
  mouth: null,   // fuerza una forma de boca (animación de hablar)
});

SC.buildRig = function buildRig(ch, pose, opts = {}) {
  const U = SC.util;
  const b = Object.assign({ heads: 5.5, height: 1, build: 1, shoulders: 1, hips: 1 }, ch.body, opts.bodyOverride || {});
  const P = Object.assign(SC.defaultPose(), pose || {});
  const cx = 300, ground = 960;

  const H = 900 * b.height;
  const headH = H / b.heads;
  const headW = headH * 0.84;
  const B = H - headH * 0.9;            // cuerpo sin cabeza
  const legLen = B * 0.5;
  const torsoLen = B * 0.43;
  const neckLen = B * 0.07;
  const chibi = U.clamp((5 - b.heads) / 2.5, 0, 1); // 0 realista .. 1 chibi

  const shoulderHalf = B * 0.115 * b.shoulders * (0.85 + 0.15 * b.build);
  const waistHalf = B * 0.08 * b.build * (0.9 + 0.1 * b.hips);
  const hipHalf = B * 0.098 * b.hips * (0.85 + 0.15 * b.build);
  const armW = B * 0.048 * (0.8 + 0.2 * b.build) * (1 + chibi * 0.2);
  const legW = B * 0.066 * (0.8 + 0.2 * b.build) * (1 + chibi * 0.15);
  const neckW = Math.min(headW * 0.36, B * 0.06 * (0.85 + 0.15 * b.build));

  const jump = P.jump * B;
  const crouchDrop = P.crouch * legLen * 0.22;
  const hip = { x: cx + P.sway * B, y: ground - legLen + P.bob * B + crouchDrop - jump };

  // --- Piernas ---
  const legs = [-1, 1].map((s, i) => {
    const L = P.legs[i];
    const top = { x: hip.x + s * hipHalf * 0.5, y: hip.y };
    const foot = {
      x: cx + s * (hipHalf * 0.52 + L.spread * B * 0.06 + P.crouch * legW * 0.3),
      y: ground - jump - L.lift * legLen * 0.2,
    };
    const knee = U.lerpPt(top, foot, 0.5);
    knee.x += s * (P.crouch * legW * 0.55 + L.lift * legW * 0.15);
    knee.y -= L.lift * legLen * 0.04;
    return { s, top, knee, foot };
  });

  // --- Torso (antes de inclinar) ---
  const breathe = P.breathe * B * 0.006;
  const shY = hip.y - torsoLen - breathe;
  const rot = (p) => U.rotateAround(p, hip, P.lean);
  const side = (s) => ({
    neck: rot({ x: cx + P.sway * B + s * neckW * 0.5, y: shY - B * 0.012 }),
    shoulder: rot({ x: hip.x + s * shoulderHalf, y: shY + armW * 0.35 }),
    armpit: rot({ x: hip.x + s * shoulderHalf * 0.86, y: shY + torsoLen * 0.24 }),
    chest: rot({ x: hip.x + s * shoulderHalf * 0.88, y: shY + torsoLen * 0.38 }),
    waist: rot({ x: hip.x + s * waistHalf, y: hip.y - torsoLen * 0.32 }),
    hip: { x: hip.x + s * hipHalf, y: hip.y - torsoLen * 0.04 },
  });
  const torso = {
    L: side(-1), R: side(1),
    crotch: { x: hip.x, y: hip.y + legW * 0.55 },
    top: rot({ x: hip.x, y: shY }),
    len: torsoLen,
  };

  // --- Brazos ---
  const upperLen = torsoLen * 0.54, foreLen = torsoLen * 0.5;
  const arms = [-1, 1].map((s, i) => {
    const A = P.arms[i];
    const sh = rot({ x: hip.x + s * shoulderHalf * 0.88, y: shY + armW * 0.75 });
    const a1 = A.a; // ángulo relativo a la vertical, positivo = hacia fuera
    const el = { x: sh.x + s * Math.sin(a1) * upperLen, y: sh.y + Math.cos(a1) * upperLen };
    const a2 = a1 + A.e;
    const hand = { x: el.x + s * Math.sin(a2) * foreLen, y: el.y + Math.cos(a2) * foreLen };
    return { s, sh, el, hand, a1, a2 };
  });

  // --- Cuello y cabeza ---
  const neckBase = rot({ x: hip.x, y: shY + B * 0.01 });
  const neckTop = rot({ x: hip.x, y: shY - neckLen });
  const headRot = P.lean + P.headTilt;
  const headC = U.rotateAround({ x: neckTop.x, y: neckTop.y - headH * 0.4 }, neckTop, headRot);

  return {
    body: b, pose: P, cx, ground, H, B, chibi,
    detail: opts.detail || 'high',
    line: opts.line != null ? opts.line : 3,
    lineMode: opts.lineMode || 'colored',
    expr: opts.expr || SC.EXPRESSIONS.neutral,
    hip, legs, torso, arms, legLen,
    neck: { base: neckBase, top: neckTop, w: neckW },
    head: { x: headC.x, y: headC.y, w: headW, h: headH, rot: headRot, pivot: neckTop },
    sizes: { armW, legW, shoulderHalf, waistHalf, hipHalf, handR: armW * 0.72, footL: legW * 1.25 },
  };
};

// Contornos reutilizables para cuerpo y ropa.
SC.shapes = (() => {
  const U = SC.util;

  // Silueta del torso. expand agranda la forma (ropa); hem: 0 cintura .. 1 cadera .. >1 muslo.
  function torso(ctx, rig, o = {}) {
    const t = rig.torso, e = o.expand || 0;
    const hem = o.hem != null ? o.hem : 1;
    const neck = o.neck || 'none';
    const ex = (p, s, k = 1) => ({ x: p.x + s * e * k, y: p.y });
    const hemPt = (S, s) => {
      if (hem <= 1) return ex(U.lerpPt(S.waist, S.hip, hem), s);
      const p = ex(S.hip, s, 1.1);
      return { x: p.x + s * (hem - 1) * rig.sizes.legW * 0.5, y: p.y + (hem - 1) * rig.legLen * 0.6 };
    };
    const hL = hemPt(t.L, -1), hR = hemPt(t.R, 1);
    const nL = ex(t.L.neck, -1, 0.5), nR = ex(t.R.neck, 1, 0.5);
    if (neck === 'wide') {
      const w = (nR.x - nL.x) * 0.55;
      nL.x -= w; nR.x += w; nL.y += w * 0.25; nR.y += w * 0.25;
    }
    const shL = ex(t.L.shoulder, -1), shR = ex(t.R.shoulder, 1);
    const top = rig.torso.top;

    ctx.moveTo(nL.x, nL.y);
    // Escote
    if (neck === 'v') ctx.lineTo(top.x, top.y + rig.torso.len * 0.2);
    else if (neck === 'round') ctx.quadraticCurveTo(top.x, top.y + rig.torso.len * 0.12, nR.x, nR.y);
    else if (neck === 'wide') ctx.quadraticCurveTo(top.x, top.y + rig.torso.len * 0.16, nR.x, nR.y);
    else if (neck === 'high') {
      ctx.lineTo(nL.x, nL.y - rig.neck.w * 0.35);
      ctx.quadraticCurveTo(top.x, top.y - rig.neck.w * 0.2, nR.x, nR.y - rig.neck.w * 0.35);
    }
    ctx.lineTo(nR.x, nR.y);
    ctx.quadraticCurveTo(shR.x - (shR.x - nR.x) * 0.3, nR.y + 2, shR.x, shR.y);
    const aR = ex(t.R.armpit, 1), wR = ex(t.R.waist, 1), hipR = ex(t.R.hip, 1);
    ctx.quadraticCurveTo(shR.x + e * 0.3, (shR.y + aR.y) / 2, aR.x, aR.y);
    if (hem <= 0.05) {
      ctx.quadraticCurveTo(aR.x, (aR.y + wR.y) / 2, hR.x, hR.y);
    } else {
      ctx.quadraticCurveTo(ex(t.R.chest, 1).x, (aR.y + wR.y) / 2, wR.x, wR.y);
      if (hem > 1) { ctx.lineTo(hipR.x, hipR.y); ctx.lineTo(hR.x, hR.y); }
      else ctx.quadraticCurveTo(wR.x, (wR.y + hR.y) / 2, hR.x, hR.y);
    }
    const midY = Math.max(hL.y, hR.y);
    if (o.hemCurve) ctx.quadraticCurveTo(rig.hip.x, midY + o.hemCurve, hL.x, hL.y);
    else ctx.lineTo(hL.x, hL.y);
    const aL = ex(t.L.armpit, -1), wL = ex(t.L.waist, -1), hipL = ex(t.L.hip, -1);
    if (hem <= 0.05) {
      ctx.quadraticCurveTo(aL.x, (aL.y + wL.y) / 2, aL.x, aL.y);
    } else {
      if (hem > 1) { ctx.lineTo(hipL.x, hipL.y); ctx.lineTo(wL.x, wL.y); }
      else ctx.quadraticCurveTo(wL.x, (wL.y + hL.y) / 2, wL.x, wL.y);
      ctx.quadraticCurveTo(ex(t.L.chest, -1).x, (aL.y + wL.y) / 2, aL.x, aL.y);
    }
    ctx.quadraticCurveTo(shL.x - e * 0.3, (shL.y + aL.y) / 2, shL.x, shL.y);
    ctx.quadraticCurveTo(shL.x + (nL.x - shL.x) * 0.7, nL.y + 2, nL.x, nL.y);
  }

  // Pelvis/entrepierna (pantalones, ropa interior).
  function pelvis(ctx, rig, e = 0, drop = 1) {
    const t = rig.torso;
    const wL = t.L.waist, wR = t.R.waist, hL = t.L.hip, hR = t.R.hip;
    const lw = rig.sizes.legW;
    ctx.moveTo(wL.x - e, wL.y);
    ctx.lineTo(wR.x + e, wR.y);
    ctx.quadraticCurveTo(hR.x + e * 1.2, hR.y - lw * 0.2, hR.x + e * 0.6, hR.y + lw * 0.5 * drop);
    ctx.lineTo(t.crotch.x, t.crotch.y + e * 0.5 + lw * 0.2 * drop);
    ctx.lineTo(hL.x - e * 0.6, hL.y + lw * 0.5 * drop);
    ctx.quadraticCurveTo(hL.x - e * 1.2, hL.y - lw * 0.2, wL.x - e, wL.y);
  }

  // Puntos de una pierna recortada entre dos fracciones (0 cadera .. 1 tobillo).
  function legSeg(leg, from, to) {
    const pt = (f) => f <= 0.5 ? U.lerpPt(leg.top, leg.knee, f * 2) : U.lerpPt(leg.knee, leg.foot, (f - 0.5) * 2);
    const pts = [pt(from)];
    if (from < 0.5 && to > 0.5) pts.push(leg.knee);
    pts.push(pt(to));
    return pts;
  }

  function armSeg(arm, from, to) {
    const pt = (f) => f <= 0.5 ? U.lerpPt(arm.sh, arm.el, f * 2) : U.lerpPt(arm.el, arm.hand, (f - 0.5) * 2);
    const pts = [pt(from)];
    if (from < 0.5 && to > 0.5) pts.push(arm.el);
    pts.push(pt(to));
    return pts;
  }

  return { torso, pelvis, legSeg, armSeg };
})();
