// Catálogo común de la app: tamaño de referencia, vistas, expresiones y
// animaciones (las poses las calcula el rig anatómico, js/anat/rig.js).
SC.CANVAS_W = 600;
SC.CANVAS_H = 1000;

SC.VIEWS = {
  front: { name: 'Frente', yaw: 0 },
  three: { name: '3/4', yaw: 0.72 },
  side: { name: 'Perfil', yaw: Math.PI / 2 },
  back: { name: 'Espalda', yaw: Math.PI },
  threeBack: { name: '3/4 espalda', yaw: Math.PI - 0.72 },
  left: { name: 'Perfil izq.', yaw: -Math.PI / 2 },
};

// Nombres de las expresiones; sus pesos por canal están en SC.CANON.expressions.
SC.EXPRESSIONS = {
  neutral: { name: 'Neutral' },
  feliz: { name: 'Feliz' },
  alegre: { name: 'Muy feliz' },
  triste: { name: 'Triste' },
  enfadado: { name: 'Enfadado' },
  sorprendido: { name: 'Sorprendido' },
  avergonzado: { name: 'Avergonzado' },
  pensativo: { name: 'Pensativo' },
  guino: { name: 'Guiño' },
  serio: { name: 'Serio' },
  presumido: { name: 'Presumido' },
};

SC.ANIMS = Object.fromEntries([
  ['idle', 'Reposo', 4, 4], ['walk', 'Caminar', 8, 10], ['run', 'Correr', 8, 14], ['jump', 'Saltar', 6, 10],
  ['wave', 'Saludar', 6, 8], ['attack', 'Atacar', 5, 12], ['talk', 'Hablar', 4, 8], ['blink', 'Parpadear', 4, 6],
].map(([id, name, frames, fps]) => [id, { id, name, frames, fps }]));
