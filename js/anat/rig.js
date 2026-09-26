// Rig y animación (sección 10 de docs/base-matematica.md).
// Una pose es un vector de ángulos por articulación (grados) más la posición
// de la raíz. FK con límites articulares (4.4), IK de dos huesos (10.2),
// centro de masas (8.4) y animaciones procedurales (andar 10.4, contrapposto 8.4...).
SC.anatRig = (() => {
  const M = SC.AM, C = SC.CANON;
  const R = M.rad;

  // Tipo de límite de cada articulación (tabla 4.4).
  const LIMIT_OF = {
    head: 'head', neck: 'neck', spine: 'spine', chest: 'spine',
    shoulder_L: 'shoulder', shoulder_R: 'shoulder', elbow_L: 'elbow', elbow_R: 'elbow', wrist_L: 'wrist', wrist_R: 'wrist',
    hip_L: 'hip', hip_R: 'hip', knee_L: 'knee', knee_R: 'knee', ankle_L: 'ankle', ankle_R: 'ankle',
  };

  // Recorta los ángulos a sus límites: elimina codos y rodillas doblados al revés.
  function clampJoint(name, a) {
    const L = C.limits[LIMIT_OF[name]];
    if (!L) return a;
    const out = Object.assign({}, a);
    const cl = (k, lim) => { if (lim && out[k] != null) out[k] = M.clamp(out[k], lim[0], lim[1]); };
    cl('pitch', L.pitch); cl('yaw', L.yaw); cl('roll', L.roll); cl('abd', L.abd);
    cl('flex', L.flex);
    return out;
  }

  // Ángulos anatómicos → rotación local (orden Y → X → Z).
  function localRot(name, a) {
    const sg = /_R$/.test(name) ? -1 : 1;
    const y = R(a.yaw || 0), roll = R(a.roll || 0);
    if (/^(shoulder|hip)_/.test(name)) return M.euler(y * sg, -R(a.flex || 0), sg * R(a.abd || 0) + roll);
    if (/^(elbow|wrist)_/.test(name)) return M.euler(y * sg, -R(a.flex || 0), roll * sg);
    if (/^knee_/.test(name)) return M.euler(0, R(a.flex || 0), 0);
    if (/^ankle_/.test(name)) return M.euler(y * sg, R(a.flex || 0), roll * sg);
    if (/^clavicle_/.test(name)) return M.euler(0, -R(a.flex || 0), sg * R(a.abd || 0));
    // Tronco, cuello y cabeza: + inclina hacia delante / mira abajo.
    return M.euler(y, R((a.pitch || 0) + (a.flex || 0)), roll);
  }

  // 10.1 Cinemática directa. pose = { joints: { nombre: ángulos }, root: [x,y,z] }.
  // 6.1 Ritmo escapulohumeral: por encima de 60° de abducción real, la
  // clavícula y el omóplato acompañan (1° por cada 2° de brazo).
  function scapular(pa) {
    const out = Object.assign({}, pa);
    for (const S2 of ['L', 'R']) {
      const sh = pa['shoulder_' + S2];
      if (!sh || sh.abd == null) continue;
      const real = sh.abd + C.aPose, cl = Math.max(0, real - 60) / 3;
      if (cl <= 0) continue;
      out['shoulder_' + S2] = Object.assign({}, sh, { abd: sh.abd - cl });
      const c0 = pa['clavicle_' + S2] || {};
      out['clavicle_' + S2] = Object.assign({}, c0, { abd: (c0.abd || 0) + cl });
    }
    return out;
  }

  function fk(sk, pose = {}) {
    const order = SC.anatBody.order(sk), J = sk.joints, pa = scapular(pose.joints || {});
    const pos = {}, rot = {};
    for (const n of order) {
      const a = clampJoint(n, pa[n] || {});
      const Rl = localRot(n, a);
      const p = J[n].parent;
      if (!p) {
        rot[n] = M.mm(M.euler(R(pose.yaw || 0), 0, 0), Rl);
        pos[n] = M.add(J[n].rest, pose.root || [0, 0, 0]);
      } else {
        rot[n] = M.mm(rot[p], Rl);
        pos[n] = M.add(pos[p], M.mv(rot[p], M.sub(J[n].rest, J[p].rest)));
      }
    }
    // Transformación rígida de un punto en reposo que sigue a la articulación j.
    const xf = (j) => (pr) => M.add(pos[j], M.mv(rot[j], M.sub(pr, J[j].rest)));
    const dir = (j) => (v) => M.mv(rot[j], v);
    return { sk, pos, rot, xf, dir, pose };
  }

  // 10.2 IK de dos huesos con vector polo. Devuelve la articulación intermedia.
  function ik2(A, P, L1, L2, pole) {
    const eps = 1e-6;
    const toP = M.sub(P, A);
    const d = M.clamp(M.len(toP), Math.abs(L1 - L2) + eps, L1 + L2 - eps);
    const dirP = M.norm(toP);
    const alpha = Math.acos(M.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    // Plano de flexión: el que contiene la dirección al objetivo y el polo.
    let side = M.sub(M.sub(pole, A), M.mul(dirP, M.dot(M.sub(pole, A), dirP)));
    if (M.len(side) < 1e-9) side = Math.abs(dirP[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    side = M.norm(side);
    const mid = M.add(A, M.add(M.mul(dirP, L1 * Math.cos(alpha)), M.mul(side, L1 * Math.sin(alpha))));
    const end = M.add(A, M.mul(dirP, d));
    return { mid, end, reached: M.len(toP) <= L1 + L2 };
  }

  // 8.4 Centro de masas: la masa de cada segmento en su punto medio.
  function centerOfMass(f) {
    const m = C.mass, p = f.pos;
    const seg = (a, b, w) => ({ c: M.lerp3(p[a], p[b], 0.5), w });
    const parts = [
      seg('neck', 'head_top', m.head), seg('pelvis', 'neck', m.trunk),
    ];
    for (const S of ['L', 'R']) {
      parts.push(seg('shoulder_' + S, 'elbow_' + S, m.upperArm), seg('elbow_' + S, 'wrist_' + S, m.forearm), seg('wrist_' + S, 'hand_' + S, m.hand));
      parts.push(seg('hip_' + S, 'knee_' + S, m.thigh), seg('knee_' + S, 'ankle_' + S, m.shin), seg('ankle_' + S, 'toe_' + S, m.foot));
    }
    let W = 0, c = [0, 0, 0];
    for (const q of parts) { c = M.add(c, M.mul(q.c, q.w)); W += q.w; }
    return M.mul(c, 1 / W);
  }

  // Puntos de apoyo del pie (talón y punta) para el suelo y el equilibrio.
  function footPoints(f, S) {
    const sk = f.sk, Lf = sk.bones.foot, a = sk.joints['ankle_' + S].rest;
    const ft = C.foot, h = a[1];
    const heel = [a[0], 0, ft.heel * Lf], toe = [a[0], 0, ft.toe * Lf];
    const x = f.xf('ankle_' + S);
    return { heel: x([heel[0], a[1] - h, heel[2]]), toe: x([toe[0], a[1] - h, toe[2]]) };
  }

  // Pies en el suelo: sube o baja la raíz para que el punto más bajo toque y = 0.
  // Con pose.stance ('L' o 'R') manda el pie de apoyo, que queda plano en el
  // suelo; si el pie libre lo atraviesa, su rodilla se flexiona un poco más.
  function ground(sk, pose) {
    let f = fk(sk, pose);
    const minY = (S) => { const q = footPoints(f, S); return Math.min(q.heel[1], q.toe[1]); };
    let low;
    if (pose.stance) {
      const S = pose.stance, O = S === 'L' ? 'R' : 'L', j = pose.joints;
      for (let it = 0; it < 30 && minY(O) < minY(S) - 1e-3; it++) {
        const k = j['knee_' + O] = j['knee_' + O] || {}, h = j['hip_' + O] = j['hip_' + O] || {}, a = j['ankle_' + O] = j['ankle_' + O] || {};
        k.flex = (k.flex || 0) + 2; h.flex = (h.flex || 0) + 1; a.flex = (a.flex || 0) - 0.5;
        f = fk(sk, pose);
      }
      low = minY(S);
    } else {
      low = Math.min(minY('L'), minY('R'));
    }
    const root = pose.root || [0, 0, 0];
    const p2 = Object.assign({}, pose, { root: [root[0], root[1] - low + (pose.lift || 0), root[2]] });
    f = fk(sk, p2);
    return f;
  }

  // 8.4 Prueba de estabilidad: el CM proyectado dentro del polígono de apoyo.
  function balanced(f) {
    const cm = centerOfMass(f);
    const pts = [];
    for (const S of ['L', 'R']) { const q = footPoints(f, S); if (q.heel[1] < 0.02) pts.push(q.heel); if (q.toe[1] < 0.02) pts.push(q.toe); }
    if (pts.length < 2) return false;
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2]);
    return cm[0] >= Math.min(...xs) - 0.05 && cm[0] <= Math.max(...xs) + 0.05 && cm[2] >= Math.min(...zs) - 0.05 && cm[2] <= Math.max(...zs) + 0.05;
  }

  // ---------- Poses y animación (sección 10 de docs/correccion-visual.md) ----------
  const sin = Math.sin, TAU = Math.PI * 2;
  const A0 = C.aPose; // la A-pose (20°) es sólo de construcción: los ángulos se dan en absoluto

  // 10.1 Reposo: hombros a 7°, clavícula caída 3°, codos 12°, muñeca 10°,
  // contrapposto con contrarrotación, cabeza ladeada 3° y girada 5°, pies
  // separados 0.30 H (hombre) / 0.20 H (mujer) con las puntas abiertas 7°.
  function restJoints(sk, br = 0) {
    const s = sk.params.s;
    const footSep = M.lerp(0.30, 0.20, s), ankleX = sk.joints.ankle_L.rest[0];
    const legLen = sk.joints.hip_L.rest[1] - sk.joints.ankle_L.rest[1];
    const adduct = M.deg(Math.atan2(ankleX - footSep / 2, legLen));
    return {
      pelvis: { roll: 6, yaw: 3 }, spine: { roll: -4, flex: 1, yaw: -3 }, chest: { roll: -6, flex: -1 - br * 0.6, yaw: -4 },
      neck: { roll: 1, pitch: 2 }, head: { roll: 3, yaw: 5, pitch: 2 },
      clavicle_L: { abd: -3 + br * 0.6 }, clavicle_R: { abd: -3 + br * 0.6 },
      shoulder_L: { abd: 7 - A0, flex: 3 }, shoulder_R: { abd: 8 - A0, flex: -2 },
      elbow_L: { flex: 12 }, elbow_R: { flex: 14 }, wrist_L: { flex: 10 }, wrist_R: { flex: 10 },
      hip_L: { abd: -adduct, roll: -6, yaw: 7 }, hip_R: { flex: 10, abd: -adduct + 4, roll: -6, yaw: 7 },
      knee_R: { flex: 22 }, ankle_R: { flex: -8 },
    };
  }

  // 8.4 Contrapposto: el centro de masas se lleva sobre el tobillo de apoyo
  // inclinando las dos piernas en la cadera (los pies no se mueven).
  function balance(sk, pose) {
    const j = pose.joints;
    const legLen = sk.joints.hip_L.rest[1] - sk.joints.ankle_L.rest[1];
    for (let it = 0; it < 3; it++) {
      const f = ground(sk, pose), d = f.pos.ankle_L[0] - centerOfMass(f)[0];
      const th = M.deg(Math.asin(M.clamp(d / legLen, -0.5, 0.5)));
      j.hip_L.roll -= th; j.hip_R.roll -= th;
    }
    return pose;
  }

  function idle(sk, t) {
    const br = sin(t * TAU);
    const pose = { joints: restJoints(sk, br), root: [0, 0, 0], stance: 'L', hands: { L: 'relajada', R: 'relajada' } };
    return balance(sk, pose);
  }

  // Interpolación Catmull-Rom cíclica entre poses clave (10.2–10.3).
  function keyframes(keys, t) {
    const n = keys.length, x = (((t % 1) + 1) % 1) * n, i = Math.floor(x), u = x - i;
    const k0 = keys[(i - 1 + n) % n], k1 = keys[i], k2 = keys[(i + 1) % n], k3 = keys[(i + 2) % n];
    const out = {};
    for (const key of Object.keys(k1)) {
      const p0 = k0[key], p1 = k1[key], p2 = k2[key], p3 = k3[key];
      out[key] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }
    return out;
  }
  // Espejo de una pose clave (segunda mitad del ciclo).
  const mirror = (k) => ({ hL: k.hR, kL: k.kR, aL: k.aR, hR: k.hL, kR: k.kL, aR: k.aL, sL: k.sR, eL: k.eR, sR: k.sL, eR: k.eL, py: k.py, tw: -k.tw });

  // 10.2 Andar por poses clave (pierna izquierda y brazo derecho adelantados).
  // La tabla da cadera, rodilla y tobillo de la pierna izquierda; la pierna
  // de apoyo (D) y los brazos cuelgan del hombro (nunca más de 25° delante).
  const WALK = [
    { hL: 25, kL: 5, aL: -15, hR: -15, kR: 10, aR: 8, sR: 18, eR: 25, sL: -14, eL: 12, py: 0, tw: 5 },
    { hL: 20, kL: 20, aL: 0, hR: -10, kR: 30, aR: 12, sR: 12, eR: 20, sL: -10, eL: 12, py: -0.03, tw: 4 },
    { hL: 0, kL: 10, aL: 0, hR: 5, kR: 60, aR: -5, sR: 0, eR: 15, sL: 0, eL: 15, py: 0.02, tw: 0 },
    { hL: -10, kL: 5, aL: 20, hR: 20, kR: 40, aR: -10, sR: -10, eR: 15, sL: 10, eL: 20, py: 0, tw: -4 },
  ];
  // 10.3 Correr: tronco inclinado 12°, rodilla que avanza hasta 100°, codos a 85°, brazos ±35°.
  const RUN = [
    { hL: 40, kL: 25, aL: -10, hR: -25, kR: 40, aR: 25, sR: 35, eR: 85, sL: -30, eL: 85, py: 0, tw: 8 },
    { hL: 30, kL: 45, aL: 5, hR: -10, kR: 70, aR: 10, sR: 20, eR: 85, sL: -20, eL: 85, py: -0.04, tw: 5 },
    { hL: 0, kL: 30, aL: 15, hR: 55, kR: 100, aR: -5, sR: 0, eR: 85, sL: 0, eL: 85, py: 0.08, tw: 0 },
    { hL: -20, kL: 40, aL: 25, hR: 60, kR: 60, aR: -10, sR: -25, eR: 85, sL: 25, eL: 85, py: 0.12, tw: -6 },
  ];
  function locomotion(sk, t, table, run) {
    const s = sk.params.s;
    const keys = table.concat(table.map(mirror));
    const k = keyframes(keys, t);
    const armK = M.lerp(1.2, 1, s);
    const narrow = s * 2;
    const roll = M.dimorph(C.walk.roll, s, 1) * (run ? 0.6 : 1) * Math.cos(t * TAU);
    const j = {
      pelvis: { yaw: 6 * sin(t * TAU), roll: -roll, flex: run ? 10 : 2 },
      spine: { yaw: -3 * sin(t * TAU) - k.tw * 0.5, flex: run ? 8 : 1 },
      chest: { yaw: -4 * sin(t * TAU) - k.tw * 0.5, roll: roll * 0.5 },
      // La cabeza compensa la mitad del giro de los hombros y mira al frente.
      head: { yaw: 4 * sin(t * TAU) + k.tw * 0.5, pitch: run ? -8 : 0 },
      hip_L: { flex: k.hL, abd: -narrow, roll }, knee_L: { flex: k.kL }, ankle_L: { flex: k.aL },
      hip_R: { flex: k.hR, abd: -narrow, roll }, knee_R: { flex: k.kR }, ankle_R: { flex: k.aR },
      shoulder_L: { flex: Math.min(25, k.sL * armK), abd: 8 - A0 }, shoulder_R: { flex: Math.min(25, k.sR * armK), abd: 8 - A0 },
      elbow_L: { flex: k.eL }, elbow_R: { flex: k.eR }, wrist_L: { flex: 10 }, wrist_R: { flex: 10 },
      clavicle_L: { abd: -3 }, clavicle_R: { abd: -3 },
    };
    if (run) { j.shoulder_L.flex = k.sL; j.shoulder_R.flex = k.sR; }
    return { joints: j, lift: run ? Math.max(0, k.py) : 0, hands: { L: run ? 'puno' : 'relajada', R: run ? 'puno' : 'relajada' } };
  }
  const walk = (sk, t, run = false) => locomotion(sk, t, run ? RUN : WALK, run);

  // Interpolación lineal entre poses clave (animaciones que no son ciclos).
  function sequence(keys, t) {
    let a = keys[0], b = keys[keys.length - 1], u = 0;
    for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; u = (t - a.t) / Math.max(1e-6, b.t - a.t); break; }
    const e = u * u * (3 - 2 * u), out = {};
    for (const key of Object.keys(a)) if (key !== 't') out[key] = a[key] + (b[key] - a[key]) * e;
    return out;
  }

  // 10.3 Saltar: anticipación, impulso, aire, caída y recuperación.
  const JUMP = [
    { t: 0, k: 5, h: 5, sh: 0, lift: 0, a: 0 }, { t: 0.2, k: 60, h: 50, sh: -40, lift: 0, a: -20 },
    { t: 0.35, k: 0, h: 0, sh: 150, lift: 0.3, a: 30 }, { t: 0.6, k: 40, h: 35, sh: 120, lift: 1.1, a: 15 },
    { t: 0.8, k: 50, h: 45, sh: 30, lift: 0, a: -10 }, { t: 1, k: 8, h: 6, sh: 0, lift: 0, a: 0 },
  ];
  function jump(sk, t) {
    const k = sequence(JUMP, t);
    const j = {
      pelvis: { flex: k.h * 0.2 }, spine: { flex: k.h * 0.2 }, chest: { flex: k.h * 0.1 }, head: { pitch: -k.h * 0.15 },
      hip_L: { flex: k.h, abd: -2 }, hip_R: { flex: k.h, abd: -2 }, knee_L: { flex: k.k }, knee_R: { flex: k.k },
      ankle_L: { flex: k.a }, ankle_R: { flex: k.a },
      shoulder_L: { flex: k.sh, abd: 12 - A0 }, shoulder_R: { flex: k.sh, abd: 12 - A0 }, elbow_L: { flex: 20 }, elbow_R: { flex: 20 },
    };
    return { joints: j, lift: k.lift, hands: { L: 'abierta', R: 'abierta' } };
  }

  // 10.3 Saludar: hombro a 110° (no 180°), codo a 100° con el antebrazo vertical,
  // palma al frente, muñeca ±20° a 2 Hz y cabeza ladeada 5° hacia el saludo.
  function wave(sk, t) {
    const p = idle(sk, t * 0.5);
    const sw = sin(t * TAU * 2);
    Object.assign(p.joints, {
      shoulder_R: { abd: 110 - A0, flex: 12 }, elbow_R: { flex: 100, yaw: 0 }, wrist_R: { flex: 20 * sw, roll: 0 },
      head: { roll: -5, pitch: -2, yaw: -6 },
    });
    p.hands = { L: 'relajada', R: 'abierta' };
    p.face = { mouth_smile: 0.8, eye_smile: 0.6, brow_up: 0.3 };
    return p;
  }

  // 10.3 Atacar: anticipación (2 fotogramas), golpe (1), continuación (2) y
  // recuperación (3). En el golpe el tronco gira 30°, el pie delantero avanza,
  // el brazo se extiende con el codo a 10° y el peso pasa a la pierna delantera.
  const ATTACK = [
    { t: 0, tw: 0, sh: 0, ab: 10, el: 30, hl: 0, kl: 10, hr: 0, kr: 10 },
    { t: 0.25, tw: 20, sh: -35, ab: 45, el: 100, hl: 5, kl: 25, hr: -5, kr: 25 },
    { t: 0.375, tw: -30, sh: 90, ab: 20, el: 10, hl: 30, kl: 30, hr: -20, kr: 10 },
    { t: 0.625, tw: -35, sh: 70, ab: 15, el: 20, hl: 32, kl: 35, hr: -22, kr: 12 },
    { t: 1, tw: 0, sh: 0, ab: 10, el: 30, hl: 0, kl: 10, hr: 0, kr: 10 },
  ];
  function attack(sk, t) {
    const k = sequence(ATTACK, t);
    const j = {
      pelvis: { yaw: k.tw * 0.5 }, spine: { yaw: k.tw * 0.25, flex: 4 }, chest: { yaw: k.tw * 0.25 }, head: { yaw: -k.tw * 0.4 },
      hip_L: { flex: k.hl, abd: 4 }, knee_L: { flex: k.kl }, hip_R: { flex: k.hr, abd: 6 }, knee_R: { flex: k.kr },
      shoulder_R: { flex: k.sh, abd: k.ab - A0 }, elbow_R: { flex: k.el }, shoulder_L: { flex: 20, abd: 25 - A0 }, elbow_L: { flex: 80 },
    };
    return { joints: j, hands: { L: 'puno', R: 'puno' }, face: { brow_frown: 0.8, mouth_open: t > 0.3 && t < 0.6 ? 0.5 : 0, eye_open: 0.85 } };
  }

  // Visemas (A, I, U, E, O, cerrado) para hablar, con asentimientos de 2–3°.
  const VISEMES = [{ mouth_open: 0.7 }, { mouth_open: 0.25, mouth_wide: 0.5 }, { mouth_open: 0.3, mouth_wide: -0.5 }, { mouth_open: 0.45, mouth_wide: 0.2 }, {}];

  function animate(sk, animId, t) {
    switch (animId) {
      case 'walk': return walk(sk, t);
      case 'run': return walk(sk, t, true);
      case 'jump': return jump(sk, t);
      case 'wave': return wave(sk, t);
      case 'attack': return attack(sk, t);
      case 'talk': {
        const p = idle(sk, t);
        p.joints.head.pitch += 2.5 * sin(t * TAU * 2);
        p.face = Object.assign({ brow_up: t < 0.25 ? 0.3 : 0 }, VISEMES[Math.floor(t * 5) % 5]);
        return p;
      }
      case 'blink': { const p = idle(sk, t); p.face = { eye_open: Math.abs(t - 0.5) < 0.13 ? 0 : 1 }; return p; }
      default: return idle(sk, t);
    }
  }

  // Pose final: pies en el suelo (o en el aire en los saltos).
  const solve = (sk, pose) => ground(sk, pose);

  return { clampJoint, localRot, fk, ik2, centerOfMass, footPoints, ground, balanced, animate, solve, idle, walk };
})();
