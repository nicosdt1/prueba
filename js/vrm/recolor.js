// Recoloreado de texturas conservando el dibujo (sombras, brillos, mechones,
// pliegues). Lo usan los motores 3D (VRM y modular).
SC.recolor = (() => {
  function imageData(img) {
    const c = SC.render.makeCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    return { c, x, d: x.getImageData(0, 0, c.width, c.height) };
  }

  const toHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  };
  const fromHsl = (h, s, l) => {
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  };

  // Color dominante de una textura: tono medio ponderado por saturación y
  // luminosidad mediana de los píxeles visibles. uv (opcional): coordenadas de
  // textura [u0, v0, u1, v1...] de una pieza, para medir sólo la zona que usa
  // (varias prendas comparten un mismo atlas).
  function baseColor(image, uv) {
    const { d } = imageData(image);
    const W = d.width, H = d.height;
    const hist = new Float64Array(256);
    let hx = 0, hy = 0, n = 0;
    const idx = [];
    if (uv) {
      for (let k = 0; k < uv.length; k += 2 * Math.max(1, Math.floor(uv.length / 40000))) {
        const u = uv[k] - Math.floor(uv[k]), v = uv[k + 1] - Math.floor(uv[k + 1]);
        idx.push((Math.min(H - 1, Math.floor(v * H)) * W + Math.min(W - 1, Math.floor(u * W))) * 4);
      }
    } else {
      for (let i = 0; i < d.data.length; i += 4 * 7) idx.push(i);
    }
    for (const i of idx) {
      if (d.data[i + 3] < 128) continue;
      const [h, s, l] = toHsl(d.data[i], d.data[i + 1], d.data[i + 2]);
      // Los rellenos negros o blancos del atlas no cuentan.
      if (l < 0.05 || l > 0.985) continue;
      hist[Math.round(l * 255)] += 0.3 + s; n += 0.3 + s;
      hx += Math.cos(h * 2 * Math.PI) * s; hy += Math.sin(h * 2 * Math.PI) * s;
    }
    if (!n) return '#888888';
    let acc = 0, li = 0;
    while (li < 255 && (acc += hist[li]) < n / 2) li++;
    const h = (Math.atan2(hy, hx) / (2 * Math.PI) + 1) % 1, s = Math.hypot(hx, hy) / n;
    const [r, gg, b] = fromHsl(h, Math.min(1, s), li / 255);
    return SC.util.rgbToHex(r, gg, b);
  }

  // Recolorea una textura. El color base del grupo pasa a ser el color elegido y el
  // resto de tonos se reparten a su alrededor (negro sigue negro, blanco sigue
  // blanco), así se conservan las luces, sombras y líneas pintadas. Los detalles
  // de otro tono (lazos, botones, reflejos) mantienen su color.
  function recolorTexture(tex, hex, base) {
    const T = window.THREE;
    const { c, x, d } = imageData(tex.image);
    const C = SC.util.hexToRgb(hex), B = SC.util.hexToRgb(base);
    const [th, ts, tl] = toHsl(C.r, C.g, C.b), [bh, bs, bl0] = toHsl(B.r, B.g, B.b);
    // Croma (máx − mín): a diferencia de la saturación HSL, no se dispara cerca
    // del blanco o del negro. Una base sin color (tela blanca, gris o negra) se
    // tiñe entera; si es clara, el blanco pasa a ser el color elegido.
    const chroma = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const neutral = chroma(B.r, B.g, B.b) < 0.08;
    const bl = neutral && bl0 > 0.8 ? 1 : bl0;
    const mapL = (l) => (l <= bl ? tl * (l / Math.max(bl, 1e-3)) : tl + (1 - tl) * ((l - bl) / Math.max(1 - bl, 1e-3)));
    // Tabla de conversión (64³ colores) calculada una sola vez por recoloreado:
    // mucho más rápido que convertir a HSL cada píxel de texturas de 2048².
    const lut = new Uint8Array(64 * 64 * 64 * 3);
    for (let r = 0; r < 64; r++) for (let g = 0; g < 64; g++) for (let b = 0; b < 64; b++) {
      const R = r * 4 + 2, G = g * 4 + 2, Bb = b * 4 + 2;
      const [h, s, l] = toHsl(R, G, Bb), cr = chroma(R, G, Bb);
      // Cuánto pertenece este tono al color base (los grises siempre).
      const dh = Math.min(Math.abs(h - bh), 1 - Math.abs(h - bh));
      const k = neutral || cr < 0.1 ? 1 : 1 - SC.util.smoothstep(0.07, 0.16, dh);
      const ns = neutral ? ts : Math.min(1, s * (ts / Math.max(bs, 0.05)));
      const c3 = fromHsl(th, ns, mapL(l));
      const o = ((r << 12) | (g << 6) | b) * 3;
      lut[o] = R + (c3[0] - R) * k; lut[o + 1] = G + (c3[1] - G) * k; lut[o + 2] = Bb + (c3[2] - Bb) * k;
    }
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const o = (((px[i] >> 2) << 12) | ((px[i + 1] >> 2) << 6) | (px[i + 2] >> 2)) * 3;
      px[i] = lut[o]; px[i + 1] = lut[o + 1]; px[i + 2] = lut[o + 2];
    }
    x.putImageData(d, 0, 0);
    // clone() comparte la fuente de imagen con el original: se le da una propia
    // para no pisar la textura original.
    const t = tex.clone();
    t.source = new (T.TextureSource || T.Source)(c);
    t.needsUpdate = true;
    return t;
  }

  return { imageData, toHsl, fromHsl, baseColor, recolorTexture };
})();
