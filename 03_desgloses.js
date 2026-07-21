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
  // R7 · si quitas a mano el desglose que puso la predicción, se respeta:
  // no se vuelve a inyectar mientras sigas capturando este registro.
  if(typeof _desglosePredictedId!=='undefined' && _desglosePredictedId===id){
    _desglosePredictedId=null;
    _desgloseDismissed=true;
  }
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
      updateDesgloseChipLabel();
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
  // OJO: el 'else' debe colgar del if del MONTO. Antes colgaba del if de la nota,
  // y por eso una nota escrita a mano nunca se guardaba en el estado (y el monto
  // se sobrescribía con el texto crudo en vez del número).
  if(field==='amount'){
    d.amount = parseFloat(value)||0;
    d._amtPred=false;
  } else {
    if(field==='note') d._notePred=false;   // nota a mano: la predicción ya no la toca
    d[field] = value;
  }
  if(field==='amount'){ updateDesgloseRemaining(); updateNoteDesgloseIndicators(); }

  // Nombre propio → predecir su categoría/subcategoría (misma regla del formulario).
  // IMPORTANTE: se actualiza de forma QUIRÚRGICA (sin re-dibujar la lista), porque
  // reconstruir las tarjetas destruiría el input donde el usuario está escribiendo
  // y le robaría el foco a media palabra.
  if(field==='desc'){
    try{
      const card=document.querySelector(`#desglose-list [data-desg-id="${d.id}"]`);
      const catSel=card?Array.from(card.querySelectorAll('select')).find(s=>(s.getAttribute('onchange')||'').includes('setDesgloseCat')):null;
      if((!d.category || d._catPred) && typeof predictCatForDesc==='function'){
        const p=predictCatForDesc(value, curType);
        if(p && (p.category!==d.category || (p.subcategory||'')!==(d.subcategory||''))){
          d.category=p.category;
          const subs=sortedSubcats(curType, p.category);
          const hasSubs=subs && !(subs.length===1 && subs[0]==='—');
          d.subcategory=(hasSubs && p.subcategory && subs.includes(p.subcategory)) ? p.subcategory : '';
          d._catPred=true;
          if(catSel) catSel.value=d.category;
          refreshAllDesgloseSubcatDropdowns();
          revealDesgloseFields(d.id);
          // La predicción no llamaba a esto: el botón "+ Agregar desglose" se
          // quedaba oculto aunque categoría+subcategoría ya quedaran completas
          // (solo aparecía si además tocabas el selector a mano).
          updateAddDesgloseBtnVisibility();
          updateNoteDesgloseIndicators();
        }
      }
      // Monto: misma regla de predicción (solo si el campo está vacío o lo puso ella)
      const amtInp=card?card.querySelector('input[data-desg-amount]'):null;
      const curSel=document.getElementById('currency')?.value||'MXN';
      if(typeof predictAmountForDesc==='function'){
        const vacio=!amtInp || String(amtInp.value||'').trim()==='';
        if(vacio || d._amtPred){
          const pa=predictAmountForDesc(value, curType, curSel);
          if(pa!==null && pa!==d.amount){
            d.amount=pa; d._amtPred=true;
            if(amtInp) amtInp.value=(typeof formatAmountString==='function')?formatAmountString(String(pa)):String(pa);
            updateDesgloseRemaining(); updateNoteDesgloseIndicators();
          } else if(pa===null && d._amtPred){
            d.amount=0; d._amtPred=false;
            if(amtInp) amtInp.value='';
            updateDesgloseRemaining(); updateNoteDesgloseIndicators();
          }
        }
      }
      // Nota del desglose: se autocompleta si ese nombre suele llevar la misma
      // (nunca pisa lo que tú escribiste)
      if(typeof predictNoteForDesc==='function'){
        const nEl=card?card.querySelector('[data-desg-note]'):null;
        const yaEscrita = (d.note||'').trim()!=='' && !d._notePred;
        if(!yaEscrita){
          const pn=predictNoteForDesc(value, curType);
          if(pn && pn!==d.note){
            d.note=pn; d._notePred=true;
            if(nEl) nEl.value=pn;
            updateNoteDesgloseIndicators();
          } else if(!pn && d._notePred){
            d.note=''; d._notePred=false;
            if(nEl) nEl.value='';
            updateNoteDesgloseIndicators();
          }
        }
      }
      if(d._catPred && String(value||'').trim().length<3){
        // Se borró el nombre propio: deshacer SOLO lo que puso la predicción
        d.category=''; d.subcategory=''; d._catPred=false;
        if(d._amtPred){ d.amount=0; d._amtPred=false; const _ai=card?card.querySelector('input[data-desg-amount]'):null; if(_ai) _ai.value=''; }
        if(d._notePred){ d.note=''; d._notePred=false; const _ni=card?card.querySelector('[data-desg-note]'):null; if(_ni) _ni.value=''; }
        if(catSel) catSel.value='';
        refreshAllDesgloseSubcatDropdowns();
        revealDesgloseFields(d.id);
        updateAddDesgloseBtnVisibility();
        updateNoteDesgloseIndicators();
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
        // R7.2: vive en la MITAD DERECHA del renglón de Categoría.
        const newSel=document.createElement('select');
        newSel.setAttribute('data-desg-subcat','');
        newSel.classList.add('desg-subcat','fsel');
        newSel.setAttribute('onchange', `setDesgloseSubcat(${d.id},this.value)`);
        newSel.style.cssText='min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;';
        newSel.innerHTML=subInfo.html;
        const catRow=card.querySelector('[data-desg-catrow]');
        if(catRow) catRow.appendChild(newSel);
        else card.appendChild(newSel);
        newSel.value=d.subcategory||'';
        // La capa estética envuelve el <select> recién insertado; la animación
        // de aparición pasa al envoltorio (el <select> va oculto).
        try{ _fselSyncAll(catRow||card); }catch(e){}
        revealAnimate(newSel.closest('.fsel-wrap')||newSel);
      }
    } else if(subSelect){
      subSelect.remove();
    }
    // Repintar botones/burbujas con las opciones y el valor actuales.
    try{ _fselSyncAll(card); }catch(e){}
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

// R7.2 · Etiqueta del botón Desglose: con un desglose dice "Desglose"; con dos
// o más muestra el número real ("7 desgloses"). Aplica en registro y edición.
function updateDesgloseChipLabel(){
  const btn=document.getElementById('desglose-toggle-btn');
  if(!btn) return;
  const lbl=btn.querySelectorAll('span')[1];
  if(!lbl) return;
  const n=desgloses.length;
  lbl.textContent = n>=2 ? `${n} desgloses` : 'Desglose';
}
function updateEditDesgloseChipLabel(){
  const btn=document.getElementById('e-desglose-toggle-btn');
  if(!btn) return;
  const lbl=btn.querySelectorAll('span')[1];
  if(!lbl) return;
  const n=editDesgloses.length;
  lbl.textContent = n>=2 ? `${n} desgloses` : 'Desglose';
}

// ══ R8.1 (RETIRADO) · fitDesgCatSelects ══════════════════════════════════
// Medía con canvas el texto de la opción elegida para fijarle el ancho al
// <select> de Categoría, porque un <select> nativo se dimensiona por su opción
// MÁS LARGA, no por la elegida. Con el botón de la capa estética
// (11_selectores.js) eso ya no hace falta: un botón sí mide su valor actual.
// La separación entre Categoría y Subcategoría la da ahora el CSS
// (.desg-catrow .fsel-wrap[data-fsel="desg-cat"] + gap del renglón).

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
      <!-- R8.1 · Renglón 1: Monto (25% en móvil, 20% en web) + Nombre propio (resto).
           Nombre propio: vacío = hereda la descripción madre; con texto = ese será su nombre en el historial -->
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <input data-desg-amount class="desg-amt" type="text" inputmode="decimal" placeholder="$" value="${d.amount?formatAmountString(String(d.amount)):''}" oninput="handleAmountInput(this);updateDesglose(${d.id},'amount',rawAmount(this.value))" style="padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
        <input data-desg-owndesc class="desg-owndesc" type="text" placeholder="Nombre propio (opcional)" value="${(d.desc||'').replace(/"/g,'&quot;')}" oninput="updateDesglose(${d.id},'desc',this.value)" style="padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
      </div>
      <!-- R8.1 · Renglón 2: Categoría + Subcategoría. En escritorio ambos 50%; en
           móvil Categoría se ajusta al ancho de SU opción elegida (el botón de
           11_selectores.js) y Subcategoría absorbe todo el resto. -->
      <div data-desg-catrow class="desg-catrow" style="display:flex;gap:10px;margin-bottom:8px;">
        <select class="desg-cat fsel" onchange="setDesgloseCat(${d.id},this.value)" style="min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
          <option value="">Categoría...</option>${catOpts}
        </select>
        ${showSubcat?`<select data-desg-subcat class="desg-subcat fsel" onchange="setDesgloseSubcat(${d.id},this.value)" style="min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">${subOpts}</select>`:''}
      </div>
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
  updateDesgloseChipLabel();
  try{ _fselSyncAll(list); }catch(e){}
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

// ── GUARDAR: desactivación combinada ──
// Dos módulos pueden invalidar el registro a la vez (beneficios excedidos y/o
// desgloses excedidos). Cada uno prende su bandera y el botón se desactiva si
// CUALQUIERA está prendida — así corregir uno no re-habilita por error al otro.
let _benExceed=false;
let _desgExceed=false;
// R9 · El botón Guardar se bloquea si CUALQUIER panel abierto quedó a medio
// llenar: no solo "excede el monto" (ya cubierto por _benExceed/_desgExceed)
// sino también "empezaste un bloque pero no lo completaste" — antes esto NO
// se checaba para beneficios/desglose fuera del submit, y Recordar no se
// checaba en absoluto (podías guardar con el panel de Recordar a medias).
function refreshSubmitDisabled(){
  const benIncomplete = (typeof firstIncompleteBeneficio==='function') && !!firstIncompleteBeneficio(beneficios);
  const desgIncomplete = (typeof firstIncompleteDesglose==='function') && !!firstIncompleteDesglose(desgloses, curType);
  const remIncomplete = (typeof remIsIncomplete==='function') && remIsIncomplete();
  setSubmitDisabled(_benExceed || _desgExceed || benIncomplete || desgIncomplete || remIncomplete);
}

// Muestra cuánto queda del monto original tras restar desgloses.
// R7.2: los beneficios tienen PRIORIDAD sobre los desgloses — el disponible
// para desglosar es el monto MENOS los beneficios. Si un beneficio deja a un
// desglose sin espacio, aquí se recalcula, se alerta y se desactiva Guardar.
function updateDesgloseRemaining(){
  const remEl=document.getElementById('desglose-remaining');
  if(!remEl) return;
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  const benTotal=(typeof beneficiosTotal==='function') ? beneficiosTotal() : 0;
  const disponible=+(amount-benTotal).toFixed(2);
  const total=desglosesTotal();
  const remaining=+(disponible-total).toFixed(2); // evitar ruido de punto flotante
  if(desgloses.length===0){
    remEl.style.display='none';
    _desgExceed=false; refreshSubmitDisabled();
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
    _desgExceed=true; refreshSubmitDisabled();
    setAddDesgloseHidden(true);
  } else {
    remEl.style.color='var(--text3)';
    // Gramática: "Quedan" si es > $1; "Queda" si es exactamente $1 o $0.
    const verbo = remaining>1 ? 'Quedan' : 'Queda';
    remEl.textContent=`${verbo} ${fmtMoney(remaining)}`;
    _desgExceed=false; refreshSubmitDisabled();
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
      updateEditDesgloseChipLabel();
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
  // OJO: el 'else' debe colgar del if del MONTO. Antes colgaba del if de la nota,
  // y por eso una nota escrita a mano nunca se guardaba en el estado (y el monto
  // se sobrescribía con el texto crudo en vez del número).
  if(field==='amount'){
    d.amount = parseFloat(value)||0;
    d._amtPred=false;
  } else {
    if(field==='note') d._notePred=false;   // nota a mano: la predicción ya no la toca
    d[field] = value;
  }
  if(field==='amount'){ updateEditDesgloseRemaining(); updateEditNoteDesgloseIndicators(); }

  // Nombre propio → predecir su categoría/subcategoría (misma regla del formulario).
  // IMPORTANTE: se actualiza de forma QUIRÚRGICA (sin re-dibujar la lista), porque
  // reconstruir las tarjetas destruiría el input donde el usuario está escribiendo
  // y le robaría el foco a media palabra.
  if(field==='desc'){
    try{
      const card=document.querySelector(`#e-desglose-list [data-desg-id="${d.id}"]`);
      const catSel=card?Array.from(card.querySelectorAll('select')).find(s=>(s.getAttribute('onchange')||'').includes('setEditDesgloseCat')):null;
      if((!d.category || d._catPred) && typeof predictCatForDesc==='function'){
        const p=predictCatForDesc(value, editType);
        if(p && (p.category!==d.category || (p.subcategory||'')!==(d.subcategory||''))){
          d.category=p.category;
          const subs=sortedSubcats(editType, p.category);
          const hasSubs=subs && !(subs.length===1 && subs[0]==='—');
          d.subcategory=(hasSubs && p.subcategory && subs.includes(p.subcategory)) ? p.subcategory : '';
          d._catPred=true;
          if(catSel) catSel.value=d.category;
          refreshAllEditDesgloseSubcatDropdowns();
          revealEditDesgloseFields(d.id);
          updateEditAddDesgloseBtnVisibility();
          updateEditNoteDesgloseIndicators();
        }
      }
      // Monto: misma regla de predicción (solo si el campo está vacío o lo puso ella)
      const eAmtInp=card?card.querySelector('input[data-desg-amount]'):null;
      const eCurSel=document.getElementById('e-currency')?.value||'MXN';
      if(typeof predictAmountForDesc==='function'){
        const vacio=!eAmtInp || String(eAmtInp.value||'').trim()==='';
        if(vacio || d._amtPred){
          const pa=predictAmountForDesc(value, editType, eCurSel);
          if(pa!==null && pa!==d.amount){
            d.amount=pa; d._amtPred=true;
            if(eAmtInp) eAmtInp.value=(typeof formatAmountString==='function')?formatAmountString(String(pa)):String(pa);
            updateEditDesgloseRemaining(); updateEditNoteDesgloseIndicators();
          } else if(pa===null && d._amtPred){
            d.amount=0; d._amtPred=false;
            if(eAmtInp) eAmtInp.value='';
            updateEditDesgloseRemaining(); updateEditNoteDesgloseIndicators();
          }
        }
      }
      // Nota del desglose (mismas reglas que en el registro)
      if(typeof predictNoteForDesc==='function'){
        const nEl=card?card.querySelector('[data-desg-note]'):null;
        const yaEscrita = (d.note||'').trim()!=='' && !d._notePred;
        if(!yaEscrita){
          const pn=predictNoteForDesc(value, editType);
          if(pn && pn!==d.note){
            d.note=pn; d._notePred=true;
            if(nEl) nEl.value=pn;
            updateEditNoteDesgloseIndicators();
          } else if(!pn && d._notePred){
            d.note=''; d._notePred=false;
            if(nEl) nEl.value='';
            updateEditNoteDesgloseIndicators();
          }
        }
      }
      if(d._catPred && String(value||'').trim().length<3){
        // Se borró el nombre propio: deshacer SOLO lo que puso la predicción
        d.category=''; d.subcategory=''; d._catPred=false;
        if(d._amtPred){ d.amount=0; d._amtPred=false; const _ai=card?card.querySelector('input[data-desg-amount]'):null; if(_ai) _ai.value=''; }
        if(d._notePred){ d.note=''; d._notePred=false; const _ni=card?card.querySelector('[data-desg-note]'):null; if(_ni) _ni.value=''; }
        if(catSel) catSel.value='';
        refreshAllEditDesgloseSubcatDropdowns();
        revealEditDesgloseFields(d.id);
        updateEditAddDesgloseBtnVisibility();
        updateEditNoteDesgloseIndicators();
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
        // R7.2: el dropdown nuevo vive en la MITAD DERECHA del renglón de Categoría.
        const newSel=document.createElement('select');
        newSel.setAttribute('data-desg-subcat','');
        newSel.classList.add('desg-subcat','fsel');
        newSel.setAttribute('onchange', `setEditDesgloseSubcat(${d.id},this.value)`);
        newSel.style.cssText='min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;';
        newSel.innerHTML=subInfo.html;
        const catRow=card.querySelector('[data-desg-catrow]');
        if(catRow) catRow.appendChild(newSel);
        else card.appendChild(newSel);
        newSel.value=d.subcategory||'';
        // La capa estética envuelve el <select> recién insertado; la animación
        // de aparición pasa al envoltorio (el <select> va oculto).
        try{ _fselSyncAll(catRow||card); }catch(e){}
        revealAnimate(newSel.closest('.fsel-wrap')||newSel);
      }
    } else if(subSelect){
      subSelect.remove();
    }
    // Repintar botones/burbujas con las opciones y el valor actuales.
    try{ _fselSyncAll(card); }catch(e){}
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
      <!-- R7.2 · Renglón 1: Monto (≈⅓) + Nombre propio (≈⅔).
           Nombre propio: vacío = hereda la descripción madre; con texto = ese será su nombre en el historial -->
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <input data-desg-amount class="desg-amt" type="text" inputmode="decimal" placeholder="$" value="${d.amount?formatAmountString(String(d.amount)):''}" oninput="handleAmountInput(this);updateEditDesglose(${d.id},'amount',rawAmount(this.value))" style="padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
        <input data-desg-owndesc class="desg-owndesc" type="text" placeholder="Nombre propio (opcional)" value="${(d.desc||'').replace(/"/g,'&quot;')}" oninput="updateEditDesglose(${d.id},'desc',this.value)" style="padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
      </div>
      <!-- R8.1 · Renglón 2: Categoría a la medida de su selección (móvil) + Subcategoría con el resto -->
      <div data-desg-catrow class="desg-catrow" style="display:flex;gap:10px;margin-bottom:8px;">
        <select class="desg-cat fsel" onchange="setEditDesgloseCat(${d.id},this.value)" style="min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
          <option value="">Categoría...</option>${catOpts}
        </select>
        ${showSubcat?`<select data-desg-subcat class="desg-subcat fsel" onchange="setEditDesgloseSubcat(${d.id},this.value)" style="min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">${subOpts}</select>`:''}
      </div>
      ${isComplete?`<input data-desg-note type="text" placeholder="Nota (opcional)" value="${d.note||''}" oninput="updateEditDesglose(${d.id},'note',this.value)" style="width:100%;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:13px;outline:none;">`:''}
    `;
    list.appendChild(card);
  });
  updateEditAddDesgloseBtnVisibility();
  updateEditDesgloseRemaining();
  updateEditDesgloseChipLabel();
  try{ _fselSyncAll(list); }catch(e){}
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
// Desactivación combinada del Guardar de EDICIÓN (beneficios y/o desgloses)
let _eBenExceed=false;
let _eDesgExceed=false;
function refreshEditSubmitDisabled(){ setEditSubmitDisabled(_eBenExceed || _eDesgExceed); }

function updateEditDesgloseRemaining(){
  const remEl=document.getElementById('e-desglose-remaining');
  if(!remEl) return;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  const benTotal=(typeof editBeneficiosTotal==='function') ? editBeneficiosTotal() : 0;
  const disponible=+(amount-benTotal).toFixed(2);
  const total=editDesglosesTotal();
  const remaining=+(disponible-total).toFixed(2);
  if(editDesgloses.length===0){ remEl.style.display='none'; _eDesgExceed=false; refreshEditSubmitDisabled(); setEditAddDesgloseHidden(false); return; }
  remEl.style.display='block';
  const cur=document.getElementById('e-currency')?.value||'MXN';
  const sym=cur==='MXN'?'$':`${cur} `;
  const maxDesglose = editDesgloses.reduce((mx,d)=>Math.max(mx, d.amount||0), 0);
  const fmtMoney = v => `${sym}${v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if(remaining < maxDesglose){
    remEl.style.color='var(--danger)';
    remEl.textContent=`Ningún desglose puede superar el gasto principal (${fmtMoney(Math.max(remaining,0))})`;
    _eDesgExceed=true; refreshEditSubmitDisabled();
    setEditAddDesgloseHidden(true);
  } else {
    remEl.style.color='var(--text3)';
    const verbo = remaining>1 ? 'Quedan' : 'Queda';
    remEl.textContent=`${verbo} ${fmtMoney(remaining)}`;
    _eDesgExceed=false; refreshEditSubmitDisabled();
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
  // R7.2: el renglón inferior (Desglose + Recordar) solo aplica a egresos;
  // en ingreso/beneficio se oculta completo. El desglose SÍ convive con
  // diferidos (se prorratea entre las mensualidades).
  const desgBtn=document.getElementById('e-desglose-toggle-btn');
  const bottomRow=document.getElementById('e-note-desglose-row');
  if(desgBtn) desgBtn.style.display = (editType==='egreso') ? '' : 'none';
  if(bottomRow) bottomRow.style.display = (editType==='egreso') ? '' : 'none';
  // Al abrir edición: si hay desgloses cargados, activar el toggle; si no, ocultar.
  const sec=document.getElementById('e-desglose-section');
  if(!sec) return;
  const hasDesg = editType==='egreso' && editDesgloses.length>0;
  _eDesgloseVisible = hasDesg;
  sec.style.display = hasDesg ? 'block' : 'none';
  updateEditNoteDesgloseIndicators();
}


// ══════════════════════════════════════
// R7.2 · BLOQUES DE BENEFICIO (registro)
// Misma mecánica que los desgloses: tarjetas independientes, X por bloque,
// "Agregar otro beneficio" cuando el último está completo, y colapso del
// módulo al eliminar el último. El tipo se elige en un dropdown.
// ══════════════════════════════════════

function addBeneficio(){
  // R8: el modo por defecto es porcentaje. Pero solo puede existir UN bloque
  // porcentual: si ya hay uno, este nace en monto (la regla de "un solo %").
  const yaHayPct = beneficios.some(b=>b.mode==='pct');
  beneficios.push({ id: genId(), mode: yaHayPct?'monto':'pct', pct:0, amount:0, category:'' });
  renderBeneficios(true);
}

function removeBeneficio(id){
  const list=document.getElementById('beneficio-list');
  const card=list?list.querySelector(`[data-ben-id="${id}"]`):null;
  const isOnlyOne = beneficios.length<=1;
  const applyRemoval=()=>{
    beneficios = beneficios.filter(b=>b.id!==id);
    if(isOnlyOne){
      // Era el último beneficio: colapsar el módulo y desactivar el botón.
      // R8: el colapso usa hideAnimate (la misma animación suave de ocultar del
      // resto de la app) en vez de un display:none abrupto.
      _benVisible=false;
      const addBtn=document.getElementById('add-beneficio-btn');
      if(addBtn){ addBtn.dataset.exceedHidden=''; addBtn.style.opacity=''; }
      hideAnimate(document.getElementById('ben-panel'));
      updateBeneficioRemaining();
      try{ refreshTopTabsVisibility(); }catch(e){}
    } else {
      renderBeneficios(false);
    }
    // Los beneficios tienen prioridad: recalcular el disponible de los desgloses
    try{ updateDesgloseRemaining(); }catch(e){}
  };
  animateDesgloseRemoval(card, isOnlyOne, applyRemoval);
}

// Opciones del dropdown de tipo de beneficio
// R8 · Orden de los tipos de beneficio — MISMA lógica que sortedSubcats():
//   1) por recurrencia de uso (mayor → menor)
//   2) los empatados, alfabético (es)
//   3) "Otros (beneficios)" SIEMPRE al final
// El uso se registra con trackUsage bajo la clave 'beneficio:<tipo>' (el mismo
// contador de categorías, ya que los tipos de beneficio SON categorías del
// tipo 'beneficio' — ver más abajo cómo se registran al guardar).
function sortedBenTypes(){
  const otros = BEN_TYPES.filter(t=>t==='Otros (beneficios)');
  const rest = BEN_TYPES.filter(t=>t!=='Otros (beneficios)');
  rest.sort((a,b)=>{
    const ua = usage[`beneficio:${a}`]||0;
    const ub = usage[`beneficio:${b}`]||0;
    if(ub!==ua) return ub-ua;
    return a.localeCompare(b,'es');
  });
  return [...rest, ...otros];
}

function benTypeOptionsHtml(selected){
  const opts=['<option value="">Tipo...</option>'];
  sortedBenTypes().forEach(t=>{ opts.push(`<option value="${t}" ${selected===t?'selected':''}>${t}</option>`); });
  return opts.join('');
}

// R8 · Chips de tipo de beneficio (solo visibles en web; en móvil se usa el
// dropdown). Un chip por tipo, en el mismo orden que el dropdown. onclick llama
// a la MISMA función setBeneficioCat/setEditBeneficioCat, así el estado y el
// resto de la lógica no cambian. `setFn` es el nombre de esa función.
function benChipsHtml(selected, benId, setFn){
  return sortedBenTypes().map(t=>{
    const active = selected===t;
    const esc = t.replace(/'/g,"\\'");
    return `<button type="button" class="ben-type-chip${active?' active':''}" onclick="${setFn}(${benId},'${esc}')">${t}</button>`;
  }).join('');
}

// ── R8.1 · El renglón inferior de un bloque solo se muestra si tiene contenido
// visible (el "= $X" del porcentaje y/o el "Quedan $Y" mudado al último bloque).
function _syncBenCalcRow(row){
  if(!row) return;
  const vis=Array.from(row.children).some(ch=>ch.style.display!=='none' && (ch.textContent||'').trim()!=='');
  row.style.display = vis ? 'flex' : 'none';
}
// Regresa "Quedan $Y" a su sitio original (tras el botón "Agregar otro
// beneficio") — necesario ANTES de que renderBeneficios limpie la lista, o el
// nodo moriría con innerHTML=''.
function _rehomeBeneficioRemaining(){
  const remEl=document.getElementById('beneficio-remaining');
  const home=document.getElementById('add-beneficio-btn');
  if(remEl && home && remEl.parentElement!==home.parentElement){
    home.parentElement.insertBefore(remEl, home.nextSibling);
    remEl.style.marginLeft=''; remEl.style.marginTop='';
  }
}
function _rehomeEditBeneficioRemaining(){
  const remEl=document.getElementById('e-beneficio-remaining');
  const home=document.getElementById('e-add-beneficio-btn');
  if(remEl && home && remEl.parentElement!==home.parentElement){
    home.parentElement.insertBefore(remEl, home.nextSibling);
    remEl.style.marginLeft=''; remEl.style.marginTop='';
  }
}

function renderBeneficios(animateNew){
  const list=document.getElementById('beneficio-list');
  if(!list) return;
  _rehomeBeneficioRemaining();   // R8.1: rescatar "Quedan" antes de limpiar
  const cur=document.getElementById('currency')?.value||'MXN';
  const curLabel = cur==='MXN' ? '' : ` (${cur})`;
  const prevIds = new Set(Array.from(list.children).map(c=>c.dataset.benId));
  list.innerHTML='';
  beneficios.forEach((b,idx)=>{
    const card=document.createElement('div');
    card.dataset.benId=String(b.id);
    card.style.cssText='background:var(--surface2);border-radius:var(--radius-sm);padding:11px;margin-bottom:8px;position:relative;';
    // Solo puede existir UN porcentual: si otro bloque ya lo es, este solo permite $
    const pctBloqueado = benPctTaken(beneficios, b.id);
    const esPct = b.mode==='pct';
    const inputVal = esPct
      ? (b.pct ? String(b.pct) : '')
      : (b.amount ? formatAmountString(String(b.amount)) : '');
    const inputAttrs = esPct
      ? `placeholder="%" oninput="updateBeneficio(${b.id},'pct',this.value)"`
      : `placeholder="$" oninput="handleAmountInput(this);updateBeneficio(${b.id},'amount',rawAmount(this.value))"`;
    card.innerHTML=`
      <button type="button" onclick="removeBeneficio(${b.id})" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;line-height:1;padding:2px;">✕</button>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Beneficio ${idx+1}${curLabel}</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div style="display:flex;background:var(--surface);border-radius:100px;padding:3px;gap:2px;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.12),0 0 0 1px var(--border2);">
          <button type="button" onclick="setBeneficioMode(${b.id},'pct')" ${pctBloqueado?'disabled':''} style="padding:5px 12px;border-radius:100px;border:none;background:${esPct?'var(--accent)':'transparent'};color:${esPct?'white':'var(--text3)'};font-family:inherit;font-size:12px;font-weight:700;cursor:${pctBloqueado?'default':'pointer'};opacity:${pctBloqueado?'0.35':'1'};transition:all 0.18s;">%</button>
          <button type="button" onclick="setBeneficioMode(${b.id},'monto')" style="padding:5px 12px;border-radius:100px;border:none;background:${!esPct?'var(--accent)':'transparent'};color:${!esPct?'white':'var(--text3)'};font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.18s;">$</button>
        </div>
        <input data-ben-amount type="text" inputmode="decimal" value="${inputVal}" ${inputAttrs} style="width:88px;flex:0 0 auto;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
        <select class="ben-type-select fsel" onchange="setBeneficioCat(${b.id},this.value)" style="flex:1;min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
          ${benTypeOptionsHtml(b.category)}
        </select>
        <!-- R8.3 · WEB: barra divisoria + chips de tipo EN EL MISMO renglón que el
             toggle y el campo. En móvil este bloque se oculta y manda el select. -->
        <div class="ben-type-sep"></div>
        <div class="ben-type-chips">${benChipsHtml(b.category, b.id, 'setBeneficioCat')}</div>
      </div>
      <!-- R8.1 · Renglón inferior del bloque: "= $X" a la izquierda y, en el
           ÚLTIMO bloque, "Quedan $Y" a la derecha (updateBeneficioRemaining lo
           muda aquí) — un solo renglón visual, sin espacio vertical extra. -->
      <div data-ben-calcrow style="display:none;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:10px;margin-top:6px;">
        <span data-ben-calc style="font-size:12px;color:var(--text3);"></span>
      </div>
    `;
    list.appendChild(card);
    if(animateNew && !prevIds.has(String(b.id))){
      revealAnimate(card);
    }
    updateBeneficioCalc(b.id);
  });
  updateAddBeneficioBtnVisibility();
  updateBeneficioRemaining();
  try{ _fselSyncAll(list); }catch(e){}
}

// El "= $X" de un bloque porcentual (los fijos no lo necesitan: el monto ES el valor)
function updateBeneficioCalc(id){
  const b=beneficios.find(x=>x.id===id);
  const el=document.querySelector(`#beneficio-list [data-ben-id="${id}"] [data-ben-calc]`);
  if(!b || !el) return;
  const amount=parseFloat(rawAmount(document.getElementById('amount')?.value))||0;
  const cur=document.getElementById('currency')?.value||'MXN';
  const sym=cur==='MXN'?'$':`${cur} `;
  if(b.mode==='pct' && (b.pct||0)>0 && amount>0){
    el.textContent=`= ${sym}${beneficioVal(b, amount).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    el.style.display='';
  } else {
    el.textContent='';
    el.style.display='none';
  }
  _syncBenCalcRow(el.closest('[data-ben-calcrow]'));
}

function setBeneficioMode(id, mode){
  const b=beneficios.find(x=>x.id===id);
  if(!b || b.mode===mode) return;
  if(mode==='pct' && benPctTaken(beneficios, id)){
    toast('Solo puede haber un beneficio porcentual');
    return;
  }
  b.mode=mode;
  // Cambiar de unidad invalida el valor anterior (un 15 de % no es un $15)
  b.pct=0; b.amount=0;
  renderBeneficios(false);
  try{ updateDesgloseRemaining(); }catch(e){}
  try{ refreshTopTabsVisibility(); }catch(e){}
}

function setBeneficioCat(id, cat){
  const b=beneficios.find(x=>x.id===id);
  if(!b) return;
  b.category=cat;
  // R8: repintar el estado activo de los chips de ESTE bloque (web) sin
  // re-renderizar la tarjeta (para no perder el foco de otros campos).
  paintBenChips('beneficio-list', id, cat);
  updateAddBeneficioBtnVisibility();
  updateBeneficioRemaining();
  try{ refreshTopTabsVisibility(); }catch(e){}
}

// Marca como activo el chip del tipo elegido dentro de un bloque de beneficio.
function paintBenChips(listId, benId, cat){
  const card=document.querySelector(`#${listId} [data-ben-id="${benId}"]`);
  if(!card) return;
  card.querySelectorAll('.ben-type-chip').forEach(ch=>{
    ch.classList.toggle('active', ch.textContent===cat);
  });
  const sel=card.querySelector('.ben-type-select');
  if(sel && sel.value!==cat) sel.value=cat;
  try{ _fselSyncAll(card); }catch(e){}
}

function updateBeneficio(id, field, value){
  const b=beneficios.find(x=>x.id===id);
  if(!b) return;
  if(field==='pct'){
    let p=parseFloat(value)||0;
    if(p<0) p=0; if(p>100) p=100;
    b.pct=p;
  } else if(field==='amount'){
    b.amount=parseFloat(value)||0;
  }
  updateBeneficioCalc(id);
  updateBeneficioRemaining();
  try{ updateDesgloseRemaining(); }catch(e){}
  try{ refreshTopTabsVisibility(); }catch(e){}
}

// ¿El último bloque está completo (monto/porcentaje + tipo)?
function lastBeneficioComplete(){
  if(beneficios.length===0) return false;
  const last=beneficios[beneficios.length-1];
  const val=(last.mode==='pct') ? (last.pct||0) : (last.amount||0);
  return val>0 && !!last.category;
}

// "Agregar otro beneficio" — misma mecánica que el botón de desglose
function updateAddBeneficioBtnVisibility(){
  const btn=document.getElementById('add-beneficio-btn');
  if(!btn) return;
  if(btn.dataset.exceedHidden==='1'){ btn.style.display='none'; return; }
  const complete = lastBeneficioComplete();
  btn.style.display = complete ? 'flex' : 'none';
  btn.style.opacity='';
}

function setAddBeneficioHidden(hidden){
  const btn=document.getElementById('add-beneficio-btn');
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
    const shouldShow = lastBeneficioComplete();
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

// Muestra el monto restante disponible tras aplicar los beneficios en orden.
// Si se excede: alerta en rojo + Guardar desactivado + sin "Agregar otro".
function updateBeneficioRemaining(){
  const remEl=document.getElementById('beneficio-remaining');
  if(!remEl) return;
  const det=beneficiosDetalle();
  // R8.1: "Quedan $Y" ya no genera renglón propio — comparte el renglón
  // inferior del ÚLTIMO bloque ("= $X" a la izquierda, esto a la derecha) y
  // viaja con él conforme se agregan bloques.
  const lastRow=document.querySelector('#beneficio-list [data-ben-id]:last-child [data-ben-calcrow]');
  if(beneficios.length===0 || !lastRow){
    remEl.style.display='none';
    _rehomeBeneficioRemaining();
    _benExceed=false; refreshSubmitDisabled();
    setAddBeneficioHidden(false);
    return;
  }
  if(remEl.parentElement!==lastRow) lastRow.appendChild(remEl);
  remEl.style.display='';
  remEl.style.marginTop='0';
  remEl.style.marginLeft='auto';   // pegado a la derecha aunque no haya "= $X"
  const cur=document.getElementById('currency')?.value||'MXN';
  const sym=cur==='MXN'?'$':`${cur} `;
  const fmtMoney = v => `${sym}${v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if(det.remaining < 0){
    remEl.style.color='var(--danger)';
    remEl.textContent=`Los beneficios no pueden superar el monto del egreso (${fmtMoney(det.amount)})`;
    _benExceed=true; refreshSubmitDisabled();
    setAddBeneficioHidden(true);
  } else {
    remEl.style.color='var(--text3)';
    const verbo = det.remaining>1 ? 'Quedan' : 'Queda';
    remEl.textContent=`${verbo} ${fmtMoney(det.remaining)}`;
    _benExceed=false; refreshSubmitDisabled();
    setAddBeneficioHidden(det.remaining<=0);
  }
  _syncBenCalcRow(lastRow);
}

// Recalcula los "= $X" de los bloques porcentuales y el restante — se llama
// cuando cambia el MONTO del egreso o el tipo de cambio (los valores dependen de él).
function refreshBeneficioCalcs(){
  beneficios.forEach(b=>updateBeneficioCalc(b.id));
  updateBeneficioRemaining();
}
function refreshEditBeneficioCalcs(){
  editBeneficios.forEach(b=>updateEditBeneficioCalc(b.id));
  updateEditBeneficioRemaining();
}

// Limpia por completo el módulo de beneficios (guardado, cambio de tipo)
function resetBeneficios(){
  beneficios=[];
  _rehomeBeneficioRemaining();   // R8.1: rescatar "Quedan" antes de limpiar
  const list=document.getElementById('beneficio-list');
  if(list) list.innerHTML='';
  const panel=document.getElementById('ben-panel');
  if(panel) panel.style.display='none';
  _benVisible=false;
  const addBtn=document.getElementById('add-beneficio-btn');
  if(addBtn){ addBtn.dataset.exceedHidden=''; addBtn.style.display='none'; addBtn.style.opacity=''; }
  const remEl=document.getElementById('beneficio-remaining');
  if(remEl) remEl.style.display='none';
  _benExceed=false;
  try{ refreshSubmitDisabled(); }catch(e){}
  try{ updateInlineBtn('inline-ben-btn', false, false); }catch(e){}
}


// ══════════════════════════════════════
// R7.2 · BLOQUES DE BENEFICIO (edición) — espejo exacto del registro
// ══════════════════════════════════════
let editBeneficios = []; // {id, mode, pct, amount, category}

function editBeneficiosDetalle(){
  const amount=parseFloat(rawAmount(document.getElementById('e-amount')?.value))||0;
  return _beneficiosDetalleDe(editBeneficios, amount);
}
function editBeneficiosTotal(){ return editBeneficiosDetalle().total; }

function addEditBeneficio(){
  // R8: default porcentaje, salvo que ya exista un bloque porcentual.
  const yaHayPct = editBeneficios.some(b=>b.mode==='pct');
  editBeneficios.push({ id: genId(), mode: yaHayPct?'monto':'pct', pct:0, amount:0, category:'' });
  renderEditBeneficios(true);
}

function removeEditBeneficio(id){
  const list=document.getElementById('e-beneficio-list');
  const card=list?list.querySelector(`[data-ben-id="${id}"]`):null;
  const isOnlyOne = editBeneficios.length<=1;
  const applyRemoval=()=>{
    editBeneficios = editBeneficios.filter(b=>b.id!==id);
    if(isOnlyOne){
      _eBenVisible=false;
      const addBtn=document.getElementById('e-add-beneficio-btn');
      if(addBtn){ addBtn.dataset.exceedHidden=''; addBtn.style.opacity=''; }
      hideAnimate(document.getElementById('e-ben-panel'));   // R8: colapso suave
      updateEditBeneficioRemaining();
      try{ refreshEditTopTabs(); }catch(e){}
    } else {
      renderEditBeneficios(false);
    }
    try{ updateEditDesgloseRemaining(); }catch(e){}
  };
  animateEditDesgloseRemoval(card, isOnlyOne, applyRemoval);
}

function renderEditBeneficios(animateNew){
  const list=document.getElementById('e-beneficio-list');
  if(!list) return;
  const cur=document.getElementById('e-currency')?.value||'MXN';
  const curLabel = cur==='MXN' ? '' : ` (${cur})`;
  _rehomeEditBeneficioRemaining();   // R8.1: rescatar "Quedan" antes de limpiar
  const prevIds = new Set(Array.from(list.children).map(c=>c.dataset.benId));
  list.innerHTML='';
  editBeneficios.forEach((b,idx)=>{
    const card=document.createElement('div');
    card.dataset.benId=String(b.id);
    card.style.cssText='background:var(--surface2);border-radius:var(--radius-sm);padding:11px;margin-bottom:8px;position:relative;';
    const pctBloqueado = benPctTaken(editBeneficios, b.id);
    const esPct = b.mode==='pct';
    const inputVal = esPct
      ? (b.pct ? String(b.pct) : '')
      : (b.amount ? formatAmountString(String(b.amount)) : '');
    const inputAttrs = esPct
      ? `placeholder="%" oninput="updateEditBeneficio(${b.id},'pct',this.value)"`
      : `placeholder="$" oninput="handleAmountInput(this);updateEditBeneficio(${b.id},'amount',rawAmount(this.value))"`;
    card.innerHTML=`
      <button type="button" onclick="removeEditBeneficio(${b.id})" style="position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;line-height:1;padding:2px;">✕</button>
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Beneficio ${idx+1}${curLabel}</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div style="display:flex;background:var(--surface);border-radius:100px;padding:3px;gap:2px;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.12),0 0 0 1px var(--border2);">
          <button type="button" onclick="setEditBeneficioMode(${b.id},'pct')" ${pctBloqueado?'disabled':''} style="padding:5px 12px;border-radius:100px;border:none;background:${esPct?'var(--accent)':'transparent'};color:${esPct?'white':'var(--text3)'};font-family:inherit;font-size:12px;font-weight:700;cursor:${pctBloqueado?'default':'pointer'};opacity:${pctBloqueado?'0.35':'1'};transition:all 0.18s;">%</button>
          <button type="button" onclick="setEditBeneficioMode(${b.id},'monto')" style="padding:5px 12px;border-radius:100px;border:none;background:${!esPct?'var(--accent)':'transparent'};color:${!esPct?'white':'var(--text3)'};font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.18s;">$</button>
        </div>
        <input data-ben-amount type="text" inputmode="decimal" value="${inputVal}" ${inputAttrs} style="width:88px;flex:0 0 auto;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
        <select class="ben-type-select fsel" onchange="setEditBeneficioCat(${b.id},this.value)" style="flex:1;min-width:0;padding:8px 10px;border:none;border-radius:8px;background:var(--surface);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
          ${benTypeOptionsHtml(b.category)}
        </select>
        <!-- R8.3 · WEB: barra divisoria + chips en el MISMO renglón (espejo del registro) -->
        <div class="ben-type-sep"></div>
        <div class="ben-type-chips">${benChipsHtml(b.category, b.id, 'setEditBeneficioCat')}</div>
      </div>
      <!-- R8.1 · Renglón inferior (espejo del registro): "= $X" izq + "Quedan" der en el último bloque -->
      <div data-ben-calcrow style="display:none;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:10px;margin-top:6px;">
        <span data-ben-calc style="font-size:12px;color:var(--text3);"></span>
      </div>
    `;
    list.appendChild(card);
    if(animateNew && !prevIds.has(String(b.id))){
      revealAnimate(card);
    }
    updateEditBeneficioCalc(b.id);
  });
  updateEditAddBeneficioBtnVisibility();
  updateEditBeneficioRemaining();
  try{ _fselSyncAll(list); }catch(e){}
}

function updateEditBeneficioCalc(id){
  const b=editBeneficios.find(x=>x.id===id);
  const el=document.querySelector(`#e-beneficio-list [data-ben-id="${id}"] [data-ben-calc]`);
  if(!b || !el) return;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount')?.value))||0;
  const cur=document.getElementById('e-currency')?.value||'MXN';
  const sym=cur==='MXN'?'$':`${cur} `;
  if(b.mode==='pct' && (b.pct||0)>0 && amount>0){
    el.textContent=`= ${sym}${beneficioVal(b, amount).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    el.style.display='';
  } else {
    el.textContent='';
    el.style.display='none';
  }
  _syncBenCalcRow(el.closest('[data-ben-calcrow]'));
}

function setEditBeneficioMode(id, mode){
  const b=editBeneficios.find(x=>x.id===id);
  if(!b || b.mode===mode) return;
  if(mode==='pct' && benPctTaken(editBeneficios, id)){
    toast('Solo puede haber un beneficio porcentual');
    return;
  }
  b.mode=mode;
  b.pct=0; b.amount=0;
  renderEditBeneficios(false);
  try{ updateEditDesgloseRemaining(); }catch(e){}
  try{ refreshEditTopTabs(); }catch(e){}
}

function setEditBeneficioCat(id, cat){
  const b=editBeneficios.find(x=>x.id===id);
  if(!b) return;
  b.category=cat;
  paintBenChips('e-beneficio-list', id, cat);   // R8: repintar chips (web)
  updateEditAddBeneficioBtnVisibility();
  updateEditBeneficioRemaining();
  try{ refreshEditTopTabs(); }catch(e){}
}

function updateEditBeneficio(id, field, value){
  const b=editBeneficios.find(x=>x.id===id);
  if(!b) return;
  if(field==='pct'){
    let p=parseFloat(value)||0;
    if(p<0) p=0; if(p>100) p=100;
    b.pct=p;
  } else if(field==='amount'){
    b.amount=parseFloat(value)||0;
  }
  updateEditBeneficioCalc(id);
  updateEditBeneficioRemaining();
  try{ updateEditDesgloseRemaining(); }catch(e){}
  try{ refreshEditTopTabs(); }catch(e){}
}

function lastEditBeneficioComplete(){
  if(editBeneficios.length===0) return false;
  const last=editBeneficios[editBeneficios.length-1];
  const val=(last.mode==='pct') ? (last.pct||0) : (last.amount||0);
  return val>0 && !!last.category;
}

function updateEditAddBeneficioBtnVisibility(){
  const btn=document.getElementById('e-add-beneficio-btn');
  if(!btn) return;
  if(btn.dataset.exceedHidden==='1'){ btn.style.display='none'; return; }
  const complete = lastEditBeneficioComplete();
  btn.style.display = complete ? 'flex' : 'none';
  btn.style.opacity='';
}

function setEditAddBeneficioHidden(hidden){
  const btn=document.getElementById('e-add-beneficio-btn');
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
    const shouldShow = lastEditBeneficioComplete();
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

function updateEditBeneficioRemaining(){
  const remEl=document.getElementById('e-beneficio-remaining');
  if(!remEl) return;
  const det=editBeneficiosDetalle();
  // R8.1: espejo del registro — "Quedan" comparte renglón con el último bloque
  const lastRow=document.querySelector('#e-beneficio-list [data-ben-id]:last-child [data-ben-calcrow]');
  if(editBeneficios.length===0 || !lastRow){
    remEl.style.display='none';
    _rehomeEditBeneficioRemaining();
    _eBenExceed=false; refreshEditSubmitDisabled();
    setEditAddBeneficioHidden(false);
    return;
  }
  if(remEl.parentElement!==lastRow) lastRow.appendChild(remEl);
  remEl.style.display='';
  remEl.style.marginTop='0';
  remEl.style.marginLeft='auto';
  const cur=document.getElementById('e-currency')?.value||'MXN';
  const sym=cur==='MXN'?'$':`${cur} `;
  const fmtMoney = v => `${sym}${v.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if(det.remaining < 0){
    remEl.style.color='var(--danger)';
    remEl.textContent=`Los beneficios no pueden superar el monto del egreso (${fmtMoney(det.amount)})`;
    _eBenExceed=true; refreshEditSubmitDisabled();
    setEditAddBeneficioHidden(true);
  } else {
    remEl.style.color='var(--text3)';
    const verbo = det.remaining>1 ? 'Quedan' : 'Queda';
    remEl.textContent=`${verbo} ${fmtMoney(det.remaining)}`;
    _eBenExceed=false; refreshEditSubmitDisabled();
    setEditAddBeneficioHidden(det.remaining<=0);
  }
  _syncBenCalcRow(lastRow);
}

function resetEditBeneficios(){
  editBeneficios=[];
  _rehomeEditBeneficioRemaining();   // R8.1: rescatar "Quedan" antes de limpiar
  const list=document.getElementById('e-beneficio-list');
  if(list) list.innerHTML='';
  const panel=document.getElementById('e-ben-panel');
  if(panel) panel.style.display='none';
  _eBenVisible=false;
  const addBtn=document.getElementById('e-add-beneficio-btn');
  if(addBtn){ addBtn.dataset.exceedHidden=''; addBtn.style.display='none'; addBtn.style.opacity=''; }
  const remEl=document.getElementById('e-beneficio-remaining');
  if(remEl) remEl.style.display='none';
  _eBenExceed=false;
  try{ refreshEditSubmitDisabled(); }catch(e){}
}

// ── VALIDACIÓN DE DESGLOSES ──
// Una tarjeta "iniciada" (con monto, categoría o nombre propio) debe estar
// COMPLETA para poder guardar: monto > 0 + categoría + subcategoría si aplica.
// Las tarjetas totalmente vacías se ignoran en silencio (el usuario agregó una
// y se arrepintió).
function firstIncompleteDesglose(list, tipo){
  for(const d of (list||[])){
    const iniciada = (d.amount>0) || !!d.category || !!String(d.desc||'').trim();
    if(!iniciada) continue;
    if(!(d.amount>0)) return 'Ponle monto a cada desglose (o elimínalo)';
    if(!d.category) return 'Elige la categoría de cada desglose (o elimínalo)';
    const subs=sortedSubcats(tipo, d.category);
    const hasSubs=subs && !(subs.length===1 && subs[0]==='—');
    if(hasSubs && !d.subcategory) return 'Elige la subcategoría de cada desglose (o elimínalo)';
  }
  return null;
}
