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
  function fk(sk, pose = {}) {
    const order = SC.anatBody.order(sk), J = sk.joints, pa = pose.joints || {};
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

  // ---------- Animaciones procedurales ----------
  const sin = Math.sin, cos = Math.cos, TAU = Math.PI * 2;
  const pos0 = (x) => Math.max(0, x);
  const relaxedArms = (j, br = 0) => {
    j.shoulder_L = { abd: -9 + br, flex: 4 }; j.shoulder_R = { abd: -12 + br, flex: -3 };
    j.elbow_L = { flex: 14 }; j.elbow_R = { flex: 8 };
  };

  // 8.4 Contrapposto: peso en la pierna izquierda, pelvis y hombros inclinados
  // en sentidos opuestos, rodilla libre flexionada; la pelvis se desplaza hasta
  // que el centro de masas cae sobre el tobillo de apoyo.
  function idle(sk, t) {
    const br = sin(t * TAU);
    const j = {
      pelvis: { roll: 6 }, spine: { roll: -4, flex: 1 }, chest: { roll: -6, flex: -1 - br * 0.6 },
      neck: { roll: 3, pitch: 2 }, head: { roll: 4, yaw: -4, pitch: 2 },
      // Las caderas compensan la inclinación de la pelvis: las piernas siguen verticales.
      // La pierna libre se acorta (rodilla flexionada) y el pie apoya la punta.
      hip_L: { abd: -2, roll: -6 }, hip_R: { flex: 10, abd: 4, roll: -6 }, knee_R: { flex: 24 }, ankle_R: { flex: -8 },
      clavicle_L: { abd: br * 0.8 }, clavicle_R: { abd: br * 0.8 },
    };
    relaxedArms(j, br);
    const pose = { joints: j, root: [0, 0, 0], stance: 'L' };
    // Lleva el centro de masas sobre el tobillo de apoyo sin mover los pies:
    // se inclinan las dos piernas en la cadera (la pelvis se desplaza encima).
    const legLen = sk.joints.hip_L.rest[1] - sk.joints.ankle_L.rest[1];
    for (let it = 0; it < 3; it++) {
      const f = ground(sk, pose), d = f.pos.ankle_L[0] - centerOfMass(f)[0];
      const th = M.deg(Math.asin(M.clamp(d / legLen, -0.5, 0.5)));
      j.hip_L.roll -= th; j.hip_R.roll -= th;
    }
    return pose;
  }

  // 10.4 Ciclo de andar (pierna izquierda con fase φ; derecha φ + π).
  function walk(sk, t, run = false) {
    const W = C.walk, s = sk.params.s;
    const Ah = run ? 42 : W.Ah, Ak = run ? 100 : W.Ak, Aa = (run ? 38 : W.Aa) * M.lerp(W.armM, 1, s);
    const phi = t * TAU;
    const leg = (p) => ({ hip: Ah * sin(p), knee: 5 + Ak * Math.pow(pos0(cos(p)), 1.5), ankle: 10 * sin(p - Math.PI / 2) });
    const Lg = leg(phi), Rg = leg(phi + Math.PI);
    const roll = M.dimorph(W.roll, s, 1);
    const narrow = s * 2;
    const j = {
      pelvis: { yaw: W.pelvisYaw * sin(phi), roll: -roll * cos(phi), flex: run ? 8 : 2 },
      spine: { yaw: -(W.pelvisYaw + W.shoulderYaw) * 0.5 * sin(phi), flex: run ? 6 : 1 },
      chest: { yaw: -(W.pelvisYaw + W.shoulderYaw) * 0.5 * sin(phi), roll: roll * 0.5 * cos(phi) },
      head: { yaw: -W.pelvisYaw * 0.4 * sin(phi), pitch: run ? -6 : 0 },
      hip_L: { flex: Lg.hip, abd: -narrow, roll: roll * cos(phi) }, knee_L: { flex: Lg.knee }, ankle_L: { flex: Lg.ankle },
      hip_R: { flex: Rg.hip, abd: -narrow, roll: roll * cos(phi) }, knee_R: { flex: Rg.knee }, ankle_R: { flex: Rg.ankle },
      shoulder_L: { flex: -Aa * sin(phi), abd: -4 }, shoulder_R: { flex: Aa * sin(phi), abd: -4 },
      elbow_L: { flex: run ? 85 : 15 + 10 * pos0(sin(phi)) }, elbow_R: { flex: run ? 85 : 15 + 10 * pos0(-sin(phi)) },
    };
    const pose = { joints: j, hands: { L: run ? 'puno' : 'relajada', R: run ? 'puno' : 'relajada' } };
    if (run) pose.lift = 0.12 * pos0(sin(2 * phi + 0.6));
    return pose;
  }

  function jump(sk, t) {
    // Agacharse → impulso → aire → caída.
    const k = t < 0.25 ? t / 0.25 : t < 0.4 ? 1 - (t - 0.25) / 0.15 : t < 0.8 ? 0 : (t - 0.8) / 0.2;
    const air = t >= 0.4 && t < 0.85 ? sin(((t - 0.4) / 0.45) * Math.PI) : 0;
    const tuck = air * 0.6;
    const j = {
      pelvis: { flex: 10 * k }, spine: { flex: 10 * k }, chest: { flex: 6 * k - 6 * air }, head: { pitch: -8 * k },
      hip_L: { flex: 70 * k + 50 * tuck }, hip_R: { flex: 70 * k + 50 * tuck },
      knee_L: { flex: 110 * k + 80 * tuck }, knee_R: { flex: 110 * k + 80 * tuck },
      ankle_L: { flex: -30 * k + 30 * air }, ankle_R: { flex: -30 * k + 30 * air },
      shoulder_L: { flex: -40 * k + 150 * air, abd: 10 + 20 * air }, shoulder_R: { flex: -40 * k + 150 * air, abd: 10 + 20 * air },
      elbow_L: { flex: 20 + 20 * air }, elbow_R: { flex: 20 + 20 * air },
    };
    return { joints: j, lift: 1.1 * air, hands: { L: 'abierta', R: 'abierta' } };
  }

  function wave(sk, t) {
    const p = idle(sk, t * 0.5);
    const sw = sin(t * TAU * 2);
    Object.assign(p.joints, {
      shoulder_R: { abd: 145, flex: 15 }, elbow_R: { flex: 55 + 25 * sw, yaw: 0 }, wrist_R: { flex: 10 * sw },
      head: { roll: 8, pitch: -2, yaw: -6 },
    });
    p.hands = { L: 'relajada', R: 'abierta' };
    p.face = { mouth_smile: 0.8, eye_smile: 0.6, brow_up: 0.3 };
    return p;
  }

  function attack(sk, t) {
    // Preparación, golpe y recuperación con el brazo derecho.
    const wind = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 0.15);
    const hit = t < 0.35 ? 0 : t < 0.6 ? (t - 0.35) / 0.25 : Math.max(0, 1 - (t - 0.6) / 0.4);
    const j = {
      pelvis: { yaw: 18 * wind - 22 * hit }, spine: { yaw: 10 * wind - 12 * hit, flex: 6 * hit }, chest: { yaw: 10 * wind - 12 * hit },
      head: { yaw: -12 * wind + 14 * hit },
      hip_L: { flex: 22 * hit, abd: 6 }, knee_L: { flex: 20 + 10 * hit }, hip_R: { flex: -14 * hit, abd: 8 }, knee_R: { flex: 14 },
      shoulder_R: { flex: -35 * wind + 95 * hit, abd: 35 * wind + 10 }, elbow_R: { flex: 95 * wind + 10 * (1 - hit) },
      shoulder_L: { flex: 30 * wind - 10 * hit, abd: 10 }, elbow_L: { flex: 70 },
    };
    return { joints: j, hands: { L: 'puno', R: 'puno' }, face: { brow_frown: 0.8, mouth_open: 0.4 * hit, eye_open: 0.85 } };
  }

  // Visemas (A, I, U, E, O, cerrado) para hablar.
  const VISEMES = [{ mouth_open: 0.7 }, { mouth_open: 0.25, mouth_wide: 0.5 }, { mouth_open: 0.3, mouth_wide: -0.5 }, {}];

  // Pose de cada animación de la app en el instante t ∈ [0, 1).
  function animate(sk, animId, t) {
    switch (animId) {
      case 'walk': return walk(sk, t);
      case 'run': return walk(sk, t, true);
      case 'jump': return jump(sk, t);
      case 'wave': return wave(sk, t);
      case 'attack': return attack(sk, t);
      case 'talk': { const p = idle(sk, t); p.face = VISEMES[Math.floor(t * 4) % 4]; return p; }
      case 'blink': { const p = idle(sk, t); p.face = { eye_open: Math.abs(t - 0.5) < 0.13 ? 0 : 1 }; return p; }
      default: return idle(sk, t);
    }
  }

  // Pose final: pies en el suelo (o en el aire en los saltos).
  const solve = (sk, pose) => ground(sk, pose);

  return { clampJoint, localRot, fk, ik2, centerOfMass, footPoints, ground, balanced, animate, solve, idle, walk };
})();
