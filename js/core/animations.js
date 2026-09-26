// Animaciones: cada una genera una pose 3D por fotograma. Como sólo mueven el
// esqueleto, cualquier combinación de ropa se anima sola y en cualquier vista
// (en perfil se ve el paso completo; de frente, el levantamiento de rodillas).
SC.ANIMS = (() => {
  const TAU = Math.PI * 2;
  const arm = SC.armPose, leg = SC.legPose;
  const pos = (x) => Math.max(0, x);

  const list = [
    {
      id: 'idle', name: 'Reposo', frames: 4, fps: 4,
      pose(i, n) {
        const br = (1 - Math.cos((i / n) * TAU)) / 2;
        const rest = SC.restPose();
        return Object.assign(rest, {
          breathe: br, sway: rest.sway + br * 0.003, headTilt: rest.headTilt + br * 0.015,
          arms: [arm({ abd: 0.17 + br * 0.02, bend: 0.3, flex: 0.1 }), arm({ abd: 0.1 + br * 0.02, bend: 0.14, flex: -0.04 })],
        });
      },
    },
    {
      id: 'walk', name: 'Caminar', frames: 8, fps: 10,
      pose(i, n) {
        const ph = (i / n) * TAU, s = Math.sin(ph);
        const L = (p) => leg({ flex: 0.42 * Math.sin(p), knee: 0.08 + 0.95 * Math.pow(pos(Math.cos(p)), 1.6) });
        return {
          twist: 0.07 * s, pitch: 0.03, sway: -0.006 * Math.cos(ph), headYaw: -0.04 * s,
          legs: [L(ph), L(ph + Math.PI)],
          arms: [arm({ flex: -0.32 * s, bend: 0.2 + 0.25 * pos(-s), abd: 0.1 }), arm({ flex: 0.32 * s, bend: 0.2 + 0.25 * pos(s), abd: 0.1 })],
        };
      },
    },
    {
      id: 'run', name: 'Correr', frames: 8, fps: 14,
      pose(i, n) {
        const ph = (i / n) * TAU, s = Math.sin(ph);
        const L = (p) => leg({ flex: 0.1 + 0.7 * Math.sin(p), knee: 0.3 + 1.5 * Math.pow(pos(Math.cos(p)), 1.1) });
        return {
          twist: 0.14 * s, pitch: 0.14, jump: 0.012 * Math.abs(Math.cos(ph)),
          legs: [L(ph), L(ph + Math.PI)],
          arms: [arm({ flex: -0.7 * s, bend: 1.45, abd: 0.15, fist: 1 }), arm({ flex: 0.7 * s, bend: 1.45, abd: 0.15, fist: 1 })],
        };
      },
    },
    {
      id: 'jump', name: 'Saltar', frames: 6, fps: 10,
      pose(i) {
        const up = (abd, bend = 0.3) => [arm({ abd, bend, hint: 'up' }), arm({ abd, bend, hint: 'up' })];
        const tuck = (f, k) => [leg({ flex: f, knee: k }), leg({ flex: f, knee: k })];
        const seq = [
          { crouch: 0.45, pitch: 0.12, arms: [arm({ flex: -0.5, bend: 0.3 }), arm({ flex: -0.5, bend: 0.3 })] },
          { jump: 0.04, arms: up(1.5), legs: tuck(0.2, 0.3) },
          { jump: 0.09, arms: up(2.3, 0.4), legs: tuck(0.5, 1.0) },
          { jump: 0.07, arms: up(1.9), legs: tuck(0.35, 0.6) },
          { jump: 0.02, arms: up(0.9, 0.2), legs: tuck(0.1, 0.2) },
          { crouch: 0.3, pitch: 0.08, arms: [arm({ abd: 0.4 }), arm({ abd: 0.4 })] },
        ];
        return seq[i];
      },
    },
    {
      id: 'wave', name: 'Saludar', frames: 6, fps: 8,
      pose(i, n) {
        const w = Math.sin((i / n) * TAU);
        return { headTilt: -0.05, roll: -0.02, arms: [arm(), arm({ abd: 2.3, bend: 0.55 + w * 0.35, hint: 'up', palm: 'fwd' })] };
      },
    },
    {
      id: 'attack', name: 'Atacar', frames: 5, fps: 12,
      pose(i) {
        const seq = [
          { twist: -0.25, pitch: -0.04, arms: [arm({ flex: 0.3 }), arm({ flex: 2.7, bend: 0.4, fist: 1 })], legs: [leg({ flex: 0.25, knee: 0.3 }), leg({ flex: -0.2, knee: 0.1 })] },
          { twist: -0.1, pitch: 0.04, arms: [arm({ flex: 0.1 }), arm({ flex: 2.0, bend: 0.2, fist: 1 })], legs: [leg({ flex: 0.3, knee: 0.35 }), leg({ flex: -0.25, knee: 0.1 })] },
          { twist: 0.25, pitch: 0.15, crouch: 0.15, arms: [arm({ flex: -0.4, bend: 0.4 }), arm({ flex: 0.9, bend: 0.1, fist: 1 })], legs: [leg({ flex: 0.4, knee: 0.5 }), leg({ flex: -0.3, knee: 0.1 })] },
          { twist: 0.3, pitch: 0.17, crouch: 0.15, arms: [arm({ flex: -0.45, bend: 0.4 }), arm({ flex: 0.5, bend: 0.1, fist: 1 })], legs: [leg({ flex: 0.4, knee: 0.5 }), leg({ flex: -0.3, knee: 0.1 })] },
          { twist: 0.1, pitch: 0.05, arms: [arm(), arm({ flex: 0.2, bend: 0.2, fist: 1 })] },
        ];
        return seq[i];
      },
    },
    {
      id: 'talk', name: 'Hablar', frames: 4, fps: 8,
      pose(i) { return Object.assign(SC.restPose(), { mouth: ['talkA', 'talkB', 'talkA', null][i], breathe: i % 2 ? 0.3 : 0, headNod: 0.03 + (i % 2 ? 0.02 : 0) }); },
    },
    {
      id: 'blink', name: 'Parpadear', frames: 4, fps: 6,
      pose(i) { return Object.assign(SC.restPose(), { blink: i === 2 }); },
    },
  ];
  const map = {};
  for (const a of list) map[a.id] = a;
  return map;
})();
