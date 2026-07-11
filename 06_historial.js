// Lo que el historial está mostrando AHORA MISMO (tras todos los filtros:
// fecha/rango, búsqueda, tipo, categorías, subcategorías y método).
// La exportación a CSV usa exactamente esta lista.
let lastFilteredEntries=[];

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
    return d.getMonth()===selMonth&&d.getFullYear()===selYear;
  });
}

// Manejo del input de búsqueda. En modo rango, cambiar la búsqueda resetea la vista
// a "Todos" para que el nuevo universo de resultados se muestre completo y los chips
// de tipo se recalculen sobre él.
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
  // El conjunto base respeta el filtro de fecha activo: rango (si aplicado) o mes/año.
  // En modo rango, la búsqueda también acota qué tipos existen.
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
    // En búsqueda NORMAL (fuera de rango) todos quedan habilitados (búsqueda global).
    // En modo rango, los chips reflejan qué tipos existen entre los resultados.
    const on = (isSearchMode && !rangeActive) ? true : enabled;
    chip.disabled = !on;
    chip.style.opacity = on ? '1' : '0.38';
    chip.style.pointerEvents = on ? '' : 'none';
  };

  setChip('fchip-todos', anyRecords);
  setChip('fchip-egreso', counts.egreso);
  setChip('fchip-ingreso', counts.ingreso);
  setChip('fchip-ahorro-pasivo', counts['ahorro-pasivo']);

  // Si el filtro activo quedó sin registros, volver a "Todos"
  if(!(isSearchMode && !rangeActive) && histFilter!=='todos'){
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
  if(isSearchMode && !rangeActive){
    // Búsqueda NORMAL (fuera de rango): filtro amplio, ignora tipo/mes
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
    // 2) FILTRO POR TIPO (sobre los ya filtrados por fecha/búsqueda)
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
  }

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

  // En modo rango no se muestran las gráficas de dona (solo la lista)
  if(histRangeMode && histRangeApplied){
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
  el.innerHTML=`
    <div class="tx-color-bar" style="background:${barColor}"></div>
    <div class="tx-ico ${e.type}" style="margin-left:8px">${ico}</div>
    <div class="tx-info">
      <div class="tx-desc">${e.desc}</div>
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
