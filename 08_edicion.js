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
  try{ resetCopyModeUI(); }catch(_e){}
  try{ updateEditBenMonthSelector(); }catch(_e){}
  // TC manual: leer la etiqueta de sistema TCauto (si el registro se guardó con TC manual)
  try{
    _fxOverrideEdit=null;
    _editFxAuto=null;
    const _tc=(e.note||'').split(' | ').map(p=>p.trim()).find(p=>p.startsWith('TCauto:'));
    if(_tc){
      const v=parseFloat(_tc.replace('TCauto:','').trim());
      if(isFinite(v) && v>0) _editFxAuto=v;
    }
    const _fxInp=document.getElementById('e-fx-manual');
    if(_fxInp){
      // Con TC manual guardado, el campo llega con ese TC (el efectivo del registro)
      const efectivo=_editHistoricRate();
      _fxInp.value = (_editFxAuto && efectivo>0) ? String(+efectivo.toFixed(4)) : '';
    }
    updateEditFxRow();
  }catch(_e){}
  const _cpBtn=document.getElementById('e-copy-btn');
  if(_cpBtn) _cpBtn.style.display = e.deferGroup ? 'none' : '';
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
  const isAhorro = e.type==='ahorro'||e.type==='ahorro-pasivo';
  if(isAhorro){
    document.getElementById('e-type-btn-ahorro').classList.add('active');
    document.getElementById('e-ahorro-type-lbl').textContent = e.type==='ahorro-pasivo'?'Beneficio':'Ahorro';
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
    pasivo.style.background = e.type==='ahorro-pasivo'?'var(--blue)':'var(--surface2)';
    pasivo.style.color      = e.type==='ahorro-pasivo'?'white':'var(--text3)';
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
    ? data.find(x=>_grupoIds.includes(x.linkedTo) && x.type==='ahorro-pasivo')
    : null;
  let _realDesgloses;
  if(e.deferGroup){
    const agrupados = {};
    data.filter(x=>_grupoIds.includes(x.linkedTo) && x.type===e.type && (x.note||'').includes('Desglose de:'))
      .forEach(x=>{
        const k = [x.category||'', x.subcategory||'', (x.desc||'').trim().toLowerCase()].join('||');
        if(!agrupados[k]) agrupados[k] = {...x, amount:0};
        agrupados[k].amount = +(agrupados[k].amount + x.amount).toFixed(2);
      });
    _realDesgloses = Object.values(agrupados);
  } else {
    _realDesgloses = data.filter(x=>x.linkedTo===id&&x.type===e.type&&(x.note||'').includes('Desglose de:'));
  }
  // Propina incluida: se sumó al cobro original, hay que devolverla al monto mostrado
  const _linkedPropina = e.type==='egreso' ? data.find(x=>x.linkedTo===id&&x.subcategory==='Propinas'&&(x.note||'').includes('Propina de:')) : null;
  const _propinaIncluida = _linkedPropina && (_linkedPropina.note||'').includes('incluida');

  let _origAmount = e.amount;
  if(_linkedBen) _origAmount += _linkedBen.amount;
  _realDesgloses.forEach(d=>{ _origAmount += d.amount; });
  if(_propinaIncluida) _origAmount += _linkedPropina.amount;
  _origAmount = +(_origAmount).toFixed(2);

  // Si es un gasto diferido, el monto a editar es el TOTAL original, no la mensualidad
  if(e.deferGroup && e.deferOriginal){
    _origAmount = e.deferOriginal;
  }

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
    note: (d.note||'').split(' | ').filter(p=>!p.startsWith('Desglose de:')&&!p.startsWith('Monto original:')).join(' | '),
    existingId: d.id
  }));
  renderEditDesgloses();
  updateEditDesgloseVisibility();

  // --- Nota: mostrar colapsada, pero con contenido si existe ---
  // Filtrar TODAS las etiquetas del sistema (se generan/muestran dinámicamente),
  // dejando solo la nota real del usuario.
  const cleanNote = (e.note||'').split(' | ').filter(p=>{
    const t=p.trim();
    return t.length>0
        && !t.startsWith('TC:')
        && !t.startsWith('TCauto:')
        && !t.startsWith('Monto original:')
        && !t.startsWith('Desglose de:')
        && !t.startsWith('Propina de:')
        && !t.startsWith('Beneficio de:')
        && !t.startsWith('Vinculado a:')
        && !t.startsWith('Propina ')       // "Propina X% incluida/adicional" (viejo)
        && !/^\d+%\s/.test(t);              // "10% de $X"
  }).join(' | ');
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
  document.getElementById('e-method-field').style.display = e.type==='ahorro-pasivo'?'none':'block';
  document.querySelectorAll('#e-chips .chip').forEach(c=>{
    const map={'Tarjeta de crédito':'Crédito','Efectivo':'Efectivo','Bono de despensa':'Bono despensa','SPEI':'SPEI','Débito':'Débito'};
    c.classList.toggle('active', c.textContent.trim()===(map[e.method]||e.method||'Crédito'));
  });

  // --- Categoría ---
  buildEditCatBlocks(e.type, e.category, e.subcategory||'');

  // --- Inline toggles (solo egreso) ---
  document.getElementById('e-inline-toggles').style.display = (e.type==='egreso')?'block':'none';

  // --- Beneficio ---
  const linked = e.type==='egreso' ? data.find(x=>x.linkedTo===id&&x.type==='ahorro-pasivo') : null;
  if(linked){
    editBenOn=true; editBenType=linked.category;
    document.getElementById('e-ben-amount').value = formatAmountString(String(linked.amount));
  } else {
    editBenOn=false; editBenType='Cashback';
    document.getElementById('e-ben-amount').value='';
  }
  // El beneficio se guarda como monto MXN final; al editar siempre se muestra como monto directo
  editBenType_mode='monto';
  const ePctInput=document.getElementById('e-ben-pct'); if(ePctInput) ePctInput.value='';
  setEditBenType('monto');
  buildBenTypeBlocks('e-ben-type-blocks', editBenType, t=>{ editBenType=t; });
  updateEBenUI();
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
}

function closeModal(){
  try{ resetCopyModeUI(); }catch(_e){}
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
  return editType==='ingreso'?'sel-in':editType==='ahorro'?'sel-ah':editType==='ahorro-pasivo'?'sel-pa':'sel-eg';
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
  document.getElementById('e-ahorro-type-lbl').textContent = t==='ahorro-pasivo'?'Beneficio':'Ahorro';
  document.getElementById('e-inline-toggles').style.display=t==='egreso'?'block':'none';
  document.getElementById('e-method-field').style.display=t==='ahorro-pasivo'?'none':'block';
  if(t!=='egreso'){ editBenOn=false; updateEBenUI(); editDesgloses=[]; renderEditDesgloses(); }
  updateEditDesgloseVisibility();
  renderEditCatUI();
}



function setEditAhorroSubType(sub){
  editType = sub;
  editCat=''; editSubcat='';
  document.getElementById('e-ahorro-type-lbl').textContent = sub==='ahorro-pasivo'?'Beneficio':'Ahorro';
  const activo=document.getElementById('e-ahorro-sub-activo');
  const pasivo=document.getElementById('e-ahorro-sub-pasivo');
  activo.style.background = sub==='ahorro'?'var(--blue)':'var(--surface2)';
  activo.style.color      = sub==='ahorro'?'white':'var(--text3)';
  pasivo.style.background = sub==='ahorro-pasivo'?'var(--blue)':'var(--surface2)';
  pasivo.style.color      = sub==='ahorro-pasivo'?'white':'var(--text3)';
  document.getElementById('e-inline-toggles').style.display='none';
  document.getElementById('e-method-field').style.display=sub==='ahorro-pasivo'?'none':'block';
  editBenOn=false; updateEBenUI();
  buildEditCatBlocks(sub,'','');
}

function setEditMethod(m,el){
  editMethod=m;
  document.querySelectorAll('#e-chips .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
}

function toggleEBen(){
  editBenOn=!editBenOn;
  updateEBenUI();
  if(editBenOn){
    // Empezar sin selección para mostrar todos los tipos (como las categorías)
    editBenType='';
    buildBenTypeBlocks('e-ben-type-blocks', '', t=>{ editBenType=t; });
  }
}
function updateEBenUI(){
  const panel=document.getElementById('e-ben-panel');
  updateInlineBtn('e-inline-ben-btn', editBenOn, editBenOn);
  if(panel) panel.style.display = editBenOn?'block':'none';
}

function onECurChange(){
  // Cambiar de moneda invalida el TC manual escrito para la anterior
  const _efx=document.getElementById('e-fx-manual');
  if(_efx) _efx.value='';
  _fxOverrideEdit=null; _editFxAuto=null;
  try{ updateEditFxRow(); }catch(e){}

  const cur=document.getElementById('e-currency').value;
  const note=document.getElementById('e-rate-note');
  if(cur==='MXN'){note.style.display='none';return;}
  note.style.display='flex';
  document.getElementById('e-rate-text').textContent=
    `1 ${cur} = $${rates[cur].toLocaleString('es-MX',{minimumFractionDigits:2})} MXN${ratesLoaded?'':' (estimado)'}`;
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

function toggleEPropina(){
  editPropinaOn = !editPropinaOn;
  const panel=document.getElementById('e-propina-panel');
  if(panel) panel.style.display = editPropinaOn ? 'block' : 'none';
  updateInlineBtn('e-inline-propina-btn', editPropinaOn, editPropinaOn);
  if(editPropinaOn) revealAnimate(panel);
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
    !(x.note||'').includes('Desglose de:')
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


// ══════════ COPIAR REGISTRO ══════════
// El modal entra en "modo copia": todo lo cargado se conserva y al Guardar se
// crea un registro NUEVO (padre + hijos frescos) sin tocar el original.
let copyMode=false;

function resetCopyModeUI(){
  copyMode=false;
  const t=document.getElementById('edit-modal-title'); if(t) t.textContent='Editar registro';
  const del=document.querySelector('#edit-modal .btn-delete'); if(del) del.style.display='';
  const cb=document.getElementById('e-copy-btn'); if(cb) cb.style.display='';
}

function startCopy(){
  if(copyMode) return;
  const e=data.find(x=>String(x.id)===String(editId));
  if(!e || e.deferGroup) return; // los diferidos no se copian (sus mensualidades son un grupo)
  const sheet=document.getElementById('modal-sheet');
  const enterCopy=()=>{
    copyMode=true;
    const t=document.getElementById('edit-modal-title'); if(t) t.textContent='Copia del registro';
    const del=document.querySelector('#edit-modal .btn-delete'); if(del) del.style.display='none';
    const cb=document.getElementById('e-copy-btn'); if(cb) cb.style.display='none';
    // La sección de recordatorio SÍ se muestra en modo copia (la copia es
    // idéntica); además es "viva": sigue al nombre que escribas.
    try{ renderEditReminderSection(); }catch(_e){}
  };
  if(!sheet){ enterCopy(); return; }
  // Animación "fantasma que se asienta" (opción 2 elegida): la hoja se eleva
  // translúcida y se re-asienta ya convertida en la copia, con pulso azul.
  try{
    const a=sheet.animate([
      {transform:'translateY(0) scale(1)', opacity:1},
      {transform:'translateY(-14px) scale(1.015)', opacity:0.55, offset:0.45},
      {transform:'translateY(0) scale(1)', opacity:1}
    ],{duration:700,easing:'cubic-bezier(0.22,0.61,0.36,1)'});
    setTimeout(enterCopy, 300); // el título cambia a mitad del vuelo
    a.onfinish=()=>{
      try{
        sheet.animate([
          {boxShadow:'0 0 0 3px rgba(0,113,227,0.5)'},
          {boxShadow:'0 0 0 0 rgba(0,113,227,0)'}
        ],{duration:650,easing:'ease'});
      }catch(_e){}
    };
  }catch(_e){ enterCopy(); }
}

// Aparición del registro copiado en el historial: inverso exacto del borrado —
// el hueco se abre, la fila entra deslizándose desde la izquierda con borde
// acento que se desvanece, y los registros de abajo se acomodan.
function playAppearAnimation(entryId){
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const list=document.getElementById('hist-list');
  if(reduced || !list) return;
  const rows=Array.from(list.querySelectorAll('.tx-item'));
  let el=null;
  rows.forEach(r=>{ if(r._entryId===entryId) el=r; });
  if(!el) return;
  const h=el.offsetHeight;
  el.style.overflow='hidden';
  el.style.borderLeft='3px solid var(--accent)';
  try{
    const a=el.animate([
      {height:'0px', opacity:0, transform:'translateX(-24px)', paddingTop:'0px', paddingBottom:'0px'},
      {height:h+'px', opacity:1, transform:'translateX(0)'}
    ],{duration:520,easing:'cubic-bezier(0.22,0.61,0.36,1)'});
    let after=false;
    rows.forEach(r=>{
      if(r===el){ after=true; return; }
      if(after){
        try{ r.animate([{transform:'translateY(-6px)'},{transform:'translateY(0)'}],{duration:480,delay:60,easing:'cubic-bezier(0.22,0.61,0.36,1)'}); }catch(_e){}
      }
    });
    a.onfinish=()=>{
      el.style.overflow='';
      try{
        el.animate([{borderLeftColor:'var(--accent)'},{borderLeftColor:'transparent'}],{duration:900,fill:'forwards'})
          .onfinish=()=>{ el.style.borderLeft=''; };
      }catch(_e){ el.style.borderLeft=''; }
    };
  }catch(_e){ el.style.overflow=''; el.style.borderLeft=''; }
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
  // Mes donde está hoy el beneficio (si ya existe)
  let actual=1;
  const madres=grupo.slice().sort((a,b)=>a.deferIndex-b.deferIndex);
  madres.forEach(m=>{
    const ben=data.find(x=>x.linkedTo===m.id && x.type==='ahorro-pasivo');
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
function updateEditFxRow(){
  const cur=document.getElementById('e-currency')?.value||'MXN';
  const row=document.getElementById('e-fx-row');
  const inp=document.getElementById('e-fx-manual');
  const hint=document.getElementById('e-fx-hint');
  const revert=document.getElementById('e-fx-revert');
  if(!row||!inp) return;
  if(cur==='MXN'){
    row.style.display='none';
    if(revert) revert.style.display='none';
    inp.value=''; _fxOverrideEdit=null;
    return;
  }
  // Placeholder: si hubo TC manual, el automático guardado; si no, el histórico
  const base = _editFxAuto || _editHistoricRate() || rates[cur] || 0;
  inp.placeholder = base ? `${base.toFixed(2)} (histórico)` : 'automático';
  _fxOverrideEdit=_eFxParse(inp.value);
  if(hint){
    hint.textContent = _fxOverrideEdit
      ? `1 ${cur} = $${_fxOverrideEdit.toFixed(2)} MXN`
      : (base ? `Vacío = conservar $${base.toFixed(2)}` : 'Vacío = automático');
  }
  // El enlace de revertir solo tiene sentido si el registro tiene TC manual guardado
  if(revert) revert.style.display = (_editFxAuto && inp.value.trim()!=='') ? 'block' : 'none';
  row.style.display='flex';
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
