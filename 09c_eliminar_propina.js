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


function togglePropina(){
  propinaOn=!propinaOn;
  updatePropinaUI();
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
