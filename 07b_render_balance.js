function renderBalance(){
  const mSel=document.getElementById('bal-month-sel');
  const ySel=document.getElementById('bal-year-sel');
  if(mSel&&ySel&&mSel.value!==''){
    viewMonth=parseInt(mSel.value); viewYear=parseInt(ySel.value);
  }
  const md=monthData();
  const ing=sum(md,'ingreso'), egr=sum(md,'egreso');
  const aho=sum(md,'ahorro'), pas=sum(md,'ahorro-pasivo');
  const bal=ing-egr;

  // Subtítulo fijo (el ahorro activo fue eliminado de la app)
  const subEl=document.getElementById('bal-hero-sub');
  if(subEl) subEl.textContent = 'Ingresos − Egresos';

  document.getElementById('bal-val').textContent=(bal>=0?'+':'')+fmt(bal);
  const hasData=ing>0||egr>0||aho>0||pas>0;
  const hero=document.getElementById('bal-hero');
  if(!hasData){
    hero.style.background='var(--surface3)';
    hero.style.setProperty('--hero-val','var(--text2)');
    hero.style.setProperty('--hero-lbl','var(--text3)');
    hero.style.setProperty('--hero-sub','var(--text3)');
  } else {
    hero.style.background=bal>=0?'#1d7a3e':'#c0392b';
    hero.style.removeProperty('--hero-val');
    hero.style.removeProperty('--hero-lbl');
    hero.style.removeProperty('--hero-sub');
  }
  document.getElementById('d-ing').textContent=fmt(ing);
  document.getElementById('d-egr').textContent=fmt(egr);
  const dAho=document.getElementById('d-aho'); if(dAho) dAho.textContent=fmt(aho);
  document.getElementById('d-pas').textContent=fmt(pas);
  // Ocultar tarjetón de beneficios si no hay movimientos en el mes
  const pasivoStat=document.getElementById('pasivo-stat');
  if(pasivoStat) pasivoStat.style.display = pas>0 ? '' : 'none';

  // ── Bono de despensa — tarjetón propio del grid ──
  const bonoEgr=md.filter(e=>e.method==='Bono de despensa'&&e.type==='egreso').reduce((s,e)=>s+e.amountMXN,0);
  const bonoIng=md.filter(e=>e.category==='Bono de despensa'&&e.type==='ingreso').reduce((s,e)=>s+e.amountMXN,0);
  const bonoNet=bonoIng-bonoEgr;
  const bonoStat=document.getElementById('bono-stat');
  const dBono=document.getElementById('d-bono');
  const bonoSub=document.getElementById('bono-stat-sub');
  const bonoDetail=document.getElementById('bono-detail-row');
  const bonoHasMov = bonoEgr>0||bonoIng>0;
  if(bonoHasMov){
    if(bonoStat) bonoStat.style.display='';
    const bonoNeg = bonoNet<0;
    if(dBono){
      // fmt() usa valor absoluto; agregamos el signo − manualmente cuando hay sobregiro
      dBono.textContent=(bonoNeg?'−':'')+fmt(bonoNet);
      dBono.classList.remove('g','r');
      dBono.classList.add(bonoNeg?'r':'g');
      dBono.style.color='';
    }
    // Subtítulo: "Disponible" si hay saldo, "Excedido" si te pasaste
    if(bonoSub) bonoSub.textContent = bonoNeg ? 'Excedido este mes' : 'Disponible';
    if(bonoDetail){
      bonoDetail.innerHTML=`
        ${bonoIng>0?`<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:var(--text2)"><span>Ingresado</span><span style="font-weight:600;color:var(--green)">+${fmt(bonoIng)}</span></div>`:''}
        ${bonoEgr>0?`<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:var(--text2)"><span>Gastado</span><span style="font-weight:600;color:var(--danger)">−${fmt(bonoEgr)}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0;margin-top:4px;border-top:1px solid var(--border2);color:var(--text)"><span style="font-weight:600">${bonoNeg?'Excedido':'Disponible'}</span><span style="font-weight:700;color:${bonoNeg?'var(--danger)':'var(--green)'}">${bonoNeg?'−':''}${fmt(bonoNet)}</span></div>`;
    }
  } else {
    if(bonoStat) bonoStat.style.display='none';
    if(bonoDetail) bonoDetail.style.display='none';
  }

  // ── Visibilidad + orden por jerarquía ──
  // Cada tarjetón aparece solo si tiene datos. Orden fijo: Ingresos, Egresos, Bono, Beneficios.
  // Se reordenan en el DOM para que llenen la cuadrícula 2×2 sin huecos ni expansiones.
  const ingresoStat=document.getElementById('ingreso-stat');
  const egresoStat=document.getElementById('egreso-stat');
  if(ingresoStat) ingresoStat.style.display = ing>0 ? '' : 'none';
  if(egresoStat)  egresoStat.style.display  = egr>0 ? '' : 'none';

  // Ninguno ocupa todo el ancho — siempre media columna
  [ingresoStat,egresoStat,bonoStat,pasivoStat].forEach(s=>{ if(s) s.style.gridColumn=''; });

  // Reordenar según prioridad, colocando el detalle del bono al final
  const grid=document.getElementById('bal-stats-grid');
  if(grid){
    const order=[
      {stat:ingresoStat, show:ing>0},
      {stat:egresoStat,  show:egr>0},
      {stat:bonoStat,    show:bonoHasMov},
      {stat:pasivoStat,  show:pas>0},
    ];
    order.forEach(o=>{ if(o.stat && o.show) grid.appendChild(o.stat); });
    if(bonoDetail) grid.appendChild(bonoDetail); // el detalle siempre al final
  }

  // Re-highlight active stat card por ID (el orden del DOM ahora es dinámico)
  if(balView){
    const idMap={ingreso:'ingreso-stat',egreso:'egreso-stat','ahorro-pasivo':'pasivo-stat'};
    document.querySelectorAll('#page-balance .grid2 .stat').forEach(s=>s.classList.remove('active-filter'));
    const activeId=idMap[balView];
    if(activeId){ const activeEl=document.getElementById(activeId); if(activeEl) activeEl.classList.add('active-filter'); }
  }
  renderBalanceCats();
}

function toggleBonoDetail(){
  const detail=document.getElementById('bono-detail-row');
  const bonoStat=document.getElementById('bono-stat');
  if(!detail) return;
  const isOpen = detail.style.display!=='none';
  if(isOpen){
    // Cerrar
    detail.style.display='none';
    if(bonoStat) bonoStat.classList.remove('active-filter');
  } else {
    // Abrir bono → cerrar cualquier otra vista (ingresos/egresos/pasivo)
    balView=null;
    document.querySelectorAll('#page-balance .grid2 .stat').forEach(s=>s.classList.remove('active-filter'));
    document.getElementById('dash-detail-lbl').style.display='none';
    document.getElementById('dash-cats').innerHTML='';
    detail.style.display='block';
    revealAnimate(detail);
    if(bonoStat) bonoStat.classList.add('active-filter');
  }
}

function renderBalanceCats(animate){
  const md=monthData();
  const cl=document.getElementById('dash-cats');
  const lbl=document.getElementById('dash-detail-lbl');
  cl.innerHTML='';

  if(!balView){ lbl.style.display='none'; return; }

  // Animación del label solo cuando el usuario abre la vista (no en re-renders automáticos)
  if(animate) revealAnimate(lbl);

  const typeNames={ingreso:'Ingresos',egreso:'Egresos',ahorro:'Ahorro activo','ahorro-pasivo':'Beneficios'};
  lbl.style.display='block';
  lbl.textContent=typeNames[balView];

  // For ahorro types: use ALL data (not just this month), show movements per category
  const isAhorro = balView==='ahorro'||balView==='ahorro-pasivo';
  const subset = md.filter(e=>e.type===balView);

  const catTotals={}, catSubTotals={}, catItems={};
  subset.forEach(e=>{
    catTotals[e.category]=(catTotals[e.category]||0)+e.amountMXN;
    if(isAhorro){
      if(!catItems[e.category]) catItems[e.category]=[];
      catItems[e.category].push(e);
    } else {
      if(!catSubTotals[e.category]) catSubTotals[e.category]={};
      const s=e.subcategory||'—';
      catSubTotals[e.category][s]=(catSubTotals[e.category][s]||0)+e.amountMXN;
    }
  });

  if(!Object.keys(catTotals).length){
    cl.innerHTML='<div class="empty"><div class="e-ico">📊</div>Sin registros</div>';
    return;
  }

  if(isAhorro){
    const sign = balView==='ahorro-pasivo' ? '★' : '→';
    const amtColor = balView==='ahorro-pasivo' ? '#af52de' : 'var(--blue)';
    Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).forEach(([cat,tot])=>{
      const color=catColor(cat);
      const items=(catItems[cat]||[]).sort((a,b)=>b.amountMXN-a.amountMXN);
      const row=document.createElement('div');
      row.className='cat-expand-row';
      row.innerHTML=`
        <div class="cat-color-bar" style="background:${color}"></div>
        <div class="cat-expand-hdr" style="padding-left:18px">
          <span style="font-size:17px;width:28px;text-align:center">${ICONS[cat]||'💰'}</span>
          <div style="flex:1;font-size:14px;font-weight:500;color:var(--text)">${cat}</div>
          <div style="font-size:14px;font-weight:600;color:var(--text2)">${fmt(tot)}</div>
          <span class="cat-expand-chevron">›</span>
        </div>`;
      const body=document.createElement('div');
      body.className='cat-expand-body';
      items.forEach(e=>{
        const line=document.createElement('div');
        line.className='subcat-line';
        line.innerHTML=`<span class="s-name" style="color:var(--text)">${e.desc}</span><span class="s-val" style="color:${amtColor}">${sign}${fmt(e.amountMXN)}</span>`;
        body.appendChild(line);
      });
      row.appendChild(body);
      row.querySelector('.cat-expand-hdr').onclick=()=>row.classList.toggle('open');
      cl.appendChild(row);
    });
  } else {
    buildExpandCatList(cl, catTotals, catSubTotals, viewYear, viewMonth);
    // Payment method breakdown
    renderMethodBreakdown(cl, subset);
  }

  // Animación en cascada solo cuando el usuario abre la vista (no en re-renders)
  if(animate) revealAnimate(cl, true);
}

function renderMethodBreakdown(container, entries){
  const methods={};
  entries.forEach(e=>{ if(e.method) methods[e.method]=(methods[e.method]||0)+e.amountMXN; });
  if(!Object.keys(methods).length) return;
  const total=Object.values(methods).reduce((s,v)=>s+v,0);
  const methodColors={'Tarjeta de crédito':'#007aff','Efectivo':'#34c759','Bono de despensa':'#ff9500','SPEI':'#af52de','Débito':'#00c7be'};
  const sorted=Object.entries(methods).sort((a,b)=>b[1]-a[1]);
  const wrap=document.createElement('div');
  wrap.style.cssText='padding:12px 16px;margin-top:8px;';
  // Color bar
  const bar=document.createElement('div');
  bar.style.cssText='display:flex;height:5px;border-radius:100px;overflow:hidden;margin-bottom:8px;gap:1px;';
  sorted.forEach(([m,v])=>{
    const seg=document.createElement('div');
    seg.style.cssText=`flex:${v};background:${methodColors[m]||'#8e8e93'};`;
    bar.appendChild(seg);
  });
  wrap.appendChild(bar);
  // Labels
  const labels=document.createElement('div');
  labels.style.cssText='display:flex;flex-wrap:wrap;gap:6px 12px;';
  sorted.forEach(([m,v])=>{
    const pct=((v/total)*100).toFixed(0);
    const lbl=document.createElement('span');
    lbl.style.cssText='font-size:11px;color:var(--text3);display:flex;align-items:center;gap:4px;';
    lbl.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:${methodColors[m]||'#8e8e93'};display:inline-block"></span>${m} ${pct}%`;
    labels.appendChild(lbl);
  });
  wrap.appendChild(labels);
  container.appendChild(wrap);
}

function buildExpandCatList(container, catTotals, catSubTotals){
  const sortedC=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const grandTotal=sortedC.reduce((s,[,v])=>s+v,0);
  sortedC.forEach(([cat,tot])=>{
    const subs=catSubTotals?catSubTotals[cat]||{}:{};
    const hasSubs=Object.keys(subs).some(k=>k!=='—');
    const color=catColor(cat);
    const pct=grandTotal>0?((tot/grandTotal)*100).toFixed(1):'0';
    const row=document.createElement('div');
    row.className='cat-expand-row';
    row.innerHTML=`
      <div class="cat-color-bar" style="background:${color}"></div>
      <div class="cat-expand-hdr" style="padding-left:18px">
        <span style="font-size:17px;width:28px;text-align:center">${ICONS[cat]||'📌'}</span>
        <div style="flex:1;font-size:14px;font-weight:500;color:var(--text)">${cat}</div>
        <div style="font-size:12px;color:var(--text3);margin-right:8px">${pct}%</div>
        <div style="font-size:14px;font-weight:600;color:var(--text2)">${fmt(tot)}</div>
        ${hasSubs?'<span class="cat-expand-chevron">›</span>':''}
      </div>`;
    if(hasSubs){
      const body=document.createElement('div');
      body.className='cat-expand-body';
      const subEntries=Object.entries(subs).filter(([k])=>k!=='—').sort((a,b)=>b[1]-a[1]);
      subEntries.forEach(([sub,stot],i)=>{
        const subColor=lighten(color, 0.25+(i/Math.max(subEntries.length-1,1))*0.45);
        const subPct=grandTotal>0?((stot/grandTotal)*100).toFixed(1):'0';
        const line=document.createElement('div');
        line.className='subcat-line';
        // Override the left color bar via a pseudo-gradient on the row's bar
        line.style.cssText='padding-left:18px;position:relative;';
        line.innerHTML=`
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${subColor}"></div>
          <span class="s-name" style="flex:1;text-align:left">${ICONS[sub]||''} ${sub}</span>
          <span style="font-size:12px;color:var(--text3);margin-right:8px">${subPct}%</span>
          <span class="s-val">${fmt(stot)}</span>`;
        body.appendChild(line);
      });
      row.appendChild(body);
      row.querySelector('.cat-expand-hdr').onclick=()=>row.classList.toggle('open');
    }
    container.appendChild(row);
  });
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function renderPie(filtered) {
  const wrap=document.getElementById('pie-wrap');
  const canvas=document.getElementById('pie-canvas');
  const legend=document.getElementById('pie-legend');
  if(histFilter==='todos'||!filtered.length){ wrap.style.display='none'; return; }

  const isEgreso=histFilter==='egreso';

  // Build grouped structure: {cat: {total, subcats:{sub:amt}}}
  const catMap={};
  filtered.forEach(e=>{
    if(!catMap[e.category]) catMap[e.category]={total:0,subcats:{}};
    catMap[e.category].total+=e.amountMXN;
    const sub=e.subcategory||'—';
    catMap[e.category].subcats[sub]=(catMap[e.category].subcats[sub]||0)+e.amountMXN;
  });
  const catsSorted=Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total);
  const grandTotal=catsSorted.reduce((s,[,v])=>s+v.total,0);
  if(!grandTotal){ wrap.style.display='none'; return; }

  // Hide pie if only 1 category has data (100% is obvious) — applies to non-egreso only
  if(!isEgreso && catsSorted.length===1){ wrap.style.display='none'; return; }

  // Hide pie if only 1 subcat active (in egreso mode)
  if(isEgreso && histSelSubcats.length===1){ wrap.style.display='none'; return; }

  wrap.style.display='block';

  // For egresos: always show subcats, grouped by category color
  const showSubcats = isEgreso;

  // Build flat slice list
  const slices=[];
  catsSorted.forEach(([cat,{total,subcats}],catIdx)=>{
    const subEntries=Object.entries(subcats).filter(([k])=>k!=='—').sort((a,b)=>b[1]-a[1]);
    const base=catColor(cat);
    if(showSubcats && subEntries.length>0){
      subEntries.forEach(([sub,amt],subIdx)=>{
        const color=lighten(base, subEntries.length<=1?0:subIdx/(subEntries.length-1)*0.55);
        slices.push({label:sub,cat,amt,color,catIdx});
      });
    } else {
      slices.push({label:cat,cat,amt:total,color:base,catIdx});
    }
  });

  // Draw canvas
  const ctx=canvas.getContext('2d');
  const cx=100,cy=100,r=82,ir=46;
  ctx.clearRect(0,0,200,200);
  let angle=-Math.PI/2;
  slices.forEach(({amt,color})=>{
    const slice=(amt/grandTotal)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+slice);
    ctx.closePath();
    ctx.fillStyle=color; ctx.fill();
    angle+=slice;
  });
  ctx.globalCompositeOperation='destination-out';
  ctx.beginPath(); ctx.arc(cx,cy,ir,0,Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation='source-over';

  // Build legend — grouped by category with expandable subcats
  legend.innerHTML='';
  catsSorted.forEach(([cat,{total,subcats}],catIdx)=>{
    const catPct=((total/grandTotal)*100).toFixed(1);
    const baseColor=catColor(cat);
    const subEntries=Object.entries(subcats).filter(([k])=>k!=='—').sort((a,b)=>b[1]-a[1]);
    const hasSubs=isEgreso&&subEntries.length>=1;

    const catEl=document.createElement('div');
    catEl.className='pie-legend-cat';
    catEl.innerHTML=`
      <div class="pie-legend-cat-hdr">
        <span class="pie-dot" style="background:${baseColor}"></span>
        <span class="pie-legend-name" style="font-weight:600;color:var(--text)">${cat}</span>
        <span class="pie-legend-pct">${catPct}%</span>
        <span class="pie-legend-amt">${fmt(total)}</span>
        <span class="${hasSubs?'pie-legend-chevron':'pie-legend-chevron-spacer'}">${hasSubs?'›':''}</span>
      </div>`;

    if(hasSubs){
      const body=document.createElement('div');
      body.className='pie-legend-cat-body';
      subEntries.forEach(([sub,amt],subIdx)=>{
        const subColor=lighten(baseColor, subEntries.length<=1?0:subIdx/(subEntries.length-1)*0.55);
        const subPct=((amt/grandTotal)*100).toFixed(1);
        const line=document.createElement('div');
        line.className='pie-sub-item';
        line.innerHTML=`
          <span class="pie-dot" style="background:${subColor};width:8px;height:8px;margin-left:1px"></span>
          <span class="pie-sub-name">${sub}</span>
          <span class="pie-sub-pct">${subPct}%</span>
          <span class="pie-sub-amt">${fmt(amt)}</span>
          <span></span>`;
        body.appendChild(line);
      });
      catEl.appendChild(body);
      catEl.querySelector('.pie-legend-cat-hdr').onclick=()=>catEl.classList.toggle('open');
    }
    legend.appendChild(catEl);
  });
}

// Devuelve las entradas de un tipo dentro del ALCANCE DE FECHA activo
// (rango aplicado o mes/año), excluyendo futuras. Se usa para preseleccionar
// categorías, de forma consistente entre vista mensual y por rango.
