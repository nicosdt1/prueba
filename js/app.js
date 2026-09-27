// Interfaz de la aplicación: editor del personaje, vista previa animada y exportación.
// Un solo motor: SC.engine (malla de MakeHuman + rig anatómico + sombreado cel).
(() => {
  const X = SC.exporter, E = SC.engine, D = SC.mhDress;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'forja-sprites:personaje:v3';

  const PALETTES = {
    skin: ['#fde6d4', '#f3cdb0', '#e8b48f', '#c98d64', '#a26a45', '#7a4a2e', '#553223', '#a9c8e8', '#a8cf93'],
    hair: ['#1f1a24', '#4a3226', '#6b3f2a', '#a0522d', '#d9a441', '#f0dc9a', '#e8e4df', '#c23b3b', '#e57fb0', '#4f7fd6', '#5aa36b', '#8e5bc8'],
    eyes: ['#3f7fd6', '#4c9a5a', '#8a5a2b', '#b03a48', '#7b4fc9', '#2aa7a0', '#d69a2a', '#555566'],
    cloth: ['#4f86d9', '#e04848', '#f2f2f5', '#2b2233', '#34405e', '#5f8f4e', '#e8b93a', '#8e5bc8', '#e87a9b', '#9b7a52', '#3c4c63', '#39b3a8', '#d8513f', '#27386f', '#f4e1c1'],
  };

  const defaultAnat = () => ({ params: JSON.parse(JSON.stringify(SC.anatBody.DEFAULTS)), look: Object.assign({}, E.DEFAULT_LOOK) });
  const defaultCharacter = () => ({ name: 'Personaje', expression: 'feliz', style: { lineMode: 'colored', lineWidth: 1 }, anat: defaultAnat() });

  function sanitizeAnat(a) {
    const d = defaultAnat();
    if (!a || typeof a !== 'object') return d;
    const L = Object.assign({}, d.look);
    for (const [k, v] of Object.entries(a.look || {})) if (/^#[0-9a-f]{6}$/i.test(v) && k in L) L[k] = v;
    const pick = (v, table, def) => (typeof v === 'string' && table[v] ? v : def);
    const al = a.look || {};
    L.hairStyle = pick(al.hairStyle, D.RECIPES, d.look.hairStyle);
    L.topStyle = pick(al.topStyle, D.TOPS, d.look.topStyle);
    L.bottomStyle = pick(al.bottomStyle, D.BOTTOMS, d.look.bottomStyle);
    L.shoeStyle = pick(al.shoeStyle, D.SHOES, d.look.shoeStyle);
    return { params: SC.anatBody.params(a.params || {}), look: L };
  }

  // Asegura que un personaje cargado tenga una estructura válida.
  function sanitize(obj) {
    const ch = obj && obj.character ? obj.character : obj;
    if (!ch || typeof ch !== 'object') return null;
    const def = defaultCharacter();
    return {
      name: typeof ch.name === 'string' ? ch.name.slice(0, 40) : def.name,
      expression: SC.EXPRESSIONS[ch.expression] ? ch.expression : 'neutral',
      style: Object.assign({}, def.style, ch.style || {}),
      anat: sanitizeAnat(ch.anat),
    };
  }

  const state = {
    ch: loadStored() || defaultCharacter(),
    mode: 'vn',
    anim: 'idle',
    view: 'front',
    debug: 'none',
    playing: true,
    frame: 0,
    exportAnims: new Set(['idle', 'walk', 'run', 'jump', 'wave', 'attack']),
    pxCache: { key: '', frames: [] },
    vnCache: { key: '', frames: [] },
  };

  // ---------- Persistencia ----------
  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  function store() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ch)); } catch { /* almacenamiento no disponible */ }
  }

  // ---------- Editor ----------
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) e.append(c);
    return e;
  }

  const frameCountFor = (animId) => SC.ANIMS[animId].frames;
  const poseAt = (animId, i) => { const n = frameCountFor(animId); return { animId, t: (i % n) / n }; };
  const animList = () => Object.values(SC.ANIMS);

  function expressionChips() {
    const chips = el('div', { class: 'chips' });
    for (const [id, e] of Object.entries(SC.EXPRESSIONS)) {
      chips.append(el('button', {
        class: 'chip' + (state.ch.expression === id ? ' active' : ''), text: e.name,
        onclick: () => { state.ch.expression = id; changed(true); },
      }));
    }
    return el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: 'Expresión' }), chips]);
  }

  function buildEditor() {
    const root = $('editor');
    const a = state.ch.anat = state.ch.anat || defaultAnat();
    const P = a.params, L = a.look;
    const open = new Set([...root.querySelectorAll('details[open]')].map((d) => d.dataset.group));
    const first = !root.children.length;
    root.innerHTML = '';
    const group = (name, id, isOpen) => {
      const g = el('details', { class: 'group', 'data-group': id }, [el('summary', { text: name })]);
      if (first ? isOpen : open.has(id)) g.open = true;
      root.append(g);
      return g;
    };
    const chipRow = (title, table, current, onPick) => {
      const chips = el('div', { class: 'chips' });
      for (const [id, v] of Object.entries(table)) {
        chips.append(el('button', { class: 'chip' + (current === id ? ' active' : ''), text: v.name || v, onclick: () => { onPick(id); changed(true); } }));
      }
      return el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: title }), chips]);
    };
    const slider = (label, obj, key, min, max, step, fmt) => {
      const out = el('output', { text: fmt(obj[key]) });
      const input = el('input', { type: 'range', min, max, step, value: obj[key], 'aria-label': label });
      input.addEventListener('input', () => { obj[key] = Number(input.value); out.textContent = fmt(obj[key]); });
      input.addEventListener('change', () => changed(true));
      return el('label', { class: 'slider' }, [label, input, out]);
    };
    const color = (label, key, pal) => {
      const wrap = el('div', { class: 'colors' });
      const input = el('input', { type: 'color', value: L[key], 'aria-label': label });
      input.addEventListener('change', () => { L[key] = input.value; changed(true); });
      wrap.append(el('label', { class: 'color' }, [input, label]));
      if (pal) {
        const sw = el('div', { class: 'swatches' });
        for (const col of pal) sw.append(el('button', { class: 'swatch', style: `background:${col}`, title: col, 'aria-label': `${label} ${col}`, onclick: () => { L[key] = col; changed(true); } }));
        wrap.append(sw);
      }
      return wrap;
    };
    const f2 = (v) => Number(v).toFixed(2), pct = (v) => Math.round(v * 100) + '%';
    const sexTxt = (v) => (v <= 0.2 ? 'masc.' : v >= 0.8 ? 'fem.' : 'andróg.');

    const gB = group('Cuerpo', 'body', true);
    gB.append(chipRow('Estilo (cabezas de alto)', Object.fromEntries(Object.entries(SC.CANON.styles).map(([k, v]) => [k, { name: `${v.name} · ${v.N}` }])), P.style, (v) => { P.style = v; }));
    gB.append(slider('Sexo morfológico', P, 's', 0, 1, 0.01, sexTxt));
    gB.append(slider('Complexión', P, 'b', -1, 1, 0.01, f2));
    gB.append(slider('Musculatura', P, 'm', 0, 1, 0.01, pct));
    if (P.s >= 0.35) {
      gB.append(slider('Busto: tamaño', P.bust, 'c', 0, 1, 0.01, f2));
      gB.append(slider('Busto: caída', P.bust, 'g', 0, 1, 0.01, f2));
    }
    gB.append(color('Piel', 'skin', PALETTES.skin));

    const gF = group('Cara', 'face', true);
    gF.append(slider('Tamaño de ojos', P.face, 'eyeScale', 0.8, 1.3, 0.01, f2));
    gF.append(color('Ojos', 'eyes', PALETTES.eyes));
    gF.append(expressionChips());

    const gH = group('Pelo', 'hair', true);
    gH.append(chipRow('Peinado', D.RECIPES, L.hairStyle, (v) => { L.hairStyle = v; }));
    gH.append(color('Color', 'hair', PALETTES.hair));

    const gC = group('Ropa', 'clothes', false);
    gC.append(chipRow('Parte superior', D.TOPS, L.topStyle, (v) => { L.topStyle = v; }));
    gC.append(color('Color', 'top', PALETTES.cloth));
    gC.append(chipRow('Parte inferior', D.BOTTOMS, L.bottomStyle, (v) => { L.bottomStyle = v; }));
    gC.append(color('Color', 'bottom', PALETTES.cloth));
    gC.append(chipRow('Calzado', D.SHOES, L.shoeStyle, (v) => { L.shoeStyle = v; }));
    gC.append(color('Color', 'shoes', PALETTES.cloth));

    // Validación (12.6): se recalcula con cada cambio.
    const gV = group('Validación anatómica', 'validate', false);
    const px = state.mode === 'pixel' ? Number(($('pxSize').value || '48x64').split('x')[1]) : null;
    const icon = { ok: '✓', warn: '⚠', error: '✗' };
    const list = el('div', { class: 'info-box' });
    for (const r of SC.anatValidate.run(a, { pixelHeight: px })) {
      const line = el('div', { class: 'check-' + r.level });
      line.append(el('b', { text: `${icon[r.level]} ${r.name}: ` }), r.msg);
      list.append(line);
    }
    gV.append(list);

    // Depuración del G-buffer: normales, partes, materiales o profundidad.
    const gD = group('Depuración del G-buffer', 'debug', false);
    const modes = { none: 'Render final', normal: 'Normales', part: 'Partes', material: 'Materiales', depth: 'Profundidad' };
    const chips = el('div', { class: 'chips' });
    for (const [id, name] of Object.entries(modes)) {
      chips.append(el('button', { class: 'chip' + (state.debug === id ? ' active' : ''), text: name, onclick: (e) => { state.debug = id; chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === e.currentTarget)); draw(); } }));
    }
    gD.append(el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: 'Vista (novela visual)' }), chips]));

    const gL = group('Licencia', 'license', false);
    gL.append(el('p', { class: 'hint', text: 'El cuerpo sale de la malla base de MakeHuman con sus morphs (CC0, dominio público): lo que exportes se puede usar y vender sin dar crédito.' }));
  }

  function buildViewUI() {
    const chips = $('viewChips');
    chips.innerHTML = '';
    for (const [id, v] of Object.entries(SC.VIEWS)) {
      chips.append(el('button', {
        class: 'chip' + (state.view === id ? ' active' : ''), text: v.name,
        onclick: () => { state.view = id; buildViewUI(); draw(); },
      }));
    }
  }

  function buildAnimUI() {
    const chips = $('animChips');
    chips.innerHTML = '';
    for (const a of animList()) {
      chips.append(el('button', {
        class: 'chip' + (state.anim === a.id ? ' active' : ''), text: a.name,
        onclick: () => { state.anim = a.id; state.frame = 0; state.playing = true; buildAnimUI(); },
      }));
    }
    $('btnPlay').textContent = state.playing ? '❚❚' : '▶';
    const checks = $('animChecks');
    if (!checks.children.length) {
      for (const a of animList()) {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = state.exportAnims.has(a.id);
        cb.addEventListener('change', () => { if (cb.checked) state.exportAnims.add(a.id); else state.exportAnims.delete(a.id); });
        checks.append(el('label', { class: 'check' }, [cb, a.name]));
      }
    }
  }

  // ---------- Vista previa ----------
  const view = $('view');
  const vctx = view.getContext('2d');

  function resize() {
    const r = $('stage').getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = Math.max(1, Math.round(r.width * dpr));
    view.height = Math.max(1, Math.round(r.height * dpr));
    draw();
  }

  function pxOptions() {
    const portrait = $('pxType').value === 'portrait';
    const [w, h] = (portrait ? $('pxPortraitSize') : $('pxSize')).value.split('x').map(Number);
    return {
      w, h, portrait,
      chibi: $('pxChibi').checked,
      outline: $('pxOutline').checked,
      innerLines: $('pxInner').checked,
      lineMode: state.ch.style.lineMode,
      view: state.view,
    };
  }

  function vnOptions() {
    return { frame: $('vnFrame').value, scale: Number($('vnScale').value), view: state.view };
  }

  // Direcciones típicas de un juego 2D (vista cenital o lateral).
  const DIRS = [{ view: 'front', dir: 'abajo' }, { view: 'left', dir: 'izquierda' }, { view: 'side', dir: 'derecha' }, { view: 'back', dir: 'arriba' }];

  // Fotogramas bajo demanda: sólo se calcula el que se va a mostrar y el resto
  // se precalcula en segundo plano (ver prefetch), así la interfaz no se congela.
  function pixelFrame(i) {
    const o = pxOptions();
    const key = JSON.stringify([state.ch, o, state.anim, state.view]);
    if (state.pxCache.key !== key) state.pxCache = { key, frames: [] };
    if (!state.pxCache.frames[i]) {
      const pose = poseAt(state.anim, i);
      state.pxCache.frames[i] = o.portrait ? E.renderPixelPortrait(state.ch, pose, o) : E.renderPixel(state.ch, pose, o);
    }
    return state.pxCache.frames[i];
  }

  // La vista previa de novela visual se calcula como mucho a PREVIEW_MAX
  // píxeles de alto y se escala al lienzo.
  const PREVIEW_MAX = 700;
  function vnFrame(i, W, H) {
    const bust = $('vnFrame').value === 'bust';
    const rs = Math.min(1, PREVIEW_MAX / H), Wr = Math.round(W * rs), Hr = Math.round(H * rs);
    const key = JSON.stringify([state.ch, state.view, state.anim, Wr, Hr, bust, state.debug]);
    if (state.vnCache.key !== key) state.vnCache = { key, frames: [] };
    let fr = state.vnCache.frames[i];
    if (!fr) {
      const pose = poseAt(state.anim, i);
      const o = { view: state.view, frame: bust ? 'bust' : 'full', lineWidth: state.ch.style.lineWidth, lineMode: state.ch.style.lineMode };
      fr = state.debug !== 'none' ? E.debugView(state.ch, Wr, Hr, pose, Object.assign(o, { debug: state.debug })) : E.renderView(state.ch, Wr, Hr, pose, o);
      state.vnCache.frames[i] = fr;
    }
    return fr;
  }

  // Precalcula en segundo plano los fotogramas que faltan de la animación actual.
  let prefetchTimer = 0;
  function schedulePrefetch() {
    if (prefetchTimer) return;
    prefetchTimer = setTimeout(() => {
      prefetchTimer = 0;
      const n = frameCountFor(state.anim);
      for (let i = 0; i < n; i++) {
        if (state.mode === 'vn') {
          if (!state.vnCache.frames[i]) { vnFrame(i, view.width, view.height); break; }
        } else if (!state.pxCache.frames[i]) { pixelFrame(i); break; }
        if (i === n - 1) return;
      }
      schedulePrefetch();
    }, 40);
  }

  function draw() {
    const W = view.width, H = view.height;
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.clearRect(0, 0, W, H);
    const nFrames = frameCountFor(state.anim);
    $('frameInfo').textContent = `${(state.frame % nFrames) + 1}/${nFrames}`;
    const fi = state.frame % nFrames;
    if (state.mode === 'vn') {
      vctx.imageSmoothingEnabled = true;
      vctx.imageSmoothingQuality = 'high';
      vctx.drawImage(vnFrame(fi, W, H), 0, 0, W, H);
    } else {
      const f = pixelFrame(fi);
      const zoom = Math.max(1, Math.floor(Math.min(W / f.width, H / f.height) * 0.85));
      vctx.imageSmoothingEnabled = false;
      vctx.drawImage(f, Math.round((W - f.width * zoom) / 2), Math.round((H - f.height * zoom) / 2), f.width * zoom, f.height * zoom);
    }
    schedulePrefetch();
  }

  let last = 0;
  function tick(t) {
    const anim = SC.ANIMS[state.anim];
    if (state.playing && t - last >= 1000 / anim.fps) {
      last = t;
      state.frame = (state.frame + 1) % frameCountFor(state.anim);
      draw();
    }
    requestAnimationFrame(tick);
  }

  let storeTimer = 0;
  function changed(rebuild = false) {
    if (rebuild) buildEditor();
    draw();
    clearTimeout(storeTimer);
    storeTimer = setTimeout(store, 300);
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('vnOptions').hidden = mode !== 'vn';
    $('pxOptions').hidden = mode !== 'pixel';
    draw();
  }

  // ---------- Aleatorio ----------
  function randomCharacter() {
    const rnd = Math.random, pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const ch = defaultCharacter();
    ch.name = state.ch.name;
    ch.style = state.ch.style;
    ch.expression = pick(Object.keys(SC.EXPRESSIONS));
    const s = rnd() < 0.5 ? 0.9 + rnd() * 0.1 : rnd() * 0.12;
    ch.anat = sanitizeAnat({
      params: { style: pick(['anime', 'anime', 'shojo', 'realista', 'heroico', 'chibi']), s, b: +(rnd() * 1.2 - 0.5).toFixed(2), m: +(0.3 + rnd() * 0.5).toFixed(2), e: 1.1, bust: { c: +(0.2 + rnd() * 0.6).toFixed(2), g: +(rnd() * 0.4).toFixed(2), q: 0.5 }, face: { eyeScale: +(0.9 + rnd() * 0.3).toFixed(2), jaw: 0 } },
      look: {
        skin: pick(PALETTES.skin.slice(0, 7)), hair: pick(PALETTES.hair), eyes: pick(PALETTES.eyes), top: pick(PALETTES.cloth), bottom: pick(PALETTES.cloth), shoes: pick(['#5a3d2b', '#2b2233', '#f2f2f5', '#8e5bc8']), tie: pick(PALETTES.cloth),
        hairStyle: pick(s > 0.5 ? ['bob', 'largo', 'coleta', 'coletas', 'mono'] : ['corto', 'corto', 'rapado', 'bob']),
        topStyle: pick(s > 0.5 ? ['camiseta', 'larga', 'tirantes', 'abullonada', 'vestido'] : ['camiseta', 'larga']),
        bottomStyle: pick(s > 0.5 ? ['falda', 'capa', 'larga', 'pantalon', 'corto'] : ['pantalon', 'corto']),
        shoeStyle: pick(['zapatos', 'botas']),
      },
    });
    return ch;
  }

  // ---------- Exportación ----------
  function status(msg) { $('status').textContent = msg; }
  const creditFiles = () => [{ name: 'LICENCIA.txt', data: `Personaje creado con Forja de Sprites.\n${SC.mhModel.data().license}\nUso comercial permitido; el crédito no es obligatorio.\n` }];

  async function doExport(kind) {
    const ch = state.ch;
    const name = X.slug(ch.name);
    const anims = [...state.exportAnims];
    try {
      status('Generando…');
      await new Promise((res) => setTimeout(res, 20));
      if (kind === 'vn-png') {
        X.download(await X.canvasBlob(E.renderVN(ch, poseAt(state.anim, state.frame), vnOptions())), `${name}_${ch.expression}.png`);
      } else if (kind === 'vn-expr') {
        const files = [], list = [];
        for (const id of Object.keys(SC.EXPRESSIONS)) {
          const cv = E.renderVN(ch, null, Object.assign(vnOptions(), { expression: id }));
          const file = `${name}_${id}.png`;
          files.push({ name: `${name}/${file}`, data: await X.canvasBytes(cv) });
          list.push({ expr: id, file });
        }
        files.push({ name: `${name}.rpy`, data: X.renpyScript(name, list) }, ...creditFiles());
        X.download(X.zip(files), `${name}_expresiones.zip`);
      } else if (kind === 'vn-sheet') {
        if (!anims.length) return status('Selecciona al menos una animación.');
        const { canvas, meta } = X.spritesheet(ch, anims, 'vn', { frame: $('vnFrame').value, height: 500, view: state.view }, `${name}_hoja`);
        X.download(X.zip([
          { name: `${name}_hoja.png`, data: await X.canvasBytes(canvas) },
          { name: `${name}_hoja.json`, data: JSON.stringify(meta, null, 2) },
          ...creditFiles(),
        ]), `${name}_animaciones_vn.zip`);
      } else if (kind === 'px-expr') {
        const k = Number($('pxExportScale').value);
        const po = Object.assign(pxOptions(), { portrait: true });
        [po.w, po.h] = $('pxPortraitSize').value.split('x').map(Number);
        const files = [], list = [];
        for (const id of Object.keys(SC.EXPRESSIONS)) {
          const cv = X.upscale(E.renderPixelPortrait(ch, null, Object.assign({}, po, { expression: id })), k);
          const file = `${name}_${id}.png`;
          files.push({ name: `${name}/${file}`, data: await X.canvasBytes(cv) });
          list.push({ expr: id, file });
        }
        files.push({ name: `${name}.rpy`, data: X.renpyScript(name, list) }, ...creditFiles());
        X.download(X.zip(files), `${name}_expresiones_pixel.zip`);
      } else if (kind === 'px-png') {
        const k = Number($('pxExportScale').value), po = pxOptions(), pose = poseAt(state.anim, state.frame);
        const f = po.portrait ? E.renderPixelPortrait(ch, pose, po) : E.renderPixel(ch, pose, po);
        X.download(await X.canvasBlob(X.upscale(f, k)), `${name}_${state.anim}_${state.frame + 1}.png`);
      } else if (kind === 'px-sheet') {
        if (!anims.length) return status('Selecciona al menos una animación.');
        const k = Number($('pxExportScale').value), po = pxOptions();
        const { canvas, meta } = X.spritesheet(ch, anims, 'pixel', po, `${name}_sprites`, $('pxDirs').checked && !po.portrait ? DIRS : null);
        meta.frameWidth *= k;
        meta.frameHeight *= k;
        X.download(X.zip([
          { name: `${name}_sprites.png`, data: await X.canvasBytes(X.upscale(canvas, k)) },
          { name: `${name}_sprites.json`, data: JSON.stringify(meta, null, 2) },
          ...creditFiles(),
        ]), `${name}_sprites.zip`);
      }
      status('¡Exportado!');
    } catch (err) {
      console.error(err);
      status('Error al exportar: ' + err.message);
    }
  }

  // ---------- Eventos ----------
  document.querySelectorAll('.mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => doExport(b.dataset.export)));
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; buildAnimUI(); });
  $('btnRandom').addEventListener('click', () => { state.ch = randomCharacter(); $('charName').value = state.ch.name; changed(true); });
  $('btnSave').addEventListener('click', () => {
    const data = JSON.stringify({ format: 'forja-sprites', version: 2, character: state.ch }, null, 2);
    X.download(new Blob([data], { type: 'application/json' }), `${X.slug(state.ch.name)}.json`);
  });
  $('fileLoad').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const ch = sanitize(JSON.parse(await file.text()));
      if (!ch) throw new Error('formato no reconocido');
      state.ch = ch;
      $('charName').value = ch.name;
      syncStyleInputs();
      changed(true);
      status('Personaje cargado.');
    } catch (err) {
      status('No se pudo cargar: ' + err.message);
    }
  });
  $('charName').addEventListener('input', (e) => { state.ch.name = e.target.value; changed(); });
  $('lineMode').addEventListener('change', (e) => { state.ch.style.lineMode = e.target.value; changed(); });
  $('lineWidth').addEventListener('change', (e) => { state.ch.style.lineWidth = Number(e.target.value); changed(); });
  for (const id of ['vnFrame', 'pxSize', 'pxChibi', 'pxOutline', 'pxInner', 'pxPortraitSize']) $(id).addEventListener('change', draw);
  $('pxType').addEventListener('change', () => {
    const portrait = $('pxType').value === 'portrait';
    $('pxPortraitRow').hidden = !portrait;
    $('pxSizeRow').hidden = portrait;
    $('pxChibiRow').hidden = portrait;
    $('pxDirsRow').hidden = portrait;
    draw();
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault();
      state.playing = !state.playing;
      buildAnimUI();
    }
  });

  function syncStyleInputs() {
    $('lineMode').value = state.ch.style.lineMode;
    $('lineWidth').value = state.ch.style.lineWidth;
  }

  // ---------- Inicio ----------
  $('charName').value = state.ch.name;
  syncStyleInputs();
  buildEditor();
  buildViewUI();
  buildAnimUI();
  new ResizeObserver(resize).observe($('stage'));
  resize();
  requestAnimationFrame(tick);

  // Acceso desde la consola para depurar o automatizar.
  window.forja = { state, draw, randomCharacter, doExport, setMode, buildEditor, buildViewUI };
})();
