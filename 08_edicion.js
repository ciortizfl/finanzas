// ════════════════════════════════════════════
// MODAL DE EDICIÓN
// ════════════════════════════════════════════

// ══════════════════════════════════════
// EDIT MODAL
// ══════════════════════════════════════
let editId = null;
// R9 · Descripción/tipo ORIGINALES del registro que se está editando. Sirven
// para detectar un renombre y arrastrar el recordatorio ligado (que se
// identifica por _remKey(type, desc)).
let editOrigDesc = null;
let editOrigType = null;
let editDeferGroup = null;
let editDiferirMonths = 0;    // meses elegidos en edición de diferido
let editDiferirCustom = false;
let editType = 'egreso';
let editCat = '';
let editSubcat = '';
let editMethod = '';
// R7.2: editBenOn desapareció — el estado vive en el arreglo `editBeneficios` (03_desgloses).

let _eNoteVisible=false;
let _eDesgloseVisible=false;

function eNoteHasData(){
  const el=document.getElementById('e-note');
  return !!(el && el.value.trim().length>0);
}
function eDesgloseHasData(){
  return editDesgloses.some(d=>d.amount>0);
}
// R7.2: la Nota ya no vive en el renglón inferior — solo Desglose y Recordar
function updateEditNoteDesgloseIndicators(){
  updateInlineBtn('e-desglose-toggle-btn', _eDesgloseVisible, eDesgloseHasData());
  // 🔔 Recordar (con-datos = recordatorio armado o regla ya existente)
  try{
    const { type, desc } = _eRemTarget();
    const tieneRegla = (type==='egreso' && desc.length>=2 && !!getManualRule(type, desc));
    updateInlineBtn('e-rem-toggle-btn',
      typeof _eRemPanelVisible!=='undefined' && _eRemPanelVisible,
      (typeof eRemHasData==='function' && eRemHasData()) || tieneRegla);
  }catch(e){}
}

// R7.2 · Nota bajo Descripción en EDICIÓN — mismas reglas de foco que el registro
function showEditNoteField(){
  const wrap=document.getElementById('e-note-field-wrap');
  if(!wrap || _eNoteVisible) return;
  _eNoteVisible=true;
  _setNoteOpen('e-note-field-wrap', true);
  // R8.1: emerge deslizándose POR DEBAJO de Descripción (ver noteReveal en 02)
  noteReveal(wrap);
}
function maybeHideEditNoteField(){
  const wrap=document.getElementById('e-note-field-wrap');
  if(!wrap || !_eNoteVisible) return;
  if(eNoteHasData()) return;
  _eNoteVisible=false;
  _setNoteOpen('e-note-field-wrap', false);
  noteHide(wrap);
}
// R8 · ✕ de la Nota en edición (espejo del registro): vacía y colapsa sin confirmar.
function clearEditNoteField(){
  const el=document.getElementById('e-note');
  if(el) el.value='';
  try{ _eNotePredicted=false; }catch(_e){}
  _eNoteVisible=false;
  _setNoteOpen('e-note-field-wrap', false);
  noteHide(document.getElementById('e-note-field-wrap'));
}
let _editNoteBehaviorReady=false;
function initEditNoteBehavior(){
  if(_editNoteBehaviorReady) return;
  const desc=document.getElementById('e-desc');
  const note=document.getElementById('e-note');
  if(!desc || !note) return;
  _editNoteBehaviorReady=true;
  desc.addEventListener('focus', showEditNoteField);
  const onOut=()=>{
    setTimeout(()=>{
      const ae=document.activeElement;
      if(ae===desc || ae===note) return;
      maybeHideEditNoteField();
    }, 0);
  };
  desc.addEventListener('blur', onOut);
  note.addEventListener('blur', onOut);
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
    // Mutuamente excluyente (solo en clic manual): cerrar Recordar si estaba abierto
    try{ if(isManual && typeof _eRemPanelVisible!=='undefined' && _eRemPanelVisible){ _eRemPanelVisible=false;
      const rp=document.getElementById('e-rem-config'); if(rp) rp.style.display='none'; } }catch(_e){}
    if(editDesgloses.length===0) addEditDesglose();
  }
  updateEditNoteDesgloseIndicators();
}

function openEdit(id) {
  const e = data.find(x=>x.id===id);
  if(!e) return;
  editId   = id;
  // R9 · Guardamos la descripción ORIGINAL: los recordatorios se identifican
  // por _remKey(type, desc), así que si el usuario renombra el registro hay
  // que renombrar también su recordatorio para que no quede huérfano.
  editOrigDesc = (e.desc || '').trim();
  editOrigType = e.type;
  editDeferGroup = e.deferGroup || null; // grupo diferido (si aplica)
  editEmojiOverride = null; // sin override hasta que el usuario elija uno
  editDesgEmojiOverrides = {}; _emojiTarget = 'madre'; // R11 · overrides por desglose
  editType = e.type;
  _ePropinaVisible=false; _eBenVisible=false;
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
  editMethod = e.method||'';
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
  // R7.2: puede haber VARIOS beneficios vinculados (en un diferido viven en la
  // mensualidad 1, pero se buscan en todo el grupo por robustez con datos viejos).
  const _linkedBens = e.type==='egreso'
    ? data.filter(x=>_grupoIds.includes(x.linkedTo) && x.type==='beneficio')
    : [];
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
  // R7.2: con contenido, la Nota permanece visible bajo Descripción; vacía,
  // arranca oculta y aparecerá al enfocar Descripción.
  initEditNoteBehavior();
  const _eNoteWrap=document.getElementById('e-note-field-wrap');
  _eNoteVisible = !!cleanNote;
  if(_eNoteWrap) _eNoteWrap.style.display = cleanNote ? 'block' : 'none';
  _setNoteOpen('e-note-field-wrap', !!cleanNote);   // R8.2: continuidad visual
  // Si hay desgloses, la sección se muestra por defecto (comportamiento previo)
  const hasEditDesgloses = editDesgloses.length>0;

  // --- Método de pago ---
  // R9 · punto 9: el picker vive integrado al renglón de Monto (ya no son
  // chips sueltos) — editMethod (asignado arriba) se pinta con
  // _paintEditMethodBtn().
  const eMWrap=document.getElementById('e-method-picker-wrap');
  const eMLbl=document.getElementById('e-method-lbl');
  if(eMWrap) eMWrap.style.display = e.type==='beneficio' ? 'none' : '';
  if(eMLbl) eMLbl.style.display = e.type==='beneficio' ? 'none' : '';
  _paintEditMethodBtn();

  // --- Categoría ---
  buildEditCatBlocks(e.type, e.category, e.subcategory||'');

  // --- Inline toggles (solo egreso) ---
  document.getElementById('e-inline-toggles').style.display = (e.type==='egreso')?'block':'none';

  // --- Beneficios (R7.2: bloques múltiples) ---
  // Cada hijo tipo 'beneficio' se convierte en un bloque. Si su meta trae
  // ben:{pct} (capturado como porcentaje), el bloque se reconstruye en modo %;
  // metaOf también deriva ese dato de las notas legacy "X% de $Y".
  editBeneficios = _linkedBens.map(b=>{
    const _bm=metaOf(b);
    if(_bm.ben && isFinite(_bm.ben.pct) && _bm.ben.pct>0){
      return { id:genId(), mode:'pct', pct:_bm.ben.pct, amount:0, category:b.category||'' };
    }
    return { id:genId(), mode:'monto', pct:0, amount:b.amount, category:b.category||'' };
  });
  renderEditBeneficios(false);
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
  // R8 · TEMA 8 — Al abrir para editar, TODOS los módulos expandibles inician
  // COLAPSADOS (beneficios, propina, desglose, diferido, recordatorio). Sus
  // botones reflejan si contienen datos vía refreshEditTopTabs / los indicadores
  // "con datos". La ÚNICA excepción es la Nota, que se abre sola si tiene texto
  // (eso lo maneja su propia lógica al cargar el registro, más arriba).
  try{
    _eDiferirVisible=false;
    _eBenVisible=false;
    _ePropinaVisible=false;
    const bp=document.getElementById('e-ben-panel'); if(bp) bp.style.display='none';
    const pp=document.getElementById('e-propina-panel'); if(pp) pp.style.display='none';
    // Diferido: colapsar el panel también (su indicador "con datos" lo pinta
    // refreshEditTopTabs a partir de editDiferirHasData()). setupEditDiferirPanel
    // ya cargó los meses/preset, así que al re-expandirlo estarán listos.
    const dp=document.getElementById('e-diferir-panel'); if(dp) dp.style.display='none';
    // Desglose: colapsar el panel pero conservar el indicador "con datos" del
    // botón (updateEditNoteDesgloseIndicators ya lo pinta según eDesgloseHasData).
    _eDesgloseVisible=false;
    const ds=document.getElementById('e-desglose-section'); if(ds) ds.style.display='none';
    try{ updateEditNoteDesgloseIndicators(); }catch(_e2){}
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
  const icon=(ICONS[name])||'';   // R10.1: emoji estático (ya NO cambia por uso más frecuente)
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
  document.querySelectorAll('[data-et]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('e-ahorro-sub-toggle').style.display='none';
  document.getElementById('e-ahorro-type-lbl').textContent = t==='beneficio'?'Beneficio':'Ahorro';
  document.getElementById('e-inline-toggles').style.display=t==='egreso'?'block':'none';
  const eMWrap1=document.getElementById('e-method-picker-wrap');
  const eMLbl1=document.getElementById('e-method-lbl');
  if(eMWrap1) eMWrap1.style.display = t==='beneficio' ? 'none' : '';
  if(eMLbl1) eMLbl1.style.display = t==='beneficio' ? 'none' : '';
  if(t!=='egreso'){ if(typeof resetEditBeneficios==='function') resetEditBeneficios(); editDesgloses=[]; renderEditDesgloses(); }
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
  const eMWrap2=document.getElementById('e-method-picker-wrap');
  const eMLbl2=document.getElementById('e-method-lbl');
  if(eMWrap2) eMWrap2.style.display = sub==='beneficio' ? 'none' : '';
  if(eMLbl2) eMLbl2.style.display = sub==='beneficio' ? 'none' : '';
  if(typeof resetEditBeneficios==='function') resetEditBeneficios();
  buildEditCatBlocks(sub,'','');
}

// R9 · punto 9: pinta el botón de Método de Edición según editMethod y el
// ancho de pantalla (mismo criterio que Registro, ver _paintMethodBtn).
function _paintEditMethodBtn(){
  const btn=document.getElementById('e-method-btn');
  if(!btn) return;
  if(!editMethod){ btn.textContent='Elige'; btn.classList.remove('chosen'); return; }
  const lbl=METHOD_LABELS[editMethod];
  btn.textContent = lbl ? (_methodIsWide()?lbl.full:lbl.short) : editMethod;
  btn.classList.add('chosen');
  document.querySelectorAll('#e-method-bubble button').forEach(b=>{
    b.classList.toggle('sel', b.getAttribute('data-method')===editMethod);
  });
}
function toggleEditMethodBubble(){
  const bub=document.getElementById('e-method-bubble');
  if(bub) bub.classList.toggle('open');
}
function chooseEditMethod(el){
  setEditMethod(el.getAttribute('data-method'));
  const bub=document.getElementById('e-method-bubble');
  if(bub) bub.classList.remove('open');
}
function setEditMethod(m){
  editMethod=m;
  _paintEditMethodBtn();
}
// Cerrar la burbuja al tocar fuera (mismo patrón que Registro)
document.addEventListener('click',(e)=>{
  const wrap=document.getElementById('e-method-picker-wrap');
  const bub=document.getElementById('e-method-bubble');
  if(!bub || !bub.classList.contains('open')) return;
  if(wrap && wrap.contains(e.target)) return;
  bub.classList.remove('open');
}, true);
window.addEventListener('resize', ()=>{ try{ _paintEditMethodBtn(); }catch(e){} });

function toggleEBen(){
  const abrir = !_eBenVisible;
  _closeOtherEditTopTabs('ben');
  _eBenVisible = abrir;
  const panel=document.getElementById('e-ben-panel');
  if(panel){
    panel.style.display = abrir ? 'block' : 'none';
    if(abrir){
      revealAnimate(panel);
      // Igual que Desglose: si no hay ningún bloque aún, agregar uno para agilizar
      if(editBeneficios.length===0) addEditBeneficio();
      else renderEditBeneficios(false);
    }
  }
  refreshEditTopTabs();
}

function onECurChange(){
  // Capa estética (11_selectores.js): el botón de Moneda sigue al <select>.
  // Va al principio porque más abajo esta función retorna temprano con MXN.
  try{ const _c=document.getElementById('e-currency'); if(_c){ _fselBuild(_c); _fselPaint(_c); } }catch(e){}
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

// R7.2: setBenType/getBenAmount desaparecieron — el beneficio del registro vive
// ahora en bloques múltiples (ver 02_registro y 03_desgloses).

let propinaSelMethod = null;
let propinaIncluida = true; // R8: default = incluida en monto (antes: adicional)

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
  const calcRow=document.getElementById('propina-calc-row');
  if(pctBtn){ pctBtn.style.background=t==='pct'?'var(--accent)':'transparent'; pctBtn.style.color=t==='pct'?'white':'var(--text3)'; }
  if(montoBtn){ montoBtn.style.background=t==='monto'?'var(--accent)':'transparent'; montoBtn.style.color=t==='monto'?'white':'var(--text3)'; }
  if(pctInput) pctInput.style.display=t==='pct'?'':'none';
  if(montoInput) montoInput.style.display=t==='monto'?'':'none';
  // R7.2: el cálculo vive debajo del renglón y SOLO en modo %; en $ desaparece
  // y en su lugar aparecen las opciones del método de pago de la propina.
  if(calcRow) calcRow.style.display=t==='pct'?'':'none';
  // R8.1: display '' para que el CSS decida (flex en línea en web; renglón propio en móvil)
  if(methodWrap) methodWrap.style.display=t==='monto'?'':'none';
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
  // R8: defaults de propina = Porcentaje + Incluida
  setPropinaType('pct');
  setPropinaIncluida(true);
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
  try{ return editType==='egreso' && editBeneficiosDetalle().total>0; }catch(e){ return false; }
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
  // R8: el ocultamiento MUTUO de los tabs Propina/Diferir depende de que el otro
  // panel esté ABIERTO, no de que tenga datos. Así, con todo colapsado (tema 8),
  // ambos botones se ven con su indicador "con datos" en vez de esconderse.
  // (La exclusión Diferir↔Recordar y Diferir↔Desglose por DATOS vive en
  // editUpdateDesgloseForDiferir y renderEditReminderSection, más abajo.)
  const propinaAbierta = _ePropinaVisible;
  const diferirAbierto = (typeof _eDiferirVisible!=='undefined' && _eDiferirVisible);
  const remAbierto = (typeof _eRemPanelVisible!=='undefined' && _eRemPanelVisible);
  if(pbn) pbn.style.display = diferirAbierto ? 'none' : '';
  if(dbn) dbn.style.display = (propinaAbierta || (remAbierto && !diferirAbierto)) ? 'none' : '';
  updateInlineBtn('e-inline-propina-btn', _ePropinaVisible, ePropinaHasData() && !_ePropinaVisible);
  updateInlineBtn('e-inline-ben-btn', _eBenVisible, eBenHasData() && !_eBenVisible);
  updateInlineBtn('e-inline-diferir-btn', (typeof _eDiferirVisible!=='undefined' && _eDiferirVisible), editDiferirHasData() && !(typeof _eDiferirVisible!=='undefined' && _eDiferirVisible));
  try{ editUpdateDesgloseForDiferir(); }catch(e){}
  // Diferir → Recordar: recalcula si 🔔 debe estar visible (antes solo miraba si
  // el registro YA era diferido, no si acababas de activar el diferido aquí).
  try{ renderEditReminderSection(); }catch(e){}
}

// R7.2 · ✕ del módulo Propina en edición: borra la info, colapsa y desactiva el botón
function clearEditPropinaModule(){
  editPropinaOn=false;
  editPropinaType='monto';
  editPropinaIncluida=false;
  editPropinaMethod=null;
  const pctEl=document.getElementById('e-propina-pct');
  const montoEl=document.getElementById('e-propina-monto');
  if(pctEl) pctEl.value='';
  if(montoEl) montoEl.value='';
  document.querySelectorAll('#e-propina-method-chips .chip').forEach(c=>c.classList.remove('active'));
  setEditPropinaType('pct');
  setEditPropinaIncluida(false);
  _ePropinaVisible=false;
  const panel=document.getElementById('e-propina-panel');
  if(panel) panel.style.display='none';
  updateInlineBtn('e-inline-propina-btn', false, false);
  refreshEditTopTabs();
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
  const calcRow=document.getElementById('e-propina-calc-row');
  if(pctBtn){ pctBtn.style.background=t==='pct'?'var(--accent)':'transparent'; pctBtn.style.color=t==='pct'?'white':'var(--text3)'; }
  if(montoBtn){ montoBtn.style.background=t==='monto'?'var(--accent)':'transparent'; montoBtn.style.color=t==='monto'?'white':'var(--text3)'; }
  if(pctInput) pctInput.style.display=t==='pct'?'':'none';
  if(montoInput) montoInput.style.display=t==='monto'?'':'none';
  // R7.2: el cálculo vive debajo del renglón y SOLO en modo %; en $ desaparece
  // y en su lugar aparecen las opciones del método de pago de la propina.
  if(calcRow) calcRow.style.display=t==='pct'?'':'none';
  // R8.1: display '' para que el CSS decida (flex en línea en web; renglón propio en móvil)
  if(methodWrap) methodWrap.style.display=t==='monto'?'':'none';
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
  // cambios de formato de nota entre versiones). R7.2: la subcategoría es
  // 'Propina'; se acepta 'Propinas' por si un registro legacy llegara sin migrar.
  const prop = data.find(x=>
    x.linkedTo===parentId &&
    (x.subcategory==='Propina' || x.subcategory==='Propinas') &&
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
    // Estado desde metaOf: cubre el formato nuevo (meta.tip) Y las notas legacy
    // que la capa de lectura ya sabe interpretar.
    const _tip=metaOf(prop).tip||{};
    editPropinaIncluida = !!_tip.inc;
    if(_tip.pct!=null && isFinite(_tip.pct)){
      editPropinaType='pct';
      if(pctEl) pctEl.value=String(_tip.pct);
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


// R7.2: el selector "¿en qué mensualidad se te acreditó?" desapareció junto con
// Cashback-como-beneficio (todo beneficio descuenta el total antes de prorratear).


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
  try{ calcEditPropinaPreview(); refreshEditBeneficioCalcs(); updateEditDesgloseRemaining(); renderEditDiferirPreview(); }catch(e){}
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
