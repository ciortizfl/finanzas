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
}

// Decide el modo de la nota:
//  - MODO DIRECTO: cuando la nota va sola (ingreso, beneficio o egreso diferido).
//    El textarea se muestra directamente, sin botón toggle.
//  - MODO TOGGLE: cuando conviven Nota y Desglose (egreso normal). Botones toggle.
function updateNoteMode(){
  const row=document.getElementById('note-desglose-row');
  const noteBtn=document.getElementById('note-toggle-btn');
  const wrap=document.getElementById('note-field-wrap');
  if(!row || !noteBtn || !wrap) return;
  const noteDirecto = (curType!=='egreso') || _diferirVisible || diferirHasData();
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
    // Si no hay ningún desglose aún, agregar uno automáticamente para agilizar
    if(desgloses.length===0) addDesglose();
  }
  updateNoteDesgloseIndicators();
}

function onCurChange() {
  const cur = document.getElementById('currency').value;
  const badge = document.getElementById('rate-note');
  const noteEl = document.getElementById('note');
  // Remove any previous auto-injected rate from note
  if(noteEl && noteEl.dataset.autoRate) {
    noteEl.value = noteEl.value.replace(' | '+noteEl.dataset.autoRate, '').replace(noteEl.dataset.autoRate, '').trim();
    delete noteEl.dataset.autoRate;
  }
  if(cur==='MXN'){ if(badge) badge.style.display='none'; return; }
  if(badge) badge.style.display='flex';
  const r = rates[cur]||1;
  const rateStr = `TC: 1 ${cur} = $${r.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} MXN${ratesLoaded?'':' (est.)'}`;
  document.getElementById('rate-text').textContent = rateStr;
  if(noteEl){
    noteEl.dataset.autoRate = rateStr;
    noteEl.value = noteEl.value ? noteEl.value+' | '+rateStr : rateStr;
    toggleNoteField(true);
  }
  calcBenPreview();
  calcPropinaPreview();
  if(typeof renderDesgloses==='function' && desgloses.length>0) renderDesgloses();
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
function toMXN(a,c){ return c==='MXN'?a:+(a*(rates[c]||1)).toFixed(2); }

function rateNote(c){
  if(c==='MXN') return '';
  const r=rates[c];
  if(!r) return '';
  return `TC: 1 ${c} = $${r.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} MXN${ratesLoaded?'':' (est.)'}`;
}

function goNav(id, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const page=document.getElementById('page-'+id);
  page.classList.add('active');
  btn.classList.add('active');

  // Render inmediato desde cache CON animación, luego refresco silencioso desde Sheets
  if(id==='balance'){
    renderBalance();
    const grid=document.getElementById('bal-stats-grid');
    if(grid) revealAnimate(grid, true);
    loadFromSheets(true); // refresco silencioso (sin re-animar)
  } else if(id==='historial'){
    // Al entrar a historial, partir siempre de la vista por meses (sin rango activo)
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
    const order={egreso:0, ingreso:1, 'ahorro-pasivo':2};
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
    if(t==='ahorro'||t==='ahorro-pasivo') ahorroBtn.classList.add('active');
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
  if(noteEl){ noteEl.value=''; delete noteEl.dataset.autoRate; }
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
  document.getElementById('method-field').style.display=t==='ahorro-pasivo'?'none':'block';
  // Efecto de despliegue en el formulario al cambiar de tipo
  revealAnimate(document.getElementById('register-form-card'));
}

function buildCatBlocks() {
  renderCatUI();
}

// Devuelve la clase de color de selección según el tipo actual
function curColorCls(){
  return curType==='ingreso'?'sel-in':curType==='ahorro'?'sel-ah':curType==='ahorro-pasivo'?'sel-pa':'sel-eg';
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
        const b=makeCatButton(s, ()=>selectSubcat(s));
        right.appendChild(b);
      });
    } else {
      // Solo la subcategoría elegida (tocarla re-muestra las demás)
      const b=makeCatButton(curSubcat, ()=>selectSubcat(curSubcat));
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
  updateNoteMode();
}

// Crea un botón de categoría/subcategoría con ícono y handler
function makeCatButton(name, onClick){
  const b=document.createElement('button');
  b.type='button';
  b.className='cat-block';
  b.innerHTML=`<span>${ICONS[name]||''}</span><br>${name}`;
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

function inlineTogglePropina(){
  if(_propinaVisible){
    _propinaVisible=false;
    document.getElementById('propina-panel').style.display='none';
    updateInlineBtn('inline-propina-btn', false, propinaHasData());
  } else {
    _propinaVisible=true; propinaOn=true;
    _benVisible=false;
    const ppanel=document.getElementById('propina-panel');
    ppanel.style.display='block';
    revealAnimate(ppanel);
    document.getElementById('ben-panel').style.display='none';
    updateInlineBtn('inline-propina-btn', true, false);
    updateInlineBtn('inline-ben-btn', false, benHasData());
  }
}

function inlineToggleBen(){
  if(_benVisible){
    _benVisible=false;
    document.getElementById('ben-panel').style.display='none';
    updateInlineBtn('inline-ben-btn', false, benHasData());
  } else {
    _benVisible=true; benOn=true;
    _propinaVisible=false;
    const bpanel=document.getElementById('ben-panel');
    bpanel.style.display='block';
    revealAnimate(bpanel);
    document.getElementById('propina-panel').style.display='none';
    updateInlineBtn('inline-ben-btn', true, false);
    updateInlineBtn('inline-propina-btn', false, propinaHasData());
    if(!document.querySelector('#ben-type-blocks .cat-block')){
      // Empezar sin selección para mostrar todos los tipos (como las categorías)
      curBenType='';
      buildBenTypeBlocks('ben-type-blocks', '', t=>{ curBenType=t; });
    }
    // Sincronizar estado visual del toggle % / $
    setBenType(benType);
  }
}
