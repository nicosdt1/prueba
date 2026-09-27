// G-buffer por rasterizado en CPU de las mallas posadas: profundidad, normal
// en espacio de vista, parte, material y región por píxel, más sombra
// proyectada con un mapa de sombras. El formato es el mismo que consumen las
// líneas, el sombreado cel y el pixel art (js/render/compose.js).
//
// Unos 30 000 triángulos por fotograma: en CPU va sobrado en cualquier equipo,
// no depende de la gráfica y se puede probar con Node.
SC.mhRaster = (() => {
  const M = SC.AM;

  // Rasteriza triángulos proyectados (sx, sy, sz) en un búfer W×H quedándose
  // con el mayor sz (lo más cercano). onHit(i, tri, w0, w1) para cada píxel ganado.
  function rasterize(W, H, sx, sy, sz, tris, zbuf, onHit) {
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], cx = sx[c], cy = sy[c];
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      let y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      if (x0 > x1 || y0 > y1) continue;
      const ia = 1 / area, za = sz[a], zb = sz[b], zc = sz[c];
      for (let y = y0; y <= y1; y++) {
        const py = y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * ia;
          if (w0 < -1e-7) continue;
          const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * ia;
          if (w1 < -1e-7) continue;
          const w2 = 1 - w0 - w1;
          if (w2 < -1e-7) continue;
          const z = w0 * za + w1 * zb + w2 * zc, i = y * W + x;
          if (z <= zbuf[i]) continue;
          zbuf[i] = z;
          onHit(i, t, w0, w1);
        }
      }
    }
  }

  // Proyección de los vértices de una malla sobre una base (e1, e2, e3).
  function project(pos, e1, e2, e3, ox, oy, k, W, H) {
    const n = pos.length / 3, sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      sx[i] = (x * e1[0] + y * e1[1] + z * e1[2] - ox) * k + W / 2;
      sy[i] = (oy - (x * e2[0] + y * e2[1] + z * e2[2])) * k + H / 2;
      sz[i] = x * e3[0] + y * e3[1] + z * e3[2];
    }
    return { sx, sy, sz };
  }

  // Mapa de sombras ortográfico desde la luz (e3 apunta hacia la luz).
  function shadowMap(meshes, e1, e2, e3, texel) {
    let mn1 = Infinity, mx1 = -Infinity, mn2 = Infinity, mx2 = -Infinity;
    for (const m of meshes) {
      for (let i = 0; i < m.pos.length; i += 3) {
        const p = [m.pos[i], m.pos[i + 1], m.pos[i + 2]], a = M.dot(p, e1), b = M.dot(p, e2);
        if (a < mn1) mn1 = a; if (a > mx1) mx1 = a; if (b < mn2) mn2 = b; if (b > mx2) mx2 = b;
      }
    }
    if (mn1 === Infinity) return null;
    const k = 1 / texel, W = Math.min(1024, Math.ceil((mx1 - mn1) * k) + 4), H = Math.min(1024, Math.ceil((mx2 - mn2) * k) + 4);
    const kk = Math.min(k, (W - 4) / Math.max(1e-6, mx1 - mn1), (H - 4) / Math.max(1e-6, mx2 - mn2));
    const ox = (mn1 + mx1) / 2, oy = (mn2 + mx2) / 2, z = new Float32Array(W * H).fill(-Infinity);
    for (const m of meshes) {
      const P = project(m.pos, e1, e2, e3, ox, oy, kk, W, H);
      rasterize(W, H, P.sx, P.sy, P.sz, m.tris, z, () => {});
    }
    return { W, H, z, ox, oy, k: kk };
  }
  // Fracción de luz (0..1) con filtro 3×3; near: sólo cuenta a menos de esa distancia.
  function lit(S, p1, p2, d, bias, near) {
    if (!S) return 1;
    const x = (p1 - S.ox) * S.k + S.W / 2 - 0.5, y = (S.oy - p2) * S.k + S.H / 2 - 0.5;
    let ok = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xi = Math.round(x) + dx, yi = Math.round(y) + dy;
        n++;
        if (xi < 0 || yi < 0 || xi >= S.W || yi >= S.H) { ok++; continue; }
        const occ = S.z[yi * S.W + xi] - d;
        if (!(occ > bias && occ < near)) ok++;
      }
    }
    return ok / n;
  }

  // meshes: [{ pos, nrm, tris, mat, part (Uint8Array por vértice o número),
  //   partBase, region (número), faceW (Float32Array opcional), hair (bool), shadow (bool) }]
  // o: { shadow, faceNormal(p) → normal del mundo para la cara estilizada }
  function gbuffer(meshes, cam, o = {}) {
    const W = cam.W, H = cam.H, N = W * H;
    const g = {
      W, H, cam,
      depth: new Float32Array(N).fill(NaN), nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N),
      part: new Int16Array(N).fill(-1), mat: new Int8Array(N).fill(-1), region: new Int16Array(N).fill(-1),
      ao: new Float32Array(N).fill(1), shadow: new Float32Array(N).fill(1),
    };
    const zbuf = new Float32Array(N).fill(-Infinity), mid = new Int16Array(N).fill(-1), tid = new Int32Array(N), B0 = new Float32Array(N), B1 = new Float32Array(N);
    const { r, u, f } = cam;
    meshes.forEach((m, mi) => {
      const P = project(m.pos, r, u, f, cam.cx, cam.cy, cam.scale, W, H);
      rasterize(W, H, P.sx, P.sy, P.sz, m.tris, zbuf, (i, t, w0, w1) => { mid[i] = mi; tid[i] = t; B0[i] = w0; B1[i] = w1; });
    });
    for (let i = 0; i < N; i++) {
      const mi = mid[i];
      if (mi < 0) continue;
      const m = meshes[mi], t = tid[i], a = m.tris[t], b = m.tris[t + 1], c = m.tris[t + 2];
      const w0 = B0[i], w1 = B1[i], w2 = 1 - w0 - w1, n = m.nrm;
      let wx = w0 * n[a * 3] + w1 * n[b * 3] + w2 * n[c * 3];
      let wy = w0 * n[a * 3 + 1] + w1 * n[b * 3 + 1] + w2 * n[c * 3 + 1];
      let wz = w0 * n[a * 3 + 2] + w1 * n[b * 3 + 2] + w2 * n[c * 3 + 2];
      // Cara estilizada: la normal tiende a la de un óvalo liso (sin cuencas,
      // aletas de la nariz ni labios que dibujen sombras realistas).
      if (m.faceW && o.faceNormal) {
        const fw = w0 * m.faceW[a] + w1 * m.faceW[b] + w2 * m.faceW[c];
        if (fw > 0.01) {
          const p = [0, 1, 2].map((k) => w0 * m.pos[a * 3 + k] + w1 * m.pos[b * 3 + k] + w2 * m.pos[c * 3 + k]);
          const e = o.faceNormal(p);
          wx = M.lerp(wx, e[0], fw); wy = M.lerp(wy, e[1], fw); wz = M.lerp(wz, e[2], fw);
        }
        if (fw > 0.5) g.region[i] = 1;
      }
      let vx = wx * r[0] + wy * r[1] + wz * r[2], vy = wx * u[0] + wy * u[1] + wz * u[2], vz = wx * f[0] + wy * f[1] + wz * f[2];
      if (vz < 0) { vx = -vx; vy = -vy; vz = -vz; } // cara trasera visible (interior de la falda)
      const l = Math.hypot(vx, vy, vz) || 1;
      g.nx[i] = vx / l; g.ny[i] = vy / l; g.nz[i] = vz / l;
      g.depth[i] = zbuf[i];
      const top = w0 >= w1 && w0 >= w2 ? a : w1 >= w2 ? b : c;
      g.part[i] = (m.partBase || 0) + (typeof m.part === 'number' ? m.part : m.part[top]);
      g.mat[i] = typeof m.mat === 'number' ? m.mat : m.mat[top];
      if (g.region[i] < 0) g.region[i] = m.region || 0;
    }
    if (o.shadow) {
      // La luz está en espacio de vista; se pasa al mundo con la base de la cámara.
      const L = cam.light, e3 = M.norm([L[0] * r[0] + L[1] * u[0] + L[2] * f[0], L[0] * r[1] + L[1] * u[1] + L[2] * f[1], L[0] * r[2] + L[1] * u[2] + L[2] * f[2]]);
      const e1 = M.norm(M.cross(Math.abs(e3[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0], e3)), e2 = M.cross(e3, e1);
      const texel = Math.max(0.01, 0.8 / cam.scale);
      const casters = meshes.filter((m) => m.shadow !== false);
      const Sb = shadowMap(casters.filter((m) => !m.hair), e1, e2, e3, texel);
      const Sh = shadowMap(casters.filter((m) => m.hair), e1, e2, e3, texel);
      const bias = Math.max(0.04, 3 * texel);
      for (let i = 0; i < N; i++) {
        if (mid[i] < 0) continue;
        const x = i % W, y = (i - x) / W, [vx, vy] = cam.view(x, y), d = zbuf[i];
        const p = [r[0] * vx + u[0] * vy + f[0] * d, r[1] * vx + u[1] * vy + f[1] * d, r[2] * vx + u[2] * vy + f[2] * d];
        const p1 = M.dot(p, e1), p2 = M.dot(p, e2), pd = M.dot(p, e3);
        // El pelo sólo sombrea de cerca: la banda bajo el flequillo, no media cara.
        g.shadow[i] = Math.min(lit(Sb, p1, p2, pd, bias, Infinity), lit(Sh, p1, p2, pd, bias, 0.12));
      }
    }
    return g;
  }

  // Rayo contra triángulos (Möller–Trumbore); devuelve el impacto más cercano.
  function raycast(pos, tris, orig, dir, filter) {
    let best = Infinity, hit = null;
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
      if (filter && !filter(tris[t])) continue;
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
      const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      const pv = M.cross(dir, e2), det = M.dot(e1, pv);
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, tv = [orig[0] - pos[a], orig[1] - pos[a + 1], orig[2] - pos[a + 2]];
      const uu = M.dot(tv, pv) * inv;
      if (uu < 0 || uu > 1) continue;
      const qv = M.cross(tv, e1), vv = M.dot(dir, qv) * inv;
      if (vv < 0 || uu + vv > 1) continue;
      const d = M.dot(e2, qv) * inv;
      if (d > 1e-6 && d < best) { best = d; hit = { t: d, tri: t, n: M.norm(M.cross(e1, e2)) }; }
    }
    if (!hit) return null;
    hit.p = M.add(orig, M.mul(dir, hit.t));
    if (M.dot(hit.n, dir) > 0) hit.n = M.mul(hit.n, -1);
    return hit;
  }

  return { gbuffer, rasterize, raycast };
})();
