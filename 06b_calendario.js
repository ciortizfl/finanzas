// ══════════════════════════════════════════════════════════════════════════
//  06b_calendario.js — Vista Calendario del Historial (R9, Fase 1)
//
//  El Historial abre por default en CALENDARIO. Un toggle superior alterna
//  entre Calendario y Filtros. El calendario NO reimplementa el listado: manda
//  el estado que renderHistorial() ya lee (selectores de mes/año + histFilter),
//  llama a renderHistorial() y luego pinta la grilla encima. renderCalendar()
//  es un pintor puro; quien fija el estado son los controles (flechas, selector
//  de tipo, toggle de vista).
// ══════════════════════════════════════════════════════════════════════════

// 'calendar' (default) | 'filters'
let histViewMode = 'calendar';
// Mes mostrado en el calendario (y, por reflejo, en el listado cuando la vista
// es calendario). Se inicializa a hoy en initCalendar().
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
// Tipo activo del selector inferior: 'todos' | 'egreso' | 'ingreso' | 'beneficio'
let calType  = 'todos';
// Día seleccionado (ISO 'YYYY-MM-DD') o null. Se marca con un círculo de color
// distinto al de "hoy" y se conserva mientras no se cambie de mes/vista.
let calSelDay = null;

const CAL_DOW = ['D','L','M','M','J','V','S']; // semana inicia en domingo (getDay 0)

// Color del monto por tipo (consistente con el segmented control de la app)
function _calAmtColor(type, bal){
  if(type==='todos')     return bal>=0 ? 'var(--green)' : 'var(--danger)';
  if(type==='egreso')    return 'var(--danger)';
  if(type==='ingreso')   return 'var(--green)';
  if(type==='beneficio') return '#af52de';
  return 'var(--text2)';
}

// Monto de celda: sin centavos, redondeado, sin signo (el color indica el signo).
// Tamaño de fuente fijo (definido en CSS) — nunca encoge; soporta "$123,456".
function _calFmtCell(n){ return '$'+Math.round(Math.abs(n)).toLocaleString('es-MX'); }

// En escritorio el mes va en UNA sola tira (31 celdas), así que la celda es
// mucho más angosta: se abrevia para que el monto quepa sin encoger la fuente.
// <1000: $123 · <100k: $2.1k · >=100k: $114k (máx. 2 enteros y 1 decimal
// mientras el valor lo permite, igual que el criterio del treemap).
function _calFmtCompact(n){
  const a=Math.round(Math.abs(n));
  if(a<1000) return '$'+a;
  const k=a/1000;
  if(k<100){ const r=Math.round(k*10)/10; return '$'+(r%1===0?String(Math.round(r)):r.toFixed(1))+'k'; }
  return '$'+Math.round(k)+'k';
}
function _calIsWide(){ return window.matchMedia && window.matchMedia('(min-width: 700px)').matches; }

// ── Inicialización al entrar al Historial ──────────────────────────────────
// Deja la vista en su estado default (Calendario, mes actual, tipo Todos) y
// sincroniza el estado que consume el listado.
function initCalendar(reset){
  if(reset){
    histViewMode='calendar';
    calType='todos';
    calSelDay=null;
    const now=new Date();
    calYear=now.getFullYear();
    calMonth=now.getMonth();
  }
  _calApplyViewClass();
  _calSyncTypeSeg();
  _calSyncListState();      // fija selectores + histFilter según el calendario
}

// Pone/quita la clase que oculta el bloque de filtros y muestra el calendario.
function _calApplyViewClass(){
  const page=document.getElementById('page-historial');
  if(!page) return;
  page.classList.toggle('cal-mode', histViewMode==='calendar');
  page.classList.toggle('filters-mode', histViewMode==='filters');
  const segCal=document.getElementById('hist-view-seg');
  if(segCal) segCal.dataset.active=histViewMode;
}

// Refleja calMonth/calYear/calType en el estado que lee renderHistorial():
// los <select> de mes/año del historial y histFilter. Limpia búsqueda, rango,
// campanita, categorías y método para que el listado muestre el mes limpio.
function _calSyncListState(){
  const mSel=document.getElementById('hist-month-sel');
  const ySel=document.getElementById('hist-year-sel');
  if(ySel){
    if(!Array.from(ySel.options).some(o=>parseInt(o.value)===calYear)){
      const o=document.createElement('option');
      o.value=String(calYear); o.textContent=String(calYear);
      ySel.appendChild(o);
    }
    ySel.value=String(calYear);
  }
  if(mSel) mSel.value=String(calMonth);
  // Estado del listado: solo el tipo del calendario, sin refinamientos.
  histFilter = calType;
  histSelCats=[]; histSelSubcats=[]; histMethodFilter=null;
  // Apagar modos alternos si por algún flujo quedaron encendidos.
  try{ if(typeof histBellMode!=='undefined' && histBellMode) setBellMode(false); }catch(e){}
  if(typeof histRangeMode!=='undefined'){ histRangeMode=false; histRangeApplied=false; }
  const s=document.getElementById('hist-search'); if(s) s.value='';
}

// ── Toggle Calendario / Filtros ─────────────────────────────────────────────
function switchHistView(mode){
  if(mode===histViewMode) return;
  const page=document.getElementById('page-historial');
  const cal=document.getElementById('hist-calendar-view');
  const flt=document.getElementById('hist-filters-view');
  histViewMode=mode;
  _calApplyViewClass();

  if(mode==='filters'){
    // Regresar la vista de calendario a su default para la próxima vez.
    calType='todos'; calSelDay=null;
    // Filtros arranca en su estado default: todos los filtros propios reiniciados.
    try{ resetHistFiltersToTodos(); }catch(e){}
    const s=document.getElementById('hist-search'); if(s && s.value){ s.value=''; try{ clearSearch(); }catch(e){} }
    if(typeof histRangeMode!=='undefined'){ histRangeMode=false; histRangeApplied=false; }
    _calAnimateOut(cal);           // el calendario se desliza hacia arriba
    _calAnimateIn(flt, 'up');      // los filtros aparecen desde abajo
    renderHistorial(true);
  } else {
    // Volver a Calendario: reiniciar filtros y regresar el calendario a hoy.
    const now=new Date(); calYear=now.getFullYear(); calMonth=now.getMonth(); calType='todos'; calSelDay=null;
    _calSyncTypeSeg();
    _calSyncListState();
    _calAnimateOut(flt);           // los filtros se van
    _calAnimateIn(cal, 'down');    // el calendario entra desde arriba
    renderHistorial(true);
  }
}

function _calAnimateIn(el, dir){
  if(!el) return;
  el.style.display='';
  const from = dir==='down' ? 'translateY(-14px)' : 'translateY(14px)';
  try{
    el.animate(
      [{opacity:0, transform:from},{opacity:1, transform:'translateY(0)'}],
      {duration:420, easing:'cubic-bezier(0.22,0.61,0.36,1)', fill:'backwards'}
    );
  }catch(e){}
}
function _calAnimateOut(el){
  if(!el) return;
  try{
    const a=el.animate(
      [{opacity:1, transform:'translateY(0)'},{opacity:0, transform:'translateY(-14px)'}],
      {duration:240, easing:'ease'}
    );
    a.onfinish=()=>{ el.style.display='none'; };
  }catch(e){ el.style.display='none'; }
}

// ── Navegación de mes ───────────────────────────────────────────────────────
function calGoMonth(delta){
  let m=calMonth+delta, y=calYear;
  if(m<0){ m=11; y--; } else if(m>11){ m=0; y++; }
  calYear=y; calMonth=m;
  calSelDay=null;          // la selección no cruza de mes
  _calSyncListState();
  renderHistorial(true);   // el wrapper repinta la grilla
}

// ── Selector de mes/año (se abre al tocar "Julio 2026") ─────────────────────
let _calMYOpen=false;
function toggleCalMonthYear(){
  const pop=document.getElementById('cal-my-pop');
  if(!pop) return;
  _calMYOpen=!_calMYOpen;
  const lbl=document.getElementById('cal-title');
  if(lbl) lbl.classList.toggle('open', _calMYOpen);
  if(_calMYOpen){ _calRenderMonthYear(); pop.classList.add('open'); }
  else pop.classList.remove('open');
}
let _calMYyear=null;
function _calRenderMonthYear(){
  if(_calMYyear===null) _calMYyear=calYear;
  const yl=document.getElementById('cal-my-year'); if(yl) yl.textContent=_calMYyear;
  const g=document.getElementById('cal-my-months'); if(!g) return;
  g.innerHTML='';
  const short=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  short.forEach((m,i)=>{
    const b=document.createElement('button'); b.type='button';
    b.className='dp-month-cell'+(i===calMonth && _calMYyear===calYear?' current':'');
    b.textContent=m;
    b.onclick=()=>{
      calMonth=i; calYear=_calMYyear;
      calSelDay=null;
      _calMYOpen=false;
      const pop=document.getElementById('cal-my-pop'); if(pop) pop.classList.remove('open');
      const lbl=document.getElementById('cal-title'); if(lbl) lbl.classList.remove('open');
      _calSyncListState();
      renderHistorial(true);
    };
    g.appendChild(b);
  });
}
function calMYYear(delta){ _calMYyear=(_calMYyear===null?calYear:_calMYyear)+delta; _calRenderMonthYear(); }

// Cerrar el selector al tocar fuera
document.addEventListener('click',(e)=>{
  if(!_calMYOpen) return;
  const pop=document.getElementById('cal-my-pop');
  const title=document.getElementById('cal-title');
  if(pop && (pop.contains(e.target) || (title&&title.contains(e.target)))) return;
  _calMYOpen=false;
  if(pop) pop.classList.remove('open');
  if(title) title.classList.remove('open');
}, true);

// ── Selector de tipo (Todos/Egresos/Ingresos/Beneficios) ────────────────────
function setCalType(type){
  if(type===calType){ return; }
  calType=type;
  _calMYOpen=false;
  _calSyncTypeSeg();
  histFilter=calType; histSelCats=[]; histSelSubcats=[];
  renderHistorial(true);
}
function _calSyncTypeSeg(){
  const seg=document.getElementById('cal-type-seg');
  if(!seg) return;
  seg.dataset.active=calType;
  seg.querySelectorAll('.calseg-option').forEach(b=>{
    b.classList.toggle('active', b.dataset.t===calType);
  });
}

// ── Pintado de la grilla (pintor puro) ──────────────────────────────────────
function renderCalendar(){
  const titleEl=document.getElementById('cal-title-text');
  if(titleEl) titleEl.textContent=`${MONTHS_ES[calMonth]} ${calYear}`;

  const grid=document.getElementById('cal-grid');
  if(!grid) return;

  // Totales por día del mes visible (excluye futuros/diferidos futuros).
  const byDay={}; // dayNum -> {inc,exp,ben}
  const monthHas={egreso:false, ingreso:false, beneficio:false};
  data.forEach(e=>{
    if(isFutureEntry(e)) return;
    const d=parseDate(e.date);
    if(isNaN(d.getTime())) return;
    if(d.getMonth()!==calMonth || d.getFullYear()!==calYear) return;
    const day=d.getDate();
    if(!byDay[day]) byDay[day]={inc:0,exp:0,ben:0};
    if(e.type==='ingreso'){ byDay[day].inc+=e.amountMXN; monthHas.ingreso=true; }
    else if(e.type==='egreso'){ byDay[day].exp+=e.amountMXN; monthHas.egreso=true; }
    else if(e.type==='beneficio'){ byDay[day].ben+=e.amountMXN; monthHas.beneficio=true; }
  });
  // Un tipo sin registros este mes no es seleccionable.
  _calSyncTypeAvailability(monthHas);

  const valueFor=(t)=>{
    if(!t) return {show:false};
    if(calType==='todos'){
      if(t.inc===0 && t.exp===0) return {show:false};
      return {show:true, val:t.inc-t.exp};
    }
    if(calType==='egreso')    return t.exp>0 ? {show:true,val:t.exp} : {show:false};
    if(calType==='ingreso')   return t.inc>0 ? {show:true,val:t.inc} : {show:false};
    if(calType==='beneficio') return t.ben>0 ? {show:true,val:t.ben} : {show:false};
    return {show:false};
  };

  const wide=_calIsWide();
  grid.innerHTML='';
  // Encabezado de días de la semana (oculto por CSS en la tira horizontal)
  const head=document.createElement('div'); head.className='cal-dow-row';
  CAL_DOW.forEach(d=>{ const c=document.createElement('div'); c.className='cal-dow'; c.textContent=d; head.appendChild(c); });
  grid.appendChild(head);

  const cells=document.createElement('div'); cells.className='cal-cells';
  const firstDow=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);

  for(let i=0;i<firstDow;i++){ const e=document.createElement('div'); e.className='cal-cell empty'; cells.appendChild(e); }

  for(let day=1;day<=daysInMonth;day++){
    const info=valueFor(byDay[day]);
    const dObj=new Date(calYear,calMonth,day);
    const iso=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday=dObj.getTime()===today.getTime();
    const cell=document.createElement('div');
    cell.className='cal-cell'+(info.show?' has-amt':' no-amt')+(isToday?' today':'')
      +(calSelDay===iso?' cal-sel':'');

    const num=document.createElement('div'); num.className='cal-num'; num.textContent=day;
    cell.appendChild(num);

    if(info.show){
      const amt=document.createElement('div'); amt.className='cal-amt';
      amt.textContent = wide ? _calFmtCompact(info.val) : _calFmtCell(info.val);
      amt.style.color=_calAmtColor(calType, info.val);
      cell.appendChild(amt);
      // Día clickeable → seleccionar + scroll suave al día en el listado
      cell.classList.add('cal-clickable');
      cell.onclick=()=>calSelectDay(iso);
    }
    cells.appendChild(cell);
  }
  grid.appendChild(cells);
}

// Habilita/deshabilita las opciones del selector de tipo según haya registros
// de ese tipo en el mes visible. Si el tipo activo se queda sin datos, regresa
// a "Todos" para no dejar el calendario vacío sin explicación.
function _calSyncTypeAvailability(monthHas){
  const seg=document.getElementById('cal-type-seg');
  if(!seg) return;
  seg.querySelectorAll('.calseg-option').forEach(b=>{
    const t=b.dataset.t;
    const avail = (t==='todos') ? true : !!monthHas[t];
    b.disabled=!avail;
  });
  if(calType!=='todos' && !monthHas[calType]){
    calType='todos';
    histFilter='todos'; histSelCats=[]; histSelSubcats=[];
    _calSyncTypeSeg();
  }
}

// Selección de día: marca el círculo y hace scroll al día en el listado.
function calSelectDay(iso){
  calSelDay=iso;
  renderCalendar();          // repinta para mostrar el círculo de selección
  calScrollToDay(iso);
}

// ── Scroll suave al día dentro del listado ──────────────────────────────────
function calScrollToDay(iso){
  const hdr=document.querySelector(`#hist-list .day-group-hdr[data-date="${iso}"]`);
  if(!hdr) return;
  const rectTop=hdr.getBoundingClientRect().top + window.scrollY;
  // Un respiro arriba para que el encabezado no quede pegado al borde superior.
  const targetY=Math.max(0, rectTop - 90);

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){ window.scrollTo(0, targetY); _calFlashDay(hdr); return; }

  const startY=window.scrollY;
  const dist=targetY-startY;
  const absd=Math.abs(dist);
  if(absd<2){ _calFlashDay(hdr); return; }
  // Duración proporcional a la distancia: arranca suave, desacelera al final,
  // y evita "latigazos" en distancias cortas (mínimo 300ms, máximo 900ms).
  const dur=Math.min(900, Math.max(300, absd*0.5));
  const t0=performance.now();
  const easeOut=t=>1-Math.pow(1-t,3);
  function step(now){
    const p=Math.min(1,(now-t0)/dur);
    window.scrollTo(0, startY + dist*easeOut(p));
    if(p<1) requestAnimationFrame(step);
    else _calFlashDay(hdr);
  }
  requestAnimationFrame(step);
}

// Realce breve del día de destino (mismo lenguaje que el resalte tras editar).
function _calFlashDay(hdr){
  try{
    hdr.animate(
      [{backgroundColor:'var(--accent-light)'},{backgroundColor:'transparent'}],
      {duration:900, easing:'ease-out'}
    );
  }catch(e){}
}
