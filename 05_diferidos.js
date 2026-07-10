// ══════════════════════════════════════
// DIFERIR (repartir un gasto en N mensualidades)
// ══════════════════════════════════════
const DIFERIR_PRESETS=[3,6,12,24];
let _diferirVisible=false;   // panel abierto
let diferirMonths=0;         // 0 = sin selección; >0 = meses elegidos
let diferirCustom=false;     // si el valor viene del campo personalizado

function diferirHasData(){ return diferirMonths>0; }

// Abrir/cerrar el panel de Diferir
function inlineToggleDiferir(){
  if(_diferirVisible){
    // Cerrar el panel. Si no hay data, reaparecen Propina/Beneficio.
    _diferirVisible=false;
    document.getElementById('diferir-panel').style.display='none';
    updateInlineBtn('inline-diferir-btn', diferirHasData(), diferirHasData());
    if(!diferirHasData()){
      showPropinaBenButtons(); // fade in de Propina/Beneficio
    }
  } else {
    // Abrir el panel. Propina/Beneficio hacen fade out de inmediato.
    _diferirVisible=true;
    // Cerrar propina/beneficio si estaban abiertos
    _propinaVisible=false; _benVisible=false;
    document.getElementById('propina-panel').style.display='none';
    document.getElementById('ben-panel').style.display='none';
    const dpanel=document.getElementById('diferir-panel');
    dpanel.style.display='block';
    revealAnimate(dpanel);
    updateInlineBtn('inline-diferir-btn', true, false);
    hidePropinaBenButtons(); // fade out de Propina/Beneficio
    renderDiferirPresets();
    renderDiferirPreview();
    // También ocultar Desglose abajo (solo queda Nota)
    updateDesgloseButtonForDiferir();
  }
}

// Crossfade: los 3 botones salen y el botón "Diferir" completo entra (con micro-scale).
function hidePropinaBenButtons(){
  const row=document.getElementById('inline-row-main');
  const full=document.getElementById('inline-diferir-full');
  if(!row || !full) return;
  row.getAnimations().forEach(a=>a.cancel());
  full.getAnimations().forEach(a=>a.cancel());
  // Los 3 botones se desvanecen
  row.animate([{opacity:1},{opacity:0}],{duration:220,easing:'cubic-bezier(0.4,0,0.2,1)',fill:'forwards'});
  row.style.pointerEvents='none';
  // El botón completo entra con micro-scale
  full.style.pointerEvents='auto';
  full.animate([
    {opacity:0,transform:'scale(0.98)'},
    {opacity:1,transform:'scale(1)'}
  ],{duration:220,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'forwards'});
}

// Crossfade inverso: el botón completo sale y los 3 botones reaparecen.
function showPropinaBenButtons(){
  const row=document.getElementById('inline-row-main');
  const full=document.getElementById('inline-diferir-full');
  if(row && full){
    row.getAnimations().forEach(a=>a.cancel());
    full.getAnimations().forEach(a=>a.cancel());
    // El botón completo se desvanece
    full.animate([
      {opacity:1,transform:'scale(1)'},
      {opacity:0,transform:'scale(0.98)'}
    ],{duration:220,easing:'cubic-bezier(0.4,0,0.2,1)',fill:'forwards'});
    full.style.pointerEvents='none';
    // Los 3 botones reaparecen
    row.style.pointerEvents='auto';
    row.animate([{opacity:0},{opacity:1}],{duration:220,easing:'cubic-bezier(0.22,0.61,0.36,1)',fill:'forwards'});
  }
  // Restaurar el botón Desglose abajo (si el tipo es egreso)
  updateDesgloseButtonForDiferir();
}

// Renderiza los presets de meses (toggles individuales)
function renderDiferirPresets(){
  const cont=document.getElementById('diferir-presets');
  if(!cont) return;
  cont.innerHTML='';
  DIFERIR_PRESETS.forEach(p=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='month-preset'+(!diferirCustom && diferirMonths===p?' on':'');
    b.textContent=p+'m';
    b.onclick=()=>toggleDiferirPreset(p);
    cont.appendChild(b);
  });
}

// Alterna un preset: si ya estaba activo, lo desactiva (vuelve a 0)
function toggleDiferirPreset(p){
  if(!diferirCustom && diferirMonths===p){
    diferirMonths=0; // desactivar
  } else {
    diferirMonths=p;
    diferirCustom=false;
    const ci=document.getElementById('diferir-custom');
    if(ci) ci.value='';
  }
  renderDiferirPresets();
  renderDiferirPreview();
  updateInlineBtn('inline-diferir-btn', true, diferirHasData());
}

function onDiferirCustomInput(){
  const v=parseInt(document.getElementById('diferir-custom').value);
  if(v && v>=2){
    diferirMonths=v;
    // Si el número coincide con un preset, activar ese preset (no marcar como custom)
    diferirCustom = !DIFERIR_PRESETS.includes(v);
  } else {
    diferirMonths=0;
    diferirCustom=false;
  }
  renderDiferirPresets();
  renderDiferirPreview();
  updateInlineBtn('inline-diferir-btn', true, diferirHasData());
}

// Quita el diferido por completo (vuelve a cero y reaparecen Propina/Beneficio/Desglose)
function clearDiferir(){
  diferirMonths=0;
  diferirCustom=false;
  const ci=document.getElementById('diferir-custom');
  if(ci) ci.value='';
  _diferirVisible=false;
  document.getElementById('diferir-panel').style.display='none';
  updateInlineBtn('inline-diferir-btn', false, false);
  showPropinaBenButtons();
  updateDesgloseButtonForDiferir();
}

// Vista previa en vivo: monto por mes + rango de fechas + día de corte
function renderDiferirPreview(){
  const prev=document.getElementById('diferir-preview');
  const clearBtn=document.getElementById('diferir-clear-btn');
  if(!prev) return;
  if(!diferirHasData()){
    prev.style.display='none';
    if(clearBtn) clearBtn.style.display='none';
    return;
  }
  const amount=parseFloat(rawAmount(document.getElementById('amount').value))||0;
  const perMonth=Math.floor((amount/diferirMonths)*100)/100;
  const base=parseDate(document.getElementById('tx-date').value)||new Date();
  const start=diferirMonthlyDate(base,0);
  const end=diferirMonthlyDate(base,diferirMonths-1);
  const startLbl=`${MONTHS_ES[start.getMonth()].slice(0,3)} ${start.getFullYear()}`;
  const endLbl=`${MONTHS_ES[end.getMonth()].slice(0,3)} ${end.getFullYear()}`;
  prev.style.display='block';
  prev.innerHTML=`
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:var(--accent);margin-bottom:3px;">${fmt(perMonth)} <span style="font-size:13px;font-weight:500;color:var(--text3);">/ mes</span></div>
    <div style="font-size:12.5px;color:var(--text2);margin-bottom:2px;">Durante <b>${diferirMonths} meses</b> · ${startLbl} – ${endLbl}</div>
    <div style="font-size:11.5px;color:var(--text3);">Cada día ${base.getDate()} de cada mes</div>
  `;
  if(clearBtn) clearBtn.style.display='block';
}

// Fecha de la mensualidad i (0-based), anclando al día original; si el mes no
// tiene ese día, usa el último día del mes (regla tipo iCal, como Apple).
function diferirMonthlyDate(base, i){
  const day=base.getDate();
  const y=base.getFullYear();
  const m=base.getMonth()+i;
  const targetY=y+Math.floor(m/12);
  const targetM=((m%12)+12)%12;
  const lastDay=new Date(targetY, targetM+1, 0).getDate();
  const d=Math.min(day, lastDay);
  return new Date(targetY, targetM, d);
}

// Oculta/muestra el botón Desglose según el estado de Diferir (Diferir abierto → sin Desglose)
function updateDesgloseButtonForDiferir(){
  const desgBtn=document.getElementById('desglose-toggle-btn');
  const noteBtn=document.getElementById('note-toggle-btn');
  if(!desgBtn || !noteBtn) return;
  if(_diferirVisible || diferirHasData()){
    // Cerrar desglose si estaba abierto
    if(_desgloseVisible){
      _desgloseVisible=false;
      const sec=document.getElementById('desglose-section');
      if(sec) sec.style.display='none';
    }
    desgloses=[];
    desgBtn.style.display='none';
    noteBtn.style.flex='1 1 100%';
  } else if(curType==='egreso'){
    desgBtn.style.display='';
    noteBtn.style.flex='';
  }
  updateNoteMode();
}


// Close panels on outside click
document.addEventListener('click', function(ev){
  const inlineWrap=document.getElementById('inline-toggles');
  if(!inlineWrap||!inlineWrap.contains(ev.target)) return;
  // Click is inside inline-toggles but outside both panels and buttons — no action needed
  // Panels close via button clicks only or outside the card
}, true);

document.addEventListener('click', function(ev){
  if(!document.getElementById('inline-toggles')) return;
  const card=document.querySelector('#page-registro .card');
  // Si el target ya fue removido del DOM (p.ej. al re-renderizar los tipos de
  // beneficio), no lo tratamos como "clic afuera": lo ignoramos.
  if(!document.contains(ev.target)) return;
  if(card&&!card.contains(ev.target)){
    if(_propinaVisible){
      _propinaVisible=false;
      const pp=document.getElementById('propina-panel');
      if(pp) pp.style.display='none';
      updateInlineBtn('inline-propina-btn', false, propinaHasData());
    }
    if(_benVisible){
      _benVisible=false;
      const bp=document.getElementById('ben-panel');
      if(bp) bp.style.display='none';
      updateInlineBtn('inline-ben-btn', false, benHasData());
    }
  }
});

let curAhorroSubType = 'ahorro'; // 'ahorro' | 'ahorro-pasivo'

function setAhorroType(){
  setType(curAhorroSubType);
  const wrap=document.getElementById('ahorro-sub-toggle');
  if(wrap) wrap.style.display='block';
  // Ensure correct button states
  setAhorroSubType(curAhorroSubType);
}

function setAhorroSubType(t){
  curAhorroSubType=t;
  setType(t);
  const activoBtn=document.getElementById('ahorro-sub-activo');
  const pasivoBtn=document.getElementById('ahorro-sub-pasivo');
  if(activoBtn){ activoBtn.style.background=t==='ahorro'?'var(--blue)':'var(--surface2)'; activoBtn.style.color=t==='ahorro'?'white':'var(--text3)'; }
  if(pasivoBtn){ pasivoBtn.style.background=t==='ahorro-pasivo'?'#af52de':'var(--surface2)'; pasivoBtn.style.color=t==='ahorro-pasivo'?'white':'var(--text3)'; }
  const mainBtn=document.getElementById('type-btn-ahorro');
  const lbl=document.getElementById('ahorro-type-lbl');
  if(lbl) lbl.textContent=t==='ahorro'?'Ahorro':'Beneficio';
  if(mainBtn){ mainBtn.className='type-btn active '+(t==='ahorro'?'t-ahorro':'t-pasivo'); mainBtn.querySelector('.icon').textContent=t==='ahorro'?'◎':'★'; }
}

function selectCat(cat) {
  const container=document.getElementById('cat-blocks');
  const wasAllShowing = !curCat; // estaban todas visibles
  if(curCat===cat){
    // Tocar la categoría ya elegida → re-expandir (mostrar todas)
    curCat=''; curSubcat='';
    renderCatUI();
  } else {
    // Al elegir una categoría desde la vista de todas: animar salida inversa, luego colapsar
    if(wasAllShowing && container && container.children.length>1){
      collapseGridReverse(container, 2, ()=>{
        curCat=cat; curSubcat='';
        renderCatUI();
      });
    } else {
      curCat=cat; curSubcat='';
      renderCatUI();
    }
  }
}

function selectSubcat(sub) {
  const container=document.getElementById('cat-blocks');
  if(curSubcat===sub){
    // Tocar la subcategoría ya elegida → re-mostrar las demás
    curSubcat='';
    renderCatUI();
  } else {
    // Al elegir subcategoría: animar salida inversa de las subcats, luego colapsar
    const right=container?container.querySelector('.cat-col-right'):null;
    if(right && right.children.length>1){
      collapseGridReverse(right, 1, ()=>{
        curSubcat=sub;
        renderCatUI();
      });
    } else {
      curSubcat=sub;
      renderCatUI();
    }
  }
}

function predictCategory(){
  const desc = document.getElementById('desc').value.trim().toLowerCase();
  if(desc.length < 3) return;
  // Funciona para egreso, ingreso y beneficio (ahorro-pasivo)
  if(curType !== 'egreso' && curType !== 'ingreso' && curType !== 'ahorro-pasivo') return;

  // Ponderación por recencia: el año se parte en 4 cuartos de ~91 días.
  // Los registros más recientes pesan más. Nada más viejo de 365 días cuenta.
  // Pesos por cuarto: 0-91d → 4, 92-182d → 3, 183-273d → 2, 274-365d → 1.
  const MS_PER_DAY = 86400000;
  const now = Date.now();
  function recencyWeight(dateStr){
    const t = parseDate(dateStr).getTime();
    const days = (now - t) / MS_PER_DAY;
    if(days < 0)   return 4; // fecha futura → tratar como más reciente
    if(days <= 91)  return 4;
    if(days <= 182) return 3;
    if(days <= 273) return 2;
    if(days <= 365) return 1;
    return 0; // más de 365 días → no cuenta
  }

  // Contar frecuencia PONDERADA de cat+subcat Y de método en registros del MISMO tipo
  // con descripción similar, dando más peso a los registros recientes.
  const freq = {};
  const methodFreq = {};
  data.forEach(e => {
    if(e.type !== curType) return;
    // Ignorar hijos vinculados (desgloses/propina/beneficio) para no sesgar
    if(e.linkedTo) return;
    const d = (e.desc || '').toLowerCase();
    if(d.length < 2) return;
    // Coincide si la descripción histórica contiene lo escrito, o lo escrito contiene la histórica
    if(d.includes(desc) || desc.includes(d)){
      const w = recencyWeight(e.date);
      if(w === 0) return; // fuera de la ventana de 365 días
      const key = (e.category || '') + '||' + (e.subcategory || '');
      freq[key] = (freq[key] || 0) + w;
      // Frecuencia ponderada de método de pago para descripciones similares
      if(e.method){
        methodFreq[e.method] = (methodFreq[e.method] || 0) + w;
      }
    }
  });

  // ── Predecir método de pago (el más frecuente para descripciones similares) ──
  const methodEntries = Object.entries(methodFreq);
  if(methodEntries.length > 0 && curType !== 'ahorro-pasivo'){
    const [bestMethod] = methodEntries.sort((a,b)=>b[1]-a[1])[0];
    if(bestMethod && bestMethod !== selMethod){
      selMethod = bestMethod;
      // Actualizar el chip visual del método
      document.querySelectorAll('#method-field .chip').forEach(c=>{
        if(!c) return;
        c.classList.remove('active');
        // El texto del chip puede diferir del valor (ej. "Crédito" vs "Tarjeta de crédito")
        const chipMethod = c.getAttribute('data-method');
        if(chipMethod === bestMethod) c.classList.add('active');
      });
    }
  }

  const entries = Object.entries(freq);
  if(entries.length === 0) return;

  const [bestKey] = entries.sort((a,b) => b[1] - a[1])[0];
  const sep = bestKey.indexOf('||');
  const bestCat = bestKey.substring(0, sep);
  const bestSub = bestKey.substring(sep + 2);
  if(!bestCat) return;
  // No hacer nada si ya está seleccionado lo mismo
  if(curCat === bestCat && curSubcat === bestSub) return;

  // Preseleccionar categoría y subcategoría directamente
  curCat = bestCat;
  const subs = sortedSubcats(curType, bestCat);
  const hasSubs = subs && !(subs.length===1 && subs[0]==='—');
  curSubcat = (hasSubs && bestSub && subs.includes(bestSub)) ? bestSub : '';
  renderCatUI();
}

function setMethod(m,el){
  selMethod=m;
  document.querySelectorAll('#method-field .chip').forEach(c=>c&&c.classList.remove('active'));
  if(el) el.classList.add('active');
}

const BEN_TYPES = ['Cashback','Puntos de lealtad','Puntos TDC','Millas aéreas','Descuentos y promociones','Otros beneficios'];

// ── Estado del beneficio en edición (espejo del registro) ──
let editBenType_mode = 'monto'; // 'pct' | 'monto'

function setEditBenType(t){
  editBenType_mode=t;
  const pctBtn=document.getElementById('e-ben-chip-pct');
  const montoBtn=document.getElementById('e-ben-chip-monto');
  const pctInput=document.getElementById('e-ben-pct');
  const montoInput=document.getElementById('e-ben-amount');
  if(pctBtn){ pctBtn.style.background=t==='pct'?'var(--accent)':'transparent'; pctBtn.style.color=t==='pct'?'white':'var(--text3)'; }
  if(montoBtn){ montoBtn.style.background=t==='monto'?'var(--accent)':'transparent'; montoBtn.style.color=t==='monto'?'white':'var(--text3)'; }
  if(pctInput) pctInput.style.display=t==='pct'?'':'none';
  if(montoInput) montoInput.style.display=t==='monto'?'':'none';
  calcEditBenPreview();
}

function getEditBenAmount(){
  if(!editBenOn) return 0;
  if(editBenType_mode==='monto') return parseFloat(rawAmount(document.getElementById('e-ben-amount').value))||0;
  const pct=parseFloat(document.getElementById('e-ben-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  return +(amount * pct / 100).toFixed(2);
}

function calcEditBenPreview(){
  const calcEl=document.getElementById('e-ben-calc');
  if(!calcEl) return;
  const cur=document.getElementById('e-currency').value;
  const sym=cur==='MXN'?'$':`${cur} `;
  if(editBenType_mode==='monto'){
    const benVal=parseFloat(rawAmount(document.getElementById('e-ben-amount').value))||0;
    if(cur!=='MXN' && benVal>0){
      calcEl.textContent=`= $${toMXN(benVal,cur).toFixed(2)} MXN`;
    } else { calcEl.textContent=''; }
    return;
  }
  const pct=parseFloat(document.getElementById('e-ben-pct').value)||0;
  const amount=parseFloat(rawAmount(document.getElementById('e-amount').value))||0;
  if(pct>0 && amount>0){
    calcEl.textContent=`= ${sym}${(amount*pct/100).toFixed(2)}`;
  } else { calcEl.textContent=''; }
}


// Unificar: las categorías de ahorro pasivo SON los tipos de beneficio.
// Así coinciden sin importar si se registra dentro de un gasto o por separado.
BEN_TYPES.forEach(t=>{ CATS['ahorro-pasivo'][t]=['—']; });
let curBenType = 'Cashback';
let editBenType = 'Cashback';
