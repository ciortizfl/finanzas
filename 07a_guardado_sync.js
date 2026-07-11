// ══════════════════════════════════════
// ANIMACIÓN DE GUARDADO (registro nuevo)
// Absorción de campos hacia el botón → botón se vuelve círculo verde con palomita
// → todo se limpia → formulario reaparece en cascada.
// ══════════════════════════════════════
function playRegisterSaveAnimation(done){
  const card=document.getElementById('register-form-card');
  const btn=document.getElementById('submit-btn');
  const btnTxt=document.getElementById('submit-btn-txt');
  const check=document.getElementById('submit-check');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!card || !btn || reduced){ if(done) done(); return; }

  // Absorber los .field, el inline-toggles (Propina/Beneficio) Y la note-section
  // (que contiene Nota/Desglose) — estos dos últimos no tienen clase .field.
  const fields = Array.from(card.querySelectorAll('.field'));
  const inlineToggles = document.getElementById('inline-toggles');
  if(inlineToggles && inlineToggles.offsetParent!==null) fields.push(inlineToggles);
  const noteSection = document.getElementById('note-section');
  if(noteSection && noteSection.offsetParent!==null) fields.push(noteSection);
  const btnR = btn.getBoundingClientRect();

  // 1) Absorción: cada elemento se desplaza hacia el botón y se desvanece.
  //    Ordenar por posición vertical real para que la cascada sea de arriba a abajo.
  const visibleEls = fields.filter(f=>f.offsetParent!==null)
    .sort((a,b)=>a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  visibleEls.forEach((f,i)=>{
    const fr=f.getBoundingClientRect();
    const dy=(btnR.top - fr.top);
    try{
      f.animate([
        {transform:'translateY(0) scale(1)',opacity:1},
        {transform:`translateY(${dy*0.5}px) scale(0.9)`,opacity:0}
      ],{duration:400,delay:i*45,easing:'cubic-bezier(0.55,0,0.67,0.2)',fill:'forwards'});
    }catch(e){}
  });

  const absorbTime = 260 + visibleEls.length*45;

  // 2) El botón se transforma en círculo verde y dibuja la palomita
  //    (idéntico a la página de prueba, opción 3)
  setTimeout(()=>{
    const EASE_SPRING='cubic-bezier(0.34,1.56,0.64,1)';
    const EASE_OUT='cubic-bezier(0.22,0.61,0.36,1)';
    if(btnTxt){ btnTxt.style.transition='opacity .15s'; btnTxt.style.opacity='0'; }
    btn.style.transition='background .3s, width .4s '+EASE_SPRING+', border-radius .4s '+EASE_SPRING+', margin .4s '+EASE_SPRING+', height .4s '+EASE_SPRING+', padding .4s '+EASE_SPRING;
    btn.style.width='52px'; btn.style.height='52px'; btn.style.padding='0';
    btn.style.margin='18px auto 0'; btn.style.display='block';
    btn.style.borderRadius='50%'; btn.style.background='var(--green)';
    setTimeout(()=>{
      if(check){
        check.style.opacity='1';
        const path=check.querySelector('path');
        if(path){ try{ path.animate([{strokeDashoffset:30},{strokeDashoffset:0}],{duration:400,easing:EASE_OUT,fill:'forwards'}); }catch(e){} }
      }
    }, 260);
  }, absorbTime);

  // 3) Callback tras mostrar la palomita completa
  setTimeout(()=>{ if(done) done(); }, absorbTime + 260 + 500);
}

// Restaura el botón y hace reaparecer el formulario en cascada
function restoreRegisterForm(){
  const card=document.getElementById('register-form-card');
  const btn=document.getElementById('submit-btn');
  const btnTxt=document.getElementById('submit-btn-txt');
  const check=document.getElementById('submit-check');

  // 1) Ocultar palomita y restaurar el botón a su forma normal instantáneamente.
  //    NO tocamos display (lo controla updateFinalizeVisibility tras el reset).
  if(check){ check.style.opacity='0'; const p=check.querySelector('path'); if(p) p.style.strokeDashoffset='30'; }
  if(btn){
    btn.style.transition='none';
    btn.style.width=''; btn.style.height=''; btn.style.padding='';
    btn.style.margin=''; btn.style.borderRadius=''; btn.style.background='';
    // Tras el reset no hay categoría seleccionada → el botón se oculta
    btn.style.display='none';
    void btn.offsetWidth;
    btn.style.transition='';
  }
  if(btnTxt){ btnTxt.style.transition='none'; btnTxt.style.opacity='1'; }

  // 2) Limpiar transforms/opacidad residuales de campos + inline-toggles + note-section
  if(card){
    const clearEls=[...card.querySelectorAll('.field')];
    const it=document.getElementById('inline-toggles');
    if(it) clearEls.push(it);
    const ns=document.getElementById('note-section');
    if(ns) clearEls.push(ns);
    clearEls.forEach(f=>{
      try{ f.getAnimations().forEach(a=>a.cancel()); }catch(e){}
      f.style.transform='';
      f.style.opacity='';
    });
    // 3) Reaparición en cascada más lenta (~1s en total), de arriba hacia abajo.
    //    Se hace en el siguiente frame para no chocar con la reconstrucción de setType.
    requestAnimationFrame(()=>{
      const visibleFields=Array.from(card.querySelectorAll('.field'))
        .filter(f=>f.offsetParent!==null); // solo los visibles
      const n=visibleFields.length;
      // Repartir la cascada para que dure casi 1s en total
      const stepDelay = n>1 ? Math.floor(600/(n-1)) : 0; // hasta ~600ms de escalonado
      visibleFields.forEach((f,i)=>{
        try{
          f.animate([
            {opacity:0,transform:'translateY(-16px)'},
            {opacity:1,transform:'translateY(0)'}
          ],{duration:520,delay:i*stepDelay,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'backwards'});
        }catch(e){}
      });
    });
  }
}

// Crea N registros mensuales vinculados para un gasto diferido.
// Cada mensualidad comparte descripción, categoría, subcategoría, método y nota;
// solo cambian la fecha y el índice de mes. Se identifican por deferGroup.
function submitDeferredEntry({amount, desc, cur, date, note, subcat}){
  const n=diferirMonths;
  const groupId=genId();
  const base=parseDate(date)||new Date();
  const perMonth=Math.floor((amount/n)*100)/100;
  let acc=0;
  for(let i=0;i<n;i++){
    // El último mes absorbe el residuo del redondeo para cuadrar el total
    let monthAmt=perMonth;
    if(i===n-1) monthAmt=+(amount-acc).toFixed(2);
    acc+=perMonth;
    const d=diferirMonthlyDate(base,i);
    const dateStr=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const entry={
      id: genId(), type:'egreso',
      amount:monthAmt, amountMXN:toMXN(monthAmt,cur), currency:cur,
      desc, category:curCat, subcategory:subcat,
      method:selMethod, date:dateStr, note,
      deferGroup:groupId, deferIndex:i+1, deferTotal:n, deferOriginal:amount
    };
    data.unshift(entry);
  }
  trackUsage(curType, curCat, subcat);
  save();
  showSyncing('⟳ Guardando...');
  // Guardar todas las mensualidades en UNA sola petición (evita colisiones de
  // escrituras concurrentes en Apps Script, que hacían que se perdieran registros).
  const groupEntries=data.filter(x=>sameGroup(x.deferGroup,groupId));
  saveBatchToSheets(groupEntries).then(()=>{ hideSyncing(); });

  playRegisterSaveAnimation(()=>{
    try { resetForm(); } catch(e){ console.error('resetForm error:', e); }
    restoreRegisterForm();
  });
  const _fieldCount = document.querySelectorAll('#register-form-card .field').length;
  setTimeout(()=>toast(`✓ Gasto diferido en ${n} meses`), 260 + _fieldCount*45 + 100);
  return true;
}

function submitEntry(){
  try { _submitEntry(); } catch(e){ console.error('submitEntry error:', e); toast('Error: '+e.message); }
}
function _submitEntry(){
  const amount=parseFloat(rawAmount(document.getElementById('amount').value));
  const desc=document.getElementById('desc').value.trim();
  const cur=document.getElementById('currency').value;
  const date=document.getElementById('tx-date').value;
  const noteEl=document.getElementById('note');
  const note=noteEl?noteEl.value.trim():'';
  // La subcategoría se determina por si la categoría actual tiene subcategorías
  const _subs = curCat ? sortedSubcats(curType, curCat) : [];
  const _hasSubs = _subs && !(_subs.length===1 && _subs[0]==='—');
  const subcat = _hasSubs ? curSubcat : '';

  if(!amount||amount<=0) return toast('Ingresa un monto válido');
  if(!desc) return toast('Agrega una descripción');
  if(!curCat) return toast('Selecciona una categoría');
  if(_hasSubs && !subcat) return toast('Selecciona una subcategoría');
  if(!date) return toast('Selecciona una fecha');
  if(curType!=='ahorro-pasivo'&&!selMethod) return toast('Selecciona un método de pago');

  // ── DIFERIR: si está activo, crear N registros mensuales vinculados ──
  if(curType==='egreso' && diferirHasData()){
    return submitDeferredEntry({amount, desc, cur, date, note, subcat});
  }

  // Si el beneficio está activo con monto, debe tener un tipo elegido
  if(curType==='egreso' && benOn && getBenAmount()>0 && !curBenType){
    return toast('Selecciona un tipo de beneficio');
  }

  // ── Validar desgloses (egreso, ingreso y beneficio) ──
  const activeDesgloses = desgloses.filter(d=>d.amount>0);
  if(activeDesgloses.length>0){
    for(const d of activeDesgloses){
      if(!d.category) return toast('Cada desglose necesita una categoría');
      const dsubs=sortedSubcats(curType, d.category);
      const dHasSubs=dsubs && !(dsubs.length===1 && dsubs[0]==='—');
      if(dHasSubs && !d.subcategory) return toast('Cada desglose necesita una subcategoría');
    }
    const totalDesg=activeDesgloses.reduce((s,d)=>s+d.amount,0);
    const remainingPrincipal=+(amount-totalDesg).toFixed(2);
    const maxDesg=activeDesgloses.reduce((mx,d)=>Math.max(mx,d.amount),0);
    if(remainingPrincipal < maxDesg) return toast('Ningún desglose puede superar el gasto principal');
  }

  // Si la propina está incluida en el monto, el gasto real = monto - propina
  let mainAmount = amount;
  if(curType==='egreso' && propinaOn && propinaIncluida){
    const propinaAmt = getPropinaAmount();
    if(propinaAmt > 0) mainAmount = +(mainAmount - propinaAmt).toFixed(2);
  }
  // Beneficio: SIEMPRE se resta del monto registrado (representa lo que te ahorraste
  // en ese pago) y se suma a la categoría de ahorro pasivo correspondiente.
  if(curType==='egreso' && benOn){
    const ba = getBenAmount();
    // Si hay monto de beneficio pero no se eligió tipo, pedirlo
    if(ba > 0 && !curBenType) return toast('Elige el tipo de beneficio');
    if(ba > 0) mainAmount = +(mainAmount - ba).toFixed(2);
    if(mainAmount < 0) mainAmount = 0;
  }
  // Desgloses: cada uno se resta del monto principal
  const totalDesgloses = activeDesgloses.reduce((s,d)=>s+d.amount,0);
  if(totalDesgloses>0){
    mainAmount = +(mainAmount - totalDesgloses).toFixed(2);
    if(mainAmount < 0) mainAmount = 0;
  }
  const amountMXN = toMXN(mainAmount, cur);

  // Nota principal del registro: SOLO la nota del usuario.
  // "Monto original" y etiquetas de propina/beneficio se muestran dinámicamente
  // en el listado (no se guardan en la nota editable del madre).
  let mainNote = note;

  const entry={
    id:genId(), type:curType, amount:mainAmount, amountMXN, currency:cur,
    desc, category:curCat, subcategory:subcat,
    method:curType!=='ahorro-pasivo'?selMethod:null,
    date, note:mainNote
  };
  data.unshift(entry);

  if(curType==='egreso'&&benOn){
    const ba=getBenAmount();
    const bt=curBenType;
    if(ba>0){
      const baMXN=toMXN(ba,cur);
      const sym=cur==='MXN'?'$':`${cur} `;
      // Nota del beneficio: "Beneficio de: X" + detalle (% si aplica)
      let benNote=`Beneficio de: ${desc}`;
      if(benType==='pct'){
        const pct=parseFloat(document.getElementById('ben-pct').value)||0;
        benNote += ` | ${pct}% de ${sym}${amount.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
      }
      data.unshift({
        id:genId(), type:'ahorro-pasivo',
        amount:ba, amountMXN:baMXN, currency:cur,
        desc:desc, category:bt, subcategory:'',
        method:null, date,
        note:benNote, linkedTo:entry.id
      });
    }
  }

  // Propina entry
  let propinaEntry=null;
  if(curType==='egreso'&&propinaOn){
    const propinaAmt=getPropinaAmount();
    if(propinaAmt>0){
      const propinaAmtMXN=toMXN(propinaAmt,cur);
      const sym=cur==='MXN'?'$':`${cur} `;
      const propinaNoteparts=[`Propina de: ${desc}`];
      if(propinaType==='pct'){
        const pct=parseFloat(document.getElementById('propina-pct').value)||0;
        const label=propinaIncluida?`incluida en ${sym}${amount.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`:`adicional a ${sym}${amount.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
        propinaNoteparts.push(`${pct}% ${label}`);
      } else {
        propinaNoteparts.push(propinaIncluida?'incluida':'adicional');
      }
      // Include TC note from the already-injected rate if foreign currency
      if(cur!=='MXN'){
        const r=rates[cur];
        if(r) propinaNoteparts.push(`TC: 1 ${cur} = $${r.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} MXN`);
      }
      propinaEntry={
        id:genId(), type:'egreso',
        amount:propinaAmt, amountMXN:propinaAmtMXN, currency:cur,
        desc:desc, category:'Generosidad', subcategory:'Propinas',
        method:getPropinaMethod(), date,
        note:propinaNoteparts.join(' | '), linkedTo:entry.id
      };
      data.unshift(propinaEntry);
    }
  }

  // ── Crear desgloses como registros vinculados al registro madre ──
  // Heredan tipo, moneda, fecha y método del padre.
  const desgloseEntries=[];
  if(activeDesgloses.length>0){
    activeDesgloses.forEach(d=>{
      const dMXN=toMXN(d.amount, cur);
      const dsubs=sortedSubcats(curType, d.category);
      const dHasSubs=dsubs && !(dsubs.length===1 && dsubs[0]==='—');
      // El desglose solo lleva "Desglose de: X" (su monto ya es menor; el original es inútil aquí)
      let dNote=`Desglose de: ${desc}`;
      if(d.note) dNote=`${d.note} | ${dNote}`;
      const dEntry={
        id: genId(), type:curType,
        amount:d.amount, amountMXN:dMXN, currency:cur,
        desc:desc, category:d.category, subcategory: dHasSubs?d.subcategory:'',
        method:curType!=='ahorro-pasivo'?selMethod:null, date,
        note:dNote, linkedTo:entry.id
      };
      data.unshift(dEntry);
      desgloseEntries.push(dEntry);
    });
  }

  trackUsage(curType, curCat, subcat);
  save();
  showSyncing('⟳ Guardando...');
  const saves = [saveEntryToSheets(entry)];
  if(curType==='egreso'&&benOn){
    const bonus = data.find(x=>x.linkedTo===entry.id&&x.type==='ahorro-pasivo');
    if(bonus) saves.push(saveEntryToSheets({...bonus, benType:'', benAmount:0, benDesc:''}));
  }
  if(propinaEntry) saves.push(saveEntryToSheets(propinaEntry));
  desgloseEntries.forEach(de=>saves.push(saveEntryToSheets(de)));
  Promise.all(saves).then(()=>{ hideSyncing(); });

  // Reproducir animación de guardado: absorción + palomita, luego reset y cascada.
  playRegisterSaveAnimation(()=>{
    // Resetear el formulario (reconstruye limpio y oculta note/submit)
    try { resetForm(); } catch(e){ console.error('resetForm error (no afecta el guardado):', e); }
    // Reaparición en cascada en el siguiente frame (tras la reconstrucción)
    restoreRegisterForm();
  });
  // El toast aparece al terminar la absorción (como la opción 1)
  const _fieldCount = document.querySelectorAll('#register-form-card .field').length;
  setTimeout(()=>toast('✓ Registro guardado'), 260 + _fieldCount*45 + 100);
  return true; // señal de guardado exitoso
}

function resetForm(){
  ['amount','desc','note','ben-amount','ben-pct'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  document.getElementById('currency').value='MXN';
  const _today = localToday();
  document.getElementById('tx-date').value = _today;
  initStrip('tx-date-strip', _today);
  selMethod='Tarjeta de crédito';
  document.querySelectorAll('#method-field .chip').forEach(c=>c.classList.remove('active'));
  const creditoBtn=document.getElementById('method-credito');
  if(creditoBtn) creditoBtn.classList.add('active');
  // Reset inline toggles
  propinaOn=false; benOn=false;
  _propinaVisible=false; _benVisible=false;
  // Reset Diferir
  diferirMonths=0; diferirCustom=false; _diferirVisible=false;
  const _dpanel=document.getElementById('diferir-panel');
  if(_dpanel) _dpanel.style.display='none';
  const _dcustom=document.getElementById('diferir-custom');
  if(_dcustom) _dcustom.value='';
  updateInlineBtn('inline-diferir-btn', false, false);
  // Restaurar el crossfade: mostrar el renglón de 3 botones, ocultar el botón completo
  const _drow=document.getElementById('inline-row-main');
  const _dfull=document.getElementById('inline-diferir-full');
  if(_drow){ _drow.getAnimations().forEach(a=>a.cancel()); _drow.style.opacity=''; _drow.style.pointerEvents=''; }
  if(_dfull){ _dfull.getAnimations().forEach(a=>a.cancel()); _dfull.style.opacity='0'; _dfull.style.transform=''; _dfull.style.pointerEvents='none'; }
  // Restaurar visibilidad de Propina/Beneficio (por si quedaron ocultos por Diferir)
  const _pb=document.getElementById('inline-propina-btn'); if(_pb){ _pb.style.display=''; _pb.style.opacity=''; }
  const _bb=document.getElementById('inline-ben-btn'); if(_bb){ _bb.style.display=''; _bb.style.opacity=''; }
  updateInlineBtn('inline-propina-btn', false, false);
  updateInlineBtn('inline-ben-btn', false, false);
  const pp=document.getElementById('propina-panel');
  const bp=document.getElementById('ben-panel');
  if(pp) pp.style.display='none';
  if(bp) bp.style.display='none';
  const noteWrap=document.getElementById('note-field-wrap');
  if(noteWrap) noteWrap.style.display='none';
  // Reset toggles Nota / Desglose
  _noteVisible=false; _desgloseVisible=false;
  const dsec=document.getElementById('desglose-section');
  if(dsec) dsec.style.display='none';
  updateInlineBtn('note-toggle-btn', false, false);
  updateInlineBtn('desglose-toggle-btn', false, false);
  curBenType='';
  // Limpiar los bloques de tipo de beneficio para que se reconstruyan al reactivar
  const benBlocks=document.getElementById('ben-type-blocks');
  if(benBlocks){ benBlocks.innerHTML=''; benBlocks._benSelected=''; }
  // Reset estado del beneficio a default (monto directo, adicional)
  benType='monto';
  setBenType('monto');
  const benCalc=document.getElementById('ben-calc'); if(benCalc) benCalc.textContent='';
  benOn=false; updateBenUI(); onCurChange(); resetPropina(); 
  desgloses=[]; renderDesgloses();
  setType('egreso');
}

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzxuxCfZkEsuRV7tvRrURWtMouNgVXW5FABBsMXxIfOExBNE7uFPWy8eYMd7WYFEdyuOw/exec';

// ── SYNC STATE ──
let syncing = false;

function showSyncing(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg || '⟳ Sincronizando...';
  t.classList.add('show');
}
function hideSyncing() {
  const t = document.getElementById('toast');
  t.classList.remove('show');
}

// ── REGISTRO DE ESCRITURAS PENDIENTES ──
// Cuando guardamos algo en Sheets, la escritura tarda 1-2s. Si durante ese lapso
// se recarga desde Sheets (por ejemplo al ir al historial), la respuesta aún NO
// incluye el registro nuevo y, al reemplazar los datos, el registro "desaparecía".
// Estos conjuntos recuerdan qué IDs están en vuelo para conservarlos en la recarga.
const _pendingSaves = new Set();   // IDs guardados/actualizados aún no confirmados
const _pendingDeletes = new Set(); // IDs borrados aún no confirmados

// ── SAVE TO SHEETS ──
async function saveEntryToSheets(entry) {
  if(entry && entry.id!=null) _pendingSaves.add(String(entry.id));
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'save', entry })
    });
  } catch(e) { console.warn('Sheets save failed', e); }
  finally {
    // Dar margen a que Sheets refleje la escritura antes de dejar de protegerlo
    if(entry && entry.id!=null){
      setTimeout(()=>_pendingSaves.delete(String(entry.id)), 4000);
    }
  }
}

// Guarda varias entradas en UNA sola petición (para gastos diferidos).
// Evita disparar N fetch simultáneos que Apps Script no procesa bien.
async function saveBatchToSheets(entries) {
  const ids=(entries||[]).map(e=>e&&e.id!=null?String(e.id):null).filter(Boolean);
  ids.forEach(id=>_pendingSaves.add(id));
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveBatch', entries })
    });
  } catch(e) { console.warn('Sheets batch save failed', e); }
  finally {
    setTimeout(()=>ids.forEach(id=>_pendingSaves.delete(id)), 4000);
  }
}

async function updateEntryInSheets(entry) {
  if(entry && entry.id!=null) _pendingSaves.add(String(entry.id));
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'update', entry })
    });
  } catch(e) { console.warn('Sheets update failed', e); }
  finally {
    if(entry && entry.id!=null){
      setTimeout(()=>_pendingSaves.delete(String(entry.id)), 4000);
    }
  }
}

async function deleteEntryInSheets(id) {
  if(id!=null) _pendingDeletes.add(String(id));
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id })
    });
  } catch(e) { console.warn('Sheets delete failed', e); }
  finally {
    if(id!=null){
      setTimeout(()=>_pendingDeletes.delete(String(id)), 4000);
    }
  }
}

// ── LOAD FROM SHEETS ──
async function loadFromSheets(silent) {
  try {
    if(!silent) showSyncing('⟳ Cargando datos...');
    const r = await fetch(SHEETS_URL);
    const json = await r.json();
    hideSyncing();
    if (!json.ok || !json.rows || json.rows.length < 2) return;
    const rows = json.rows.slice(1); // skip header
    const newData = rows.map(r => {
      let dateVal = r[1];
      // Limpiar apóstrofo inicial que Sheets puede dejar al forzar texto
      if(typeof dateVal==='string') dateVal=dateVal.replace(/^'/,'');
      if (dateVal instanceof Date) {
        // Usar componentes LOCALES (no toISOString, que usa UTC y puede correr el día)
        const y=dateVal.getFullYear();
        const mo=String(dateVal.getMonth()+1).padStart(2,'0');
        const da=String(dateVal.getDate()).padStart(2,'0');
        dateVal = `${y}-${mo}-${da}`;
      } else if (typeof dateVal === 'number') {
        // Serial de Sheets → fecha; construir en local para no correr el día
        const d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        const y=d.getUTCFullYear();
        const mo=String(d.getUTCMonth()+1).padStart(2,'0');
        const da=String(d.getUTCDate()).padStart(2,'0');
        dateVal = `${y}-${mo}-${da}`;
      } else {
        let ds = String(dateVal);
        // Manejar formato con año presente (ej. "Fri Apr 03 2026" o ISO).
        if(/^\d{4}-\d{2}-\d{2}/.test(ds)){
          dateVal = ds.slice(0,10);
        } else {
          const parsed = new Date(ds);
          // Solo aceptar si el año parseado es razonable (>=2020); si no, dejar
          // el valor crudo para que el diagnóstico lo revele en vez de inventar 2001.
          if(!isNaN(parsed.getTime()) && parsed.getFullYear()>=2020){
            const y=parsed.getFullYear();
            const mo=String(parsed.getMonth()+1).padStart(2,'0');
            const da=String(parsed.getDate()).padStart(2,'0');
            dateVal = `${y}-${mo}-${da}`;
          } else {
            dateVal = ds.slice(0,10);
          }
        }
      }
      const cleanNum = v => {
        if(v==null || v==='') return null;
        const s=String(v).replace(/^'/,'');
        const n=Number(s);
        return isNaN(n)?null:n;
      };
      const obj = {
        id:         cleanNum(r[0]),
        date:       dateVal,
        type:       r[2],
        category:   r[3],
        subcategory:r[4]||'',
        desc:       r[5],
        amount:     Number(r[6]),
        currency:   r[7]||'MXN',
        amountMXN:  Number(r[8]),
        method:     r[9]||null,
        note:       dedupeNoteMeta(r[10]||''),
        benType:    r[11]||'',
        benAmount:  r[12]?Number(r[12]):0,
        benDesc:    r[13]||'',
        linkedTo:   r[14]?cleanNum(r[14]):null,
      };
      // Campos de gasto diferido (columnas 15-18), solo si vienen con datos
      if(r[15]){
        obj.deferGroup   = cleanNum(r[15]);
        obj.deferIndex   = r[16]?Number(r[16]):1;
        obj.deferTotal   = r[17]?Number(r[17]):1;
        obj.deferOriginal= r[18]?Number(r[18]):obj.amount;
      }
      return obj;
    }).sort((a,b)=>b.id-a.id);

    // ── FUSIÓN SEGURA (en vez de reemplazo a ciegas) ──
    // Si hay registros guardados hace instantes que Sheets todavía no refleja,
    // conservarlos. De lo contrario "desaparecerían" al recargar (bug reportado:
    // guardas, vas al historial y no está).
    const idsFromSheets = new Set(newData.map(e=>String(e.id)));
    const rescatados = data.filter(e=>{
      const id=String(e.id);
      if(idsFromSheets.has(id)) return false;      // ya vino de Sheets, no duplicar
      if(_pendingDeletes.has(id)) return false;    // se está borrando: no revivirlo
      return _pendingSaves.has(id);                // en vuelo: conservarlo
    });
    // Quitar de lo recibido lo que se está borrando ahora mismo (evita que reaparezca)
    const depurado = newData.filter(e=>!_pendingDeletes.has(String(e.id)));
    const merged = [...rescatados, ...depurado].sort((a,b)=>b.id-a.id);

    // Detectar si los datos realmente cambiaron respecto a lo que ya se muestra.
    // Comparamos solo los campos relevantes normalizados, para evitar falsos
    // positivos (orden de propiedades, number vs string) que causan parpadeo.
    const norm = arr => JSON.stringify(arr.map(e=>({
      id:Number(e.id),
      date:String(e.date).slice(0,10),
      type:e.type||'',
      category:e.category||'',
      subcategory:e.subcategory||'',
      desc:e.desc||'',
      amount:Number(e.amount)||0,
      currency:e.currency||'MXN',
      amountMXN:Number(e.amountMXN)||0,
      method:e.method||null,
      note:e.note||'',
      linkedTo:e.linkedTo?Number(e.linkedTo):null,
      deferGroup:e.deferGroup?Number(e.deferGroup):null,
      deferIndex:e.deferIndex?Number(e.deferIndex):null,
      deferTotal:e.deferTotal?Number(e.deferTotal):null,
      deferOriginal:e.deferOriginal?Number(e.deferOriginal):null
    })).sort((a,b)=>b.id-a.id));
    const changed = norm(merged) !== norm(data);
    data = merged;
    localStorage.setItem(SK, JSON.stringify(data));

    // Sincronizar emojis personalizados desde Sheets (fuente de verdad entre dispositivos)
    let emojisChanged=false;
    if(json.emojis && typeof json.emojis==='object'){
      const before=JSON.stringify(merchantEmojis);
      const after=JSON.stringify(json.emojis);
      if(before!==after){
        merchantEmojis = json.emojis;
        try { localStorage.setItem('merchantEmojis', JSON.stringify(merchantEmojis)); } catch(e){}
        emojisChanged=true;
      }
    }

    if(changed || emojisChanged){
      populateSelectors();
      renderBalance();
      renderHistorial(); // sin animación: es una actualización, no una entrada nueva
    }
  } catch(e) {
    hideSyncing();
    console.warn('Sheets load failed, using local cache', e);
  }
}

function save() { localStorage.setItem(SK, JSON.stringify(data)); }

function changeMonth(d){
  viewMonth+=d;
  if(viewMonth<0){viewMonth=11;viewYear--;}
  if(viewMonth>11){viewMonth=0;viewYear++;}
  populateSelectors();
  renderBalance();
}
function monthData(){
  return data.filter(e=>{
    if(isFutureEntry(e)) return false; // no sumar mensualidades futuras
    const d=parseDate(e.date);
    return d.getMonth()===viewMonth&&d.getFullYear()===viewYear;
  });
}

let balView = null;

function clearBalView(){
  balView=null;
  document.querySelectorAll('#page-balance .grid2 .stat').forEach(s=>s.classList.remove('active-filter'));
  document.getElementById('dash-detail-lbl').style.display='none';
  document.getElementById('dash-cats').innerHTML='';
  const bonoDetail=document.getElementById('bono-detail-row');
  if(bonoDetail) bonoDetail.style.display='none';
  const bonoStat=document.getElementById('bono-stat');
  if(bonoStat) bonoStat.classList.remove('active-filter');
}

function setBalView(type, el) {
  if(balView===type){ clearBalView(); return; }
  balView=type;
  document.querySelectorAll('#page-balance .grid2 .stat').forEach(s=>s.classList.remove('active-filter'));
  // Cerrar detalle del bono al abrir cualquier otra vista
  const bonoDetail=document.getElementById('bono-detail-row');
  if(bonoDetail) bonoDetail.style.display='none';
  const bonoStat=document.getElementById('bono-stat');
  if(bonoStat) bonoStat.classList.remove('active-filter');
  if(el) el.classList.add('active-filter');
  renderBalanceCats(true);
}
