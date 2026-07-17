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
// Siempre se usan tras "los ...", por eso sábado y domingo van en plural
const WEEKDAYS_ES = ['domingos','lunes','martes','miércoles','jueves','viernes','sábados'];
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
  // R2: la escritura informa si la nube confirmó. El estado local ya quedó
  // guardado arriba, así que un fallo aquí nunca pierde la regla.
  const r = await _sheetsPost({ action: 'saveReminders', reminders: reminderConfig }, 'reminders save');
  if(r.ok) _remDirty = false;
  return r;
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

// R8.1 · Texto del chip de fecha límite: "Elegir" sin fecha; con fecha elegida,
// la fecha misma — DD/MM/AA en móvil (cabe en el chip) y DD/MM/AAAA en web.
function _remChipDateLbl(iso){
  if(!iso) return 'Elegir';
  const parts=String(iso).split('-');
  if(parts.length!==3) return 'Elegir';
  const [y,m,d]=parts;
  const movil = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  // R8.2 · Móvil: formato corto DD/MM/AA. Web: fecha larga "17 de agosto de 2026"
  // (hay espacio de sobra en la columna de escritorio).
  if(movil){ return `${d}/${m}/${y.slice(2)}`; }
  const mesNom=(typeof MONTHS_ES!=='undefined' && MONTHS_ES[parseInt(m,10)-1])
    ? MONTHS_ES[parseInt(m,10)-1].toLowerCase() : m;
  return `${parseInt(d,10)} de ${mesNom} de ${y}`;
}
// Al cruzar el corte móvil/web, reformatear la fecha de ambos chips
window.addEventListener('resize', ()=>{
  try{ _remPaintChips(); }catch(e){}
  try{ _eRemPaint(); }catch(e){}
});
function _remClampDom(y, m, day){ const last = new Date(y, m+1, 0).getDate(); return Math.min(day, last); }

// ── HELPERS DE REGLA (representación en historial, registro y edición) ──
// La regla manual de un comercio (o null si no existe o está silenciado).
function getManualRule(type, desc){
  const key = _remKey(type, desc);
  if ((reminderConfig.muted || []).includes(key)) return null;
  return (reminderConfig.manual || []).find(m => _remKey(m.type, m.desc) === key) || null;
}
// ¿Tiene regla ACTIVA (existe y no ha llegado su fecha fin)?
function hasActiveManualReminder(type, desc){
  const r = getManualRule(type, desc);
  if (!r) return false;
  return !r.until || r.until >= localToday();
}
function _remLongDate(iso){
  const d = parseDate(iso);
  const M = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d.getDate()} de ${M[d.getMonth()]} de ${d.getFullYear()}`;
}
// ── FECHA FINAL VÁLIDA DE UN RECORDATORIO ──
// La fecha final debe caer en un día de ciclo (si no, el último recordatorio se
// perdería). Semanal → solo ese día de la semana; mensual → solo ese día del mes
// (recortado en meses cortos). Y como mínimo, un ciclo completo hacia adelante.
function _remCycleAnchor(freq){
  // Día base: el de la fecha del registro que se está capturando/editando
  const ds = document.getElementById('tx-date')?.value
          || document.getElementById('e-date')?.value
          || localToday();
  return parseDate(ds);
}
function _remMinUntil(freq, anchor){
  const T = parseDate(localToday());
  const a = anchor || _remCycleAnchor(freq);
  if(freq==='weekly'){
    // El próximo día-de-semana del ancla que sea > hoy (al menos una semana)
    const wd = a.getDay();
    let d = new Date(T.getFullYear(), T.getMonth(), T.getDate());
    do { d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1); } while(d.getDay()!==wd);
    return d;
  }
  // Mensual: el mismo día del mes siguiente (recortado si el mes es corto)
  const dom = a.getDate();
  let y=T.getFullYear(), m=T.getMonth()+1;
  if(m>11){ m=0; y++; }
  let d=new Date(y, m, _remClampDom(y, m, dom));
  if(d<=T){ m++; if(m>11){ m=0; y++; } d=new Date(y, m, _remClampDom(y, m, dom)); }
  return d;
}
function _remAllowFn(freq, anchor){
  const a = anchor || _remCycleAnchor(freq);
  if(freq==='weekly'){
    const wd=a.getDay();
    return (d)=>d.getDay()===wd;
  }
  const dom=a.getDate();
  return (d)=>d.getDate()===_remClampDom(d.getFullYear(), d.getMonth(), dom);
}

function _remRuleLabel(r){
  return r.freq === 'weekly' ? `semanal · los ${WEEKDAYS_ES[r.day]}` : `mensual · el día ${r.day}`;
}

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
let _remToggleOn = false;   // (derivado: se mantiene por compatibilidad)
let _remFreq = null;        // 'monthly' | 'weekly' | null — SIN default: el usuario elige
let _remUntilMode = null;   // 'inf' | 'date' | null — SIN default: el usuario elige
let _remExistingRule = null; // regla activa que coincide con la descripción actual
let _remPanelVisible = false; // el tab Recordar está abierto (comparte espacio con Nota/Desglose)

// El recordatorio "contiene datos" SOLO si se cumplen ambas condiciones:
// frecuencia (mes/semana) + vigencia (indefinido/fecha con fecha elegida).
// Si no se cumplen, NO se guarda ninguna regla al registrar.
function remHasData(){
  if(!_remFreq || !_remUntilMode) return false;
  if(_remUntilMode==='date' && !(document.getElementById('rem-until-value')?.value)) return false;
  return true;
}


// Enciende el botón 🔔 como "Activo" cuando la descripción escrita coincide con
// una regla existente (y guarda una copia para prellenar el panel y preservar
// el día de la regla al actualizarla).
function updateRemToggleIndicator(){
  const btn = document.getElementById('rem-toggle-btn');
  if (!btn) return;
  const desc = (document.getElementById('desc')?.value || '').trim();
  const t = (typeof curType !== 'undefined') ? curType : 'egreso';
  let rule = null;
  if (desc.length >= 2 && t === 'egreso') {
    const r = getManualRule(t, desc);
    if (r && (!r.until || r.until >= localToday())) rule = r;
  }
  _remExistingRule = rule ? { ...rule } : null;
  // El estado visual del botón (tab activo / contiene datos) lo maneja
  // updateInlineBtn con la clase 'on', igual que Nota y Desglose. Aquí solo
  // se ajusta la etiqueta informativa.
  const lbl = btn.querySelectorAll('span')[1];
  if (lbl) lbl.textContent = (rule && !remHasData()) ? 'Activo' : 'Recordar';
  try{ updateNoteDesgloseIndicators(); }catch(e){}
}

function _remHintUpdate(){
  const hint=document.getElementById('rem-freq-hint');
  if(hint){
    if(!_remFreq){
      hint.textContent = _remExistingRule
        ? `Este comercio ya tiene recordatorio ${_remRuleLabel(_remExistingRule)}${_remExistingRule.until?` · hasta el ${_remExistingRule.until}`:' · indefinido'}. Si eliges opciones aquí, se actualizará al guardar.`
        : 'Elige la frecuencia para programarlo';
    } else {
      const dateStr=document.getElementById('tx-date')?.value||localToday();
      const d=parseDate(dateStr);
      const usaRegla=_remExistingRule && _remExistingRule.freq===_remFreq;
      const base=usaRegla
        ? (_remFreq==='weekly' ? `los ${WEEKDAYS_ES[_remExistingRule.day]}` : `el día ${_remExistingRule.day} de cada mes`)
        : (_remFreq==='weekly' ? `los ${WEEKDAYS_ES[d.getDay()]}` : `el día ${d.getDate()} de cada mes`);
      hint.textContent=usaRegla
        ? `Te recordaré ${base} — se actualizará el recordatorio existente al guardar`
        : `Te recordaré ${base}`;
    }
  }
  const uh=document.getElementById('rem-until-hint');
  if(uh){
    if(_remUntilMode==='date'){
      const v=document.getElementById('rem-until-value')?.value;
      uh.textContent=v?`Hasta el ${_remLongDate(v)}`:'Elige la fecha límite';
    } else if(_remUntilMode==='inf'){
      uh.textContent='Sin fecha de término';
    } else {
      uh.textContent='Elige la fecha límite';
    }
  }
}

function toggleRemPanel(){
  // Tercer TAB del renglón Nota/Desglose/Recordar. Re-taparlo SOLO lo cierra
  // (los datos elegidos se conservan y el botón muestra "contiene datos").
  const panel = document.getElementById('rem-config');
  const open = !_remPanelVisible;
  _remPanelVisible = open;
  if(panel) panel.style.display = open ? 'block' : 'none';
  if(open){
    try{ revealAnimate(panel); }catch(e){}
    // Recordar y Diferir se EXCLUYEN: abrir Recordar cancela el diferido
    try{
      if(typeof _diferirVisible!=='undefined' && (_diferirVisible || diferirHasData())){
        _diferirVisible=false;
        const dp=document.getElementById('diferir-panel'); if(dp) dp.style.display='none';
        diferirMonths=0; diferirCustom=false;
        const dc=document.getElementById('diferir-custom'); if(dc) dc.value='';
        if(typeof refreshTopTabsVisibility==='function') refreshTopTabsVisibility();
      }
    }catch(e){}
    // Mutuamente excluyente: cerrar Nota y Desglose (sus datos se conservan)
    try{
      if(typeof _noteVisible!=='undefined' && _noteVisible){
        _noteVisible=false;
        const w=document.getElementById('note-field-wrap'); if(w) w.style.display='none';
      }
    }catch(e){}
    try{
      if(typeof _desgloseVisible!=='undefined' && _desgloseVisible){
        _desgloseVisible=false;
        const s=document.getElementById('desglose-section'); if(s) s.style.display='none';
      }
    }catch(e){}
    _remPaintChips();
    _remHintUpdate();
  }
  try{ updateNoteDesgloseIndicators(); }catch(e){}
  updateRemToggleIndicator();
  // Bug 2: abrir/cerrar Recordar debe esconder/devolver el botón Diferir
  try{ refreshTopTabsVisibility(); }catch(e){}
}

// R8.3 · ✕ del módulo Recordar (registro): BORRA la selección y cierra el panel
// (antes la ✕ llamaba a esta función inexistente y no hacía nada). Espejo del
// patrón de las otras ✕ de módulo.
function clearRemModule(){
  _remFreq = null;
  _remUntilMode = null;
  const v=document.getElementById('rem-until-value'); if(v) v.value='';
  _remPanelVisible = false;
  const panel=document.getElementById('rem-config'); if(panel) panel.style.display='none';
  try{ _remPaintChips(); }catch(e){}
  try{ _remHintUpdate(); }catch(e){}
  try{ updateNoteDesgloseIndicators(); }catch(e){}
  updateRemToggleIndicator();
  try{ refreshTopTabsVisibility(); }catch(e){}
}

// Pinta el estado activo/inactivo de los 4 chips según la selección actual
function _remPaintChips(){
  document.getElementById('rem-freq-monthly')?.classList.toggle('active', _remFreq==='monthly');
  document.getElementById('rem-freq-weekly')?.classList.toggle('active', _remFreq==='weekly');
  document.getElementById('rem-until-inf')?.classList.toggle('active', _remUntilMode==='inf');
  document.getElementById('rem-until-date')?.classList.toggle('active', _remUntilMode==='date');
  // R8.1: el chip muestra la fecha elegida (o "Elegir" si aún no hay)
  const dc=document.getElementById('rem-until-date');
  if(dc) dc.textContent=_remChipDateLbl(_remUntilMode==='date' ? (document.getElementById('rem-until-value')?.value||'') : '');
}


function setRemFreq(f){
  // Tocar el chip activo lo DESELECCIONA (vuelve a null): sin ambas condiciones
  // elegidas, no se guarda ningún recordatorio.
  const prev=_remFreq;
  _remFreq = (_remFreq===f) ? null : f;
  // Al CAMBIAR de frecuencia, la fecha exacta elegida deja de ser válida (está
  // atada al ciclo: solo domingos, o solo el día 12) → se resetea. "Indefinido"
  // no depende del ciclo, así que sobrevive al cambio.
  if(prev!==_remFreq && _remUntilMode==='date'){
    _remUntilMode=null;
    const v=document.getElementById('rem-until-value'); if(v) v.value='';
  }
  _remPaintChips();
  _remHintUpdate();
  try{ updateNoteDesgloseIndicators(); }catch(e){}
  try{ refreshTopTabsVisibility(); }catch(e){}   // Bug 2
}

function setRemUntil(mode){
  if(_remUntilMode===mode){
    // Deseleccionar
    _remUntilMode=null;
    if(mode==='date'){ const v=document.getElementById('rem-until-value'); if(v) v.value=''; }
  } else {
    _remUntilMode=mode;
    if(mode==='date'){
      const cur=document.getElementById('rem-until-value')?.value;
      if(!_remFreq){
        // Sin frecuencia no hay ciclo que respetar: pedirla primero
        _remUntilMode=null;
        _remPaintChips();
        const h=document.getElementById('rem-freq-hint');
        if(h) h.textContent='Primero elige la frecuencia (semanal o mensual)';
        return;
      }
      const minD=_remMinUntil(_remFreq);
      openDatepicker({
        initial: cur ? parseDate(cur) : minD,   // llega preseleccionada
        min: minD,                               // al menos un ciclo completo
        allow: _remAllowFn(_remFreq),            // solo días de ciclo válidos
        presets: false,
        onPick: (d)=>{
          const v=document.getElementById('rem-until-value');
          if(v) v.value=_remFmt(d);
          _remPaintChips();   // R8.1: el chip pasa a mostrar la fecha
          _remHintUpdate();
          try{ updateNoteDesgloseIndicators(); }catch(e){}
          try{ refreshTopTabsVisibility(); }catch(e){}   // Bug 2
        }
      });
    }
  }
  _remPaintChips();
  _remHintUpdate();
  try{ updateNoteDesgloseIndicators(); }catch(e){}
  try{ refreshTopTabsVisibility(); }catch(e){}   // Bug 2
}

function resetRemToggle(){
  _remToggleOn=false; _remPanelVisible=false;
  _remFreq=null; _remUntilMode=null;
  const panel=document.getElementById('rem-config');
  if(panel) panel.style.display='none';
  const v=document.getElementById('rem-until-value');
  if(v) v.value='';
  _remExistingRule=null;
  _remPaintChips();
  const lbl=document.getElementById('rem-toggle-btn')?.querySelectorAll('span')[1];
  if(lbl) lbl.textContent='Recordar';
  try{ updateNoteDesgloseIndicators(); }catch(e){}
}

// Ocultar el botón 🔔 para beneficios (no aplican recordatorios ahí)
function updateRemToggleVisibility(){
  const btn = document.getElementById('rem-toggle-btn');
  if (!btn) return;
  // El recordatorio manual del formulario vive SOLO en egresos (para ingresos,
  // la detección automática de la tarjeta hace su trabajo). Y no coexiste con
  // Diferir: si el diferido está activo o ya tiene datos, 🔔 se oculta igual
  // que Desglose.
  const noEgreso = (typeof curType !== 'undefined' && curType !== 'egreso');
  const diferido = (typeof _diferirVisible !== 'undefined' && _diferirVisible)
                || (typeof diferirHasData === 'function' && diferirHasData());
  const hide = noEgreso || diferido;
  btn.style.display = hide ? 'none' : '';
  if (hide){
    resetRemToggle();
  }
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
    // Si ya existía regla con la MISMA frecuencia, conservar SU día (que
    // registrar el gas el 11 no mueva un recordatorio que vive el día 8).
    day: (_remExistingRule && _remExistingRule.freq === _remFreq)
      ? _remExistingRule.day
      : (_remFreq === 'weekly' ? d.getDay() : d.getDate()),
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


// ── REPRESENTACIÓN EN EL MODAL DE EDICIÓN ──
// Muestra el estado del recordatorio del comercio que se está editando:
//  · Regla ACTIVA: frecuencia, día y vigencia. Indefinido → puede ponerle fecha
//    fin; con fecha → puede cambiarla por OTRA fecha futura (nunca de regreso a
//    indefinido: esa asimetría es a propósito).
//  · Regla VENCIDA: "Los recordatorios pararon el ..." + crear la regla de nuevo
//    (renace indefinida, con la misma frecuencia y día; se le puede poner fecha
//    fin de inmediato).
// Las reglas nunca tocan los registros: editar aquí solo cambia la regla.
// El comercio "objetivo" del modal: en modo copia (o al renombrar) es lo que
// está ESCRITO en el campo, no lo guardado en el registro fuente.
function _eRemTarget(){
  const e = (typeof editId !== 'undefined' && editId != null)
    ? data.find(x => String(x.id) === String(editId)) : null;
  const type = (typeof editType !== 'undefined' && editType) ? editType : (e ? e.type : null);
  const typed = (document.getElementById('e-desc')?.value || '').trim();
  const desc = typed || (e ? (e.desc || '') : '');
  return { e, type, desc };
}

function eRemSectionRefresh(){ try{ if(_eRemPanelVisible) renderEditReminderSection(); }catch(e){} }

function renderEditReminderSection(){
  // Ahora la información vive DENTRO del panel del tab 🔔 (no desplegada suelta).
  const btn = document.getElementById('e-rem-toggle-btn');
  const box = document.getElementById('e-rem-existing');
  const editor = document.getElementById('e-rem-editor');
  const { e, type, desc } = _eRemTarget();

  // El botón 🔔 vive solo en egresos y no convive con diferidos. Bug 2: antes solo
  // miraba si el registro YA era diferido; ahora también cuenta el diferido que
  // acabas de activar en esta sesión de edición (panel abierto o meses elegidos).
  const enDiferido = !!(e && e.deferGroup)
                  || !!(typeof editDeferGroup!=='undefined' && editDeferGroup)
                  || (typeof _eDiferirVisible!=='undefined' && _eDiferirVisible)
                  || (typeof editDiferirHasData==='function' && editDiferirHasData());
  const oculto = (type !== 'egreso') || enDiferido;
  if (btn) btn.style.display = oculto ? 'none' : '';
  if (oculto){
    if (_eRemPanelVisible) toggleERemPanel();
    resetEditRemState();   // que no quede armado en la sombra
    try{ updateEditNoteDesgloseIndicators(); }catch(_e){}
    return;
  }
  if (!box || !editor) return;

  const rule = (desc.length >= 2) ? getManualRule(type, desc) : null;
  if (!rule){
    box.innerHTML = '';
    box.style.display = 'none';
    editor.style.display = 'block';
    _eRemPaint(); _eRemHint();
    try{ updateEditNoteDesgloseIndicators(); }catch(_e){}
    return;
  }

  // Con regla: se muestra su estado y las acciones (sin el editor de alta)
  const activa = !rule.until || rule.until >= localToday();
  if (activa){
    const vigencia = rule.until ? `hasta el ${_remLongDate(rule.until)}` : 'indefinido';
    box.innerHTML = `
      <div class="e-rem-box">
        <div class="e-rem-title">🔔 Recordatorio ${_remRuleLabel(rule)}</div>
        <div>Vigencia: ${vigencia}.</div>
        <button type="button" class="e-rem-link" onclick="editRemUntil()">${rule.until ? 'Cambiar fecha final' : 'Ponerle fecha final'}</button>
        <button type="button" class="e-rem-link" style="color:var(--danger)" onclick="removeRemFromEdit()">Quitar el recordatorio</button>
      </div>`;
  } else {
    box.innerHTML = `
      <div class="e-rem-box">
        <div class="e-rem-title">🔔 Recordatorio ${_remRuleLabel(rule)}</div>
        <div>Los recordatorios pararon el ${_remLongDate(rule.until)}.</div>
        <button type="button" class="e-rem-link" onclick="recreateRemFromEdit()">Crear el recordatorio de nuevo</button>
        <button type="button" class="e-rem-link" style="color:var(--danger)" onclick="removeRemFromEdit()">Quitar el recordatorio</button>
      </div>`;
  }
  box.style.display = 'block';
  editor.style.display = 'none';
  try{ updateEditNoteDesgloseIndicators(); }catch(_e){}
}

// Tab 🔔 del modal (comparte espacio con Nota y Desglose)
let _eRemPanelVisible = false;
function toggleERemPanel(){
  const panel = document.getElementById('e-rem-config');
  const open = !_eRemPanelVisible;
  _eRemPanelVisible = open;
  if (panel) panel.style.display = open ? 'block' : 'none';
  if (open){
    try{ revealAnimate(panel); }catch(e){}
    try{ if(typeof _eNoteVisible!=='undefined' && _eNoteVisible){ _eNoteVisible=false;
      const w=document.getElementById('e-note-field-wrap'); if(w) w.style.display='none'; } }catch(e){}
    try{ if(typeof _eDesgloseVisible!=='undefined' && _eDesgloseVisible){ _eDesgloseVisible=false;
      const s=document.getElementById('e-desglose-section'); if(s) s.style.display='none'; } }catch(e){}
    renderEditReminderSection();
  }
  try{ updateEditNoteDesgloseIndicators(); }catch(e){}
  try{ refreshEditTopTabs(); }catch(e){}   // Bug 2: esconder/devolver Diferir
}

// R8.3 · ✕ del módulo Recordar (edición): espejo de clearRemModule.
function clearEditRemModule(){
  _eRemFreq = null;
  _eRemUntilMode = null;
  const v=document.getElementById('e-rem-until-value'); if(v) v.value='';
  _eRemPanelVisible = false;
  const panel=document.getElementById('e-rem-config'); if(panel) panel.style.display='none';
  try{ _eRemPaint(); }catch(e){}
  try{ updateEditNoteDesgloseIndicators(); }catch(e){}
  try{ refreshEditTopTabs(); }catch(e){}
}

// Quitar por completo el recordatorio vigente (o vencido) de este comercio
function removeRemFromEdit(){
  const { type, desc } = _eRemTarget();
  if (!type || !desc) return;
  const key = _remKey(type, desc);
  reminderConfig.manual = (reminderConfig.manual || []).filter(m => _remKey(m.type, m.desc) !== key);
  reminderConfig.snoozes = (reminderConfig.snoozes || []).filter(s => s.key !== key);
  saveRemindersToSheets().then(r=>{
    // R2: solo se afirma el éxito si la nube lo confirmó
    try{
      if(r && r.ok) toast('✓ Recordatorio quitado');
      else toast('⚠️ Recordatorio quitado en el teléfono, pero no se sincronizó');
    }catch(e){}
  });
  resetEditRemState();
  renderEditReminderSection();
  try{ updateReminderCard(); }catch(e){}
  try{ renderHistorial(); }catch(e){}
}

// Poner o cambiar la fecha fin (solo fechas futuras; sin camino de vuelta a indefinido)
function editRemUntil(){
  const { type, desc } = _eRemTarget();
  const rule = getManualRule(type, desc);
  if (!rule) return;
  openDatepicker({
    initial: rule.until ? parseDate(rule.until) : null,
    min: parseDate(localToday()),
    presets: false,
    onPick: (d) => {
      rule.until = _remFmt(d);   // referencia viva dentro de reminderConfig.manual
      saveRemindersToSheets();
      renderEditReminderSection();
      try { updateReminderCard(); } catch(err){}
    }
  });
}

// Recrear una regla vencida: renace indefinida, misma frecuencia y día
function recreateRemFromEdit(){
  const { e, type, desc } = _eRemTarget();
  if (!type || !desc) return;
  const key = _remKey(type, desc);
  const old = (reminderConfig.manual || []).find(m => _remKey(m.type, m.desc) === key) || null;
  const freq = old ? old.freq : 'monthly';
  const day  = old ? old.day  : parseDate((e && e.date) || localToday()).getDate();
  reminderConfig.manual = (reminderConfig.manual || []).filter(m => _remKey(m.type, m.desc) !== key);
  reminderConfig.manual.push({ id: Date.now(), desc: desc, type: type,
                               freq, day, until: null, created: localToday() });
  reminderConfig.muted = (reminderConfig.muted || []).filter(k => k !== key);
  saveRemindersToSheets();
  renderEditReminderSection();
  try { updateReminderCard(); } catch(err){}
}


// ── Creador de recordatorio DENTRO del modal (edición y copia) ──
let _eRemFreq = null;
let _eRemUntilMode = null;

function resetEditRemState(){ _eRemFreq=null; _eRemUntilMode=null; }

// ¿El panel 🔔 del modal tiene datos que se guardarán? (solo cuando el comercio
// NO tiene regla y se eligieron ambas condiciones)
function eRemHasData(){
  if(!_eRemFreq || !_eRemUntilMode) return false;
  if(_eRemUntilMode==='date' && !(document.getElementById('e-rem-until-value')?.value)) return false;
  return true;
}

function _eRemPaint(){
  document.getElementById('e-rem-freq-monthly')?.classList.toggle('active', _eRemFreq==='monthly');
  document.getElementById('e-rem-freq-weekly')?.classList.toggle('active', _eRemFreq==='weekly');
  document.getElementById('e-rem-until-inf')?.classList.toggle('active', _eRemUntilMode==='inf');
  document.getElementById('e-rem-until-date')?.classList.toggle('active', _eRemUntilMode==='date');
  // R8.1: el chip muestra la fecha elegida (o "Elegir" si aún no hay)
  const dc=document.getElementById('e-rem-until-date');
  if(dc) dc.textContent=_remChipDateLbl(_eRemUntilMode==='date' ? (document.getElementById('e-rem-until-value')?.value||'') : '');
}

function _eRemHint(){
  const hf=document.getElementById('e-rem-freq-hint');
  if(hf){
    if(!_eRemFreq){ hf.textContent='Elige la frecuencia para programarlo'; }
    else {
      const a=parseDate(document.getElementById('e-date')?.value || localToday());
      hf.textContent = (_eRemFreq==='weekly')
        ? `Te recordaré los ${WEEKDAYS_ES[a.getDay()]}`
        : `Te recordaré el día ${a.getDate()} de cada mes`;
    }
  }
  const hu=document.getElementById('e-rem-until-hint');
  if(hu){
    if(_eRemUntilMode==='date'){
      const v=document.getElementById('e-rem-until-value')?.value;
      hu.textContent=v?`Hasta el ${_remLongDate(v)}`:'Elige la fecha límite';
    } else if(_eRemUntilMode==='inf'){
      hu.textContent='Sin fecha de término';
    } else {
      hu.textContent='Elige la fecha límite';
    }
  }
}

function eSetRemFreq(f){
  const prev=_eRemFreq;
  _eRemFreq=(_eRemFreq===f)?null:f;   // retap deselecciona
  // Cambiar de frecuencia invalida la fecha exacta (atada al ciclo); "Indefinido" no
  if(prev!==_eRemFreq && _eRemUntilMode==='date'){
    _eRemUntilMode=null;
    const v=document.getElementById('e-rem-until-value'); if(v) v.value='';
  }
  _eRemPaint(); _eRemHint();
  try{ refreshEditTopTabs(); }catch(e){}   // Bug 2
}

function eSetRemUntil(mode){
  if(_eRemUntilMode===mode){
    _eRemUntilMode=null;
    if(mode==='date'){ const v=document.getElementById('e-rem-until-value'); if(v) v.value=''; }
  } else {
    _eRemUntilMode=mode;
    if(mode==='date'){
      if(!_eRemFreq){
        _eRemUntilMode=null;
        _eRemPaint();
        const h=document.getElementById('e-rem-freq-hint');
        if(h) h.textContent='Primero elige la frecuencia (semanal o mensual)';
        return;
      }
      const cur=document.getElementById('e-rem-until-value')?.value;
      const anchor=parseDate(document.getElementById('e-date')?.value || localToday());
      const minD=_remMinUntil(_eRemFreq, anchor);
      openDatepicker({
        initial: cur?parseDate(cur):minD,
        min: minD,
        allow: _remAllowFn(_eRemFreq, anchor),
        presets:false,
        onPick:(d)=>{
          const v=document.getElementById('e-rem-until-value');
          if(v) v.value=_remFmt(d);
          _eRemPaint();   // R8.1: el chip pasa a mostrar la fecha
          _eRemHint();
          try{ refreshEditTopTabs(); }catch(e){}   // Bug 2
        }
      });
    }
  }
  _eRemPaint(); _eRemHint();
  try{ refreshEditTopTabs(); }catch(e){}   // Bug 2
}

// Crear la regla al GUARDAR la edición/copia (llamado desde saveEdit)
function createManualReminderFromEditModal(desc, type, dateStr){
  if(!desc || type!=='egreso' || !eRemHasData()) return;
  const d=parseDate(dateStr||localToday());
  const rule={
    id: Date.now(),
    desc: String(desc).trim(),
    type: type,
    freq: _eRemFreq,
    day: _eRemFreq==='weekly' ? d.getDay() : d.getDate(),
    until: (_eRemUntilMode==='date' && document.getElementById('e-rem-until-value')?.value) || null,
    created: localToday()
  };
  const key=_remKey(rule.type, rule.desc);
  reminderConfig.manual=(reminderConfig.manual||[]).filter(m=>_remKey(m.type,m.desc)!==key);
  reminderConfig.manual.push(rule);
  reminderConfig.muted=(reminderConfig.muted||[]).filter(k=>k!==key);
  saveRemindersToSheets();
  resetEditRemState();
}


// ── PREDICCIÓN PARA DESGLOSES CON NOMBRE PROPIO ──
// Reutiliza la misma regla que el formulario: entre registros del mismo tipo con
// descripción similar (últimos 365 días, ponderados por recencia), la
// combinación categoría+subcategoría más frecuente. Devuelve null si no hay
// historia suficiente (entonces no se toca lo que el usuario ya eligió).
function predictCatForDesc(descRaw, type){
  const desc=String(descRaw||'').trim().toLowerCase();
  if(desc.length<3) return null;
  const freq={};
  data.forEach(e=>{
    if(e.type!==type) return;
    const d=(e.desc||'').toLowerCase();
    if(d.length<2) return;
    if(!(d.includes(desc) || desc.includes(d))) return;
    const w=(typeof recencyWeight==='function')?recencyWeight(e.date):1;
    if(!w) return;
    const key=(e.category||'')+'||'+(e.subcategory||'');
    freq[key]=(freq[key]||0)+w;
  });
  const entries=Object.entries(freq);
  if(entries.length===0) return null;
  const [bestKey]=entries.sort((a,b)=>b[1]-a[1])[0];
  const sep=bestKey.indexOf('||');
  const cat=bestKey.substring(0,sep);
  if(!cat) return null;
  return { category:cat, subcategory:bestKey.substring(sep+2) };
}


// ── PREDICCIÓN DE MONTO PARA DESGLOSES CON NOMBRE PROPIO ──
// Misma regla que el formulario: entre los últimos 4 registros de ese comercio
// (mismo tipo y misma moneda, sin contar mensualidades de diferidos), si un monto
// exacto se repite al menos 2 veces y en al menos la mitad de ellos, se predice.
// En empate gana el más reciente. Devuelve null si no hay evidencia suficiente.
function predictAmountForDesc(descRaw, type, cur){
  const desc=String(descRaw||'').trim().toLowerCase();
  if(desc.length<3) return null;
  const pool=data
    .filter(e=>e.type===type)
    .filter(e=>{
      const d=(e.desc||'').trim().toLowerCase();
      return d.length>=2 && (d.includes(desc) || desc.includes(d));
    })
    .filter(e=>!e.deferGroup)
    .filter(e=>(e.currency||'MXN')===(cur||'MXN'))
    .sort((a,b)=>parseDate(b.date)-parseDate(a.date))
    .slice(0,4);
  if(pool.length<2) return null;
  const counts={};
  pool.forEach(e=>{ const k=String(Number(e.amount)); counts[k]=(counts[k]||0)+1; });
  let best=null, bestCount=0;
  pool.forEach(e=>{   // del más reciente al más viejo: en empate gana el reciente
    const k=String(Number(e.amount));
    if(counts[k]>bestCount){ best=k; bestCount=counts[k]; }
  });
  if(best!==null && bestCount>=2 && bestCount>=Math.ceil(pool.length/2)) return Number(best);
  return null;
}


// ── PREDICCIÓN DE NOTAS ──
// Caso típico: pides Kenchy's por Uber Eats. La descripción es el restaurante y
// la nota ("Uber Eats") queda buscable. Si esa nota se repite, se autocompleta.
// Misma regla que el monto: entre los últimos 4 registros de ese comercio (mismo
// tipo, sin mensualidades de diferidos), una nota exacta que aparezca al menos
// 2 veces y en al menos la mitad de ellos. En empate gana la más reciente.
// Deja solo la nota real del usuario. R6: delega en la capa metaOf (01_nucleo).
function cleanUserNote(note){ return cleanNoteStr(note); }

function predictNoteForDesc(descRaw, type){
  const desc=String(descRaw||'').trim().toLowerCase();
  if(desc.length<3) return null;
  const pool=data
    .filter(e=>e.type===type)
    .filter(e=>{
      const d=(e.desc||'').trim().toLowerCase();
      return d.length>=2 && (d.includes(desc) || desc.includes(d));
    })
    .filter(e=>!e.deferGroup)
    .sort((a,b)=>parseDate(b.date)-parseDate(a.date))
    .slice(0,4);
  if(pool.length<2) return null;
  const counts={}, display={};
  pool.forEach(e=>{
    const n=cleanUserNote(e.note);
    if(!n) return;
    const k=n.toLowerCase();
    counts[k]=(counts[k]||0)+1;
    if(!display[k]) display[k]=n;   // pool va de reciente a viejo: gana el más nuevo
  });
  let best=null, bestCount=0;
  pool.forEach(e=>{
    const k=cleanUserNote(e.note).toLowerCase();
    if(!k) return;
    if(counts[k]>bestCount){ best=k; bestCount=counts[k]; }
  });
  if(best && bestCount>=2 && bestCount>=Math.ceil(pool.length/2)) return display[best];
  return null;
}
