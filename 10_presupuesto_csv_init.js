// ════════════════════════════════════════════
// PRESUPUESTO
// ════════════════════════════════════════════

// ══════════════════════════════════════
// BUDGET (continued below)
// ══════════════════════════════════════
const SK_BUDGET = 'finanzas_budget';
let budgets = JSON.parse(localStorage.getItem(SK_BUDGET)||'{}');

let _idCounter = 0;
function genId(){ return Date.now() * 1000 + (++_idCounter % 1000); }

function getBudgetKey(y,m){ return `${y}-${String(m+1).padStart(2,'0')}`; }

function toggleBudTotalEdit(show){
  document.getElementById('bud-total-display').style.display = show ? 'none' : 'flex';
  const editRow = document.getElementById('bud-total-edit');
  editRow.style.display = show ? 'flex' : 'none';
  if(show) document.getElementById('bud-total-mes').focus();
}

function saveBudTotalInline(){
  const mSel=document.getElementById('bud-month-sel');
  const ySel=document.getElementById('bud-year-sel');
  const m=parseInt(mSel.value), yr=parseInt(ySel.value);
  const key=getBudgetKey(yr,m);
  if(!budgets[key]) budgets[key]={};
  const val=parseFloat(document.getElementById('bud-total-mes').value)||0;
  if(val>0) budgets[key]['__total__']=val;
  else delete budgets[key]['__total__'];
  localStorage.setItem(SK_BUDGET,JSON.stringify(budgets));
  updateBudTotalDisplay(val);
  toggleBudTotalEdit(false);
  validateBudgetLive();
  renderBalance();
  toast('Presupuesto del mes guardado');
}

function updateBudTotalDisplay(val){
  const el=document.getElementById('bud-total-display-val');
  if(!el) return;
  el.textContent = val>0 ? fmt(val) : 'Sin limite';
  el.style.color = val>0 ? 'var(--accent)' : 'var(--text3)';
}

function getBudgetForMonth(y,m){
  const key=getBudgetKey(y,m);
  if(budgets[key]) return budgets[key];
  let pm=m-1, py=y;
  if(pm<0){ pm=11; py--; }
  const prevKey=getBudgetKey(py,pm);
  return budgets[prevKey]||{};
}

function saveBudgetField(key){
  const mSel=document.getElementById('bud-month-sel');
  const ySel=document.getElementById('bud-year-sel');
  const m=parseInt(mSel.value), yr=parseInt(ySel.value);
  const budKey=getBudgetKey(yr,m);
  if(!budgets[budKey]) budgets[budKey]={};
  const inp=document.querySelector(`#budget-list input[data-key="${key}"]`);
  const val=parseFloat(inp?.value)||0;
  if(val>0) budgets[budKey][key]=val;
  else delete budgets[budKey][key];
  localStorage.setItem(SK_BUDGET,JSON.stringify(budgets));
  toast('✓ Guardado');
  validateBudgetLive();
  renderBalance();
}

function validateBudgetLive(){
  const mSel=document.getElementById('bud-month-sel');
  const ySel=document.getElementById('bud-year-sel');
  if(!mSel||!ySel) return;

  const totalMesEl=document.getElementById('bud-total-mes');
  const totalMes=parseFloat(totalMesEl?.value)||0;

  // Read all current input values
  const currentVals={};
  document.querySelectorAll('#budget-list input[data-key]').forEach(inp=>{
    const v=parseFloat(inp.value)||0;
    currentVals[inp.dataset.key]=v;
  });

  let anyError=false;

  // Validate each category vs its subcategories
  Object.keys(CATS.egreso).forEach(cat=>{
    const catLimit=currentVals[cat]||0;
    const catInput=document.querySelector(`#budget-list input[data-key="${cat}"]`);
    const subcatEntries=Object.entries(currentVals).filter(([k])=>k.startsWith(cat+':'));
    const subcatTotal=subcatEntries.reduce((s,[,v])=>s+v,0);
    const catOver=catLimit>0&&subcatTotal>catLimit;
    if(catInput) catInput.style.borderColor=catOver?'var(--danger)':'var(--border2)';
    subcatEntries.forEach(([k])=>{
      const inp=document.querySelector(`#budget-list input[data-key="${k}"]`);
      if(inp) inp.style.borderColor=catOver?'var(--danger)':'var(--border2)';
    });
    if(catOver) anyError=true;
  });

  // Validate category sum vs monthly total
  const catSum=Object.entries(currentVals).filter(([k])=>!k.includes(':')&&k!=='__total__').reduce((s,[,v])=>s+v,0);
  const totalUsedEl=document.getElementById('bud-total-used');
  if(totalMes>0){
    const over=catSum>totalMes;
    if(totalMesEl) totalMesEl.style.borderColor=over?'var(--danger)':'var(--border2)';
    if(totalUsedEl){
      totalUsedEl.textContent=`${fmt(catSum)} / ${fmt(totalMes)}`;
      totalUsedEl.style.color=over?'var(--danger)':'var(--text3)';
    }
    if(over) anyError=true;
  } else {
    if(totalMesEl) totalMesEl.style.borderColor='var(--border2)';
    if(totalUsedEl) totalUsedEl.textContent=catSum>0?fmt(catSum):'';
  }
}

function renderBudget(){
  const mSel=document.getElementById('bud-month-sel');
  const ySel=document.getElementById('bud-year-sel');
  if(!mSel||!ySel) return;
  const m=parseInt(mSel.value), yr=parseInt(ySel.value);
  const bud=getBudgetForMonth(yr,m);

  // Populate monthly total field
  const totalMesEl=document.getElementById('bud-total-mes');
  if(totalMesEl) totalMesEl.value=bud['__total__']||'';
  updateBudTotalDisplay(bud['__total__']||0);
  toggleBudTotalEdit(false);

  const md=data.filter(e=>{
    const d=parseDate(e.date);
    return d.getMonth()===m&&d.getFullYear()===yr&&e.type==='egreso';
  });
  const list=document.getElementById('budget-list');
  list.innerHTML='';
  Object.entries(CATS.egreso).forEach(([cat,subcats])=>{
    const color=catColor(cat);
    const catSpent=md.filter(e=>e.category===cat).reduce((s,e)=>s+e.amountMXN,0);
    const catBud=bud[cat]||0;
    const row=document.createElement('div');
    row.className='bud-cat-row';
    row.style.position='relative';
    const pct=catBud>0?Math.min((catSpent/catBud)*100,100):0;
    const over=catBud>0&&catSpent>catBud;
    const barColor=over?'var(--danger)':color;
    row.innerHTML=`
      <div class="bud-cat-hdr">
        <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${color}"></div>
        <span style="font-size:17px;width:28px;text-align:center;margin-left:6px">${ICONS[cat]||'📌'}</span>
        <div style="flex:1;font-size:14px;font-weight:500;color:var(--text)">${cat}</div>
        ${catBud>0?`<div style="font-size:12px;color:${over?'var(--danger)':'var(--text3)'};">${fmt(catSpent)} / ${fmt(catBud)}</div>`:''}
        <span class="cat-expand-chevron" style="margin-left:8px">›</span>
      </div>
      ${catBud>0?`<div style="padding:0 14px 8px"><div class="bud-progress-wrap"><div class="bud-progress-bar" style="width:${pct}%;background:${barColor}"></div></div><div class="bud-label-row"><span>${fmt(catSpent)} gastado</span><span>${pct.toFixed(0)}%</span></div></div>`:''}`;
    const body=document.createElement('div');
    body.className='bud-cat-body';
    const catField=document.createElement('div');
    catField.className='bud-field';
    const catInpId=`bud-inp-${cat.replace(/\s/g,'_')}`;
    catField.innerHTML=`<label>${cat} — presupuesto total</label>
      <div style="display:flex;gap:6px;align-items:center;">
        <input type="number" id="${catInpId}" placeholder="Sin límite" inputmode="decimal" min="0" data-key="${cat}" value="${catBud||''}" oninput="validateBudgetLive()" style="flex:1;padding:9px 12px;border:1px solid var(--border2);border-radius:var(--radius-sm);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
        <button onclick="saveBudgetField('${cat}')" style="padding:7px 12px;border-radius:var(--radius-sm);border:none;background:var(--accent);color:white;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;">✓</button>
      </div>`;
    body.appendChild(catField);
    subcats.filter(s=>s!=='—').forEach(sub=>{
      const subBud=bud[`${cat}:${sub}`]||0;
      const subSpent=md.filter(e=>e.category===cat&&e.subcategory===sub).reduce((s,e)=>s+e.amountMXN,0);
      const sf=document.createElement('div');
      sf.className='bud-field';
      const subKey=`${cat}:${sub}`;
      sf.innerHTML=`
        <label style="display:flex;justify-content:space-between">
          <span>${sub}</span>
          ${subBud>0?`<span style="font-weight:400;color:var(--text3)">${fmt(subSpent)} gastado</span>`:''}
        </label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="number" placeholder="Sin límite" inputmode="decimal" min="0" data-key="${subKey}" value="${subBud||''}" oninput="validateBudgetLive()" style="flex:1;padding:9px 12px;border:1px solid var(--border2);border-radius:var(--radius-sm);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;outline:none;">
          <button onclick="saveBudgetField('${subKey}')" style="padding:7px 12px;border-radius:var(--radius-sm);border:none;background:var(--accent);color:white;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;">✓</button>
        </div>`;
      body.appendChild(sf);
    });
    row.appendChild(body);
    row.querySelector('.bud-cat-hdr').onclick=()=>row.classList.toggle('open');
    list.appendChild(row);
  });
  validateBudgetLive();
}

function saveBudget(){
  const mSel=document.getElementById('bud-month-sel');
  const ySel=document.getElementById('bud-year-sel');
  const m=parseInt(mSel.value), yr=parseInt(ySel.value);
  const key=getBudgetKey(yr,m);
  const newBud={};
  // Save monthly total
  const totalMes=parseFloat(document.getElementById('bud-total-mes')?.value)||0;
  if(totalMes>0) newBud['__total__']=totalMes;
  document.querySelectorAll('#budget-list input[data-key]').forEach(inp=>{
    const val=parseFloat(inp.value);
    if(val>0) newBud[inp.dataset.key]=val;
  });
  // Validate subcats vs category
  const errors=[];
  Object.keys(CATS.egreso).forEach(cat=>{
    const catLimit=newBud[cat];
    if(!catLimit) return;
    const subcatTotal=Object.entries(newBud).filter(([k])=>k.startsWith(cat+':')).reduce((s,[,v])=>s+v,0);
    if(subcatTotal>catLimit) errors.push(`${cat}: subcategorías (${fmt(subcatTotal)}) superan el límite de ${fmt(catLimit)}`);
  });
  // Validate category sum vs monthly total
  if(totalMes>0){
    const catSum=Object.entries(newBud).filter(([k])=>!k.includes(':')&&k!=='__total__').reduce((s,[,v])=>s+v,0);
    if(catSum>totalMes) errors.push(`Categorías suman ${fmt(catSum)}, supera el total del mes ${fmt(totalMes)}`);
  }
  if(errors.length>0){ toast('⚠️ '+errors[0]); return; }
  budgets[key]=newBud;
  localStorage.setItem(SK_BUDGET,JSON.stringify(budgets));
  toast('✓ Presupuesto guardado');
  renderBalance();
}


// ════════════════════════════════════════════
// EXPORTAR CSV E INICIALIZACIÓN
// ════════════════════════════════════════════

// ══════════════════════════════════════
// CSV EXPORT
// ══════════════════════════════════════
function exportCSV(){
  // Exporta EXACTAMENTE lo que el historial está mostrando (con todos los
  // filtros aplicados: fecha/rango, búsqueda, tipo, categorías, método).
  const rows=(typeof lastFilteredEntries!=='undefined' && Array.isArray(lastFilteredEntries))
    ? lastFilteredEntries : [];
  if(rows.length===0){
    toast('No hay registros que exportar');
    return;
  }
  const headers=['ID','Fecha','Tipo','Categoría','Subcategoría','Descripción','Monto original','Moneda','Monto MXN','Método de pago','Nota'];
  const escape=v=>`"${String(v||'').replace(/"/g,'""')}"`;
  const csv=[headers.join(','),...rows.map(e=>[e.id,e.date,e.type,e.category,e.subcategory||'',escape(e.desc),e.amount,e.currency,e.amountMXN,e.method||'',escape(e.note)].join(','))].join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;

  // Nombre del archivo según el modo activo
  let fname;
  const searchEl=document.getElementById('hist-search');
  const sq=(searchEl?.value||'').trim();
  if(histRangeMode && histRangeApplied){
    const from=document.getElementById('hist-range-from')?.value||'';
    const to=document.getElementById('hist-range-to')?.value||'';
    fname=`tomin_${from}_a_${to}.csv`;
  } else if(sq){
    const slug=sq.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,30);
    fname=`tomin_busqueda_${slug||'resultados'}.csv`;
  } else {
    const mSel=document.getElementById('hist-month-sel');
    const ySel=document.getElementById('hist-year-sel');
    const selMonth=mSel?parseInt(mSel.value):new Date().getMonth();
    const selYear=ySel?parseInt(ySel.value):new Date().getFullYear();
    fname=`tomin_${MONTHS_ES[selMonth]}_${selYear}.csv`;
  }
  a.download=fname;
  a.click(); URL.revokeObjectURL(url);
  toast(`✓ CSV descargado (${rows.length} registros)`);
}

init();
