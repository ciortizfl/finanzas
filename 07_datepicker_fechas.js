// ════════════════════════════════════════════
// DATEPICKER
// ════════════════════════════════════════════

// ═══════════════════════════════════════════
// DATEPICKER genérico (rango con presets o simple)
// ═══════════════════════════════════════════
let _dpViewMonth=new Date().getMonth();
let _dpViewYear=new Date().getFullYear();
let _dpSelected=null;      // Date actualmente seleccionada en el picker
let _dpMinDate=null;       // fecha mínima permitida (para "hasta" ≥ "desde")
let _dpShowPresets=false;  // mostrar presets (solo para "hasta")
let _dpPresetStart=null;   // fecha inicial (para calcular presets)
let _dpOnPick=null;        // callback(dateObj) al elegir

function _dpFmt(d){ return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:null; }

// Abre el datepicker.
// opts: { initial:Date|null, min:Date|null, presets:bool, presetStart:Date|null, onPick:fn }
function openDatepicker(opts){
  opts=opts||{};
  _dpMinDate=opts.min||null;
  _dpShowPresets=!!opts.presets;
  _dpPresetStart=opts.presetStart||null;
  _dpOnPick=opts.onPick||null;
  _dpSelected=opts.initial||null;
  const cur=_dpSelected||opts.presetStart||new Date();
  _dpViewMonth=cur.getMonth(); _dpViewYear=cur.getFullYear();
  document.getElementById('dp-cal-view').classList.remove('hide');
  document.getElementById('dp-my-select').classList.remove('show');
  const presets=document.getElementById('dp-presets');
  if(presets) presets.style.display=_dpShowPresets?'block':'none';
  if(_dpShowPresets) _dpUpdatePresets();
  _dpRenderGrid();
  document.getElementById('dp-overlay').classList.add('open');
}
function dpClose(){ document.getElementById('dp-overlay').classList.remove('open'); }
function dpCloseBg(ev){ if(ev.target===document.getElementById('dp-overlay')) dpClose(); }
function dpChangeMonth(delta){
  _dpViewMonth+=delta;
  if(_dpViewMonth<0){ _dpViewMonth=11; _dpViewYear--; }
  if(_dpViewMonth>11){ _dpViewMonth=0; _dpViewYear++; }
  _dpRenderGrid();
}
function _dpRenderGrid(){
  document.getElementById('dp-month-year').textContent=`${MONTHS_ES[_dpViewMonth]} ${_dpViewYear}`;
  const grid=document.getElementById('dp-grid'); grid.innerHTML='';
  const firstDay=new Date(_dpViewYear,_dpViewMonth,1).getDay();
  const daysInMonth=new Date(_dpViewYear,_dpViewMonth+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);
  for(let i=0;i<firstDay;i++){ const e=document.createElement('div'); e.className='dp-day empty'; grid.appendChild(e); }
  for(let day=1;day<=daysInMonth;day++){
    const d=new Date(_dpViewYear,_dpViewMonth,day);
    const btn=document.createElement('button'); btn.type='button'; btn.className='dp-day'; btn.textContent=day;
    if(d.getTime()===today.getTime()) btn.classList.add('today');
    const belowMin = _dpMinDate && d < _dpMinDate;
    if(belowMin){ btn.classList.add('disabled'); }
    else {
      if(_dpSelected && d.getTime()===_dpSelected.getTime()) btn.classList.add('selected');
      btn.onclick=()=>_dpPick(d);
    }
    grid.appendChild(btn);
  }
}
function _dpPick(d){
  if(_dpMinDate && d < _dpMinDate) return;
  if(_dpOnPick) _dpOnPick(d);
  dpClose();
}
// Presets
function _dpAddDays(start,days){ const d=new Date(start); d.setDate(d.getDate()+days); return d; }
function _dpAddMonths(start,months){ const d=new Date(start.getFullYear(),start.getMonth()+months,start.getDate()); d.setDate(d.getDate()-1); return d; }
function _dpPresetResult(preset){
  const s=_dpPresetStart;
  if(preset==='today'){ const t=new Date(); t.setHours(0,0,0,0); return t; }
  if(!s) return null;
  if(preset==='1s') return _dpAddDays(s,6);
  if(preset==='2s') return _dpAddDays(s,13);
  if(preset==='3s') return _dpAddDays(s,20);
  if(preset==='1m') return _dpAddMonths(s,1);
  if(preset==='3m') return _dpAddMonths(s,3);
  if(preset==='6m') return _dpAddMonths(s,6);
  return null;
}
function _dpUpdatePresets(){
  const today=new Date(); today.setHours(0,0,0,0);
  document.querySelectorAll('.dp-preset').forEach(btn=>{
    const res=_dpPresetResult(btn.dataset.preset);
    btn.disabled = !res || res>today;
  });
}
function dpApplyPreset(preset){
  const res=_dpPresetResult(preset);
  const today=new Date(); today.setHours(0,0,0,0);
  if(!res) return;
  if(preset!=='today' && res>today) return;
  if(_dpOnPick) _dpOnPick(res);
  dpClose();
}
// Selección rápida mes/año
function dpShowMonthYear(){
  document.getElementById('dp-cal-view').classList.add('hide');
  document.getElementById('dp-my-select').classList.add('show');
  _dpRenderMonthYear();
}
function dpChangeYear(delta){ _dpViewYear+=delta; _dpRenderMonthYear(); }
function _dpRenderMonthYear(){
  document.getElementById('dp-year-label').textContent=_dpViewYear;
  const g=document.getElementById('dp-months-grid'); g.innerHTML='';
  const short=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  short.forEach((m,i)=>{
    const b=document.createElement('button'); b.type='button';
    b.className='dp-month-cell'+(i===_dpViewMonth?' current':''); b.textContent=m;
    b.onclick=()=>{
      _dpViewMonth=i;
      document.getElementById('dp-cal-view').classList.remove('hide');
      document.getElementById('dp-my-select').classList.remove('show');
      _dpRenderGrid();
    };
    g.appendChild(b);
  });
}

// ── Filtro por rango de fechas en el historial (modo alternativo al mes/año) ──
let histRangeMode=false;
let histRangeApplied=false; // si el rango ya fue confirmado con "Aplicar"
let _rangeBreatheTimer=null;

// Mueve el buscador a su posición ORIGINAL (arriba, bajo el encabezado).
function restoreSearchPosition(){
  const searchWrap=document.getElementById('hist-search-wrap');
  const anchorOrig=document.getElementById('hist-search-anchor-original');
  if(searchWrap && anchorOrig && searchWrap.previousElementSibling!==anchorOrig.previousElementSibling){
    anchorOrig.parentNode.insertBefore(searchWrap, anchorOrig);
  }
  if(searchWrap){ searchWrap.style.display=''; searchWrap.style.animation=''; }
}

// Oculta el buscador (mientras se elige el rango, antes de aplicar).
function hideSearchForRange(){
  const searchWrap=document.getElementById('hist-search-wrap');
  if(searchWrap) searchWrap.style.display='none';
}

// Coloca el buscador DEBAJO del botón Aplicar (antes de la lista) y lo anima
// con fade+slide, encadenado DESPUÉS de que aparecen los resultados.
function showSearchInRangePosition(){
  const searchWrap=document.getElementById('hist-search-wrap');
  const anchorRange=document.getElementById('hist-search-anchor-range');
  if(!searchWrap || !anchorRange) return;
  // Mover el buscador justo después del ancla de rango (bajo el botón Aplicar)
  anchorRange.parentNode.insertBefore(searchWrap, anchorRange.nextSibling);
  searchWrap.style.display='';
  // Aparición encadenada: espera a que la lista haga su cascada, luego fade+slide
  searchWrap.style.opacity='0';
  searchWrap.style.animation='';
  setTimeout(()=>{
    try{
      searchWrap.animate(
        [{opacity:0,transform:'translateY(-8px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:500,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'backwards'}
      );
    }catch(e){}
    searchWrap.style.opacity='';
  }, 450); // tras la animación de la lista
}

// Formatea una fecha 'yyyy-MM-dd' a "8 Jul 2026" para mostrar en el campo
function _dpNice(dateStr){
  if(!dateStr) return null;
  const p=String(dateStr).split('-');
  if(p.length!==3) return dateStr;
  const short=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(p[2])} ${short[parseInt(p[1])-1]} ${p[0]}`;
}
// Refleja los valores de los inputs ocultos en los botones visuales del rango
function updateRangeFieldLabels(){
  const fromV=document.getElementById('hist-range-from')?.value;
  const toV=document.getElementById('hist-range-to')?.value;
  const fromLbl=document.getElementById('hist-range-from-val');
  const toLbl=document.getElementById('hist-range-to-val');
  if(fromLbl){ if(fromV){ fromLbl.textContent=_dpNice(fromV); fromLbl.classList.remove('placeholder'); } else { fromLbl.textContent='Desde'; fromLbl.classList.add('placeholder'); } }
  if(toLbl){ if(toV){ toLbl.textContent=_dpNice(toV); toLbl.classList.remove('placeholder'); } else { toLbl.textContent='Hasta'; toLbl.classList.add('placeholder'); } }
}
function openRangeFromPicker(){
  const cur=document.getElementById('hist-range-from')?.value;
  openDatepicker({
    initial: cur?parseDate(cur):null,
    presets:false,
    onPick:(d)=>{
      document.getElementById('hist-range-from').value=_dpFmt(d);
      // Si "hasta" quedó antes que "desde", limpiarlo
      const toV=document.getElementById('hist-range-to').value;
      if(toV && parseDate(toV)<d){ document.getElementById('hist-range-to').value=''; }
      updateRangeFieldLabels();
      onRangeDateChange();
    }
  });
}
function openRangeToPicker(){
  const cur=document.getElementById('hist-range-to')?.value;
  const fromV=document.getElementById('hist-range-from')?.value;
  const startD=fromV?parseDate(fromV):null;
  openDatepicker({
    initial: cur?parseDate(cur):null,
    min: startD,
    presets:!!startD,
    presetStart:startD,
    onPick:(d)=>{
      document.getElementById('hist-range-to').value=_dpFmt(d);
      updateRangeFieldLabels();
      onRangeDateChange();
    }
  });
}

function toggleDateRange(){
  histRangeMode=!histRangeMode;
  const monthRow=document.getElementById('hist-date-row');
  const rangeRow=document.getElementById('hist-range-row');
  if(histRangeMode){
    // Al salir del modo campanita (si estaba activo), volver a la vista base
    try{ if(typeof histBellMode!=='undefined' && histBellMode) setBellMode(false); }catch(e){}
    // Defaults del rango: la fecha final es HOY y la inicial es EXACTAMENTE un
    // mes antes (11 jul → 11 jun; si el mes previo es más corto, se recorta al
    // último día: 31 jul → 30 jun).
    const todayD=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const last=`${todayD.getFullYear()}-${pad(todayD.getMonth()+1)}-${pad(todayD.getDate())}`;
    let py=todayD.getFullYear(), pm=todayD.getMonth()-1;
    if(pm<0){ pm=11; py--; }
    const lastDayPrev=new Date(py,pm+1,0).getDate();
    const first=`${py}-${pad(pm+1)}-${pad(Math.min(todayD.getDate(),lastDayPrev))}`;
    const fromEl=document.getElementById('hist-range-from');
    const toEl=document.getElementById('hist-range-to');
    if(fromEl && !fromEl.value) fromEl.value=first;
    if(toEl && !toEl.value) toEl.value=last;
    updateRangeFieldLabels(); // reflejar en los botones visuales
    if(monthRow) monthRow.style.display='none';
    if(rangeRow) rangeRow.style.display='flex';
    // Ocultar el buscador mientras se elige el rango (reaparece al aplicar)
    hideSearchForRange();
    // Animación escalonada de entrada (campos de fecha primero, luego el botón),
    // con los mismos tiempos que las demás animaciones de aparición de la app.
    revealAnimate(rangeRow, true);
    // El filtro se aplica al confirmar. Mientras tanto, vaciar la lista para no
    // dar la falsa impresión de que los registros del mes son el resultado del rango.
    histRangeApplied=false;
    // Resetear TODOS los filtros previos (tipo, categorías, subcategorías, método)
    resetHistFiltersToTodos();
    renderHistorial(); // renderHistorial ve histRangeMode && !applied → muestra vacío
    // NOTA: no arrancamos el recordatorio aquí. Solo cuenta los 2s cuando el
    // usuario efectivamente modifica una fecha (para no apresurarlo sin motivo).
  } else {
    if(monthRow) monthRow.style.display='flex';
    if(rangeRow) rangeRow.style.display='none';
    histRangeApplied=false;
    stopRangeBreathe();
    // Limpiar el campo de búsqueda para empezar de cero en la vista por meses
    const search=document.getElementById('hist-search');
    if(search) search.value='';
    const searchClear=document.getElementById('hist-search-clear');
    if(searchClear) searchClear.style.display='none';
    // Restaurar el buscador a su posición original (arriba)
    restoreSearchPosition();
    // Volver a meses también resetea a "Todos" para no arrastrar filtros del rango
    resetHistFiltersToTodos();
    renderHistorial(true); // volver a la vista por meses
  }
}

// Cuando el usuario cambia una fecha del rango: reinicia el temporizador de 2s
// para que el botón "respire" si no aplica.
function onRangeDateChange(){
  startRangeBreathe();
}

function startRangeBreathe(){
  const btn=document.getElementById('hist-apply-range-btn');
  if(!btn) return;
  btn.classList.remove('breathe'); // detener si ya estaba
  clearTimeout(_rangeBreatheTimer);
  _rangeBreatheTimer=setTimeout(()=>{
    // Solo respirar si seguimos en modo rango y aún no se aplicó
    if(histRangeMode && !histRangeApplied){
      btn.classList.add('breathe');
    }
  }, 2000);
}

function stopRangeBreathe(){
  const btn=document.getElementById('hist-apply-range-btn');
  clearTimeout(_rangeBreatheTimer);
  if(btn) btn.classList.remove('breathe');
}

// Resetea por completo los filtros del historial a "Todos": estado interno,
// selección visual de chips, y oculta el panel de categorías/subcategorías.
function resetHistFiltersToTodos(){
  histFilter='todos';
  histSelCats=[];
  histSelSubcats=[];
  histMethodFilter=null;
  document.querySelectorAll('.filter-bar .f-chip').forEach(c=>c.classList.remove('active'));
  const todosChip=document.getElementById('fchip-todos');
  if(todosChip) todosChip.classList.add('active');
  const subPanel=document.getElementById('sub-filter-panel');
  if(subPanel) subPanel.classList.remove('vis');
  // Cerrar el panel de método de pago y restablecer su indicador
  const methodRow=document.getElementById('method-filter-row');
  if(methodRow) methodRow.style.display='none';
  const methodArrow=document.getElementById('method-filter-arrow');
  if(methodArrow) methodArrow.style.transform='';
  const methodInd=document.getElementById('method-filter-indicator');
  if(methodInd) methodInd.style.background='var(--border2)';
  if(typeof updateResetButton==='function') updateResetButton();
}

// Aplica el rango elegido y renderiza con animación (solo al confirmar)
function applyDateRange(){
  const fromEl=document.getElementById('hist-range-from');
  const toEl=document.getElementById('hist-range-to');
  if(fromEl && toEl && fromEl.value && toEl.value){
    // Validar que "desde" no sea posterior a "hasta"
    if(parseDate(fromEl.value) > parseDate(toEl.value)){
      toast('La fecha inicial no puede ser posterior a la final');
      return;
    }
  }
  histRangeApplied=true;
  stopRangeBreathe(); // al aplicar, detener el recordatorio
  // La vista siempre arranca en "Todos" al aplicar, con todos los filtros reseteados
  resetHistFiltersToTodos();
  renderHistorial(true);
  // El buscador reaparece debajo del botón Aplicar, encadenado tras los resultados
  showSearchInRangePosition();
}

function fmt(n){return '$'+Math.abs(n).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});}

// ── Comas de miles EN VIVO para campos de monto ──
// Devuelve el valor numérico "crudo" (sin comas) de un input formateado.
function rawAmount(str){
  return String(str==null?'':str).replace(/,/g,'');
}
// Formatea la cadena tecleada agregando comas de miles a la parte entera,
// respetando los decimales que el usuario esté escribiendo (hasta 2).
function formatAmountString(str){
  let s=String(str==null?'':str).replace(/,/g,'');
  s=s.replace(/[^\d.]/g,'');
  const firstDot=s.indexOf('.');
  if(firstDot!==-1){
    s = s.slice(0,firstDot+1) + s.slice(firstDot+1).replace(/\./g,'');
  }
  let [intPart, decPart] = s.split('.');
  intPart = (intPart||'').replace(/^0+(?=\d)/,'');
  const intFmt = intPart ? Number(intPart).toLocaleString('en-US') : (s.startsWith('.')?'0':'');
  if(s.includes('.')){
    if(decPart!==undefined) decPart=decPart.slice(0,2);
    return (intFmt||'0') + '.' + (decPart||'');
  }
  return intFmt;
}
// Handler del evento input: reformatea preservando la posición del cursor.
function handleAmountInput(el){
  // Si el usuario teclea el monto a mano en el registro, la predicción de monto
  // deja de tener permiso para sobreescribirlo.
  if(el && el.id==='amount' && typeof _amountPredicted!=='undefined') _amountPredicted=false;
  const before=el.value;
  const selStart=el.selectionStart;
  // Contar "caracteres significativos" antes del cursor: dígitos Y el punto decimal
  // (así el cursor no se queda atascado antes del punto al escribir centavos).
  const sigBefore=(before.slice(0,selStart).match(/[\d.]/g)||[]).length;
  const formatted=formatAmountString(before);
  el.value=formatted;
  // Reubicar el cursor tras la misma cantidad de caracteres significativos
  let pos=0, seen=0;
  while(pos<formatted.length && seen<sigBefore){
    if(/[\d.]/.test(formatted[pos])) seen++;
    pos++;
  }
  try{ el.setSelectionRange(pos,pos); }catch(e){}
}



let _toastTimer=null;
function toast(msg){
  const t=document.getElementById('toast');
  if(!t) return;
  const icoEl=document.getElementById('toast-ico');
  const titleEl=document.getElementById('toast-title');
  const subEl=document.getElementById('toast-sub');
  if(!icoEl||!titleEl||!subEl){ // respaldo por si el HTML no tiene la estructura
    t.textContent=msg; t.classList.add('show');
    clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
    return;
  }

  // Detectar el tipo de notificación a partir del mensaje
  let raw=String(msg).trim();
  let type='info';
  // Quitar símbolos iniciales que ya traen algunos mensajes (✓, ✕, ⚠️)
  const clean=raw.replace(/^([✓✔✕✗⚠️!]+)\s*/,'').trim();
  if(/^[✓✔]/.test(raw) || /guardad|actualizad|eliminad|descargad|convertid|sincroniz/i.test(clean)){
    type='ok';
  }
  if(/^[⚠️!]/.test(raw) || /^error|no se pudo|no puede|excede|inválid|revisa/i.test(clean)){
    type='warn';
  }
  if(/^error|falló|no se pudo/i.test(clean)){
    type='err';
  }
  // Los mensajes de validación (guías para completar el formulario) van como aviso
  if(/^(selecciona|ingresa|agrega|elige|cada desglose|ningún desglose|beneficio,)/i.test(clean)){
    type='warn';
  }

  // Título + subtítulo: si el mensaje trae dos frases separadas por " — " o ". ",
  // la primera es título y el resto subtítulo. Si no, todo va como título.
  let title=clean, sub='';
  const dash=clean.split(' — ');
  if(dash.length>1){ title=dash[0]; sub=dash.slice(1).join(' — '); }

  const icons={ ok:'✓', err:'✕', warn:'!', info:'↻' };
  icoEl.textContent = icons[type] || '✓';
  icoEl.className = 'toast-ico' + (type==='ok'?' ok':type==='err'?' err':type==='warn'?' warn':'');
  titleEl.textContent = title;
  subEl.textContent = sub;

  clearTimeout(_toastTimer);
  t.classList.remove('show'); void t.offsetWidth;
  t.classList.add('show');
  _toastTimer=setTimeout(()=>t.classList.remove('show'), 2600);
}


// ════════════════════════════════════════════
// TIRA DE DÍAS (date strip)
// ════════════════════════════════════════════

// ══════════════════════════════════════
// DATE STRIP PICKER
// ══════════════════════════════════════

// Offset en días desde "hoy" para cada strip
const stripOffsets = {};

function dateToISO(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function addDays(isoDate, n){
  const d = parseDate(isoDate);
  d.setDate(d.getDate()+n);
  return dateToISO(d);
}

// Renderiza RANGE días centrados en centerDate
// Range grande para que se pueda scrollear sin recargar
const STRIP_RANGE = 60; // 60 días antes y 60 después = 121 botones

// Detecta si estamos en móvil (viewport angosto)
function isMobileView(){
  return window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
}

function renderStrip(stripId, centerDate){
  const strip  = document.getElementById(stripId);
  const scroll = document.getElementById(stripId + '-scroll');
  if(!strip || !scroll) return;

  const inputId = stripId === 'tx-date-strip' ? 'tx-date' : 'e-date';
  const selected = document.getElementById(inputId)?.value || localToday();
  const today = localToday();
  const DAYS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MONTHS_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const mobile = isMobileView();
  // Móvil: rango amplio con scroll. Web: solo 5 días a cada lado (11 total).
  const range = mobile ? STRIP_RANGE : 5;

  // En web, el strip ocupa todo el ancho (cada botón 1/11); en móvil usa scroll
  strip.classList.toggle('web-full', !mobile);

  strip.innerHTML = '';
  let selectedBtn = null;
  let prevMonth = null;

  for(let i = -range; i <= range; i++){
    const iso = addDays(centerDate, i);
    const d   = parseDate(iso);
    const curMonth = d.getMonth();

    // Quiebre visual de mes (solo móvil): insertar separador antes del primer día de un mes nuevo
    if(mobile && prevMonth !== null && curMonth !== prevMonth){
      const brk = document.createElement('div');
      brk.className = 'month-break';
      brk.textContent = MONTHS_ABBR[curMonth];
      strip.appendChild(brk);
    }
    prevMonth = curMonth;

    const btn = document.createElement('button');
    btn.type  = 'button';
    btn.className = 'date-day-btn' + (mobile ? '' : ' web-mode');
    btn.dataset.iso = iso;
    if(iso === today)    btn.classList.add('today-marker');
    if(iso === selected){ btn.classList.add('selected'); selectedBtn = btn; }

    if(mobile){
      btn.innerHTML = `<span class="day-name">${DAYS[d.getDay()]}</span><span class="day-num">${d.getDate()}</span>`;
    } else {
      // Web: nombre de día completo arriba, número, y mes completo abajo
      btn.innerHTML = `<span class="day-name">${DAYS_FULL[d.getDay()]}</span><span class="day-num">${d.getDate()}</span><span class="day-month">${MONTHS_ES[curMonth]}</span>`;
    }
    btn.onclick = () => selectStripDate(stripId, iso);
    strip.appendChild(btn);
  }

  // Centrar el botón seleccionado (solo móvil; en web el strip ya llena el ancho)
  if(selectedBtn && mobile){
    requestAnimationFrame(()=>{
      const btnLeft   = selectedBtn.offsetLeft;
      const btnWidth  = selectedBtn.offsetWidth;
      const scrollW   = scroll.offsetWidth;
      scroll.scrollLeft = btnLeft - scrollW/2 + btnWidth/2;
    });
  }
}

function selectStripDate(stripId, iso){
  const inputId = stripId === 'tx-date-strip' ? 'tx-date' : 'e-date';
  document.getElementById(inputId).value = iso;

  if(!isMobileView()){
    // Web: re-centrar el strip en la fecha elegida (mantiene 5 a cada lado)
    stripOffsets[stripId] = iso;
    renderStrip(stripId, iso);
    return;
  }

  // Móvil: actualizar clase selected sin re-renderizar + scroll suave
  const strip = document.getElementById(stripId);
  strip.querySelectorAll('.date-day-btn').forEach(b=>{
    b.classList.toggle('selected', b.dataset.iso === iso);
  });
  const selectedBtn = strip.querySelector('.date-day-btn.selected');
  const scroll = document.getElementById(stripId + '-scroll');
  if(selectedBtn && scroll){
    const btnLeft  = selectedBtn.offsetLeft;
    const btnWidth = selectedBtn.offsetWidth;
    const scrollW  = scroll.offsetWidth;
    scroll.scrollTo({ left: btnLeft - scrollW/2 + btnWidth/2, behavior: 'smooth' });
  }
}

function shiftStrip(stripId, delta){
  if(isMobileView()){
    // Móvil: scroll nativo desplaza los días
    const scroll = document.getElementById(stripId + '-scroll');
    if(scroll){
      const amount = delta * (46 + 5) * 7;
      scroll.scrollBy({ left: amount, behavior: 'smooth' });
    }
  } else {
    // Web: re-centrar el strip 5 días en la dirección indicada
    const cur = stripOffsets[stripId] || localToday();
    const newCenter = addDays(cur, delta * 5);
    stripOffsets[stripId] = newCenter;
    renderStrip(stripId, newCenter);
  }
}

function initStrip(stripId, isoDate){
  stripOffsets[stripId] = isoDate;
  renderStrip(stripId, isoDate);
  // No necesitamos touch handlers — el scroll nativo ya lo maneja
}





// Aplica una fecha elegida al input y actualiza su date-strip (registro o edición)
function _applyPickedDateToStrip(inputId, stripId, iso){
  const inp=document.getElementById(inputId);
  if(inp) inp.value=iso;
  const strip=document.getElementById(stripId);
  const existing=strip?strip.querySelector(`[data-iso="${iso}"]`):null;
  if(existing){ selectStripDate(stripId, iso); }
  else { stripOffsets[stripId]=iso; renderStrip(stripId, iso); }
}

// Datepicker para el campo de fecha del REGISTRO (sin presets)
function openRegDatePicker(){
  const cur=document.getElementById('tx-date')?.value;
  openDatepicker({
    initial: cur?parseDate(cur):new Date(),
    presets:false,
    onPick:(d)=>{ _applyPickedDateToStrip('tx-date','tx-date-strip', _dpFmt(d)); }
  });
}

// Datepicker para el campo de fecha de EDICIÓN (sin presets)
function openEditDatePicker(){
  const cur=document.getElementById('e-date')?.value;
  openDatepicker({
    initial: cur?parseDate(cur):new Date(),
    presets:false,
    onPick:(d)=>{ _applyPickedDateToStrip('e-date','e-date-strip', _dpFmt(d)); }
  });
}
