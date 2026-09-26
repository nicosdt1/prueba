// Animaciones: cada una genera una pose por fotograma. Las poses sólo mueven
// el esqueleto, así que cualquier combinación de ropa se anima sola.
SC.ANIMS = (() => {
  const TAU = Math.PI * 2;
  const arms = (l, r) => [Object.assign({ a: 0.07, e: -0.04 }, l), Object.assign({ a: 0.07, e: -0.04 }, r)];
  const legs = (l, r) => [Object.assign({ lift: 0, spread: 0 }, l), Object.assign({ lift: 0, spread: 0 }, r)];

  const list = [
    {
      id: 'idle', name: 'Reposo', frames: 4, fps: 4,
      pose(i, n) {
        const br = (1 - Math.cos((i / n) * TAU)) / 2;
        return { breathe: br, bob: br * 0.004, arms: arms({ a: 0.07 + br * 0.03 }, { a: 0.07 + br * 0.03 }) };
      },
    },
    {
      id: 'walk', name: 'Caminar', frames: 4, fps: 7,
      pose(i, n) {
        const ph = (i / n) * TAU, s = Math.sin(ph);
        return {
          bob: -Math.abs(s) * 0.012 + 0.006,
          sway: -s * 0.008,
          headTilt: s * 0.02,
          legs: legs({ lift: Math.max(0, s) }, { lift: Math.max(0, -s) }),
          arms: arms({ a: 0.1 + s * 0.08, e: -0.06 - Math.max(0, -s) * 0.22 },
                     { a: 0.1 - s * 0.08, e: -0.06 - Math.max(0, s) * 0.22 }),
        };
      },
    },
    {
      id: 'run', name: 'Correr', frames: 6, fps: 12,
      pose(i, n) {
        const ph = (i / n) * TAU, s = Math.sin(ph);
        return {
          bob: -Math.abs(s) * 0.03 + 0.012,
          sway: -s * 0.012,
          headTilt: s * 0.03,
          legs: legs({ lift: Math.max(0, s) * 1.6 }, { lift: Math.max(0, -s) * 1.6 }),
          arms: arms({ a: 0.35 + s * 0.2, e: -1.1 }, { a: 0.35 - s * 0.2, e: -1.1 }),
        };
      },
    },
    {
      id: 'jump', name: 'Saltar', frames: 6, fps: 10,
      pose(i) {
        const seq = [
          { crouch: 0.5, arms: arms({ a: 0.35, e: -0.2 }, { a: 0.35, e: -0.2 }) },
          { jump: 0.04, arms: arms({ a: 1.6, e: 0.3 }, { a: 1.6, e: 0.3 }), legs: legs({ lift: 0.4 }, { lift: 0.4 }) },
          { jump: 0.08, arms: arms({ a: 2.2, e: 0.4 }, { a: 2.2, e: 0.4 }), legs: legs({ lift: 0.8 }, { lift: 0.8 }) },
          { jump: 0.06, arms: arms({ a: 1.8, e: 0.3 }, { a: 1.8, e: 0.3 }), legs: legs({ lift: 0.5 }, { lift: 0.5 }) },
          { jump: 0.02, arms: arms({ a: 0.9, e: 0 }, { a: 0.9, e: 0 }) },
          { crouch: 0.35, arms: arms({ a: 0.4, e: -0.2 }, { a: 0.4, e: -0.2 }) },
        ];
        return seq[i];
      },
    },
    {
      id: 'wave', name: 'Saludar', frames: 6, fps: 8,
      pose(i, n) {
        const w = Math.sin((i / n) * TAU);
        return { headTilt: -0.04, arms: arms({}, { a: 2.35, e: 0.55 + w * 0.35 }) };
      },
    },
    {
      id: 'attack', name: 'Atacar', frames: 4, fps: 10,
      pose(i) {
        const seq = [
          { lean: -0.05, arms: arms({}, { a: 2.6, e: 0.3 }) },
          { lean: 0.02, arms: arms({}, { a: 1.9, e: 0.1 }) },
          { lean: 0.08, crouch: 0.2, arms: arms({ a: 0.3 }, { a: 0.6, e: -0.2 }) },
          { lean: 0.03, arms: arms({}, { a: 0.3, e: -0.1 }) },
        ];
        return seq[i];
      },
    },
    {
      id: 'talk', name: 'Hablar', frames: 4, fps: 8,
      pose(i) { return { mouth: ['talkA', 'talkB', 'talkA', null][i], breathe: i % 2 ? 0.3 : 0 }; },
    },
    {
      id: 'blink', name: 'Parpadear', frames: 4, fps: 6,
      pose(i) { return { blink: i === 2 }; },
    },
  ];
  const map = {};
  for (const a of list) map[a.id] = a;
  return map;
})();
