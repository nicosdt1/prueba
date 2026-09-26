// Render del G-buffer en WebGL2 (sección 2.5): la misma SDF de core.js traducida
// a GLSL. Un rayo ortográfico por píxel con trazado de esferas; las partes cuya
// esfera envolvente no corta el rayo se descartan. Devuelve el mismo G-buffer
// que la versión de CPU, así el sombreado y las líneas se calculan igual.
SC.sdfGL = (() => {
  const S = SC.SDF;
  const MAX_PARTS = 64, TEX_W = 1536, PRIM_TEXELS = 6;
  const HAIR_SHADOW = SC.sdfMarch.HAIR_SHADOW.toFixed(3);
  let gl = null, prog = null, fbo = null, texs = [], primTex = null, vao = null, failed = false, size = [0, 0];

  const FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uPrims;
uniform int uNParts;
uniform vec4 uPartA[${MAX_PARTS}]; // primera primitiva, número, dura, material
uniform vec4 uPartB[${MAX_PARTS}]; // esfera envolvente (centro, radio)
uniform vec4 uPartC[${MAX_PARTS}]; // punto de enganche, radio de enganche
uniform vec4 uPartD[${MAX_PARTS}]; // k de enganche, región por defecto
uniform vec3 uR, uU, uF;
uniform vec2 uCenter, uSize;
uniform float uScale, uFar, uEps;
uniform int uAO, uShadow;
uniform vec3 uLight;
uniform uint uHairLo, uHairHi; // partes de pelo: sólo dan sombra cercana
in vec2 vUV;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;

vec4 P(int i, int k) { int t = i * ${PRIM_TEXELS} + k; return texelFetch(uPrims, ivec2(t % ${TEX_W}, t / ${TEX_W}), 0); }
float smin(float a, float b, float k) { if (k <= 0.0) return min(a, b); float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

float prim(int i, vec3 p, out float op, out float k, out float region) {
  vec4 a = P(i, 0), b = P(i, 1), c = P(i, 2), d = P(i, 3), e = P(i, 4), f = P(i, 5);
  float type = a.x; op = a.y; k = a.z; region = b.w;
  if (type > 2.5) return dot(vec3(c.w, d.w, e.w), p) - f.w;
  vec3 x = p - b.xyz;
  vec3 q = vec3(dot(c.xyz, x), dot(d.xyz, x), dot(e.xyz, x));
  float dist;
  if (type < 0.5) {
    float L = c.w, ra = d.w, rb = e.w, ex = f.x, ez = f.y;
    float t = clamp(q.y / L, 0.0, 1.0);
    vec3 w = vec3(q.x / ex, q.y - t * L, q.z / ez);
    dist = (length(w) - (ra + t * (rb - ra))) * min(ex, ez);
  } else if (type < 1.5) {
    vec3 r = vec3(c.w, d.w, e.w);
    float k0 = length(q / r), k1 = length(q / (r * r));
    dist = k1 > 1e-9 ? k0 * (k0 - 1.0) / k1 : -min(r.x, min(r.y, r.z));
  } else {
    vec3 bb = vec3(c.w, d.w, e.w); float rr = f.z;
    vec3 qq = abs(q) - bb + rr;
    dist = length(max(qq, 0.0)) + min(max(qq.x, max(qq.y, qq.z)), 0.0) - rr;
  }
  return dist - a.w;
}

float part(int j, vec3 p, out float region) {
  int first = int(uPartA[j].x), n = int(uPartA[j].y);
  float d = 1e9, best = 1e9; region = uPartD[j].y;
  for (int i = 0; i < n; i++) {
    float op, k, rg;
    float di = prim(first + i, p, op, k, rg);
    if (op < 0.5) {
      d = d > 1e8 ? di : smin(d, di, k);
      if (di < best) { best = di; region = rg > 0.0 ? rg : uPartD[j].y; }
    } else if (op < 1.5) d = smax(d, -di, k);
    else d = smax(d, di, k);
  }
  return d;
}

uint maskLo, maskHi;
bool cand(int j) { return j < 32 ? ((maskLo >> uint(j)) & 1u) == 1u : ((maskHi >> uint(j - 32)) & 1u) == 1u; }

float scene(vec3 p, out int bestPart, out float region) {
  float d = 1e9, dmin = 1e9; bestPart = -1; region = 0.0;
  for (int j = 0; j < uNParts; j++) {
    if (!cand(j)) continue;
    float rg;
    float dp = part(j, p, rg);
    if (dp < dmin) { dmin = dp; bestPart = j; region = rg; }
    if (d > 1e8) d = dp;
    else if (uPartA[j].z > 0.5 || uPartD[j].x <= 0.0) d = min(d, dp);
    else {
      float u = max(0.0, 1.0 - length(p - uPartC[j].xyz) / uPartC[j].w);
      d = smin(d, dp, uPartD[j].x * u * u);
    }
  }
  return d;
}
float sceneD(vec3 p) { int bp; float rg; return scene(p, bp, rg); }

void main() {
  vec2 px = vUV * uSize;
  vec2 v = uCenter + vec2(px.x - uSize.x * 0.5, uSize.y * 0.5 - px.y) / uScale;
  vec3 ro = uR * v.x + uU * v.y + uF * uFar, rd = -uF;
  float t0 = 1e9, t1 = -1e9;
  maskLo = 0u; maskHi = 0u;
  for (int j = 0; j < uNParts; j++) {
    vec3 c = uPartB[j].xyz; float r = uPartB[j].w;
    vec2 pv = vec2(dot(c, uR), dot(c, uU)) - v;
    float d2 = dot(pv, pv);
    if (d2 >= r * r) continue;
    float h = sqrt(r * r - d2), tc = uFar - dot(c, uF);
    t0 = min(t0, tc - h); t1 = max(t1, tc + h);
    if (j < 32) maskLo |= (1u << uint(j)); else maskHi |= (1u << uint(j - 32));
  }
  o0 = vec4(0.0); o1 = vec4(-1.0, -1.0, -1.0, 0.0); o2 = vec4(1.0);
  if (t1 < t0) return;
  float t = max(0.0, t0); bool hit = false; int bp; float rg; vec3 p;
  for (int i = 0; i < 110; i++) {
    if (t > t1) break;
    p = ro + rd * t;
    float d = scene(p, bp, rg);
    if (d < uEps) { hit = true; break; }
    t += max(d * 0.85, uEps * 0.5);
  }
  if (!hit) return;
  const float E = 0.002;
  vec3 n = normalize(vec3(
    sceneD(p + vec3(E, 0, 0)) - sceneD(p - vec3(E, 0, 0)),
    sceneD(p + vec3(0, E, 0)) - sceneD(p - vec3(0, E, 0)),
    sceneD(p + vec3(0, 0, E)) - sceneD(p - vec3(0, 0, E))));
  o0 = vec4(uFar - t, dot(n, uR), dot(n, uU), dot(n, uF));
  o1 = vec4(float(bp), uPartA[bp].w, rg, 1.0);
  float ao = 1.0, sh = 1.0;
  if (uAO == 1) {
    float occ = 0.0;
    for (int i = 1; i <= 5; i++) { float h = float(i) * 0.02; occ += (h - sceneD(p + n * h)) / pow(2.0, float(i)); }
    ao = clamp(1.0 - occ * 12.0, 0.0, 1.0);
  }
  if (uShadow == 1) {
    // La luz está en espacio de vista: se pasa al mundo con la base de la cámara.
    vec3 lw = normalize(uR * uLight.x + uU * uLight.y + uF * uLight.z);
    maskLo = 0xffffffffu; maskHi = 0xffffffffu;
    vec3 s0 = p + n * 0.01; float tt = 0.03; sh = 1.0;
    for (int i = 0; i < 28; i++) {
      if (tt > 0.5) break;
      if (tt > ${HAIR_SHADOW}) { maskLo = ~uHairLo; maskHi = ~uHairHi; }
      float d = sceneD(s0 + lw * tt);
      sh = min(sh, 8.0 * d / tt);
      if (sh < 0.02) { sh = 0.0; break; }
      tt += clamp(d, 0.02, 0.2);
    }
    sh = clamp(sh, 0.0, 1.0);
  }
  o2 = vec4(ao, sh, 0.0, 1.0);
}`;
  const VS = `#version 300 es
in vec2 aPos; out vec2 vUV;
void main() { vUV = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

  function init() {
    if (gl || failed) return !!gl;
    try {
      const cv = document.createElement('canvas');
      gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false });
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('sin WebGL2 o sin render a coma flotante');
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.bindAttribLocation(prog, 0, 'aPos');
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      primTex = gl.createTexture();
      fbo = gl.createFramebuffer();
      return true;
    } catch (err) {
      console.warn('Render WebGL no disponible, se usa la CPU:', err.message);
      gl = null; failed = true;
      return false;
    }
  }

  function targets(W, H) {
    if (size[0] === W && size[1] === H) return;
    size = [W, H];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    texs.forEach((t) => gl.deleteTexture(t));
    texs = [0, 1, 2].map((i) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
      return t;
    });
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
  }

  // Empaqueta las primitivas en una textura de coma flotante.
  function upload(scene) {
    const prims = [], A = [], B = [], Cc = [], D = [];
    for (const part of scene.parts) {
      A.push(prims.length, part.prims.length, part.hard ? 1 : 0, part.mat);
      const b = part.bounds;
      B.push(b.c[0], b.c[1], b.c[2], b.r);
      const jp = part.joinP || [0, 0, 0];
      Cc.push(jp[0], jp[1], jp[2], part.joinR || 1);
      D.push(part.joinK || 0, part.region || 0, 0, 0);
      prims.push(...part.prims);
    }
    const rows = Math.max(1, Math.ceil((prims.length * PRIM_TEXELS) / TEX_W));
    const data = new Float32Array(TEX_W * rows * 4);
    prims.forEach((P, i) => {
      const o = i * PRIM_TEXELS * 4, R = P.R;
      const pa = P.type === S.CONE ? [P.L, P.ra, P.rb] : P.type === S.ELLIPSOID ? P.r : P.type === S.BOX ? P.b : P.n || [0, 0, 0];
      data.set([P.type, P.op, P.k, P.inflate || 0], o);
      data.set([P.o[0], P.o[1], P.o[2], P.region || 0], o + 4);
      data.set([R[0], R[1], R[2], pa[0]], o + 8);
      data.set([R[3], R[4], R[5], pa[1]], o + 12);
      data.set([R[6], R[7], R[8], pa[2]], o + 16);
      data.set([P.ex || 1, P.ez || 1, P.rr || 0, P.c || 0], o + 20);
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, primTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEX_W, rows, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const pad = (arr) => { const out = new Float32Array(MAX_PARTS * 4); out.set(arr.slice(0, MAX_PARTS * 4)); return out; };
    return { A: pad(A), B: pad(B), C: pad(Cc), D: pad(D), n: Math.min(MAX_PARTS, scene.parts.length) };
  }

  function gbuffer(scene, cam, o = {}) {
    if (!init()) return null;
    if (scene.parts.length > MAX_PARTS) return null;
    const W = cam.W, H = cam.H;
    targets(W, H);
    gl.useProgram(prog);
    const u = upload(scene);
    const loc = (n) => gl.getUniformLocation(prog, n);
    gl.uniform1i(loc('uPrims'), 0);
    gl.uniform1i(loc('uNParts'), u.n);
    gl.uniform4fv(loc('uPartA'), u.A); gl.uniform4fv(loc('uPartB'), u.B); gl.uniform4fv(loc('uPartC'), u.C); gl.uniform4fv(loc('uPartD'), u.D);
    gl.uniform3fv(loc('uR'), cam.r); gl.uniform3fv(loc('uU'), cam.u); gl.uniform3fv(loc('uF'), cam.f);
    gl.uniform2f(loc('uCenter'), cam.cx, cam.cy); gl.uniform2f(loc('uSize'), W, H);
    gl.uniform1f(loc('uScale'), cam.scale); gl.uniform1f(loc('uFar'), cam.far);
    gl.uniform1f(loc('uEps'), o.eps || Math.max(0.0015, 0.35 / cam.scale));
    gl.uniform1i(loc('uAO'), o.ao ? 1 : 0); gl.uniform1i(loc('uShadow'), o.shadow ? 1 : 0);
    gl.uniform3fv(loc('uLight'), cam.light);
    let hLo = 0, hHi = 0;
    scene.parts.forEach((p, j) => { if (p.mat === SC.sdfBuild.MAT.hair) { if (j < 32) hLo |= 1 << j; else hHi |= 1 << (j - 32); } });
    gl.uniform1ui(loc('uHairLo'), hLo >>> 0); gl.uniform1ui(loc('uHairHi'), hHi >>> 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, W, H);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const read = (i) => { const b = new Float32Array(W * H * 4); gl.readBuffer(gl.COLOR_ATTACHMENT0 + i); gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, b); return b; };
    const b0 = read(0), b1 = read(1), b2 = read(2);
    const N = W * H;
    const g = {
      W, H, cam, depth: new Float32Array(N).fill(NaN), nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N),
      part: new Int16Array(N).fill(-1), mat: new Int8Array(N).fill(-1), region: new Int16Array(N).fill(-1),
      ao: new Float32Array(N).fill(1), shadow: new Float32Array(N).fill(1),
    };
    // readPixels devuelve las filas de abajo arriba; vUV ya invierte y, así que la fila 0 leída es la última de la imagen.
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const k = (src + x) * 4, i = y * W + x;
        if (b1[k + 3] < 0.5) continue;
        g.depth[i] = b0[k]; g.nx[i] = b0[k + 1]; g.ny[i] = b0[k + 2]; g.nz[i] = b0[k + 3];
        g.part[i] = b1[k]; g.mat[i] = b1[k + 1]; g.region[i] = b1[k + 2];
        g.ao[i] = b2[k]; g.shadow[i] = b2[k + 1];
      }
    }
    return g;
  }

  return { gbuffer, available: () => init() };
})();
