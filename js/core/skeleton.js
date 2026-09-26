// Esqueleto 3D y proporciones anatómicas.
//
// A partir de los parámetros del cuerpo (sexo, cabezas de altura, complexión,
// musculatura, busto, hombros, cintura, caderas) y de una pose, calcula las
// articulaciones en 3D y las secciones del torso y la cabeza. Las piezas se
// construyen siempre sobre este "rig", por lo que la ropa se adapta sola a
// cualquier cuerpo, pose y vista.
//
// Espacio: x lateral, y hacia abajo, z hacia delante del personaje.
// Lienzo canónico 600 x 1000, suelo en y = 960, centro en x = 300.
SC.CANVAS_W = 600;
SC.CANVAS_H = 1000;
SC.GROUND = 960;

SC.VIEWS = {
  front: { name: 'Frente', yaw: 0 },
  three: { name: '3/4', yaw: 0.72 },
  side: { name: 'Perfil', yaw: Math.PI / 2 },
  back: { name: 'Espalda', yaw: Math.PI },
  threeBack: { name: '3/4 espalda', yaw: Math.PI - 0.72 },
  left: { name: 'Perfil izq.', yaw: -Math.PI / 2 },
};

SC.BODY_DEFAULTS = {
  sex: 'f', heads: 6.5, height: 1, build: 1, muscle: 0.3, bust: 0.5, shoulders: 1, waist: 1, hips: 1,
};

SC.defaultPose = () => ({
  bob: 0, sway: 0, jump: 0, crouch: 0, breathe: 0, yaw: 0,
  twist: 0, pitch: 0, roll: 0,
  headYaw: 0, headNod: 0, headTilt: 0,
  arms: [SC.armPose(), SC.armPose()],
  legs: [SC.legPose(), SC.legPose()],
  blink: false, mouth: null,
});
// Pose de reposo natural (contrapposto): el peso cae sobre una pierna, la otra
// se relaja con la rodilla flexionada, los hombros compensan la cadera y la
// cabeza se ladea un poco. Evita el aspecto de maniquí rígido.
SC.restPose = (o = {}) => Object.assign({
  sway: 0.012, roll: -0.035, twist: 0.04, headTilt: 0.06, headYaw: -0.04, headNod: 0.03,
  arms: [SC.armPose({ abd: 0.17, bend: 0.3, flex: 0.1 }), SC.armPose({ abd: 0.1, bend: 0.14, flex: -0.04 })],
  legs: [SC.legPose({ flex: 0.08, knee: 0.2, abd: 0.07 }), SC.legPose({ flex: -0.02, knee: 0.02, abd: 0.02 })],
}, o);
// flex: balanceo adelante, abd: apertura lateral, bend: codo, hint: hacia dónde dobla, palm: orientación de la palma.
SC.armPose = (o) => Object.assign({ flex: 0.04, abd: 0.12, bend: 0.14, hint: 'fwd', palm: 'in', fist: 0 }, o);
SC.legPose = (o) => Object.assign({ flex: 0, abd: 0.03, knee: 0.03 }, o);

SC.buildRig = function buildRig(ch, pose, opts = {}) {
  const U = SC.util, Vc = SC.vec, M = SC.mat, V = SC.V;
  const b = Object.assign({}, SC.BODY_DEFAULTS, ch.body, opts.bodyOverride || {});
  const P = Object.assign(SC.defaultPose(), pose || SC.restPose());
  const fem = b.sex === 'f' ? 1 : 0;
  const mix = (m, f) => m + (f - m) * fem;
  const W = b.build, Mu = b.muscle;
  const masc = 1 - fem;

  const H = 900 * b.height;
  const headH = H / b.heads;
  const B = H - headH * 0.9;
  const chibi = U.clamp((5 - b.heads) / 2.5, 0, 1);

  // ---------- Medidas (proporciones clásicas adaptadas a anime) ----------
  const neck = B * 0.052 * (1 - 0.4 * chibi);
  const legs = B * 0.535 * (1 - 0.1 * chibi);
  const T = B - legs - neck;
  const dim = {
    shoulderHalf: B * mix(0.132, 0.11) * b.shoulders * (0.92 + 0.08 * W) * (1 + 0.07 * Mu * masc),
    chestHalf: B * mix(0.11, 0.096) * (0.85 + 0.15 * W) * (0.9 + 0.1 * b.shoulders),
    waistHalf: B * mix(0.088, 0.068) * b.waist * (0.65 + 0.35 * W),
    hipHalf: B * mix(0.096, 0.118) * b.hips * (0.85 + 0.15 * W),
    chestD: B * mix(0.066, 0.058) * (0.85 + 0.15 * W),
    pec: masc * B * (0.008 + 0.016 * Mu),
    bust: fem * B * 0.052 * b.bust,
    backD: B * mix(0.064, 0.056) * (0.85 + 0.15 * W),
    waistD: B * mix(0.06, 0.052) * (0.6 + 0.4 * W),
    gluteD: B * mix(0.06, 0.072) * (0.85 + 0.15 * W) * (0.85 + 0.15 * b.hips),
    neckR: B * mix(0.036, 0.028) * (0.9 + 0.1 * W) * (1 + 0.14 * Mu * masc) * (1 + 0.3 * chibi),
    armR: B * mix(0.036, 0.029) * (0.85 + 0.15 * W) * (1 + 0.12 * Mu * masc) * (1 + 0.2 * chibi),
    legR: B * mix(0.056, 0.058) * (0.85 + 0.15 * W) * (1 + 0.1 * Mu * masc) * (1 + 0.12 * chibi),
    footL: legs * 0.25 * (1 + 0.15 * chibi),
  };
  dim.fh = dim.footL * 0.3;
  dim.thighL = (legs - dim.fh) * 0.52;
  dim.shinL = (legs - dim.fh) * 0.48;
  dim.upperL = T * 0.5;
  dim.foreL = T * 0.42;
  dim.handL = T * 0.21 * (1 + 0.1 * chibi);

  const yaw = (opts.yaw || 0) + P.yaw;
  const rig = {
    body: b, pose: P, fem, chibi, H, B, T, neck, legLen: legs, dim,
    yaw, yawCos: Math.cos(yaw), yawSin: Math.sin(yaw),
    tiltCos: Math.cos(opts.tilt != null ? opts.tilt : 0.12), tiltSin: Math.sin(opts.tilt != null ? opts.tilt : 0.12),
    cx: 300, ground: SC.GROUND,
    detail: opts.detail || 'high',
    pixel: !!opts.pixel,
    line: opts.line != null ? opts.line : 3,
    lineMode: opts.lineMode || 'colored',
    expr: opts.expr || SC.EXPRESSIONS.neutral,
  };

  // ---------- Piernas (definen la altura de la cadera) ----------
  const legDirs = [-1, 1].map((s, i) => {
    const L = P.legs[i];
    const flex = L.flex + P.crouch * 0.9, knee = L.knee + P.crouch * 1.8, abd = L.abd;
    const d1 = Vc.v(s * Math.sin(abd), Math.cos(abd) * Math.cos(flex), Math.cos(abd) * Math.sin(flex));
    const d2 = Vc.v(s * Math.sin(abd), Math.cos(abd) * Math.cos(flex - knee), Math.cos(abd) * Math.sin(flex - knee));
    return { s, d1, d2, drop: dim.thighL * d1.y + dim.shinL * d2.y };
  });
  const hipY = rig.ground - dim.fh - Math.max(...legDirs.map((l) => l.drop)) - P.jump * B + P.bob * B;
  const pivot = Vc.v(P.sway * B, hipY, 0);
  rig.pivot = pivot;
  rig.legs = legDirs.map((l) => {
    const J = Vc.add(pivot, Vc.v(l.s * dim.hipHalf * 0.5, 0, 0));
    const knee = Vc.madd(J, l.d1, dim.thighL);
    const ankle = Vc.madd(knee, l.d2, dim.shinL);
    const footDir = Vc.norm(Vc.v(l.s * 0.16, 0, 1));
    return { s: l.s, J, knee, ankle, d1: l.d1, d2: l.d2, footDir };
  });

  // ---------- Torso: la columna se curva progresivamente ----------
  const yN = -0.9 * T;
  const R = (k) => M.ypr(P.twist * k, P.pitch * k, P.roll * k);
  const kAt = (yl) => U.clamp(-yl / (0.9 * T), 0, 1);
  const xf = (pl) => Vc.add(pivot, M.mv(R(kAt(pl.y)), pl));
  rig.R = R;
  rig.xf = xf;

  const d = dim, br = P.breathe * B * 0.004;
  // [y local, semiancho, frente, espalda, desplazamiento z]
  const rows = [
    [yN - neck, d.neckR, d.neckR * 0.95, d.neckR * 0.9, d.neckR * 0.45],
    [yN - neck * 0.45, d.neckR * 1.02, d.neckR * 0.95, d.neckR * 0.95, d.neckR * 0.2],
    [yN + T * 0.005, d.neckR * mix(1.35, 1.2), d.neckR * 1.05, d.neckR * 1.05, 0],
    [yN + T * 0.035, U.lerp(d.neckR * 1.3, d.shoulderHalf, mix(0.62, 0.48)), Math.max(d.neckR * 1.12, d.chestD * 0.8), d.backD * 0.85, -d.backD * 0.02],
    [yN + T * 0.085 - br, d.shoulderHalf * 0.98, d.chestD * 0.9 + br, d.backD * 0.95, -d.backD * 0.02],
    [yN + T * 0.19, d.chestHalf, d.chestD + d.pec * 0.7 + br, d.backD, 0],
    [yN + T * 0.29, d.chestHalf * mix(0.98, 0.96), d.chestD + d.pec + d.bust, d.backD * 0.96, 0],
    [yN + T * 0.38, d.chestHalf * mix(0.95, 0.9), d.chestD * 0.93 + d.pec * 0.4 + d.bust * 0.45, d.backD * 0.92, 0],
    [yN + T * 0.47, U.lerp(d.chestHalf, d.waistHalf, 0.5), U.lerp(d.chestD * 0.9, d.waistD, 0.5), d.backD * 0.86, 0],
    [yN + T * 0.6, d.waistHalf, d.waistD, d.waistD * 0.92, 0],
    [yN + T * 0.7, U.lerp(d.waistHalf, d.hipHalf, 0.5), d.waistD * 1.04, U.lerp(d.waistD, d.gluteD, 0.6), 0],
    [yN + T * 0.82, d.hipHalf * 0.97, d.waistD * 0.98, d.gluteD, -d.gluteD * 0.05],
    [yN + T * 0.92, d.hipHalf, d.waistD * 0.88, d.gluteD * 0.95, -d.gluteD * 0.08],
    [yN + T * 0.98, d.hipHalf * 0.8, d.waistD * 0.66, d.gluteD * 0.8, -d.gluteD * 0.06],
    [yN + T * 1.04, d.hipHalf * 0.42, d.waistD * 0.4, d.gluteD * 0.5, -d.gluteD * 0.04],
  ];
  const top = rows[0][0], total = rows[rows.length - 1][0] - top;
  const keys = rows.map(([y, w, f, bk, z]) => {
    const Rk = R(kAt(y));
    return { l: (y - top) / total, s: V.sec(xf(Vc.v(0, y, z)), M.mv(Rk, Vc.v(1, 0, 0)), M.mv(Rk, Vc.v(0, 0, 1)), w, w, f, bk) };
  });
  // Niveles útiles (0 = arriba del cuello, 1 = entrepierna).
  const lv = (y) => (y - top) / total;
  rig.torso = {
    keys, at: V.spec(keys), top, total,
    L: {
      neckTop: 0, neckBase: lv(yN + T * 0.005), shoulder: lv(yN + T * 0.085), armpit: lv(yN + T * 0.19),
      bust: lv(yN + T * 0.29), underbust: lv(yN + T * 0.38), waist: lv(yN + T * 0.6), navel: lv(yN + T * 0.66),
      hip: lv(yN + T * 0.82), hip2: lv(yN + T * 0.92), crotch: lv(yN + T * 1.0), end: 1,
    },
    // Anillo horizontal alrededor de la pelvis (faldas, abrigos largos).
    ringAt(yWorld, a, bf, bb, bump) {
      return V.sec(Vc.v(pivot.x, yWorld, -d.gluteD * 0.1), Vc.v(1, 0, 0), Vc.v(0, 0, 1), a, a, bf, bb, { bump: bump || 0 });
    },
  };

  // ---------- Brazos ----------
  const HINTS = { fwd: Vc.v(0, 0, 1), up: Vc.v(0, -1, 0), back: Vc.v(0, 0, -1) };
  rig.arms = [-1, 1].map((s, i) => {
    const A = P.arms[i];
    const Sl = Vc.v(s * d.shoulderHalf * 0.8, yN + T * 0.1 - br, -d.backD * 0.1);
    const Rk = R(kAt(Sl.y));
    const d1l = Vc.v(s * Math.sin(A.abd), Math.cos(A.abd) * Math.cos(A.flex), Math.cos(A.abd) * Math.sin(A.flex));
    const hint = A.hint === 'in' ? Vc.v(-s, 0, 0.3) : A.hint === 'out' ? Vc.v(s, 0, 0) : HINTS[A.hint] || HINTS.fwd;
    const p = Vc.orth(hint, d1l, Vc.v(0, 0, 1));
    const d2l = Vc.norm(Vc.add(Vc.mul(d1l, Math.cos(A.bend)), Vc.mul(p, Math.sin(A.bend))));
    const palmHint = A.palm === 'fwd' ? Vc.v(0, 0, 1) : A.palm === 'down' ? Vc.v(0, 1, 0) : A.palm === 'back' ? Vc.v(0, 0, -1) : Vc.v(-s, 0, 0.2);
    const nl = Vc.orth(palmHint, d2l, Vc.v(0, 0, 1));
    const S = xf(Sl);
    const d1 = M.mv(Rk, d1l), d2 = M.mv(Rk, d2l);
    const elbow = Vc.madd(S, d1, d.upperL);
    const wrist = Vc.madd(elbow, d2, d.foreL);
    return { s, S, elbow, wrist, d1, d2, bendDir: M.mv(Rk, p), palmN: M.mv(Rk, nl), fist: A.fist };
  });

  // ---------- Cabeza ----------
  const hw = headH * mix(0.4, 0.385) * (1 + 0.1 * chibi);
  const hd = hw * 1.1 * (1 - 0.1 * chibi);
  const NT = xf(Vc.v(0, yN - neck, d.neckR * 0.4));
  const Rh = M.mm(R(1), M.ypr(P.headYaw, P.headNod, P.headTilt));
  const hc = Vc.sub(NT, M.mv(Rh, Vc.v(0, headH * 0.42, -hd * 0.16)));
  const hx = (pl) => Vc.add(hc, M.mv(Rh, pl));
  // Perfil de la cabeza [nivel, semiancho, frente, detrás, z] en unidades de hw/hd.
  const jaw = U.lerp(mix(0.84, 0.74), 0.9, chibi);
  const chinW = U.lerp(mix(0.44, 0.3), 0.62, chibi);
  const headRows = [
    [0.0, 0.22, 0.2, 0.28, -0.06],
    [0.07, 0.62, 0.58, 0.74, -0.05],
    [0.18, 0.87, 0.8, 0.96, -0.03],
    [0.32, 0.98, 0.87, 1.02, -0.01],
    [0.46, 1.0, 0.9, 0.98, 0.01],
    [0.58, U.lerp(mix(0.95, 0.93), 0.99, chibi), 0.9, 0.86, 0.03],
    [0.7, jaw, 0.88, 0.62, 0.05],
    [0.82, U.lerp(mix(0.72, 0.58), 0.86, chibi), 0.82, 0.4, U.lerp(0.1, 0.04, chibi)],
    [0.92, chinW, 0.72, 0.22, U.lerp(0.22, 0.08, chibi)],
    [0.97, U.lerp(mix(0.26, 0.17), 0.36, chibi), 0.55, 0.1, U.lerp(0.28, 0.1, chibi)],
    [1.0, U.lerp(mix(0.12, 0.07), 0.16, chibi), 0.3, 0.05, U.lerp(0.3, 0.12, chibi)],
  ];
  const hkeys = headRows.map(([l, w, f, bk, z]) => ({
    l, s: V.sec(hx(Vc.v(0, -headH / 2 + l * headH, z * hd)), M.mv(Rh, Vc.v(1, 0, 0)), M.mv(Rh, Vc.v(0, 0, 1)), w * hw, w * hw, f * hd, bk * hd),
  }));
  const eye = U.lerp(0.54, 0.6, chibi) - 0.04 * U.clamp((b.heads - 6) / 2, 0, 1);
  rig.head = {
    c: hc, R: Rh, h: headH, w: hw, d: hd, x: hx, keys: hkeys, at: V.spec(hkeys), neckTop: NT,
    dirTo: (pl) => M.mv(Rh, pl),
  };
  rig.face = {
    eye, brow: eye - 0.1 - 0.02 * chibi,
    nose: eye + (1 - eye) * 0.36, mouth: eye + (1 - eye) * U.lerp(0.64, 0.55, chibi),
    eyePhi: 0.4 + 0.05 * chibi,
  };
  return rig;
};
