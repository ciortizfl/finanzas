// ══════════════════════════════════════
// DIFERIR en EDICIÓN — paridad total con el registro
// ══════════════════════════════════════
let _eDiferirVisible=false;

function editDiferirHasData(){ return editDiferirMonths>0; }

// Al abrir edición: si el registro ya es diferido, mostrar el panel desplegado
// con los meses actuales. Si no, dejar el botón Diferir disponible como en registro.
function setupEditDiferirPanel(){
  const panel=document.getElementById('e-diferir-panel');
  if(!panel) return;
  if(editDeferGroup){
    // Es un diferido existente: cargar meses y desplegar el panel
    const grp=data.filter(x=>sameGroup(x.deferGroup,editDeferGroup));
    editDiferirMonths = grp.length>0 ? grp[0].deferTotal : 0;
    editDiferirCustom = !DIFERIR_PRESETS.includes(editDiferirMonths);
    // El diferido abre su tab; Propina y Beneficio conservan sus datos y sus botones
    _eDiferirVisible=true;
    const ci=document.getElementById('e-diferir-custom');
    if(ci) ci.value = editDiferirCustom ? editDiferirMonths : '';
    panel.style.display='block';
    renderEditDiferirPresets();
    renderEditDiferirPreview();
  } else {
    editDiferirMonths=0; editDiferirCustom=false; _eDiferirVisible=false;
    panel.style.display='none';
    const ci=document.getElementById('e-diferir-custom');
    if(ci) ci.value='';
  }
  try{ refreshEditTopTabs(); }catch(e){}
}

// Diferir como TERCER TAB del modal. Ya NO borra la propina ni el beneficio
// (antes hacía editPropinaOn=false; editBenOn=false: eso destruía el cashback
// de un diferido con solo abrir el panel).
function editInlineToggleDiferir(){
  const abrir = !_eDiferirVisible;
  try{ _closeOtherEditTopTabs('diferir'); }catch(e){}
  _eDiferirVisible = abrir;
  const panel=document.getElementById('e-diferir-panel');
  if(panel){
    panel.style.display = abrir ? 'block' : 'none';
    if(abrir){
      revealAnimate(panel);
      renderEditDiferirPresets();
      renderEditDiferirPreview();
    }
  }
  try{ refreshEditTopTabs(); }catch(e){}
}

// Delegan en el nuevo gestor de tabs (se conservan los nombres porque hay otros
// flujos que las invocan; el crossfade viejo quedó retirado).
function editHidePropinaBenButtons(){ try{ refreshEditTopTabs(); }catch(e){} }
function editShowPropinaBenButtons(){ try{ refreshEditTopTabs(); }catch(e){} }

function _editCrossfadeRetirado_hide(){
  const row=document.getElementById('e-inline-row-main');
  const full=document.getElementById('e-inline-diferir-full');
  if(!row || !full) return;
  row.getAnimations().forEach(a=>a.cancel());
  full.getAnimations().forEach(a=>a.cancel());
  row.animate([{opacity:1},{opacity:0}],{duration:220,easing:'cubic-bezier(0.4,0,0.2,1)',fill:'forwards'});
  row.style.pointerEvents='none';
  full.style.pointerEvents='auto';
  full.animate([{opacity:0,transform:'scale(0.98)'},{opacity:1,transform:'scale(1)'}],{duration:220,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'forwards'});
}
function _editCrossfadeRetirado_show(){
  const row=document.getElementById('e-inline-row-main');
  const full=document.getElementById('e-inline-diferir-full');
  if(row && full){
    row.getAnimations().forEach(a=>a.cancel());
    full.getAnimations().forEach(a=>a.cancel());
    full.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(0.98)'}],{duration:220,easing:'cubic-bezier(0.4,0,0.2,1)',fill:'forwards'});
    full.style.pointerEvents='none';
    row.style.pointerEvents='auto';
    row.animate([{opacity:0},{opacity:1}],{duration:220,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'forwards'});
  }
  editUpdateDesgloseForDiferir();
}

// HOTFIX (post-R2, fuera de alcance de persistencia): esta función es un
// residuo de cuando Diferido y Desglose se excluían mutuamente en el modal de
// edición. La regla cambió (ahora conviven, igual que en el registro) pero
// aquí seguía vaciando `editDesgloses` cada vez que el panel de diferido
// estaba activo — por eso un diferido con desglose perdía su desglose al
// editarse. El equivalente del lado del REGISTRO (updateDesgloseButtonForDiferir
// en 02_registro.js) ya no borra nada; esta versión ahora hace lo mismo:
// solo reparte el ancho del renglón, nunca toca los datos.
function editUpdateDesgloseForDiferir(){
  const desgBtn=document.getElementById('e-desglose-toggle-btn');
  const noteBtn=document.getElementById('e-note-toggle-btn');
  const remBtn=document.getElementById('e-rem-toggle-btn');
  if(!desgBtn || !noteBtn) return;
  desgBtn.style.display = (editType==='egreso') ? '' : 'none';
  const visibles=[noteBtn,desgBtn,remBtn].filter(b=>b && b.style.display!=='none');
  visibles.forEach(b=>{ b.style.flex='1 1 0'; });
  if(visibles.length===1) noteBtn.style.flex='1 1 100%';
  updateEditNoteMode();
}

function renderEditDiferirPresets(){
  const cont=document.getElementById('e-diferir-presets');
  if(!cont) return;
  cont.innerHTML='';
  DIFERIR_PRESETS.forEach(p=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='month-preset'+(!editDiferirCustom && editDiferirMonths===p?' on':'');
    b.textContent=p+'m';
    b.onclick=()=>toggleEditDiferirPreset(p);
    cont.appendChild(b);
  });
}

function toggleEditDiferirPreset(p){
  if(!editDiferirCustom && editDiferirMonths===p){
    editDiferirMonths=0; // desactivar
  } else {
    editDiferirMonths=p;
    editDiferirCustom=false;
    const ci=document.getElementById('e-diferir-custom');
    if(ci) ci.value='';
  }
  renderEditDiferirPresets();
  renderEditDiferirPreview();
  updateInlineBtn('e-inline-diferir-btn', true, editDiferirHasData());
  editUpdateDesgloseForDiferir();
}

function onEditDiferirCustomInput(){
  const v=parseInt(document.getElementById('e-diferir-custom').value);
  if(v && v>=2){
    editDiferirMonths=v;
    editDiferirCustom=!DIFERIR_PRESETS.includes(v);
  } else {
    editDiferirMonths=0;
    editDiferirCustom=false;
  }
  renderEditDiferirPresets();
  renderEditDiferirPreview();
  updateInlineBtn('e-inline-diferir-btn', true, editDiferirHasData());
  editUpdateDesgloseForDiferir();
}

// Quitar diferido: vuelve el gasto a ser único (de una vez)
function editClearDiferir(){
  editDiferirMonths=0;
  editDiferirCustom=false;
  const ci=document.getElementById('e-diferir-custom');
  if(ci) ci.value='';
  _eDiferirVisible=false;
  document.getElementById('e-diferir-panel').style.display='none';
  updateInlineBtn('e-inline-diferir-btn', false, false);
  editShowPropinaBenButtons();
}

function renderEditDiferirPreview(){
  const prev=document.getElementById('e-diferir-preview');
  const clearBtn=document.getElementById('e-diferir-clear-btn');
  if(!prev) return;
  if(!editDiferirHasData()){
    prev.style.display='none';
    if(clearBtn) clearBtn.style.display='none';
    return;
  }
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  const n=editDiferirMonths;
  const perMonth=Math.floor((amount/n)*100)/100;
  // Fecha de inicio: si ya era diferido, la del mes 1; si es nuevo, la fecha del registro
  const grp=data.filter(x=>sameGroup(x.deferGroup,editDeferGroup)).sort((a,b)=>a.deferIndex-b.deferIndex);
  const base=(editDeferGroup && grp.length>0) ? parseDate(grp[0].date) : (parseDate(document.getElementById('e-date').value)||new Date());
  const start=diferirMonthlyDate(base,0);
  const end=diferirMonthlyDate(base,n-1);
  const startLbl=`${MONTHS_ES[start.getMonth()].slice(0,3)} ${start.getFullYear()}`;
  const endLbl=`${MONTHS_ES[end.getMonth()].slice(0,3)} ${end.getFullYear()}`;
  prev.style.display='block';
  prev.innerHTML=`
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:var(--accent);margin-bottom:3px;">${fmt(perMonth)} <span style="font-size:13px;font-weight:500;color:var(--text3);">/ mes</span></div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:2px;">Durante <b>${n} meses</b> · ${startLbl} – ${endLbl}</div>
    <div style="font-size:11.5px;color:var(--text3);">Cada día ${base.getDate()} de cada mes</div>
  `;
  if(clearBtn) clearBtn.style.display='block';
}

async function saveEditDeferred({amount, desc, cur, note, subcat, date}){
  const group=data.filter(x=>sameGroup(x.deferGroup,editDeferGroup)).sort((a,b)=>a.deferIndex-b.deferIndex);
  if(group.length===0){ closeModal(); return; }
  // Nuevo número de meses (editable); si no es válido, conservar el original
  let n = (editDiferirMonths && editDiferirMonths>=2) ? editDiferirMonths : group[0].deferTotal;
  // FECHA: la del modal manda. El campo muestra la fecha de la mensualidad que
  // estás editando, así que la serie se re-ancla desde ahí: si editas el mes 1 y
  // pones el 25 de mayo, el mes 2 cae el 25 de junio, y así. Si editas el mes 3,
  // la serie entera se recorre para que ESE mes caiga en la fecha elegida.
  // (Antes se ignoraba el campo y se reusaba la fecha vieja: cambiarla no hacía nada.)
  let startDate;
  const _nuevaFecha = date ? parseDate(date) : null;
  if(_nuevaFecha && !isNaN(_nuevaFecha.getTime())){
    const _editada = group.find(x=>String(x.id)===String(editId));
    const _idx = _editada && _editada.deferIndex ? (_editada.deferIndex - 1) : 0;
    startDate = diferirMonthlyDate(_nuevaFecha, -_idx);   // retroceder hasta el mes 1
  } else {
    startDate = parseDate(group[0].date);
  }
  const method=group[0].method;
  const oldIds=group.map(x=>x.id);
  const groupId=genId();   // grupo NUEVO: los borrados del viejo no pueden tocarlo

  const _origFx=data.find(x=>String(x.id)===String(editId))||null; // TC histórico
  // TC manual en un diferido: recalcula TODAS las mensualidades y sus hijos
  if(cur!=='MXN'){
    if(_fxOverrideEdit && _fxOverrideEdit>0){
      const _auto=(typeof _editFxAuto!=='undefined' && _editFxAuto) ? _editFxAuto : fxRateForEdit(_origFx,cur);
      const _tag=(_auto>0)?`TCauto: ${_auto}`:'';
      note=[String(note||'').split(' | ').filter(p=>!p.trim().startsWith('TCauto:')).join(' | '), _tag].filter(Boolean).join(' | ');
    } else if(typeof _editFxAuto!=='undefined' && _editFxAuto){
      _fxOverrideEdit=_editFxAuto;   // revertido
      note=String(note||'').split(' | ').filter(p=>!p.trim().startsWith('TCauto:')).join(' | ');
    }
  }

  // Desgloses del diferido: se PRORRATEAN entre las N mensualidades
  const activeDesg=(typeof editDesgloses!=='undefined'?editDesgloses:[]).filter(d=>d.amount>0);
  const totalDesg=activeDesg.reduce((s,d)=>s+d.amount,0);
  const principalTotal=+(amount-totalDesg).toFixed(2);
  if(principalTotal<0){ toast('Los desgloses no pueden superar el gasto'); return; }

  // Beneficio del diferido: se acredita COMPLETO en la mensualidad elegida
  const benAmt=(editType==='egreso'&&editBenOn)?getEditBenAmount():0;
  if(benAmt>0 && !editBenType){ toast('Elige el tipo de beneficio'); return; }
  const benMonth=Math.min(Math.max(parseInt(document.getElementById('e-ben-month')?.value||'1',10)||1,1),n);

  const perMonth=Math.floor((principalTotal/n)*100)/100;
  let acc=0;
  const newEntries=[];
  const desgAcc=activeDesg.map(()=>0);
  const desgPer=activeDesg.map(d=>Math.floor((d.amount/n)*100)/100);

  for(let i=0;i<n;i++){
    let monthAmt=perMonth;
    if(i===n-1) monthAmt=+(principalTotal-acc).toFixed(2);
    acc+=perMonth;
    const d=diferirMonthlyDate(startDate,i);
    const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const madre={
      id: genId(), type:'egreso',
      amount:monthAmt, amountMXN:toMXNEdit(monthAmt,cur,_origFx), currency:cur,
      desc, category:editCat, subcategory:subcat,
      method, date:dateStr, note,
      deferGroup:groupId, deferIndex:i+1, deferTotal:n, deferOriginal:amount
    };
    newEntries.push(madre);

    activeDesg.forEach((dg,k)=>{
      let dAmt=desgPer[k];
      if(i===n-1) dAmt=+(dg.amount-desgAcc[k]).toFixed(2);
      desgAcc[k]+=desgPer[k];
      if(dAmt<=0) return;
      const dsubs=sortedSubcats(editType, dg.category);
      const dHasSubs=dsubs && !(dsubs.length===1 && dsubs[0]==='—');
      newEntries.push({
        id:genId(), type:editType,
        amount:dAmt, amountMXN:toMXNEdit(dAmt,cur,_origFx), currency:cur,
        desc:((dg.desc||'').trim()) ? dg.desc.trim() : desc,
        category:dg.category, subcategory: dHasSubs?dg.subcategory:'',
        method, date:dateStr,
        note:[`Desglose de: ${desc}`, dg.note||''].filter(Boolean).join(' | '),
        linkedTo:madre.id
      });
    });

    if(benAmt>0 && (i+1)===benMonth){
      newEntries.push({
        id:genId(), type:'ahorro-pasivo',
        amount:benAmt, amountMXN:toMXNEdit(benAmt,cur,_origFx), currency:cur,
        desc:desc, category:editBenType, subcategory:'',
        method:null, date:dateStr,
        note:`Beneficio de: ${desc} | acreditado en la mensualidad ${benMonth} de ${n}`,
        linkedTo:madre.id
      });
    }
  }
  // ⛔ BLINDAJE: si por cualquier razón no se reconstruyó nada, NO se borra nada.
  if(newEntries.length===0){ toast('No se pudo actualizar el diferido'); return; }

  // Borrar el grupo viejo COMPLETO (mensualidades + sus hijos) del estado local
  const oldGroupIds=new Set(group.map(x=>x.id));
  data=data.filter(x=>!oldGroupIds.has(x.id) && !(x.linkedTo && oldGroupIds.has(x.linkedTo)));
  newEntries.forEach(e=>data.unshift(e));
  save();
  showSyncing('⟳ Guardando...');
  // ORDEN SEGURO: primero se CREA lo nuevo y solo después se borra lo viejo.
  // (Borrar primero fue lo que permitió perder un registro completo si el
  // guardado fallaba a medio camino. Además, el borrado en Sheets arrastra en
  // cascada a los hijos vinculados, así que basta con borrar las mensualidades.)
  //
  // AJUSTE: antes esta cadena se disparaba SIN esperar (el modal se cerraba de
  // inmediato mientras el guardado/borrado seguía en curso). Si el usuario
  // navegaba a otra pantalla o la app se suspendía en ese instante, el borrado
  // de limpieza podía quedar a medias — sin aviso, porque el modal ya se había
  // cerrado. Ahora la función ESPERA a que la cadena completa termine antes de
  // cerrar el modal: mientras tanto, el usuario ve "Guardando..." y no puede
  // alejarse a media operación.
  const r = await saveBatchToSheets(newEntries);
  if(!r.ok){
    // R2: la escritura falló → NO se borra nada. Quedan las mensualidades
    // viejas en la nube (duplicado recuperable) en vez de perderlo todo.
    hideSyncing();
    toast('⚠️ No se pudo sincronizar: no se borró nada');
  } else {
    let delOk = true;
    for(const oid of oldIds){
      const dr = await deleteEntryInSheets(oid);
      if(!dr.ok) delOk = false;
    }
    hideSyncing();
    if(delOk) toast('✓ Gasto diferido actualizado');
    else toast('⚠️ Se guardó, pero quedaron mensualidades viejas sin borrar');
  }
  // El modal se cierra en AMBOS casos (igual que antes de este ajuste); lo único
  // que cambió es que ahora se cierra DESPUÉS de que la cadena termine, no antes.
  closeModalWithSlide();
  renderHistorial(); renderBalance();
}

// Convierte un gasto único (no diferido) en un grupo diferido de N mensualidades.
async function saveEditConvertToDefer({amount, desc, cur, note, subcat}){
  const orig=data.find(x=>x.id===editId);
  const method=orig?orig.method:selMethod;
  const startDate=parseDate(document.getElementById('e-date').value)||new Date();
  const n=editDiferirMonths;
  const groupId=genId();
  // Borrar el registro original y sus hijos (propina/beneficio/desglose no aplican)
  const oldChildIds=data.filter(x=>x.linkedTo===editId).map(x=>x.id);
  data=data.filter(x=>x.id!==editId && x.linkedTo!==editId);
  const perMonth=Math.floor((amount/n)*100)/100;
  let acc=0;
  const newEntries=[];
  const _origFx=data.find(x=>String(x.id)===String(editId))||null; // TC histórico
  for(let i=0;i<n;i++){
    let monthAmt=perMonth;
    if(i===n-1) monthAmt=+(amount-acc).toFixed(2);
    acc+=perMonth;
    const d=diferirMonthlyDate(startDate,i);
    const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    newEntries.push({
      id: genId(), type:'egreso',
      amount:monthAmt, amountMXN:toMXNEdit(monthAmt,cur,_origFx), currency:cur,
      desc, category:editCat, subcategory:subcat,
      method, date:dateStr, note,
      deferGroup:groupId, deferIndex:i+1, deferTotal:n, deferOriginal:amount
    });
  }
  newEntries.forEach(e=>data.unshift(e));
  save();
  showSyncing('⟳ Guardando...');
  // R2 · ORDEN SEGURO: este flujo BORRABA el registro original ANTES de guardar
  // las mensualidades nuevas — el mismo patrón que causó la pérdida de datos.
  // Ahora se crea primero, se verifica, y solo entonces se borra lo viejo.
  //
  // AJUSTE: antes esta cadena se disparaba sin esperarla (el modal se cerraba de
  // inmediato). Esto fue justo lo que le pasó a Carlos: convirtió un gasto en
  // diferido, el modal se cerró al instante, y el borrado del registro original
  // quedó pendiente en segundo plano — si en ese momento se navega a otra
  // pantalla o la app se suspende, el borrado nunca llega a completarse y el
  // registro viejo sobrevive como duplicado fantasma. Ahora se espera la cadena
  // completa antes de cerrar el modal.
  const r = await saveBatchToSheets(newEntries);
  if(!r.ok){
    hideSyncing();
    toast('⚠️ No se pudo sincronizar: no se borró nada');
  } else {
    let delOk = true;
    const dr = await deleteEntryInSheets(editId);
    if(!dr.ok) delOk = false;
    for(const cid of oldChildIds){
      const dc = await deleteEntryInSheets(cid);
      if(!dc.ok) delOk = false;
    }
    hideSyncing();
    if(delOk) toast(`✓ Gasto diferido en ${n} meses`);
    else toast('⚠️ Se guardó, pero el registro viejo no se borró');
  }
  // El modal se cierra en AMBOS casos (igual que antes); solo cambia el momento.
  closeModalWithSlide();
  renderHistorial(); renderBalance();
}

// Quita el diferido: colapsa el grupo a un solo gasto único (de una vez).
async function saveEditRemoveDefer({amount, desc, cur, note, subcat, date}){
  const group=data.filter(x=>sameGroup(x.deferGroup,editDeferGroup)).sort((a,b)=>a.deferIndex-b.deferIndex);
  if(group.length===0){ closeModal(); return; }
  // Al colapsar en gasto único también manda la fecha del modal
  let startDate = date ? parseDate(date) : null;
  if(!startDate || isNaN(startDate.getTime())) startDate = parseDate(group[0].date);
  const method=group[0].method;
  const oldIds=group.map(x=>x.id);
  const dateStr=`${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`;
  // Borrar todo el grupo
  data=data.filter(x=>!sameGroup(x.deferGroup,editDeferGroup));
  // Crear un único gasto con el monto total
  const single={
    id: genId(), type:'egreso',
    amount:amount, amountMXN:toMXNEdit(amount,cur,group[0]), currency:cur,
    desc, category:editCat, subcategory:subcat,
    method, date:dateStr, note, linkedTo:null
  };
  data.unshift(single);
  save();
  showSyncing('⟳ Guardando...');
  // R2 · ORDEN SEGURO: antes los borrados del grupo y el guardado del registro
  // nuevo salían EN PARALELO; si el guardado fallaba y los borrados triunfaban,
  // se perdía todo. Ahora: guardar → verificar → borrar, y AHORA TAMBIÉN se
  // espera a que la cadena completa termine antes de cerrar el modal.
  const r = await saveEntryToSheets(single);
  if(!r.ok){
    hideSyncing();
    toast('⚠️ No se pudo sincronizar: no se borró nada');
  } else {
    let delOk = true;
    for(const oid of oldIds){
      const dr = await deleteEntryInSheets(oid);
      if(!dr.ok) delOk = false;
    }
    hideSyncing();
    if(delOk) toast('✓ Diferido convertido en gasto único');
    else toast('⚠️ Se guardó, pero quedaron mensualidades viejas sin borrar');
  }
  closeModalWithSlide();
  renderHistorial(); renderBalance();
}

async function saveEdit(){
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value));
  const desc=document.getElementById('e-desc').value.trim();
  const cur=document.getElementById('e-currency').value;
  const date=document.getElementById('e-date').value;
  const note=document.getElementById('e-note').value.trim();

  // Validar subcategoría según si la categoría la requiere
  const eSubs=editCat?sortedSubcats(editType, editCat):[];
  const eHasSubs=eSubs && !(eSubs.length===1 && eSubs[0]==='—');
  const subcat = eHasSubs ? editSubcat : '';

  if(!amount||amount<=0) return toast('Ingresa un monto válido');
  if(!desc) return toast('Agrega una descripción');
  if(!editCat) return toast('Selecciona una categoría');
  if(eHasSubs && !subcat) return toast('Selecciona una subcategoría');
  if(!date) return toast('Selecciona una fecha');
  // Desgloses a medio llenar → no se guarda nada
  const _dErr=(typeof firstIncompleteDesglose==='function') ? firstIncompleteDesglose(editDesgloses, editType) : null;
  if(_dErr) return toast(_dErr);

  // Persistir emoji personalizado por comercio+subcategoría (si el usuario eligió uno)
  if(editEmojiOverride){
    setMerchantEmoji(desc, subcat || editCat, editEmojiOverride);
  }

  // ── GASTO DIFERIDO: manejar conversiones ──
  const wasDeferred = !!editDeferGroup;
  const nowDeferred = editType==='egreso' && editDiferirHasData();
  if(wasDeferred && nowDeferred){
    // Sigue diferido: recrear el grupo con nuevos valores/meses/FECHA
    return await saveEditDeferred({amount, desc, cur, note, subcat, date});
  } else if(wasDeferred && !nowDeferred){
    // Quitó el diferido: colapsar el grupo a un solo gasto único
    return await saveEditRemoveDefer({amount, desc, cur, note, subcat, date});
  } else if(!wasDeferred && nowDeferred){
    // Se volvió diferido: convertir el gasto único en grupo diferido
    return await saveEditConvertToDefer({amount, desc, cur, note, subcat});
  }
  // else: no diferido ni antes ni ahora → flujo normal

  // ── Validar desgloses (egreso, ingreso y beneficio) ──
  const activeEditDesgloses = editDesgloses.filter(d=>d.amount>0);
  if(activeEditDesgloses.length>0){
    for(const d of activeEditDesgloses){
      if(!d.category) return toast('Cada desglose necesita una categoría');
      const dsubs=sortedSubcats(editType, d.category);
      const dHasSubs=dsubs && !(dsubs.length===1 && dsubs[0]==='—');
      if(dHasSubs && !d.subcategory) return toast('Cada desglose necesita una subcategoría');
    }
  }

  // Beneficio
  let benAmt = 0;
  if(editType==='egreso' && editBenOn) benAmt = getEditBenAmount();
  // Si hay monto de beneficio pero no se eligió tipo, pedirlo
  if(benAmt > 0 && !editBenType) return toast('Elige el tipo de beneficio');

  // Total de desgloses
  const totalDesg = activeEditDesgloses.reduce((s,d)=>s+d.amount,0);

  // Propina: si es "incluida", se resta del monto madre (formaba parte del cobro).
  // Si es "adicional", NO reduce el monto madre (es un gasto extra aparte).
  let propinaIncludedAmt = 0;
  if(editType==='egreso' && editPropinaOn && editPropinaIncluida){
    propinaIncludedAmt = getEditPropinaAmount();
  }

  // Validar que reducciones no excedan el monto
  if(benAmt + totalDesg + propinaIncludedAmt > amount) return toast('Beneficio, desgloses y propina exceden el monto');

  let mainAmount = +(amount - benAmt - totalDesg - propinaIncludedAmt).toFixed(2);
  if(mainAmount < 0) mainAmount = 0;

  // Regla: ningún desglose individual puede superar el remanente del gasto principal
  if(activeEditDesgloses.length>0){
    const maxDesg=activeEditDesgloses.reduce((mx,d)=>Math.max(mx,d.amount),0);
    if(mainAmount < maxDesg) return toast('Ningún desglose puede superar el gasto principal');
  }
  // TC histórico del registro que se está editando (respeta el TC del pasado)
  const _origFx=data.find(x=>String(x.id)===String(editId))||null;
  // ── MODO COPIA: se guarda como registro NUEVO (padre + hijos frescos),
  //    sin tocar el original ni sus hijos ──
  const _isCopy = (typeof copyMode!=='undefined' && copyMode);
  const _parentId = _isCopy ? genId() : editId;
  const amountMXN=toMXNEdit(mainAmount,cur,_origFx);

  // Nota principal: SOLO la nota del usuario (sin "Monto original", que se
  // muestra dinámicamente en el listado). Se conserva el TC si aplica.
  let mainNote=note;
  // Etiqueta de sistema del TC: si al guardar hay TC manual, se conserva/crea el
  // "TCauto" (el automático original) para poder revertir después. Si el campo se
  // vació (revertir), la etiqueta desaparece y todo vuelve al TC automático original.
  let _fxTag='';
  if(cur!=='MXN'){
    if(_fxOverrideEdit && _fxOverrideEdit>0){
      const _auto = (typeof _editFxAuto!=='undefined' && _editFxAuto) ? _editFxAuto : fxRateForEdit(_origFx,cur);
      if(_auto>0) _fxTag=`TCauto: ${_auto}`;
    } else if(typeof _editFxAuto!=='undefined' && _editFxAuto){
      // Revertido: recalcular todo con el automático original
      _fxOverrideEdit=_editFxAuto;
      _fxTag='';
    }
  }
  const noteWithRate=[mainNote,rateNoteEdit(cur,_origFx),_fxTag].filter(Boolean).join(' | ');

  let oldChildIds=[];
  let _copyParent=null;
  if(_isCopy){
    // Padre NUEVO con todos los valores del modal (el original queda intacto)
    _copyParent={
      id:_parentId, type:editType, amount:mainAmount, amountMXN, currency:cur,
      desc, category:editCat, subcategory:subcat,
      method:editType!=='ahorro-pasivo'?editMethod:null,
      date, note:noteWithRate
    };
    data.unshift(_copyParent);
  } else {
    const idx=data.findIndex(x=>x.id===editId);
    if(idx===-1) return;

    // Capturar IDs de TODOS los hijos viejos (incluida la propina) para borrarlos de Sheets
    oldChildIds = data
      .filter(x=>x.linkedTo===editId)
      .map(x=>x.id);

    // Eliminar TODOS los hijos vinculados viejos (se recrean desde el estado del modal)
    data=data.filter(x=>x.linkedTo!==editId);

    // Actualizar el registro madre
    const newIdx=data.findIndex(x=>x.id===editId);
    data[newIdx]={
      ...data[newIdx],
      type:editType, amount:mainAmount, amountMXN, currency:cur,
      desc, category:editCat, subcategory:subcat,
      method:editType!=='ahorro-pasivo'?editMethod:null,
      date, note:noteWithRate
    };
  }

  const newChildren=[];

  // Recrear propina (desde el estado del modal)
  if(editType==='egreso' && editPropinaOn){
    const propinaAmt=getEditPropinaAmount();
    if(propinaAmt>0){
      const propinaAmtMXN=toMXNEdit(propinaAmt,cur,_origFx);
      const sym=cur==='MXN'?'$':`${cur} `;
      const propinaNoteparts=[`Propina de: ${desc}`];
      if(editPropinaType==='pct'){
        const pct=parseFloat(document.getElementById('e-propina-pct').value)||0;
        const label=editPropinaIncluida?`incluida en ${sym}${amount.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`:`adicional a ${sym}${amount.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
        propinaNoteparts.push(`${pct}% ${label}`);
      } else {
        propinaNoteparts.push(editPropinaIncluida?'incluida':'adicional');
      }
      const propinaEntry={
        id:genId(), type:'egreso',
        amount:propinaAmt, amountMXN:propinaAmtMXN, currency:cur,
        desc:desc, category:'Generosidad', subcategory:'Propinas',
        method:editPropinaMethod||editMethod, date,
        note:propinaNoteparts.join(' | '), linkedTo:_parentId
      };
      data.unshift(propinaEntry);
      newChildren.push(propinaEntry);
    }
  }

  // Recrear beneficio
  if(editType==='egreso'&&editBenOn&&benAmt>0){
    const bt=editBenType;
    const baMXN=toMXNEdit(benAmt,cur,_origFx);
    let benNote=`Beneficio de: ${desc}`;
    if(editBenType_mode==='pct'){
      const pct=parseFloat(document.getElementById('e-ben-pct').value)||0;
      const sym=cur==='MXN'?'$':`${cur} `;
      benNote += ` | ${pct}% de ${sym}${amount.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    }
    const benEntry={
      id:genId(), type:'ahorro-pasivo',
      amount:benAmt, amountMXN:baMXN, currency:cur,
      desc:desc, category:bt, subcategory:'',
      method:null, date,
      note:benNote, linkedTo:_parentId
    };
    data.unshift(benEntry);
    newChildren.push(benEntry);
  }

  // Recrear desgloses (heredan tipo, moneda, fecha y método del padre)
  if(activeEditDesgloses.length>0){
    activeEditDesgloses.forEach(d=>{
      const dMXN=toMXNEdit(d.amount, cur, _origFx);
      const dsubs=sortedSubcats(editType, d.category);
      const dHasSubs=dsubs && !(dsubs.length===1 && dsubs[0]==='—');
      // El desglose solo lleva "Desglose de: X" (sin monto original)
      let dNote=`Desglose de: ${desc}`;
      if(d.note) dNote=`${d.note} | ${dNote}`;
      const dEntry={
        id: genId(), type:editType,
        amount:d.amount, amountMXN:dMXN, currency:cur,
        desc:((d.desc||'').trim()) ? d.desc.trim() : desc,
        category:d.category, subcategory: dHasSubs?d.subcategory:'',
        method:editType!=='ahorro-pasivo'?editMethod:null, date,
        note:dNote, linkedTo:_parentId
      };
      data.unshift(dEntry);
      newChildren.push(dEntry);
    });
  }

  // Recordatorio programado desde el modal (paridad con el formulario):
  // solo si se cumplieron ambas condiciones (frecuencia + vigencia).
  try{
    if(typeof eRemHasData==='function' && eRemHasData()){
      createManualReminderFromEditModal(desc, editType, date);
      try{ updateReminderCard(); }catch(_e){}
    }
  }catch(_e){}

  save();
  showSyncing(_isCopy ? '⟳ Guardando copia...' : '⟳ Actualizando...');
  // ORDEN SEGURO: crear/actualizar primero, borrar los hijos viejos al final.
  // AJUSTE: antes esta cadena se disparaba sin esperarla, y el modal se cerraba
  // de inmediato — el mismo patrón que causó el registro fantasma con el
  // diferido convertido. Ahora se espera a que termine antes de cerrar.
  let rPadre;
  if(_isCopy){
    rPadre = await saveEntryToSheets({..._copyParent, benType:'', benAmount:0, benDesc:''});
  } else {
    const updatedEntry = data.find(x=>x.id===editId);
    rPadre = await updateEntryInSheets({...updatedEntry, benType:'', benAmount:0, benDesc:''});
  }
  const rHijos = await Promise.all(newChildren.map(c=>saveEntryToSheets({...c, benType:'', benAmount:0, benDesc:''})));
  // R2: si la escritura no se confirmó, NO se borran los hijos viejos.
  if(!rPadre.ok || !_allOk(rHijos)){
    hideSyncing();
    toast(_isCopy ? '⚠️ Copia guardada en el teléfono, pero no se sincronizó'
                  : '⚠️ No se pudo sincronizar: no se borró nada');
  } else {
    let delOk = true;
    if(!_isCopy){
      for(const oid of oldChildIds){
        const dr = await deleteEntryInSheets(oid);
        if(!dr.ok) delOk = false;
      }
    }
    hideSyncing();
    if(delOk) toast(_isCopy ? '✓ Copia guardada' : '✓ Registro actualizado');
    else toast('⚠️ Se guardó, pero quedaron desgloses viejos sin borrar');
  }

  const _finalId = _parentId;
  if(_isCopy){ try{ resetCopyModeUI(); }catch(_e){} }
  closeModalWithSlide();
  renderHistorial(); renderBalance();
  if(_isCopy){
    // Aparición en la lista (inverso del borrado), tras el cierre del modal
    setTimeout(()=>{ try{ playAppearAnimation(_finalId); }catch(_e){} }, 380);
  } else {
    // Resaltar el registro actualizado en el listado (pulso + destello de color)
    highlightUpdatedRecord(_finalId);
  }
}

// Cierra el modal deslizándolo hacia abajo
function closeModalWithSlide(){
  const modal=document.getElementById('edit-modal');
  const sheet=document.getElementById('modal-sheet');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(sheet && !reduced){
    let anim;
    try{
      anim=sheet.animate([
        {transform:'translateY(0)',opacity:1},
        {transform:'translateY(100%)',opacity:0.5}
      ],{duration:520,easing:'cubic-bezier(0.4,0,0.6,1)'}); // más lento, sale por abajo
    }catch(e){}
    setTimeout(()=>{
      // Cancelar animación y limpiar CUALQUIER estilo residual antes de cerrar
      if(anim) try{ anim.cancel(); }catch(e){}
      sheet.style.transform='';
      sheet.style.opacity='';
      closeModal();
    }, 500);
  } else {
    closeModal();
  }
}

// Pulso (crece hacia afuera) + destello de color en el registro actualizado
function highlightUpdatedRecord(id){
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return;
  // Esperar a que la ventana termine de bajar (~500ms) + 1/3 de segundo (333ms)
  setTimeout(()=>{
    const rows=document.querySelectorAll('#hist-list .tx-item');
    let targetEl=null;
    rows.forEach(el=>{ if(el._entryId===id || el._parentId===id) targetEl=el; });
    if(!targetEl) return;
    const e=data.find(x=>x.id===id);
    // Color sólido del tipo para el destello (visible en claro y oscuro)
    const flash = e ? (e.type==='ingreso'?'52,199,89' : e.type==='ahorro-pasivo'?'175,82,222' : e.type==='egreso'?'255,59,48' : '0,113,227') : '0,113,227';
    const prevZ=targetEl.style.zIndex, prevPos=targetEl.style.position;
    targetEl.style.position='relative';
    targetEl.style.zIndex='5';
    try{
      targetEl.animate([
        { transform:'scale(1)',   boxShadow:`0 0 0 0 rgba(${flash},0)` },
        { transform:'scale(1.045)', boxShadow:`0 0 0 3px rgba(${flash},0.6), 0 6px 22px rgba(${flash},0.28)`, offset:0.42 },
        { transform:'scale(1)',   boxShadow:`0 0 0 0 rgba(${flash},0)` }
      ],{ duration:950, easing:'cubic-bezier(0.34,1.4,0.64,1)' });
    }catch(err){}
    setTimeout(()=>{ targetEl.style.zIndex=prevZ; targetEl.style.position=prevPos; }, 1000);
  }, 833);
}

function deleteEntry(){
  if(!editId) return;
  // Gasto diferido: alerta especial y borrado de todo el grupo
  if(editDeferGroup){
    const grp=data.filter(x=>sameGroup(x.deferGroup,editDeferGroup));
    const anyE=grp[0];
    if(!confirm(`Este es un gasto diferido (mes ${anyE?anyE.deferIndex:'?'} de ${anyE?anyE.deferTotal:'?'}).\n\nBorrarlo eliminará las ${grp.length} mensualidades ligadas, incluyendo las anteriores y futuras. ¿Continuar?`)) return;
    const groupId=editDeferGroup;
    const groupIds=grp.map(x=>x.id);
    closeModalWithSlide();
    setTimeout(()=>{
      data=data.filter(x=>!sameGroup(x.deferGroup,groupId));
      save();
      showSyncing('⟳ Eliminando...');
      Promise.all(groupIds.map(gid=>deleteEntryInSheets(gid))).then(results=>{
        hideSyncing();
        // R2: el borrado local ya ocurrió y está protegido; se dice la verdad
        // sobre si la nube lo recibió o no.
        if(_allOk(results)) toast('Gasto diferido eliminado');
        else toastSyncFailed('Eliminado');
      });
      renderHistorial(); renderBalance();
    }, 520);
    return;
  }
  if(!confirm('¿Eliminar este registro?')) return;
  const _delId=editId;
  closeModalWithSlide();
  // Tras cerrar el modal, calcular índice y animar la eliminación en el listado
  setTimeout(()=>{
    const list=document.getElementById('hist-list');
    let cascadeFrom=0;
    if(list){
      const allItems=Array.from(list.querySelectorAll('.day-group-hdr, .tx-item'));
      let targetEl=null;
      allItems.forEach(el=>{ if(el._entryId===_delId) targetEl=el; });
      if(targetEl){
        cascadeFrom=allItems.indexOf(targetEl);
        const listWrap=targetEl.closest('.tx-list');
        const siblings=listWrap?listWrap.querySelectorAll('.tx-item').length:1;
        if(siblings<=1 && listWrap){
          const hdr=listWrap.previousElementSibling;
          if(hdr && hdr.classList.contains('day-group-hdr')){ const hi=allItems.indexOf(hdr); if(hi>=0) cascadeFrom=hi; }
        }
      }
    }
    playDeleteAnimation(_delId, ()=>{
      data=data.filter(x=>x.id!==_delId&&x.linkedTo!==_delId);
      save();
      showSyncing('⟳ Eliminando...');
      deleteEntryInSheets(_delId).then(r=>{
        hideSyncing();
        if(r && r.ok) toast('Registro eliminado');
        else toastSyncFailed('Eliminado');
      });
      renderHistorial({cascadeFromIndex:cascadeFrom}); renderBalance();
    });
  }, 520); // esperar a que el modal termine de bajar
}
