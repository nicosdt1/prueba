// Trazado de esferas en CPU (respaldo del render WebGL, sección 2.5) y cámara
// ortográfica común. Produce un G-buffer: profundidad, normal (en espacio de
// vista), parte, material y región por píxel, más oclusión ambiental y sombra
// proyectada cuando se piden.
SC.sdfMarch = (() => {
  const M = SC.AM, S = SC.SDF;

  // Cámara ortográfica: giro θ alrededor de Y (vista) e inclinación ψ (11.1).
  // box: { cx, cy, scale (px por H), W, H } en coordenadas de vista.
  function camera(yaw, tilt, W, H, box) {
    const r = [Math.cos(yaw), 0, Math.sin(yaw)];
    const f0 = [-Math.sin(yaw), 0, Math.cos(yaw)];
    const u = M.sub(M.mul([0, 1, 0], Math.cos(tilt)), M.mul(f0, Math.sin(tilt)));
    const f = M.add(M.mul([0, 1, 0], Math.sin(tilt)), M.mul(f0, Math.cos(tilt)));
    const far = 20;
    // La luz se fija respecto al personaje (sólo gira con θ): al inclinar la
    // cámara no pasa a venir de detrás de la cabeza.
    const L0 = M.norm([-0.5, 0.8, 0.3]);
    const lw = M.norm(M.add(M.add(M.mul(r, L0[0]), [0, L0[1], 0]), M.mul(f0, L0[2])));
    return {
      r, u, f, far, W, H, scale: box.scale, cx: box.cx, cy: box.cy,
      // Píxel → coordenadas de vista (x a la derecha, y arriba) en H.
      view: (px, py) => [box.cx + (px + 0.5 - W / 2) / box.scale, box.cy - (py + 0.5 - H / 2) / box.scale],
      // Punto del modelo → píxel.
      project: (p) => {
        const x = M.dot(p, r), y = M.dot(p, u), z = M.dot(p, f);
        return { x: (x - box.cx) * box.scale + W / 2, y: (box.cy - y) * box.scale + H / 2, z };
      },
      light: [M.dot(lw, r), M.dot(lw, u), M.dot(lw, f)], // en espacio de vista (derecha, arriba, hacia el espectador)
    };
  }

  // Candidatas de un rayo: partes cuya esfera envolvente corta el rayo, y su tramo.
  function candidates(scene, cam, vx, vy, list) {
    let t0 = Infinity, t1 = -Infinity, n = 0;
    const parts = scene.parts;
    for (let i = 0; i < parts.length; i++) {
      const b = parts[i].bounds, bx = b.pv[0] - vx, by = b.pv[1] - vy, d2 = bx * bx + by * by, r2 = b.r * b.r;
      if (d2 >= r2) continue;
      const h = Math.sqrt(r2 - d2), tc = cam.far - b.pv[2];
      t0 = Math.min(t0, tc - h); t1 = Math.max(t1, tc + h);
      list[n++] = i;
    }
    list.length = n;
    return n ? [Math.max(0, t0), t1] : null;
  }

  function prepare(scene, cam) {
    for (const p of scene.parts) p.bounds.pv = [M.dot(p.bounds.c, cam.r), M.dot(p.bounds.c, cam.u), M.dot(p.bounds.c, cam.f)];
  }

  // G-buffer completo. o: { ao, shadow, eps }
  function gbuffer(scene, cam, o = {}) {
    prepare(scene, cam);
    const W = cam.W, H = cam.H, N = W * H;
    const g = {
      W, H, cam,
      depth: new Float32Array(N).fill(NaN), nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N),
      part: new Int16Array(N).fill(-1), mat: new Int8Array(N).fill(-1), region: new Int16Array(N).fill(-1),
      ao: new Float32Array(N).fill(1), shadow: new Float32Array(N).fill(1),
    };
    const eps = o.eps || Math.max(0.0015, 0.35 / cam.scale);
    const list = [], info = { part: -1, mat: -1, region: 0 };
    const p = [0, 0, 0], q = [0, 0, 0];
    const { r, u, f, far } = cam;
    const E = 0.002;
    const dAt = (x, y, z) => { q[0] = x; q[1] = y; q[2] = z; return S.sceneDist(scene, q, list); };
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const [vx, vy] = cam.view(px, py);
        const span = candidates(scene, cam, vx, vy, list);
        if (!span) continue;
        const ox = r[0] * vx + u[0] * vy + f[0] * far, oy = r[1] * vx + u[1] * vy + f[1] * far, oz = r[2] * vx + u[2] * vy + f[2] * far;
        let t = span[0], hit = false;
        for (let it = 0; it < 96 && t < span[1]; it++) {
          p[0] = ox - f[0] * t; p[1] = oy - f[1] * t; p[2] = oz - f[2] * t;
          const d = S.sceneDist(scene, p, list, info);
          if (d < eps) { hit = true; break; }
          t += Math.max(d * 0.85, eps * 0.5);
        }
        if (!hit) continue;
        const i = py * W + px;
        g.depth[i] = far - t;
        g.part[i] = info.part; g.mat[i] = info.mat; g.region[i] = info.region;
        // Normal por diferencias centrales (ε = 0.002 H), pasada a espacio de vista.
        const nxw = dAt(p[0] + E, p[1], p[2]) - dAt(p[0] - E, p[1], p[2]);
        const nyw = dAt(p[0], p[1] + E, p[2]) - dAt(p[0], p[1] - E, p[2]);
        const nzw = dAt(p[0], p[1], p[2] + E) - dAt(p[0], p[1], p[2] - E);
        const l = Math.hypot(nxw, nyw, nzw) || 1;
        const n0 = nxw / l, n1 = nyw / l, n2 = nzw / l;
        g.nx[i] = n0 * r[0] + n1 * r[1] + n2 * r[2];
        g.ny[i] = n0 * u[0] + n1 * u[1] + n2 * u[2];
        g.nz[i] = n0 * f[0] + n1 * f[1] + n2 * f[2];
        if (o.ao || o.shadow) {
          const nw = [n0, n1, n2];
          if (o.ao) g.ao[i] = ambientOcclusion(scene, p, nw);
          if (o.shadow) g.shadow[i] = softShadow(scene, p, nw, cam);
        }
      }
    }
    return g;
  }

  // 9.3 Oclusión ambiental con 5 muestras a lo largo de la normal.
  function ambientOcclusion(scene, p, n) {
    const d = 0.02, q = [0, 0, 0];
    let occ = 0;
    for (let i = 1; i <= 5; i++) {
      q[0] = p[0] + n[0] * i * d; q[1] = p[1] + n[1] * i * d; q[2] = p[2] + n[2] * i * d;
      occ += (i * d - S.sceneDist(scene, q, null)) / Math.pow(2, i);
    }
    return M.clamp(1 - occ * 12, 0, 1);
  }

  // 9.3 Sombra suave: rayo hacia la luz, s = min(κ d / t). El pelo sólo hace
  // sombra a menos de HAIR_SHADOW: deja la banda bajo el flequillo, no media cara.
  const HAIR_SHADOW = 0.12;
  function noHair(scene) {
    if (!scene.noHair) scene.noHair = scene.parts.map((p, i) => (p.mat === SC.sdfBuild.MAT.hair ? -1 : i)).filter((i) => i >= 0);
    return scene.noHair;
  }
  function softShadow(scene, p, n, cam) {
    const L = cam.light;
    const lw = M.norm([L[0] * cam.r[0] + L[1] * cam.u[0] + L[2] * cam.f[0], L[0] * cam.r[1] + L[1] * cam.u[1] + L[2] * cam.f[1], L[0] * cam.r[2] + L[1] * cam.u[2] + L[2] * cam.f[2]]);
    const q = [0, 0, 0];
    let s = 1, t = 0.03;
    const start = [p[0] + n[0] * 0.01, p[1] + n[1] * 0.01, p[2] + n[2] * 0.01];
    for (let i = 0; i < 28 && t < 0.5; i++) {
      q[0] = start[0] + lw[0] * t; q[1] = start[1] + lw[1] * t; q[2] = start[2] + lw[2] * t;
      const d = S.sceneDist(scene, q, t > HAIR_SHADOW ? noHair(scene) : null);
      s = Math.min(s, (8 * d) / t);
      if (s < 0.02) return 0;
      t += M.clamp(d, 0.02, 0.2);
    }
    return M.clamp(s, 0, 1);
  }

  // Rayo único (para anclar los rasgos de la cara sobre la superficie).
  function raycast(scene, origin, dir, maxT = 4, onlyParts = null) {
    const p = [0, 0, 0], info = { part: -1 };
    let t = 0;
    for (let i = 0; i < 128 && t < maxT; i++) {
      p[0] = origin[0] + dir[0] * t; p[1] = origin[1] + dir[1] * t; p[2] = origin[2] + dir[2] * t;
      const d = S.sceneDist(scene, p, onlyParts, info);
      if (d < 0.0008) {
        const E = 0.002, dAt = (x, y, z) => S.sceneDist(scene, [x, y, z], onlyParts);
        const n = M.norm([dAt(p[0] + E, p[1], p[2]) - dAt(p[0] - E, p[1], p[2]), dAt(p[0], p[1] + E, p[2]) - dAt(p[0], p[1] - E, p[2]), dAt(p[0], p[1], p[2] + E) - dAt(p[0], p[1], p[2] - E)]);
        return { p: p.slice(), n, part: info.part };
      }
      t += d * 0.9;
    }
    return null;
  }

  return { camera, prepare, gbuffer, raycast, ambientOcclusion, softShadow, HAIR_SHADOW };
})();
