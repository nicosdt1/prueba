// Parámetros del personaje → landmarks → esqueleto canónico en reposo
// (secciones 3 y 4 de docs/base-matematica.md). Es la única fuente de verdad
// sobre dónde está cada cosa: las formas, la ropa y el pelo se miden contra él.
//
// Espacio modelo: unidad H (alto de la cabeza), origen en el suelo entre los
// pies, +Y arriba, +X a la izquierda del personaje (derecha del espectador),
// +Z hacia el espectador. El lado derecho (R) es el espejo exacto del izquierdo.
SC.anatBody = (() => {
  const M = SC.AM;

  const DEFAULTS = {
    style: 'anime', s: 1, b: 0, e: 1.1,
    bust: { c: 0.5, g: 0.2, q: 0.5 },
    face: { eyeScale: 1, jaw: 0 },
  };

  function params(p = {}) {
    const d = DEFAULTS;
    return {
      style: SC.CANON.styles[p.style] ? p.style : d.style,
      s: M.clamp(p.s != null ? +p.s : d.s, 0, 1),
      b: M.clamp(p.b != null ? +p.b : d.b, -1, 1),
      e: M.clamp(p.e != null ? +p.e : d.e, 0.5, 1.5),
      bust: Object.assign({}, d.bust, p.bust || {}),
      face: Object.assign({}, d.face, p.face || {}),
    };
  }

  function skeleton(input) {
    const C = SC.CANON, P = params(input), st = C.styles[P.style];
    const { s, e, b } = P;
    const H = 1, N = st.N, T = N * H;
    const Lleg = st.lambda * T, Ltorso = T - H - Lleg;
    const yT = (tau) => T - H - tau * Ltorso;
    const yL = (eta) => (1 - eta) * Lleg;
    // Fracciones verticales (con dimorfismo y exageración, sin complexión).
    const tau = {}, eta = {};
    for (const [k, v] of Object.entries(C.tau)) tau[k] = M.dimorph(v, s, e);
    for (const [k, v] of Object.entries(C.eta)) eta[k] = M.dimorph(v, s, e);
    const w = {}, ws = Math.pow(N / C.widthScale.ref, C.widthScale.exp);
    for (const [k, v] of Object.entries(C.widths)) w[k] = M.width(v, s, e, b) * ws;
    const SHR = w.shoulders / w.hip, WHR = w.waist / w.hip;

    // 4.3 Longitudes de los huesos.
    const Larm = (tau.waist - tau.shoulder) * Ltorso;
    const Lfore = (1 - tau.waist) * Ltorso;
    const Lhand = 0.25 * Ltorso;
    const Lfoot = M.dimorph(C.footK, s, e) * Lleg;
    const ck = M.dimorph(C.kneeConv, s, 1);
    const carry = M.rad(M.dimorph(C.carry, s, 1));
    const aPose = M.rad(C.aPose);

    // 4.2 Posiciones en reposo (lado izquierdo; el derecho se espeja).
    const J = {};
    const set = (name, parent, p) => { J[name] = { parent, rest: p }; };
    set('pelvis', null, [0, yT(0.85), 0]);
    set('spine', 'pelvis', [0, yT(0.60), -0.05]);
    set('chest', 'spine', [0, yT(0.35), -0.05]);
    set('neck', 'chest', [0, yT(0.08), -0.08]);
    set('head', 'neck', [0, T - 0.85 * H, -0.05]);
    set('head_top', 'head', [0, T, 0]);
    const xs = 0.5 * w.shoulders - 0.5 * w.upperArm;
    const xh = 0.25 * w.hip, xk = ck * xh, xa = 0.95 * xk;
    const sideJoints = (sg, S) => {
      const sh = [sg * xs, yT(tau.shoulder), 0];
      const d1 = [sg * Math.sin(aPose), -Math.cos(aPose), 0];
      const d2 = [sg * Math.sin(aPose + carry), -Math.cos(aPose + carry), 0];
      const el = M.add(sh, M.mul(d1, Larm)), wr = M.add(el, M.mul(d2, Lfore));
      set('clavicle_' + S, 'chest', [sg * 0.10 * H, yT(0.10), 0]);
      set('shoulder_' + S, 'clavicle_' + S, sh);
      set('elbow_' + S, 'shoulder_' + S, el);
      set('wrist_' + S, 'elbow_' + S, wr);
      set('hand_' + S, 'wrist_' + S, M.add(wr, M.mul(d2, Lhand)));
      set('hip_' + S, 'pelvis', [sg * xh, yT(0.93), 0]);
      set('knee_' + S, 'hip_' + S, [sg * xk, yL(eta.knee), 0.03 * H]);
      set('ankle_' + S, 'knee_' + S, [sg * xa, yL(eta.ankle), 0]);
      set('toe_' + S, 'ankle_' + S, [sg * xa, 0, 0.75 * Lfoot]);
    };
    sideJoints(1, 'L');
    sideJoints(-1, 'R');

    const bones = {
      upperArm: Larm, forearm: Lfore, hand: Lhand, foot: Lfoot,
      thigh: M.dist(J.hip_L.rest, J.knee_L.rest), shin: M.dist(J.knee_L.rest, J.ankle_L.rest),
    };
    return {
      params: P, style: P.style, face: st.face, H, N, T, Lleg, Ltorso, yT, yL, tau, eta, w, widthScale: ws,
      indices: { SHR, WHR }, joints: J, bones, carry, aPose,
      valid: Ltorso >= C.minTorso * H - 1e-9,
    };
  }

  // Orden de la jerarquía (padres antes que hijos).
  function order(sk) {
    const out = [], seen = new Set();
    const visit = (n) => { if (seen.has(n)) return; const p = sk.joints[n].parent; if (p) visit(p); seen.add(n); out.push(n); };
    Object.keys(sk.joints).forEach(visit);
    return out;
  }

  // 3.5 Etiqueta morfológica según los índices.
  function sexLabel(sk) {
    const D = SC.CANON.dimorph, { SHR, WHR } = sk.indices;
    if (SHR >= D.SHR.male && WHR >= D.WHR.male) return 'masculino';
    if (SHR <= D.SHR.female && WHR <= D.WHR.female) return 'femenino';
    return 'andrógino';
  }

  return { DEFAULTS, params, skeleton, order, sexLabel };
})();
