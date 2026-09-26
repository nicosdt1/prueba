// Registro de piezas modulares, ranuras (slots), capas de dibujo y expresiones.
//
// Una pieza es un objeto:
//   {
//     slot: 'top',                 // ranura donde se equipa
//     id: 'camiseta', name: 'Camiseta',
//     colors: { main: { label: 'Tela', value: '#4a7bd0' }, ... },
//     layers: { top(ctx, rig, c) {...}, sleeves(ctx, rig, c) {...} },
//   }
// Cada función de capa recibe el contexto, el rig (esqueleto calculado) y los
// colores resueltos. Para añadir ropa nueva basta con llamar a SC.registerPart.

// Orden de las ranuras en la interfaz (y orden de dibujo dentro de una misma capa).
SC.SLOTS = [
  { id: 'body', name: 'Cuerpo', group: 'Cuerpo', required: true },
  { id: 'eyes', name: 'Ojos', group: 'Cara', required: true },
  { id: 'hair', name: 'Peinado', group: 'Pelo' },
  { id: 'top', name: 'Parte superior', group: 'Ropa' },
  { id: 'outer', name: 'Abrigo', group: 'Ropa' },
  { id: 'bottom', name: 'Parte inferior', group: 'Ropa' },
  { id: 'shoes', name: 'Calzado', group: 'Ropa' },
  { id: 'headAcc', name: 'Cabeza', group: 'Accesorios' },
  { id: 'faceAcc', name: 'Cara', group: 'Accesorios' },
  { id: 'neckAcc', name: 'Cuello', group: 'Accesorios' },
  { id: 'backAcc', name: 'Espalda', group: 'Accesorios' },
];

// Capas de atrás hacia delante. head = true: se dibuja en coordenadas locales
// de la cabeza (origen en su centro, rota con ella).
SC.LAYERS = [
  { id: 'backAcc' },
  { id: 'hairBack', head: true },
  { id: 'legs' },
  { id: 'neck' },
  { id: 'torso' },
  { id: 'shoes' },
  { id: 'bottom' },
  { id: 'shoesOver' },
  { id: 'top' },
  { id: 'outer' },
  { id: 'arms' },
  { id: 'sleeves' },
  { id: 'outerSleeves' },
  { id: 'neckAcc' },
  { id: 'head', head: true },
  { id: 'face', head: true },
  { id: 'faceAcc', head: true },
  { id: 'hairFront', head: true },
  { id: 'headAcc', head: true },
];

SC.parts = {};
SC.registerPart = function registerPart(def) {
  if (!SC.SLOTS.some((s) => s.id === def.slot)) throw new Error('Ranura desconocida: ' + def.slot);
  (SC.parts[def.slot] = SC.parts[def.slot] || {})[def.id] = def;
  return def;
};
SC.partList = (slot) => Object.values(SC.parts[slot] || {});
SC.getPart = (slot, id) => (SC.parts[slot] || {})[id] || null;

// Colores efectivos de una pieza: los del personaje encima de los por defecto.
SC.resolveColors = function resolveColors(def, sel) {
  const out = {};
  for (const [k, v] of Object.entries(def.colors || {})) {
    out[k] = (sel && sel.colors && sel.colors[k]) || v.value;
  }
  return out;
};

// Expresiones faciales (útiles sobre todo para novela visual).
SC.EXPRESSIONS = {
  neutral: { name: 'Neutral', brows: 'neutral', eyes: 'open', mouth: 'neutral', blush: 0 },
  feliz: { name: 'Feliz', brows: 'raised', eyes: 'open', mouth: 'smile', blush: 0 },
  alegre: { name: 'Muy feliz', brows: 'raised', eyes: 'happy', mouth: 'grin', blush: 0.4 },
  triste: { name: 'Triste', brows: 'sad', eyes: 'half', mouth: 'frown', blush: 0 },
  enfadado: { name: 'Enfadado', brows: 'angry', eyes: 'narrow', mouth: 'angry', blush: 0 },
  sorprendido: { name: 'Sorprendido', brows: 'raised', eyes: 'wide', mouth: 'o', blush: 0 },
  avergonzado: { name: 'Avergonzado', brows: 'sad', eyes: 'open', mouth: 'wavy', blush: 1 },
  pensativo: { name: 'Pensativo', brows: 'tilt', eyes: 'side', mouth: 'flat', blush: 0 },
  guino: { name: 'Guiño', brows: 'raised', eyes: 'wink', mouth: 'smile', blush: 0.3 },
};
