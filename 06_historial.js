// Lo que el historial está mostrando AHORA MISMO (tras todos los filtros:
// fecha/rango, búsqueda, tipo, categorías, subcategorías y método).
// La exportación a CSV usa exactamente esta lista.
let lastFilteredEntries=[];


// ══════════ BÚSQUEDA AMPLIADA ══════════
// Además del texto (descripción, notas, categorías, método), el buscador entiende:
//  · FECHAS escritas: "abril", "abril 1", "1 abril", "1 abril 2026", "abril 2026", "2026"
//  · MONTOS exactos: "1009", "1,009.00", "$6054" — busca en el monto del registro,
//    en su equivalente en pesos, en el total original del diferido, en el monto
//    original (madre + hijos) y en cualquier número escrito dentro de las notas.
const MESES_ES_BUSCADOR = {
  enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6,
  agosto:7, septiembre:8, setiembre:8, octubre:9, noviembre:10, diciembre:11
};

// Interpreta la consulta como fecha. Devuelve {day?, month?, year?} o null.
function parseDateQuery(q){
  const t=String(q||'').toLowerCase().trim().replace(/\s+de\s+/g,' ').replace(/[,]/g,' ');
  if(!t) return null;
  const tokens=t.split(/\s+/).filter(Boolean);
  if(tokens.length===0 || tokens.length>3) return null;
  let day=null, month=null, year=null;
  for(const tk of tokens){
    if(tk in MESES_ES_BUSCADOR){
      if(month!==null) return null;
      month=MESES_ES_BUSCADOR[tk];
      continue;
    }
    // Mes abreviado (ene, feb, sep…), mínimo 3 letras
    if(/^[a-záéíóú]{3,}$/.test(tk)){
      const hit=Object.keys(MESES_ES_BUSCADOR).find(m=>m.startsWith(tk));
      if(hit && month===null){ month=MESES_ES_BUSCADOR[hit]; continue; }
      return null;
    }
    if(/^\d{4}$/.test(tk)){
      const n=Number(tk);
      if(n>=1990 && n<=2100){ if(year!==null) return null; year=n; continue; }
      return null;
    }
    if(/^\d{1,2}$/.test(tk)){
      const n=Number(tk);
      if(n>=1 && n<=31){ if(day!==null) return null; day=n; continue; }
      return null;
    }
    return null;
  }
  // Un año solo, o un mes solo, o combinaciones con mes. Un día suelto NO basta
  // (sería ambiguo con un monto).
  if(month===null && year===null) return null;
  if(day!==null && month===null) return null;
  return {day, month, year};
}

function entryMatchesDateQuery(e, dq){
  const d=parseDate(e.date);
  if(isNaN(d.getTime())) return false;
  if(dq.year!==null && dq.year!==undefined && d.getFullYear()!==dq.year) return false;
  if(dq.month!==null && dq.month!==undefined && d.getMonth()!==dq.month) return false;
  if(dq.day!==null && dq.day!==undefined && d.getDate()!==dq.day) return false;
  return true;
}

// Interpreta la consulta como monto. "1,009.00" / "$1009" / "1009" → 1009
function parseAmountQuery(q){
  const t=String(q||'').trim().replace(/[$\s]/g,'').replace(/,/g,'');
  if(!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n=Number(t);
  return isNaN(n) ? null : n;
}

// ¿Alguno de los montos relacionados con este registro coincide con el buscado?
function entryMatchesAmount(e, target){
  const eq=(v)=>v!==undefined && v!==null && Math.abs(Number(v)-target) < 0.005;
  if(eq(e.amount) || eq(e.amountMXN)) return true;
  if(e.deferOriginal && eq(e.deferOriginal)) return true;
  // Monto original de la madre (ella + sus hijos que la redujeron)
  if(!e.linkedTo){
    const hijos=data.filter(x=>x.linkedTo===e.id);
    if(hijos.length){
      const desg=hijos.filter(isDesglose).reduce((s,h)=>s+h.amount,0);
      const ben=hijos.filter(h=>h.type==='beneficio').reduce((s,h)=>s+h.amount,0);
      // En un diferido, el beneficio NO redujo la mensualidad (se acredita aparte):
      // el cargo del mes es madre + desgloses. En un gasto normal, el beneficio sí
      // se restó, así que el monto original lo incluye. Se aceptan ambos.
      if(eq(e.amount+desg)) return true;
      if(eq(e.amount+desg+ben)) return true;
    }
  }
  // Números escritos dentro de la nota (montos originales, porcentajes de $X…)
  const nums=String(e.note||'').match(/\d[\d,]*(?:\.\d{1,2})?/g);
  if(nums){
    for(const raw of nums){
      if(eq(Number(raw.replace(/,/g,'')))) return true;
    }
  }
  return false;
}

// Filtro maestro: texto, fecha escrita o monto exacto
function entryMatchesQuery(e, q){
  const query=String(q||'').trim().toLowerCase();
  if(!query) return true;
  const hay=[e.desc||'', e.note||'', e.category||'', e.subcategory||'', e.method||''].join(' ').toLowerCase();
  if(hay.includes(query)) return true;
  const dq=parseDateQuery(query);
  if(dq && entryMatchesDateQuery(e, dq)) return true;
  const aq=parseAmountQuery(query);
  if(aq!==null && entryMatchesAmount(e, aq)) return true;
  return false;
}

// ── MODO CAMPANITA (🔔): solo registros con recordatorio MANUAL, en secciones ──
let histBellMode=false;

function setBellMode(on){
  histBellMode=!!on;
  const btn=document.getElementById('hist-bell-toggle');
  if(btn){
    btn.style.borderColor = on ? 'var(--accent)' : 'var(--border2)';
    btn.style.color = on ? 'var(--accent)' : 'var(--text3)';
  }
  // En campanita no hay filtros de tipo/categoría/método: la barra se oculta
  const fb=document.getElementById('hist-filter-bar');
  if(fb) fb.style.display = on ? 'none' : '';
  const bellRow=document.getElementById('hist-bell-row');
  if(bellRow) bellRow.style.display = on ? 'flex' : 'none';
  const sp=document.getElementById('sub-filter-panel'); if(sp) sp.classList.remove('vis');
  const mr=document.getElementById('method-filter-row'); if(mr) mr.style.display='none';
  const ma=document.getElementById('method-filter-arrow'); if(ma) ma.style.transform='';
  // Estado limpio en ambas direcciones; al salir, además, se limpia la búsqueda
  histFilter='todos'; histSelCats=[]; histSelSubcats=[]; histMethodFilter=null;
  document.querySelectorAll('.filter-bar .f-chip').forEach(ch=>ch.classList.remove('active'));
  document.getElementById('fchip-todos')?.classList.add('active');
  if(!on){
    const s=document.getElementById('hist-search'); if(s) s.value='';
  }
}

function toggleBellFilter(){
  setBellMode(!histBellMode);
  try{ updateResetButton(); }catch(e){}
  renderHistorial(true); // misma cascada de entrada que el listado principal/rango
}

// Clasificación de una regla manual en su sección de la vista campanita:
// 0 = indefinidos semanales · 1 = indefinidos mensuales · 2 = con fecha fin · 3 = concluidos
function bellSectionOf(rule){
  const hoy=localToday();
  if(rule.until && rule.until < hoy) return 3;
  if(rule.until) return 2;
  return rule.freq==='weekly' ? 0 : 1;
}

// Render de la vista campanita: secciones en el orden acordado, con las filas
// normales (tocables para abrir la edición). La búsqueda por palabra clave y
// los chips de presets siguen funcionando dentro de esta vista.
function renderBellView(hl, hlReal, searchQuery, animate){
  const BELL_SECS=[
    '🔁 Indefinidos · semanales',
    '📆 Indefinidos · mensuales',
    '⏳ Con fecha final',
    '✔️ Concluidos'
  ];
  const rules=(typeof reminderConfig!=='undefined' && Array.isArray(reminderConfig.manual))
    ? reminderConfig.manual : [];
  if(rules.length===0){
    lastFilteredEntries=[];
    hl.innerHTML='<div class="empty"><div class="e-ico">🔔</div>Aún no tienes recordatorios manuales</div>';
    hlReal.replaceChildren(...hl.childNodes);
    renderPie([]);
    return;
  }
  const keyOf=e=>e.type+'||'+String(e.desc||'').trim().toLowerCase();
  const map={};
  rules.forEach(r=>{ map[(r.type+'||'+String(r.desc||'').trim().toLowerCase())]={rule:r, sec:bellSectionOf(r)}; });

  let entries=data.filter(e=>{
    if(e.linkedTo) return false;
    return !!map[keyOf(e)];
  });
  if(searchQuery){
    entries=entries.filter(e=>entryMatchesQuery(e, searchQuery));
  }
  if(entries.length===0){
    lastFilteredEntries=[];
    hl.innerHTML='<div class="empty"><div class="e-ico">🔍</div>Sin coincidencias entre tus recordatorios</div>';
    hlReal.replaceChildren(...hl.childNodes);
    renderPie([]);
    return;
  }
  entries.sort((a,b)=>{
    const sa=map[keyOf(a)].sec, sb=map[keyOf(b)].sec;
    if(sa!==sb) return sa-sb;
    return parseDate(b.date)-parseDate(a.date) || (b.amountMXN||0)-(a.amountMXN||0);
  });
  lastFilteredEntries=entries;

  // MISMA estructura visual que el listado principal: encabezado de día +
  // tarjeta .tx-list con las filas (tocables, con botón de borrar), agrupadas
  // dentro de cada sección de recordatorio.
  const container=document.createElement('div');
  container.style.paddingBottom='8px';
  let curSec=-1, curDay='', listWrap=null;
  entries.forEach(e=>{
    const sec=map[keyOf(e)].sec;
    if(sec!==curSec){
      curSec=sec; curDay='';
      const n=entries.filter(x=>map[keyOf(x)].sec===sec).length;
      const h=document.createElement('div');
      h.className='bell-sec-hdr';
      h.innerHTML=`${BELL_SECS[sec]} <span class="bell-sec-count">· ${n}</span>`;
      container.appendChild(h);
    }
    const dayKey=String(e.date).slice(0,10);
    if(dayKey!==curDay){
      curDay=dayKey;
      const d=parseDate(dayKey);
      const hdr=document.createElement('div');
      hdr.className='day-group-hdr';
      hdr.innerHTML=`<span>${d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>`;
      hdr.style.display='flex';
      hdr.style.alignItems='center';
      container.appendChild(hdr);
      listWrap=document.createElement('div');
      listWrap.className='tx-list';
      listWrap.style.marginBottom='4px';
      container.appendChild(listWrap);
    }
    const el=txEl(e,true);
    el.classList.add('tappable');
    el._entryId=e.id;
    el._parentId=e.linkedTo?e.linkedTo:e.id;
    el.onclick=(ev)=>{
      if(ev.target.classList.contains('tx-delete-btn')) return;
      openEdit(e.linkedTo?e.linkedTo:e.id);
    };
    listWrap.appendChild(el);
  });
  hl.appendChild(container);
  hlReal.replaceChildren(...hl.childNodes);
  if(animate===true){ revealAnimate(container, true); }
  renderPie([]);
}

// ── PRESETS DE BÚSQUEDA ──
// Los comercios más comunes del último año, ponderados por cuartos de
// antigüedad (0-91d→4, 92-182d→3, 183-273d→2, 274-365d→1). Cada compra suma
// (sin tope semanal: 3 McDonald's en una semana suman 3, para que el ranking
// refleje hábitos reales y tenga dinamismo). Un gasto diferido cuenta 1 sola
// vez, no una por mensualidad.
//
// R7 · BOOST DE RECENCIA. Encima del score histórico va un multiplicador que
// premia lo que compraste hace poquito:  mult = 1 + FUERZA × 0.5^(días/VIDA_MEDIA)
// donde `días` = días desde la ÚLTIMA compra de ese comercio. Fuera de la
// VENTANA, mult = 1 (el boost desaparece y manda el hábito).
//
// Los tres parámetros, en una línea, para moverlos sin buscar nada:
const CHIP_BOOST = { FUERZA: 1.5, VIDA_MEDIA: 2.5, VENTANA: 14 };
//
// Con estos valores: hoy ×2.50 · 1d ×2.14 · 2d ×1.86 · 3d ×1.65 · 5d ×1.38
//                    7d ×1.22 · 10d ×1.09 · 13d ×1.04 · 14d+ ×1.00
// OJO con la VENTANA: la especificación original la ponía en 7, pero con FUERZA
// alta eso deja un acantilado (día 6 ×1.28 → día 7 ×1.00, 28 puntos de golpe).
// En 14 el boost se apaga solo. Bajarla a 7 es cambiar un número.
function chipRecencyMult(dias){
  if(!(dias >= 0)) return 1;
  if(dias >= CHIP_BOOST.VENTANA) return 1;
  return 1 + CHIP_BOOST.FUERZA * Math.pow(0.5, dias / CHIP_BOOST.VIDA_MEDIA);
}

function computeSearchPresets(){
  const DAY=86400000, now=Date.now();
  const seenDefer=new Set();  // grupos de diferido ya contados
  const score={}, display={}, lastT={};
  data.forEach(e=>{
    if(e.linkedTo) return;                 // propinas/beneficios/desgloses no votan
    const desc=(e.desc||'').trim();
    if(desc.length<2) return;
    const d=parseDate(e.date);
    if(isNaN(d.getTime())) return;
    const t=d.getTime();
    const age=(now-t)/DAY;
    if(age<0 || age>365) return;           // solo último año; sin fechas futuras
    const key=desc.toLowerCase();
    if(e.deferGroup){
      const g=String(e.deferGroup);        // un diferido = 1 sola ocurrencia
      if(seenDefer.has(g)) return;
      seenDefer.add(g);
    }
    let w=1;
    if(age<=91) w=4; else if(age<=182) w=3; else if(age<=273) w=2;
    score[key]=(score[key]||0)+w;
    if(!display[key]) display[key]=desc;   // data va reciente→viejo: casing más reciente
    if(!lastT[key] || t>lastT[key]) lastT[key]=t;
  });
  // Score final = histórico × boost de recencia. Los días se cuentan por DÍA
  // (no por horas): comprado hoy = 0, ayer = 1.
  const hoyT=parseDate(localToday()).getTime();
  const boosted={};
  Object.keys(score).forEach(k=>{
    const dias=Math.round((hoyT - lastT[k]) / DAY);
    boosted[k]=score[k] * chipRecencyMult(dias);
  });
  return Object.keys(boosted)
    .sort((a,b)=> boosted[b]-boosted[a] || lastT[b]-lastT[a])
    .slice(0,20)          // cantera amplia; el tope real lo pone renderSearchPresets
    .map(k=>display[k]);
}

function renderSearchPresets(){
  const box=document.getElementById('hist-presets');
  if(!box) return;
  const names=computeSearchPresets();
  const cap=(window.innerWidth<=640)?5:15;   // móvil: máx 5 · web: máx 15
  const current=(document.getElementById('hist-search')?.value||'').trim().toLowerCase();
  box.innerHTML='';
  names.slice(0,cap).forEach(name=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='preset-chip'+(name.toLowerCase()===current?' active':'');
    b.textContent=name;
    b.onclick=()=>{
      const s=document.getElementById('hist-search');
      if(!s) return;
      const yaActivo=s.value.trim().toLowerCase()===name.toLowerCase();
      if(yaActivo){
        s.value='';                        // desactivar: solo limpia el texto
      } else {
        s.value=name;                      // activar: escribe por ti y arranca en Todos
        histFilter='todos'; histSelCats=[]; histSelSubcats=[];
        document.querySelectorAll('.filter-bar .f-chip').forEach(c=>c.classList.remove('active'));
        const todosChip=document.getElementById('fchip-todos');
        if(todosChip) todosChip.classList.add('active');
        const subPanel=document.getElementById('sub-filter-panel');
        if(subPanel) subPanel.classList.remove('vis');
      }
      onHistSearchInput();                 // misma ruta que teclear en el buscador
    };
    box.appendChild(b);
  });
  // Recorte a UN renglón: quitar los menos comunes hasta que quepan completos.
  // OJO: la medición se hace con el layout NATURAL (flex-start). Con
  // 'space-between' el último chip se estira hasta el borde y la medición
  // sale siempre "no cabe" (bug que dejaba un solo chip). Por eso se mide
  // primero y la justificación se aplica al final.
  if(box.clientWidth>0){
    const fits=()=>{
      const last=box.lastElementChild;
      if(!last) return true;
      return (last.offsetLeft + last.offsetWidth) <= box.clientWidth;
    };
    let guard=25;
    while(box.lastElementChild && guard-->0 && !fits()){
      box.removeChild(box.lastElementChild);
    }
  }
}

// ── ORDEN DENTRO DE UN DÍA ──
// 1) Ingresos, de mayor a menor
// 2) Egresos, de mayor a menor
// 3) Beneficios sueltos (sin madre), de mayor a menor
// Los hijos (desgloses, propinas, beneficios vinculados) van SIEMPRE pegados a
// su madre, justo debajo, ordenados entre ellos de mayor a menor. La posición en
// el ranking la define el monto FINAL de la madre.
function orderDayEntries(entries){
  const byId={};
  entries.forEach(e=>{ byId[e.id]=e; });
  const madres=entries.filter(e=>!e.linkedTo);
  const hijosDe={};
  entries.forEach(e=>{
    if(!e.linkedTo) return;
    (hijosDe[e.linkedTo]=hijosDe[e.linkedTo]||[]).push(e);
  });
  const desc=(a,b)=>(b.amountMXN||0)-(a.amountMXN||0);
  const grupo=(rank)=>rank.sort(desc).flatMap(m=>{
    const hijos=(hijosDe[m.id]||[]).sort(desc);
    return [m, ...hijos];
  });
  const ingresos = grupo(madres.filter(e=>e.type==='ingreso'));
  const egresos  = grupo(madres.filter(e=>e.type==='egreso'));
  const benef    = grupo(madres.filter(e=>e.type!=='ingreso' && e.type!=='egreso'));
  const out=[...ingresos, ...egresos, ...benef];
  // Salvavidas: si algún hijo quedó huérfano (su madre no está en este día,
  // p. ej. filtrada), se agrega al final para no perderlo de la vista.
  entries.forEach(e=>{ if(!out.includes(e)) out.push(e); });
  return out;
}

function entriesInCurrentDateScope(type){
  const mSel=document.getElementById('hist-month-sel');
  const ySel=document.getElementById('hist-year-sel');
  const selMonth=mSel?parseInt(mSel.value):new Date().getMonth();
  const selYear=ySel?parseInt(ySel.value):new Date().getFullYear();
  const rangeActive = histRangeMode && histRangeApplied;
  // En modo rango, la búsqueda también acota el universo de categorías preseleccionadas
  const searchEl=document.getElementById('hist-search');
  const sq=(searchEl?.value||'').trim().toLowerCase();
  return data.filter(e=>{
    if(isFutureEntry(e)) return false;
    if(type && e.type!==type) return false;
    const d=parseDate(e.date);
    if(rangeActive){
      const fromEl=document.getElementById('hist-range-from');
      const toEl=document.getElementById('hist-range-to');
      const from=fromEl&&fromEl.value?parseDate(fromEl.value):null;
      const to=toEl&&toEl.value?parseDate(toEl.value):null;
      if(from && d<from) return false;
      if(to && d>to) return false;
      // Aplicar búsqueda dentro del rango si hay texto
      if(sq && !entryMatchesQuery(e, sq)) return false;
      return true;
    }
    // Vista mensual: si hay búsqueda, el universo son las coincidencias en TODO
    // el tiempo (la búsqueda ignora el mes); si no, el mes/año seleccionado.
    if(sq) return entryMatchesQuery(e, sq);
    return d.getMonth()===selMonth&&d.getFullYear()===selYear;
  });
}

// Manejo del input de búsqueda. Teclear NO toca tus selecciones (como siempre fue);
// solo en modo rango cambiar la búsqueda resetea a "Todos" (diseño del rango).
// El reseteo al usar un chip de comercio lo hace el propio chip (es un shortcut
// que "escribe por ti" y arranca la vista limpia en Todos).
function onHistSearchInput(){
  if(histRangeMode && histRangeApplied){
    histFilter='todos'; histSelCats=[]; histSelSubcats=[];
    document.querySelectorAll('.filter-bar .f-chip').forEach(c=>c.classList.remove('active'));
    const todosChip=document.getElementById('fchip-todos');
    if(todosChip) todosChip.classList.add('active');
    const subPanel=document.getElementById('sub-filter-panel');
    if(subPanel) subPanel.classList.remove('vis');
  }
  updateResetButton();
  renderHistorial();
}

function setFilter(f,el){
  histFilter=f;
  histSelCats=[]; histSelSubcats=[];
  document.querySelectorAll('.f-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');

  const rangeActive = histRangeMode && histRangeApplied;
  const searchEl=document.getElementById('hist-search');
  const hasSearch=(searchEl?.value||'').trim().length>0;
  // Auto-seleccionar categorías con registros:
  //  - Ingresos y beneficios: siempre todas activas por defecto.
  //  - Egresos en rango: NO preselecciona. Los chips arrancan "apagados" y el usuario
  //    los va activando (Casa → subcategorías apagadas → activa las que quiera).
  //    La lista muestra todos los egresos mientras no haya categorías activas.
  if(f!=='todos' && f!=='egreso'){
    const typed=entriesInCurrentDateScope(f);
    histSelCats=[...new Set(typed.map(e=>e.category))];
  }

  buildSubFilterPanel();
  updateResetButton();
  renderHistorial();
}

// Muestra el botón "Limpiar filtros" solo cuando hay algún filtro activo
function updateResetButton(){
  const btn=document.getElementById('reset-filters-btn');
  if(!btn) return;
  const searchVal=(document.getElementById('hist-search')?.value||'').trim();
  const hasActiveFilter =
    histFilter!=='todos' ||
    histMethodFilter!==null ||
    searchVal.length>0;
  btn.style.display = hasActiveFilter ? 'flex' : 'none';
}

// Restablece los filtros del historial MANTENIENDO el tipo actual
// (egreso/ingreso/beneficio). Solo limpia categorías, subcategorías, método y búsqueda.
function resetAllFilters(){
  // Conservar histFilter — no volver a "todos"
  histSelCats=[];
  histSelSubcats=[];
  histMethodFilter=null;
  // Reset método de pago
  document.querySelectorAll('#method-filter-row .f-chip').forEach(b=>b.classList.remove('active'));
  const methodAll=document.getElementById('method-filter-all');
  if(methodAll) methodAll.classList.add('active');
  updateMethodIndicator();
  // Cerrar panel de métodos si está abierto
  const methodRow=document.getElementById('method-filter-row');
  const methodArrow=document.getElementById('method-filter-arrow');
  if(methodRow) methodRow.style.display='none';
  if(methodArrow) methodArrow.style.transform='';
  // Reset búsqueda
  const search=document.getElementById('hist-search');
  if(search) search.value='';
  const searchClear=document.getElementById('hist-search-clear');
  if(searchClear) searchClear.style.display='none';
  // Si hay un tipo activo (no "todos"), re-seleccionar sus categorías con registros
  // (mismo comportamiento que al entrar a ese tipo desde cero), respetando el rango
  if(histFilter!=='todos'&&histFilter!=='egreso'){
    const typed=entriesInCurrentDateScope(histFilter);
    histSelCats=[...new Set(typed.map(e=>e.category))];
  }
  // Reconstruir y re-renderizar
  buildSubFilterPanel();
  updateResetButton();
  renderHistorial();
}

function buildSubFilterPanel(){
  const panel=document.getElementById('sub-filter-panel');
  const catsWrap=document.getElementById('sub-filter-cats');
  const subcatsWrap=document.getElementById('sub-filter-subcats-wrap');
  const title=document.getElementById('sub-filter-title');
  catsWrap.innerHTML=''; subcatsWrap.style.display='none';

  if(histFilter==='todos'){ panel.classList.remove('vis'); return; }
  panel.classList.add('vis');

  const catList = histFilter==='egreso'
    ? Object.keys(CATS.egreso)
    : histFilter==='ingreso'
    ? Object.keys(CATS.ingreso)
    : Object.keys(CATS[histFilter]||{});

  // Conjunto base según fecha (rango/mes) Y búsqueda (en modo rango): usa el helper
  const typed=entriesInCurrentDateScope(histFilter);
  const catsWithRec=new Set(typed.map(e=>e.category));

  // Solo mostrar categorías CON registros en el periodo (las vacías se ocultan,
  // no se muestran deshabilitadas: ahorran espacio y no aportan al filtro).
  const withRec=[...catList].filter(c=>c!=='Otros'&&catsWithRec.has(c)).sort((a,b)=>a.localeCompare(b,'es'));
  const otros=(catList.includes('Otros')&&catsWithRec.has('Otros'))?['Otros']:[];
  const ordered=[...withRec,...otros];

  // Si NO aporta filtrar, ocultar todo el panel:
  //  - Solo hay 1 categoría con registros, Y
  //  - esa categoría tiene 0 o 1 subcategoría con registros.
  // (Aplica a egreso, ingreso y beneficio: sin opciones que discriminar, sobra el panel.)
  if(ordered.length<=1){
    const subsWithRec=new Set(typed.map(e=>e.subcategory).filter(Boolean));
    if(subsWithRec.size<=1){
      panel.classList.remove('vis');
      return;
    }
  }

  title.textContent='Filtrar por categoría';

  // Show cat toggle for non-egreso (all pre-selected) OR egreso with >1 cat selected
  const showCatToggle = histFilter!=='egreso' || histSelCats.length>1;
  const catToggle=document.getElementById('cat-all-toggle');
  const catSep=document.getElementById('cat-toggle-sep');
  if(catToggle){
    catToggle.style.display=showCatToggle?'inline':'none';
    if(catSep) catSep.style.display=showCatToggle?'inline':'none';
    catToggle.textContent=histSelCats.length>0?'●':'○';
  }

  ordered.forEach(cat=>{
    const hasRec=true; // ya solo iteramos las que tienen registros
    const active=histSelCats.includes(cat);
    const b=document.createElement('button');
    b.className='sf-chip'+(active?' active':'')+(histFilter==='egreso'?' r':'');
    b.textContent=cat;
    {
      b.onclick=()=>{
        if(histSelCats.includes(cat)) histSelCats=histSelCats.filter(c=>c!==cat);
        else histSelCats.push(cat);
        b.classList.toggle('active', histSelCats.includes(cat));
        histSelSubcats=[];
        syncCatToggle();
        // Show/hide cat toggle for egreso based on count
        if(histFilter==='egreso'){
          const catToggle=document.getElementById('cat-all-toggle');
          const catSep=document.getElementById('cat-toggle-sep');
          const show=histSelCats.length>1;
          if(catToggle){ catToggle.style.display=show?'inline':'none'; if(catSep) catSep.style.display=show?'inline':'none'; }
        }
        buildSubcatFilter();
      };
    }
    catsWrap.appendChild(b);
  });

  if(histFilter==='egreso') buildSubcatFilter();
}

function buildSubcatFilter(){
  const wrap=document.getElementById('sub-filter-subcats-wrap');
  const container=document.getElementById('sub-filter-subcats');
  container.innerHTML='';
  if(histFilter!=='egreso'){ wrap.style.display='none'; renderHistorial(); return; }
  // Hide subcats until user selects at least one category
  if(histSelCats.length===0){ wrap.style.display='none'; renderHistorial(); return; }

  const allPossible=[];
  histSelCats.forEach(cat=>{
    (CATS.egreso[cat]||[]).filter(s=>s!=='—').forEach(s=>{ if(!allPossible.includes(s)) allPossible.push(s); });
  });
  const catsToShow=histSelCats;

  // Base: egresos en el alcance de fecha Y búsqueda (helper), dentro de las cats elegidas
  const baseFiltered=entriesInCurrentDateScope('egreso')
    .filter(e=>histSelCats.includes(e.category));
  const hasRecords=new Set(baseFiltered.map(e=>e.subcategory).filter(Boolean));

  if(allPossible.length===0){ wrap.style.display='none'; renderHistorial(); return; }

  const showGroups = histSelCats.length!==1;

  // Always show the wrap for egreso
  wrap.style.display='block';
  const globalToggle=document.getElementById('subcat-all-toggle');
  const globalSep=wrap.querySelector('span[style*="color:var(--text3)"]');
  // Global toggle always visible for egreso
  if(globalToggle) globalToggle.style.display='inline';
  if(globalSep) globalSep.style.display='inline';

  // Auto-activate all subcats with records if none selected yet
  if(histSelSubcats.length===0){
    histSelSubcats=[...hasRecords].filter(s=>allPossible.includes(s));
  }

  if(showGroups){
    catsToShow.forEach(cat=>{
      const subs=(CATS.egreso[cat]||[]).filter(s=>s!=='—');
      if(subs.length===0) return;
      // Solo subcategorías con registros (las vacías se ocultan)
      const withR=subs.filter(s=>s!=='Otros'&&hasRecords.has(s)).sort((a,b)=>a.localeCompare(b,'es'));
      const ots=(subs.includes('Otros')&&hasRecords.has('Otros'))?['Otros']:[];
      const groupSubs=[...withR,...ots];
      if(groupSubs.length===0) return; // grupo sin registros: no mostrarlo
      const groupActiveSubs=groupSubs.filter(s=>hasRecords.has(s));

      // Group header with inline toggle
      const hdr=document.createElement('div');
      hdr.style.cssText='display:flex;align-items:center;gap:6px;margin:10px 0 6px;width:100%';
      const toggleBtn=document.createElement('button');
      const groupAllActive=groupActiveSubs.every(s=>histSelSubcats.includes(s));
      toggleBtn.textContent=groupAllActive?'●':'○';
      toggleBtn.style.cssText='background:none;border:none;cursor:pointer;font-size:13px;color:var(--text3);padding:0;line-height:1;flex-shrink:0;';
      toggleBtn.onclick=()=>{
        if(groupActiveSubs.every(s=>histSelSubcats.includes(s))){
          histSelSubcats=histSelSubcats.filter(s=>!groupActiveSubs.includes(s));
          toggleBtn.textContent='○';
        } else {
          groupActiveSubs.forEach(s=>{ if(!histSelSubcats.includes(s)) histSelSubcats.push(s); });
          toggleBtn.textContent='●';
        }
        // Refresh chip states
        container.querySelectorAll('.sf-chip').forEach(b=>{
          b.classList.toggle('active', histSelSubcats.includes(b.textContent.trim()));
        });
        syncGlobalSubToggle();
        renderHistorial();
      };
      const sep=document.createElement('span');
      sep.textContent='|';
      sep.style.cssText='color:var(--text3);font-size:11px;';
      const label=document.createElement('span');
      label.textContent=cat;
      label.style.cssText='font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;';
      hdr.appendChild(toggleBtn); hdr.appendChild(sep); hdr.appendChild(label);
      container.appendChild(hdr);
      groupSubs.forEach(sub=>appendSubChip(sub,hasRecords,container));
    });
  } else {
    const withR=allPossible.filter(s=>s!=='Otros'&&hasRecords.has(s)).sort((a,b)=>a.localeCompare(b,'es'));
    const ots=(allPossible.includes('Otros')&&hasRecords.has('Otros'))?['Otros']:[];
    [...withR,...ots].forEach(sub=>appendSubChip(sub,hasRecords,container));
  }

  renderHistorial();
  syncGlobalSubToggle();
}

function syncGlobalSubToggle(){
  const btn=document.getElementById('subcat-all-toggle');
  if(btn) btn.textContent=histSelSubcats.length>0?'●':'○';
}

function syncCatToggle(){
  const btn=document.getElementById('cat-all-toggle');
  if(btn) btn.textContent=histSelCats.length>0?'●':'○';
}

function toggleAllCats(){
  const chips=document.querySelectorAll('#sub-filter-cats .sf-chip:not([disabled])');
  const allActive=histSelCats.length>0;
  histSelCats=[];
  histSelSubcats=[];
  if(!allActive){
    chips.forEach(b=>{ histSelCats.push(b.textContent.trim()); b.classList.add('active'); });
  } else {
    chips.forEach(b=>b.classList.remove('active'));
  }
  syncCatToggle();
  buildSubcatFilter();
}

function toggleAllSubcats(){
  const chips=document.querySelectorAll('#sub-filter-subcats .sf-chip:not([disabled])');
  const allActive=histSelSubcats.length>0;
  histSelSubcats=[];
  if(!allActive){
    chips.forEach(b=>{ histSelSubcats.push(b.textContent.trim()); b.classList.add('active'); });
  } else {
    chips.forEach(b=>b.classList.remove('active'));
  }
  syncGlobalSubToggle();
  renderHistorial();
}

function appendSubChip(sub, hasRecords, container){
  const active=histSelSubcats.includes(sub);
  const hasRec=hasRecords.has(sub);
  const b=document.createElement('button');
  b.className='sf-chip r'+(active?' active':'')+(hasRec?'':' inactive-sub');
  b.textContent=sub;
  b.style.opacity=hasRec?'1':'0.38';
  b.disabled=!hasRec;
  if(hasRec){
    b.onclick=()=>{
      if(histSelSubcats.includes(sub)) histSelSubcats=histSelSubcats.filter(s=>s!==sub);
      else histSelSubcats.push(sub);
      b.classList.toggle('active', histSelSubcats.includes(sub));
      renderHistorial();
    };
  }
  container.appendChild(b);
}

// Activa/desactiva los chips de tipo (Egresos, Ingresos, Beneficios) según si
// hay registros de ese tipo en el mes. "Todos" se desactiva solo si el mes está vacío.
function updateTypeChips(selMonth, selYear, isSearchMode){
  const rangeActive = histRangeMode && histRangeApplied;
  const searchEl=document.getElementById('hist-search');
  const sq=(searchEl?.value||'').trim().toLowerCase();
  // El conjunto base respeta el filtro activo: rango (si aplicado) o mes/año.
  // Si hay búsqueda, acota qué tipos existen — en rango Y en vista mensual.
  const baseEntries = data.filter(e=>{
    if(isFutureEntry(e)) return false;
    const d=parseDate(e.date);
    if(rangeActive){
      const fromEl=document.getElementById('hist-range-from');
      const toEl=document.getElementById('hist-range-to');
      const from=fromEl&&fromEl.value?parseDate(fromEl.value):null;
      const to=toEl&&toEl.value?parseDate(toEl.value):null;
      if(from && d<from) return false;
      if(to && d>to) return false;
      if(sq && !entryMatchesQuery(e, sq)) return false;
      return true;
    }
    // Vista mensual: si hay búsqueda, el universo son las coincidencias en TODO
    // el tiempo (la búsqueda ignora el mes); si no, el mes/año seleccionado.
    if(sq) return entryMatchesQuery(e, sq);
    return d.getMonth()===selMonth&&d.getFullYear()===selYear;
  });
  const counts = {
    egreso: baseEntries.some(e=>e.type==='egreso'),
    ingreso: baseEntries.some(e=>e.type==='ingreso'),
    'beneficio': baseEntries.some(e=>e.type==='beneficio'),
  };
  const anyRecords = baseEntries.length>0;

  const setChip=(id, enabled)=>{
    const chip=document.getElementById(id);
    if(!chip) return;
    // Los chips siempre reflejan qué tipos existen en el universo actual
    // (mes, rango o resultados de búsqueda).
    const on = enabled;
    chip.disabled = !on;
    chip.style.opacity = on ? '1' : '0.38';
    chip.style.pointerEvents = on ? '' : 'none';
  };

  setChip('fchip-todos', anyRecords);
  setChip('fchip-egreso', counts.egreso);
  setChip('fchip-ingreso', counts.ingreso);
  setChip('fchip-beneficio', counts['beneficio']);

  // Si el filtro activo quedó sin registros (por el mes, el rango o la búsqueda),
  // volver a "Todos" para no dejar la vista atorada en un tipo vacío.
  if(histFilter!=='todos'){
    const stillHasData = histFilter==='egreso' ? counts.egreso
      : histFilter==='ingreso' ? counts.ingreso
      : histFilter==='beneficio' ? counts['beneficio']
      : true;
    if(!stillHasData){
      histFilter='todos';
      histSelCats=[]; histSelSubcats=[];
      document.querySelectorAll('.filter-bar .f-chip').forEach(c=>c.classList.remove('active'));
      const todosChip=document.getElementById('fchip-todos');
      if(todosChip) todosChip.classList.add('active');
      const panel=document.getElementById('sub-filter-panel');
      if(panel) panel.classList.remove('vis');
    }
  }
}

function renderHistorial(animate){
  const hlReal=document.getElementById('hist-list');
  if(!hlReal) return;
  // Refrescar los presets de búsqueda (chips de comercios más comunes)
  try{ renderSearchPresets(); }catch(e){}
  // Construir en un contenedor DESACOPLADO (en memoria) y hacer swap al final,
  // para evitar el parpadeo de vaciar y reconstruir la lista visible.
  const hl=document.createElement('div');
  hl.id='hist-list';

  const searchEl=document.getElementById('hist-search');
  const searchQuery=(searchEl?.value||'').trim().toLowerCase();
  const isSearchMode=searchQuery.length>0;

  // Show/hide search clear button and date row
  const clearBtn=document.getElementById('hist-search-clear');
  if(clearBtn) clearBtn.style.display=isSearchMode?'inline':'none';
  const dateRow=document.getElementById('hist-date-row');
  const rangeRow=document.getElementById('hist-range-row');
  if(histRangeMode){
    // En modo rango, el selector de meses queda oculto y el de rango visible,
    // aunque el usuario esté escribiendo en el buscador (que vive junto al rango).
    if(dateRow) dateRow.style.display='none';
    if(rangeRow) rangeRow.style.display='flex';
  } else if(isSearchMode){
    if(dateRow) dateRow.style.display='none';
    if(rangeRow) rangeRow.style.display='none';
  } else {
    if(dateRow) dateRow.style.display='flex';
    if(rangeRow) rangeRow.style.display='none';
  }
  // La barra de tipos (Todos/Egresos/Ingresos/Beneficios/Método) se oculta cuando
  // se está eligiendo un rango pero aún no se aplica.
  const filterBar=document.getElementById('hist-filter-bar');
  if(filterBar){
    const hideBar = histRangeMode && !histRangeApplied && !isSearchMode;
    filterBar.style.display = hideBar ? 'none' : '';
  }

  const mSel=document.getElementById('hist-month-sel');
  const ySel=document.getElementById('hist-year-sel');
  const selMonth=mSel?parseInt(mSel.value):new Date().getMonth();
  const selYear=ySel?parseInt(ySel.value):new Date().getFullYear();

  // ¿Estamos en modo rango aplicado? Entonces búsqueda + rango son el filtro BASE,
  // y los chips de tipo/categoría refinan encima (comportamiento combinado).
  const rangeActive = histRangeMode && histRangeApplied;

  // Desactivar chips de tipo que no tienen registros en el alcance actual
  updateTypeChips(selMonth, selYear, isSearchMode && !rangeActive);

  let filtered;
  // MODO CAMPANITA: vista propia por secciones (ignora mes, tipos y categorías;
  // la búsqueda por palabra clave sí aplica). No convive con el modo rango.
  if(histBellMode && !rangeActive){
    const dateRowB=document.getElementById('hist-date-row');
    if(dateRowB) dateRowB.style.display='none';
    // Blindaje: en campanita la barra de tipos NUNCA se muestra, y la fila
    // de "Regresar" siempre sí (por si algún otro flujo las tocó).
    const fbB=document.getElementById('hist-filter-bar');
    if(fbB) fbB.style.display='none';
    const brB=document.getElementById('hist-bell-row');
    if(brB) brB.style.display='flex';
    renderBellView(hl, hlReal, isSearchMode?searchQuery:'', animate===true);
    return;
  }

  if(isSearchMode && !rangeActive){
    // Búsqueda NORMAL (fuera de rango): la base son las coincidencias en TODO
    // el tiempo. El tipo, categorías, subcategorías y método se aplican DESPUÉS
    // sobre esta base, exactamente igual que en modo rango.
    filtered=data.filter(e=>{
      if(isFutureEntry(e)) return false;
      return entryMatchesQuery(e, searchQuery);
    });
  } else {
    // Modo rango activado pero AÚN NO aplicado: no mostrar nada.
    if(histRangeMode && !histRangeApplied){
      lastFilteredEntries=[];
      hl.innerHTML='<div class="empty"><div class="e-ico">📅</div>Elige un rango y toca "Aplicar rango"</div>';
      hlReal.replaceChildren(...hl.childNodes);
      renderPie([]);
      return;
    }
    // 1) FILTRO BASE POR FECHA (rango aplicado o mes/año)
    filtered=data.filter(e=>{
      if(isFutureEntry(e)) return false;
      const d=parseDate(e.date);
      if(rangeActive){
        const fromEl=document.getElementById('hist-range-from');
        const toEl=document.getElementById('hist-range-to');
        const from=fromEl&&fromEl.value?parseDate(fromEl.value):null;
        const to=toEl&&toEl.value?parseDate(toEl.value):null;
        if(from && d<from) return false;
        if(to && d>to) return false;
        return true;
      }
      return d.getMonth()===selMonth&&d.getFullYear()===selYear;
    });
    // 1b) FILTRO POR BÚSQUEDA (si hay texto, dentro del rango)
    if(rangeActive && isSearchMode){
      filtered=filtered.filter(e=>entryMatchesQuery(e, searchQuery));
    }
  }

  // 2) FILTRO POR TIPO (aplica igual en vista mensual, rango y búsqueda)
  if(histFilter!=='todos') filtered=filtered.filter(e=>e.type===histFilter);
  if(histFilter!=='todos' && histFilter!=='egreso' && histSelCats.length===0){
    lastFilteredEntries=[];
    hl.innerHTML='<div class="empty"><div class="e-ico">🔍</div>Sin categorías seleccionadas</div>';
    hlReal.replaceChildren(...hl.childNodes);
    renderPie([]);
    return;
  }
  // 3) FILTRO POR CATEGORÍA/SUBCATEGORÍA
  if(histSelCats.length>0) filtered=filtered.filter(e=>histSelCats.includes(e.category));
  if(histSelSubcats.length>0) filtered=filtered.filter(e=>histSelSubcats.includes(e.subcategory));

  // Antes de aplicar el filtro de método, calcular qué métodos existen en el
  // conjunto visible (para mostrar solo esos, u ocultar el filtro si hay ≤1).
  updateMethodFilterChips(filtered);

  // Apply method filter
  if(histMethodFilter) filtered=filtered.filter(e=>e.method===histMethodFilter);

  filtered.sort((a,b)=>parseDate(b.date)-parseDate(a.date)||b.id-a.id);

  // Recordar exactamente lo que se está mostrando (lo usa la exportación a CSV)
  lastFilteredEntries=filtered;

  if(!filtered.length){
    hl.innerHTML='<div class="empty"><div class="e-ico">🔍</div>Sin movimientos</div>';
    hlReal.replaceChildren(...hl.childNodes);
    renderPie([]);
    return;
  }

  // La dona no se muestra en modo rango NI durante búsquedas por palabra clave
  // (en búsqueda importa la lista, no la gráfica, en todas las capas de filtrado)
  if((histRangeMode && histRangeApplied) || isSearchMode){
    renderPie([]);
  } else {
    renderPie(filtered);
  }

  const groups={};
  filtered.forEach(e=>{
    const key=String(e.date).slice(0,10);
    if(!groups[key]) groups[key]=[];
    groups[key].push(e);
  });

  const container=document.createElement('div');
  container.style.paddingBottom='8px';

  Object.keys(groups).sort((a,b)=>b.localeCompare(a)).forEach(dateKey=>{
    const d=parseDate(dateKey);
    const hdr=document.createElement('div');
    hdr.className='day-group-hdr';
    const dayEntries=groups[dateKey];
    // Balance diario solo en modo "todos"
    let balanceHtml='';
    if(histFilter==='todos' && !isSearchMode){
      const dayInc=dayEntries.filter(e=>e.type==='ingreso').reduce((s,e)=>s+e.amountMXN,0);
      const dayExp=dayEntries.filter(e=>e.type==='egreso').reduce((s,e)=>s+e.amountMXN,0);
      const dayBal=dayInc-dayExp;
      if(dayInc>0||dayExp>0){
        const sign=dayBal>=0?'+':'';
        const col=dayBal>=0?'var(--green)':'var(--danger)';
        // Total a la derecha con un pequeño espacio para que no quede pegado al borde
        balanceHtml=`<span style="font-size:11px;font-weight:500;color:${col};margin-left:auto;padding-right:6px;">${sign}${fmt(dayBal)}</span>`;
      }
    }
    hdr.innerHTML=`<span>${d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>${balanceHtml}`;
    hdr.style.display='flex';
    hdr.style.alignItems='center';
    container.appendChild(hdr);

    const listWrap=document.createElement('div');
    listWrap.className='tx-list';
    listWrap.style.marginBottom='4px';
    orderDayEntries(groups[dateKey]).forEach(e=>{
      const el=txEl(e,true);
      el.classList.add('tappable');
      // Guardar tanto el id propio como el del madre (para resaltar tras editar)
      el._entryId = e.id;
      el._parentId = e.linkedTo ? e.linkedTo : e.id;
      el.onclick=(ev)=>{
        if(ev.target.classList.contains('tx-delete-btn')) return;
        // Si es un hijo vinculado (desglose, propina o beneficio), abrir el gasto madre
        const targetId = e.linkedTo ? e.linkedTo : e.id;
        openEdit(targetId);
      };
      listWrap.appendChild(el);
    });
    container.appendChild(listWrap);
  });

  hl.appendChild(container);

  // SWAP: reemplazar el contenido real de una sola vez (sin vaciarlo antes),
  // para que no haya un instante en blanco → sin parpadeo.
  hlReal.replaceChildren(...hl.childNodes);

  // Animación del listado
  if(animate===true){
    // Cascada completa (entrada normal a la pestaña o cambio de mes)
    revealAnimate(container, true);
  } else if(animate && animate.cascadeFromIndex!==undefined){
    // Cascada solo desde cierto índice hacia abajo (tras eliminar un registro):
    // los elementos que estaban debajo del eliminado reaparecen de arriba a abajo.
    const items=Array.from(container.querySelectorAll('.day-group-hdr, .tx-item'));
    const from=animate.cascadeFromIndex;
    const toAnimate=items.slice(from);
    toAnimate.forEach((el,i)=>{
      try{
        el.animate([
          {opacity:0,transform:'translateY(-12px)'},
          {opacity:1,transform:'translateY(0)'}
        ],{duration:420,delay:i*55,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'backwards'});
      }catch(e){}
    });
  }
}

function sum(arr,t){return arr.filter(e=>e.type===t).reduce((s,e)=>s+e.amountMXN,0);}

// ══════════════════════════════════════════════════════════════════════════
// R7 · PUNTO 5 — "Ver" desde el toast de guardado
//
// Un registro puede estar invisible en el Historial por SEIS razones, no solo
// por el mes: filtro de tipo, categorías, subcategorías, método, búsqueda activa,
// modo campanita o modo rango. Si guardo un Starbucks con el Historial filtrado
// en "Casa", el registro ni siquiera existe en el DOM y el enlace no haría nada.
//
// Por eso el enlace LIMPIA TODO y salta al mes del registro. El enlace promete
// llevarte al registro; tiene que cumplir. El caso que más sirve —fecha de ayer
// o del mes pasado— es justo el que fallaría sin esto.
// ══════════════════════════════════════════════════════════════════════════
function goToEntry(id){
  const e = data.find(x=>String(x.id)===String(id));
  if(!e) return;
  // En un diferido, el ancla es la mensualidad 1: esa "es" la compra.
  let target = e;
  if(e.deferGroup){
    const grp = data.filter(x=>sameGroup(x.deferGroup, e.deferGroup))
                    .sort((a,b)=>(a.deferIndex||1)-(b.deferIndex||1));
    if(grp.length) target = grp[0];
  }
  // Un hijo (desglose/propina/beneficio) no se resalta solo: se resalta su madre.
  if(target.linkedTo){
    const madre = data.find(x=>x.id===target.linkedTo);
    if(madre) target = madre;
  }

  // 1. Al Historial. goNav ya apaga el modo campanita y el modo rango.
  const btn = document.querySelector('.nav-btn[onclick*="historial"]');
  try{ goNav('historial', btn); }catch(_e){}

  // 2. Fuera los filtros que sobreviven a goNav: tipo, categorías, subcategorías,
  //    método y la búsqueda.
  try{ resetHistFiltersToTodos(); }catch(_e){}
  const s=document.getElementById('hist-search');
  if(s && s.value){ s.value=''; try{ clearSearch(); }catch(_e){} }

  // 3. Al mes del registro (el punto entero del asunto).
  //    OJO: renderHistorial() NO lee viewMonth/viewYear — esas globales son del
  //    BALANCE. El Historial lee sus <select> del DOM (#hist-month-sel /
  //    #hist-year-sel). Mover solo las variables no movía nada: el listado
  //    seguía pintando el mes que marcaban los selectores.
  const d = parseDate(target.date);
  if(d && !isNaN(d.getTime())){
    const mSel=document.getElementById('hist-month-sel');
    const ySel=document.getElementById('hist-year-sel');
    if(ySel){
      // El año del registro puede no estar en la lista (registro viejo o futuro)
      if(!Array.from(ySel.options).some(o=>parseInt(o.value)===d.getFullYear())){
        const o=document.createElement('option');
        o.value=String(d.getFullYear()); o.textContent=String(d.getFullYear());
        ySel.appendChild(o);
      }
      ySel.value=String(d.getFullYear());
    }
    if(mSel) mSel.value=String(d.getMonth());
  }
  renderHistorial();

  // 4. Scroll y resalte. Se re-busca el nodo dentro del timeout a propósito: el
  //    refresco silencioso desde Sheets puede reconstruir la lista en medio.
  setTimeout(()=>{
    let node=null;
    document.querySelectorAll('#hist-list .tx-item').forEach(el=>{
      if(el._entryId===target.id || el._parentId===target.id) node=el;
    });
    if(node){ try{ node.scrollIntoView({behavior:'smooth', block:'center'}); }catch(_e){} }
  }, 80);
  try{ highlightUpdatedRecord(target.id, 520); }catch(_e){}
}

// Monto para TAGLINES: si los centavos son .00 se omiten (ahorra espacio).
// Esta regla aplica SOLO aquí, no en los montos principales de la app.
function tagAmt(n, sym){
  const v=Number(n)||0;
  const entero=Math.abs(v%1)<0.005;
  const s=v.toLocaleString('es-MX',{minimumFractionDigits:entero?0:2, maximumFractionDigits:2});
  return `${sym||'$'}${s}`;
}

function txEl(e, showDelete){
  const el=document.createElement('div');
  el.className='tx-item';
  // La fecha ya no se muestra (el listado se agrupa por días) ni el método:
  // solo la subcategoría en la línea principal; el resto, cada uno en SU renglón.
  const sub=[e.subcategory||e.category].filter(Boolean).join('');
  // Moneda extranjera: monto original + TC en UN SOLO renglón
  //   USD $19.99 (TC: $17.56 MXN)
  let curLine='';
  if(e.currency!=='MXN'){
    const montoOrig=`${e.currency} ${tagAmt(e.amount)}`;
    const tc=(e.amount>0 && e.amountMXN>0) ? (e.amountMXN/e.amount) : 0;
    const tcTxt=tc>0 ? ` (TC: ${tagAmt(tc)} MXN)` : '';
    curLine=`<div class="tx-note" style="opacity:0.7">${montoOrig}${tcTxt}</div>`;
  }
  const sign={ingreso:'+',egreso:'−',ahorro:'→','beneficio':'★'}[e.type]||'';
  const ico=emojiForEntry(e);
  // Los hijos vinculados (desglose/propina/beneficio) no se eliminan independientemente
  const isLinkedChild = !!e.linkedTo;
  // Los hijos vinculados no tienen tacha, pero reservamos su espacio para alinear montos
  const delBtn = showDelete
    ? (isLinkedChild
        ? `<span class="tx-delete-btn" style="visibility:hidden;pointer-events:none;">✕</span>`
        : `<button class="tx-delete-btn" title="Eliminar">✕</button>`)
    : '';
  const barColor = catColor(e.category);
  // ── Construir las notas a mostrar en el listado ──
  // metaParts: etiquetas del sistema (tenues). userParts: nota real del usuario.
  const metaParts = [];
  const userParts = [];

  if(isLinkedChild){
    // HIJO (desglose/propina/beneficio): etiqueta limpia, sin el "Monto original".
    // Si el hijo tiene NOMBRE PROPIO (su descripción difiere de la madre), la
    // etiqueta conserva el ancla: "Desglose de Izzi". Si heredó el nombre, basta
    // con "Desglose" (el nombre de la madre ya está en el título).
    const _madre = data.find(x=>x.id===e.linkedTo) || null;
    const _madreDesc = _madre ? String(_madre.desc||'').trim() : '';
    const _tieneNombrePropio = _madreDesc &&
      String(e.desc||'').trim().toLowerCase() !== _madreDesc.toLowerCase();
    // R6: la relación y los detalles ya NO se leen del texto de la nota.
    const _m = metaOf(e);
    const _sym = e.currency==='MXN' ? '$' : `${e.currency} `;
    const _fmt = v => `${_sym}${Number(v).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

    if(_m.rel==='desglose')  metaParts.push(_tieneNombrePropio ? `Desglose de ${_madreDesc}` : 'Desglose');
    if(_m.rel==='beneficio') metaParts.push('Beneficio');

    // Detalle del beneficio capturado como porcentaje
    if(_m.ben) metaParts.push(`${_m.ben.pct}% de ${_fmt(_m.ben.base)}`);

    // R7.2 · Tagline de la propina VINCULADA — una sola línea, siempre con el
    // monto total registrado del egreso ($Monto = tip.base):
    //   · % incluida  → "15% incluida en $1,000"
    //   · % adicional → "15% adicional a $1,000"
    //   · $ incluida  → "Incluida en $1,000"
    //   · $ adicional → "Adicional a $1,000"
    // Registros legacy sin base guardada degradan a la forma corta.
    if(_m.rel==='propina'){
      if(_m.tip){
        const _t=_m.tip;
        if(_t.pct!=null){
          const _est=_t.inc?'incluida':'adicional';
          const _prep=_t.inc?'en':'a';
          metaParts.push(_t.base!=null ? `${_t.pct}% ${_est} ${_prep} ${_fmt(_t.base)}` : `${_t.pct}% ${_est}`);
        } else {
          const _est=_t.inc?'Incluida':'Adicional';
          const _prep=_t.inc?'en':'a';
          metaParts.push(_t.base!=null ? `${_est} ${_prep} ${_fmt(_t.base)}` : _est);
        }
      } else {
        metaParts.push('Propina');   // legacy sin meta interpretable
      }
    }
    if(_m.benMonth) metaParts.push(`Acreditado en ${_m.benMonth.i}/${_m.benMonth.n}`);   // legacy

    if(_m.userNote) userParts.push(_m.userNote);
  } else {
    // MADRE: calcular dinámicamente "Monto original" y el resumen de hijos.
    const children = data.filter(x=>x.linkedTo===e.id);
    const childDesg = children.filter(isDesglose);
    const childProp = children.find(isPropina);
    // R7.2: puede haber VARIOS beneficios vinculados
    const childBens = children.filter(x=>x.type==='beneficio');
    const sym = e.currency==='MXN'?'$':`${e.currency} `;

    // Etiqueta de gasto diferido: "Diferido · mes X/N · de $Total"
    if(e.deferGroup && e.deferTotal){
      // R8 · Formato de la moneda del total en el diferido:
      //   · MXN → sin identificador de moneda: "de $6,054" (formato pesos)
      //   · extranjera → identificador + $: "de USD $900" (antes "de USD 900")
      const symDefer = e.currency==='MXN' ? '$' : `${e.currency} $`;
      // "Mensualidad 1/6 de $6,054" — el total de la compra, no el cargo del mes
      metaParts.push(`Mensualidad ${e.deferIndex}/${e.deferTotal} de ${tagAmt(e.deferOriginal||0, symDefer)}`);
    }

    // R7 · 6a: el "Monto original" ahora sale de cargoBrutoDe() (01_nucleo), el
    // punto único de verdad. Aquí vivía la otra copia del cálculo — y estaba
    // desincronizada con la de openEdit: no sumaba la propina incluida.
    const origAmount = cargoBrutoDe(e);
    const hasReductions = childDesg.length>0 || (childBens.length>0 && !e.deferGroup)
                       || (!!childProp && !!metaOf(childProp).tip && !!metaOf(childProp).tip.inc);
    if(hasReductions){
      metaParts.push(e.deferGroup
        ? `Cargo del mes: ${tagAmt(origAmount, sym)}`
        : `Monto original: ${tagAmt(origAmount, sym)}`);
    }
    // Resumen de hijos
    if(childDesg.length>0){
      // Detalle: si el desglose tiene nombre propio se muestra ese; si heredó
      // el nombre de la madre, se muestra su subcategoría.
      const nombres=childDesg.map(dg=>{
        const propio=(dg.desc||'').trim();
        const heredado=propio && propio.toLowerCase()===String(e.desc||'').trim().toLowerCase();
        if(propio && !heredado) return propio;
        return dg.subcategory || dg.category || 'Sin categoría';
      });
      metaParts.push(`${childDesg.length} desglose${childDesg.length>1?'s':''} (${nombres.join(' · ')})`);
    }
    if(childProp) metaParts.push('Con propina');
    // R7.2: 1 beneficio → "Beneficio: X"; varios → "N beneficios (Cat1 · Cat2)"
    if(childBens.length===1) metaParts.push(`Beneficio: ${childBens[0].category}`);
    else if(childBens.length>1) metaParts.push(`${childBens.length} beneficios (${childBens.map(b=>b.category).join(' · ')})`);

    // R6: la nota del usuario sale limpia de la capa metaOf; ya no se filtra texto aquí.
    const _mm = metaOf(e);
    if(_mm.benMonth) metaParts.push(`Acreditado en ${_mm.benMonth.i}/${_mm.benMonth.n}`);
    if(_mm.userNote) userParts.push(_mm.userNote);
  }

  // Recordatorio del comercio (antes era un iconito junto al nombre): ahora es
  // un renglón propio, después de las etiquetas del sistema y antes de las notas.
  let remIco='';
  try{
    if(typeof getManualRule==='function'){
      const _r=getManualRule(e.type, e.desc);
      if(_r && (!_r.until || _r.until>=localToday())){
        remIco='<span class="tx-rem-ico">🔔</span>';   // junto a la descripción (como antes)
        metaParts.push(`Recordatorio ${_r.freq==='weekly'?'semanal':'mensual'}`); // y su renglón
      }
    }
  }catch(_e){}

  // Cada elemento vive en su PROPIO renglón (sin separadores · ni |)
  let noteDisplay = '';
  metaParts.forEach(p=>{ noteDisplay += `<div class="tx-note" style="opacity:0.7">${p}</div>`; });
  userParts.forEach(p=>{ noteDisplay += `<div class="tx-note">${p}</div>`; });
  el.innerHTML=`
    <div class="tx-color-bar" style="background:${barColor}"></div>
    <div class="tx-ico ${e.type}" style="margin-left:8px">${ico}</div>
    <div class="tx-info">
      <div class="tx-desc">${e.desc}${remIco}</div>
      <div class="tx-meta">${sub}</div>
      ${curLine}
      ${noteDisplay}
    </div>
    <div class="tx-amt ${e.type}">${sign}${fmt(e.amountMXN)}</div>
    ${delBtn}`;
  if(showDelete && !isLinkedChild){
    el.querySelector('.tx-delete-btn').onclick=(ev)=>{
      ev.stopPropagation();
      // Gasto diferido: alerta especial y borrado de TODO el grupo
      if(e.deferGroup){
        const groupCount=data.filter(x=>sameGroup(x.deferGroup,e.deferGroup)).length;
        if(!confirm(`Este es un gasto diferido (mes ${e.deferIndex} de ${e.deferTotal}).\n\nBorrarlo eliminará las ${groupCount} mensualidades ligadas, incluyendo las anteriores y futuras. ¿Continuar?`)) return;
        const groupId=e.deferGroup;
        const groupIds=data.filter(x=>sameGroup(x.deferGroup,groupId)).map(x=>x.id);
        const list=document.getElementById('hist-list');
        const allItems=Array.from(list.querySelectorAll('.day-group-hdr, .tx-item'));
        let cascadeFrom=allItems.indexOf(el);
        const listWrap=el.closest('.tx-list');
        const siblings=listWrap?listWrap.querySelectorAll('.tx-item').length:1;
        if(siblings<=1 && listWrap){
          const hdr=listWrap.previousElementSibling;
          if(hdr && hdr.classList.contains('day-group-hdr')){ const hi=allItems.indexOf(hdr); if(hi>=0) cascadeFrom=hi; }
        }
        playDeleteAnimation(e.id, ()=>{
          // R4: filtrar también a los HIJOS (desglose/beneficio) vinculados a
          // cualquiera de las mensualidades del grupo — antes solo se quitaban
          // las mensualidades y los hijos quedaban huérfanos hasta la próxima
          // recarga (el servidor sí los borra en cascada, pero localmente
          // seguían visibles como registros fantasma sin su padre).
          data=data.filter(x=>!sameGroup(x.deferGroup,groupId) && !(x.linkedTo && groupIds.includes(x.linkedTo)));
          save();
          showSyncing('⟳ Eliminando...');
          Promise.all(groupIds.map(gid=>deleteEntryInSheets(gid))).then(results=>{
            hideSyncing();
            if(_allOk(results)) toast('Gasto diferido eliminado');
            else toastSyncFailed('Eliminado');
          });
          renderHistorial({cascadeFromIndex:cascadeFrom}); renderBalance();
        });
        return;
      }
      if(!confirm('¿Eliminar este registro?')) return;
      // Calcular el índice desde donde re-animar (posición del elemento eliminado)
      const list=document.getElementById('hist-list');
      const allItems=Array.from(list.querySelectorAll('.day-group-hdr, .tx-item'));
      let cascadeFrom=allItems.indexOf(el);
      // Si el elemento es el único de su día, su header también desaparece,
      // así que la cascada arranca desde donde estaba el header.
      const listWrap=el.closest('.tx-list');
      const siblings=listWrap?listWrap.querySelectorAll('.tx-item').length:1;
      if(siblings<=1 && listWrap){
        const hdr=listWrap.previousElementSibling;
        if(hdr && hdr.classList.contains('day-group-hdr')){ const hi=allItems.indexOf(hdr); if(hi>=0) cascadeFrom=hi; }
      }
      playDeleteAnimation(e.id, ()=>{
        data=data.filter(x=>x.id!==e.id&&x.linkedTo!==e.id);
        save();
        showSyncing('⟳ Eliminando...');
        deleteEntryInSheets(e.id).then(r=>{
          hideSyncing();
          if(r && r.ok) toast('Registro eliminado');
          else toastSyncFailed('Eliminado');
        });
        renderHistorial({cascadeFromIndex:cascadeFrom}); renderBalance();
      });
    };
  }
  return el;
}
