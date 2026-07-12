// ════════════════════════════════════════════
// RECORDATORIOS INTELIGENTES
// ════════════════════════════════════════════
// Dos fuentes de recordatorios:
//  · AUTOMÁTICOS: patrones detectados en tus registros (≥3 repeticiones).
//    - Semanal: ≥3 de las últimas ~5 semanas en el MISMO día de la semana.
//    - Mensual: ≥3 meses distintos (últimos ~4) en el mismo día del mes (±3).
//  · MANUALES: los que pides al registrar (toggle 🔔 Recordar), cada semana o
//    cada mes, indefinido o hasta una fecha.
// La tarjeta aparece el día esperado y persiste hasta que actúes (máx. 7 días,
// luego rueda al siguiente ciclo). Cola: uno a la vez, el más antiguo primero.
// "Aplicar" solo pone tipo + descripción y deja que la predicción haga el resto.
// Config sincronizada con Google Sheets (reglas manuales, silenciados y saltos).

const RK = 'tomin_reminders';
const WEEKDAYS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const _REM_DAY = 86400000;

// ── Configuración persistente ──
let reminderConfig = { manual: [], muted: [], skips: [], snoozes: [] };
try {
  const _rc = JSON.parse(localStorage.getItem(RK) || 'null');
  if (_rc && typeof _rc === 'object') {
    reminderConfig = {
      manual:  Array.isArray(_rc.manual)  ? _rc.manual  : [],
      muted:   Array.isArray(_rc.muted)   ? _rc.muted   : [],
      skips:   Array.isArray(_rc.skips)   ? _rc.skips   : [],
      snoozes: Array.isArray(_rc.snoozes) ? _rc.snoozes : []
    };
  }
} catch (e) {}

let _remDirty = false;          // hay cambios locales aún no confirmados en Sheets
const _remAppliedSession = new Set(); // recordatorios "aplicados" en esta sesión (ocultos mientras llenas el formulario)

function _remSaveLocal(){
  try { localStorage.setItem(RK, JSON.stringify(reminderConfig)); } catch(e){}
}

async function saveRemindersToSheets(){
  _remDirty = true;
  _remSaveLocal();
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveReminders', reminders: reminderConfig })
    });
    _remDirty = false;
  } catch(e) { console.warn('Sheets reminders save failed', e); }
}

// Adoptar la copia del servidor (llamado desde loadFromSheets). Si hay cambios
// locales en vuelo, se ignora la copia del servidor para no perderlos.
function adoptRemindersFromServer(server){
  if (_remDirty) return;
  if (!server || typeof server !== 'object') return;
  const normalized = {
    manual:  Array.isArray(server.manual)  ? server.manual  : [],
    muted:   Array.isArray(server.muted)   ? server.muted   : [],
    skips:   Array.isArray(server.skips)   ? server.skips   : [],
    snoozes: Array.isArray(server.snoozes) ? server.snoozes : []
  };
  if (JSON.stringify(normalized) !== JSON.stringify(reminderConfig)) {
    reminderConfig = normalized;
    _remSaveLocal();
    try { updateReminderCard(); } catch(e){}
  }
}

// ── Utilidades ──
function _remKey(type, desc){ return type + '||' + String(desc||'').trim().toLowerCase(); }
function _remFmt(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function _remClampDom(y, m, day){ const last = new Date(y, m+1, 0).getDate(); return Math.min(day, last); }

// ── DETECCIÓN AUTOMÁTICA DE PATRONES ──
function detectAutoReminders(){
  const groups = {}; // key → {desc, type, ts:[timestamps]}
  const nowT = parseDate(localToday()).getTime();
  data.forEach(e => {
    if (e.linkedTo) return;              // hijos vinculados no cuentan
    if (e.deferGroup) return;            // los diferidos ya registran sus mensualidades solos
    if (e.type !== 'egreso' && e.type !== 'ingreso') return;
    const desc = (e.desc || '').trim();
    if (desc.length < 2) return;
    const d = parseDate(e.date);
    if (isNaN(d.getTime())) return;
    const t = d.getTime();
    if (t > nowT + _REM_DAY) return;     // futuros no cuentan
    const k = _remKey(e.type, desc);
    if (!groups[k]) groups[k] = { desc, type: e.type, ts: [] };
    groups[k].ts.push(t);
  });

  const out = [];
  Object.entries(groups).forEach(([key, g]) => {
    if (g.ts.length < 3) return;
    g.ts.sort((a,b) => b - a); // reciente → viejo
    const firstSeen = g.ts[g.ts.length - 1];

    // SEMANAL: ≥3 semanas distintas de las últimas ~5, mismo día de la semana
    const recentW = g.ts.filter(t => (nowT - t) / _REM_DAY <= 35);
    if (recentW.length >= 3) {
      const byWd = {}; // weekday → Set(semana)
      recentW.forEach(t => {
        const wd = new Date(t).getDay();
        (byWd[wd] = byWd[wd] || new Set()).add(Math.floor(t / (7 * _REM_DAY)));
      });
      let bestWd = -1, bestC = 0;
      Object.entries(byWd).forEach(([wd, s]) => { if (s.size > bestC) { bestC = s.size; bestWd = Number(wd); } });
      if (bestC >= 3) {
        out.push({ key, desc: g.desc, type: g.type, freq: 'weekly', day: bestWd, firstSeen, source: 'auto' });
        return;
      }
    }

    // MENSUAL: ≥3 meses distintos (últimos ~130 días), día del mes dentro de ±3 de la mediana
    const recentM = g.ts.filter(t => (nowT - t) / _REM_DAY <= 130);
    if (recentM.length >= 3) {
      const byMonth = {}; // 'y-m' → día del mes (se queda el más reciente)
      recentM.forEach(t => {
        const d = new Date(t);
        const mk = d.getFullYear() + '-' + d.getMonth();
        if (!(mk in byMonth)) byMonth[mk] = d.getDate();
      });
      const days = Object.values(byMonth);
      if (days.length >= 3) {
        const sorted = [...days].sort((a,b) => a - b);
        const med = sorted[Math.floor(sorted.length / 2)];
        if (days.every(x => Math.abs(x - med) <= 3)) {
          out.push({ key, desc: g.desc, type: g.type, freq: 'monthly', day: med, firstSeen, source: 'auto' });
        }
      }
    }
  });
  return out;
}

// ── ¿CUÁNDO TOCA? (fecha esperada + ciclo del recordatorio) ──
function _remExpected(r, T){
  if (r.freq === 'weekly') {
    const diff = (T.getDay() - r.day + 7) % 7;
    const e = new Date(T.getFullYear(), T.getMonth(), T.getDate() - diff);
    return { expected: e, cycle: _remFmt(e), grace: 6, tol: 2 };
  }
  // mensual: el día D de este mes; si aún no llega, el del mes pasado (con gracia de 7 días)
  let y = T.getFullYear(), m = T.getMonth();
  let e = new Date(y, m, _remClampDom(y, m, r.day));
  if (e > T) { m -= 1; if (m < 0) { m = 11; y -= 1; } e = new Date(y, m, _remClampDom(y, m, r.day)); }
  return { expected: e, cycle: `${y}-${String(m+1).padStart(2,'0')}`, grace: 7, tol: 3 };
}

// ¿Ya hay un registro de este patrón dentro del ciclo actual?
function _remAlreadyRegistered(r, expected, tol, T){
  const from = expected.getTime() - tol * _REM_DAY;
  const to = T.getTime() + _REM_DAY;
  const dl = String(r.desc || '').trim().toLowerCase();
  return data.some(e => {
    if (e.type !== r.type) return false;
    if ((e.desc || '').trim().toLowerCase() !== dl) return false;
    const t = parseDate(e.date).getTime();
    return t >= from && t <= to;
  });
}

// ── COLA: recordatorios que tocan HOY, del más antiguo al más reciente ──
function getDueReminders(){
  const T = parseDate(localToday());
  const todayT = T.getTime();
  const all = [];

  // Manuales (tienen prioridad sobre el patrón automático del mismo comercio)
  const manualKeys = new Set();
  (reminderConfig.manual || []).forEach(rule => {
    manualKeys.add(_remKey(rule.type, rule.desc));
    all.push({ ...rule, key: _remKey(rule.type, rule.desc), source: 'manual',
               firstSeen: parseDate(rule.created || localToday()).getTime() });
  });
  // Automáticos (sin duplicar los que ya tienen regla manual)
  detectAutoReminders().forEach(r => { if (!manualKeys.has(r.key)) all.push(r); });

  const due = [];
  all.forEach(r => {
    if ((reminderConfig.muted || []).includes(r.key)) return;
    const { expected, cycle, grace, tol } = _remExpected(r, T);
    // Regla manual con fecha límite: no recordar ciclos posteriores al límite
    if (r.source === 'manual' && r.until && _remFmt(expected) > r.until) return;
    const age = (todayT - expected.getTime()) / _REM_DAY;
    if (age < 0) return;
    // Posponer (⏰): mientras no llegue la fecha elegida, no molestar. Al llegar,
    // el recordatorio reaparece AUNQUE el periodo de gracia normal ya haya pasado,
    // y se puede volver a posponer cuantas veces se quiera.
    const todayStr = _remFmt(T);
    const sn = (reminderConfig.snoozes || []).find(s => s.key === r.key && s.cycle === cycle);
    if (sn && todayStr < sn.until) return;
    const forced = !!(sn && todayStr >= sn.until);
    if (age > grace && !forced) return;
    if ((reminderConfig.skips || []).some(s => s.key === r.key && s.cycle === cycle)) return;
    if (_remAppliedSession.has(r.key + '|' + cycle)) return;
    if (_remAlreadyRegistered(r, expected, tol, T)) return;
    due.push({ ...r, expected, cycle });
  });

  due.sort((a,b) => (a.expected - b.expected) || (a.firstSeen - b.firstSeen));
  return due;
}

// ── TARJETA (UI): muestra uno a la vez ──
let _remCurrent = null;

function _remLabel(r){
  const nombre = `"${r.desc}"`;
  if (r.source === 'manual') {
    const cuando = r.freq === 'weekly' ? `cada semana los ${WEEKDAYS_ES[r.day]}` : `cada mes el día ${r.day}`;
    return { title: `Recordatorio: ${nombre}`, sub: `Lo programaste ${cuando}.` };
  }
  if (r.freq === 'weekly') {
    return { title: `Casi todos los ${WEEKDAYS_ES[r.day]} registras ${nombre}`,
             sub: r.type === 'ingreso' ? '¿Ya te llegó esta semana?' : '¿Quieres registrarlo esta semana?' };
  }
  return { title: `Cerca del día ${r.day} sueles registrar ${nombre}`,
           sub: r.type === 'ingreso' ? '¿Ya te llegó este mes?' : '¿Quieres registrarlo este mes?' };
}

function updateReminderCard(){
  const card = document.getElementById('rem-card');
  if (!card) return;
  let queue = [];
  try { queue = getDueReminders(); } catch(e){ queue = []; }

  if (queue.length === 0) {
    if (card.style.display !== 'none') {
      _remAnimateOut(card, () => { card.style.display = 'none'; _remCurrent = null; });
    }
    return;
  }
  const next = queue[0];
  const same = _remCurrent && _remCurrent.key === next.key && _remCurrent.cycle === next.cycle;
  if (same && card.style.display !== 'none') return; // ya se muestra este

  const fill = () => {
    _remCurrent = next;
    const lbl = _remLabel(next);
    const icoEl = document.getElementById('rem-ico');
    if (icoEl) icoEl.textContent = next.type === 'ingreso' ? '💰' : '🔔';
    const t = document.getElementById('rem-title'); if (t) t.textContent = lbl.title;
    const s = document.getElementById('rem-sub');   if (s) s.textContent = lbl.sub;
    const skipBtn = document.getElementById('rem-skip-btn');
    if (skipBtn) skipBtn.textContent = next.freq === 'weekly' ? 'Esta semana no' : 'Este mes no';
  };

  if (card.style.display === 'none') {
    fill();
    card.style.display = 'flex';
    _remAnimateIn(card);
  } else {
    _remAnimateOut(card, () => { fill(); _remAnimateIn(card); });
  }
}

function _remAnimateIn(el){
  try {
    el.animate(
      [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 420, easing: 'cubic-bezier(0.22,0.61,0.36,1)' }
    );
  } catch(e){}
}
function _remAnimateOut(el, done){
  try {
    const a = el.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }],
      { duration: 260, easing: 'ease' }
    );
    a.onfinish = done;
  } catch(e){ done(); }
}

// ── ACCIONES DE LA TARJETA ──
function remApply(){
  const r = _remCurrent;
  if (!r) return;
  _remAppliedSession.add(r.key + '|' + r.cycle);
  const card = document.getElementById('rem-card');
  if (card) _remAnimateOut(card, () => { card.style.display = 'none'; _remCurrent = null; });
  // Prerrellenar SOLO tipo + descripción: la predicción existente completa
  // categoría, subcategoría, método, moneda y (si aplica) el monto.
  try { setType(r.type); } catch(e){}
  const descEl = document.getElementById('desc');
  if (descEl) {
    descEl.value = r.desc;
    try { predictCategory(); } catch(e){}
  }
  const amt = document.getElementById('amount');
  if (amt) { try { amt.focus(); } catch(e){} }
}

// Posponer el recordatorio actual N días (1 = mañana, 7 = en una semana).
// Reemplaza cualquier snooze previo de ese patrón; extensible sin límite.
function remSnooze(days){
  const r = _remCurrent;
  if (!r) return;
  const T = parseDate(localToday());
  const until = new Date(T.getFullYear(), T.getMonth(), T.getDate() + (Number(days)||1));
  reminderConfig.snoozes = (reminderConfig.snoozes || []).filter(s => s.key !== r.key);
  reminderConfig.snoozes.push({ key: r.key, cycle: r.cycle, until: _remFmt(until) });
  if (reminderConfig.snoozes.length > 60) reminderConfig.snoozes = reminderConfig.snoozes.slice(-60);
  saveRemindersToSheets();
  const card = document.getElementById('rem-card');
  if (card) _remAnimateOut(card, () => { card.style.display = 'none'; _remCurrent = null; updateReminderCard(); });
}

function remSkip(){
  const r = _remCurrent;
  if (!r) return;
  reminderConfig.skips = (reminderConfig.skips || []).filter(s => !(s.key === r.key && s.cycle === r.cycle));
  reminderConfig.skips.push({ key: r.key, cycle: r.cycle });
  if (reminderConfig.skips.length > 60) reminderConfig.skips = reminderConfig.skips.slice(-60);
  saveRemindersToSheets();
  const card = document.getElementById('rem-card');
  if (card) _remAnimateOut(card, () => { card.style.display = 'none'; _remCurrent = null; updateReminderCard(); });
}

function remMute(){
  const r = _remCurrent;
  if (!r) return;
  if (!(reminderConfig.muted || []).includes(r.key)) reminderConfig.muted.push(r.key);
  // Si había una regla manual con esas condiciones, también se elimina
  reminderConfig.manual = (reminderConfig.manual || []).filter(m => _remKey(m.type, m.desc) !== r.key);
  saveRemindersToSheets();
  const card = document.getElementById('rem-card');
  if (card) _remAnimateOut(card, () => { card.style.display = 'none'; _remCurrent = null; updateReminderCard(); });
}

// ── RECORDATORIO MANUAL AL REGISTRAR (toggle 🔔 Recordar) ──
let _remToggleOn = false;
let _remFreq = 'monthly';
let _remUntilMode = 'inf';

function _remHintUpdate(){
  const hint = document.getElementById('rem-freq-hint');
  if (!hint) return;
  const dateStr = document.getElementById('tx-date')?.value || localToday();
  const d = parseDate(dateStr);
  hint.textContent = _remFreq === 'weekly'
    ? `Te recordaré los ${WEEKDAYS_ES[d.getDay()]} (según la fecha del registro).`
    : `Te recordaré el día ${d.getDate()} de cada mes (según la fecha del registro).`;
  const uh = document.getElementById('rem-until-hint');
  if (uh) {
    if (_remUntilMode === 'date') {
      const v = document.getElementById('rem-until-value')?.value;
      uh.textContent = v ? `Hasta el ${v}.` : 'Elige la fecha límite…';
    } else uh.textContent = '';
  }
}

function toggleRemPanel(){
  _remToggleOn = !_remToggleOn;
  const btn = document.getElementById('rem-toggle-btn');
  const panel = document.getElementById('rem-config');
  if (btn) btn.classList.toggle('active', _remToggleOn);
  if (panel) panel.style.display = _remToggleOn ? 'block' : 'none';
  if (_remToggleOn) { setRemFreq(_remFreq); setRemUntil(_remUntilMode); }
}

function setRemFreq(f){
  _remFreq = f;
  document.getElementById('rem-freq-monthly')?.classList.toggle('active', f === 'monthly');
  document.getElementById('rem-freq-weekly')?.classList.toggle('active', f === 'weekly');
  _remHintUpdate();
}

function setRemUntil(mode){
  _remUntilMode = mode;
  document.getElementById('rem-until-inf')?.classList.toggle('active', mode === 'inf');
  document.getElementById('rem-until-date')?.classList.toggle('active', mode === 'date');
  if (mode === 'date') {
    const cur = document.getElementById('rem-until-value')?.value;
    openDatepicker({
      initial: cur ? parseDate(cur) : null,
      min: parseDate(localToday()),
      presets: false,
      onPick: (d) => {
        const v = document.getElementById('rem-until-value');
        if (v) v.value = _remFmt(d);
        _remHintUpdate();
      }
    });
  }
  _remHintUpdate();
}

function resetRemToggle(){
  _remToggleOn = false; _remFreq = 'monthly'; _remUntilMode = 'inf';
  document.getElementById('rem-toggle-btn')?.classList.remove('active');
  const panel = document.getElementById('rem-config');
  if (panel) panel.style.display = 'none';
  const v = document.getElementById('rem-until-value');
  if (v) v.value = '';
}

// Ocultar el botón 🔔 para beneficios (no aplican recordatorios ahí)
function updateRemToggleVisibility(){
  const btn = document.getElementById('rem-toggle-btn');
  if (!btn) return;
  const hide = (typeof curType !== 'undefined' && curType === 'ahorro-pasivo');
  btn.style.display = hide ? 'none' : '';
  if (hide && _remToggleOn) resetRemToggle();
}

// Crear la regla manual a partir del registro recién guardado
function createManualReminderFromEntry(entry){
  if (!entry || !entry.desc) return;
  const d = parseDate(entry.date || localToday());
  const rule = {
    id: Date.now(),
    desc: String(entry.desc).trim(),
    type: entry.type,
    freq: _remFreq,
    day: _remFreq === 'weekly' ? d.getDay() : d.getDate(),
    until: (_remUntilMode === 'date' && document.getElementById('rem-until-value')?.value) || null,
    created: localToday()
  };
  const key = _remKey(rule.type, rule.desc);
  // Reemplazar regla previa del mismo comercio y reactivarlo si estaba silenciado
  reminderConfig.manual = (reminderConfig.manual || []).filter(m => _remKey(m.type, m.desc) !== key);
  reminderConfig.manual.push(rule);
  reminderConfig.muted = (reminderConfig.muted || []).filter(k => k !== key);
  saveRemindersToSheets();
}
