// ══════════════════════════════════════════════════════════════════════════
//  05b_treemap.js — Treemap de Balance (R9, Fase 2)
//
//  Vive DEBAJO de la tabla de las tarjetas Egresos / Ingresos / Beneficios
//  (Bono queda intacto). La tabla es el control: activar/desactivar categorías
//  o subcategorías reorganiza el treemap. Reutiliza catColor()/lighten() para
//  mantener exactamente la misma lógica de color y gradientes que tenía la dona.
//
//  Jerarquía: Egresos = Categoría → Subcategorías (gradiente por subcat).
//             Ingresos y Beneficios = plano (1 rectángulo por categoría).
// ══════════════════════════════════════════════════════════════════════════

const _TM_SEP = '\u0000';
// Conjunto de claves DESACTIVADAS (estado inicial: vacío = todo visible).
// Claves: 'Categoría' (planas / sin subcats) o 'Categoría\u0000Subcat'.
let _tmDeactivated = new Set();

function resetTreemap(){ _tmDeactivated = new Set(); }
function _tmSubKey(cat, sub){ return cat + _TM_SEP + sub; }

// ── Estructura de datos del tipo activo (mismo cálculo que renderBalanceCats) ──
// Devuelve [{cat, total, subs:[{sub,amt}], hasSubs}] ordenado por total desc.
function _tmBuildCatData(){
  const md = monthData();
  const subset = md.filter(e=>e.type===balView);
  const map = {}; // cat -> {total, subs:{sub:amt}}
  subset.forEach(e=>{
    if(!map[e.category]) map[e.category]={total:0, subs:{}};
    map[e.category].total += e.amountMXN;
    const s = e.subcategory || '—';
    map[e.category].subs[s] = (map[e.category].subs[s]||0) + e.amountMXN;
  });
  const isEgreso = balView==='egreso';
  return Object.entries(map).sort((a,b)=>b[1].total-a[1].total).map(([cat,{total,subs}])=>{
    const subEntries = Object.entries(subs).filter(([k])=>k!=='—').sort((a,b)=>b[1]-a[1]);
    const hasSubs = isEgreso && subEntries.length>0;
    return { cat, total, hasSubs, subs: subEntries.map(([sub,amt])=>({sub,amt})) };
  });
}

// ── Estado de un renglón para la tabla (●/○/◐) ──
// 'on' | 'off' | 'partial'
function tmCatState(cat, subList){
  if(subList && subList.length){
    const activos = subList.filter(s=>!_tmDeactivated.has(_tmSubKey(cat, s.sub)));
    if(activos.length===subList.length) return 'on';
    if(activos.length===0) return 'off';
    return 'partial';
  }
  return _tmDeactivated.has(cat) ? 'off' : 'on';
}
function tmIsSubOff(cat, sub){ return _tmDeactivated.has(_tmSubKey(cat, sub)); }

// ── Toggles (los invoca la tabla) ──
function toggleTmCat(cat, subList){
  const st = tmCatState(cat, subList);
  if(subList && subList.length){
    if(st==='off') subList.forEach(s=>_tmDeactivated.delete(_tmSubKey(cat, s.sub)));      // encender todo
    else           subList.forEach(s=>_tmDeactivated.add(_tmSubKey(cat, s.sub)));         // apagar todo
  } else {
    if(_tmDeactivated.has(cat)) _tmDeactivated.delete(cat); else _tmDeactivated.add(cat);
  }
  renderBalanceTreemap();
}
function toggleTmSub(cat, sub){
  const k=_tmSubKey(cat, sub);
  if(_tmDeactivated.has(k)) _tmDeactivated.delete(k); else _tmDeactivated.add(k);
  renderBalanceTreemap();
}

// ── Hojas visibles del treemap según el estado de activación ──
function _tmLeaves(){
  const cats = _tmBuildCatData();
  const leaves = [];
  cats.forEach(c=>{
    const base = catColor(c.cat);
    if(c.hasSubs){
      c.subs.forEach((s, i)=>{
        if(_tmDeactivated.has(_tmSubKey(c.cat, s.sub))) return;
        const color = lighten(base, 0.25 + (i/Math.max(c.subs.length-1,1))*0.45);
        leaves.push({ cat:c.cat, sub:s.sub, amt:s.amt, color,
                      emoji: ICONS[s.sub] || ICONS[c.cat] || '📌' });
      });
    } else {
      if(_tmDeactivated.has(c.cat)) return;
      leaves.push({ cat:c.cat, sub:c.cat, amt:c.total, color:base,
                    emoji: ICONS[c.cat] || '📌' });
    }
  });
  return leaves;
}

// ── Formato de montos ──
function _tmFmt0(n){ return '$'+Math.round(Math.abs(n)).toLocaleString('es-MX'); }
// Abreviado: máximo 2 enteros y 1 decimal (1k, 2.3k, 15k, 98.5k). Solo tiene
// sentido para |n| >= 1000; por debajo, la abreviación no ahorra espacio.
function _tmAbbrev(n){
  const a=Math.abs(n);
  if(a<1000) return null;
  const v=a/1000, r=Math.round(v*10)/10;
  return (r%1===0 ? String(Math.round(r)) : r.toFixed(1)) + 'k';
}

// ── Squarified treemap (Bruls/Huizing/van Wijk) ──
function _tmWorst(row, side){
  const sum=row.reduce((s,d)=>s+d.area,0);
  const mx=Math.max(...row.map(d=>d.area)), mn=Math.min(...row.map(d=>d.area));
  const s2=side*side;
  return Math.max((s2*mx)/(sum*sum), (sum*sum)/(s2*mn));
}
function _tmSquarify(items, x, y, w, h){
  items=items.filter(d=>d.value>0);
  if(!items.length||w<=0||h<=0) return [];
  const total=items.reduce((s,d)=>s+d.value,0);
  const scale=(w*h)/total;
  const q=items.map(d=>({...d, area:d.value*scale}));
  const rects=[]; let cx=x,cy=y,cw=w,ch=h,i=0;
  while(i<q.length){
    const side=Math.min(cw,ch);
    let row=[q[i]], rowArea=q[i].area, best=_tmWorst(row,side), j=i+1;
    while(j<q.length){
      const cand=row.concat([q[j]]), wr=_tmWorst(cand,side);
      if(wr<=best){ row=cand; rowArea+=q[j].area; best=wr; j++; } else break;
    }
    const thick=rowArea/side;
    if(cw>=ch){ let ry=cy; row.forEach(it=>{ const ih=it.area/thick; rects.push({item:it,x:cx,y:ry,w:thick,h:ih}); ry+=ih; }); cx+=thick; cw-=thick; }
    else       { let rx=cx; row.forEach(it=>{ const iw=it.area/thick; rects.push({item:it,x:rx,y:cy,w:iw,h:thick}); rx+=iw; }); cy+=thick; ch-=thick; }
    i=j;
  }
  return rects;
}

// ── Tooltip ──
let _tmTip=null;
function _tmCloseTip(){ if(_tmTip){ _tmTip.el.remove(); _tmTip=null; } }
function _tmToggleTip(cellEl, leaf){
  if(_tmTip && _tmTip.owner===cellEl){ _tmCloseTip(); return; }
  _tmCloseTip();
  const canvas=document.getElementById('bal-treemap');
  if(!canvas) return;
  const b=document.createElement('div');
  b.className='tm-tooltip';
  b.innerHTML=`<div class="tm-tt-top"><span>${leaf.emoji}</span><span class="tm-tt-cat">${leaf.cat}</span></div>
    ${leaf.sub!==leaf.cat?`<div class="tm-tt-sub">${leaf.sub}</div>`:''}
    <div class="tm-tt-amt">${_tmFmt0(leaf.amt)}</div>`;
  b.onclick=()=>_tmCloseTip();
  canvas.appendChild(b);
  const cr=cellEl.getBoundingClientRect(), pr=canvas.getBoundingClientRect();
  const bw=b.offsetWidth, bh=b.offsetHeight;
  const CW=canvas.clientWidth, CH=canvas.clientHeight;
  const PAD=6, GAP=8;
  // Coordenadas de la celda relativas al lienzo del treemap
  const cxL=cr.left-pr.left, cxR=cr.right-pr.left;
  const cyT=cr.top-pr.top,  cyB=cr.bottom-pr.top;
  const cxC=cxL+cr.width/2, cyC=cyT+cr.height/2;
  const clamp=(v,min,max)=>Math.max(min, Math.min(v, max));

  // La burbuja SIEMPRE debe quedar dentro del treemap. Se prueban los cuatro
  // lados y se elige el primero donde quepa completa; si ninguno cabe (celdas
  // muy altas o muy anchas), se centra sobre la celda y se acota al lienzo.
  const cands=[
    {name:'arriba',   fits: cyT-GAP-bh>=PAD,      top: cyT-GAP-bh,  left: cxC-bw/2},
    {name:'abajo',    fits: cyB+GAP+bh<=CH-PAD,   top: cyB+GAP,     left: cxC-bw/2},
    {name:'derecha',  fits: cxR+GAP+bw<=CW-PAD,   top: cyC-bh/2,    left: cxR+GAP},
    {name:'izquierda',fits: cxL-GAP-bw>=PAD,      top: cyC-bh/2,    left: cxL-GAP-bw}
  ];
  const pick = cands.find(c=>c.fits) || {top: cyC-bh/2, left: cxC-bw/2};
  b.style.left = clamp(pick.left, PAD, Math.max(PAD, CW-PAD-bw)) + 'px';
  b.style.top  = clamp(pick.top,  PAD, Math.max(PAD, CH-PAD-bh)) + 'px';
  _tmTip={el:b, owner:cellEl};
}
// Cerrar al tocar fuera o sobre cualquier otro control interactivo
document.addEventListener('click',(e)=>{
  if(!_tmTip) return;
  if(_tmTip.el.contains(e.target)) return;
  if(_tmTip.owner.contains(e.target)) return;
  _tmCloseTip();
}, true);

// ── ¿Cabe el contenido dentro del recuadro, RESPETANDO su padding? ──
// clientHeight/Width ya incluyen el padding, así que comparar scrollHeight contra
// clientHeight no detecta cuando flexbox comprime el contenido y lo saca del
// padding (emojis pegados a la orilla). Medimos la suma real de los hijos contra
// el área interior (client − padding) para exigir aire por los cuatro lados.
function _tmFits(el){
  const cs=getComputedStyle(el);
  const padY=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
  const padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
  const availH=el.clientHeight-padY, availW=el.clientWidth-padX;
  if(availH<=0||availW<=0) return false;
  const gap=parseFloat(cs.gap)||0;
  const kids=[...el.children];
  if(!kids.length) return true;
  // R9 · punto 1: en el layout apaisado (.tm-wide) los hijos se acomodan en
  // FILA (emoji | texto), así que el eje que se SUMA es el ancho y el que se
  // toma como máximo es el alto — al revés que en la pila vertical de siempre.
  const isRow = cs.flexDirection==='row' || cs.flexDirection==='row-reverse';
  let needH=0, needW=0;
  if(isRow){
    needW=gap*(kids.length-1);
    kids.forEach(k=>{ needW+=k.scrollWidth; needH=Math.max(needH, k.offsetHeight); });
  } else {
    needH=gap*(kids.length-1);
    kids.forEach(k=>{ needH+=k.offsetHeight; needW=Math.max(needW, k.scrollWidth); });
  }
  return needH<=availH+0.5 && needW<=availW+0.5;
}

// ── Render principal ──
function renderBalanceTreemap(){
  const wrap=document.getElementById('bal-treemap-wrap');
  const canvas=document.getElementById('bal-treemap');
  if(!wrap||!canvas) return;
  _tmCloseTip();

  // Solo para vistas con treemap (egreso/ingreso/beneficio). Bono/ahorro: oculto.
  const showTM = balView==='egreso'||balView==='ingreso'||balView==='beneficio';
  if(!showTM){ wrap.style.display='none'; canvas.innerHTML=''; return; }
  wrap.style.display='';

  const leaves=_tmLeaves();
  canvas.innerHTML='';
  if(!leaves.length){
    canvas.innerHTML='<div class="tm-empty">Nada seleccionado</div>';
    return;
  }

  const w=canvas.clientWidth, h=canvas.clientHeight;
  const rects=_tmSquarify(leaves.map(l=>({value:l.amt, ref:l})), 0, 0, w, h);
  const GAP=3;
  rects.forEach(r=>{
    const l=r.item.ref;
    const cell=document.createElement('div');
    cell.className='tm-cell';
    cell.style.left=(r.x+GAP/2)+'px'; cell.style.top=(r.y+GAP/2)+'px';
    cell.style.width=Math.max(0,r.w-GAP)+'px'; cell.style.height=Math.max(0,r.h-GAP)+'px';
    cell.style.background=l.color; cell.style.color=_tmTextColor(l.color);
    const inner=document.createElement('div'); inner.className='tm-inner';
    cell.appendChild(inner); canvas.appendChild(cell);

    // Nivel 1: emoji + subcategoría + monto
    const showSubLine = l.sub!==l.cat; // en planos (ingreso/beneficio) sub==cat: no repetir
    inner.innerHTML=`<div class="tm-emoji">${l.emoji}</div>`+
      (showSubLine?`<div class="tm-sub">${l.sub}</div>`:`<div class="tm-sub">${l.cat}</div>`)+
      `<div class="tm-amt">${_tmFmt0(l.amt)}</div>`;
    let tier=1;
    if(!_tmFits(inner)){
      // Nivel 1-apaisado (solo si el rectángulo es más ancho que alto): antes de
      // perder la subcategoría, probar emoji a la izquierda + subcategoría y
      // monto en dos líneas a la derecha. El conjunto queda centrado por el
      // propio .tm-inner (justify-content/align-items:center); el emoji se
      // centra verticalmente respecto a esas dos líneas por ser flex row.
      let wideFits=false;
      if(r.w > r.h){
        inner.classList.add('tm-wide');
        inner.innerHTML=`<div class="tm-emoji">${l.emoji}</div><div class="tm-text">`+
          (showSubLine?`<div class="tm-sub">${l.sub}</div>`:`<div class="tm-sub">${l.cat}</div>`)+
          `<div class="tm-amt">${_tmFmt0(l.amt)}</div></div>`;
        wideFits=_tmFits(inner);
        if(wideFits) tier='1w';
        else inner.classList.remove('tm-wide');
      }
      if(!wideFits){
      // Nivel 2: emoji + monto
      inner.innerHTML=`<div class="tm-emoji">${l.emoji}</div><div class="tm-amt">${_tmFmt0(l.amt)}</div>`;
      tier=2;
      if(!_tmFits(inner)){
        // Nivel 3: emoji + monto abreviado
        const ab=_tmAbbrev(l.amt);
        if(ab){ inner.innerHTML=`<div class="tm-emoji">${l.emoji}</div><div class="tm-amt">${ab}</div>`; tier=3; }
        if(!ab || !_tmFits(inner)){
          // Nivel 4: solo emoji
          inner.innerHTML=`<div class="tm-emoji tm-emoji-big">${l.emoji}</div>`; tier=4;
          if(!_tmFits(inner)){ inner.innerHTML=''; tier=5; } // Nivel 5: solo color
        }
      }
      }
    }
    // Clickeable (con tooltip) cuando NO alcanza a mostrar emoji+subcat+monto juntos
    if(tier!==1 && tier!=='1w'){
      cell.classList.add('tm-clickable');
      cell.onclick=()=>_tmToggleTip(cell, l);
    }
  });
}

// Texto blanco o negro según luminancia del fondo (contraste adecuado)
function _tmTextColor(hex){
  const [r,g,b]=hexToRgb(hex);
  const lum=(0.299*r+0.587*g+0.114*b)/255;
  return lum>0.62 ? '#1d1d1f' : '#ffffff';
}

// Repintar el treemap cuando cambia el tamaño del contenedor (rotación, resize).
(function(){
  let ro=null;
  function attach(){
    const canvas=document.getElementById('bal-treemap');
    if(canvas && !ro){
      ro=new ResizeObserver(()=>{ if(balView) requestAnimationFrame(renderBalanceTreemap); });
      ro.observe(canvas);
    }
  }
  if(document.readyState!=='loading') attach();
  else document.addEventListener('DOMContentLoaded', attach);
})();
