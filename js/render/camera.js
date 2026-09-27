// Cámara ortográfica común (docs/correccion-visual.md 11.1): giro θ alrededor
// de Y e inclinación ψ. box: { cx, cy (centro en H), scale (px por H) }.
SC.camera = (yaw, tilt, W, H, box) => {
  const M = SC.AM;
  const r = [Math.cos(yaw), 0, Math.sin(yaw)];
  const f0 = [-Math.sin(yaw), 0, Math.cos(yaw)];
  const u = M.sub(M.mul([0, 1, 0], Math.cos(tilt)), M.mul(f0, Math.sin(tilt)));
  const f = M.add(M.mul([0, 1, 0], Math.sin(tilt)), M.mul(f0, Math.cos(tilt)));
  // La luz se fija respecto al personaje (sólo gira con θ): al inclinar la
  // cámara no pasa a venir de detrás de la cabeza.
  const L0 = M.norm(SC.CANON.light);
  const lw = M.norm(M.add(M.add(M.mul(r, L0[0]), [0, L0[1], 0]), M.mul(f0, L0[2])));
  return {
    r, u, f, W, H, scale: box.scale, cx: box.cx, cy: box.cy,
    // Píxel → coordenadas de vista (x a la derecha, y arriba) en H.
    view: (px, py) => [box.cx + (px + 0.5 - W / 2) / box.scale, box.cy - (py + 0.5 - H / 2) / box.scale],
    // Punto del modelo → píxel (z = profundidad, mayor = más cerca).
    project: (p) => {
      const x = M.dot(p, r), y = M.dot(p, u), z = M.dot(p, f);
      return { x: (x - box.cx) * box.scale + W / 2, y: (box.cy - y) * box.scale + H / 2, z };
    },
    light: [M.dot(lw, r), M.dot(lw, u), M.dot(lw, f)], // en espacio de vista
  };
};
