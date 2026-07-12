// Lo que el historial está mostrando AHORA MISMO (tras todos los filtros:
// fecha/rango, búsqueda, tipo, categorías, subcategorías y método).
// La exportación a CSV usa exactamente esta lista.
let lastFilteredEntries=[];

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
  renderHistorial();
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
function renderBellView(hl, hlReal, searchQuery){
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
  // Mapa comercio(+tipo) → {regla, sección}
  const map={};
  rules.forEach(r=>{ map[(r.type+'||'+String(r.desc||'').trim().toLowerCase())]={rule:r, sec:bellSectionOf(r)}; });

  // Universo: registros (no vinculados) cuyos comercio+tipo tienen regla manual
  let entries=data.filter(e=>{
    if(e.linkedTo) return false;
    const k=e.type+'||'+String(e.desc||'').trim().toLowerCase();
    return !!map[k];
  });
  if(searchQuery){
    entries=entries.filter(e=>{
      const hay=[e.desc||'',e.note||'',e.category||'',e.subcategory||'',e.method||''].join(' ').toLowerCase();
      return hay.includes(searchQuery);
    });
  }
  if(entries.length===0){
    lastFilteredEntries=[];
    hl.innerHTML='<div class="empty"><div class="e-ico">🔍</div>Sin coincidencias entre tus recordatorios</div>';
    hlReal.replaceChildren(...hl.childNodes);
    renderPie([]);
    return;
  }
  // Ordenar: sección → fecha descendente
  entries.sort((a,b)=>{
    const sa=map[a.type+'||'+String(a.desc||'').trim().toLowerCase()].sec;
    const sb=map[b.type+'||'+String(b.desc||'').trim().toLowerCase()].sec;
    if(sa!==sb) return sa-sb;
    return parseDate(b.date)-parseDate(a.date) || b.id-a.id;
  });
  lastFilteredEntries=entries;

  hl.innerHTML='';
  let curSec=-1;
  entries.forEach(e=>{
    const sec=map[e.type+'||'+String(e.desc||'').trim().toLowerCase()].sec;
    if(sec!==curSec){
      curSec=sec;
      const n=entries.filter(x=>map[x.type+'||'+String(x.desc||'').trim().toLowerCase()].sec===sec).length;
      const h=document.createElement('div');
      h.className='bell-sec-hdr';
      h.innerHTML=`${BELL_SECS[sec]} <span class="bell-sec-count">· ${n}</span>`;
      hl.appendChild(h);
    }
    const el=txEl(e,false);
    el.classList.add('tappable');
    el.onclick=()=>openEdit(e.id);
    hl.appendChild(el);
  });
  hlReal.replaceChildren(...hl.childNodes);
  renderPie([]);
}

// ── PRESETS DE BÚSQUEDA ──
// Los comercios más comunes del último año, ponderados por cuartos de
// antigüedad (0-91d→4, 92-182d→3, 183-273d→2, 274-365d→1). Cada compra suma
// (sin tope semanal: 3 McDonald's en una semana suman 3, para que el ranking
// refleje hábitos reales y tenga dinamismo). Un gasto diferido cuenta 1 sola
// vez, no una por mensualidad.
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
  return Object.keys(score)
    .sort((a,b)=> score[b]-score[a] || lastT[b]-lastT[a])
    .slice(0,10)
    .map(k=>display[k]);
}

function renderSearchPresets(){
  const box=document.getElementById('hist-presets');
  if(!box) return;
  const names=computeSearchPresets();
  const cap=(window.innerWidth<=640)?5:10;   // móvil: máx 5 · web: máx 10
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
  // (Si el contenedor está oculto en este momento, no se puede medir: se omite.)
  if(box.clientWidth>0){
    let guard=15;
    while(box.lastElementChild && guard-->0 &&
          (box.lastElementChild.offsetLeft + box.lastElementChild.offsetWidth) > box.clientWidth){
      box.removeChild(box.lastElementChild);
    }
  }
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
      if(sq){
        const hay=[e.desc||'',e.note||'',e.category||'',e.subcategory||'',e.method||''].join(' ').toLowerCase();
        if(!hay.includes(sq)) return false;
      }
      return true;
    }
    // Vista mensual: si hay búsqueda, el universo son las coincidencias en TODO
    // el tiempo (la búsqueda ignora el mes); si no, el mes/año seleccionado.
    if(sq){
      const hay=[e.desc||'',e.note||'',e.category||'',e.subcategory||'',e.method||''].join(' ').toLowerCase();
      return hay.includes(sq);
    }
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
      if(sq){
        const hay=[e.desc||'',e.note||'',e.category||'',e.subcategory||'',e.method||''].join(' ').toLowerCase();
        if(!hay.includes(sq)) return false;
      }
      return true;
    }
    // Vista mensual: si hay búsqueda, el universo son las coincidencias en TODO
    // el tiempo (la búsqueda ignora el mes); si no, el mes/año seleccionado.
    if(sq){
      const hay=[e.desc||'',e.note||'',e.category||'',e.subcategory||'',e.method||''].join(' ').toLowerCase();
      return hay.includes(sq);
    }
    return d.getMonth()===selMonth&&d.getFullYear()===selYear;
  });
  const counts = {
    egreso: baseEntries.some(e=>e.type==='egreso'),
    ingreso: baseEntries.some(e=>e.type==='ingreso'),
    'ahorro-pasivo': baseEntries.some(e=>e.type==='ahorro-pasivo'),
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
  setChip('fchip-ahorro-pasivo', counts['ahorro-pasivo']);

  // Si el filtro activo quedó sin registros (por el mes, el rango o la búsqueda),
  // volver a "Todos" para no dejar la vista atorada en un tipo vacío.
  if(histFilter!=='todos'){
    const stillHasData = histFilter==='egreso' ? counts.egreso
      : histFilter==='ingreso' ? counts.ingreso
      : histFilter==='ahorro-pasivo' ? counts['ahorro-pasivo']
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
    renderBellView(hl, hlReal, isSearchMode?searchQuery:'');
    return;
  }

  if(isSearchMode && !rangeActive){
    // Búsqueda NORMAL (fuera de rango): la base son las coincidencias en TODO
    // el tiempo. El tipo, categorías, subcategorías y método se aplican DESPUÉS
    // sobre esta base, exactamente igual que en modo rango.
    filtered=data.filter(e=>{
      if(isFutureEntry(e)) return false;
      const haystack=[
        e.desc||'', e.note||'', e.category||'', e.subcategory||'', e.method||''
      ].join(' ').toLowerCase();
      return haystack.includes(searchQuery);
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
      filtered=filtered.filter(e=>{
        const haystack=[
          e.desc||'', e.note||'', e.category||'', e.subcategory||'', e.method||''
        ].join(' ').toLowerCase();
        return haystack.includes(searchQuery);
      });
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
    groups[dateKey].forEach(e=>{
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

function txEl(e, showDelete){
  const el=document.createElement('div');
  el.className='tx-item';
  const d=parseDate(e.date);
  const ds=d.toLocaleDateString('es-MX',{day:'numeric',month:'short'});
  const sub=[e.subcategory||e.category,ds,e.method].filter(Boolean).join(' · ');
  const cur=e.currency!=='MXN'?` (${e.currency} ${e.amount.toLocaleString('es-MX',{minimumFractionDigits:2})})`:'';
  const sign={ingreso:'+',egreso:'−',ahorro:'→','ahorro-pasivo':'★'}[e.type]||'';
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
    // HIJO (desglose/propina/beneficio): mostrar etiqueta limpia sin el nombre
    // del comercio (ya está en el título) ni el "Monto original" (inútil aquí).
    (e.note||'').split(' | ').map(p=>p.trim()).filter(Boolean).forEach(p=>{
      // "Desglose de: X" → "Desglose" (el nombre ya está en el título)
      if(p.startsWith('Desglose de:')){ metaParts.push('Desglose'); return; }
      if(p.startsWith('Propina de:')){ metaParts.push('Propina'); return; }
      if(p.startsWith('Beneficio de:')){ metaParts.push('Beneficio'); return; }
      // "Monto original" es inútil en un hijo → descartar
      if(p.startsWith('Monto original:')) return;
      if(p.startsWith('Vinculado a:')) return;
      // Detalles útiles que SÍ se muestran (% de $X, incluida/adicional, TC)
      const isDetail = p.startsWith('TC:') || /^\d+%/.test(p)
        || p==='incluida' || p==='adicional'
        || p.startsWith('incluida ') || p.startsWith('adicional ');
      if(isDetail) metaParts.push(p); else userParts.push(p);
    });
  } else {
    // MADRE: calcular dinámicamente "Monto original" y el resumen de hijos.
    const children = data.filter(x=>x.linkedTo===e.id);
    const childDesg = children.filter(x=>(x.note||'').includes('Desglose de:'));
    const childProp = children.find(x=>x.subcategory==='Propinas'&&(x.note||'').includes('Propina de:'));
    const childBen  = children.find(x=>x.type==='ahorro-pasivo');
    const sym = e.currency==='MXN'?'$':`${e.currency} `;

    // Etiqueta de gasto diferido: "Diferido · mes X/N · de $Total"
    if(e.deferGroup && e.deferTotal){
      metaParts.push(`Diferido · mes ${e.deferIndex}/${e.deferTotal} · de ${sym}${(e.deferOriginal||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
    }

    // Monto original = monto del madre + suma de reducciones (desgloses + beneficio)
    // (la propina adicional no reduce el monto madre; la incluida sí formaba parte del cobro)
    let origAmount = e.amount;
    childDesg.forEach(d=>{ origAmount += d.amount; });
    if(childBen) origAmount += childBen.amount;
    const hasReductions = childDesg.length>0 || !!childBen;
    if(hasReductions){
      metaParts.push(`Monto original: ${sym}${origAmount.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
    }
    // Resumen de hijos
    if(childDesg.length>0) metaParts.push(`${childDesg.length} desglose${childDesg.length>1?'s':''}`);
    if(childProp) metaParts.push('Con propina');
    if(childBen) metaParts.push(`Beneficio: ${childBen.category}`);

    // Nota real del usuario: filtrar TODAS las etiquetas del sistema (se calculan
    // dinámicamente arriba). Solo se conservan el TC (meta) y la nota real del usuario.
    (e.note||'').split(' | ').map(p=>p.trim()).filter(Boolean).forEach(p=>{
      if(p.startsWith('TC:')){ metaParts.push(p); return; }
      // Descartar etiquetas del sistema que pudieran haber quedado guardadas
      const isSystemLabel = p.startsWith('Monto original:')
        || p.startsWith('Desglose de:')
        || p.startsWith('Propina de:')
        || p.startsWith('Beneficio de:')
        || p.startsWith('Vinculado a:')
        || p.startsWith('Propina ')          // "Propina X% incluida/adicional" (viejo)
        || /^\d+%\s/.test(p)                  // "10% de $X"
        || /^\d+\s+desglose/.test(p);         // "1 desglose"
      if(!isSystemLabel) userParts.push(p);
    });
  }

  let noteDisplay = '';
  if(metaParts.length) noteDisplay += `<div class="tx-note" style="opacity:0.7">${metaParts.join(' | ')}</div>`;
  if(userParts.length) noteDisplay += `<div class="tx-note">${userParts.join(' | ')}</div>`;
  // 🔔 discreto si este comercio tiene un recordatorio manual ACTIVO
  const remIco=(typeof hasActiveManualReminder==='function' && hasActiveManualReminder(e.type, e.desc))
    ? '<span class="tx-rem-ico">🔔</span>' : '';
  el.innerHTML=`
    <div class="tx-color-bar" style="background:${barColor}"></div>
    <div class="tx-ico ${e.type}" style="margin-left:8px">${ico}</div>
    <div class="tx-info">
      <div class="tx-desc">${e.desc}${remIco}</div>
      <div class="tx-meta">${sub}${cur}</div>
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
          data=data.filter(x=>!sameGroup(x.deferGroup,groupId));
          save();
          showSyncing('⟳ Eliminando...');
          Promise.all(groupIds.map(gid=>deleteEntryInSheets(gid))).then(()=>{ hideSyncing(); toast('Gasto diferido eliminado'); });
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
        deleteEntryInSheets(e.id).then(()=>{ hideSyncing(); toast('Registro eliminado'); });
        renderHistorial({cascadeFromIndex:cascadeFrom}); renderBalance();
      });
    };
  }
  return el;
}
