// ════════════════════════════════════════════
// MODAL DE EDICIÓN
// ════════════════════════════════════════════

// ══════════════════════════════════════
// EDIT MODAL
// ══════════════════════════════════════
let editId = null;
let editDeferGroup = null;
let editDiferirMonths = 0;    // meses elegidos en edición de diferido
let editDiferirCustom = false;
let editType = 'egreso';
let editCat = '';
let editSubcat = '';
let editMethod = 'Tarjeta de crédito';
let editBenOn = false;

let _eNoteVisible=false;
let _eDesgloseVisible=false;

function eNoteHasData(){
  const el=document.getElementById('e-note');
  return !!(el && el.value.trim().length>0);
}
function eDesgloseHasData(){
  return editDesgloses.some(d=>d.amount>0);
}
function updateEditNoteDesgloseIndicators(){
  updateInlineBtn('e-note-toggle-btn', _eNoteVisible, eNoteHasData());
  updateInlineBtn('e-desglose-toggle-btn', _eDesgloseVisible, eDesgloseHasData());
  // Tercer tab: 🔔 Recordar (con-datos = recordatorio armado o regla ya existente)
  try{
    const { type, desc } = _eRemTarget();
    const tieneRegla = (type==='egreso' && desc.length>=2 && !!getManualRule(type, desc));
    updateInlineBtn('e-rem-toggle-btn',
      typeof _eRemPanelVisible!=='undefined' && _eRemPanelVisible,
      (typeof eRemHasData==='function' && eRemHasData()) || tieneRegla);
  }catch(e){}
}

// Modo de la nota en EDICIÓN (análogo al registro):
//  - DIRECTO: nota sola (ingreso, beneficio o egreso diferido) → textarea directo.
//  - TOGGLE: egreso normal (Nota + Desglose) → botones.
function updateEditNoteMode(){
  const row=document.getElementById('e-note-desglose-row');
  const noteBtn=document.getElementById('e-note-toggle-btn');
  const wrap=document.getElementById('e-note-field-wrap');
  if(!row || !noteBtn || !wrap) return;
  const ta=document.getElementById('e-note');
  const hasData = ta && ta.value.trim().length>0;
  const noteDirecto = (editType!=='egreso');   // en diferidos la Nota sigue siendo tab
  if(noteDirecto){
    noteBtn.style.display='none';
    wrap.style.display='block';
    wrap.style.marginTop='0';
    _eNoteVisible=true;
  } else {
    noteBtn.style.display='';
    wrap.style.marginTop='10px';
    if(!_eNoteVisible && !hasData){
      wrap.style.display='none';
    }
  }
}

function toggleENoteField(open){
  const wrap=document.getElementById('e-note-field-wrap');
  if(!wrap) return;
  const isManual = open===undefined;
  const show = isManual ? !_eNoteVisible : open;
  _eNoteVisible=show;
  wrap.style.display=show?'block':'none';
  if(show){
    revealAnimate(wrap);
    if(isManual && _eDesgloseVisible){
      _eDesgloseVisible=false;
      const dsec=document.getElementById('e-desglose-section');
      if(dsec) dsec.style.display='none';
    }
    try{ if(typeof _eRemPanelVisible!=='undefined' && _eRemPanelVisible){ _eRemPanelVisible=false;
      const rp=document.getElementById('e-rem-config'); if(rp) rp.style.display='none'; } }catch(_e){}
  }
  updateEditNoteDesgloseIndicators();
}

function toggleEditDesgloseSection(open){
  const sec=document.getElementById('e-desglose-section');
  if(!sec) return;
  const isManual = open===undefined;
  const show = isManual ? !_eDesgloseVisible : open;
  _eDesgloseVisible=show;
  sec.style.display=show?'block':'none';
  if(show){
    revealAnimate(sec);
    if(isManual && _eNoteVisible){
      _eNoteVisible=false;
      const nwrap=document.getElementById('e-note-field-wrap');
      if(nwrap) nwrap.style.display='none';
    }
    if(editDesgloses.length===0) addEditDesglose();
  }
  updateEditNoteDesgloseIndicators();
}

function openEdit(id) {
  const e = data.find(x=>x.id===id);
  if(!e) return;
  editId   = id;
  editDeferGroup = e.deferGroup || null; // grupo diferido (si aplica)
  editEmojiOverride = null; // sin override hasta que el usuario elija uno
  editType = e.type;
  updateEditMethodLabel();
  _ePropinaVisible=false; _eBenVisible=false;
  try{ updateEditBenMonthSelector(); }catch(_e){}
  // TC manual: leer la etiqueta de sistema TCauto (si el registro se guardó con TC manual)
  try{
    _fxOverrideEdit=null;
    _editFxAuto=null;
    // R7 · el campo arranca oculto en cada apertura: así la transición de entrada
    // corre desde cero en vez de heredar el estado del registro anterior.
    _eFxRowVisible=false;
    const _efr=document.getElementById('e-fx-row'); if(_efr) _efr.style.display='none';
    const _fxAuto=metaOf(e).fxAuto;
    if(isFinite(_fxAuto) && _fxAuto>0) _editFxAuto=_fxAuto;
    const _fxInp=document.getElementById('e-fx-manual');
    if(_fxInp){
      // Con TC manual guardado, el campo llega con ese TC (el efectivo del registro)
      const efectivo=_editHistoricRate();
      _fxInp.value = (_editFxAuto && efectivo>0) ? String(+efectivo.toFixed(4)) : '';
    }
    updateEditFxRow();
  }catch(_e){}
  editCat  = e.category;
  editSubcat = e.subcategory||'';
  editMethod = e.method||'Tarjeta de crédito';
  editBenOn  = false;
  // Mostrar el estado del recordatorio de este comercio (si tiene regla)
  try{
    if(typeof resetEditRemState==='function') resetEditRemState();
    if(typeof _eRemPanelVisible!=='undefined'){ _eRemPanelVisible=false;
      const rp=document.getElementById('e-rem-config'); if(rp) rp.style.display='none'; }
    if(typeof renderEditReminderSection==='function') renderEditReminderSection();
  }catch(err){}

  // --- Tipo ---
  // Quitar active de todos los botones de tipo
  document.querySelectorAll('[data-et]').forEach(b=>b.classList.remove('active'));
  // Manejar ahorro activo/pasivo igual que en registro
  const isAhorro = e.type==='ahorro'||e.type==='beneficio';
  if(isAhorro){
    document.getElementById('e-type-btn-ahorro').classList.add('active');
    document.getElementById('e-ahorro-type-lbl').textContent = e.type==='beneficio'?'Beneficio':'Ahorro';
  } else {
    document.querySelector(`[data-et="${e.type}"]`)?.classList.add('active');
  }
  // Sub-toggle ahorro: solo visible al editar un registro legacy de ahorro ACTIVO
  // (permite convertirlo a pasivo si se desea). Para pasivo normal, se oculta.
  const ahorroSub = document.getElementById('e-ahorro-sub-toggle');
  ahorroSub.style.display = (e.type==='ahorro') ? 'block' : 'none';
  if(isAhorro){
    const activo = document.getElementById('e-ahorro-sub-activo');
    const pasivo = document.getElementById('e-ahorro-sub-pasivo');
    activo.style.background = e.type==='ahorro'?'var(--blue)':'var(--surface2)';
    activo.style.color      = e.type==='ahorro'?'white':'var(--text3)';
    pasivo.style.background = e.type==='beneficio'?'var(--blue)':'var(--surface2)';
    pasivo.style.color      = e.type==='beneficio'?'white':'var(--text3)';
  }

  // --- Campos base ---
  document.getElementById('e-desc').value     = e.desc;
  // El monto guardado ya tiene restados: beneficio, propina incluida y desgloses.
  // Para editar mostramos el monto ORIGINAL sumándolos todos de vuelta.
  // ── DIFERIDOS: los hijos viven repartidos entre las mensualidades ──
  // El desglose se guardó prorrateado (300 en cada uno de los 6 meses), así que
  // para editarlo hay que SUMARLO a lo largo del grupo (1,800). El beneficio no
  // se prorratea: vive completo en la mensualidad donde se acreditó, y hay que
  // encontrarlo aunque se esté editando otro mes.
  const _grupoIds = e.deferGroup
    ? data.filter(x=>sameGroup(x.deferGroup, e.deferGroup)).map(x=>x.id)
    : [id];
  const _linkedBen = e.type==='egreso'
    ? data.find(x=>_grupoIds.includes(x.linkedTo) && x.type==='beneficio')
    : null;
  let _realDesgloses;
  if(e.deferGroup){
    const agrupados = {};
    data.filter(x=>_grupoIds.includes(x.linkedTo) && x.type===e.type && isDesglose(x))
      .forEach(x=>{
        const k = [x.category||'', x.subcategory||'', (x.desc||'').trim().toLowerCase()].join('||');
        if(!agrupados[k]) agrupados[k] = {...x, amount:0};
        agrupados[k].amount = +(agrupados[k].amount + x.amount).toFixed(2);
      });
    _realDesgloses = Object.values(agrupados);
  } else {
    _realDesgloses = data.filter(x=>x.linkedTo===id&&x.type===e.type&&isDesglose(x));
  }
  // R7 · 6a: el monto original ahora sale de origAmountOf() (01_nucleo), el
  // punto único de verdad. Aquí vivía una de las dos copias del cálculo.
  const _origAmount = origAmountOf(e);

  document.getElementById('e-amount').value   = formatAmountString(String(_origAmount));
  document.getElementById('e-currency').value = e.currency||'MXN';
  document.getElementById('e-date').value     = e.date;
  initStrip('e-date-strip', e.date);

  // Cargar desgloses existentes en el estado de edición
  editDesgloses = _realDesgloses.map(d=>({
    id: genId(),
    amount: d.amount,
    category: d.category,
    subcategory: d.subcategory||'',
    desc: ((d.desc||'').trim() !== (e.desc||'').trim()) ? (d.desc||'') : '',
    note: userNote(d),
    existingId: d.id
  }));
  renderEditDesgloses();
  updateEditDesgloseVisibility();

  // --- Nota: mostrar colapsada, pero con contenido si existe ---
  // Filtrar TODAS las etiquetas del sistema (se generan/muestran dinámicamente),
  // dejando solo la nota real del usuario.
  const cleanNote = userNote(e);
  document.getElementById('e-note').value = cleanNote;
  try{ _eNotePredicted=false; }catch(_e){}
  // Nota y Desglose son mutuamente excluyentes. Si el registro tiene desgloses,
  // se muestra el desglose por defecto; la nota queda disponible en su botón.
  const hasEditDesgloses = editDesgloses.length>0;
  if(cleanNote && !hasEditDesgloses){
    toggleENoteField(true);
  } else {
    toggleENoteField(false);
  }
  updateEditNoteMode();

  // --- Método de pago ---
  document.getElementById('e-method-field').style.display = e.type==='beneficio'?'none':'block';
  document.querySelectorAll('#e-chips .chip').forEach(c=>{
    const map={'Tarjeta de crédito':'Crédito','Efectivo':'Efectivo','Bono de despensa':'Bono despensa','SPEI':'SPEI','Débito':'Débito'};
    c.classList.toggle('active', c.textContent.trim()===(map[e.method]||e.method||'Crédito'));
  });

  // --- Categoría ---
  buildEditCatBlocks(e.type, e.category, e.subcategory||'');

  // --- Inline toggles (solo egreso) ---
  document.getElementById('e-inline-toggles').style.display = (e.type==='egreso')?'block':'none';

  // --- Beneficio ---
  // R5: reutilizamos _linkedBen (ya buscado arriba en TODO el grupo diferido)
  // en vez de buscar solo en este id. Antes, si abrías un mes DISTINTO al que
  // tiene el beneficio acreditado, esta búsqueda más estrecha no lo encontraba
  // y el beneficio parecía no existir al editar ese mes.
  if(_linkedBen){
    editBenOn=true; editBenType=_linkedBen.category;
    document.getElementById('e-ben-amount').value = formatAmountString(String(_linkedBen.amount));
    // R5: reconstruir si se capturó como % (y con qué valor), leyendo la
    // etiqueta "X% de $Y" que el guardado ya escribe en la nota del beneficio.
    // Sin esto, la edición siempre mostraba modo "$" con el resultado ya
    // calculado, perdiendo la forma en que realmente lo capturaste.
    const _pctMatch = (_linkedBen.note||'').match(/(\d+(?:\.\d+)?)%\s+de\s+/);
    const ePctInput = document.getElementById('e-ben-pct');
    if(_pctMatch){
      editBenType_mode='pct';
      if(ePctInput) ePctInput.value = _pctMatch[1];
    } else {
      editBenType_mode='monto';
      if(ePctInput) ePctInput.value='';
    }
  } else {
    editBenOn=false; editBenType='Cashback';
    document.getElementById('e-ben-amount').value='';
    editBenType_mode='monto';
    const ePctInput=document.getElementById('e-ben-pct'); if(ePctInput) ePctInput.value='';
  }
  setEditBenType(editBenType_mode);
  buildBenTypeBlocks('e-ben-type-blocks', editBenType, t=>{ editBenType=t; try{ updateEditBenMonthSelector(); }catch(e){} });
  updateEBenUI();
  try{ updateEditBenMonthSelector(); }catch(e){}
  onECurChange();

  // --- Propina (solo egreso) ---
  if(e.type==='egreso'){
    loadEditPropina(id);
  } else {
    editPropinaOn=false; editPropinaExistingId=null;
    const pp=document.getElementById('e-propina-panel');
    const pb=document.getElementById('e-inline-propina-btn');
    if(pp) pp.style.display='none';
    if(pb){ updateInlineBtn('e-inline-propina-btn', false, false); }
  }

  // Limpiar cualquier estilo residual de una animación de cierre previa
  const _sheet=document.getElementById('modal-sheet');
  if(_sheet){ _sheet.style.transform=''; _sheet.style.opacity=''; try{ _sheet.getAnimations().forEach(a=>a.cancel()); }catch(e){} }
  document.getElementById('edit-modal').classList.add('open');
  document.body.style.overflow='hidden';
  refreshEditEmojiBtn();
  setupEditDiferirPanel();
  // TAB INICIAL del renglón superior: si es diferido, se muestra el diferido;
  // si no, el beneficio o la propina que ya tenga. Los demás quedan cerrados
  // pero con su indicador de "contiene datos".
  try{
    if(!editDeferGroup){
      _eDiferirVisible=false;
      if(eBenHasData()){
        _eBenVisible=true;
        const bp=document.getElementById('e-ben-panel'); if(bp) bp.style.display='block';
      } else if(ePropinaHasData()){
        _ePropinaVisible=true;
        const pp=document.getElementById('e-propina-panel'); if(pp) pp.style.display='block';
      }
    }
    refreshEditTopTabs();
  }catch(_e){}
}

function closeModal(){
  _ePropinaVisible=false; _eBenVisible=false;
  document.getElementById('edit-modal').classList.remove('open');
  document.body.style.overflow='';
  editId=null;
  editDesgloses=[];
  editPropinaOn=false;
  editPropinaExistingId=null;
}
function closeEditModal(e){
  if(e.target===document.getElementById('edit-modal')) closeModal();
}

function buildEditCatBlocks(type, selCat, selSubcat){
  editCat = selCat || '';
  editSubcat = selSubcat || '';
  renderEditCatUI();
}

// Clase de color según el tipo de edición
function editColorCls(){
  return editType==='ingreso'?'sel-in':editType==='ahorro'?'sel-ah':editType==='beneficio'?'sel-pa':'sel-eg';
}

// Renderiza categorías/subcategorías en edición con el MISMO comportamiento colapsable
// que el registro: al abrir un registro, aparece ya seleccionado y acomodado.
function renderEditCatUI(){
  const container=document.getElementById('e-cat-blocks');
  const wrap=document.getElementById('e-subcat-wrap');
  if(!container) return;
  container.innerHTML='';
  if(wrap){ wrap.classList.remove('vis'); wrap.style.display='none'; }
  const colorCls=editColorCls();

  // Estado 1: sin categoría → mostrar todas
  if(!editCat){
    container.className='cat-grid-ui';
    container.style.gridTemplateColumns='';
    sortedCats(editType).forEach(cat=>{
      const b=makeEditCatButton(cat, ()=>selectEditCat(cat));
      container.appendChild(b);
    });
    return;
  }

  const subs=sortedSubcats(editType, editCat);
  const hasSubs=subs && !(subs.length===1 && subs[0]==='—');

  // Sin subcategorías → categoría a 100% ancho
  if(!hasSubs){
    container.className='cat-grid-ui';
    container.style.gridTemplateColumns='1fr';
    const catBtn=makeEditCatButton(editCat, ()=>selectEditCat(editCat));
    catBtn.classList.add(colorCls);
    applyCatBorder(catBtn, editCat);
    container.appendChild(catBtn);
    return;
  }

  // Con subcategorías → layout colapsado 2 columnas
  container.className='cat-collapsed-row';
  container.style.gridTemplateColumns='';
  const left=document.createElement('div'); left.className='cat-col-left';
  const catBtn=makeEditCatButton(editCat, ()=>selectEditCat(editCat));
  catBtn.classList.add(colorCls);
  applyCatBorder(catBtn, editCat);
  left.appendChild(catBtn);
  container.appendChild(left);

  const right=document.createElement('div'); right.className='cat-col-right';
  if(!editSubcat){
    subs.forEach(s=>{
      const b=makeEditCatButton(s, ()=>selectEditSubcat(s), true);
      right.appendChild(b);
    });
  } else {
    const b=makeEditCatButton(editSubcat, ()=>selectEditSubcat(editSubcat), true);
    b.classList.add(colorCls);
    applyCatBorder(b, editSubcat);
    right.appendChild(b);
  }
  container.appendChild(right);
}

function makeEditCatButton(name, onClick, isSubcat){
  const b=document.createElement('button');
  b.type='button';
  b.className='cat-block';
  const icon=(isSubcat ? (dynamicSubcatEmoji(name)||ICONS[name]) : ICONS[name])||'';
  b.innerHTML=`<span>${icon}</span><br>${name}`;
  b.onclick=onClick;
  return b;
}

function selectEditCat(cat){
  if(editCat===cat){ editCat=''; editSubcat=''; }
  else { editCat=cat; editSubcat=''; }
  renderEditCatUI();
  refreshEditEmojiBtn();
}

function selectEditSubcat(sub){
  if(editSubcat===sub){ editSubcat=''; }
  else { editSubcat=sub; }
  renderEditCatUI();
  refreshEditEmojiBtn();
}

function setEditType(t,btn){
  editType=t; editCat=''; editSubcat='';
  updateEditMethodLabel();
  document.querySelectorAll('[data-et]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('e-ahorro-sub-toggle').style.display='none';
  document.getElementById('e-ahorro-type-lbl').textContent = t==='beneficio'?'Beneficio':'Ahorro';
  document.getElementById('e-inline-toggles').style.display=t==='egreso'?'block':'none';
  document.getElementById('e-method-field').style.display=t==='beneficio'?'none':'block';
  if(t!=='egreso'){ editBenOn=false; updateEBenUI(); editDesgloses=[]; renderEditDesgloses(); }
  updateEditDesgloseVisibility();
  renderEditCatUI();
}



function setEditAhorroSubType(sub){
  editType = sub;
  editCat=''; editSubcat='';
  document.getElementById('e-ahorro-type-lbl').textContent = sub==='beneficio'?'Beneficio':'Ahorro';
  const activo=document.getElementById('e-ahorro-sub-activo');
  const pasivo=document.getElementById('e-ahorro-sub-pasivo');
  activo.style.background = sub==='ahorro'?'var(--blue)':'var(--surface2)';
  activo.style.color      = sub==='ahorro'?'white':'var(--text3)';
  pasivo.style.background = sub==='beneficio'?'var(--blue)':'var(--surface2)';
  pasivo.style.color      = sub==='beneficio'?'white':'var(--text3)';
  document.getElementById('e-inline-toggles').style.display='none';
  document.getElementById('e-method-field').style.display=sub==='beneficio'?'none':'block';
  editBenOn=false; updateEBenUI();
  buildEditCatBlocks(sub,'','');
}

function setEditMethod(m,el){
  editMethod=m;
  document.querySelectorAll('#e-chips .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
}

function toggleEBen(){
  const abrir = !_eBenVisible;
  _closeOtherEditTopTabs('ben');
  _eBenVisible = abrir;
  const panel=document.getElementById('e-ben-panel');
  if(panel){
    panel.style.display = abrir ? 'block' : 'none';
    if(abrir) revealAnimate(panel);
  }
  if(abrir){
    // Solo al ABRIR por primera vez (sin beneficio previo) se limpia el tipo,
    // para que se muestren todos como en las categorías.
    if(!editBenOn){
      editBenOn=true;
      editBenType='';
      buildBenTypeBlocks('e-ben-type-blocks', '', t=>{ editBenType=t; });
    }
  }
  refreshEditTopTabs();
}
// Se conserva el nombre porque otros flujos la llaman (cambio de tipo, reset).
function updateEBenUI(){
  const panel=document.getElementById('e-ben-panel');
  if(!editBenOn){ _eBenVisible=false; }
  if(panel) panel.style.display = _eBenVisible ? 'block' : 'none';
  try{ refreshEditTopTabs(); }catch(e){}
}

function onECurChange(){
  // Cambiar de moneda invalida el TC manual escrito para la anterior
  const _efx=document.getElementById('e-fx-manual');
  if(_efx) _efx.value='';
  _fxOverrideEdit=null; _editFxAuto=null;
  try{ updateEditFxRow(); }catch(e){}

  const cur=document.getElementById('e-currency').value;
  // R7 · punto 3: el badge "1 CAD = $12.60 MXN" del modal ya no existe; ese dato
  // es ahora el placeholder del campo de TC (updateEditFxRow).
  if(cur==='MXN') return;
  // Refrescar tarjetas de desglose del modal (etiqueta de moneda)
  try{ if(typeof renderEditDesgloses==='function') renderEditDesgloses(); }catch(e){}
}


// ════════════════════════════════════════════
// ELIMINACIÓN Y PROPINA EN EDICIÓN
// ════════════════════════════════════════════

// ══════════════════════════════════════
// ANIMACIÓN DE ELIMINACIÓN (historial)
// Pausa breve → fade out del elemento (y su header de día si queda vacío) →
// los elementos siguientes se recorren hacia arriba reapareciendo en cascada.
// ══════════════════════════════════════
function playDeleteAnimation(entryId, onComplete){
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const list=document.getElementById('hist-list');
  if(reduced || !list){ if(onComplete) onComplete(); return; }

  // Encontrar el elemento a eliminar en el DOM
  const rows=Array.from(list.querySelectorAll('.tx-item'));
  let targetEl=null;
  rows.forEach(el=>{ if(el._entryId===entryId) targetEl=el; });
  if(!targetEl){ if(onComplete) onComplete(); return; }

  // ¿Es el único registro de su día? (para desvanecer también el header del día)
  const listWrap = targetEl.closest('.tx-list');
  const siblingItems = listWrap ? Array.from(listWrap.querySelectorAll('.tx-item')) : [targetEl];
  const isOnlyInDay = siblingItems.length<=1;
  // El header del día es el hermano ANTERIOR al tx-list en el container
  const dayHeader = (isOnlyInDay && listWrap) ? listWrap.previousElementSibling : null;

  // Elementos que están DESPUÉS del eliminado en todo el listado (para recorrer hacia arriba)
  const allItems=Array.from(list.querySelectorAll('.day-group-hdr, .tx-item'));
  const targetIdx=allItems.indexOf(targetEl);
  const following = targetIdx>=0 ? allItems.slice(targetIdx+1) : [];

  // 1) Pausa breve (~500ms) antes de iniciar
  setTimeout(()=>{
    // 2) Fade out del elemento (+ header del día si queda vacío)
    const fadeTargets=[targetEl];
    if(isOnlyInDay && dayHeader) fadeTargets.push(dayHeader);
    fadeTargets.forEach(el=>{
      try{
        el.animate([
          {opacity:1,transform:'translateY(0)',maxHeight:el.offsetHeight+'px'},
          {opacity:0,transform:'translateY(-6px)'}
        ],{duration:320,easing:'cubic-bezier(0.55,0,0.67,0.2)',fill:'forwards'});
      }catch(e){}
    });

    // 3) Los siguientes se desvanecen para luego reaparecer en cascada
    following.forEach(el=>{
      try{ el.animate([{opacity:1},{opacity:0}],{duration:260,easing:'ease-out',fill:'forwards'}); }catch(e){}
    });

    // 4) Tras el fade, aplicar el cambio real de datos y re-renderizar con cascada
    setTimeout(()=>{ if(onComplete) onComplete(); }, 340);
  }, 500);
}
let propinaOn=false;
let propinaType='pct'; // 'pct' | 'monto'

// ── Estado del beneficio (espejo de propina) ──
let benType='monto';       // 'pct' | 'monto' — default monto directo

function setBenType(t){
  benType=t;
  const pctBtn=document.getElementById('ben-chip-pct');
  const montoBtn=document.getElementById('ben-chip-monto');
  const pctInput=document.getElementById('ben-pct');
  const montoInput=document.getElementById('ben-amount');
  if(pctBtn){ pctBtn.style.background=t==='pct'?'var(--accent)':'transparent'; pctBtn.style.color=t==='pct'?'white':'var(--text3)'; }
  if(montoBtn){ montoBtn.style.background=t==='monto'?'var(--accent)':'transparent'; montoBtn.style.color=t==='monto'?'white':'var(--text3)'; }
  if(pctInput) pctInput.style.display=t==='pct'?'':'none';
  if(montoInput) montoInput.style.display=t==='monto'?'':'none';
  calcBenPreview();
}

function getBenAmount(){
  if(!benOn) return 0;
  if(benType==='monto') return parseFloat(rawAmount(document.getElementById('ben-amount').value))||0;
  // Porcentaje: siempre directo sobre el monto registrado
  const pct=parseFloat(document.getElementById('ben-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  return +(amount * pct / 100).toFixed(2);
}




function updatePropinaUI(){
  const box=document.getElementById('t-box-propina');
  const extra=document.getElementById('propina-extra');
  if(box) box.classList.toggle('on', propinaOn);
  if(extra) extra.style.display=propinaOn?'block':'none';
}

let propinaSelMethod = null;
let propinaIncluida = false; // false = adicional (default), true = incluida en monto

function setPropinaIncluida(val){
  propinaIncluida=val;
  const inclBtn=document.getElementById('propina-incl-btn');
  const adicBtn=document.getElementById('propina-adic-btn');
  if(inclBtn){ inclBtn.style.background=val?'var(--accent)':'transparent'; inclBtn.style.color=val?'white':'var(--text3)'; }
  if(adicBtn){ adicBtn.style.background=!val?'var(--accent)':'transparent'; adicBtn.style.color=!val?'white':'var(--text3)'; }
  calcPropinaPreview();
}

function setPropinaMethod(m, btn){
  propinaSelMethod=m;
  document.querySelectorAll('#propina-method-chips .chip').forEach(c=>c.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

function getPropinaMethod(){
  return propinaSelMethod||null;
}

function setPropinaType(t){
  propinaType=t;
  const pctBtn=document.getElementById('propina-chip-pct');
  const montoBtn=document.getElementById('propina-chip-monto');
  const pctInput=document.getElementById('propina-pct');
  const montoInput=document.getElementById('propina-monto');
  const methodWrap=document.getElementById('propina-method-wrap');
  if(pctBtn){ pctBtn.style.background=t==='pct'?'var(--accent)':'transparent'; pctBtn.style.color=t==='pct'?'white':'var(--text3)'; }
  if(montoBtn){ montoBtn.style.background=t==='monto'?'var(--accent)':'transparent'; montoBtn.style.color=t==='monto'?'white':'var(--text3)'; }
  if(pctInput) pctInput.style.display=t==='pct'?'':'none';
  if(montoInput) montoInput.style.display=t==='monto'?'':'none';
  if(methodWrap) methodWrap.style.display=t==='monto'?'block':'none';
  if(t==='pct'){ propinaSelMethod=null; document.querySelectorAll('#propina-method-chips .chip').forEach(c=>c.classList.remove('active')); }
  calcPropinaPreview();
}

function calcPropinaPreview(){
  const preview=document.getElementById('propina-calc');
  if(!preview) return;
  if(propinaType==='monto'){ preview.textContent=''; return; }
  const pct=parseFloat(document.getElementById('propina-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  if(pct>0&&amount>0){
    const cur=document.getElementById('currency').value;
    const sym=cur==='MXN'?'$':`${cur} `;
    let propinaAmt;
    if(propinaIncluida){
      // Extract from total: propina = total * pct / (100 + pct)
      propinaAmt = amount * pct / (100 + pct);
    } else {
      // Additional: propina = total * pct / 100
      propinaAmt = amount * pct / 100;
    }
    const label = propinaIncluida ? 'del total' : 'adicional';
    preview.textContent=`= ${sym}${propinaAmt.toFixed(2)} ${label}`;
  } else {
    preview.textContent='';
  }
}

function getPropinaAmount(){
  if(!propinaOn) return 0;
  if(propinaType==='monto') return parseFloat(rawAmount(document.getElementById('propina-monto').value))||0;
  const pct=parseFloat(document.getElementById('propina-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  if(propinaIncluida){
    return +(amount * pct / (100 + pct)).toFixed(2);
  } else {
    return +(amount * pct / 100).toFixed(2);
  }
}

function resetPropina(){
  propinaOn=false;
  propinaType='pct';
  propinaIncluida=true;
  updatePropinaUI();
  const pctEl=document.getElementById('propina-pct');
  const montoEl=document.getElementById('propina-monto');
  const calcEl=document.getElementById('propina-calc');
  if(pctEl){ pctEl.value=''; pctEl.style.display=''; }
  if(montoEl){ montoEl.value=''; montoEl.style.display='none'; }
  if(calcEl) calcEl.textContent='';
  propinaSelMethod=null;
  const methodWrap=document.getElementById('propina-method-wrap');
  if(methodWrap) methodWrap.style.display='none';
  document.querySelectorAll('#propina-method-chips .chip').forEach(c=>c.classList.remove('active'));
  // Reset incl/adic buttons
  setPropinaIncluida(false); // Adicional by default
}

// ══════════════════════════════════════
// PROPINA EN EDICIÓN
// ══════════════════════════════════════
let editPropinaOn = false;
let editPropinaType = 'monto';       // 'pct' | 'monto'
let editPropinaIncluida = false;     // false = adicional
let editPropinaMethod = null;
let editPropinaExistingId = null;    // id del registro de propina existente (si lo hay)

// ── TABS SUPERIORES DEL MODAL (espejo del formulario de registro) ──
// Antes: estos botones eran interruptores de DATO (colapsar el panel BORRABA la
// propina o el beneficio) y el diferido escondía a los otros dos. Ahora son tabs:
// comparten el mismo espacio, colapsar solo cierra, y el botón queda marcado si
// contiene datos. Para quitar una propina o un beneficio se vacía su monto,
// igual que en el registro.
let _ePropinaVisible=false, _eBenVisible=false;

function ePropinaHasData(){
  try{ return editPropinaOn && getEditPropinaAmount()>0; }catch(e){ return false; }
}
function eBenHasData(){
  try{ return editType==='egreso' && editBenOn && getEditBenAmount()>0; }catch(e){ return false; }
}

// Cierra los paneles de los otros dos tabs, SIN tocar sus datos
function _closeOtherEditTopTabs(keep){
  if(keep!=='propina' && _ePropinaVisible){
    _ePropinaVisible=false;
    const p=document.getElementById('e-propina-panel'); if(p) p.style.display='none';
  }
  if(keep!=='ben' && _eBenVisible){
    _eBenVisible=false;
    const b=document.getElementById('e-ben-panel'); if(b) b.style.display='none';
  }
  if(keep!=='diferir' && typeof _eDiferirVisible!=='undefined' && _eDiferirVisible){
    _eDiferirVisible=false;
    const d=document.getElementById('e-diferir-panel'); if(d) d.style.display='none';
  }
}

// Exclusiones: Propina ↔ Diferir se esconden entre sí. Diferir ↔ Recordar
// también (bug 2: en edición NO se escondían en NINGUNA de las dos direcciones).
// Beneficio convive con todo.
let _eTabsBusy=false;   // guarda contra reentradas (renderEditReminderSection puede cerrar el panel 🔔)
function refreshEditTopTabs(){
  if(_eTabsBusy) return;
  _eTabsBusy=true;
  try{ _refreshEditTopTabs(); } finally { _eTabsBusy=false; }
}
function _refreshEditTopTabs(){
  const pbn=document.getElementById('e-inline-propina-btn');
  const dbn=document.getElementById('e-inline-diferir-btn');
  const full=document.getElementById('e-inline-diferir-full');
  const row=document.getElementById('e-inline-row-main');
  // El botón ancho del crossfade viejo queda retirado: la fila de tabs manda
  if(full){ try{ full.getAnimations().forEach(a=>a.cancel()); }catch(e){} full.style.opacity='0'; full.style.pointerEvents='none'; }
  if(row){ try{ row.getAnimations().forEach(a=>a.cancel()); }catch(e){} row.style.opacity=''; row.style.pointerEvents=''; }
  const propinaActiva = _ePropinaVisible || ePropinaHasData();
  const diferirActivo = (typeof _eDiferirVisible!=='undefined' && _eDiferirVisible) || editDiferirHasData();
  // Recordar activo (panel abierto o ya armado) esconde Diferir. Si Diferir está
  // activo, él manda y renderEditReminderSection() apaga a Recordar.
  const remActivo = (typeof _eRemPanelVisible!=='undefined' && _eRemPanelVisible)
                 || (typeof eRemHasData==='function' && eRemHasData());
  if(pbn) pbn.style.display = diferirActivo ? 'none' : '';
  if(dbn) dbn.style.display = (propinaActiva || (remActivo && !diferirActivo)) ? 'none' : '';
  updateInlineBtn('e-inline-propina-btn', _ePropinaVisible, ePropinaHasData() && !_ePropinaVisible);
  updateInlineBtn('e-inline-ben-btn', _eBenVisible, eBenHasData() && !_eBenVisible);
  updateInlineBtn('e-inline-diferir-btn', (typeof _eDiferirVisible!=='undefined' && _eDiferirVisible), editDiferirHasData() && !(typeof _eDiferirVisible!=='undefined' && _eDiferirVisible));
  try{ updateEditBenMonthSelector(); }catch(e){}
  try{ editUpdateDesgloseForDiferir(); }catch(e){}
  // Diferir → Recordar: recalcula si 🔔 debe estar visible (antes solo miraba si
  // el registro YA era diferido, no si acababas de activar el diferido aquí).
  try{ renderEditReminderSection(); }catch(e){}
}

function toggleEPropina(){
  const abrir = !_ePropinaVisible;
  _closeOtherEditTopTabs('propina');
  _ePropinaVisible = abrir;
  const panel=document.getElementById('e-propina-panel');
  if(panel){
    panel.style.display = abrir ? 'block' : 'none';
    if(abrir) revealAnimate(panel);
  }
  if(abrir) editPropinaOn = true;   // abrir el tab arma la propina; vaciar el monto la quita
  refreshEditTopTabs();
}

function setEditPropinaType(t){
  editPropinaType=t;
  const pctBtn=document.getElementById('e-propina-chip-pct');
  const montoBtn=document.getElementById('e-propina-chip-monto');
  const pctInput=document.getElementById('e-propina-pct');
  const montoInput=document.getElementById('e-propina-monto');
  const methodWrap=document.getElementById('e-propina-method-wrap');
  if(pctBtn){ pctBtn.style.background=t==='pct'?'var(--accent)':'transparent'; pctBtn.style.color=t==='pct'?'white':'var(--text3)'; }
  if(montoBtn){ montoBtn.style.background=t==='monto'?'var(--accent)':'transparent'; montoBtn.style.color=t==='monto'?'white':'var(--text3)'; }
  if(pctInput) pctInput.style.display=t==='pct'?'':'none';
  if(montoInput) montoInput.style.display=t==='monto'?'':'none';
  if(methodWrap) methodWrap.style.display=t==='monto'?'block':'none';
  if(t==='pct'){ editPropinaMethod=null; document.querySelectorAll('#e-propina-method-chips .chip').forEach(c=>c.classList.remove('active')); }
  calcEditPropinaPreview();
}

function setEditPropinaIncluida(val){
  editPropinaIncluida=val;
  const inclBtn=document.getElementById('e-propina-incl-btn');
  const adicBtn=document.getElementById('e-propina-adic-btn');
  if(inclBtn){ inclBtn.style.background=val?'var(--accent)':'transparent'; inclBtn.style.color=val?'white':'var(--text3)'; }
  if(adicBtn){ adicBtn.style.background=!val?'var(--accent)':'transparent'; adicBtn.style.color=!val?'white':'var(--text3)'; }
  calcEditPropinaPreview();
}

function setEditPropinaMethod(m, btn){
  editPropinaMethod=m;
  document.querySelectorAll('#e-propina-method-chips .chip').forEach(c=>c.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

function calcEditPropinaPreview(){
  const preview=document.getElementById('e-propina-calc');
  if(!preview) return;
  if(editPropinaType==='monto'){ preview.textContent=''; return; }
  const pct=parseFloat(document.getElementById('e-propina-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  if(pct>0&&amount>0){
    const cur=document.getElementById('e-currency').value;
    const sym=cur==='MXN'?'$':`${cur} `;
    let propinaAmt;
    if(editPropinaIncluida){ propinaAmt = amount * pct / (100 + pct); }
    else { propinaAmt = amount * pct / 100; }
    const label = editPropinaIncluida ? 'del total' : 'adicional';
    preview.textContent=`= ${sym}${propinaAmt.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} ${label}`;
  } else {
    preview.textContent='';
  }
}

function getEditPropinaAmount(){
  if(!editPropinaOn) return 0;
  if(editPropinaType==='monto') return parseFloat(rawAmount(document.getElementById('e-propina-monto').value))||0;
  const pct=parseFloat(document.getElementById('e-propina-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  if(editPropinaIncluida){ return +(amount * pct / (100 + pct)).toFixed(2); }
  return +(amount * pct / 100).toFixed(2);
}

// Carga el estado de la propina existente al abrir un registro para editar
function loadEditPropina(parentId){
  editPropinaExistingId=null;
  editPropinaOn=false;
  editPropinaType='monto';
  editPropinaIncluida=false;
  editPropinaMethod=null;
  // Buscar propina vinculada: identificada por categoría/subcategoría (robusto ante
  // cambios de formato de nota entre versiones).
  const prop = data.find(x=>
    x.linkedTo===parentId &&
    x.subcategory==='Propinas' &&
    x.category==='Generosidad' &&
    !isDesglose(x)
  );
  // Limpiar inputs
  const pctEl=document.getElementById('e-propina-pct');
  const montoEl=document.getElementById('e-propina-monto');
  if(pctEl){ pctEl.value=''; }
  if(montoEl){ montoEl.value=''; }
  document.querySelectorAll('#e-propina-method-chips .chip').forEach(c=>c.classList.remove('active'));

  if(prop){
    editPropinaOn=true;
    editPropinaExistingId=prop.id;
    const note=prop.note||'';
    // Detectar incluida/adicional (cualquier formato de nota)
    editPropinaIncluida = note.includes('incluida');
    // Detectar si fue porcentaje (la nota menciona "X%")
    const pctMatch=note.match(/(\d+(?:\.\d+)?)\s*%/);
    if(pctMatch){
      editPropinaType='pct';
      if(pctEl) pctEl.value=pctMatch[1];
    } else {
      // Monto directo: usar el monto guardado del registro de propina
      editPropinaType='monto';
      if(montoEl) montoEl.value=formatAmountString(String(prop.amount));
    }
    editPropinaMethod=prop.method||null;
    if(editPropinaMethod){
      document.querySelectorAll('#e-propina-method-chips .chip').forEach(c=>{
        if((c.getAttribute('onclick')||'').includes(`'${editPropinaMethod}'`)) c.classList.add('active');
      });
    }
  }
  // Reflejar en UI: botón activado y panel visible si hay propina
  const panel=document.getElementById('e-propina-panel');
  if(panel) panel.style.display=editPropinaOn?'block':'none';
  updateInlineBtn('e-inline-propina-btn', editPropinaOn, editPropinaOn);
  // Aplicar el estado visual de los toggles
  setEditPropinaType(editPropinaType);
  setEditPropinaIncluida(editPropinaIncluida);
  calcEditPropinaPreview();
}


// Título del campo de método en el modal de edición según el tipo
function updateEditMethodLabel(){
  const l=document.getElementById('e-method-label');
  if(l) l.textContent = (editType==='ingreso') ? 'Método de recepción' : 'Método de pago';
}


// Selector "¿en qué mensualidad se te acreditó?" del beneficio (solo diferidos)
function updateEditBenMonthSelector(){
  const row=document.getElementById('e-ben-month-row');
  const sel=document.getElementById('e-ben-month');
  if(!row || !sel) return;
  const grupo = editDeferGroup ? data.filter(x=>sameGroup(x.deferGroup, editDeferGroup)) : [];
  const n = (editDiferirMonths && editDiferirMonths>=2)
    ? editDiferirMonths
    : (grupo.length ? (grupo[0].deferTotal||grupo.length) : 0);
  if(!n || n<2){ row.style.display='none'; return; }
  // R5: solo aplica a beneficios tipo crédito recibido (Cashback). Un descuento
  // aplicado ya redujo el total antes de prorratear; no se "acredita" en un mes.
  if(!editBenType || (typeof benReduceGasto==='function' && benReduceGasto(editBenType))){
    row.style.display='none'; return;
  }
  // Mes donde está hoy el beneficio (si ya existe)
  let actual=1;
  const madres=grupo.slice().sort((a,b)=>a.deferIndex-b.deferIndex);
  madres.forEach(m=>{
    const ben=data.find(x=>x.linkedTo===m.id && x.type==='beneficio');
    if(ben) actual=m.deferIndex;
  });
  sel.innerHTML='';
  for(let i=1;i<=n;i++){
    const o=document.createElement('option');
    o.value=String(i);
    o.textContent=`Mensualidad ${i} de ${n}`;
    sel.appendChild(o);
  }
  sel.value=String(Math.min(actual,n));
  row.style.display='block';
}


// ══════════ TC MANUAL EN EL MODAL DE EDICIÓN ══════════
// El campo aparece solo en moneda extranjera.
//  · Registro con TC automático → campo VACÍO, placeholder = TC histórico.
//    Dejarlo vacío conserva el histórico (nada se recalcula por error).
//  · Registro con TC manual → el campo llega con ESE TC y aparece el enlace
//    "Regresar a TC histórico": lo vacía y, al guardar, se recalcula todo con
//    el automático que se guardó el día del registro.
let _editFxAuto = null;   // TC automático original (de la etiqueta TCauto)

function _eFxParse(v){
  const n=parseFloat(String(v||'').replace(/[^\d.]/g,''));
  return (isFinite(n) && n>0) ? n : null;
}
// TC histórico efectivo del registro (el que realmente se usó al guardarlo)
function _editHistoricRate(){
  const e=data.find(x=>String(x.id)===String(editId));
  if(!e) return 0;
  const a=Number(e.amount), m=Number(e.amountMXN);
  return (a>0 && m>0) ? m/a : 0;
}
// R7 · punto 3 en EDICIÓN (mismo rediseño que el formulario, con una diferencia
// que importa: aquí el "automático" NO es el TC de hoy, es el TC HISTÓRICO del
// registro — el que se derivó de amountMXN/amount cuando lo capturaste. Por eso
// el "MXN" de al lado dice "MXN · histórico": el placeholder ya no cabe esa
// palabra, pero el dato no se pierde.
let _eFxRowVisible = false;
function updateEditFxRow(){
  const cur=document.getElementById('e-currency')?.value||'MXN';
  const row=document.getElementById('e-fx-row');
  const inp=document.getElementById('e-fx-manual');
  const hint=document.getElementById('e-fx-hint');
  const unit=document.getElementById('e-fx-unit');
  const revert=document.getElementById('e-fx-revert');
  if(!row||!inp) return;
  if(cur==='MXN'){
    if(revert) revert.style.display='none';
    inp.value=''; _fxOverrideEdit=null;
    if(_eFxRowVisible){ _eFxRowVisible=false; hideAnimate(row); }
    else row.style.display='none';
    return;
  }
  // El histórico del registro manda. Si cambiaste la moneda dentro del modal (o
  // es un registro nuevo copiado), no hay histórico: cae al automático real.
  const historico = _editFxAuto || _editHistoricRate() || 0;
  const base = historico || fxAutoRate(cur);
  const esHistorico = !!historico;
  inp.placeholder = base ? fxPlaceholder(cur, base) : `${curSym(cur)} 1 = ?`;
  if(unit) unit.textContent = (base && esHistorico) ? 'MXN · histórico' : 'MXN';
  _fxOverrideEdit=_eFxParse(inp.value);
  if(hint){
    const mostrar = !base && !_fxOverrideEdit;
    hint.textContent = mostrar ? FX_SIN_AUTO : '';
    hint.style.display = mostrar ? '' : 'none';
  }
  // El enlace de revertir solo tiene sentido si el registro tiene TC manual guardado
  if(revert) revert.style.display = (_editFxAuto && inp.value.trim()!=='') ? 'block' : 'none';
  if(!_eFxRowVisible){
    _eFxRowVisible=true;
    row.style.display='flex';
    try{ revealAnimate(row); }catch(e){}
  }
}
function onEFxManualInput(){
  _fxOverrideEdit=_eFxParse(document.getElementById('e-fx-manual')?.value);
  updateEditFxRow();
  try{ calcEditPropinaPreview(); calcEditBenPreview(); updateEditDesgloseRemaining(); renderEditDiferirPreview(); }catch(e){}
}
// Vaciar el campo: al guardar, todo se recalcula con el TC automático original
function revertFxToHistoric(){
  const inp=document.getElementById('e-fx-manual');
  if(inp) inp.value='';
  _fxOverrideEdit=null;
  updateEditFxRow();
  try{ toast('Al guardar se recalculará con el TC histórico'); }catch(e){}
}


// ── NOTA PREDICHA EN EL MODAL (edición y copia) ──
// Solo actúa si la nota está VACÍA: nunca pisa la nota que ya tenía el registro.
let _eNotePredicted=false;
function predictEditNote(){
  try{
    const noteEl=document.getElementById('e-note');
    if(!noteEl || typeof predictNoteForDesc!=='function') return;
    const desc=(document.getElementById('e-desc')?.value||'').trim();
    const yaEscrita = noteEl.value.trim()!=='' && !_eNotePredicted;
    if(yaEscrita) return;
    const pn=predictNoteForDesc(desc, editType);
    if(pn){ noteEl.value=pn; _eNotePredicted=true; }
    else if(_eNotePredicted){ noteEl.value=''; _eNotePredicted=false; }
    updateEditNoteDesgloseIndicators();
  }catch(e){}
}
// Escribirla a mano cancela la predicción
function onENoteInput(){
  _eNotePredicted=false;
  updateEditNoteDesgloseIndicators();
}
