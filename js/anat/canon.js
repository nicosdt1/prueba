// Canon anatómico: todas las tablas de docs/base-matematica.md en un solo sitio.
// El código lee de aquí y no lleva números mágicos, así se pueden ajustar las
// proporciones sin tocar la lógica. (Es un .js y no un .json para que la app
// funcione con doble clic: con file:// el navegador no deja leer archivos JSON.)
//
// Unidades: H = alto de la cabeza. Pares [hombre, mujer] (s = 0 y s = 1).
SC.CANON = {
  // 3.1 Estilos: N = cabezas de alto, lambda = fracción de pierna. face = guías de la cara.
  styles: {
    realista: { name: 'Realista', N: 7.5, lambda: 0.50, face: 'realista' },
    heroico: { name: 'Heroico', N: 8.0, lambda: 0.50, face: 'realista' },
    anime: { name: 'Anime / VN', N: 7.0, lambda: 0.50, face: 'anime' }, // λ 0.53 → 0.50 (auditoría 3.2)
    shojo: { name: 'Shōjo', N: 7.5, lambda: 0.52, face: 'anime' }, // λ 0.55 → 0.52
    pixel64: { name: 'Pixel 64', N: 5.0, lambda: 0.42, face: 'anime' },
    pixel32: { name: 'Pixel 32', N: 4.0, lambda: 0.38, face: 'chibi' },
    chibi: { name: 'Chibi / SD', N: 2.3, lambda: 0.26, face: 'chibi' },
  },
  minTorso: 0.8, // L_torso >= 0.8 H
  // Auditoría 3.1: los anchos de 3.3 están medidos sobre un tronco de 3.0 H y una
  // pierna de 4.0 H (canon de 8 cabezas). Se escalan al largo real de cada estilo:
  // tronco y brazos × L_torso / 3.0, piernas × L_pierna / 4.0; cuello y cabeza no.
  widthRef: { torso: 3.0, leg: 4.0 },
  widthGroup: { shoulders: 'torso', chest: 'torso', waist: 'torso', hip: 'torso', upperArm: 'torso', forearm: 'torso', wrist: 'torso', thigh: 'leg', knee: 'leg', calf: 'leg', ankle: 'leg' },
  // Auditoría 3.3: húmero y antebrazo fijos respecto al tronco, sin dimorfismo.
  armLength: { upperArm: 0.49, forearm: 0.40 },
  // Canon chibi propio (docs/correccion-visual.md, 11.1): no es un adulto encogido.
  // Entre 2.5 y 5 cabezas se interpola entre este canon y el de 5 cabezas.
  chibi: {
    widths: { neck: 0.35, shoulders: 0.80, chest: 0.74, waist: 0.68, hip: 0.75, thigh: 0.38, knee: 0.28, calf: 0.3, ankle: 0.22, upperArm: 0.28, forearm: 0.26, wrist: 0.22 },
    hand: 0.25, foot: 0.35, minLeg: 0.40,
  },
  handLength: [0.68, 0.80], // largo de mano adulto (6.3)

  // 3.2 Landmarks verticales: tau en el tronco (0 barbilla, 1 entrepierna), eta en la pierna.
  tau: {
    shoulder: [0.11, 0.12], axilla: [0.27, 0.27], nipple: [0.33, 0.37], underbust: [0.42, 0.45],
    waist: [0.60, 0.55], navel: [0.67, 0.66], crest: [0.72, 0.70], hip: [0.92, 0.90],
  },
  eta: { midThigh: [0.25, 0.25], knee: [0.50, 0.50], calf: [0.64, 0.64], ankle: [0.94, 0.95] },

  // 3.3 Anchos frontales [hombre, mujer, sensibilidad a la complexión k].
  widths: {
    neck: [0.55, 0.42, 0.10], shoulders: [2.10, 1.70, 0.08], chest: [1.70, 1.45, 0.12],
    waist: [1.35, 1.15, 0.30], hip: [1.50, 1.75, 0.18], thigh: [0.80, 0.85, 0.25],
    knee: [0.50, 0.45, 0.08], calf: [0.55, 0.50, 0.15], ankle: [0.30, 0.25, 0.05],
    upperArm: [0.45, 0.35, 0.20], forearm: [0.42, 0.32, 0.15], wrist: [0.28, 0.22, 0.05],
  },
  // 6.1 Profundidades (perfil).
  depth: { chest: [0.95, 0.88], waist: [0.80, 0.75], hip: [0.95, 1.05] },
  lordosis: [0, 8], // grados extra de curva lumbar (mujer)
  shoulderSlope: [15, 20],

  // 3.5 Índices de dimorfismo y umbrales.
  dimorph: { SHR: { male: 1.20, female: 1.10 }, WHR: { male: 0.80, female: 0.75 } },

  // 4.2–4.3 Esqueleto.
  kneeConv: [0.75, 0.60],
  footK: [0.27, 0.25],
  carry: [10, 15], // ángulo de carga del codo (grados)
  aPose: 20, // brazos abiertos en reposo (grados desde la vertical)

  // 4.4 Límites articulares (grados) [mín, máx].
  limits: {
    head: { pitch: [-50, 60], yaw: [-70, 70], roll: [-40, 40] },
    neck: { pitch: [-30, 40] },
    spine: { flex: [-30, 45] },
    shoulder: { abd: [-30, 180], flex: [-50, 180] },
    elbow: { flex: [0, 145] },
    wrist: { flex: [-70, 80] },
    hip: { flex: [-30, 120], abd: [-25, 45] },
    knee: { flex: [0, 140] },
    ankle: { flex: [-20, 50] },
  },

  // 5 Cabeza y cara.
  head: {
    W: { realista: [0.72, 0.70], anime: [0.74, 0.78], chibi: [0.86, 0.90] },
    guides: {
      realista: { hairline: 0.20, brow: 0.44, eye: 0.50, noseBase: 0.73, mouth: 0.82, earTop: 0.44, earBottom: 0.73 },
      anime: { hairline: 0.20, brow: 0.47, eye: 0.56, noseBase: 0.72, mouth: 0.81, earTop: 0.47, earBottom: 0.72 },
      chibi: { hairline: 0.25, brow: 0.52, eye: 0.62, noseBase: 0.76, mouth: 0.84, earTop: 0.52, earBottom: 0.76 },
    },
    alpha: { realista: 0.20, anime: 0.24, chibi: 0.30 }, // ancho de ojo = alpha * W
    eyeH: { realista: [0.40, 0.40], anime: [0.9, 1.1], chibi: [1.0, 1.2] }, // alto del ojo en anchos de ojo
    eyeSizeF: 1.15,
    noseW: [1.05, 0.9], mouthW: [1.6, 1.4], lipH: [0.12, 0.20],
    browLift: 0.02, browThick: [0.10, 0.06],
    // 5.4 Contorno frontal (u/W, v), lado izquierdo, de la coronilla a la barbilla.
    contour: {
      m: [[0, 0], [0.40, 0.08], [0.50, 0.35], [0.49, 0.55], [0.47, 0.68], [0.42, 0.84], [0.18, 0.98], [0.10, 1.0], [0, 1.0]],
      f: [[0, 0], [0.40, 0.08], [0.50, 0.35], [0.48, 0.55], [0.44, 0.68], [0.36, 0.80], [0.12, 0.96], [0.06, 0.995], [0, 1.0]],
    },
    // 5.6 Perfil (z/H, v): delante (sin la nariz, que es un rasgo aparte) y detrás.
    profileFront: [[0, 0], [0.30, 0.10], [0.38, 0.25], [0.42, 0.44], [0.40, 0.50], [0.42, 0.62], [0.43, 0.73], [0.44, 0.79], [0.42, 0.84], [0.38, 0.97], [0.25, 1.0]],
    profileBack: [[0, 0], [-0.30, 0.10], [-0.45, 0.35], [-0.40, 0.60], [-0.22, 0.76], [-0.05, 0.84], [0.25, 1.0]],
    femaleProfile: { nose: -0.03, brow: -0.03, chin: -0.02 },
    noseTip: [0.52, 0.70],
  },

  // 5.7 Expresiones: pesos de los canales (blendshapes 2D).
  expressions: {
    neutral: {},
    feliz: { mouth_smile: 0.8, eye_smile: 0.5, brow_up: 0.2 },
    alegre: { mouth_smile: 1, mouth_open: 0.6, eye_smile: 0.9, brow_up: 0.4 },
    triste: { brow_sad: 0.9, mouth_frown: 0.5, eye_open: 0.7 },
    enfadado: { brow_frown: 1, mouth_frown: 0.4, eye_open: 0.8 },
    sorprendido: { brow_up: 1, eye_open: 1.2, mouth_open: 0.7 },
    avergonzado: { blush: 1, eye_open: 0.6, mouth_smile: 0.2, brow_sad: 0.4 },
    pensativo: { brow_frown: 0.3, eye_open: 0.75, mouth_wide: -0.3, look: 0.6 },
    guino: { eye_open_R: 0, mouth_smile: 0.7, eye_smile: 0.4, brow_up: 0.2 },
    serio: { brow_frown: 0.5, eye_open: 0.85 },
    presumido: { mouth_smile: 0.4, eye_open: 0.7, brow_up: 0.3, smirk: 1 },
  },

  // 6.3 Busto.
  bust: { r0: 0.18, r1: 0.38, maxAnime: 0.85 },

  // 7 Brazos y manos.
  armProfile: { deltoid: [1.15, 1.05], biceps: 1.0, elbow: 0.85, bicepsFront: [1.1, 1.0] },
  hand: {
    omega: [0.45, 0.40], palm: 0.55, wristW: 0.85,
    // dedo: x del nudillo (× W_palma), y (× L), largo hombre, largo mujer, abanico (grados)
    fingers: [[0.375, 0.54, 0.380, 0.395, 6], [0.125, 0.56, 0.430, 0.430, 0], [-0.125, 0.54, 0.400, 0.395, -5], [-0.375, 0.49, 0.320, 0.320, -12]],
    phalanges: [0.47, 0.30, 0.23], thick: [0.085, 0.070],
    thumb: { base: [0.40, 0.12], seg: [0.20, 0.16, 0.13], spread: 40, twist: 60 },
    poses: {
      abierta: [0, 0, 0, 0, 0, 1], relajada: [0.2, 0.25, 0.30, 0.35, 0.40, 0.3], puno: [0.8, 1, 1, 1, 1, 0],
      senalar: [0.7, 0, 1, 1, 1, 0], paz: [0.7, 0, 0, 1, 1, 0.8], agarre: [0.5, 0.7, 0.7, 0.7, 0.7, 0], pulgar: [0, 1, 1, 1, 1, 0],
    },
  },

  // 8 Piernas y pies.
  thighProfile: [[0, 1, 1], [0.15, [1.0, 1.08], 1.0], [0.5, 0.9, 0.92], [0.8, 0.72, 0.80]],
  shinProfile: [[0.25, 1.0, 0.92], [0.35, 0.95, 1.0], [0.8, 0.6, 0.6]],
  foot: { heel: -0.25, ball: 0.55, toe: 0.75, width: [0.38, 0.36], heelW: 0.6 },
  mass: { head: 8.0, trunk: 50.0, upperArm: 2.8, forearm: 1.6, hand: 0.6, thigh: 10.0, shin: 4.65, foot: 1.45 },

  // 10.4 Ciclo de andar.
  walk: { Ah: 25, Ak: 55, Aa: 18, B: 0.03, pelvisYaw: 6, shoulderYaw: 4, roll: [4, 7], armM: 1.2 },

  // 11.4–11.5 Luz y rampas de color.
  light: [-0.5, 0.8, 0.3],
  ramp: { dL: 0.09, dC: 0.12, hueStep: 8, warm: 70, cool: 280, minDL: 0.06 },
};
