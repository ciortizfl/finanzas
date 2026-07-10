function forceReload(){
  const btn=document.getElementById('reload-btn');
  btn.classList.add('spinning');
  setTimeout(()=>btn.classList.remove('spinning'),600);
  loadFromSheets();
}
function sortedCats(type) {
  const cats = Object.keys(CATS[type]);
  const others = cats.filter(c=>c==='Otros');
  const rest = cats.filter(c=>c!=='Otros');
  rest.sort((a,b)=>{
    const ua = usage[`${type}:${a}`]||0;
    const ub = usage[`${type}:${b}`]||0;
    if(ub!==ua) return ub-ua;
    return a.localeCompare(b,'es');
  });
  return [...rest, ...others];
}

function sortedSubcats(type, cat) {
  const subs = CATS[type][cat];
  if(!subs||(subs.length===1&&subs[0]==='—')) return subs;
  const others = subs.filter(s=>s==='Otros');
  const rest = subs.filter(s=>s!=='Otros');
  rest.sort((a,b)=>{
    const ua = usage[`${type}:${cat}:${a}`]||0;
    const ub = usage[`${type}:${cat}:${b}`]||0;
    if(ub!==ua) return ub-ua;
    return a.localeCompare(b,'es');
  });
  return [...rest, ...others];
}

function trackUsage(type, cat, subcat) {
  const k1=`${type}:${cat}`;
  usage[k1]=(usage[k1]||0)+1;
  if(subcat) { const k2=`${type}:${cat}:${subcat}`; usage[k2]=(usage[k2]||0)+1; }
  localStorage.setItem(SK_USAGE, JSON.stringify(usage));
}

function yearsInData() {
  const now = new Date().getFullYear();
  const years = new Set([now]);
  data.forEach(e=>{
    if(isFutureEntry(e)) return; // no incluir años de mensualidades futuras aún ocultas
    const d=parseDate(e.date);
    if(!isNaN(d)) years.add(d.getFullYear());
  });
  return [...years].sort((a,b)=>b-a);
}

function populateSelectors() {
  const months = MONTHS_ES;
  const years = yearsInData();
  const now = new Date();

  ['hist','bal','bud'].forEach(prefix=>{
    const mSel=document.getElementById(`${prefix}-month-sel`);
    const ySel=document.getElementById(`${prefix}-year-sel`);
    if(!mSel||!ySel) return;
    const curM = prefix==='hist'? (mSel.value!==''?parseInt(mSel.value):now.getMonth()) : viewMonth;
    const curY = prefix==='hist'? (ySel.value!==''?parseInt(ySel.value):now.getFullYear()) : viewYear;
    mSel.innerHTML=months.map((m,i)=>`<option value="${i}"${i===curM?' selected':''}>${m}</option>`).join('');
    ySel.innerHTML=years.map(y=>`<option value="${y}"${y===curY?' selected':''}>${y}</option>`).join('');
  });
}

function onBalMonthChange() {
  const mSel=document.getElementById('bal-month-sel');
  const ySel=document.getElementById('bal-year-sel');
  if(mSel&&ySel){ viewMonth=parseInt(mSel.value); viewYear=parseInt(ySel.value); }
  clearBalView();
  renderBalance();
}

function localToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  if (!str) return new Date('invalid');
  const s = String(str).slice(0,10);
  const parts = s.split('-');
  if (parts.length === 3) return new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
  return new Date('invalid');
}

// Compara dos deferGroup de forma robusta (evita problemas number vs string
// que pueden surgir al ir y volver de Google Sheets).
function sameGroup(a,b){
  if(a==null || b==null) return false;
  return String(a)===String(b);
}

// Un registro es "futuro" si su fecha es posterior a hoy. Los gastos diferidos
// crean mensualidades futuras que NO deben mostrarse ni sumarse hasta que llegue
// su fecha. Se comparan por día (ignorando la hora).
function isFutureEntry(e){
  if(!e || !e.date) return false;
  const d=parseDate(e.date);
  if(isNaN(d.getTime())) return false;
  const today=new Date();
  today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d.getTime() > today.getTime();
}
