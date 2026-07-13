// ══════════════════════════════════════
// DESGLOSES (registro)
// Cada desglose resta de un gasto madre y se guarda como egreso vinculado.
// ══════════════════════════════════════
let desgloses = []; // {id, amount, category, subcategory, note}

function addDesglose(){
  desgloses.push({ id: genId(), amount: 0, category: '', subcategory: '', note: '', desc:'' });
  renderDesgloses(true); // animar la nueva card
}

function removeDesglose(id){
  const list=document.getElementById('desglose-list');
  const card=list?list.querySelector(`[data-desg-id="${id}"]`):null;
  const isOnlyOne = desgloses.length<=1;
  const applyRemoval=()=>{
    desgloses = desgloses.filter(d=>d.id!==id);
    if(isOnlyOne){
      // Era el único desglose: colapsar la sección de desglose por completo
      _desgloseVisible=false;
      const sec=document.getElementById('desglose-section');
      if(sec) sec.style.display='none';
      const addBtn=document.getElementById('add-desglose-btn');
      if(addBtn){ addBtn.dataset.exceedHidden=''; addBtn.style.opacity=''; }
      updateNoteDesgloseIndicators();
      updateDesgloseRemaining();
    } else {
      renderDesgloses(false);
    }
  };
  animateDesgloseRemoval(card, isOnlyOne, applyRemoval);
}

// Fade out de la tarjeta eliminada; si quedan otras, se recorren hacia arriba
// reapareciendo en cascada (mismo estilo que el historial).
function animateDesgloseRemoval(card, isOnlyOne, applyRemoval){
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!card || reduced){ applyRemoval(); return; }
  // Elementos hermanos posteriores (para recorrer hacia arriba)
  const following = [];
  let sib = card.nextElementSibling;
  while(sib){ following.push(sib); sib = sib.nextElementSibling; }
  // 1) Fade out de la tarjeta eliminada
  try{
    card.animate([
      {opacity:1, transform:'translateY(0)'},
      {opacity:0, transform:'translateY(-6px)'}
    ],{duration:300,easing:'cubic-bezier(0.55,0,0.67,0.2)',fill:'forwards'});
  }catch(e){}
  // 2) Los siguientes se desvanecen para reaparecer recorridos
  following.forEach(el=>{ try{ el.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-out',fill:'forwards'}); }catch(e){} });
  // 3) Aplicar cambio real y re-cascada tras el fade
  setTimeout(()=>{
    applyRemoval();
    if(!isOnlyOne){
      // Re-cascada de las tarjetas restantes (de arriba hacia abajo)
      const list=document.getElementById('desglose-list');
      if(list){
        Array.from(list.children).forEach((el,i)=>{
          try{
            el.animate([
              {opacity:0,transform:'translateY(-12px)'},
              {opacity:1,transform:'translateY(0)'}
            ],{duration:400,delay:i*55,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'backwards'});
          }catch(e){}
        });
      }
    }
  }, 320);
}

function updateDesglose(id, field, value){
  const d = desgloses.find(x=>x.id===id);
  if(!d) return;
  if(field==='amount') d.amount = parseFloat(value)||0;
  else d[field] = value;
  if(field==='amount'){ updateDesgloseRemaining(); updateNoteDesgloseIndicators(); }

  // Nombre propio → predecir su categoría/subcategoría (misma regla del formulario),
  // solo si aún no se ha elegido categoría a mano en este desglose.
  if(field==='desc'){
    try{
      if(!d.category && typeof predictCatForDesc==='function'){
        const p=predictCatForDesc(value, curType);
        if(p){
          d.category=p.category;
          const subs=sortedSubcats(curType, p.category);
          const hasSubs=subs && !(subs.length===1 && subs[0]==='—');
          d.subcategory=(hasSubs && p.subcategory && subs.includes(p.subcategory)) ? p.subcategory : '';
          d._catPred=true;
          renderDesgloses(false);
        }
      } else if(d._catPred && String(value||'').trim().length<3){
        // Se borró el nombre propio: deshacer SOLO lo que puso la predicción
        d.category=''; d.subcategory=''; d._catPred=false;
        renderDesgloses(false);
      }
    }catch(e){}
  }
}

// Selección de categoría de un desglose — revela la subcategoría progresivamente
function setDesgloseCat(id, cat){
  const d=desgloses.find(x=>x.id===id);
  if(!d) return;
  d._catPred=false;   // elección manual: la predicción ya no la deshace
  d.category=cat; d.subcategory='';
  refreshAllDesgloseSubcatDropdowns();
  revealDesgloseFields(id);
  updateAddDesgloseBtnVisibility();
  updateDesgloseRemaining();
}
function setDesgloseSubcat(id, sub){
  const d=desgloses.find(x=>x.id===id);
  if(!d) return;
  d.subcategory=sub;
  refreshAllDesgloseSubcatDropdowns();
  revealDesgloseFields(id);
  updateAddDesgloseBtnVisibility();
  updateDesgloseRemaining();
}

// Revela progresivamente subcategoría y nota dentro de una tarjeta de desglose,
// con animación suave, sin reconstruir toda la tarjeta.
function revealDesgloseFields(id){
  const d=desgloses.find(x=>x.id===id);
  const card=document.querySelector(`#desglose-list [data-desg-id="${id}"]`);
  if(!d || !card) return;
  const subs=d.category?sortedSubcats(curType,d.category):[];
  const hasSubs=subs && !(subs.length===1&&subs[0]==='—');
  const isComplete = !!d.category && (!hasSubs || !!d.subcategory);
  // Nota: aparece cuando el desglose está completo
  let noteEl=card.querySelector('[data-desg-note]');
  if(isComplete && !noteEl){
    noteEl=document.createElement('input');
    noteEl.setAttribute('data-desg-note','');
    noteEl.type='text';
    noteEl.placeholder='Nota (opcional)';
    noteEl.value=d.note||'';
    noteEl.setAttribute('oninput',`updateDesglose(${d.id},'note',this.value)`);
    noteEl.style.cssText='width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:13px;outline:none;';
    card.appendChild(noteEl);
    revealAnimate(noteEl);
  } else if(!isComplete && noteEl){
    noteEl.remove();
  }
}

// Actualiza quirúrgicamente el dropdown de subcategoría de cada tarjeta de desglose,
// reflejando las subcategorías tomadas (madre + otros desgloses), sin reconstruir todo.
function refreshAllDesgloseSubcatDropdowns(){
  const list=document.getElementById('desglose-list');
  if(!list) return;
  desgloses.forEach(d=>{
    const card=list.querySelector(`[data-desg-id="${d.id}"]`);
    if(!card) return;
    const subInfo=buildDesgloseSubcatOptions(desgloses, d, curCat, curSubcat, curType);
    const selects=card.querySelectorAll('select');
    let subSelect=null;
    selects.forEach(s=>{ if((s.getAttribute('onchange')||'').includes('setDesgloseSubcat')) subSelect=s; });
    if(subInfo.hasSubs){
      if(subSelect){
        subSelect.innerHTML=subInfo.html;
        subSelect.value=d.subcategory||'';
      } else {
        // No existía dropdown (la categoría no tenía subcats antes) → insertarlo
        const newSel=document.createElement('select');
        newSel.setAttribute('onchange', `setDesgloseSubcat(${d.id},this.value)`);
        newSel.style.cssText='width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;margin-bottom:8px;';
        newSel.innerHTML=subInfo.html;
        const rows=card.querySelectorAll(':scope > div');
        const anchor=rows.length>=2?rows[1]:null;
        if(anchor && anchor.nextSibling) card.insertBefore(newSel, anchor.nextSibling);
        else card.appendChild(newSel);
        newSel.value=d.subcategory||'';
        revealAnimate(newSel);
      }
    } else if(subSelect){
      subSelect.remove();
    }
  });
}

// Inserta o reemplaza el dropdown de subcategoría dentro de una tarjeta de desglose,
// sin reconstruir toda la tarjeta (evita el re-flash de animación).
// Suma de desgloses en la moneda del gasto
function desglosesTotal(){
  return desgloses.reduce((s,d)=>s+(d.amount||0),0);
}

// Construye las opciones del dropdown de subcategoría de un desglose.
// Las subcategorías ya "tomadas" (por el gasto madre o por OTROS desgloses de la
// misma categoría) se atenúan, se deshabilitan y se recorren al final de la lista,
// en el orden en que fueron tomándose.
function buildDesgloseSubcatOptions(desgloseArr, d, parentCat, parentSubcat, typ){
  const subs = d.category ? sortedSubcats(typ, d.category) : [];
  const hasSubs = subs && !(subs.length===1 && subs[0]==='—');
  if(!hasSubs) return { hasSubs:false, html:'' };

  // Regla de "no repetir subcategorías" ELIMINADA a petición: un pago de Izzi
  // puede desglosar Netflix y Vix ambas como Ocio/Suscripciones. Todas las
  // subcategorías quedan siempre activas.
  const active = subs;
  const disabled = [];

  const optHtml = [];
  optHtml.push(`<option value="">Subcategoría...</option>`);
  active.forEach(s=>{
    optHtml.push(`<option value="${s}" ${d.subcategory===s?'selected':''}>${s}</option>`);
  });
  disabled.forEach(s=>{
    optHtml.push(`<option value="${s}" disabled style="color:var(--text3);opacity:0.5;">${s}</option>`);
  });
  return { hasSubs:true, html:optHtml.join('') };
}

function renderDesgloses(animateNew){
  const list=document.getElementById('desglose-list');
  if(!list) return;
  const cur=document.getElementById('currency')?.value||'MXN';
  const curLabel = cur==='MXN' ? '' : ` (${cur})`;
  // IDs que ya estaban renderizados antes (para animar solo los nuevos)
  const prevIds = new Set(Array.from(list.children).map(c=>c.dataset.desgId));
  list.innerHTML='';
  desgloses.forEach((d,idx)=>{
    const card=document.createElement('div');
    card.dataset.desgId=String(d.id);
    card.style.cssText='background:var(--surface2);border-radius:var(--radius-sm);padding:11px;margin-bottom:8px;position:relative;';
    // Categorías del tipo actual para el dropdown
    const catOpts=sortedCats(curType).map(c=>`<option value="${c}" ${d.category===c?'selected':''}>${c}</option>`).join('');
    const subInfo=buildDesgloseSubcatOptions(desgloses, d, curCat, curSubcat, curType);
    const hasSubs=subInfo.hasSubs;
    const subOpts=subInfo.html;
    // Revelación progresiva:
    // - Subcategoría: aparece cuando hay categoría elegida
    // - Nota: aparece cuando el desglose está "completo" (categoría + subcat si aplica)
    const showSubcat = !!d.category && hasSubs;
    const isComplete = !!d.category && (!hasSubs || !!d.subcategory);
    const showNote = isComplete;
    card.innerHTML=`
      <button type="button" onclick="removeDesglose(${d.id})" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;line-height:1;padding:2px;">✕</button>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Desglose ${idx+1}${curLabel}</div>
      <!-- Nombre propio: vacío = hereda la descripción madre; con texto = ese será su nombre en el historial -->
      <input data-desg-owndesc type="text" placeholder="Nombre propio (opcional)" value="${(d.desc||'').replace(/"/g,'&quot;')}" oninput="updateDesglose(${d.id},'desc',this.value)" style="width:100%;margin-bottom:8px;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <input type="text" inputmode="decimal" placeholder="Monto${curLabel}" value="${d.amount?formatAmountString(String(d.amount)):''}" oninput="handleAmountInput(this);updateDesglose(${d.id},'amount',rawAmount(this.value))" style="width:110px;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
        <select onchange="setDesgloseCat(${d.id},this.value)" style="flex:1;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
          <option value="">Categoría...</option>${catOpts}
        </select>
      </div>
      ${showSubcat?`<select data-desg-subcat onchange="setDesgloseSubcat(${d.id},this.value)" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;margin-bottom:8px;">${subOpts}</select>`:''}
      ${showNote?`<input data-desg-note type="text" placeholder="Nota (opcional)" value="${d.note||''}" oninput="updateDesglose(${d.id},'note',this.value)" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:13px;outline:none;">`:''}
    `;
    list.appendChild(card);
    // Animar solo si se pidió y esta card es nueva (no estaba antes)
    if(animateNew && !prevIds.has(String(d.id))){
      revealAnimate(card);
    }
  });
  // El botón "Agregar desglose" solo aparece si el ÚLTIMO desglose está completo
  updateAddDesgloseBtnVisibility();
  updateDesgloseRemaining();
}

// Muestra el botón "Agregar desglose" solo si el último desglose está completo.
// No interfiere si está oculto por exceso/monto exacto (flag exceedHidden).
function updateAddDesgloseBtnVisibility(){
  const btn=document.getElementById('add-desglose-btn');
  if(!btn) return;
  // Si está oculto por exceso o monto exacto, respetarlo (lo maneja setAddDesgloseHidden)
  if(btn.dataset.exceedHidden==='1'){ btn.style.display='none'; return; }
  const complete = lastDesgloseComplete();
  btn.style.display = complete ? 'flex' : 'none';
  btn.style.opacity=''; // asegurar visible sin opacidad residual
}

// Muestra cuánto queda del monto original tras restar desgloses
function updateDesgloseRemaining(){
  const remEl=document.getElementById('desglose-remaining');
  if(!remEl) return;
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  const total=desglosesTotal();
  const remaining=+(amount-total).toFixed(2); // evitar ruido de punto flotante
  if(desgloses.length===0){
    remEl.style.display='none';
    setSubmitDisabled(false);
    setAddDesgloseHidden(false);
    return;
  }
  remEl.style.display='block';
  const cur=document.getElementById('currency')?.value||'MXN';
  const sym=cur==='MXN'?'$':`${cur} `;
  // Regla: el gasto principal (remanente) debe seguir siendo el mayor.
  // Ningún desglose individual puede superar el remanente (se permite empate).
  const maxDesglose = desgloses.reduce((mx,d)=>Math.max(mx, d.amount||0), 0);
  const fmtMoney = v => `${sym}${v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if(remaining < maxDesglose){
    // Se viola la regla: algún desglose es mayor que lo que queda como principal.
    // (Esto también cubre el caso de exceso total, donde remaining es negativo.)
    remEl.style.color='var(--danger)';
    remEl.textContent=`Ningún desglose puede superar el gasto principal (${fmtMoney(Math.max(remaining,0))})`;
    setSubmitDisabled(true);
    setAddDesgloseHidden(true);
  } else {
    remEl.style.color='var(--text3)';
    // Gramática: "Quedan" si es > $1; "Queda" si es exactamente $1 o $0.
    const verbo = remaining>1 ? 'Quedan' : 'Queda';
    remEl.textContent=`${verbo} ${fmtMoney(remaining)}`;
    setSubmitDisabled(false);
    // Ocultar "Agregar desglose" si ya no cabría otro sin romper la regla:
    // agregar un desglose adicional reduciría el remanente por debajo del mayor
    // desglose actual. Si el remanente ya es <= al mayor desglose (o es 0), se oculta.
    setAddDesgloseHidden(remaining<=maxDesglose || remaining===0);
  }
}

// Oculta/muestra el botón "Agregar desglose" con fade.
// Robusto ante cambios rápidos: cancela animaciones previas y no depende de onfinish
// asíncrono para fijar el estado final.
function setAddDesgloseHidden(hidden){
  const btn=document.getElementById('add-desglose-btn');
  if(!btn) return;
  const currentlyHidden = btn.dataset.exceedHidden==='1';
  if(hidden){
    if(currentlyHidden) return;         // ya está oculto, nada que hacer
    btn.dataset.exceedHidden='1';
    // Cancelar cualquier animación pendiente
    try{ btn.getAnimations().forEach(a=>a.cancel()); }catch(e){}
    try{
      const anim=btn.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-out',fill:'forwards'});
      anim.onfinish=()=>{
        // Solo ocultar si SEGUIMOS en estado oculto (no cambió durante el fade)
        if(btn.dataset.exceedHidden==='1'){ btn.style.display='none'; btn.style.opacity=''; }
      };
    }catch(e){ btn.style.display='none'; }
  } else {
    if(!currentlyHidden) return;        // ya está visible/normal, nada que hacer
    btn.dataset.exceedHidden='';
    // Cancelar animación de fade-out pendiente
    try{ btn.getAnimations().forEach(a=>a.cancel()); }catch(e){}
    // Decidir si debe mostrarse (último desglose completo)
    const shouldShow = lastDesgloseComplete();
    if(shouldShow){
      btn.style.display='flex';
      btn.style.opacity='';
      try{ btn.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease-out'}); }catch(e){}
    } else {
      btn.style.display='none';
      btn.style.opacity='';
    }
  }
}

// ¿El último desglose está completo (categoría + subcategoría si aplica)?
function lastDesgloseComplete(){
  if(desgloses.length===0) return false;
  const last=desgloses[desgloses.length-1];
  const subs=last.category?sortedSubcats(curType,last.category):[];
  const hasSubs=subs && !(subs.length===1&&subs[0]==='—');
  return !!last.category && (!hasSubs || !!last.subcategory);
}

// Activa/desactiva el botón de guardar (registro) por validación de desgloses
function setSubmitDisabled(disabled){
  const btn=document.getElementById('submit-btn');
  if(!btn) return;
  btn.disabled=disabled;
  btn.style.opacity=disabled?'0.45':'';
  btn.style.pointerEvents=disabled?'none':'';
}

// Muestra/oculta la sección de desglose (aplica a egreso, ingreso y beneficio)
function updateDesgloseVisibility(){
  // La sección de desglose ahora se controla con el botón toggle "Desglose".
  // Esta función se mantiene por compatibilidad, sin forzar visibilidad.
}

// ══════════════════════════════════════
// DESGLOSES (edición)
// ══════════════════════════════════════
let editDesgloses = []; // {id, amount, category, subcategory, note, existingId?}

function addEditDesglose(){
  editDesgloses.push({ id: genId(), amount: 0, category: '', subcategory: '', note: '', desc:'' });
  renderEditDesgloses();
}
function removeEditDesglose(id){
  const list=document.getElementById('e-desglose-list');
  const card=list?list.querySelector(`[data-desg-id="${id}"]`):null;
  const isOnlyOne = editDesgloses.length<=1;
  const applyRemoval=()=>{
    editDesgloses = editDesgloses.filter(d=>d.id!==id);
    if(isOnlyOne){
      // Era el único desglose: colapsar la sección por completo
      _eDesgloseVisible=false;
      const sec=document.getElementById('e-desglose-section');
      if(sec) sec.style.display='none';
      const addBtn=document.getElementById('e-add-desglose-btn');
      if(addBtn){ addBtn.dataset.exceedHidden=''; addBtn.style.opacity=''; }
      updateEditNoteDesgloseIndicators();
      updateEditDesgloseRemaining();
    } else {
      renderEditDesgloses();
    }
  };
  animateEditDesgloseRemoval(card, isOnlyOne, applyRemoval);
}

function animateEditDesgloseRemoval(card, isOnlyOne, applyRemoval){
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!card || reduced){ applyRemoval(); return; }
  const following = [];
  let sib = card.nextElementSibling;
  while(sib){ following.push(sib); sib = sib.nextElementSibling; }
  try{
    card.animate([
      {opacity:1, transform:'translateY(0)'},
      {opacity:0, transform:'translateY(-6px)'}
    ],{duration:300,easing:'cubic-bezier(0.55,0,0.67,0.2)',fill:'forwards'});
  }catch(e){}
  following.forEach(el=>{ try{ el.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-out',fill:'forwards'}); }catch(e){} });
  setTimeout(()=>{
    applyRemoval();
    if(!isOnlyOne){
      const list=document.getElementById('e-desglose-list');
      if(list){
        Array.from(list.children).forEach((el,i)=>{
          try{
            el.animate([
              {opacity:0,transform:'translateY(-12px)'},
              {opacity:1,transform:'translateY(0)'}
            ],{duration:400,delay:i*55,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'backwards'});
          }catch(e){}
        });
      }
    }
  }, 320);
}
function updateEditDesglose(id, field, value){
  const d = editDesgloses.find(x=>x.id===id);
  if(!d) return;
  if(field==='amount') d.amount = parseFloat(value)||0;
  else d[field] = value;
  if(field==='amount'){ updateEditDesgloseRemaining(); updateEditNoteDesgloseIndicators(); }

  // Nombre propio → predecir su categoría/subcategoría (misma regla del formulario),
  // solo si aún no se ha elegido categoría a mano en este desglose.
  if(field==='desc'){
    try{
      if(!d.category && typeof predictCatForDesc==='function'){
        const p=predictCatForDesc(value, editType);
        if(p){
          d.category=p.category;
          const subs=sortedSubcats(editType, p.category);
          const hasSubs=subs && !(subs.length===1 && subs[0]==='—');
          d.subcategory=(hasSubs && p.subcategory && subs.includes(p.subcategory)) ? p.subcategory : '';
          d._catPred=true;
          renderEditDesgloses();
        }
      } else if(d._catPred && String(value||'').trim().length<3){
        // Se borró el nombre propio: deshacer SOLO lo que puso la predicción
        d.category=''; d.subcategory=''; d._catPred=false;
        renderEditDesgloses();
      }
    }catch(e){}
  }
}
function setEditDesgloseCat(id, cat){
  const d=editDesgloses.find(x=>x.id===id);
  if(!d) return;
  d._catPred=false;   // elección manual: la predicción ya no la deshace
  d.category=cat; d.subcategory='';
  refreshAllEditDesgloseSubcatDropdowns();
  revealEditDesgloseFields(id);
  updateEditAddDesgloseBtnVisibility();
  updateEditDesgloseRemaining();
}
function setEditDesgloseSubcat(id, sub){
  const d=editDesgloses.find(x=>x.id===id);
  if(!d) return;
  d.subcategory=sub;
  refreshAllEditDesgloseSubcatDropdowns();
  revealEditDesgloseFields(id);
  updateEditAddDesgloseBtnVisibility();
  updateEditDesgloseRemaining();
}

function revealEditDesgloseFields(id){
  const d=editDesgloses.find(x=>x.id===id);
  const card=document.querySelector(`#e-desglose-list [data-desg-id="${id}"]`);
  if(!d || !card) return;
  const subs=d.category?sortedSubcats(editType,d.category):[];
  const hasSubs=subs && !(subs.length===1&&subs[0]==='—');
  const isComplete = !!d.category && (!hasSubs || !!d.subcategory);
  let noteEl=card.querySelector('[data-desg-note]');
  if(isComplete && !noteEl){
    noteEl=document.createElement('input');
    noteEl.setAttribute('data-desg-note','');
    noteEl.type='text';
    noteEl.placeholder='Nota (opcional)';
    noteEl.value=d.note||'';
    noteEl.setAttribute('oninput',`updateEditDesglose(${d.id},'note',this.value)`);
    noteEl.style.cssText='width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:13px;outline:none;';
    card.appendChild(noteEl);
    revealAnimate(noteEl);
  } else if(!isComplete && noteEl){
    noteEl.remove();
  }
}

// Actualiza los dropdowns de subcategoría de todas las tarjetas de edición
function refreshAllEditDesgloseSubcatDropdowns(){
  const list=document.getElementById('e-desglose-list');
  if(!list) return;
  editDesgloses.forEach(d=>{
    const card=list.querySelector(`[data-desg-id="${d.id}"]`);
    if(!card) return;
    const subInfo=buildDesgloseSubcatOptions(editDesgloses, d, editCat, editSubcat, editType);
    const selects=card.querySelectorAll('select');
    let subSelect=null;
    selects.forEach(s=>{ if((s.getAttribute('onchange')||'').includes('setEditDesgloseSubcat')) subSelect=s; });
    if(subInfo.hasSubs){
      if(subSelect){
        subSelect.innerHTML=subInfo.html;
        subSelect.value=d.subcategory||'';
      } else {
        const newSel=document.createElement('select');
        newSel.setAttribute('onchange', `setEditDesgloseSubcat(${d.id},this.value)`);
        newSel.style.cssText='width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;margin-bottom:8px;';
        newSel.innerHTML=subInfo.html;
        const rows=card.querySelectorAll(':scope > div');
        const anchor=rows.length>=2?rows[1]:null;
        if(anchor && anchor.nextSibling) card.insertBefore(newSel, anchor.nextSibling);
        else card.appendChild(newSel);
        newSel.value=d.subcategory||'';
        revealAnimate(newSel);
      }
    } else if(subSelect){
      subSelect.remove();
    }
  });
}

function editDesglosesTotal(){
  return editDesgloses.reduce((s,d)=>s+(d.amount||0),0);
}
function renderEditDesgloses(){
  const list=document.getElementById('e-desglose-list');
  if(!list) return;
  list.innerHTML='';
  editDesgloses.forEach((d,idx)=>{
    const card=document.createElement('div');
    card.dataset.desgId=String(d.id);
    card.style.cssText='background:var(--surface2);border-radius:var(--radius-sm);padding:11px;margin-bottom:8px;position:relative;';
    const catOpts=sortedCats(editType).map(c=>`<option value="${c}" ${d.category===c?'selected':''}>${c}</option>`).join('');
    const subInfo=buildDesgloseSubcatOptions(editDesgloses, d, editCat, editSubcat, editType);
    const hasSubs=subInfo.hasSubs;
    const subOpts=subInfo.html;
    const showSubcat = !!d.category && hasSubs;
    const isComplete = !!d.category && (!hasSubs || !!d.subcategory);
    card.innerHTML=`
      <button type="button" onclick="removeEditDesglose(${d.id})" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;line-height:1;padding:2px;">✕</button>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Desglose ${idx+1}</div>
      <!-- Nombre propio: vacío = hereda la descripción madre; con texto = ese será su nombre en el historial -->
      <input data-desg-owndesc type="text" placeholder="Nombre propio (opcional)" value="${(d.desc||'').replace(/"/g,'&quot;')}" oninput="updateEditDesglose(${d.id},'desc',this.value)" style="width:100%;margin-bottom:8px;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <input type="text" inputmode="decimal" placeholder="Monto" value="${d.amount?formatAmountString(String(d.amount)):''}" oninput="handleAmountInput(this);updateEditDesglose(${d.id},'amount',rawAmount(this.value))" style="width:110px;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
        <select onchange="setEditDesgloseCat(${d.id},this.value)" style="flex:1;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
          <option value="">Categoría...</option>${catOpts}
        </select>
      </div>
      ${showSubcat?`<select onchange="setEditDesgloseSubcat(${d.id},this.value)" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;margin-bottom:8px;">${subOpts}</select>`:''}
      ${isComplete?`<input data-desg-note type="text" placeholder="Nota (opcional)" value="${d.note||''}" oninput="updateEditDesglose(${d.id},'note',this.value)" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:13px;outline:none;">`:''}
    `;
    list.appendChild(card);
  });
  updateEditAddDesgloseBtnVisibility();
  updateEditDesgloseRemaining();
}

function updateEditAddDesgloseBtnVisibility(){
  const btn=document.getElementById('e-add-desglose-btn');
  if(!btn) return;
  if(btn.dataset.exceedHidden==='1'){ btn.style.display='none'; return; }
  const complete = lastEditDesgloseComplete();
  btn.style.display = complete ? 'flex' : 'none';
  btn.style.opacity='';
}
function lastEditDesgloseComplete(){
  if(editDesgloses.length===0) return false;
  const last=editDesgloses[editDesgloses.length-1];
  const subs=last.category?sortedSubcats(editType,last.category):[];
  const hasSubs=subs && !(subs.length===1&&subs[0]==='—');
  return !!last.category && (!hasSubs || !!last.subcategory);
}
function updateEditDesgloseRemaining(){
  const remEl=document.getElementById('e-desglose-remaining');
  if(!remEl) return;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  const total=editDesglosesTotal();
  const remaining=+(amount-total).toFixed(2);
  if(editDesgloses.length===0){ remEl.style.display='none'; setEditSubmitDisabled(false); setEditAddDesgloseHidden(false); return; }
  remEl.style.display='block';
  const cur=document.getElementById('e-currency')?.value||'MXN';
  const sym=cur==='MXN'?'$':`${cur} `;
  const maxDesglose = editDesgloses.reduce((mx,d)=>Math.max(mx, d.amount||0), 0);
  const fmtMoney = v => `${sym}${v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if(remaining < maxDesglose){
    remEl.style.color='var(--danger)';
    remEl.textContent=`Ningún desglose puede superar el gasto principal (${fmtMoney(Math.max(remaining,0))})`;
    setEditSubmitDisabled(true);
    setEditAddDesgloseHidden(true);
  } else {
    remEl.style.color='var(--text3)';
    const verbo = remaining>1 ? 'Quedan' : 'Queda';
    remEl.textContent=`${verbo} ${fmtMoney(remaining)}`;
    setEditSubmitDisabled(false);
    setEditAddDesgloseHidden(remaining<=maxDesglose || remaining===0);
  }
}
function setEditAddDesgloseHidden(hidden){
  const btn=document.getElementById('e-add-desglose-btn');
  if(!btn) return;
  const currentlyHidden = btn.dataset.exceedHidden==='1';
  if(hidden){
    if(currentlyHidden) return;
    btn.dataset.exceedHidden='1';
    try{ btn.getAnimations().forEach(a=>a.cancel()); }catch(e){}
    try{
      const anim=btn.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-out',fill:'forwards'});
      anim.onfinish=()=>{ if(btn.dataset.exceedHidden==='1'){ btn.style.display='none'; btn.style.opacity=''; } };
    }catch(e){ btn.style.display='none'; }
  } else {
    if(!currentlyHidden) return;
    btn.dataset.exceedHidden='';
    try{ btn.getAnimations().forEach(a=>a.cancel()); }catch(e){}
    const shouldShow = lastEditDesgloseComplete();
    if(shouldShow){
      btn.style.display='flex';
      btn.style.opacity='';
      try{ btn.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease-out'}); }catch(e){}
    } else {
      btn.style.display='none';
      btn.style.opacity='';
    }
  }
}
function setEditSubmitDisabled(disabled){
  const btn=document.getElementById('e-submit-btn');
  if(!btn) return;
  btn.disabled=disabled;
  btn.style.opacity=disabled?'0.45':'';
  btn.style.pointerEvents=disabled?'none':'';
}
function updateEditDesgloseVisibility(){
  // El desglose solo aplica a egresos. En ingreso/beneficio se oculta el botón
  // Desglose y la Nota ocupa todo el ancho.
  const desgBtn=document.getElementById('e-desglose-toggle-btn');
  const noteBtn=document.getElementById('e-note-toggle-btn');
  if(desgBtn && noteBtn){
    if(editType==='egreso' && !editDeferGroup){
      desgBtn.style.display='';
      noteBtn.style.flex='';
    } else {
      desgBtn.style.display='none';
      noteBtn.style.flex='1 1 100%';
    }
  }
  // Al abrir edición: si hay desgloses cargados, activar el toggle; si no, ocultar.
  const sec=document.getElementById('e-desglose-section');
  if(!sec) return;
  const hasDesg = editType==='egreso' && editDesgloses.length>0;
  _eDesgloseVisible = hasDesg;
  sec.style.display = hasDesg ? 'block' : 'none';
  updateEditNoteDesgloseIndicators();
  updateEditNoteMode();
}


// Renderiza los tipos de beneficio con el mismo comportamiento colapsable y
// animaciones que las categorías: todos visibles → al elegir uno, colapsa a ese solo.
function buildBenTypeBlocks(containerId, selected, onSelect) {
  const container = document.getElementById(containerId);
  if(!container) return;
  // Guardar callback y selección en el contenedor para re-renderizar en toggles
  container._benOnSelect = onSelect;
  container._benSelected = selected || '';
  renderBenTypeUI(containerId);
}

function renderBenTypeUI(containerId){
  const container = document.getElementById(containerId);
  if(!container) return;
  const selected = container._benSelected || '';
  const onSelect = container._benOnSelect || (()=>{});
  container.innerHTML='';

  // Estado 1: sin selección → mostrar todos con animación escalonada
  if(!selected){
    container.className='cat-grid-ui';
    container.style.gridTemplateColumns='';
    BEN_TYPES.forEach(t=>{
      const b=makeBenButton(t, containerId);
      container.appendChild(b);
    });
    revealGridByColumns(container, 2);
    return;
  }

  // Estado 2: seleccionado → colapsar a ese solo, ocupando 100% ancho (no tiene subcats)
  container.className='cat-grid-ui';
  container.style.gridTemplateColumns='1fr';
  const b=makeBenButton(selected, containerId);
  b.classList.add('sel-pa');
  const color='#af52de';
  b.style.borderColor=color;
  container.appendChild(b);
  revealAnimate(container, true);
}

function makeBenButton(name, containerId){
  const b=document.createElement('button');
  b.type='button';
  b.className='cat-block';
  b.innerHTML=`<span>${ICONS[name]||'💰'}</span><br>${name}`;
  b.onclick=(ev)=>{ ev.stopPropagation(); selectBenType(name, containerId); };
  return b;
}

function selectBenType(name, containerId){
  const container=document.getElementById(containerId);
  if(!container) return;
  const wasAllShowing = !container._benSelected;
  if(container._benSelected===name){
    // Tocar el ya elegido → re-expandir (mostrar todos de nuevo).
    // NO desactiva el beneficio: solo limpia la selección de tipo para re-elegir.
    container._benSelected='';
    if(container._benOnSelect) container._benOnSelect('');
    renderBenTypeUI(containerId);
    return;
  }
  // Elegir uno nuevo
  if(wasAllShowing && container.children.length>1){
    // Desde la vista de todos → animar salida inversa, luego colapsar
    collapseGridReverse(container, 2, ()=>{
      container._benSelected=name;
      if(container._benOnSelect) container._benOnSelect(name);
      renderBenTypeUI(containerId);
    });
  } else {
    // Cambiar de un tipo colapsado directo a otro (sin pasar por vista de todos)
    container._benSelected=name;
    if(container._benOnSelect) container._benOnSelect(name);
    renderBenTypeUI(containerId);
  }
}


function updateBenUI(){
  const b=document.getElementById('t-box');
  if(b){ b.classList.toggle('on',benOn); b.textContent=benOn?'✓':''; }
  const extra=document.getElementById('ben-extra');
  if(extra) extra.classList.toggle('vis',benOn);
}
