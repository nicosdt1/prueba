// Interfaz de la aplicación: editor de piezas, vista previa animada y exportación.
(() => {
  const U = SC.util, X = SC.exporter;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'forja-sprites:personaje:v2';

  const PALETTES = {
    skin: ['#fde6d4', '#f3cdb0', '#e8b48f', '#c98d64', '#a26a45', '#7a4a2e', '#553223', '#a9c8e8', '#a8cf93'],
    hair: ['#1f1a24', '#4a3226', '#6b3f2a', '#a0522d', '#d9a441', '#f0dc9a', '#e8e4df', '#c23b3b', '#e57fb0', '#4f7fd6', '#5aa36b', '#8e5bc8'],
    eyes: ['#3f7fd6', '#4c9a5a', '#8a5a2b', '#b03a48', '#7b4fc9', '#2aa7a0', '#d69a2a', '#555566'],
    cloth: ['#4f86d9', '#e04848', '#f2f2f5', '#2b2233', '#34405e', '#5f8f4e', '#e8b93a', '#8e5bc8', '#e87a9b', '#9b7a52', '#3c4c63', '#39b3a8', '#d8513f', '#27386f', '#f4e1c1'],
  };

  const pct = (v) => Math.round(v * 100) + '%';
  const BODY_SLIDERS = [
    { key: 'heads', label: 'Proporción', min: 2.5, max: 8, step: 0.1, fmt: (v) => v.toFixed(1) + ' cab.' },
    { key: 'height', label: 'Altura', min: 0.75, max: 1, step: 0.01, fmt: pct },
    { key: 'build', label: 'Complexión', min: 0.75, max: 1.4, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'muscle', label: 'Musculatura', min: 0, max: 1, step: 0.01, fmt: pct },
    { key: 'bust', label: 'Busto', min: 0, max: 1, step: 0.01, fmt: pct, only: 'f' },
    { key: 'shoulders', label: 'Hombros', min: 0.8, max: 1.35, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'waist', label: 'Cintura', min: 0.8, max: 1.35, step: 0.01, fmt: (v) => v.toFixed(2) },
    { key: 'hips', label: 'Caderas', min: 0.8, max: 1.35, step: 0.01, fmt: (v) => v.toFixed(2) },
  ];
  const SEXES = { f: 'Femenino', m: 'Masculino' };

  const defaultCharacter = () => ({
    name: 'Personaje',
    body: Object.assign({}, SC.BODY_DEFAULTS),
    expression: 'feliz',
    style: { lineMode: 'colored', lineWidth: 1 },
    slots: {
      body: { part: 'humano', colors: {} },
      eyes: { part: 'shoujo', colors: {} },
      hair: { part: 'largo', colors: {} },
      top: { part: 'marinero', colors: {} },
      bottom: { part: 'falda', colors: {} },
      shoes: { part: 'zapatos', colors: {} },
      headAcc: { part: 'lazo', colors: {} },
    },
  });

  const state = {
    ch: loadStored() || defaultCharacter(),
    mode: 'vn',
    anim: 'idle',
    view: 'front',
    engine: 'gen',
    modelRev: 0,
    dirs: true,
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

  // Asegura que un personaje cargado tenga una estructura válida.
  function sanitize(obj) {
    const ch = obj && obj.character ? obj.character : obj;
    if (!ch || typeof ch !== 'object' || !ch.slots) return null;
    const def = defaultCharacter();
    const out = {
      name: typeof ch.name === 'string' ? ch.name.slice(0, 40) : def.name,
      body: Object.assign({}, def.body),
      expression: SC.EXPRESSIONS[ch.expression] ? ch.expression : 'neutral',
      style: Object.assign({}, def.style, ch.style || {}),
      slots: {},
    };
    for (const s of BODY_SLIDERS) {
      const v = Number(ch.body && ch.body[s.key]);
      if (Number.isFinite(v)) out.body[s.key] = U.clamp(v, s.min, s.max);
    }
    if (ch.body && SEXES[ch.body.sex]) out.body.sex = ch.body.sex;
    if (ch.mod && typeof ch.mod === 'object') out.mod = sanitizeMod(ch.mod);
    for (const slot of SC.SLOTS) {
      const sel = ch.slots[slot.id];
      if (sel && SC.getPart(slot.id, sel.part)) {
        const colors = {};
        for (const [k, v] of Object.entries(sel.colors || {})) if (/^#[0-9a-f]{6}$/i.test(v)) colors[k] = v;
        out.slots[slot.id] = { part: sel.part, colors };
      } else if (slot.required) {
        out.slots[slot.id] = def.slots[slot.id];
      }
    }
    return out;
  }

  // Configuración del motor modular (piezas CC0).
  function sanitizeMod(m) {
    const d = SC.mod.config, parts = {};
    for (const sl of SC.mod.SLOTS) {
      const v = m.parts && m.parts[sl.id];
      parts[sl.id] = v && SC.mod.SETS[v] ? v : v === null ? null : d.parts[sl.id];
    }
    const colors = {};
    for (const [k, v] of Object.entries(m.colors || {})) if (/^#[0-9a-f]{6}$/i.test(v) && /^[\w:]+$/.test(k)) colors[k] = v;
    return { sex: m.sex === 'm' ? 'm' : 'f', hair: SC.mod.HAIRS[m.hair] ? m.hair : m.hair === null ? null : d.hair, beard: !!m.beard, parts, colors };
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

  function colorInputs(slotId, def) {
    const sel = state.ch.slots[slotId];
    const resolved = SC.resolveColors(def, sel);
    const wrap = el('div', { class: 'colors' });
    for (const [key, info] of Object.entries(def.colors || {})) {
      const input = el('input', { type: 'color', value: resolved[key], 'aria-label': info.label });
      input.addEventListener('input', () => {
        sel.colors[key] = input.value;
        changed();
      });
      wrap.append(el('label', { class: 'color' }, [input, info.label]));
      const pal = key === 'skin' ? PALETTES.skin : slotId === 'hair' && key === 'main' ? PALETTES.hair : key === 'iris' ? PALETTES.eyes : null;
      if (pal) {
        const sw = el('div', { class: 'swatches' });
        for (const col of pal) {
          sw.append(el('button', {
            class: 'swatch', style: `background:${col}`, title: col, 'aria-label': `${info.label} ${col}`,
            onclick: () => { sel.colors[key] = col; input.value = col; changed(); },
          }));
        }
        wrap.append(sw);
      }
    }
    return wrap;
  }

  function slotBlock(slot) {
    const sel = state.ch.slots[slot.id];
    const block = el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: slot.name })]);
    const chips = el('div', { class: 'chips' });
    if (!slot.required) {
      chips.append(el('button', {
        class: 'chip' + (!sel ? ' active' : ''), text: 'Ninguno',
        onclick: () => { delete state.ch.slots[slot.id]; changed(true); },
      }));
    }
    for (const def of SC.partList(slot.id)) {
      chips.append(el('button', {
        class: 'chip' + (sel && sel.part === def.id ? ' active' : ''), text: def.name,
        onclick: () => {
          const prev = state.ch.slots[slot.id];
          state.ch.slots[slot.id] = { part: def.id, colors: prev ? prev.colors : {} };
          changed(true);
        },
      }));
    }
    block.append(chips);
    if (sel) block.append(colorInputs(slot.id, SC.getPart(slot.id, sel.part)));
    return block;
  }

  // Motor activo: generado, modelo VRM o hoja LPC.
  const E = () => (state.engine === 'vrm' && SC.vrm.loaded ? SC.vrm : state.engine === 'lpc' && SC.lpc.loaded ? SC.lpc
    : state.engine === 'mod' && SC.mod.loaded ? SC.mod : SC.render);
  const frameCountFor = (animId) => (state.engine === 'lpc' && SC.lpc.loaded ? SC.lpc.frameCount(animId)
    : state.engine === 'mod' && SC.mod.loaded ? SC.mod.frameCount(animId) : SC.ANIMS[animId].frames);
  // Pose de un fotograma. Lleva la animación y el instante para los motores que
  // reproducen clips (modular) en vez de poses generadas.
  function poseAt(animId, i) {
    const a = SC.ANIMS[animId], n = frameCountFor(animId);
    return Object.assign(a.pose(i % a.frames, a.frames), { animId, t: (i % n) / n });
  }
  // Animaciones que ofrece el motor activo (las extra sólo existen en el modular).
  const animList = () => Object.values(SC.ANIMS).filter((a) => !a.modOnly || state.engine === 'mod');

  function infoBox(rows) {
    const box = el('div', { class: 'info-box' });
    for (const [k, v] of rows) {
      const line = el('div');
      line.append(el('b', { text: k + ': ' }), v);
      box.append(line);
    }
    return box;
  }

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

  function buildVrmPanel(root) {
    const g = el('details', { class: 'group', open: '' }, [el('summary', { text: 'Modelo VRM' })]);
    if (!SC.vrm.available) {
      g.append(el('p', { class: 'hint', text: 'Este navegador no tiene WebGL, necesario para los modelos VRM. Usa el motor «Generado».' }));
      root.append(g);
      return;
    }
    const file = el('input', { type: 'file', accept: '.vrm', hidden: '' });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      status('Cargando modelo…');
      try { await SC.vrm.load(await f.arrayBuffer()); state.modelRev++; status('Modelo cargado.'); } catch (err) { status('No se pudo cargar: ' + err.message); }
      changed(true);
    });
    g.append(el('div', { class: 'btn-col' }, [
      el('label', { class: 'btn', text: '📂 Cargar modelo VRM…' }, [file]),
      el('button', {
        id: 'btnVrmDemo', text: '✨ Usar modelo de ejemplo',
        onclick: async () => {
          status('Cargando modelo de ejemplo…');
          try { await SC.vrm.loadDemo(); state.modelRev++; status('Modelo de ejemplo cargado.'); } catch (err) { status('Error: ' + err.message); }
          changed(true);
        },
      }),
    ]));
    const info = SC.vrm.info;
    if (info) {
      g.append(infoBox([
        ['Modelo', info.name], ['Autoría', (info.authors || []).join(', ') || '—'], ['Licencia', info.license || '—'],
        ['Uso comercial', info.commercial], ['Redistribución', info.redistribution], ['Crédito', info.credit],
      ]));
    }
    g.append(el('p', { class: 'hint', text: 'Crea tus personajes gratis con VRoid Studio (exporta en .vrm) y cárgalos aquí. Poses, vistas, expresiones y exportaciones funcionan igual que con el motor generado. Respeta la licencia de cada modelo.' }));
    root.append(g);
    if (SC.vrm.loaded) root.append(vrmCustomizer());
    const c = el('details', { class: 'group', open: '' }, [el('summary', { text: 'Cara' })]);
    c.append(expressionChips());
    root.append(c);
  }

  // Personalización del modelo: recolorea sus propias texturas (pelo, ojos,
  // piel, cada prenda) conservando el dibujo, y permite ocultar prendas.
  function vrmCustomizer() {
    const g = el('details', { class: 'group', open: '' }, [el('summary', { text: 'Personalizar' })]);
    if (!SC.vrm.info.canModify) {
      g.append(el('p', { class: 'hint', text: 'La licencia de este modelo no permite modificarlo, así que no se puede recolorear.' }));
      return g;
    }
    const refresh = () => { state.modelRev++; draw(); };
    for (const grp of SC.vrm.groups) {
      const input = el('input', { type: 'color', value: grp.color || grp.base, 'aria-label': grp.label });
      input.addEventListener('change', () => { status('Aplicando color…'); setTimeout(() => { SC.vrm.setGroupColor(grp.id, input.value); status(''); refresh(); }, 10); });
      const reset = el('button', {
        class: 'chip', text: '↺', title: 'Color original', 'aria-label': 'Restablecer ' + grp.label,
        onclick: () => { SC.vrm.setGroupColor(grp.id, null); input.value = grp.base; refresh(); },
      });
      const row = el('div', { class: 'colors' }, [el('label', { class: 'color' }, [input, grp.label]), reset]);
      if (grp.cloth) {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = grp.visible;
        cb.addEventListener('change', () => { SC.vrm.setGroupVisible(grp.id, cb.checked); refresh(); });
        row.append(el('label', { class: 'check' }, [cb, 'Visible']));
      }
      g.append(row);
    }
    g.append(el('p', { class: 'hint', text: 'El color se aplica sobre las texturas originales del modelo: se conservan mechones, brillos, pliegues y sombras.' }));
    return g;
  }

  function buildLpcPanel(root) {
    const g = el('details', { class: 'group', open: '' }, [el('summary', { text: 'Hoja LPC' })]);
    const file = el('input', { type: 'file', accept: 'image/png', hidden: '' });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      try { await SC.lpc.load(f); state.modelRev++; setMode('pixel'); status('Hoja LPC cargada.'); } catch (err) { status('No se pudo cargar: ' + err.message); }
      changed(true);
    });
    const cred = el('input', { type: 'file', accept: '.txt,.csv,text/plain', hidden: '' });
    cred.addEventListener('change', async () => {
      const f = cred.files[0];
      cred.value = '';
      if (f) { SC.lpc.setCredits(await f.text()); status('Créditos cargados.'); changed(true); }
    });
    g.append(el('div', { class: 'btn-col' }, [
      el('label', { class: 'btn', text: '📂 Cargar hoja LPC (.png)…' }, [file]),
      el('label', { class: 'btn', text: '📄 Cargar créditos (.txt / .csv)…' }, [cred]),
    ]));
    if (SC.lpc.loaded) {
      g.append(infoBox([['Hoja', SC.lpc.name], ['Formato', SC.lpc.extended ? 'ampliado (con reposo, correr y saltar)' : 'estándar'], ['Créditos', SC.lpc.credits ? 'cargados' : 'pendientes']]));
    }
    g.append(el('p', { class: 'hint', text: 'Crea la hoja con el Universal LPC Spritesheet Character Generator y descarga también su archivo de créditos: el arte LPC es CC-BY-SA / GPL y hay que acreditar a sus autores. Los créditos se incluyen al exportar.' }));
    root.append(g);
  }

  // ---------- Motor modular (piezas CC0 de Quaternius) ----------
  let modBusy = null;
  async function rebuildMod() {
    const cfg = state.ch.mod || SC.mod.config;
    const job = (modBusy = SC.mod.build(cfg));
    try {
      await job;
      if (job !== modBusy) return;
      state.ch.mod = SC.mod.config;
      state.modelRev++;
      status('');
    } catch (err) {
      status('No se pudo montar el personaje: ' + err.message);
    }
    modBusy = null;
    changed(true);
  }

  function modSet(fn) {
    state.ch.mod = state.ch.mod || SC.mod.config;
    fn(state.ch.mod);
    status('Montando personaje…');
    rebuildMod();
    buildEditor();
  }

  function buildModPanel(root) {
    const g = el('details', { class: 'group', open: '' }, [el('summary', { text: 'Personaje modular' })]);
    root.append(g);
    if (!SC.mod.available) {
      g.append(el('p', { class: 'hint', text: 'Este navegador no tiene WebGL, necesario para el motor modular. Usa el motor «Generado».' }));
      return;
    }
    const cfg = state.ch.mod || SC.mod.config;
    const chipRow = (title, options, current, onPick) => {
      const chips = el('div', { class: 'chips' });
      for (const [id, name] of options) {
        chips.append(el('button', { class: 'chip' + (current === id ? ' active' : ''), text: name, onclick: () => onPick(id) }));
      }
      return el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: title }), chips]);
    };
    g.append(chipRow('Cuerpo', [['f', 'Femenino'], ['m', 'Masculino']], cfg.sex, (v) => modSet((c) => { c.sex = v; c.colors = {}; })));
    g.append(chipRow('Peinado', [...Object.entries(SC.mod.HAIRS), [null, 'Calvo']], cfg.hair, (v) => modSet((c) => { c.hair = v; })));
    if (cfg.sex === 'm') {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = !!cfg.beard;
      cb.addEventListener('change', () => modSet((c) => { c.beard = cb.checked; }));
      g.append(el('label', { class: 'check' }, [cb, 'Barba']));
    }
    for (const sl of SC.mod.SLOTS) {
      g.append(chipRow(sl.label, [...Object.entries(SC.mod.SETS), [null, 'Ninguno']], cfg.parts[sl.id], (v) => modSet((c) => { c.parts[sl.id] = v; })));
    }
    if (SC.mod.loaded) {
      const colors = el('details', { class: 'group', open: '' }, [el('summary', { text: 'Colores' })]);
      for (const grp of SC.mod.groups) {
        const input = el('input', { type: 'color', value: grp.color || grp.base, 'aria-label': grp.label });
        input.addEventListener('change', () => {
          status('Aplicando color…');
          setTimeout(() => { SC.mod.setGroupColor(grp.id, input.value); state.ch.mod = SC.mod.config; state.modelRev++; status(''); changed(); }, 10);
        });
        const reset = el('button', {
          class: 'chip', text: '↺', title: 'Color original', 'aria-label': 'Restablecer ' + grp.label,
          onclick: () => { SC.mod.setGroupColor(grp.id, null); input.value = grp.base; state.ch.mod = SC.mod.config; state.modelRev++; changed(); },
        });
        colors.append(el('div', { class: 'colors' }, [el('label', { class: 'color' }, [input, grp.label]), reset]));
      }
      root.append(colors);
    }
    root.append(el('details', { class: 'group' }, [
      el('summary', { text: 'Licencia' }),
      infoBox([['Piezas y animaciones', 'Quaternius'], ['Licencia', 'CC0 1.0 (dominio público)'], ['Uso comercial', 'permitido'], ['Crédito', 'no obligatorio']]),
      el('p', { class: 'hint', text: 'Todo lo que exportes con este motor se puede vender en juegos y novelas visuales. Añade más piezas con tools/build-cc0.mjs.' }),
    ]));
  }

  function buildEditor() {
    const root = $('editor');
    if (state.engine !== 'gen') {
      root.innerHTML = '';
      if (state.engine === 'vrm') buildVrmPanel(root); else if (state.engine === 'mod') buildModPanel(root); else buildLpcPanel(root);
      return;
    }
    const open = new Set([...root.querySelectorAll('details[open]')].map((d) => d.dataset.group));
    const first = !root.children.length;
    root.innerHTML = '';
    const groups = {};
    const group = (name) => {
      if (!groups[name]) {
        groups[name] = el('details', { class: 'group', 'data-group': name }, [el('summary', { text: name })]);
        if (first || open.has(name)) groups[name].open = true;
        root.append(groups[name]);
      }
      return groups[name];
    };

    // Cuerpo: sexo, proporciones y colores.
    const g = group('Cuerpo');
    const sexChips = el('div', { class: 'chips' });
    for (const [id, name] of Object.entries(SEXES)) {
      sexChips.append(el('button', {
        class: 'chip' + (state.ch.body.sex === id ? ' active' : ''), text: name,
        onclick: () => { state.ch.body.sex = id; changed(true); },
      }));
    }
    g.append(el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: 'Anatomía' }), sexChips]));
    for (const s of BODY_SLIDERS) {
      if (s.only && s.only !== state.ch.body.sex) continue;
      const out = el('output', { text: s.fmt(state.ch.body[s.key]) });
      const input = el('input', { type: 'range', min: s.min, max: s.max, step: s.step, value: state.ch.body[s.key], 'aria-label': s.label });
      input.addEventListener('input', () => {
        state.ch.body[s.key] = Number(input.value);
        out.textContent = s.fmt(state.ch.body[s.key]);
        changed();
      });
      g.append(el('label', { class: 'slider' }, [s.label, input, out]));
    }
    for (const slot of SC.SLOTS) {
      group(slot.group).append(slotBlock(slot));
      if (slot.id === 'eyes') {
        const chips = el('div', { class: 'chips' });
        for (const [id, e] of Object.entries(SC.EXPRESSIONS)) {
          chips.append(el('button', {
            class: 'chip' + (state.ch.expression === id ? ' active' : ''), text: e.name,
            onclick: () => { state.ch.expression = id; changed(true); },
          }));
        }
        group('Cara').append(el('div', { class: 'slot' }, [el('div', { class: 'slot-title', text: 'Expresión' }), chips]));
      }
    }
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
    if (checks.dataset.engine !== state.engine) {
      checks.innerHTML = '';
      checks.dataset.engine = state.engine;
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
    const key = JSON.stringify([state.ch, o, state.anim, state.view, state.engine, state.modelRev]);
    if (state.pxCache.key !== key) state.pxCache = { key, frames: [] };
    if (!state.pxCache.frames[i]) {
      const pose = poseAt(state.anim, i), Eng = E();
      state.pxCache.frames[i] = o.portrait ? Eng.renderPixelPortrait(state.ch, pose, o) : Eng.renderPixel(state.ch, pose, o);
    }
    return state.pxCache.frames[i];
  }

  // La vista previa de novela visual se calcula como mucho a PREVIEW_MAX píxeles
  // de alto y se escala al lienzo: en pantallas de alta densidad ahorra 2-4 veces trabajo.
  const PREVIEW_MAX = 900;
  function vnFrame(i, W, H) {
    const bust = $('vnFrame').value === 'bust';
    const rs = Math.min(1, PREVIEW_MAX / H), Wr = Math.round(W * rs), Hr = Math.round(H * rs);
    const key = JSON.stringify([state.ch, state.view, state.anim, Wr, Hr, bust, state.engine, state.modelRev]);
    if (state.vnCache.key !== key) state.vnCache = { key, frames: [] };
    let fr = state.vnCache.frames[i];
    if (!fr) {
      const pose = poseAt(state.anim, i);
      if (state.engine === 'mod') {
        fr = SC.mod.renderView(Wr, Hr, pose, { view: state.view, frame: bust ? 'bust' : 'full', lineWidth: state.ch.style.lineWidth });
      } else if (state.engine === 'vrm') {
        fr = SC.vrm.renderView(Wr, Hr, pose, { view: state.view, expression: state.ch.expression, frame: bust ? 'bust' : 'full', lineWidth: state.ch.style.lineWidth });
      } else {
        const box = bust ? SC.render.bustBox(state.ch) : { x: 0, y: 0, w: SC.CANVAS_W, h: SC.CANVAS_H };
        const k = Math.min(Wr / box.w, Hr / box.h) * 0.94;
        fr = SC.render.makeCanvas(Wr, Hr);
        SC.render.paintVN(fr.getContext('2d'), Wr, Hr, [k, 0, 0, k, (Wr - box.w * k) / 2 - box.x * k, (Hr - box.h * k) / 2 - box.y * k], state.ch, pose, { view: state.view });
      }
      state.vnCache.frames[i] = fr;
    }
    return fr;
  }

  // Precalcula en segundo plano los fotogramas que faltan de la animación actual.
  let prefetchTimer = 0;
  function schedulePrefetch() {
    if (prefetchTimer || needsModel() || state.engine === 'lpc') return;
    prefetchTimer = setTimeout(() => {
      prefetchTimer = 0;
      const n = frameCountFor(state.anim);
      for (let i = 0; i < n; i++) {
        if (state.mode === 'vn') {
          const cache = state.vnCache.frames;
          if (!cache[i]) { vnFrame(i, view.width, view.height); break; }
        } else if (!state.pxCache.frames[i]) { pixelFrame(i); break; }
        if (i === n - 1) return;
      }
      schedulePrefetch();
    }, 40);
  }

  function currentPose() {
    return poseAt(state.anim, state.frame);
  }

  function needsModel() {
    if (state.engine === 'vrm' && !SC.vrm.loaded) return 'Carga un modelo VRM o usa el modelo de ejemplo (panel izquierdo).';
    if (state.engine === 'lpc' && !SC.lpc.loaded) return 'Carga una hoja LPC en formato PNG (panel izquierdo).';
    if (state.engine === 'mod' && !SC.mod.loaded) return SC.mod.available ? 'Cargando piezas…' : 'El motor modular necesita WebGL.';
    return '';
  }

  function draw() {
    const W = view.width, H = view.height;
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.clearRect(0, 0, W, H);
    const nFrames = frameCountFor(state.anim);
    $('frameInfo').textContent = `${(state.frame % nFrames) + 1}/${nFrames}`;
    const missing = needsModel();
    if (missing) {
      vctx.fillStyle = getComputedStyle(document.body).color;
      vctx.font = `${Math.round(15 * (window.devicePixelRatio || 1))}px system-ui, sans-serif`;
      vctx.textAlign = 'center';
      vctx.fillText(missing, W / 2, H / 2);
      return;
    }
    if (state.engine === 'lpc') {
      const f = SC.lpc.frame(state.anim, state.view, state.frame);
      const zoom = Math.max(1, Math.floor(Math.min(W / f.width, H / f.height) * 0.8));
      vctx.imageSmoothingEnabled = false;
      vctx.drawImage(f, Math.round((W - f.width * zoom) / 2), Math.round((H - f.height * zoom) / 2), f.width * zoom, f.height * zoom);
      return;
    }
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
    const fps = state.engine === 'mod' && SC.mod.loaded ? SC.mod.fps : anim.fps;
    if (state.playing && t - last >= 1000 / fps) {
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
    const r = U.rng((Math.random() * 2 ** 32) >>> 0);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const ch = defaultCharacter();
    ch.name = state.ch.name;
    ch.style = state.ch.style;
    ch.expression = pick(Object.keys(SC.EXPRESSIONS));
    const sex = r() < 0.5 ? 'f' : 'm';
    ch.body = {
      sex,
      heads: +(3.5 + r() * 3.5).toFixed(1),
      height: +(0.85 + r() * 0.15).toFixed(2),
      build: +(0.85 + r() * 0.35).toFixed(2),
      muscle: +(r() * 0.8).toFixed(2),
      bust: +(r()).toFixed(2),
      shoulders: +(0.9 + r() * 0.25).toFixed(2),
      waist: +(0.9 + r() * 0.25).toFixed(2),
      hips: +(0.9 + r() * 0.25).toFixed(2),
    };
    const chance = { hair: 0.95, top: 1, outer: 0.3, bottom: 1, shoes: 1, headAcc: 0.35, faceAcc: 0.2, neckAcc: 0.3, backAcc: 0.25 };
    ch.slots = {};
    for (const slot of SC.SLOTS) {
      if (!slot.required && r() > chance[slot.id]) continue;
      const def = pick(SC.partList(slot.id));
      const colors = {};
      for (const key of Object.keys(def.colors || {})) {
        if (key === 'skin') colors[key] = pick(PALETTES.skin.slice(0, 7));
        else if (key === 'iris') colors[key] = pick(PALETTES.eyes);
        else if (slot.id === 'hair' && key === 'main') colors[key] = pick(PALETTES.hair);
        else if (key !== 'under') colors[key] = pick(PALETTES.cloth);
      }
      ch.slots[slot.id] = { part: def.id, colors };
    }
    const top = ch.slots.top && ch.slots.top.part;
    if (['vestido', 'tunica', 'kimono'].includes(top) && r() < 0.7) delete ch.slots.bottom;
    return ch;
  }

  // ---------- Exportación ----------
  function status(msg) { $('status').textContent = msg; }

  async function doExport(kind) {
    const ch = state.ch;
    const name = X.slug(ch.name);
    const anims = [...state.exportAnims].filter((id) => animList().some((a) => a.id === id));
    const missing = needsModel();
    if (missing) return status(missing);
    const Eng = E();
    const lpc = state.engine === 'lpc';
    if (lpc && (kind.startsWith('vn-') || kind === 'px-expr')) return status('Con una hoja LPC sólo se exportan sprites de juego.');
    try {
      status('Generando…');
      await new Promise((res) => setTimeout(res, 20));
      if (kind === 'vn-png') {
        const cv = Eng.renderVN(ch, currentPose(), vnOptions());
        X.download(await X.canvasBlob(cv), `${name}_${ch.expression}.png`);
      } else if (kind === 'vn-expr') {
        const files = [], list = [];
        for (const id of Object.keys(SC.EXPRESSIONS)) {
          const cv = Eng.renderVN(ch, null, Object.assign(vnOptions(), { expression: id }));
          const file = `${name}_${id}.png`;
          files.push({ name: `${name}/${file}`, data: await X.canvasBytes(cv) });
          list.push({ expr: id, file });
        }
        files.push({ name: `${name}.rpy`, data: X.renpyScript(name, list) });
        files.push(...creditFiles());
        X.download(X.zip(files), `${name}_expresiones.zip`);
      } else if (kind === 'vn-sheet') {
        if (!anims.length) return status('Selecciona al menos una animación.');
        const { canvas, meta } = X.spritesheet(ch, anims, 'vn', { frame: $('vnFrame').value, height: 500, view: state.view, engine: Eng }, `${name}_hoja`);
        X.download(X.zip([
          { name: `${name}_hoja.png`, data: await X.canvasBytes(canvas) },
          { name: `${name}_hoja.json`, data: JSON.stringify(meta, null, 2) },
        ]), `${name}_animaciones_vn.zip`);
      } else if (kind === 'px-expr') {
        const k = Number($('pxExportScale').value);
        const po = Object.assign(pxOptions(), { portrait: true });
        [po.w, po.h] = $('pxPortraitSize').value.split('x').map(Number);
        const files = [], list = [];
        for (const id of Object.keys(SC.EXPRESSIONS)) {
          const cv = X.upscale(Eng.renderPixelPortrait(ch, null, Object.assign({}, po, { expression: id })), k);
          const file = `${name}_${id}.png`;
          files.push({ name: `${name}/${file}`, data: await X.canvasBytes(cv) });
          list.push({ expr: id, file });
        }
        files.push({ name: `${name}.rpy`, data: X.renpyScript(name, list) });
        files.push(...creditFiles());
        X.download(X.zip(files), `${name}_expresiones_pixel.zip`);
      } else if (kind === 'px-png') {
        const k = Number($('pxExportScale').value);
        const po = pxOptions();
        const f = lpc ? SC.lpc.frame(state.anim, state.view, state.frame) : po.portrait ? Eng.renderPixelPortrait(ch, currentPose(), po) : Eng.renderPixel(ch, currentPose(), po);
        X.download(await X.canvasBlob(X.upscale(f, k)), `${name}_${state.anim}_${state.frame + 1}.png`);
      } else if (kind === 'px-sheet') {
        if (!anims.length) return status('Selecciona al menos una animación.');
        const k = Number($('pxExportScale').value);
        const po = Object.assign(pxOptions(), { engine: Eng });
        const { canvas, meta } = X.spritesheet(ch, anims, 'pixel', po, `${name}_sprites`, (lpc || $('pxDirs').checked) && !po.portrait ? DIRS : null);
        meta.frameWidth *= k;
        meta.frameHeight *= k;
        const files = [
          { name: `${name}_sprites.png`, data: await X.canvasBytes(X.upscale(canvas, k)) },
          { name: `${name}_sprites.json`, data: JSON.stringify(meta, null, 2) },
        ];
        if (lpc) files.push({ name: 'CREDITOS.txt', data: SC.lpc.credits || 'Arte LPC (Liberated Pixel Cup). Añade aquí los créditos que genera el Universal LPC Spritesheet Character Generator: la licencia CC-BY-SA / GPL obliga a acreditar a los autores.\n' });
        files.push(...creditFiles());
        X.download(X.zip(files), `${name}_sprites.zip`);
      }
      status('¡Exportado!');
    } catch (err) {
      console.error(err);
      status('Error al exportar: ' + err.message);
    }
  }

  function creditFiles() {
    if (state.engine === 'vrm' && SC.vrm.info) return [{ name: 'MODELO_VRM.txt', data: vrmCredits() }];
    if (state.engine === 'mod') return [{ name: 'LICENCIA_CC0.txt', data: 'Personaje montado con piezas y animaciones de Quaternius (https://quaternius.com).\nLicencia: CC0 1.0 Universal (dominio público). Uso comercial permitido; el crédito no es obligatorio.\n' }];
    return [];
  }

  function vrmCredits() {
    const i = SC.vrm.info;
    return `Modelo: ${i.name}\nAutoría: ${(i.authors || []).join(', ')}\n${i.copyright || ''}\nLicencia: ${i.license} ${i.licenseUrl}\nUso comercial: ${i.commercial}\nRedistribución: ${i.redistribution}\nCrédito: ${i.credit}\n`;
  }

  // ---------- Eventos ----------
  $('engine').addEventListener('change', (e) => {
    state.engine = e.target.value;
    state.frame = 0;
    if (state.engine === 'lpc') setMode('pixel');
    if (!animList().some((a) => a.id === state.anim)) state.anim = 'idle';
    buildEditor();
    buildAnimUI();
    draw();
    if (state.engine === 'mod' && !SC.mod.loaded && SC.mod.available && !modBusy) rebuildMod();
  });
  document.querySelectorAll('.mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => doExport(b.dataset.export)));
  $('btnPlay').addEventListener('click', () => { state.playing = !state.playing; buildAnimUI(); });
  $('btnRandom').addEventListener('click', () => { state.ch = randomCharacter(); $('charName').value = state.ch.name; changed(true); });
  $('btnSave').addEventListener('click', () => {
    const data = JSON.stringify({ format: 'forja-sprites', version: 1, character: state.ch }, null, 2);
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
  $('lineWidth').addEventListener('input', (e) => { state.ch.style.lineWidth = Number(e.target.value); changed(); });
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
