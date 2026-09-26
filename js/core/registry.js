// Registro de piezas modulares, ranuras (slots) y expresiones.
//
// Una pieza es un objeto con funciones opcionales por región del cuerpo:
//   {
//     slot: 'top', id: 'camiseta', name: 'Camiseta',
//     colors: { main: { label: 'Tela', value: '#4a7bd0' } },
//     rank: 30,                        // orden de apilado dentro de una región
//     torso(ctx, rig, c, T) {},        // sobre el torso (T: superficie y utilidades)
//     arm(ctx, rig, c, A) {},          // sobre cada brazo
//     leg(ctx, rig, c, L) {},          // sobre cada pierna
//     face / glasses(ctx, rig, c, Hd) {}, // rasgos de la cara / gafas
//     hairShell / hairFront / hat(ctx, rig, c, Hd) {},
//     opening(rig, T) -> [[nivel, phi], ...]   // abertura frontal (abrigos)
//     items(rig, c) -> [{ z, draw(ctx) }]      // elementos sueltos ordenados por profundidad
//   }
// Para añadir ropa nueva basta con llamar a SC.registerPart.

SC.SLOTS = [
  { id: 'body', name: 'Cuerpo', group: 'Cuerpo', required: true, rank: 0 },
  { id: 'eyes', name: 'Ojos', group: 'Cara', required: true, rank: 0 },
  { id: 'hair', name: 'Peinado', group: 'Pelo', rank: 0 },
  { id: 'top', name: 'Parte superior', group: 'Ropa', rank: 30 },
  { id: 'outer', name: 'Abrigo', group: 'Ropa', rank: 40 },
  { id: 'bottom', name: 'Parte inferior', group: 'Ropa', rank: 20 },
  { id: 'shoes', name: 'Calzado', group: 'Ropa', rank: 15 },
  { id: 'headAcc', name: 'Cabeza', group: 'Accesorios', rank: 60 },
  { id: 'faceAcc', name: 'Cara', group: 'Accesorios', rank: 58 },
  { id: 'neckAcc', name: 'Cuello', group: 'Accesorios', rank: 50 },
  { id: 'backAcc', name: 'Espalda', group: 'Accesorios', rank: 55 },
];

SC.parts = {};
SC.registerPart = function registerPart(def) {
  const slot = SC.SLOTS.find((s) => s.id === def.slot);
  if (!slot) throw new Error('Ranura desconocida: ' + def.slot);
  if (def.rank == null) def.rank = slot.rank;
  (SC.parts[def.slot] = SC.parts[def.slot] || {})[def.id] = def;
  return def;
};
SC.partList = (slot) => Object.values(SC.parts[slot] || {});
SC.getPart = (slot, id) => (SC.parts[slot] || {})[id] || null;

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
  serio: { name: 'Serio', brows: 'low', eyes: 'narrowSoft', mouth: 'flat', blush: 0 },
  presumido: { name: 'Presumido', brows: 'tilt', eyes: 'half', mouth: 'smirk', blush: 0 },
};
