// Núcleo SDF (sección 2 de docs/correccion-visual.md): el cuerpo es una sola
// superficie definida por funciones de distancia, unidas con unión suave.
//
// Escena = lista de "partes" (grupos de primitivas que se funden entre sí con
// su propio k). Las partes se unen con una unión suave LOCALIZADA alrededor de
// su articulación de enganche (k se anula lejos de ella): así el hombro se
// funde con el torso, pero un brazo pegado al costado no se funde con la cadera.
//
// Todas las primitivas guardan su marco local (origen o y matriz R mundo→local),
// de modo que el mismo formato sirve para la CPU y para el shader WebGL.
SC.SDF = (() => {
  const M = SC.AM;

  // ---------- Tipos de primitiva ----------
  const CONE = 0, ELLIPSOID = 1, BOX = 2, PLANE = 3;
  // Operaciones dentro de una parte.
  const UNION = 0, SUBTRACT = 1, INTERSECT = 2;

  // Marco local a partir de un eje (y local) y una dirección de referencia (z local).
  function frameFrom(yAxis, zHint) {
    const y = M.norm(yAxis);
    let z = M.sub(zHint, M.mul(y, M.dot(zHint, y)));
    if (M.len(z) < 1e-6) z = Math.abs(y[2]) < 0.9 ? M.sub([0, 0, 1], M.mul(y, y[2])) : M.sub([1, 0, 0], M.mul(y, y[0]));
    z = M.norm(z);
    const x = M.norm(M.cross(y, z));
    return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]]; // filas = ejes locales
  }
  const rowsOf = (Rm) => [Rm[0], Rm[3], Rm[6], Rm[1], Rm[4], Rm[7], Rm[2], Rm[5], Rm[8]]; // columnas → filas

  // Cono redondeado de a (radio ra) a b (radio rb). Sección elíptica: ex y ez
  // escalan los ejes x y z locales (ancho y profundidad relativos).
  function cone(a, b, ra, rb, o = {}) {
    const L = Math.max(1e-6, M.dist(a, b));
    return Object.assign({ type: CONE, o: a, R: frameFrom(M.sub(b, a), o.zHint || [0, 0, 1]), L, ra, rb, ex: o.ex || 1, ez: o.ez || 1 }, common(o));
  }
  // Elipsoide con radios r en su marco local (Rm: matriz de rotación local→mundo, columnas).
  function ellipsoid(c, r, o = {}) {
    return Object.assign({ type: ELLIPSOID, o: c, R: o.Rm ? rowsOf(o.Rm) : [1, 0, 0, 0, 1, 0, 0, 0, 1], r }, common(o));
  }
  // Caja redondeada con semitamaños b y radio de esquina rr.
  function box(c, b, rr, o = {}) {
    return Object.assign({ type: BOX, o: c, R: o.Rm ? rowsOf(o.Rm) : [1, 0, 0, 0, 1, 0, 0, 0, 1], b, rr }, common(o));
  }
  // Semiespacio: distancia = n·p − c (se usa con INTERSECT para cortar).
  function plane(n, c, o = {}) {
    const nn = M.norm(n);
    return Object.assign({ type: PLANE, o: [0, 0, 0], R: [1, 0, 0, 0, 1, 0, 0, 0, 1], n: nn, c }, common(o));
  }
  function common(o) {
    return { op: o.op || UNION, k: o.k != null ? o.k : 0, region: o.region || 0, inflate: o.inflate || 0 };
  }

  // ---------- Distancias ----------
  function local(p, P, out) {
    const x = p[0] - P.o[0], y = p[1] - P.o[1], z = p[2] - P.o[2], R = P.R;
    out[0] = R[0] * x + R[1] * y + R[2] * z;
    out[1] = R[3] * x + R[4] * y + R[5] * z;
    out[2] = R[6] * x + R[7] * y + R[8] * z;
    return out;
  }
  const tmp = [0, 0, 0];
  function primDist(P, p) {
    if (P.type === PLANE) return P.n[0] * p[0] + P.n[1] * p[1] + P.n[2] * p[2] - P.c;
    const q = local(p, P, tmp);
    let d;
    if (P.type === CONE) {
      const t = Math.min(1, Math.max(0, q[1] / P.L));
      const dx = q[0] / P.ex, dy = q[1] - t * P.L, dz = q[2] / P.ez;
      d = (Math.sqrt(dx * dx + dy * dy + dz * dz) - (P.ra + t * (P.rb - P.ra))) * Math.min(P.ex, P.ez);
    } else if (P.type === ELLIPSOID) {
      const r = P.r;
      const a = q[0] / r[0], b = q[1] / r[1], c = q[2] / r[2];
      const k0 = Math.sqrt(a * a + b * b + c * c);
      const a2 = a / r[0], b2 = b / r[1], c2 = c / r[2];
      const k1 = Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
      d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
    } else {
      const b = P.b, rr = P.rr;
      const qx = Math.abs(q[0]) - b[0] + rr, qy = Math.abs(q[1]) - b[1] + rr, qz = Math.abs(q[2]) - b[2] + rr;
      const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
      d = Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - rr;
    }
    return d - P.inflate;
  }

  // 2.3 Unión suave polinómica y su inversa.
  function smin(a, b, k) {
    if (k <= 0) return Math.min(a, b);
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  const smax = (a, b, k) => -smin(-a, -b, k);

  // Distancia de una parte y región de la primitiva más cercana.
  function partDist(part, p, info) {
    let d = Infinity, best = Infinity, region = part.region || 0;
    for (const P of part.prims) {
      const di = primDist(P, p);
      if (P.op === UNION) {
        d = d === Infinity ? di : smin(d, di, P.k);
        if (di < best) { best = di; region = P.region || part.region || 0; }
      } else if (P.op === SUBTRACT) d = smax(d, -di, P.k);
      else d = smax(d, di, P.k);
    }
    if (info) info.region = region;
    return d;
  }

  // Unión localizada: el radio de fusión cae a 0 lejos del enganche.
  function joinK(part, p) {
    if (!part.joinK) return 0;
    const j = part.joinP, dx = p[0] - j[0], dy = p[1] - j[1], dz = p[2] - j[2];
    const u = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / part.joinR);
    return part.joinK * u * u;
  }

  // Distancia de la escena (sólo las partes candidatas). out: parte, material y región.
  const infoTmp = { region: 0 };
  function sceneDist(scene, p, cand, out) {
    let d = Infinity, dmin = Infinity, part = -1, region = 0;
    const parts = scene.parts, n = cand ? cand.length : parts.length;
    for (let i = 0; i < n; i++) {
      const idx = cand ? cand[i] : i, P = parts[idx];
      const dp = partDist(P, p, infoTmp);
      // La etiqueta es la de la parte más cercana sin suavizar: en la zona de
      // fusión la frontera cae a mitad del empalme.
      if (dp < dmin) { dmin = dp; part = idx; region = infoTmp.region; }
      d = d === Infinity ? dp : P.hard ? Math.min(d, dp) : smin(d, dp, joinK(P, p));
    }
    if (out) { out.part = part; out.mat = part >= 0 ? parts[part].mat : -1; out.region = region; }
    return d;
  }

  // Esfera envolvente de cada parte (para descartar partes lejos del rayo).
  function bounds(part) {
    const pts = [];
    for (const P of part.prims) {
      if (P.type === PLANE || P.op !== UNION) continue;
      if (P.type === CONE) {
        const R = P.R, y = [R[3], R[4], R[5]], r = Math.max(P.ra, P.rb) * Math.max(P.ex, P.ez) + P.inflate;
        pts.push([P.o, r], [M.add(P.o, M.mul(y, P.L)), r]);
      } else if (P.type === ELLIPSOID) pts.push([P.o, Math.max(...P.r) + P.inflate]);
      else pts.push([P.o, Math.hypot(...P.b) + P.inflate]);
    }
    if (!pts.length) return { c: [0, 0, 0], r: 0 };
    let c = [0, 0, 0];
    for (const [q] of pts) c = M.add(c, q);
    c = M.mul(c, 1 / pts.length);
    let r = 0;
    for (const [q, rq] of pts) r = Math.max(r, M.dist(q, c) + rq);
    return { c, r: r + (part.pad || 0.05) };
  }

  function finalize(scene) {
    for (const part of scene.parts) part.bounds = bounds(part);
    return scene;
  }

  return { CONE, ELLIPSOID, BOX, PLANE, UNION, SUBTRACT, INTERSECT, frameFrom, cone, ellipsoid, box, plane, primDist, smin, smax, partDist, sceneDist, finalize };
})();
