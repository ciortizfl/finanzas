// ══════════════════════════════════════
// ANNUAL VIEW
// ══════════════════════════════════════
let balPeriod='monthly';
let annualSelMonth=null;

function setBalPeriod(period){
  balPeriod=period;
  document.getElementById('bal-monthly-view').style.display=period==='monthly'?'block':'none';
  document.getElementById('bal-annual-view').style.display=period==='annual'?'block':'none';
  const btnM=document.getElementById('bal-view-monthly');
  const btnA=document.getElementById('bal-view-annual');
  btnM.style.background=period==='monthly'?'var(--accent)':'var(--surface2)';
  btnM.style.color=period==='monthly'?'white':'var(--text2)';
  btnA.style.background=period==='annual'?'var(--accent)':'var(--surface2)';
  btnA.style.color=period==='annual'?'white':'var(--text2)';
  if(period==='annual'){ populateAnnualYear(); renderAnnual(); }
}

function populateAnnualYear(){
  const sel=document.getElementById('bal-annual-year-sel');
  if(!sel) return;
  const years=yearsInData();
  sel.innerHTML=years.map(y=>`<option value="${y}"${y===viewYear?' selected':''}>${y}</option>`).join('');
}

// Series visibles en la gráfica anual (se togglean con las leyendas)
let chartSeriesVisible = { ingreso:true, egreso:true, 'ahorro-pasivo':true };

function toggleChartSeries(type){
  // Forzar mínimo una serie activa
  const activeCount = Object.values(chartSeriesVisible).filter(Boolean).length;
  if(chartSeriesVisible[type] && activeCount<=1) return; // no desactivar la última
  chartSeriesVisible[type] = !chartSeriesVisible[type];
  updateLegendStyles();
  renderAnnual();
}

function updateLegendStyles(){
  [['ingreso','legend-ingreso'],['egreso','legend-egreso'],['ahorro-pasivo','legend-ahorro-pasivo']].forEach(([type,id])=>{
    const el=document.getElementById(id);
    if(el) el.style.opacity = chartSeriesVisible[type] ? '1' : '0.35';
  });
}

function renderAnnual(){
  const sel=document.getElementById('bal-annual-year-sel');
  if(!sel) return;
  const yr=parseInt(sel.value);
  const canvas=document.getElementById('annual-canvas');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const W=canvas.parentElement.clientWidth-32||300;
  canvas.width=W; canvas.height=200;
  ctx.clearRect(0,0,W,200);

  const ingData=Array.from({length:12},(_,m)=>sum(data.filter(e=>{if(isFutureEntry(e))return false;const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;}),'ingreso'));
  const egrData=Array.from({length:12},(_,m)=>sum(data.filter(e=>{if(isFutureEntry(e))return false;const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;}),'egreso'));
  const benData=Array.from({length:12},(_,m)=>sum(data.filter(e=>{if(isFutureEntry(e))return false;const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;}),'ahorro-pasivo'));

  // ── Resumen anual hasta la fecha ──
  const totalIng=ingData.reduce((s,v)=>s+v,0);
  const totalEgr=egrData.reduce((s,v)=>s+v,0);
  const totalBen=benData.reduce((s,v)=>s+v,0);
  const saldoAnual=totalIng-totalEgr;
  const saldoEl=document.getElementById('annual-saldo-val');
  const heroEl=document.getElementById('annual-hero');
  if(saldoEl){
    saldoEl.textContent=(saldoAnual>=0?'+':'−')+fmt(saldoAnual);
  }
  if(heroEl){
    heroEl.style.background = saldoAnual>=0
      ? 'linear-gradient(135deg, #34c759, #248a3d)'
      : 'linear-gradient(135deg, #ff3b30, #c1271d)';
  }
  const benLine=document.getElementById('annual-ben-line');
  const benVal=document.getElementById('annual-ben-val');
  if(benLine && benVal){
    if(totalBen>0){
      benLine.style.display='flex';
      benVal.textContent=fmt(totalBen);
    } else {
      benLine.style.display='none';
    }
  }

  // El máximo SOLO considera las series visibles (para reescalar en vivo).
  // Cada serie ahora es su propia barra agrupada (no apilada).
  let maxCandidates=[1];
  if(chartSeriesVisible.ingreso) maxCandidates.push(...ingData);
  if(chartSeriesVisible.egreso) maxCandidates.push(...egrData);
  if(chartSeriesVisible['ahorro-pasivo']) maxCandidates.push(...benData);
  const dataMax=Math.max(...maxCandidates);

  // ── Eje Y: intervalo escalado según el máximo ──
  // >= $10,000 → intervalos de $10,000; >= $1,000 → $1,000; si no → $100.
  let step;
  if(dataMax>=10000) step=10000;
  else if(dataMax>=1000) step=1000;
  else step=100;
  // Evitar demasiadas líneas: si con este intervalo saldrían más de 6, duplicar/subir.
  while(Math.ceil(dataMax/step) > 6){
    if(step===100) step=200;
    else if(step===200) step=500;
    else if(step===500) step=1000;
    else if(step===1000) step=2000;
    else if(step===2000) step=5000;
    else if(step===5000) step=10000;
    else step=step*2;
  }
  // Redondear el tope hacia arriba al múltiplo del intervalo (mínimo un intervalo)
  const maxVal=Math.max(step, Math.ceil(dataMax/step)*step);
  const nLines=Math.round(maxVal/step); // cantidad de intervalos

  // Etiqueta compacta para el eje ($10k, $1.5k, $500)
  const yLabel=v=>{
    if(v>=1000){ const k=v/1000; return '$'+(k%1===0?k:k.toFixed(1))+'k'; }
    return '$'+v;
  };
  // Ancho del área de etiquetas Y (depende del texto más largo)
  const yAxisW=34;

  const padL=yAxisW,padR=6,padT=10,padB=24;
  const chartW=W-padL-padR;
  const chartH=200-padT-padB;
  const groupW=chartW/12;

  // ── Dibujar gridlines horizontales sutiles + etiquetas Y ──
  ctx.textAlign='right';
  ctx.font='9px -apple-system,sans-serif';
  for(let i=0;i<=nLines;i++){
    const val=i*step;
    const y=padT+chartH-(val/maxVal)*chartH;
    // Línea sutil
    ctx.strokeStyle='rgba(142,142,147,0.18)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(padL,y+0.5);
    ctx.lineTo(W-padR,y+0.5);
    ctx.stroke();
    // Etiqueta
    ctx.fillStyle='#8e8e93';
    ctx.fillText(yLabel(val), padL-6, y+3);
  }

  // Determinar cuántas barras se muestran por grupo (para el ancho)
  const visibleSeries=['ingreso','egreso','ahorro-pasivo'].filter(t=>chartSeriesVisible[t]);
  const nBars=visibleSeries.length||1;
  // Ancho de cada barra según cuántas series visibles (más delgadas si son 3)
  const barW=Math.max(3,Math.floor(groupW*0.62/nBars));
  const gap=Math.max(1,Math.floor(barW*0.18));
  const colorMap={ingreso:'#34c759',egreso:'#ff3b30','ahorro-pasivo':'#af52de'};
  const dataMap={ingreso:ingData,egreso:egrData,'ahorro-pasivo':benData};

  Array.from({length:12},(_,m)=>{
    const cx=padL+m*groupW+groupW/2;
    // Ancho total del grupo de barras visibles
    const totalW=nBars*barW+(nBars-1)*gap;
    let bx=cx-totalW/2;
    visibleSeries.forEach(type=>{
      const val=dataMap[type][m];
      const h=Math.max(0,(val/maxVal)*chartH);
      if(h>0){
        ctx.fillStyle=colorMap[type];
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(bx,padT+chartH-h,barW,h,[2,2,0,0]);
        else ctx.rect(bx,padT+chartH-h,barW,h);
        ctx.fill();
      }
      bx+=barW+gap;
    });
    ctx.fillStyle='#8e8e93';
    ctx.font=`9px -apple-system,sans-serif`;
    ctx.textAlign='center';
    ctx.fillText(MONTHS_ES[m].slice(0,3),cx,200-6);
  });

  canvas.onclick=(ev)=>{
    const rect=canvas.getBoundingClientRect();
    const cx=(ev.clientX-rect.left)*(canvas.width/rect.width);
    const m=Math.floor((cx-padL)/groupW);
    if(m>=0&&m<12){
      const hasRecords = ingData[m]>0 || egrData[m]>0 || benData[m]>0;
      if(hasRecords) showAnnualMonthDetail(m,yr);
    }
  };

  const lbl=document.getElementById('annual-month-lbl');
  const cats=document.getElementById('annual-cats');
  if(annualSelMonth===null&&lbl){ lbl.style.display='none'; cats.innerHTML=''; }
}

let annualDetailView = null; // 'ingreso' | 'egreso' | 'ahorro-pasivo' | null

function showAnnualMonthDetail(m,yr){
  annualSelMonth=m;
  annualDetailView=null; // resetear la tabla desglosada al cambiar de mes
  const lbl=document.getElementById('annual-month-lbl');
  const cats=document.getElementById('annual-cats');
  if(!lbl||!cats) return;
  lbl.style.display='block';
  lbl.textContent=`${MONTHS_ES[m]} ${yr}`;
  revealAnimate(lbl);
  cats.innerHTML='';

  const md=data.filter(e=>{const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;});
  const ing=sum(md,'ingreso'),egr=sum(md,'egreso'),pas=sum(md,'ahorro-pasivo');
  const bal=ing-egr;

  // ── Tarjetón de balance del mes a 100% de ancho ──
  const balCard=document.createElement('div');
  balCard.className='stat';
  balCard.style.cssText='grid-column:1/-1;margin-bottom:8px;text-align:center;padding:16px;';
  balCard.innerHTML=`
    <div class="lbl">Balance de ${MONTHS_ES[m]}</div>
    <div class="val ${bal>=0?'g':'r'}" style="font-size:30px;">${bal>=0?'+':'−'}${fmt(bal)}</div>
    <div class="sub">Ingresos − Egresos</div>`;
  cats.appendChild(balCard);

  // ── Fila de tarjetones proporcionales (ingreso, egreso, beneficio si aplica) ──
  const cardsRow=document.createElement('div');
  const items=[
    {k:'ingreso', lbl:'Ingresos', val:ing, cls:'g', show:ing>0},
    {k:'egreso',  lbl:'Egresos',  val:egr, cls:'r', show:egr>0},
    {k:'ahorro-pasivo', lbl:'Beneficios', val:pas, cls:'a', show:pas>0},
  ].filter(it=>it.show);

  const n=items.length;
  cardsRow.style.cssText=`display:grid;grid-template-columns:repeat(${n||1},1fr);gap:6px;margin-bottom:8px;`;
  // Ajuste proporcional del tamaño de texto según cuántos tarjetones haya
  const valSize = n>=3 ? '18px' : '22px';

  items.forEach(it=>{
    const card=document.createElement('div');
    card.className='stat annual-detail-stat';
    card.style.cssText='cursor:pointer;text-align:center;';
    card.dataset.view=it.k;
    card.innerHTML=`<div class="lbl">${it.lbl}</div><div class="val ${it.cls}" style="font-size:${valSize};">${fmt(it.val)}</div>`;
    card.onclick=()=>toggleAnnualDetailView(it.k, m, yr);
    cardsRow.appendChild(card);
  });
  cats.appendChild(cardsRow);

  // Contenedor donde se desplegará la tabla al tocar un tarjetón
  const detailBox=document.createElement('div');
  detailBox.id='annual-detail-box';
  cats.appendChild(detailBox);

  // Animación de entrada
  revealAnimate(balCard);
  revealAnimate(cardsRow, true);
}

// Alterna la tabla desglosada al tocar un tarjetón (igual que en mensual)
function toggleAnnualDetailView(view, m, yr){
  const box=document.getElementById('annual-detail-box');
  if(!box) return;
  // Toggle: si ya estaba activo, cerrar
  if(annualDetailView===view){
    annualDetailView=null;
    box.innerHTML='';
    document.querySelectorAll('.annual-detail-stat').forEach(s=>s.classList.remove('active-filter'));
    return;
  }
  annualDetailView=view;
  // Resaltar el tarjetón activo
  document.querySelectorAll('.annual-detail-stat').forEach(s=>{
    s.classList.toggle('active-filter', s.dataset.view===view);
  });

  box.innerHTML='';
  const md=data.filter(e=>{const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr && e.type===view;});
  const typeNames={ingreso:'Ingresos',egreso:'Egresos','ahorro-pasivo':'Beneficios'};

  const sec=document.createElement('div'); sec.className='sec-lbl';
  sec.textContent=`${typeNames[view]} por categoría`;
  sec.style.marginTop='4px';
  box.appendChild(sec);

  const catTotals={},catSubTotals={};
  md.forEach(e=>{
    catTotals[e.category]=(catTotals[e.category]||0)+e.amountMXN;
    if(!catSubTotals[e.category]) catSubTotals[e.category]={};
    const s=e.subcategory||'—';
    catSubTotals[e.category][s]=(catSubTotals[e.category][s]||0)+e.amountMXN;
  });
  const wrap=document.createElement('div'); wrap.className='cat-list';
  buildExpandCatList(wrap,catTotals,catSubTotals);
  box.appendChild(wrap);

  revealAnimate(sec);
  revealAnimate(wrap, true);
}
