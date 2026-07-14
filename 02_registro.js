// ════════════════════════════════════════════
// FORMULARIO DE REGISTRO
// ════════════════════════════════════════════

function init() {
  const now = new Date();
  document.getElementById('hdr-date').textContent =
    now.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const todayISO = localToday();
  document.getElementById('tx-date').value = todayISO;
  initStrip('tx-date-strip', todayISO);
  populateSelectors();
  setType('egreso');
  fetchRates();
  // Render immediately from cache, then refresh from Sheets
  renderBalance();
  renderHistorial();
  loadFromSheets();
}

async function fetchRates() {
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/MXN');
    const j = await r.json();
    if (j.rates) {
      rates.USD = +(1/j.rates.USD).toFixed(4);
      rates.CAD = +(1/j.rates.CAD).toFixed(4);
      rates.EUR = +(1/j.rates.EUR).toFixed(4);
      ratesLoaded = true; onCurChange();
    }
  } catch(e){}
}

// Estado de visibilidad de los paneles Nota / Desglose
let _noteVisible=false;
let _desgloseVisible=false;

function noteHasData(){
  const el=document.getElementById('note');
  return !!(el && el.value.trim().length>0);
}
function desgloseHasData(){
  return desgloses.some(d=>d.amount>0);
}

// Actualiza el indicador "tiene contenido" en los botones Nota / Desglose
function updateNoteDesgloseIndicators(){
  updateInlineBtn('note-toggle-btn', _noteVisible, noteHasData());
  updateInlineBtn('desglose-toggle-btn', _desgloseVisible, desgloseHasData());
  // Tercer tab: 🔔 Recordar (activo = panel abierto; con-datos = armado pero en otro tab)
  try{
    updateInlineBtn('rem-toggle-btn',
      typeof _remPanelVisible!=='undefined' && _remPanelVisible,
      typeof remHasData==='function' && remHasData() && !_remPanelVisible);
  }catch(e){}
}

// Decide el modo de la nota:
//  - MODO DIRECTO: cuando la nota va sola (ingreso, beneficio o egreso diferido).
//    El textarea se muestra directamente, sin botón toggle.
//  - MODO TOGGLE: cuando conviven Nota y Desglose (egreso normal). Botones toggle.
// Poblar el selector "¿en qué mensualidad se te acreditó?" del beneficio.
// Solo aparece cuando el gasto es diferido (en gastos normales no aplica).
function updateBenMonthSelector(){
  const row=document.getElementById('ben-month-row');
  const sel=document.getElementById('ben-month');
  if(!row || !sel) return;
  const n=(typeof diferirHasData==='function' && diferirHasData()) ? diferirMonths : 0;
  if(!n || n<2){ row.style.display='none'; return; }
  // R5: "¿en qué mensualidad se acreditó?" SOLO tiene sentido para beneficios
  // tipo crédito recibido (Cashback) — un descuento aplicado ya redujo el total
  // ANTES de prorratear, así que no se "acredita" en un mes en particular.
  if(!curBenType || (typeof benReduceGasto==='function' && benReduceGasto(curBenType))){
    row.style.display='none'; return;
  }
  const prev=sel.value;
  sel.innerHTML='';
  for(let i=1;i<=n;i++){
    const o=document.createElement('option');
    o.value=String(i);
    o.textContent=`Mensualidad ${i} de ${n}`;
    sel.appendChild(o);
  }
  sel.value=(prev && Number(prev)>=1 && Number(prev)<=n) ? prev : '1';
  row.style.display='block';
}

function updateNoteMode(){
  // El botón 🔔 Recordar sigue las mismas reglas de visibilidad (se oculta con
  // diferido activo/con datos, y en tipos que no son egreso)
  try{ if(typeof updateRemToggleVisibility==='function') updateRemToggleVisibility(); }catch(e){}
  try{ if(typeof updateDesgloseButtonForDiferir==='function') updateDesgloseButtonForDiferir(); }catch(e){}
  const row=document.getElementById('note-desglose-row');
  const noteBtn=document.getElementById('note-toggle-btn');
  const wrap=document.getElementById('note-field-wrap');
  if(!row || !noteBtn || !wrap) return;
  // Con diferido activo, la Nota sigue siendo un TAB (para que Desglose y
  // Recordar puedan convivir); solo en ingresos/beneficios va directa.
  const noteDirecto = (curType!=='egreso');
  if(noteDirecto){
    // El botón Nota deja de ser toggle: se oculta y el textarea queda directo.
    noteBtn.style.display='none';
    wrap.style.display='block';
    wrap.style.marginTop='0';
    _noteVisible=true;
  } else {
    // Egreso normal: el botón Nota vuelve a ser toggle
    noteBtn.style.display='';
    wrap.style.marginTop='10px';
    // Si el usuario no lo había abierto y no hay contenido, ocultar el textarea
    if(!_noteVisible && !noteHasData()){
      wrap.style.display='none';
    }
  }
}

function toggleNoteField(forceOpen){
  const wrap=document.getElementById('note-field-wrap');
  if(!wrap) return;
  const isManual = forceOpen===undefined;
  const open = isManual ? !_noteVisible : forceOpen;
  _noteVisible=open;
  wrap.style.display=open?'block':'none';
  if(open){
    revealAnimate(wrap);
    // Mutuamente excluyente (solo en clic manual): cerrar Desglose si estaba abierto
    if(isManual && _desgloseVisible){
      _desgloseVisible=false;
      const dsec=document.getElementById('desglose-section');
      if(dsec) dsec.style.display='none';
    }
      if(isManual && typeof _remPanelVisible!=='undefined' && _remPanelVisible){
        _remPanelVisible=false;
        const rc=document.getElementById('rem-config');
        if(rc) rc.style.display='none';
      }
  }
  updateNoteDesgloseIndicators();
}

function toggleDesgloseSection(forceOpen){
  const sec=document.getElementById('desglose-section');
  if(!sec) return;
  const isManual = forceOpen===undefined;
  const open = isManual ? !_desgloseVisible : forceOpen;
  _desgloseVisible=open;
  sec.style.display=open?'block':'none';
  if(open){
    revealAnimate(sec);
    // Mutuamente excluyente (solo en clic manual): cerrar Nota si estaba abierta
    if(isManual && _noteVisible){
      _noteVisible=false;
      const nwrap=document.getElementById('note-field-wrap');
      if(nwrap) nwrap.style.display='none';
    }
      if(isManual && typeof _remPanelVisible!=='undefined' && _remPanelVisible){
        _remPanelVisible=false;
        const rc=document.getElementById('rem-config');
        if(rc) rc.style.display='none';
      }
    // Si no hay ningún desglose aún, agregar uno automáticamente para agilizar
    if(desgloses.length===0) addDesglose();
  }
  updateNoteDesgloseIndicators();
}

function onCurChange() {
  if(typeof _applyingPrediction!=='undefined' && !_applyingPrediction){ _curPredicted=false; }
  // Cambiar de moneda invalida el TC manual escrito para la anterior
  const _fx=document.getElementById('fx-manual');
  if(_fx) _fx.value='';
  _fxOverride=null;
  try{ updateFxRow(); }catch(e){}
  const cur = document.getElementById('currency').value;
  const badge = document.getElementById('rate-note');
  // R6.6: el TC ya NO se inyecta en la nota. Antes, al cambiar de moneda, esto
  // escribía "TC: 1 CAD = $12.60 MXN" DENTRO del textarea del usuario (y le abría
  // el panel de Nota a la fuerza). Esa etiqueta viajaba tal cual a la columna Nota
  // del Sheet — justo lo que R6 vino a eliminar. El TC ya vive donde debe: se
  // deriva de amountMXN/amount, y el manual se guarda en meta.fxAuto.
  if(cur==='MXN'){ if(badge) badge.style.display='none'; return; }
  if(badge) badge.style.display='flex';
  const r = rates[cur]||1;
  const rateStr = `TC: 1 ${cur} = $${r.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} MXN${ratesLoaded?'':' (est.)'}`;
  document.getElementById('rate-text').textContent = rateStr;
  calcBenPreview();
  calcPropinaPreview();
  if(typeof renderDesgloses==='function' && desgloses.length>0) renderDesgloses();
  // Si cambia la moneda, refrescar las tarjetas de desglose (etiqueta USD/MXN)
  try{ if(typeof renderDesgloses==='function' && desgloses.length>0) renderDesgloses(false); }catch(e){}
}

function calcBenPreview(){
  const calcEl=document.getElementById('ben-calc');
  if(!calcEl) return;
  const cur=document.getElementById('currency').value;
  const sym=cur==='MXN'?'$':`${cur} `;

  if(benType==='monto'){
    // Monto directo: solo mostrar conversión a MXN si aplica
    const benVal=parseFloat(rawAmount(document.getElementById('ben-amount').value))||0;
    if(cur!=='MXN' && benVal>0){
      const mxn=toMXN(benVal,cur);
      calcEl.textContent=`= $${mxn.toFixed(2)} MXN`;
    } else {
      calcEl.textContent='';
    }
    return;
  }

  // Modo porcentaje — siempre directo sobre el monto
  const pct=parseFloat(document.getElementById('ben-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  if(pct>0 && amount>0){
    const benAmt = amount * pct / 100;
    calcEl.textContent=`= ${sym}${benAmt.toFixed(2)}`;
  } else {
    calcEl.textContent='';
  }
}
// ── TIPO DE CAMBIO MANUAL ──
// Si el usuario escribe un TC, ese manda sobre el automático. Vale para el
// registro madre y TODO lo ligado (propina, beneficio, desgloses, mensualidades
// del diferido), porque todas las conversiones pasan por aquí.
let _fxOverride = null;       // TC manual en el formulario de registro
let _fxOverrideEdit = null;   // TC manual en el modal de edición

function toMXN(a,c){
  if(c==='MXN') return a;
  const r = (_fxOverride && _fxOverride>0) ? _fxOverride : (rates[c]||1);
  return +(a*r).toFixed(2);
}

// ── TIPO DE CAMBIO HISTÓRICO (para EDICIONES) ──
// El TC implícito con el que se guardó originalmente un registro es
// amountMXN / amount. Al editar un registro en moneda extranjera, cualquier
// recálculo (monto, propina, beneficio, desgloses, diferido) debe respetar
// ESE tipo de cambio del pasado, no el del día. Si en la edición se cambia
// la moneda (caso raro), no existe TC histórico para la nueva y se usa el actual.
function fxRateForEdit(orig, cur){
  if(cur==='MXN') return 1;
  if(orig && orig.currency===cur){
    const a=Number(orig.amount), m=Number(orig.amountMXN);
    if(a>0 && m>0) return m/a;
  }
  return rates[cur]||1;
}
function toMXNEdit(a, cur, orig){
  if(cur==='MXN') return a;
  const r = (_fxOverrideEdit && _fxOverrideEdit>0) ? _fxOverrideEdit : fxRateForEdit(orig,cur);
  return +(a*r).toFixed(2);
}
function rateNoteEdit(cur, orig){
  if(cur==='MXN') return '';
  const r=(_fxOverrideEdit && _fxOverrideEdit>0) ? _fxOverrideEdit : fxRateForEdit(orig, cur);
  return `TC: 1 ${cur} = $${r.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} MXN`;
}

function rateNote(c){
  if(c==='MXN') return '';
  const r=(_fxOverride && _fxOverride>0) ? _fxOverride : rates[c];
  if(!r) return '';
  return `TC: 1 ${c} = $${r.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} MXN${ratesLoaded?'':' (est.)'}`;
}

function goNav(id, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const page=document.getElementById('page-'+id);
  page.classList.add('active');
  btn.classList.add('active');
  if(id==='registro'){ try{ updateReminderCard(); }catch(e){} }
  // El botón "ir arriba" solo vive en Historial: refrescar su visibilidad
  try{ if(typeof updateScrollTopBtn==='function') updateScrollTopBtn(); }catch(e){}

  // Render inmediato desde cache CON animación, luego refresco silencioso desde Sheets
  if(id==='balance'){
    renderBalance();
    const grid=document.getElementById('bal-stats-grid');
    if(grid) revealAnimate(grid, true);
    loadFromSheets(true); // refresco silencioso (sin re-animar)
  } else if(id==='historial'){
    // Al entrar a historial, partir siempre de la vista por meses (sin rango
    // activo y sin modo campanita)
    try{ if(typeof histBellMode!=='undefined' && histBellMode) setBellMode(false); }catch(e){}
    if(histRangeMode){
      histRangeMode=false; histRangeApplied=false;
      stopRangeBreathe();
      restoreSearchPosition();
      const rangeRow=document.getElementById('hist-range-row');
      const monthRow=document.getElementById('hist-date-row');
      if(rangeRow) rangeRow.style.display='none';
      if(monthRow) monthRow.style.display='flex';
      resetHistFiltersToTodos();
    }
    renderHistorial(true); // render con animación desde cache
    loadFromSheets(true);  // refresco silencioso (sin re-animar)
  } else if(id==='presupuesto'){
    populateSelectors(); renderBudget();
  }
}

// Aplica la animación de despliegue estilo apple.com a un elemento.
function revealAnimate(el, stagger){
  if(!el) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(typeof el.animate !== 'function') return;

  const easing='cubic-bezier(0.22, 0.61, 0.36, 1)';
  const from={ opacity: 0, transform: 'translate3d(0, -24px, 0)' };
  const to={ opacity: 1, transform: 'translate3d(0, 0, 0)' };

  if(stagger){
    const kids=Array.from(el.children);
    kids.forEach((k, i)=>{
      const delay=Math.min(i, 14) * 65;
      try { k.animate([from, to], { duration: 600, delay, easing, fill: 'backwards' }); } catch(e){}
    });
  } else {
    try { el.animate([from, to], { duration: 700, easing, fill: 'backwards' }); } catch(e){}
  }
}

// Anima los hijos de un grid de N columnas escalonando por COLUMNA:
// primero la columna izquierda (de arriba a abajo), luego la siguiente.
function revealGridByColumns(container, cols){
  if(!container) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const easing='cubic-bezier(0.22, 0.61, 0.36, 1)';
  const from={ opacity: 0, transform: 'translate3d(0, -24px, 0)' };
  const to={ opacity: 1, transform: 'translate3d(0, 0, 0)' };

  const kids=Array.from(container.children);
  const rows=Math.ceil(kids.length/cols);
  kids.forEach((k, i)=>{
    const col = i % cols;
    const row = Math.floor(i / cols);
    const orderIdx = col * rows + row;
    const delay = orderIdx * 55;
    try { k.animate([from, to], { duration: 550, delay, easing, fill: 'backwards' }); } catch(e){}
  });
}

// Anima la SALIDA de los hijos de un grid en orden INVERSO (última columna primero,
// de abajo hacia arriba), luego ejecuta el callback (que reconstruye el UI).
function collapseGridReverse(container, cols, done){
  if(!container){ if(done) done(); return; }
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const kids=Array.from(container.children);
  if(reduced || kids.length===0){ if(done) done(); return; }

  const easing='cubic-bezier(0.55, 0, 0.67, 0.2)';
  const from={ opacity: 1, transform: 'translate3d(0, 0, 0)' };
  const to={ opacity: 0, transform: 'translate3d(0, -16px, 0)' };
  const rows=Math.ceil(kids.length/cols);
  const total=kids.length;
  let maxDelay=0;

  kids.forEach((k, i)=>{
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Orden normal de aparición: col*rows+row. Invertimos para la salida.
    const orderIdx = col * rows + row;
    const reverseIdx = (total - 1) - orderIdx;
    const delay = reverseIdx * 40;
    maxDelay = Math.max(maxDelay, delay);
    try {
      const anim=k.animate([from, to], { duration: 260, delay, easing, fill: 'forwards' });
    } catch(e){}
  });

  // Ejecutar el callback cuando termine la última animación de salida
  setTimeout(()=>{ if(done) done(); }, maxDelay + 260);
}

function setType(t) {
  curType=t; curCat=''; curSubcat='';
  // Segmented control: mover thumb y actualizar estado activo
  const seg=document.getElementById('type-seg');
  const thumb=document.getElementById('seg-thumb');
  if(seg){
    seg.setAttribute('data-active', t);
    const order={egreso:0, ingreso:1, 'beneficio':2};
    const idx=order[t] !== undefined ? order[t] : 0;
    if(thumb) thumb.style.transform=`translateX(${idx*100}%)`;
    seg.querySelectorAll('.seg-option').forEach(b=>{
      b.classList.toggle('active', b.dataset.t===t);
    });
  }
  // Compatibilidad con botones viejos (por si quedan referencias)
  document.querySelectorAll('.type-btn').forEach(b=>{
    b.classList.remove('active');
    if(b.dataset.t===t) b.classList.add('active');
  });
  const ahorroBtn=document.getElementById('type-btn-ahorro');
  if(ahorroBtn){
    if(t==='ahorro'||t==='beneficio') ahorroBtn.classList.add('active');
    else ahorroBtn.classList.remove('active');
  }
  const subToggle=document.getElementById('ahorro-sub-toggle');
  if(subToggle) subToggle.style.display='none'; // Oculto: solo se usa ahorro pasivo
  // Show/hide inline toggles (propina + beneficio)
  const inlineToggles=document.getElementById('inline-toggles');
  if(inlineToggles) inlineToggles.style.display=t==='egreso'?'block':'none';
  if(t!=='egreso'){
    // Hide panels if switching away
    const pp=document.getElementById('propina-panel');
    const bp=document.getElementById('ben-panel');
    if(pp) pp.style.display='none';
    if(bp) bp.style.display='none';
    propinaOn=false; benOn=false;
    // Reset Diferir (solo aplica a egresos)
    diferirMonths=0; diferirCustom=false; _diferirVisible=false;
    const dp=document.getElementById('diferir-panel');
    if(dp) dp.style.display='none';
    const dc=document.getElementById('diferir-custom');
    if(dc) dc.value='';
    updateInlineBtn('inline-diferir-btn', false, false);
    // Restaurar el crossfade
    const drow=document.getElementById('inline-row-main');
    const dfull=document.getElementById('inline-diferir-full');
    if(drow){ drow.getAnimations().forEach(a=>a.cancel()); drow.style.opacity=''; drow.style.pointerEvents=''; }
    if(dfull){ dfull.getAnimations().forEach(a=>a.cancel()); dfull.style.opacity='0'; dfull.style.transform=''; dfull.style.pointerEvents='none'; }
    // Restaurar Propina/Beneficio por si Diferir los había ocultado
    const pbn=document.getElementById('inline-propina-btn'); if(pbn){ pbn.style.display=''; pbn.style.opacity=''; }
    const bbn=document.getElementById('inline-ben-btn'); if(bbn){ bbn.style.display=''; bbn.style.opacity=''; }
    _propinaVisible=false; _benVisible=false;
    updateInlineBtn('inline-propina-btn', false, false);
    updateInlineBtn('inline-ben-btn', false, false);
    resetPropina();
  }
  buildCatBlocks();
  // Reset method — Crédito active by default for egreso, none for others
  document.querySelectorAll('#method-field .chip').forEach(c=>c.classList.remove('active'));
  if(t==='egreso'){
    selMethod='Tarjeta de crédito';
    const creditoBtn=document.getElementById('method-credito');
    if(creditoBtn) creditoBtn.classList.add('active');
  } else {
    selMethod='';
  }
  // Reset note
  const noteEl=document.getElementById('note');
  if(noteEl){ noteEl.value=''; }   // R6.6: ya no existe dataset.autoRate
  // Al cambiar de tipo, limpiar desgloses (solo aplican a egreso)
  desgloses=[]; renderDesgloses();
  const noteWrap=document.getElementById('note-field-wrap');
  if(noteWrap) noteWrap.style.display='none';
  const noteIcon=document.getElementById('note-toggle-icon');
  if(noteIcon) noteIcon.textContent='＋';
  const noteLbl=document.getElementById('note-toggle-lbl');
  if(noteLbl) noteLbl.textContent=' Agregar nota';
  const badge=document.getElementById('rate-note');
  if(badge) badge.style.display='none';
  document.getElementById('method-field').style.display=t==='beneficio'?'none':'block';
  // Efecto de despliegue en el formulario al cambiar de tipo
  revealAnimate(document.getElementById('register-form-card'));
}

function buildCatBlocks() {
  renderCatUI();
}

// Devuelve la clase de color de selección según el tipo actual
function curColorCls(){
  return curType==='ingreso'?'sel-in':curType==='ahorro'?'sel-ah':curType==='beneficio'?'sel-pa':'sel-eg';
}

// Renderiza el UI de categorías/subcategorías según el estado actual:
// - Sin categoría elegida: muestra todas las categorías en grid 2 columnas
// - Categoría elegida sin subcats: muestra solo esa categoría (colapsado)
// - Categoría elegida con subcats, sin subcat elegida: categoría arriba-izq + subcats en columna derecha
// - Categoría y subcategoría elegidas: ambas solas en el mismo renglón
function renderCatUI(){
  const container = document.getElementById('cat-blocks');
  const wrap = document.getElementById('subcat-wrap');
  const label = document.getElementById('cat-label');
  if(!container) return;
  // Capturar el estado ANTES de vaciar: ¿la categoría ya estaba colapsada en su lugar?
  // Esto evita re-animar la categoría al cambiar de subcategoría.
  const wasCollapsed = container.classList.contains('cat-collapsed-row')
    && !!container.querySelector('.cat-col-left .cat-block');
  container.innerHTML='';
  if(wrap){ wrap.classList.remove('vis'); wrap.innerHTML=''; wrap.style.display='none'; }
  const colorCls = curColorCls();

  // ── Estado 1: sin categoría elegida → mostrar todas ──
  if(!curCat){
    if(label) label.textContent='Categoría';
    container.className='cat-grid-ui';
    container.style.gridTemplateColumns=''; // reset a 2 columnas por defecto
    sortedCats(curType).forEach(cat=>{
      const b=makeCatButton(cat, ()=>selectCat(cat));
      container.appendChild(b);
    });
    revealGridByColumns(container, 2);
    updateFinalizeVisibility();
    return;
  }

  // ── Categoría elegida: layout colapsado ──
  if(label) label.textContent='Categoría';
  const subs = sortedSubcats(curType, curCat);
  const hasSubs = subs && !(subs.length===1 && subs[0]==='—');

  // Si NO hay subcategorías (típico en ingreso/beneficio), la categoría ocupa 100% del ancho.
  // Si SÍ hay (egreso), layout de dos columnas: categoría arriba-izq + subcategorías derecha.
  if(!hasSubs){
    container.className='cat-grid-ui';
    container.style.gridTemplateColumns='1fr'; // una sola columna → 100% ancho
    const catBtn=makeCatButton(curCat, ()=>selectCat(curCat));
    catBtn.classList.add(colorCls);
    applyCatBorder(catBtn, curCat);
    container.appendChild(catBtn);
    revealAnimate(container, true);
    updateFinalizeVisibility();
    return;
  }

  // Contenedor de dos columnas: izquierda (categoría) / derecha (subcategorías)
  container.className='cat-collapsed-row';
  container.style.gridTemplateColumns=''; // reset por si venía de 1fr

  const left=document.createElement('div');
  left.className='cat-col-left';
  const catBtn=makeCatButton(curCat, ()=>selectCat(curCat)); // volver a tocarla re-expande
  catBtn.classList.add(colorCls);
  applyCatBorder(catBtn, curCat);
  left.appendChild(catBtn);
  container.appendChild(left);
  // Animar la categoría SOLO en el primer colapso (no al cambiar de subcategoría)
  if(!wasCollapsed) revealAnimate(left, true);

  if(hasSubs){
    const right=document.createElement('div');
    right.className='cat-col-right';
    if(!curSubcat){
      // Mostrar todas las subcategorías
      subs.forEach(s=>{
        const b=makeCatButton(s, ()=>selectSubcat(s), true);
        right.appendChild(b);
      });
    } else {
      // Solo la subcategoría elegida (tocarla re-muestra las demás)
      const b=makeCatButton(curSubcat, ()=>selectSubcat(curSubcat), true);
      b.classList.add(colorCls);
      applyCatBorder(b, curSubcat);
      right.appendChild(b);
    }
    container.appendChild(right);
    // Animar la columna derecha (subcategorías) siempre que cambie
    revealAnimate(right, true);
  }

  // Si hay subcategoría elegida, retrasar la aparición de nota/guardar
  // para que la animación de la subcategoría ocurra primero.
  updateFinalizeVisibility(curSubcat ? 260 : 0);
}

// Muestra "Agregar nota" y "Guardar registro" solo cuando la selección está completa:
// hay categoría Y (hay subcategoría O la categoría no tiene subcategorías).
// Aparecen con efecto suave.
function updateFinalizeVisibility(animDelay){
  const noteSection=document.getElementById('note-section');
  const submitBtn=document.getElementById('submit-btn');
  if(!noteSection||!submitBtn) return;

  // El desglose solo aplica a egresos. En ingreso/beneficio se oculta el botón
  // Desglose y la Nota ocupa todo el ancho del renglón.
  const desgBtn=document.getElementById('desglose-toggle-btn');
  const noteBtn=document.getElementById('note-toggle-btn');
  if(desgBtn && noteBtn){
    if(curType==='egreso' && !_diferirVisible && !diferirHasData()){
      desgBtn.style.display='';
      noteBtn.style.flex='';
    } else {
      desgBtn.style.display='none';
      noteBtn.style.flex='1 1 100%';
      // Si había un desglose abierto de un tipo previo, cerrarlo
      if(_desgloseVisible){
        _desgloseVisible=false;
        const sec=document.getElementById('desglose-section');
        if(sec) sec.style.display='none';
      }
      desgloses=[];
    }
  }

  let complete=false;
  if(curCat){
    const subs=sortedSubcats(curType, curCat);
    const hasSubs=subs && !(subs.length===1 && subs[0]==='—');
    complete = hasSubs ? !!curSubcat : true;
  }

  const wasHidden = noteSection.style.display==='none';
  if(complete){
    const delay = (wasHidden ? (animDelay || 0) : 0);
    if(wasHidden && delay>0){
      // Poner opacity 0 ANTES de hacer visible, para que no haya un frame visible
      noteSection.style.opacity='0';
      submitBtn.style.opacity='0';
      noteSection.style.display='';
      submitBtn.style.display='';
      setTimeout(()=>{
        noteSection.style.opacity='';
        submitBtn.style.opacity='';
        revealAnimate(noteSection);
        revealAnimate(submitBtn);
      }, delay);
    } else {
      noteSection.style.display='';
      submitBtn.style.display='';
      if(wasHidden){
        revealAnimate(noteSection);
        revealAnimate(submitBtn);
      }
    }
    updateDesgloseVisibility();
  } else {
    noteSection.style.display='none';
    submitBtn.style.display='none';
  }
  // Título del método según el tipo (ingreso = recepción)
  const mlbl=document.getElementById('method-field-label');
  if(mlbl) mlbl.textContent = (curType==='ingreso') ? 'Método de recepción' : 'Método de pago';
  updateNoteMode();
  try{ updateRemToggleVisibility(); }catch(e){}
}

// Crea un botón de categoría/subcategoría con ícono y handler.
// Para subcategorías (isSubcat), el ícono es DINÁMICO: el emoji personalizado
// más usado del último año en esa subcategoría (ponderado por cuartos);
// si nadie tiene emoji personalizado, se queda el ícono estándar de siempre.
function makeCatButton(name, onClick, isSubcat){
  const b=document.createElement('button');
  b.type='button';
  b.className='cat-block';
  const icon=(isSubcat ? (dynamicSubcatEmoji(name)||ICONS[name]) : ICONS[name])||'';
  b.innerHTML=`<span>${icon}</span><br>${name}`;
  b.onclick=onClick;
  return b;
}

// Aplica un borde del color real de la categoría (sutil, como balance/historial)
function applyCatBorder(btn, catName){
  const color=catColor(catName);
  if(color && color!=='#8e8e93'){
    btn.style.borderColor=color;
  }
}

function updateInlineBtn(id, active, hasData){
  const btn=document.getElementById(id);
  if(!btn) return;
  btn.classList.toggle('on', !!active);
  btn.classList.toggle('has-data', !active && !!hasData);
}

function propinaHasData(){
  const pct=parseFloat(document.getElementById('propina-pct')?.value)||0;
  const monto=parseFloat(rawAmount(document.getElementById('propina-monto')?.value))||0;
  return propinaOn && (pct>0||monto>0);
}

function benHasData(){
  const amt=parseFloat(rawAmount(document.getElementById('ben-amount')?.value))||0;
  const pct=parseFloat(document.getElementById('ben-pct')?.value)||0;
  return benOn && (amt>0||pct>0);
}

let _propinaVisible=false;
let _benVisible=false;

// ══════════ PROPINA · BENEFICIO · DIFERIR: TABS (comparten el mismo espacio) ══════════
// Reglas de convivencia:
//  · Propina y Diferir se EXCLUYEN (una propina no se difiere).
//  · Diferir y Recordar se EXCLUYEN (el diferido ya crea los cargos mensuales).
//  · Beneficio y Desglose conviven con todo.
// Cerrar un tab NO borra sus datos: el botón queda marcado como "contiene datos".

// Cierra los paneles de los otros dos tabs (sin borrar sus datos)
function _closeOtherTopTabs(keep){
  if(keep!=='propina' && _propinaVisible){
    _propinaVisible=false;
    const p=document.getElementById('propina-panel'); if(p) p.style.display='none';
  }
  if(keep!=='ben' && _benVisible){
    _benVisible=false;
    const b=document.getElementById('ben-panel'); if(b) b.style.display='none';
  }
  if(keep!=='diferir' && _diferirVisible){
    _diferirVisible=false;
    const d=document.getElementById('diferir-panel'); if(d) d.style.display='none';
  }
}

// Refresca qué botones se ven, según las exclusiones vigentes
function refreshTopTabsVisibility(){
  const pbn=document.getElementById('inline-propina-btn');
  const dbn=document.getElementById('inline-diferir-btn');
  const propinaActiva = _propinaVisible || propinaHasData();
  const diferirActivo = _diferirVisible || diferirHasData();
  // Diferir ↔ Recordar: la exclusión era de UNA SOLA VÍA (Diferir escondía a
  // Recordar, pero no al revés). Ahora es simétrica: Recordar activo —panel
  // abierto o ya armado— también esconde Diferir, y al apagarlo reaparece.
  // El `&& !diferirActivo` evita que ambos se escondan a la vez: si Diferir
  // está activo él manda, y updateRemToggleVisibility() apaga a Recordar.
  const remActivo = (typeof _remPanelVisible!=='undefined' && _remPanelVisible)
                 || (typeof remHasData==='function' && remHasData());
  if(pbn) pbn.style.display = diferirActivo ? 'none' : '';
  if(dbn) dbn.style.display = (propinaActiva || (remActivo && !diferirActivo)) ? 'none' : '';
  updateInlineBtn('inline-propina-btn', _propinaVisible, propinaHasData() && !_propinaVisible);
  updateInlineBtn('inline-ben-btn', _benVisible, benHasData() && !_benVisible);
  updateInlineBtn('inline-diferir-btn', _diferirVisible, diferirHasData() && !_diferirVisible);
  // Diferir ↔ Recordar
  try{ updateRemToggleVisibility(); }catch(e){}
  try{ updateNoteDesgloseIndicators(); }catch(e){}
  try{ updateBenMonthSelector(); }catch(e){}
}

function inlineTogglePropina(){
  const abrir = !_propinaVisible;
  _closeOtherTopTabs('propina');
  _propinaVisible = abrir;
  const p=document.getElementById('propina-panel');
  if(p){
    p.style.display = abrir ? 'block' : 'none';
    if(abrir) revealAnimate(p);
  }
  if(abrir) propinaOn=true;
  refreshTopTabsVisibility();
}

function inlineToggleBen(){
  const abrir = !_benVisible;
  _closeOtherTopTabs('ben');
  _benVisible = abrir;
  const b=document.getElementById('ben-panel');
  if(b){
    b.style.display = abrir ? 'block' : 'none';
    if(abrir){ revealAnimate(b); benOn=true; try{ buildBenTypeBlocks('ben-type-blocks', curBenType, t=>{ curBenType=t; try{ updateBenMonthSelector(); }catch(e){} }); }catch(e){} }
  }
  refreshTopTabsVisibility();
}

function inlineToggleDiferir(){
  const abrir = !_diferirVisible;
  _closeOtherTopTabs('diferir');
  _diferirVisible = abrir;
  const d=document.getElementById('diferir-panel');
  if(d){
    d.style.display = abrir ? 'block' : 'none';
    if(abrir){ revealAnimate(d); renderDiferirPresets(); renderDiferirPreview(); }
  }
  refreshTopTabsVisibility();
}





// ════════════════════════════════════════════
// DIFERIDOS (registro)
// ════════════════════════════════════════════

// ══════════════════════════════════════
// DIFERIR (repartir un gasto en N mensualidades)
// ══════════════════════════════════════
const DIFERIR_PRESETS=[3,6,12,24];
let _diferirVisible=false;   // panel abierto
let diferirMonths=0;         // 0 = sin selección; >0 = meses elegidos
let diferirCustom=false;     // si el valor viene del campo personalizado

function diferirHasData(){ return diferirMonths>0; }

// Abrir/cerrar el panel de Diferir


// Crossfade: los 3 botones salen y el botón "Diferir" completo entra (con micro-scale).
// Con Diferir activo se oculta SOLO la Propina (una propina no se difiere: o vino
// incluida en el total, o te la cobraron de inmediato). Beneficio y Desglose SÍ
// conviven con el diferido: el desglose se prorratea entre las mensualidades y el
// beneficio se acredita completo en la mensualidad que elijas.
function hidePropinaBenButtons(){
  const pbn=document.getElementById('inline-propina-btn');
  const full=document.getElementById('inline-diferir-full');
  const row=document.getElementById('inline-row-main');
  if(full){ full.getAnimations().forEach(a=>a.cancel()); full.style.opacity='0'; full.style.pointerEvents='none'; }
  if(row){ row.getAnimations().forEach(a=>a.cancel()); row.style.opacity=''; row.style.pointerEvents=''; }
  if(pbn){
    try{
      pbn.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease',fill:'forwards'})
        .onfinish=()=>{ pbn.style.display='none'; pbn.style.opacity=''; };
    }catch(e){ pbn.style.display='none'; }
  }
  // Si la propina estaba abierta o con datos, se apaga (no aplica a diferidos)
  try{
    _propinaVisible=false;
    const pp=document.getElementById('propina-panel');
    if(pp) pp.style.display='none';
    if(typeof resetPropina==='function') resetPropina();
    updateInlineBtn('inline-propina-btn', false, false);
  }catch(e){}
}

// Al apagar Diferir, la Propina regresa
function showPropinaBenButtons(){
  const pbn=document.getElementById('inline-propina-btn');
  const full=document.getElementById('inline-diferir-full');
  const row=document.getElementById('inline-row-main');
  if(full){ full.getAnimations().forEach(a=>a.cancel()); full.style.opacity='0'; full.style.pointerEvents='none'; }
  if(row){ row.getAnimations().forEach(a=>a.cancel()); row.style.opacity=''; row.style.pointerEvents=''; }
  if(pbn){
    pbn.style.display='';
    try{ pbn.animate([{opacity:0},{opacity:1}],{duration:200,easing:'ease'}); }catch(e){}
  }
}


// Renderiza los presets de meses (toggles individuales)
function renderDiferirPresets(){
  const cont=document.getElementById('diferir-presets');
  if(!cont) return;
  cont.innerHTML='';
  DIFERIR_PRESETS.forEach(p=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='month-preset'+(!diferirCustom && diferirMonths===p?' on':'');
    b.textContent=p+'m';
    b.onclick=()=>toggleDiferirPreset(p);
    cont.appendChild(b);
  });
}

// Alterna un preset: si ya estaba activo, lo desactiva (vuelve a 0)
function toggleDiferirPreset(p){
  if(!diferirCustom && diferirMonths===p){
    diferirMonths=0; // desactivar
  } else {
    diferirMonths=p;
    diferirCustom=false;
    const ci=document.getElementById('diferir-custom');
    if(ci) ci.value='';
  }
  renderDiferirPresets();
  renderDiferirPreview();
  updateInlineBtn('inline-diferir-btn', true, diferirHasData());
  try{ updateBenMonthSelector(); }catch(e){}
  try{ refreshTopTabsVisibility(); }catch(e){}   // Bug 2: mantener la exclusión al vuelo
}

function onDiferirCustomInput(){
  const v=parseInt(document.getElementById('diferir-custom').value);
  if(v && v>=2){
    diferirMonths=v;
    // Si el número coincide con un preset, activar ese preset (no marcar como custom)
    diferirCustom = !DIFERIR_PRESETS.includes(v);
  } else {
    diferirMonths=0;
    diferirCustom=false;
  }
  renderDiferirPresets();
  renderDiferirPreview();
  updateInlineBtn('inline-diferir-btn', true, diferirHasData());
  try{ updateBenMonthSelector(); }catch(e){}
  try{ refreshTopTabsVisibility(); }catch(e){}   // Bug 2: mantener la exclusión al vuelo
}

// Quita el diferido por completo (vuelve a cero y reaparecen Propina/Beneficio/Desglose)
function clearDiferir(){
  diferirMonths=0;
  diferirCustom=false;
  const ci=document.getElementById('diferir-custom');
  if(ci) ci.value='';
  _diferirVisible=false;
  document.getElementById('diferir-panel').style.display='none';
  updateInlineBtn('inline-diferir-btn', false, false);
  showPropinaBenButtons();
  updateDesgloseButtonForDiferir();
}

// Vista previa en vivo: monto por mes + rango de fechas + día de corte
function renderDiferirPreview(){
  const prev=document.getElementById('diferir-preview');
  const clearBtn=document.getElementById('diferir-clear-btn');
  if(!prev) return;
  if(!diferirHasData()){
    prev.style.display='none';
    if(clearBtn) clearBtn.style.display='none';
    return;
  }
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  const perMonth=Math.floor((amount/diferirMonths)*100)/100;
  const base=parseDate(document.getElementById('tx-date').value)||new Date();
  const start=diferirMonthlyDate(base,0);
  const end=diferirMonthlyDate(base,diferirMonths-1);
  const startLbl=`${MONTHS_ES[start.getMonth()].slice(0,3)} ${start.getFullYear()}`;
  const endLbl=`${MONTHS_ES[end.getMonth()].slice(0,3)} ${end.getFullYear()}`;
  prev.style.display='block';
  prev.innerHTML=`
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:var(--accent);margin-bottom:3px;">${fmt(perMonth)} <span style="font-size:13px;font-weight:500;color:var(--text3);">/ mes</span></div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:2px;">Durante <b>${diferirMonths} meses</b> · ${startLbl} – ${endLbl}</div>
    <div style="font-size:11.5px;color:var(--text3);">Cada día ${base.getDate()} de cada mes</div>
  `;
  if(clearBtn) clearBtn.style.display='block';
}

// Fecha de la mensualidad i (0-based), anclando al día original; si el mes no
// tiene ese día, usa el último día del mes (regla tipo iCal, como Apple).
function diferirMonthlyDate(base, i){
  const day=base.getDate();
  const y=base.getFullYear();
  const m=base.getMonth()+i;
  const targetY=y+Math.floor(m/12);
  const targetM=((m%12)+12)%12;
  const lastDay=new Date(targetY, targetM+1, 0).getDate();
  const d=Math.min(day, lastDay);
  return new Date(targetY, targetM, d);
}

// Oculta/muestra el botón Desglose según el estado de Diferir (Diferir abierto → sin Desglose)
// El Desglose ya NO se oculta con Diferir (se prorratea entre las mensualidades).
// Aquí solo se reparte el ancho del renglón entre los botones que quedan visibles:
// con diferido activo, Recordar se esconde y Nota+Desglose ocupan 50% cada uno.
function updateDesgloseButtonForDiferir(){
  const noteBtn=document.getElementById('note-toggle-btn');
  const desgBtn=document.getElementById('desglose-toggle-btn');
  const remBtn=document.getElementById('rem-toggle-btn');
  if(desgBtn) desgBtn.style.display = (curType==='egreso') ? '' : 'none';
  const visibles=[noteBtn,desgBtn,remBtn].filter(b=>b && b.style.display!=='none');
  visibles.forEach(b=>{ b.style.flex='1 1 0'; });
  if(visibles.length===1 && noteBtn) noteBtn.style.flex='1 1 100%';
  try{ updateBenMonthSelector(); }catch(e){}
}



// Close panels on outside click
document.addEventListener('click', function(ev){
  const inlineWrap=document.getElementById('inline-toggles');
  if(!inlineWrap||!inlineWrap.contains(ev.target)) return;
  // Click is inside inline-toggles but outside both panels and buttons — no action needed
  // Panels close via button clicks only or outside the card
}, true);

document.addEventListener('click', function(ev){
  if(!document.getElementById('inline-toggles')) return;
  const card=document.querySelector('#page-registro .card');
  // Si el target ya fue removido del DOM (p.ej. al re-renderizar los tipos de
  // beneficio), no lo tratamos como "clic afuera": lo ignoramos.
  if(!document.contains(ev.target)) return;
  if(card&&!card.contains(ev.target)){
    if(_propinaVisible){
      _propinaVisible=false;
      const pp=document.getElementById('propina-panel');
      if(pp) pp.style.display='none';
      updateInlineBtn('inline-propina-btn', false, propinaHasData());
    }
    if(_benVisible){
      _benVisible=false;
      const bp=document.getElementById('ben-panel');
      if(bp) bp.style.display='none';
      updateInlineBtn('inline-ben-btn', false, benHasData());
    }
  }
});

let curAhorroSubType = 'ahorro'; // 'ahorro' | 'beneficio'



function setAhorroSubType(t){
  curAhorroSubType=t;
  setType(t);
  const activoBtn=document.getElementById('ahorro-sub-activo');
  const pasivoBtn=document.getElementById('ahorro-sub-pasivo');
  if(activoBtn){ activoBtn.style.background=t==='ahorro'?'var(--blue)':'var(--surface2)'; activoBtn.style.color=t==='ahorro'?'white':'var(--text3)'; }
  if(pasivoBtn){ pasivoBtn.style.background=t==='beneficio'?'#af52de':'var(--surface2)'; pasivoBtn.style.color=t==='beneficio'?'white':'var(--text3)'; }
  const mainBtn=document.getElementById('type-btn-ahorro');
  const lbl=document.getElementById('ahorro-type-lbl');
  if(lbl) lbl.textContent=t==='ahorro'?'Ahorro':'Beneficio';
  if(mainBtn){ mainBtn.className='type-btn active '+(t==='ahorro'?'t-ahorro':'t-pasivo'); mainBtn.querySelector('.icon').textContent=t==='ahorro'?'◎':'★'; }
}

function selectCat(cat) {
  _catPredicted=false; // elección manual del usuario
  const container=document.getElementById('cat-blocks');
  const wasAllShowing = !curCat; // estaban todas visibles
  if(curCat===cat){
    // Tocar la categoría ya elegida → re-expandir (mostrar todas)
    curCat=''; curSubcat='';
    renderCatUI();
  } else {
    // Al elegir una categoría desde la vista de todas: animar salida inversa, luego colapsar
    if(wasAllShowing && container && container.children.length>1){
      collapseGridReverse(container, 2, ()=>{
        curCat=cat; curSubcat='';
        renderCatUI();
      });
    } else {
      curCat=cat; curSubcat='';
      renderCatUI();
    }
  }
}

function selectSubcat(sub) {
  _catPredicted=false; // elección manual del usuario
  const container=document.getElementById('cat-blocks');
  if(curSubcat===sub){
    // Tocar la subcategoría ya elegida → re-mostrar las demás
    curSubcat='';
    renderCatUI();
  } else {
    // Al elegir subcategoría: animar salida inversa de las subcats, luego colapsar
    const right=container?container.querySelector('.cat-col-right'):null;
    if(right && right.children.length>1){
      collapseGridReverse(right, 1, ()=>{
        curSubcat=sub;
        renderCatUI();
      });
    } else {
      curSubcat=sub;
      renderCatUI();
    }
  }
}

// Lo que puso la PREDICCIÓN se marca con banderas, para poder deshacerlo al
// borrar la descripción sin pisar lo que el usuario eligió a mano.
let _amountPredicted=false;   // monto autopredicho
let _catPredicted=false;      // categoría/subcategoría puestas por la predicción
let _methodPredicted=false;   // método puesto por la predicción
let _curPredicted=false;      // moneda puesta por la predicción
let _notePredicted=false;     // nota puesta por la predicción
let _desglosePredictedId=null; // id del desglose que puso la predicción (null = ninguno)
let _desgloseDismissed=false;  // lo quitaste a mano: no lo vuelvo a poner en este registro
let _applyingPrediction=false; // guard: el cambio viene de la predicción, no del usuario

// ══════════════════════════════════════════════════════════════════════════
// R7 · PONDERACIÓN POR RECENCIA — punto ÚNICO de verdad
//
// El año se parte en 4 cuartos de ~91 días. Los registros recientes pesan más.
// Nada más viejo de 365 días cuenta. Pesos: 0-91d→4, 92-182d→3, 183-273d→2,
// 274-365d→1, >365d→0.
//
// ESTABA DECLARADA DENTRO de predictCategory, así que NO era global. Por eso
// predictCatForDesc (09b) hacía `typeof recencyWeight==='function' ? ... : 1`
// y SIEMPRE caía al `:1`: la predicción de los desgloses no ponderaba por
// recencia ni respetaba la ventana de 365 días. Aquí arriba, las dos rutas
// —formulario y desglose— usan por fin el MISMO criterio, que es justo lo que
// el punto 1 exige.
// ══════════════════════════════════════════════════════════════════════════
const MS_PER_DAY = 86400000;
function recencyWeight(dateStr){
  const t = parseDate(dateStr).getTime();
  const days = (Date.now() - t) / MS_PER_DAY;
  if(days < 0)   return 4; // fecha futura → tratar como más reciente
  if(days <= 91)  return 4;
  if(days <= 182) return 3;
  if(days <= 273) return 2;
  if(days <= 365) return 1;
  return 0; // más de 365 días → no cuenta
}

function predictCategory(){
  // Refrescar el indicador de "recordatorio activo" del botón 🔔 (corre siempre,
  // incluso con la descripción vacía o corta)
  try{ if(typeof updateRemToggleIndicator==='function') updateRemToggleIndicator(); }catch(e){}
  const desc = document.getElementById('desc').value.trim().toLowerCase();
  if(desc.length < 3){
    // Dos niveles de reseteo:
    //  · Menos de 3 caracteres → deshacer solo lo que puso la PREDICCIÓN
    //    (lo elegido a mano se respeta).
    //  · Descripción COMPLETAMENTE vacía → resetear TODO, incluidas las
    //    elecciones manuales: monto, moneda, método y categoría.
    const vacio = desc.length === 0;
    const amtEl0=document.getElementById('amount');
    if(_amountPredicted || (vacio && amtEl0 && amtEl0.value.trim()!=='')){
      if(amtEl0){ amtEl0.value=''; }
      _amountPredicted=false;
      try{ calcPropinaPreview(); updateDesgloseRemaining(); renderDiferirPreview(); }catch(e){}
    }
    const curSel0=document.getElementById('currency');
    if(_curPredicted || (vacio && curSel0 && curSel0.value!=='MXN')){
      if(curSel0 && curSel0.value!=='MXN'){
        _applyingPrediction=true;
        curSel0.value='MXN';
        try{ onCurChange(); }catch(e){}
        _applyingPrediction=false;
      }
      _curPredicted=false;
    }
    if(_methodPredicted || (vacio && selMethod!=='Tarjeta de crédito')){
      selMethod='Tarjeta de crédito';
      document.querySelectorAll('#method-field .chip').forEach(ch=>{
        ch.classList.toggle('active', ch.getAttribute('data-method')===selMethod);
      });
      _methodPredicted=false;
    }
    if(_notePredicted){
      const _n=document.getElementById('note');
      if(_n) _n.value='';
      _notePredicted=false;
      try{ updateNoteDesgloseIndicators(); }catch(e){}
    }
    if(_catPredicted || (vacio && (curCat || curSubcat))){
      curCat=''; curSubcat='';
      _catPredicted=false;
      renderCatUI();
    }
    // R7 · el desglose que puso la predicción también se deshace
    const _mio = _desglosePredictedId!=null && desgloses.length===1 && desgloses[0].id===_desglosePredictedId;
    if(_mio || vacio){
      if(_mio){
        desgloses=[];
        toggleDesgloseSection(false);
        renderDesgloses(false);
        try{ updateDesgloseRemaining(); updateNoteDesgloseIndicators(); refreshTopTabsVisibility(); }catch(e){}
      }
      _desglosePredictedId=null;
      if(vacio) _desgloseDismissed=false;   // registro en blanco: borrón y cuenta nueva
    }
    return;
  }
  // Funciona para egreso, ingreso y beneficio (beneficio)
  if(curType !== 'egreso' && curType !== 'ingreso' && curType !== 'beneficio') return;

  // recencyWeight() ahora es global (ver arriba): la misma que usan los desgloses.

  // Contar frecuencia PONDERADA de cat+subcat, método Y moneda en registros del
  // MISMO tipo con descripción similar. También juntar candidatos para el monto.
  const freq = {};
  const methodFreq = {};
  const curFreq = {};
  const matches = []; // para la predicción de monto
  data.forEach(e => {
    if(e.type !== curType) return;
    // Ignorar hijos vinculados (desgloses/propina/beneficio) para no sesgar
    if(e.linkedTo) return;
    const d = (e.desc || '').toLowerCase();
    if(d.length < 2) return;
    // Coincide si la descripción histórica contiene lo escrito, o lo escrito contiene la histórica
    if(d.includes(desc) || desc.includes(d)){
      const w = recencyWeight(e.date);
      if(w === 0) return; // fuera de la ventana de 365 días
      const key = (e.category || '') + '||' + (e.subcategory || '');
      freq[key] = (freq[key] || 0) + w;
      // Frecuencia ponderada de método de pago para descripciones similares
      if(e.method){
        methodFreq[e.method] = (methodFreq[e.method] || 0) + w;
      }
      // Frecuencia ponderada de moneda (Starbucks MX vs Panda Express USA)
      const c = e.currency || 'MXN';
      curFreq[c] = (curFreq[c] || 0) + w;
      matches.push(e);
    }
  });

  // ── Predecir método de pago (el más frecuente para descripciones similares) ──
  const methodEntries = Object.entries(methodFreq);
  if(methodEntries.length > 0 && curType !== 'beneficio'){
    const [bestMethod] = methodEntries.sort((a,b)=>b[1]-a[1])[0];
    if(bestMethod && bestMethod !== selMethod){
      selMethod = bestMethod;
      _methodPredicted = true;
      // Actualizar el chip visual del método
      document.querySelectorAll('#method-field .chip').forEach(c=>{
        if(!c) return;
        c.classList.remove('active');
        // El texto del chip puede diferir del valor (ej. "Crédito" vs "Tarjeta de crédito")
        const chipMethod = c.getAttribute('data-method');
        if(chipMethod === bestMethod) c.classList.add('active');
      });
    }
  }

  // ── Predecir moneda (misma ponderación por cuartos) ──
  let predictedCur = null;
  const curEntries = Object.entries(curFreq);
  if(curEntries.length > 0){
    const [bestCur] = curEntries.sort((a,b)=>b[1]-a[1])[0];
    predictedCur = bestCur;
    const curSel = document.getElementById('currency');
    if(curSel && bestCur && curSel.value !== bestCur){
      _applyingPrediction = true;
      curSel.value = bestCur;
      onCurChange(); // refrescar la etiqueta de tipo de cambio
      _applyingPrediction = false;
      _curPredicted = true;
    }
  }

  // ── REGLA PREDICTIVA ÚNICA ──────────────────────────────────────────────
  // Entre los últimos 4 registros del comercio (≤365 días, misma moneda
  // predicha, sin mensualidades de diferidos), un valor se predice si aparece
  // al menos 2 veces Y en al menos la mitad de ellos. En empate gana el más
  // reciente (el pool viene ordenado reciente→viejo).
  //
  // El punto 1 exige que el desglose use EXACTAMENTE este criterio, no uno
  // nuevo. Por eso la regla vive aquí una sola vez y se le pasa qué mirar:
  // el monto, o los nombres de los desgloses. Un registro puede aportar varias
  // claves (una madre con 2 desgloses), pero cada uno cuenta 1 vez por registro.
  const pool = matches
    .filter(e => !e.deferGroup) // las mensualidades de un diferido no son "pagos" reales
    .filter(e => (e.currency || 'MXN') === (predictedCur || 'MXN'))
    .sort((a,b) => parseDate(b.date) - parseDate(a.date))
    .slice(0, 4);

  function predictFromPool(keysOf){
    if(pool.length < 2) return null;
    const counts = {};
    pool.forEach(e => {
      const ks = keysOf(e);
      new Set((Array.isArray(ks) ? ks : [ks]).filter(k => k!=null && k!=='')).forEach(k => {
        counts[k] = (counts[k] || 0) + 1;
      });
    });
    let best = null, bestCount = 0;
    // Del más reciente al más viejo: en empate gana el reciente
    pool.forEach(e => {
      const ks = keysOf(e);
      new Set((Array.isArray(ks) ? ks : [ks]).filter(k => k!=null && k!=='')).forEach(k => {
        if(counts[k] > bestCount){ best = k; bestCount = counts[k]; }
      });
    });
    if(best !== null && bestCount >= 2 && bestCount >= Math.ceil(pool.length / 2)) return best;
    return null;
  }

  // ── Predecir monto ──────────────────────────────────────────────────────
  // R7 · BUG 1: se usaba e.amount, que en una madre desglosada es el REMANENTE,
  // no lo que tecleaste. izzi guarda 741 (1070 − 329 de Netflix) y eso era lo
  // que predecía. origAmountOf() devuelve el monto original completo.
  const amtEl = document.getElementById('amount');
  if(amtEl){
    const best = predictFromPool(e => String(Number(origAmountOf(e))));
    const predAmt = (best !== null) ? Number(best) : null;
    const userTyped = amtEl.value.trim() !== '' && !_amountPredicted;
    if(!userTyped){
      if(predAmt !== null){
        amtEl.value = formatAmountString(String(predAmt));
        _amountPredicted = true;
        try{ calcPropinaPreview(); updateDesgloseRemaining(); renderDiferirPreview(); }catch(e){}
      } else if(_amountPredicted){
        // La predicción dejó de aplicar (cambió la descripción): limpiar
        amtEl.value = '';
        _amountPredicted = false;
        try{ calcPropinaPreview(); updateDesgloseRemaining(); renderDiferirPreview(); }catch(e){}
      }
    }
  }

  // ── Predecir DESGLOSE (el caso izzi + Netflix) ──────────────────────────
  // MISMO criterio, MISMO pool: si un desglose con nombre propio aparece en al
  // menos 2 de los últimos 4 registros del comercio (y en al menos la mitad),
  // se predice. Aquí solo se hacen DOS cosas: activar el toggle de desglose y
  // escribir el nombre propio. De ahí en adelante manda updateDesglose(…,'desc',…)
  // —la predictiva del desglose— que llena monto, categoría, subcategoría y nota.
  if(curType === 'egreso'){
    const nombre = predictFromPool(e => desgloseNamesOf(e));
    const mio = _desglosePredictedId != null
             && desgloses.length === 1
             && desgloses[0].id === _desglosePredictedId;
    if(nombre && !_desgloseDismissed){
      // No pisar desgloses que capturaste tú
      const libre = desgloses.length === 0 || mio;
      if(libre && !(mio && desgloses[0].desc === nombre)){
        if(mio) desgloses = [];
        toggleDesgloseSection(true);          // (a) solo el toggle
        if(desgloses.length === 0) addDesglose();
        const d = desgloses[desgloses.length - 1];
        _desglosePredictedId = d.id;
        renderDesgloses(false);
        const inp = document.querySelector(`#desglose-list [data-desg-id="${d.id}"] [data-desg-owndesc]`);
        if(inp) inp.value = nombre;           // (b) solo el nombre propio
        updateDesglose(d.id, 'desc', nombre); // …y que la predictiva del desglose haga lo suyo
        refreshTopTabsVisibility();
      }
    } else if(mio){
      // Ya no aplica (cambiaste la descripción): deshacer SOLO lo que puso ella
      desgloses = [];
      _desglosePredictedId = null;
      toggleDesgloseSection(false);
      renderDesgloses(false);
      updateDesgloseRemaining();
      updateNoteDesgloseIndicators();
      refreshTopTabsVisibility();
    }
  }

  const entries = Object.entries(freq);
  if(entries.length === 0) return;

  const [bestKey] = entries.sort((a,b) => b[1] - a[1])[0];
  const sep = bestKey.indexOf('||');
  const bestCat = bestKey.substring(0, sep);
  const bestSub = bestKey.substring(sep + 2);
  if(!bestCat) return;
  // No hacer nada si ya está seleccionado lo mismo
  if(curCat === bestCat && curSubcat === bestSub) return;

  // Preseleccionar categoría y subcategoría directamente
  _catPredicted = true;
  curCat = bestCat;
  const subs = sortedSubcats(curType, bestCat);
  const hasSubs = subs && !(subs.length===1 && subs[0]==='—');
  curSubcat = (hasSubs && bestSub && subs.includes(bestSub)) ? bestSub : '';
  renderCatUI();

  // ── NOTA: se autocompleta si ese comercio suele llevar la misma nota ──
  // (p. ej. Kenchy's → "Uber Eats"). Nunca pisa lo que tú escribiste.
  try{
    const noteEl2=document.getElementById('note');
    if(noteEl2 && typeof predictNoteForDesc==='function'){
      const yaEscrita = noteEl2.value.trim()!=='' && !_notePredicted;
      if(!yaEscrita){
        const pn=predictNoteForDesc(desc, curType);
        if(pn){
          noteEl2.value=pn; _notePredicted=true;
        } else if(_notePredicted){
          noteEl2.value=''; _notePredicted=false;
        }
        updateNoteDesgloseIndicators();
      }
    }
  }catch(e){}
}

function setMethod(m,el){
  _methodPredicted=false; // elección manual del usuario
  selMethod=m;
  document.querySelectorAll('#method-field .chip').forEach(c=>c&&c.classList.remove('active'));
  if(el) el.classList.add('active');
}

const BEN_TYPES = ['Cashback','Puntos de lealtad','Puntos TDC','Millas aéreas','Descuentos y promociones','Otros beneficios'];

// ════════════════════════════════════════════════════════════════════════
// R5 · SEMÁNTICA DEL BENEFICIO — punto ÚNICO de verdad
//
// Antes, la decisión de "restar o no restar el beneficio" dependía de si el
// gasto era diferido o no — un criterio equivocado que hacía que el mismo tipo
// de beneficio se tratara distinto según el tipo de gasto.
//
// La regla correcta depende del TIPO de beneficio:
//
//   · DESCUENTO APLICADO (resta del egreso): pagaste menos en el momento porque
//     usaste puntos, millas o una promoción. El dinero nunca salió de tu bolsa.
//     Caso límite: un Starbucks pagado 100% con puntos → el egreso queda en $0 y
//     el beneficio absorbe el total. En la práctica funciona como método de pago.
//
//   · CRÉDITO RECIBIDO (NO resta): el cashback. La compra se cobró completa y el
//     dinero regresa después como crédito a favor, independiente de esa compra.
//
// Esta regla aplica IGUAL en gastos normales y diferidos. En un diferido, un
// descuento reduce el total ANTES de prorratear (bajan todas las mensualidades);
// el cashback se mantiene anclado al mes en que se acredita.
// ════════════════════════════════════════════════════════════════════════
const BEN_CREDITO_RECIBIDO = ['Cashback'];   // no reduce el gasto

// ¿Este tipo de beneficio se descuenta del monto del egreso?
function benReduceGasto(benType){
  if(!benType) return false;
  return !BEN_CREDITO_RECIBIDO.includes(benType);
}

// ── Estado del beneficio en edición (espejo del registro) ──
let editBenType_mode = 'monto'; // 'pct' | 'monto'

function setEditBenType(t){
  editBenType_mode=t;
  const pctBtn=document.getElementById('e-ben-chip-pct');
  const montoBtn=document.getElementById('e-ben-chip-monto');
  const pctInput=document.getElementById('e-ben-pct');
  const montoInput=document.getElementById('e-ben-amount');
  if(pctBtn){ pctBtn.style.background=t==='pct'?'var(--accent)':'transparent'; pctBtn.style.color=t==='pct'?'white':'var(--text3)'; }
  if(montoBtn){ montoBtn.style.background=t==='monto'?'var(--accent)':'transparent'; montoBtn.style.color=t==='monto'?'white':'var(--text3)'; }
  if(pctInput) pctInput.style.display=t==='pct'?'':'none';
  if(montoInput) montoInput.style.display=t==='monto'?'':'none';
  calcEditBenPreview();
}

function getEditBenAmount(){
  if(!editBenOn) return 0;
  if(editBenType_mode==='monto') return parseFloat(rawAmount(document.getElementById('e-ben-amount').value))||0;
  const pct=parseFloat(document.getElementById('e-ben-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  return +(amount * pct / 100).toFixed(2);
}

function calcEditBenPreview(){
  const calcEl=document.getElementById('e-ben-calc');
  if(!calcEl) return;
  const cur=document.getElementById('e-currency').value;
  const sym=cur==='MXN'?'$':`${cur} `;
  if(editBenType_mode==='monto'){
    const benVal=parseFloat(rawAmount(document.getElementById('e-ben-amount').value))||0;
    if(cur!=='MXN' && benVal>0){
      calcEl.textContent=`= $${toMXN(benVal,cur).toFixed(2)} MXN`;
    } else { calcEl.textContent=''; }
    return;
  }
  const pct=parseFloat(document.getElementById('e-ben-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  if(pct>0 && amount>0){
    calcEl.textContent=`= ${sym}${(amount*pct/100).toFixed(2)}`;
  } else { calcEl.textContent=''; }
}


// Unificar: las categorías de ahorro pasivo SON los tipos de beneficio.
// Así coinciden sin importar si se registra dentro de un gasto o por separado.
BEN_TYPES.forEach(t=>{ CATS['beneficio'][t]=['—']; });
let curBenType = 'Cashback';
let editBenType = 'Cashback';


// ══════════ TC MANUAL: UI DEL FORMULARIO DE REGISTRO ══════════
// El campo solo aparece en moneda extranjera. Vacío = TC automático.
function _fxParse(v){
  const n=parseFloat(String(v||'').replace(/[^\d.]/g,''));
  return (isFinite(n) && n>0) ? n : null;
}
function updateFxRow(){
  const cur=document.getElementById('currency')?.value||'MXN';
  const row=document.getElementById('fx-row');
  const inp=document.getElementById('fx-manual');
  const hint=document.getElementById('fx-hint');
  if(!row||!inp) return;
  if(cur==='MXN'){
    row.style.display='none';
    inp.value=''; _fxOverride=null;
    return;
  }
  const auto=rates[cur]||0;
  inp.placeholder = auto ? `${auto.toFixed(2)} (automático)` : 'automático';
  _fxOverride=_fxParse(inp.value);
  if(hint) hint.textContent = _fxOverride ? `1 ${cur} = $${_fxOverride.toFixed(2)} MXN` : `Vacío = usar el automático`;
  row.style.display='flex';
}
function onFxManualInput(){
  _fxOverride=_fxParse(document.getElementById('fx-manual')?.value);
  updateFxRow();
  // Recalcular vistas previas que dependen del TC
  try{ calcPropinaPreview(); calcBenPreview(); updateDesgloseRemaining(); renderDiferirPreview(); }catch(e){}
}


// Escribir la nota a mano cancela la predicción (deja de ser "automática")
function onNoteInput(){
  if(typeof _notePredicted!=='undefined') _notePredicted=false;
  updateNoteDesgloseIndicators();
}
