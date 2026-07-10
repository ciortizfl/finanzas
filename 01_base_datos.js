const SK = 'finanzas_v3';
const SK_USAGE = 'finanzas_usage';
let data = JSON.parse(localStorage.getItem(SK)||'[]');
let usage = JSON.parse(localStorage.getItem(SK_USAGE)||'{}');

// ── Migración de nombres legacy ──────────────────────────────────────────
const _migrations = {
  category: {
    'Puntos de tarjeta de crédito': 'Puntos TDC',
    'Puntos de Tarjeta de Crédito': 'Puntos TDC',
    'Puntos tarjeta': 'Puntos TDC',
    'Puntos': 'Puntos de lealtad',
  }
};

// Deduplica partes de metadata repetidas en una nota (ej. "Monto original" dos veces).
function dedupeNoteMeta(note){
  if(!note) return note;
  const parts=note.split(' | ').map(p=>p.trim()).filter(Boolean);
  const seen=new Set();
  const out=[];
  parts.forEach(p=>{
    const isMeta = p.startsWith('Monto original:') || p.startsWith('Desglose de:') || p.startsWith('TC:');
    if(isMeta){
      if(!seen.has(p)){ seen.add(p); out.push(p); }
    } else {
      out.push(p);
    }
  });
  return out.join(' | ');
}

let _migrated = false;
data.forEach(e => {
  if(_migrations.category[e.category]){
    e.category = _migrations.category[e.category];
    _migrated = true;
  }
  // Limpiar notas con metadata duplicada (de versiones anteriores)
  if(e.note){
    const deduped=dedupeNoteMeta(e.note);
    if(deduped!==e.note){ e.note=deduped; _migrated=true; }
  }
});
if(_migrated) localStorage.setItem(SK, JSON.stringify(data));
// ────────────────────────────────────────────────────────────────────────
let curType = 'ingreso';
let curCat = '';
let selMethod = 'Tarjeta de crédito';
let benOn = false;
let histFilter = 'todos';
let histSelCats = [];
let histSelSubcats = [];
let histMethodFilter = null; // null = all methods

function clearSearch(){
  const s=document.getElementById('hist-search');
  if(s) s.value='';
  document.getElementById('hist-search-clear').style.display='none';
  document.getElementById('hist-date-row').style.display='flex';
  renderHistorial();
}

function toggleMethodFilters(){
  const row=document.getElementById('method-filter-row');
  const arrow=document.getElementById('method-filter-arrow');
  const isOpen = row.style.display !== 'none';
  row.style.display = isOpen ? 'none' : 'block';
  if(arrow) arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
}

// Ajusta el filtro de método de pago según los métodos realmente presentes en el
// conjunto que se está viendo (fecha/rango + búsqueda + tipo + categorías).
// - Si hay 0 o 1 método distinto: oculta el botón "Método" (no aporta filtrar).
// - Si hay varios: muestra solo los chips de esos métodos, oculta los demás.
function updateMethodFilterChips(visibleEntries){
  const toggleBtn=document.getElementById('method-filter-toggle-btn');
  const row=document.getElementById('method-filter-row');
  if(!toggleBtn) return;
  const methodsPresent=new Set((visibleEntries||[]).map(e=>e.method).filter(Boolean));
  // Etiqueta → valor de método (para casar chips)
  const chipMap={
    'Tarjeta de crédito':'Tarjeta de crédito','Efectivo':'Efectivo',
    'Débito':'Débito','SPEI':'SPEI','Bono de despensa':'Bono de despensa'
  };
  if(methodsPresent.size<=1){
    // No aporta filtrar: ocultar botón y panel, y limpiar cualquier filtro activo
    toggleBtn.style.display='none';
    if(row) row.style.display='none';
    if(histMethodFilter){ histMethodFilter=null; updateMethodIndicator(); }
    return;
  }
  toggleBtn.style.display='';
  // Mostrar solo los chips de métodos presentes
  const chips=document.querySelectorAll('#method-filter-row .f-chip');
  chips.forEach(chip=>{
    const id=chip.id;
    if(id==='method-filter-all'){ chip.style.display=''; return; } // "Todos" siempre
    // Deducir el método del onclick
    const oc=chip.getAttribute('onclick')||'';
    const match=oc.match(/setMethodFilter\('([^']+)'/);
    const method=match?match[1]:null;
    chip.style.display = (method && methodsPresent.has(method)) ? '' : 'none';
  });
}

function updateMethodIndicator(){
  const dot=document.getElementById('method-filter-indicator');
  if(!dot) return;
  dot.style.background = histMethodFilter ? 'var(--accent)' : 'var(--border2)';
}

function setMethodFilter(method, btn){
  histMethodFilter=method;
  document.querySelectorAll('#method-filter-row .f-chip').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  else document.getElementById('method-filter-all')?.classList.add('active');
  updateMethodIndicator();
  updateResetButton();
  renderHistorial();
}
let viewMonth = new Date().getMonth();
let viewYear  = new Date().getFullYear();
let rates = {USD:17.2, CAD:12.6, EUR:18.5};
let ratesLoaded = false;
