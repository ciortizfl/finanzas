// ════════════════════════════════════════════
// BALANCE MENSUAL
// ════════════════════════════════════════════

function renderBalance(){
  const mSel=document.getElementById('bal-month-sel');
  const ySel=document.getElementById('bal-year-sel');
  if(mSel&&ySel&&mSel.value!==''){
    viewMonth=parseInt(mSel.value); viewYear=parseInt(ySel.value);
  }
  try{ _balSyncTitle(); }catch(e){}   // R9 · título del selector estilo calendario
  const md=monthData();
  const ing=sum(md,'ingreso'), egr=sum(md,'egreso');
  const pas=sum(md,'beneficio');
  const bal=ing-egr;

  const subEl=document.getElementById('bal-hero-sub');
  if(subEl) subEl.textContent = 'Ingresos − Egresos';

  document.getElementById('bal-val').textContent=(bal>=0?'+':'')+fmt(bal);
  const hasData=ing>0||egr>0||pas>0;
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
  } else {
    if(bonoStat) bonoStat.style.display='none';
    bonoOpen=false; // sin movimientos, no hay nada que mantener abierto
  }
  // El detalle (hueco de Beneficios o desplegable de abajo) se pinta aparte,
  // y respeta si el usuario activó la tarjeta (bonoOpen) — ver _paintBonoDetail.
  _paintBonoDetail(false);
  const bonoSlot=document.getElementById('bono-slot-detail');
  const usarHuecoBeneficios = bonoHasMov && !(pas>0);

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
      // R9 · Ocupa el hueco de Beneficios cuando no hay beneficios este mes
      {stat:bonoSlot,    show:usarHuecoBeneficios},
    ];
    order.forEach(o=>{ if(o.stat && o.show) grid.appendChild(o.stat); });
    if(bonoDetail) grid.appendChild(bonoDetail); // el detalle siempre al final
  }

  // Re-highlight active stat card por ID (el orden del DOM ahora es dinámico)
  if(balView){
    const idMap={ingreso:'ingreso-stat',egreso:'egreso-stat','beneficio':'pasivo-stat'};
    document.querySelectorAll('#page-balance .grid2 .stat').forEach(s=>s.classList.remove('active-filter'));
    const activeId=idMap[balView];
    if(activeId){ const activeEl=document.getElementById(activeId); if(activeEl) activeEl.classList.add('active-filter'); }
  }
  renderBalanceCats();
}

function toggleBonoDetail(){
  const bonoStat=document.getElementById('bono-stat');
  bonoOpen = !bonoOpen;
  if(bonoOpen){
    // Abrir bono → cerrar cualquier otra vista (ingresos/egresos/pasivo)
    balView=null;
    document.querySelectorAll('#page-balance .grid2 .stat').forEach(s=>s.classList.remove('active-filter'));
    document.getElementById('dash-cats').innerHTML='';
    // El bono solo muestra su propia información: no dejar el treemap del tipo anterior.
    const tmw=document.getElementById('bal-treemap-wrap');
    if(tmw) tmw.style.display='none';
    const tmc=document.getElementById('bal-treemap');
    if(tmc) tmc.innerHTML='';
    const mb=document.getElementById('bal-method-row');
    if(mb) mb.innerHTML='';
    if(bonoStat) bonoStat.classList.add('active-filter');
  } else {
    if(bonoStat) bonoStat.classList.remove('active-filter');
  }
  _paintBonoDetail(true);
}

// R9 · Pinta el detalle del bono en la superficie que corresponda — el hueco
// de Beneficios (cuando no hay beneficios este mes) o el desplegable de abajo
// (cuando sí los hay) — pero SOLO si bonoOpen es true. Se llama al togglear Y
// en cada renderBalance() para que el panel abierto se mantenga sincronizado
// (cambio de mes, refresco silencioso) sin reaparecer solo si está cerrado.
function _paintBonoDetail(animate){
  const md=monthData();
  const bonoEgr=md.filter(e=>e.method==='Bono de despensa'&&e.type==='egreso').reduce((s,e)=>s+e.amountMXN,0);
  const bonoIng=md.filter(e=>e.category==='Bono de despensa'&&e.type==='ingreso').reduce((s,e)=>s+e.amountMXN,0);
  const bonoNet=bonoIng-bonoEgr;
  const bonoNeg=bonoNet<0;
  const pas=sum(md,'beneficio');
  const usarHuecoBeneficios = (bonoEgr>0||bonoIng>0) && !(pas>0);
  const detail=document.getElementById('bono-detail-row');
  const bonoSlot=document.getElementById('bono-slot-detail');

  if(!bonoOpen){
    if(detail) detail.style.display='none';
    if(bonoSlot){ bonoSlot.style.display='none'; bonoSlot.innerHTML=''; }
    return;
  }
  if(usarHuecoBeneficios){
    if(detail) detail.style.display='none';
    if(bonoSlot){
      bonoSlot.innerHTML=`
        <div class="lbl">Bono despensa</div>
        ${bonoIng>0?`<div class="bono-slot-line"><span>Ingresado</span><span style="font-weight:600;color:var(--green)">+${fmt(bonoIng)}</span></div>`:''}
        ${bonoEgr>0?`<div class="bono-slot-line"><span>Gastado</span><span style="font-weight:600;color:var(--danger)">−${fmt(bonoEgr)}</span></div>`:''}
        <div class="bono-slot-line total"><span style="font-weight:600">${bonoNeg?'Excedido':'Disponible'}</span><span style="font-weight:700;color:${bonoNeg?'var(--danger)':'var(--green)'}">${bonoNeg?'−':''}${fmt(bonoNet)}</span></div>`;
      bonoSlot.style.display='';
      if(animate) revealAnimate(bonoSlot);
    }
  } else {
    if(bonoSlot){ bonoSlot.style.display='none'; bonoSlot.innerHTML=''; }
    if(detail){
      detail.innerHTML=`
        ${bonoIng>0?`<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:var(--text2)"><span>Ingresado</span><span style="font-weight:600;color:var(--green)">+${fmt(bonoIng)}</span></div>`:''}
        ${bonoEgr>0?`<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:var(--text2)"><span>Gastado</span><span style="font-weight:600;color:var(--danger)">−${fmt(bonoEgr)}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0;margin-top:4px;border-top:1px solid var(--border2);color:var(--text)"><span style="font-weight:600">${bonoNeg?'Excedido':'Disponible'}</span><span style="font-weight:700;color:${bonoNeg?'var(--danger)':'var(--green)'}">${bonoNeg?'−':''}${fmt(bonoNet)}</span></div>`;
      detail.style.display='block';
      if(animate) revealAnimate(detail);
    }
  }
}

function renderBalanceCats(animate){
  const md=monthData();
  const cl=document.getElementById('dash-cats');
  cl.innerHTML='';

  if(!balView){ return; }

  const subset = md.filter(e=>e.type===balView);

  const catTotals={}, catSubTotals={};
  subset.forEach(e=>{
    catTotals[e.category]=(catTotals[e.category]||0)+e.amountMXN;
    if(!catSubTotals[e.category]) catSubTotals[e.category]={};
    const s=e.subcategory||'—';
    catSubTotals[e.category][s]=(catSubTotals[e.category][s]||0)+e.amountMXN;
  });

  if(!Object.keys(catTotals).length){
    cl.innerHTML='<div class="empty"><div class="e-ico">📊</div>Sin registros</div>';
    const tmw=document.getElementById('bal-treemap-wrap'); if(tmw) tmw.style.display='none';
    return;
  }

  // Egresos / Ingresos / Beneficios: tabla como control del Treemap.
  buildExpandCatList(cl, catTotals, catSubTotals, {treemap:true});
  // El desglose por método va ARRIBA de la tabla (justo bajo las tarjetas),
  // para que tabla y treemap queden continuos. No aplica a beneficios (method null).
  const mrow=document.getElementById('bal-method-row');
  if(mrow){
    mrow.innerHTML='';
    if(balView!=='beneficio'){
      renderMethodBreakdown(mrow, subset);
      // Misma animación de aparición que la tabla
      if(animate && mrow.firstChild) revealAnimate(mrow);
    }
  }
  try{ renderBalanceTreemap(); }catch(e){}

  // Animación en cascada solo cuando el usuario abre la vista (no en re-renders)
  if(animate) revealAnimate(cl, true);
}

function renderMethodBreakdown(container, entries){
  const methods={};
  entries.forEach(e=>{ if(e.method) methods[e.method]=(methods[e.method]||0)+e.amountMXN; });
  if(!Object.keys(methods).length) return;
  const total=Object.values(methods).reduce((s,v)=>s+v,0);
  const methodColors={'Tarjeta de crédito':'#007aff','Efectivo':'#34c759','Bono de despensa':'#ff9500','SPEI':'#af52de','Débito':'#00c7be'};
  // R9 · Solo estos dos tienen forma corta; el resto ya es breve.
  const shortNames={'Tarjeta de crédito':'TDC','Bono de despensa':'Bono'};
  const sorted=Object.entries(methods).sort((a,b)=>b[1]-a[1]);
  const wrap=document.createElement('div');
  wrap.style.cssText='padding:0 16px;';
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
  labels.style.cssText='display:flex;flex-wrap:nowrap;gap:6px 12px;overflow:hidden;';
  const mkLabel=(m,v,useShort)=>{
    const pct=((v/total)*100).toFixed(0);
    const lbl=document.createElement('span');
    lbl.style.cssText='font-size:11px;color:var(--text3);display:flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0;';
    const name = useShort ? (shortNames[m]||m) : m;
    lbl.innerHTML=`<span style="width:7px;height:7px;border-radius:50%;background:${methodColors[m]||'#8e8e93'};display:inline-block;flex-shrink:0"></span>${name} ${pct}%`;
    return lbl;
  };
  sorted.forEach(([m,v])=>labels.appendChild(mkLabel(m,v,false)));
  wrap.appendChild(labels);
  container.appendChild(wrap);

  // R9 · Si el renglón no cabe completo (móvil), se abrevian TDC/Bono
  // empezando por el de MENOR porcentaje — solo lo necesario para que todo
  // quepa en una sola línea, sin abreviar de más.
  requestAnimationFrame(()=>{
    if(labels.scrollWidth<=labels.clientWidth+0.5) return;
    // Candidatos abreviables, ordenados de menor a mayor porcentaje (el de
    // menor peso se abrevia primero).
    const abbreviable=sorted.filter(([m])=>shortNames[m]).sort((a,b)=>a[1]-b[1]);
    for(const [m,v] of abbreviable){
      const idx=sorted.findIndex(([mm])=>mm===m);
      labels.replaceChild(mkLabel(m,v,true), labels.children[idx]);
      if(labels.scrollWidth<=labels.clientWidth+0.5) break;
    }
  });
}

// opts.treemap === true habilita la interacción de control del Treemap:
//   · tocar el renglón activa/desactiva la categoría completa
//   · el chevron expande/colapsa las subcategorías
//   · tocar una subcategoría la activa/desactiva
// Sin ese flag, se comporta como la lista de solo lectura de siempre (vista anual).
function buildExpandCatList(container, catTotals, catSubTotals, opts){
  const tm = !!(opts && opts.treemap);
  const sortedC=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const grandTotal=sortedC.reduce((s,[,v])=>s+v,0);
  sortedC.forEach(([cat,tot])=>{
    const subsObj=catSubTotals?catSubTotals[cat]||{}:{};
    const subEntries=Object.entries(subsObj).filter(([k])=>k!=='—').sort((a,b)=>b[1]-a[1]);
    const hasSubs=subEntries.length>0;
    const subList=hasSubs?subEntries.map(([sub])=>({sub})):null;
    const color=catColor(cat);
    const pct=grandTotal>0?((tot/grandTotal)*100).toFixed(1):'0';
    const row=document.createElement('div');
    row.className='cat-expand-row';
    row.dataset.cat=cat;

    let dot='';
    if(tm){
      const st=tmCatState(cat, subList);
      if(st==='off') row.classList.add('tm-off');
      dot=`<span class="tm-toggle-dot">${st==='on'?'●':st==='off'?'○':'◐'}</span>`;
    }
    row.innerHTML=`
      <div class="cat-color-bar" style="background:${color}"></div>
      <div class="cat-expand-hdr" style="padding-left:18px">
        ${dot}
        <span style="font-size:17px;width:28px;text-align:center">${ICONS[cat]||'📌'}</span>
        <div style="flex:1;font-size:14px;font-weight:500;color:var(--text)">${cat}</div>
        <div style="font-size:12px;color:var(--text3);margin-right:8px">${pct}%</div>
        <div style="font-size:14px;font-weight:600;color:var(--text2)">${fmt(tot)}</div>
        ${hasSubs?'<span class="cat-expand-chevron">›</span>':''}
      </div>`;
    const hdr=row.querySelector('.cat-expand-hdr');

    if(hasSubs){
      const body=document.createElement('div');
      body.className='cat-expand-body';
      subEntries.forEach(([sub,stot],i)=>{
        const subColor=lighten(color, 0.25+(i/Math.max(subEntries.length-1,1))*0.45);
        const subPct=grandTotal>0?((stot/grandTotal)*100).toFixed(1):'0';
        const line=document.createElement('div');
        line.className='subcat-line';
        line.dataset.cat=cat; line.dataset.sub=sub;
        line.style.cssText='padding-left:18px;position:relative;';
        const subOff = tm && tmIsSubOff(cat, sub);
        if(subOff) line.classList.add('tm-off');
        line.innerHTML=`
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${subColor}"></div>
          ${tm?`<span class="tm-toggle-dot sub">${subOff?'○':'●'}</span>`:''}
          <span class="s-name" style="flex:1;text-align:left">${ICONS[sub]||''} ${sub}</span>
          <span style="font-size:12px;color:var(--text3);margin-right:8px">${subPct}%</span>
          <span class="s-val">${fmt(stot)}</span>`;
        if(tm){
          line.onclick=(ev)=>{ ev.stopPropagation(); toggleTmSub(cat, sub); _tmSyncTableDots(); };
        }
        body.appendChild(line);
      });
      row.appendChild(body);
      if(tm){
        hdr.onclick=(ev)=>{
          if(ev.target.closest('.cat-expand-chevron')){ row.classList.toggle('open'); return; }
          toggleTmCat(cat, subList); _tmSyncTableDots();
        };
      } else {
        hdr.onclick=()=>row.classList.toggle('open');
      }
    } else if(tm){
      // Categoría plana (ingresos / beneficios): el renglón entero togglea.
      hdr.onclick=()=>{ toggleTmCat(cat, null); _tmSyncTableDots(); };
    }
    container.appendChild(row);
  });
}

// Refresca los indicadores ●/○/◐ y el atenuado de la tabla EN SITIO tras un
// toggle, sin reconstruir la lista (así no se pierde qué categorías están
// expandidas). El treemap ya se repintó dentro del toggle.
function _tmSyncTableDots(){
  const cl=document.getElementById('dash-cats');
  if(!cl) return;
  cl.querySelectorAll('.cat-expand-row').forEach(row=>{
    const cat=row.dataset.cat; if(cat===undefined) return;
    const subs=[...row.querySelectorAll('.subcat-line')].map(l=>({sub:l.dataset.sub}));
    const subList=subs.length?subs:null;
    const st=tmCatState(cat, subList);
    row.classList.toggle('tm-off', st==='off');
    const d=row.querySelector('.cat-expand-hdr > .tm-toggle-dot');
    if(d) d.textContent = st==='on'?'●':st==='off'?'○':'◐';
    row.querySelectorAll('.subcat-line').forEach(line=>{
      const off=tmIsSubOff(cat, line.dataset.sub);
      line.classList.toggle('tm-off', off);
      const sd=line.querySelector('.tm-toggle-dot.sub');
      if(sd) sd.textContent = off?'○':'●';
    });
  });
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];


// Devuelve las entradas de un tipo dentro del ALCANCE DE FECHA activo
// (rango aplicado o mes/año), excluyendo futuras. Se usa para preseleccionar
// categorías, de forma consistente entre vista mensual y por rango.


// ════════════════════════════════════════════
// VISTA ANUAL
// ════════════════════════════════════════════

// ══════════════════════════════════════
// ANNUAL VIEW
// ══════════════════════════════════════
let balPeriod='monthly';
let annualSelMonth=null;

function setBalPeriod(period){
  balPeriod=period;
  document.getElementById('bal-monthly-view').style.display=period==='monthly'?'block':'none';
  document.getElementById('bal-annual-view').style.display=period==='annual'?'block':'none';
  const seg=document.getElementById('bal-period-seg');
  if(seg){
    seg.dataset.active=period;
    seg.querySelectorAll('.calseg-option').forEach(b=>{
      b.classList.toggle('active', b.dataset.t===period);
    });
  }
  // R9 · El subtítulo del encabezado refleja la vista activa.
  const sub=document.querySelector('#page-balance .page-header p');
  if(sub) sub.textContent = period==='annual' ? 'Resumen anual' : 'Resumen mensual';
  if(period==='annual'){ populateAnnualYear(); renderAnnual(); }
}

// ══════════════════════════════════════════════════════════════════════════
//  R9 · Selector de mes/año de Balance con el mismo patrón del calendario del
//  Historial: texto grande "Julio 2026" que abre un selector al tocarlo, más
//  flechas laterales. Los <select> originales quedan ocultos y siguen siendo
//  la FUENTE DE VERDAD del estado (onBalMonthChange/renderAnnual los leen),
//  así que nada de lo que ya dependía de ellos tuvo que cambiar.
// ══════════════════════════════════════════════════════════════════════════

// ¿Hay al menos un registro (no futuro) en ese mes/año?
function balMonthHasData(y, m){
  return data.some(e=>{
    if(isFutureEntry(e)) return false;
    const d=parseDate(e.date);
    return !isNaN(d.getTime()) && d.getFullYear()===y && d.getMonth()===m;
  });
}
function balYearHasData(y){
  return data.some(e=>{
    if(isFutureEntry(e)) return false;
    const d=parseDate(e.date);
    return !isNaN(d.getTime()) && d.getFullYear()===y;
  });
}

// Refresca el texto "Julio 2026" del encabezado mensual.
function _balSyncTitle(){
  const t=document.getElementById('bal-title-text');
  if(t) t.textContent=`${MONTHS_ES[viewMonth]} ${viewYear}`;
  const at=document.getElementById('bal-annual-title-text');
  if(at) at.textContent=String(viewYear);
  _balSyncArrows();
}

// R9 · Punto 6 — ¿hay algún mes/año CON datos en esa dirección? Mismo criterio
// de búsqueda que balGoMonth/balGoYear, pero de solo lectura (no navega).
function _balHasMonthDir(delta){
  let m=viewMonth, y=viewYear;
  for(let i=0;i<24;i++){
    m+=delta;
    if(m<0){ m=11; y--; } else if(m>11){ m=0; y++; }
    if(balMonthHasData(y,m)) return true;
  }
  return false;
}
function _balHasYearDir(delta){
  const years=yearsInData();
  if(!years.length) return false;
  const asc=years.slice().sort((a,b)=>a-b);
  const idx=asc.indexOf(viewYear);
  return asc[idx+delta]!==undefined;
}
// No cambia el funcionamiento (balGoMonth/balGoYear ya se detienen solos):
// únicamente refleja visualmente cuándo una flecha no tiene a dónde avanzar.
function _balSyncArrows(){
  const mp=document.getElementById('bal-arrow-m-prev'), mn=document.getElementById('bal-arrow-m-next');
  if(mp) mp.disabled=!_balHasMonthDir(-1);
  if(mn) mn.disabled=!_balHasMonthDir(1);
  const yp=document.getElementById('bal-arrow-y-prev'), yn=document.getElementById('bal-arrow-y-next');
  if(yp) yp.disabled=!_balHasYearDir(-1);
  if(yn) yn.disabled=!_balHasYearDir(1);
}

// Navegación mensual con flechas. Salta a meses CON datos: si el mes destino
// está vacío, sigue avanzando en esa dirección hasta encontrar uno con datos
// (hasta 24 meses). Si no hay ninguno, no se mueve.
function balGoMonth(delta){
  let m=viewMonth, y=viewYear;
  for(let i=0;i<24;i++){
    m+=delta;
    if(m<0){ m=11; y--; } else if(m>11){ m=0; y++; }
    if(balMonthHasData(y,m)){
      viewMonth=m; viewYear=y;
      const mSel=document.getElementById('bal-month-sel');
      const ySel=document.getElementById('bal-year-sel');
      if(mSel) mSel.value=String(m);
      if(ySel){
        if(!Array.from(ySel.options).some(o=>parseInt(o.value)===y)){
          const o=document.createElement('option'); o.value=String(y); o.textContent=String(y); ySel.appendChild(o);
        }
        ySel.value=String(y);
      }
      _balSyncTitle();
      clearBalView();
      renderBalance();
      return;
    }
  }
}

// Navegación anual con flechas (solo años con datos).
function balGoYear(delta){
  const years=yearsInData();
  if(!years.length) return;
  const sel=document.getElementById('bal-annual-year-sel');
  const cur=sel&&sel.value?parseInt(sel.value):viewYear;
  // yearsInData viene de mayor a menor; ordenamos ascendente para navegar.
  const asc=years.slice().sort((a,b)=>a-b);
  const idx=asc.indexOf(cur);
  const next=asc[idx+delta];
  if(next===undefined) return;   // no hay más años en esa dirección
  if(sel) sel.value=String(next);
  viewYear=next;
  _balSyncTitle();
  renderAnnual();
}

// ── Selector emergente de mes/año (mensual) ──
let _balMYOpen=false, _balMYyear=null;
function toggleBalMonthYear(){
  const pop=document.getElementById('bal-my-pop');
  if(!pop) return;
  _balMYOpen=!_balMYOpen;
  const lbl=document.getElementById('bal-title');
  if(lbl) lbl.classList.toggle('open', _balMYOpen);
  if(_balMYOpen){ _balMYyear=viewYear; _balRenderMonthYear(); pop.classList.add('open'); }
  else pop.classList.remove('open');
}
function _balRenderMonthYear(){
  if(_balMYyear===null) _balMYyear=viewYear;
  const yl=document.getElementById('bal-my-year');
  if(yl) yl.textContent=_balMYyear;
  const g=document.getElementById('bal-my-months');
  if(!g) return;
  g.innerHTML='';
  const short=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  short.forEach((mLbl,i)=>{
    const b=document.createElement('button'); b.type='button';
    const hasData=balMonthHasData(_balMYyear,i);
    b.className='dp-month-cell'+(i===viewMonth && _balMYyear===viewYear?' current':'');
    b.textContent=mLbl;
    // R9 · Los meses sin registros NO son activables.
    b.disabled=!hasData;
    if(!hasData) b.classList.add('no-data');
    b.onclick=()=>{
      if(!hasData) return;
      viewMonth=i; viewYear=_balMYyear;
      const mSel=document.getElementById('bal-month-sel');
      const ySel=document.getElementById('bal-year-sel');
      if(mSel) mSel.value=String(i);
      if(ySel){
        if(!Array.from(ySel.options).some(o=>parseInt(o.value)===viewYear)){
          const o=document.createElement('option'); o.value=String(viewYear); o.textContent=String(viewYear); ySel.appendChild(o);
        }
        ySel.value=String(viewYear);
      }
      _balMYOpen=false;
      const pop=document.getElementById('bal-my-pop'); if(pop) pop.classList.remove('open');
      const lbl=document.getElementById('bal-title'); if(lbl) lbl.classList.remove('open');
      _balSyncTitle();
      clearBalView();
      renderBalance();
    };
    g.appendChild(b);
  });
}
function balMYYear(delta){ _balMYyear=(_balMYyear===null?viewYear:_balMYyear)+delta; _balRenderMonthYear(); }
// Cerrar el selector al tocar fuera
document.addEventListener('click',(e)=>{
  if(!_balMYOpen) return;
  const pop=document.getElementById('bal-my-pop');
  const title=document.getElementById('bal-title');
  if(pop && (pop.contains(e.target) || (title&&title.contains(e.target)))) return;
  _balMYOpen=false;
  if(pop) pop.classList.remove('open');
  if(title) title.classList.remove('open');
}, true);

function populateAnnualYear(){
  const sel=document.getElementById('bal-annual-year-sel');
  if(!sel) return;
  const years=yearsInData();
  sel.innerHTML=years.map(y=>`<option value="${y}"${y===viewYear?' selected':''}>${y}</option>`).join('');
  _balSyncTitle();
}

// Series visibles en la gráfica anual (se togglean con las leyendas)
let chartSeriesVisible = { ingreso:true, egreso:true, 'beneficio':true };

function toggleChartSeries(type){
  // Forzar mínimo una serie activa
  const activeCount = Object.values(chartSeriesVisible).filter(Boolean).length;
  if(chartSeriesVisible[type] && activeCount<=1) return; // no desactivar la última
  chartSeriesVisible[type] = !chartSeriesVisible[type];
  updateLegendStyles();
  renderAnnual();
}

function updateLegendStyles(){
  [['ingreso','legend-ingreso'],['egreso','legend-egreso'],['beneficio','legend-beneficio']].forEach(([type,id])=>{
    const el=document.getElementById(id);
    if(el) el.style.opacity = chartSeriesVisible[type] ? '1' : '0.35';
  });
}

function renderAnnual(){
  const sel=document.getElementById('bal-annual-year-sel');
  if(!sel) return;
  const yr=parseInt(sel.value);
  const chartEl=document.getElementById('annual-chart');
  const xaxisEl=document.getElementById('annual-xaxis');
  if(!chartEl||!xaxisEl) return;

  const ingData=Array.from({length:12},(_,m)=>sum(data.filter(e=>{if(isFutureEntry(e))return false;const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;}),'ingreso'));
  const egrData=Array.from({length:12},(_,m)=>sum(data.filter(e=>{if(isFutureEntry(e))return false;const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;}),'egreso'));
  const benData=Array.from({length:12},(_,m)=>sum(data.filter(e=>{if(isFutureEntry(e))return false;const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;}),'beneficio'));

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

  // R9 · Gráfica en BARRAS SUPERPUESTAS (Opción A del prototipo, aprobada):
  // cada mes es UNA columna; las series activas se anidan una dentro de otra
  // (egresos más angostos al frente, sobre ingresos), en vez de ir lado a
  // lado — así caben los 12 meses hasta en móvil. Los switches de leyenda
  // (misma lógica de siempre: chartSeriesVisible + candado de última serie)
  // deciden qué se dibuja, igual que en la gráfica agrupada anterior.
  let maxCandidates=[1];
  if(chartSeriesVisible.ingreso) maxCandidates.push(...ingData);
  if(chartSeriesVisible.egreso) maxCandidates.push(...egrData);
  if(chartSeriesVisible['beneficio']) maxCandidates.push(...benData);
  const maxVal=Math.max(...maxCandidates);

  const visibleSeries=['ingreso','egreso','beneficio'].filter(t=>chartSeriesVisible[t]);
  const n=visibleSeries.length||1;
  const colorMap={ingreso:'var(--green)',egreso:'var(--danger)','beneficio':'#af52de'};
  const dataMap={ingreso:ingData,egreso:egrData,'beneficio':benData};
  // Capas anidadas simétricas: con 1 serie ocupa el centro ancho; con 2-3 se
  // anidan hacia adentro (mismo patrón validado en el prototipo).
  const step=n>1 ? 28/(n-1) : 0;

  chartEl.innerHTML='';
  xaxisEl.innerHTML='';

  // R9 · corrección: la gráfica no tenía ninguna referencia de escala — se
  // reponen las líneas tenues + etiquetas de monto que ya existían antes de
  // la reescritura a barras superpuestas. Se dibujan primero (position:
  // absolute, no participan del flex de los meses) para quedar detrás.
  [0.25, 0.5, 0.75, 1].forEach(f=>{
    const line=document.createElement('div');
    line.className='annual-gridline';
    line.style.bottom=(f*100)+'%';
    const lbl=document.createElement('span');
    lbl.className='annual-gridlbl';
    lbl.textContent=_calFmtCompact(maxVal*f);
    line.appendChild(lbl);
    chartEl.appendChild(line);
  });

  Array.from({length:12}).forEach((_,m)=>{
    const hasRecords = ingData[m]>0 || egrData[m]>0 || benData[m]>0;
    const mo=document.createElement('div');
    mo.className='annual-mo'+(annualSelMonth===m?' sel':'');
    mo.style.cursor = hasRecords ? 'pointer' : 'default';
    visibleSeries.forEach((type,k)=>{
      const val=dataMap[type][m];
      if(val<=0) return;
      const hPct=(val/maxVal)*100;
      const inset = n===1 ? 8 : 8+k*step;
      const bar=document.createElement('div');
      bar.className='annual-bar';
      bar.style.height=hPct+'%';
      bar.style.left=inset+'%'; bar.style.right=inset+'%';
      bar.style.background=colorMap[type];
      mo.appendChild(bar);
    });
    mo.onclick=()=>{ if(hasRecords) showAnnualMonthDetail(m,yr); };
    chartEl.appendChild(mo);

    const xl=document.createElement('div');
    xl.className='annual-xl'+(annualSelMonth===m?' sel':'');
    xl.textContent=MONTHS_ES[m].slice(0,3);
    xaxisEl.appendChild(xl);
  });

  const lbl=document.getElementById('annual-month-lbl');
  const cats=document.getElementById('annual-cats');
  if(annualSelMonth===null&&lbl){ lbl.style.display='none'; cats.innerHTML=''; }
}

let annualDetailView = null; // 'ingreso' | 'egreso' | 'beneficio' | null

// R9 · encoge el monto de una tarjeta .stat en pasos de 1px si no cabe en su
// ancho asignado, hasta un piso — mismo patrón de "encoger antes de que se
// vea mal" que ya usa el treemap (_tryShrink). Debe llamarse DESPUÉS de que
// las tarjetas ya estén insertadas en el DOM (si no, clientWidth mide 0 y
// nunca detecta el desborde real).
function _shrinkStatVals(container, min){
  min = min || 12;
  container.querySelectorAll('.stat .val').forEach(val=>{
    let size=parseFloat(getComputedStyle(val).fontSize);
    while(val.scrollWidth > val.clientWidth + 0.5 && size > min){
      size -= 1;
      val.style.fontSize = size+'px';
    }
  });
}

function showAnnualMonthDetail(m,yr){
  annualSelMonth=m;
  annualDetailView=null; // resetear la tabla desglosada al cambiar de mes
  // R9 · Repinta la gráfica para que el mes elegido se marque visualmente
  // (.annual-mo.sel) — antes se guardaba annualSelMonth pero nada volvía a
  // pintar la gráfica con ese valor, así que el resalte nunca se veía.
  try{ renderAnnual(); }catch(e){}
  const lbl=document.getElementById('annual-month-lbl');
  const cats=document.getElementById('annual-cats');
  if(!lbl||!cats) return;
  lbl.style.display='block';
  lbl.textContent=`${MONTHS_ES[m]} ${yr}`;
  revealAnimate(lbl);
  cats.innerHTML='';

  const md=data.filter(e=>{const d=parseDate(e.date);return d.getMonth()===m&&d.getFullYear()===yr;});
  const ing=sum(md,'ingreso'),egr=sum(md,'egreso'),pas=sum(md,'beneficio');
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
    {k:'beneficio', lbl:'Beneficios', val:pas, cls:'a', show:pas>0},
  ].filter(it=>it.show);

  const n=items.length;
  cardsRow.style.cssText=`display:grid;grid-template-columns:repeat(${n||1},1fr);gap:6px;margin-bottom:8px;`;
  // Ajuste proporcional del tamaño de texto según cuántos tarjetones haya
  const valSize = n>=3 ? '18px' : '22px';

  items.forEach(it=>{
    const card=document.createElement('div');
    card.className='stat annual-detail-stat';
    // min-width:0 es necesario: sin esto, un monto largo (ej. "$55,194.81")
    // empuja la tarjeta más allá de su 1fr y las 3 tarjetas se corren a la
    // derecha en vez de quedar centradas — el grid nunca sabía que podía
    // pedirle a la tarjeta que se encogiera.
    card.style.cssText='cursor:pointer;text-align:center;min-width:0;';
    card.dataset.view=it.k;
    card.innerHTML=`<div class="lbl">${it.lbl}</div><div class="val ${it.cls}" style="font-size:${valSize};">${fmt(it.val)}</div>`;
    card.onclick=()=>toggleAnnualDetailView(it.k, m, yr);
    cardsRow.appendChild(card);
  });
  cats.appendChild(cardsRow);
  // Con min-width:0 la tarjeta ya no se estira, así que ahora si el monto no
  // cabe DE VERDAD se recorta — encoger su tamaño hasta que quepa (o hasta un
  // piso) evita que se vea cortado, igual que ya hacemos con los emojis del
  // treemap.
  _shrinkStatVals(cardsRow);

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
  const typeNames={ingreso:'Ingresos',egreso:'Egresos','beneficio':'Beneficios'};

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
