// ════════════════════════════════════════════
// BASE DE DATOS Y ESTADO
// ════════════════════════════════════════════

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
    // R8: tipo de beneficio renombrado por consistencia con "Otros (x)".
    // R10: la etiqueta canónica pasó a mayúscula inicial: 'Otros (Beneficios)'.
    // Se auto-normalizan la variante vieja y la minúscula (registros históricos).
    'Otros beneficios': 'Otros (Beneficios)',
    'Otros (beneficios)': 'Otros (Beneficios)',
  },
  // R7.2: la subcategoría se llama "Propina" (singular) en toda la app.
  subcategory: {
    'Propinas': 'Propina',
  }
};

// Aplica las migraciones de nombres a UN registro. Se usa al arrancar (cache
// local) Y al cargar desde Sheets, para que los registros históricos con el
// nombre viejo se muestren y comporten con el nombre nuevo en toda la app.
function applyNameMigrations(e){
  let changed=false;
  if(_migrations.category[e.category]){ e.category=_migrations.category[e.category]; changed=true; }
  if(_migrations.subcategory[e.subcategory]){ e.subcategory=_migrations.subcategory[e.subcategory]; changed=true; }
  return changed;
}

// ══════════════════════════════════════════════════════════════════════════
// R6 · MODELO DE DATOS — CAPA DE LECTURA (Entrega A)
//
// Única fuente de verdad de la relación de un registro con su padre y de sus
// datos de sistema. HOY los deriva de las etiquetas escondidas en la nota
// (formato viejo). En la Entrega B, `_deriveMeta` dejará de parsear texto y
// leerá la columna `meta` del Sheet — y NINGÚN consumidor tendrá que cambiar,
// porque todos preguntan aquí y no al texto.
//
// Contrato de meta (llaves ausentes cuando no aplican):
//   rel      'desglose' | 'propina' | 'beneficio'   relación con el padre
//   fxAuto   número        TC automático del momento (solo si hubo TC manual)
//   ben      {pct, base}   beneficio capturado como %
//   benMonth {i, n}        beneficio acreditado en la mensualidad i de n
//   tip      {pct|amt, inc, base}                   propina
//   defer    {g, i, n, orig}                        gasto diferido
//   userNote string        la nota REAL del usuario, sin etiquetas
// ══════════════════════════════════════════════════════════════════════════
const _META_CACHE = new WeakMap();
const _num = s => parseFloat(String(s).replace(/,/g,''));

function _deriveMeta(e){
  const m = {};
  const user = [];
  String(e.note||'').split(' | ').map(p=>p.trim()).filter(Boolean).forEach(p=>{
    let x;
    // ── Relación con el padre ──
    if(p.startsWith('Desglose de:')){  m.rel='desglose';  return; }
    if(p.startsWith('Beneficio de:')){ m.rel='beneficio'; return; }
    if(p.startsWith('Propina de:')){   m.rel='propina';   return; }
    if(p.startsWith('Vinculado a:')){  m.rel='beneficio'; return; } // nombre viejo de "Beneficio de:"
    // ── Etiquetas muertas: el render ya las calcula solo ──
    if(p.startsWith('Monto original:')) return;
    if(p.startsWith('TC:')) return;                       // derivable de amountMXN/amount
    // ── Datos de sistema que SÍ importan ──
    if((x=p.match(/^TCauto:\s*([\d.]+)$/))){
      const v=parseFloat(x[1]); if(isFinite(v)&&v>0) m.fxAuto=v; return;
    }
    if((x=p.match(/^acreditado en la mensualidad\s+(\d+)\s+de\s+(\d+)$/i))){
      m.benMonth={i:+x[1], n:+x[2]}; return;
    }
    if((x=p.match(/^(\d+(?:\.\d+)?)%\s+de\s+\D*([\d,]+\.?\d*)$/))){
      m.ben={pct:parseFloat(x[1]), base:_num(x[2])}; return;
    }
    // Propina, formato actual (en el hijo): "15% incluida en $1,045.35" / "incluida"
    if((x=p.match(/^(\d+(?:\.\d+)?)%\s+(incluida|adicional)(?:\s+en\s+\D*([\d,]+\.?\d*))?$/i))){
      m.tip={pct:parseFloat(x[1]), inc:x[2].toLowerCase()==='incluida'};
      if(x[3]) m.tip.base=_num(x[3]);
      return;
    }
    if((x=p.match(/^(incluida|adicional)$/i))){
      m.tip={inc:x[1].toLowerCase()==='incluida'}; return;
    }
    // Propina, formatos legacy (escritos en la MADRE). Tres variantes vistas en
    // datos reales, unificadas aquí:
    //   "Propina 15% incluida en $1886.00"
    //   "Propina incluida = $50.00 (total cobrado: $325.00)"
    //   "Propina 15% incluida = $136.35 (total cobrado: $1045.35)"
    if((x=p.match(/^Propina\s+(?:(\d+(?:\.\d+)?)%\s+)?(incluida|adicional)(?:\s*=\s*(?:[A-Z]{3}\s*)?\$?([\d,]+\.?\d*))?(?:\s*\(total cobrado:\s*(?:[A-Z]{3}\s*)?\$?([\d,]+\.?\d*)\))?(?:\s+en\s+(?:[A-Z]{3}\s*)?\$?([\d,]+\.?\d*))?$/i))){
      m.tip={inc:x[2].toLowerCase()==='incluida'};
      if(x[1]) m.tip.pct=parseFloat(x[1]);
      if(x[3]) m.tip.amt=_num(x[3]);
      if(x[4]) m.tip.base=_num(x[4]);
      else if(x[5]) m.tip.base=_num(x[5]);
      return;
    }
    user.push(p);  // ── lo que sobrevive es la nota del usuario ──
  });

  // Hijos legacy sin etiqueta (propinas viejas): la relación se infiere.
  if(e.linkedTo && !m.rel){
    if(e.subcategory==='Propina' || e.subcategory==='Propinas') m.rel='propina';
    else if(e.type==='beneficio' || e.type==='ahorro-pasivo') m.rel='beneficio';
    else                                  m.rel='desglose';
  }
  if(e.deferGroup){
    m.defer={g:e.deferGroup, i:e.deferIndex, n:e.deferTotal, orig:e.deferOriginal};
  }
  m.userNote = user.join(' | ');
  return m;
}

// metaOf(e) — cachea por objeto; se recalcula si la nota cambió.
// R6/B: si el registro YA trae `meta` (formato nuevo), se usa tal cual y NUNCA
// se parsea texto. Las etiquetas solo se derivan para registros legacy que
// todavía no pasaron por la migración.
function metaOf(e){
  if(!e || typeof e!=='object') return {};
  if(e.meta && typeof e.meta==='object'){
    const m={...e.meta};
    if(e.deferGroup) m.defer={g:e.deferGroup, i:e.deferIndex, n:e.deferTotal, orig:e.deferOriginal};
    m.userNote=String(e.note||'').trim();
    return m;
  }
  const cached=_META_CACHE.get(e);
  if(cached && cached._src===e.note) return cached;
  const m=_deriveMeta(e);
  m._src=e.note;
  _META_CACHE.set(e, m);
  return m;
}

// Atajos legibles — los consumidores usan ESTO, nunca e.note.
function relOf(e){       return metaOf(e).rel || null; }
function isDesglose(e){  return relOf(e)==='desglose'; }
function isPropina(e){   return relOf(e)==='propina'; }
function isBeneficio(e){ return relOf(e)==='beneficio'; }
function userNote(e){    return metaOf(e).userNote || ''; }
// Limpia una nota SUELTA (string), sin objeto de registro alrededor.
function cleanNoteStr(note){ return _deriveMeta({note}).userNote; }

// ══════════════════════════════════════════════════════════════════════════
// R7 · MONTO ORIGINAL — punto ÚNICO de verdad
//
// La madre guarda el NETO: al guardar se le restan los desgloses, la propina
// incluida y el descuento aplicado (04_guardado_sync). Reconstruir "lo que
// tecleaste" exige devolverle esas piezas.
//
// Ese cálculo vivía DUPLICADO en openEdit (08) y en el render del historial
// (06), y las dos copias YA se habían desincronizado: una sumaba la propina
// incluida y la otra no. La predicción (02) leía e.amount crudo — y de ahí
// salía el bug de izzi (predecía 741, el remanente, en vez de 1070).
//
//   cargoBrutoDe(e) → lo que se cobró en ESTE registro madre, antes de partirlo.
//   origAmountOf(e) → total de la COMPRA. Igual al anterior, salvo en un
//                     diferido: ahí es el total de los N meses, no la mensualidad.
//
// R5: el beneficio solo se suma de vuelta si REDUJO el gasto (descuento
// aplicado). El cashback nunca lo redujo — sumarlo inflaba el monto.
// ══════════════════════════════════════════════════════════════════════════
function _hijosDe(id){ return data.filter(x=>x.linkedTo===id); }

function cargoBrutoDe(e){
  if(!e || typeof e!=='object') return 0;
  if(e.linkedTo) return e.amount;          // un hijo no tiene "monto original"
  const hijos = _hijosDe(e.id);
  let t = e.amount;
  hijos.filter(isDesglose).forEach(d=>{ t += d.amount; });
  // Propina INCLUIDA: formaba parte del cobro, hay que devolverla.
  // La adicional no: se pagó aparte y nunca redujo la madre.
  const prop = (e.type==='egreso') ? hijos.find(isPropina) : null;
  const propMeta = prop ? metaOf(prop) : null;
  if(propMeta && propMeta.tip && propMeta.tip.inc) t += prop.amount;
  // R7.2: TODO beneficio es un descuento aplicado (Cashback ya no existe como
  // beneficio), así que siempre redujo el gasto y siempre se devuelve. Puede
  // haber VARIOS beneficios por egreso: se suman todos. En un diferido el
  // descuento redujo el total ANTES de prorratear, no esta mensualidad.
  if(!e.deferGroup){
    hijos.filter(x=>x.type==='beneficio').forEach(b=>{ t += b.amount; });
  }
  return +t.toFixed(2);
}

function origAmountOf(e){
  if(!e || typeof e!=='object') return 0;
  if(e.linkedTo) return e.amount;
  if(e.deferGroup && e.deferOriginal){
    // deferOriginal ya trae el descuento restado ANTES de prorratear: se suman
    // de vuelta TODOS los beneficios del grupo para llegar a lo que escribiste.
    let t = e.deferOriginal;
    const ids = data.filter(x=>sameGroup(x.deferGroup, e.deferGroup)).map(x=>x.id);
    data.filter(x=>ids.includes(x.linkedTo) && x.type==='beneficio')
        .forEach(b=>{ t += b.amount; });
    return +t.toFixed(2);
  }
  return cargoBrutoDe(e);
}

// Nombres PROPIOS de los desgloses de una madre (los que no heredaron su nombre).
// Es lo que la predicción necesita saber: "izzi siempre trae un Netflix adentro".
function desgloseNamesOf(e){
  if(!e || e.linkedTo) return [];
  const madre = (e.desc||'').trim().toLowerCase();
  const out = new Set();
  _hijosDe(e.id).filter(isDesglose).forEach(d=>{
    const n = (d.desc||'').trim();
    if(n && n.toLowerCase() !== madre) out.add(n);
  });
  return [...out];
}

let _migrated = false;
data.forEach(e => {
  if(applyNameMigrations(e)) _migrated = true;
  // R6.5: 'ahorro-pasivo' → 'beneficio' (nombre viejo del mismo tipo)
  if(e.type==='ahorro-pasivo'){ e.type='beneficio'; _migrated=true; }
  // R6: ya no se "limpia" la nota al arranque. Las etiquetas duplicadas se
  // descartan al derivar el meta (metaOf), sin reescribir el registro guardado.
});
if(_migrated) localStorage.setItem(SK, JSON.stringify(data));
// ────────────────────────────────────────────────────────────────────────
let curType = 'ingreso';
let curCat = '';
let selMethod = '';
// R9 · punto 9: mapa único completo/abreviado para el selector de Método
// (Registro y Edición). Móvil usa el abreviado para que quepa como valor
// elegido sin desbordar; escritorio usa el nombre completo. Misma frontera
// que separa escritorio/móvil en CSS (700px).
const METHOD_LABELS = {
  'Tarjeta de crédito': { full:'Tarjeta de crédito', short:'Crédito' },
  'Efectivo':           { full:'Efectivo',           short:'Efectivo' },
  'Bono de despensa':   { full:'Bono de despensa',   short:'Bono' },
  'SPEI':               { full:'SPEI',               short:'SPEI' },
  'Débito':             { full:'Débito',             short:'Débito' }
};
function _methodIsWide(){ return window.matchMedia && window.matchMedia('(min-width: 700px)').matches; }
// R7.2: benOn desapareció — el estado vive en el arreglo `beneficios` (02_registro).
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


// ════════════════════════════════════════════
// CATEGORÍAS, ÍCONOS Y EMOJIS
// ════════════════════════════════════════════

const CATS = {
  ingreso: {
    'Sueldo':['—'],'Bono de despensa':['—'],'Cashback':['—'],
    'Reembolsos':['—'],'Rendimientos':['—'],'Ventas':['—'],
    'Regalos recibidos':['—'],'Otros (Ingresos)':['—']
  },
  egreso: {
    'Hogar':      ['Renta','Hipoteca','Mantenimiento','Servicios','Seguridad','Muebles y decoración','Servicio de limpieza','Equipamiento','Otros (Hogar)'],
    'Personal':   ['Salud y médicos','Dentista','Medicamentos','Gimnasio','Ropa y calzado','Cuidado personal','Educación','Finanzas / Impuestos','Compras personales','Otros (Personal)'],
    'Alimentos':  ['Despensa','Restaurantes y cafés','Comida rápida','Snacks','Otros (Alimentos)'],
    'Ocio':       ['Cine','Espectáculos y conciertos','Bares y antros','Videojuegos','Suscripciones','Renta y venta digital','Museos','Media física','Otros (Ocio)'],
    'Transporte': ['Gasolina','Taxi y apps','Transporte público','Mantenimiento de auto','Seguro de auto','Estacionamiento','Autopartes','Autolavado','Trámites vehiculares','Otros (Transporte)'],
    'Viajes':     ['Vuelos','Otros transportes','Hospedaje','Renta de auto','Actividades y tours','Paquetes / agencia','Seguro de viaje','Otros (Viajes)'],
    'Mascotas':   ['Alimento de mascota','Veterinario','Accesorios y juguetes','Estética canina','Medicamentos veterinarios','Guardería','Otros (Mascotas)'],
    'Generosidad':['Regalos','Donativos','Propina','Préstamos','Otros (Generosidad)']
  },
  'beneficio': {} // Se llena dinámicamente desde BEN_TYPES (ver más abajo)
};

const ICONS = {
  'Hogar':'🏠','Casa':'🏠','Personal':'👤','Alimentos':'🍽️','Ocio':'🎬','Transporte':'🚗',
  'Viajes':'🧳',
  'Mascotas':'🐾','Generosidad':'🤲','Sueldo':'💲','Bono de despensa':'🛒',
  'Reembolsos':'↩️',
  'Rendimientos':'📈','Ventas':'🛍️','Regalos':'🎁','Regalos recibidos':'🎁',
  'Cashback':'💳','Puntos TDC':'💎',
  'Puntos de lealtad':'⭐','Millas aéreas':'✈️','Descuentos y promociones':'🏷️','Otros (Beneficios)':'🫰','Otros (beneficios)':'🫰','Otros beneficios':'🎁','Descuento':'🏷️','Otro beneficio':'🎁',
  'Renta':'🏘️','Hipoteca':'🔑','Mantenimiento':'🔧','Servicios':'⚡',
  'Seguridad':'🔒','Muebles y decoración':'🛋️','Servicio de limpieza':'🧹',
  'Equipamiento':'📦','Salud y médicos':'🏥','Dentista':'🦷','Medicamentos':'💊','Gimnasio':'💪','Finanzas / Impuestos':'🧾',
  'Ropa y calzado':'👕','Cuidado personal':'💆‍♂️','Educación':'📚',
  'Compras personales':'🛍️','Despensa':'🥚','Restaurantes y cafés':'🍴',
  'Comida rápida':'🍔','Snacks':'🍿','Cine':'🎞️',
  'Espectáculos y conciertos':'🎤','Bares y antros':'🕺','Videojuegos':'🎮',
  'Suscripciones':'📱','Renta y venta digital':'📼','Museos':'🏛️',
  'Media física':'📀','Gasolina':'⛽','Taxi y apps':'🚕','Taxi y apps de transporte':'🚕','Uber / taxi':'🚕',
  'Transporte público':'🚌','Mantenimiento de auto':'🛠️','Seguro de auto':'🛡️',
  'Estacionamiento':'🅿️','Autolavado':'🚿','Trámites vehiculares':'📋','Autopartes':'⚙️',
  'Vuelos':'🛫','Otros transportes':'⛴️','Hospedaje':'🏨','Renta de auto':'🚙','Actividades y tours':'🎟️','Paquetes / agencia':'🧭','Seguro de viaje':'🛟',
  'Otros pasajes':'🎫',
  'Alimento de mascota':'🍖','Comida':'🍖',
  'Veterinario':'💉','Accesorios y juguetes':'🦴','Estética canina':'✂️','Estética / grooming':'✂️','Medicamentos veterinarios':'💊','Guardería':'🛏️',
  'Donativos':'❤️','Propina':'🪙','Propinas':'🪙','Préstamos':'🤝',
  'Dinero electrónico':'📲',
  'Otros (Hogar)':'📌','Otros (Casa)':'📌','Otros (Personal)':'📌','Otros (Alimentos)':'📌',
  'Otros (Ocio)':'📌','Otros (Transporte)':'📌','Otros (Viajes)':'📌','Otros (Mascotas)':'📌',
  'Otros (Generosidad)':'📌','Otros (Ingresos)':'📌'
};

// ── CATÁLOGO DE EMOJIS (curado, ~150) organizado por grupos temáticos ──
const EMOJI_GROUPS = {
  'Comida y bebida': ['🍽️','🍔','🍕','🌮','🌯','🥙','🥗','🍜','🍣','🍱','🍛','🍝','🥘','🍲','🥪','🌭','🍟','🍗','🍖','🥩','🍤','🧀','🥐','🥖','🍞','🥞','🧇','🥓','🥚','🍳','🥣','🍚','🍙','🍘','🍥','🥟','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍦','🍨','🍧','☕','🍵','🧃','🥤','🧋','🍺','🍻','🍷','🍸','🍹','🥂','🍾','🥛','🫖','🧉'],
  'Compras': ['🛒','🏪','🛍️','🏷️','💳','🧾','🎁','👕','👗','👖','👟','👞','👜','🎒','👓','🕶️','⌚','💄','💍','🧴','🧷','🪒','🧻','🧼','🧽','🛁','🪥'],
  'Hogar y servicios': ['🏠','🏘️','🔑','🛋️','🛏️','🚿','🪑','🧹','🧺','🔧','🛠️','🔨','🪛','⚡','💡','🔌','🚰','🔥','❄️','🌡️','📦','🪴','🕯️','🧯','🔒','🛡️','📺','🖥️','💻','📱','☎️','🖨️'],
  'Transporte': ['🚗','🚕','🚙','🚌','🚐','🚚','🏍️','🛵','🚲','🛴','⛽','🅿️','🚿','🛣️','🚦','🚧','🅰️','✈️','🛫','🚆','🚄','🚈','🚊','🚢','⛵','⛴️','🛥️','🚁','🎫','🛠️'],
  'Salud': ['🏥','💊','💉','🩺','🩹','🦷','🧠','❤️','🫀','👁️','🦴','🧬','🩻','🧪','🌡️','♿','🧘','🏃','💪','🥦'],
  'Ocio y entretenimiento': ['🎭','🎬','🎤','🎸','🎹','🥁','🎧','🎮','🕹️','🎰','🎲','🎳','🎯','🎨','🖼️','📷','🎥','🎞️','📺','🎟️','🎫','🏛️','🎪','🎡','🎢','🎠','🕺','💃','🎉','🎊','📚','📖','🎧'],
  'Deporte y aire libre': ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥅','⛳','🏊','🚴','🧗','⛺','🏕️','🎿','🏂','🛹','🏋️','🤸','🧘'],
  'Viajes': ['✈️','🛫','🏨','🏖️','🏝️','🗺️','🧭','🧳','🎒','🚙','⛴️','🎟️','🛂','🛃','🏞️','⛰️','🗽','🗼','🏯','🏰','⛩️','🕌','⛪','🎡','📸'],
  'Mascotas': ['🐾','🐶','🐱','🐕','🐈','🦴','🐟','🐠','🐹','🐰','🐦','🦜','🐢','🦎','🐍','🐕‍🦺','💉','✂️'],
  'Trabajo y finanzas': ['💼','💰','💵','💴','💶','💷','💸','🏦','🏧','💳','📊','📈','📉','💹','🧮','🖊️','📝','📋','📁','🗂️','📌','📎','✂️','🖇️','💎','🪙','🧾'],
  'Personal y educación': ['👤','📚','📖','✏️','🖊️','🎓','🏫','🔬','🔭','🧪','🎨','🎼','🧵','🪡','💇','💅','✂️','🧴','👔','🕰️'],
  'Símbolos': ['⭐','🌟','✨','💫','🔥','💧','🌈','☀️','🌙','⚡','❤️','🧡','💛','💚','💙','💜','🖤','✅','❌','❗','❓','🔔','🎵','📌','🏷️','🔗','♻️','🆕','🆗','🔝']
};

// Mapeo de CATEGORÍA → grupo de emojis a mostrar PRIMERO en el selector.
const CAT_EMOJI_GROUP = {
  'Alimentos':'Comida y bebida',
  'Hogar':'Hogar y servicios',
  'Casa':'Hogar y servicios',
  'Viajes':'Viajes',
  'Transporte':'Transporte',
  'Ocio':'Ocio y entretenimiento',
  'Mascotas':'Mascotas',
  'Personal':'Personal y educación',
  'Generosidad':'Trabajo y finanzas',
  'Sueldo':'Trabajo y finanzas',
  'Ventas':'Compras',
  'Rendimientos':'Trabajo y finanzas'
};

// Emojis personalizados por comercio+subcategoría: { "costco|comida rápida": "🍕" }
let merchantEmojis = {};
try { merchantEmojis = JSON.parse(localStorage.getItem('merchantEmojis')||'{}'); } catch(e){ merchantEmojis={}; }

// Normaliza la descripción para usar como parte de la llave (minúsculas, sin espacios extra)
function normDesc(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }

// Llave del emoji personalizado: comercio + subcategoría (o categoría si no hay subcat)
function merchantEmojiKey(desc, subcatOrCat){
  return `${normDesc(desc)}|${normDesc(subcatOrCat)}`;
}
function getMerchantEmoji(desc, subcatOrCat){
  if(!desc) return null;
  return merchantEmojis[merchantEmojiKey(desc, subcatOrCat)] || null;
}
function setMerchantEmoji(desc, subcatOrCat, emoji){
  const key=merchantEmojiKey(desc, subcatOrCat);
  if(emoji){ merchantEmojis[key]=emoji; }
  else { delete merchantEmojis[key]; }
  try { localStorage.setItem('merchantEmojis', JSON.stringify(merchantEmojis)); } catch(e){}
  // Sincronizar con Sheets (para coherencia entre dispositivos)
  saveEmojiToSheets(key, emoji||'');
}

// Guarda (o borra, si emoji es '') un emoji personalizado en Sheets
async function saveEmojiToSheets(key, emoji){
  // R2: devuelve el resultado como el resto de las escrituras. No tiene efectos
  // destructivos encadenados ni mensaje de éxito, así que no cambia la UX.
  return await _sheetsPost({ action: 'saveEmoji', key, emoji }, 'emoji save');
}

// R10.1: se ELIMINÓ dynamicSubcatEmoji. El emoji default de una subcategoría
// ya NO cambia según el emoji personalizado más usado. La personalización por
// registro (getMerchantEmoji, por comercio+subcat) SE CONSERVA intacta.

// Emoji FINAL para mostrar un registro EN EL HISTORIAL.
// Solo dos capas para NO repintar registros pasados por tendencias de subcategoría:
//   1) personalizado exacto por comercio+subcat (lo que el usuario asignó a ESE comercio)
//   2) emoji estático de subcat/categoría (el default de siempre)
// El default dinámico NO se usa aquí: personalizar un comercio no debe alterar
// otros registros de la misma subcategoría, ni pasados ni presentes.
function emojiForEntry(e){
  const sc = e.subcategory || e.category;
  return getMerchantEmoji(e.desc, sc)
      || ICONS[e.subcategory] || ICONS[e.category] || '📌';
}

// Emoji elegido en la sesión de edición actual (null = usar el default calculado)
let editEmojiOverride = null;

// R11 · Personalización de emoji POR DESGLOSE (solo en edición).
// Overrides elegidos en esta sesión: { desgId: emoji }. Se limpian al abrir un
// registro (openEdit). El objetivo actual del selector: 'madre' o el id de un
// desglose. Se guardan en el MISMO almacén merchantEmojis (llave nombre|subcat),
// así la visualización en historial ya funciona sola vía emojiForEntry.
let editDesgEmojiOverrides = {};
let _emojiTarget = 'madre';

// Emoji a mostrar para un desglose EN EDICIÓN.
//  - override de esta sesión (solo si el desglose tiene NOMBRE PROPIO), o
//  - personalizado por nombre+subcat (solo si hay nombre propio), o
//  - default estático de la subcategoría/categoría.
// Sin nombre propio NUNCA se hereda el emoji de la madre: solo el default de la
// subcategoría del desglose (decisión de diseño acordada).
function currentDesgEmoji(d){
  if(!d) return '📌';
  const own=(d.desc||'').trim();
  if(own && editDesgEmojiOverrides[d.id]) return editDesgEmojiOverrides[d.id];
  const sc=d.subcategory||d.category;
  if(own){ const m=getMerchantEmoji(own, sc); if(m) return m; }
  return ICONS[d.subcategory] || ICONS[d.category] || '📌';
}

// Emoji que debe mostrar el botón del modal de edición según el estado actual
function currentEditEmoji(){
  if(editEmojiOverride) return editEmojiOverride;
  const desc=document.getElementById('e-desc')?.value||'';
  const sc = editSubcat || editCat;
  return getMerchantEmoji(desc, sc)
      || ICONS[editSubcat] || ICONS[editCat] || '📌';
}

// Actualiza el emoji mostrado en el botón del modal de edición
function refreshEditEmojiBtn(){
  const btn=document.getElementById('e-emoji-btn');
  if(btn) btn.textContent=currentEditEmoji();
}

// Abre el selector de emojis
function openEmojiPicker(target){
  // R11 · target: undefined/'madre' = registro madre; o el id de un desglose.
  _emojiTarget = (target===undefined || target===null) ? 'madre' : target;
  const body=document.getElementById('emoji-picker-body');
  if(!body) return;
  let current, catForGroup;
  if(_emojiTarget==='madre'){
    current=currentEditEmoji();
    catForGroup=editCat;
  } else {
    const d=(typeof editDesgloses!=='undefined') ? editDesgloses.find(x=>String(x.id)===String(_emojiTarget)) : null;
    current=d?currentDesgEmoji(d):'📌';
    catForGroup=d?(d.category||''):'';
  }
  const primaryGroup=CAT_EMOJI_GROUP[catForGroup]||null;
  const allGroups=Object.keys(EMOJI_GROUPS);
  // Orden de grupos: primero el relevante a la categoría, luego el resto
  const ordered = primaryGroup && EMOJI_GROUPS[primaryGroup]
    ? [primaryGroup, ...allGroups.filter(g=>g!==primaryGroup)]
    : allGroups;

  let html='';
  let currentPlaced=false;
  ordered.forEach((g,i)=>{
    let emojis=EMOJI_GROUPS[g].slice();
    // En el PRIMER grupo mostrado, poner el emoji actual al principio (preseleccionado)
    if(i===0 && !currentPlaced){
      emojis=emojis.filter(e=>e!==current);
      emojis.unshift(current);
      currentPlaced=true;
    }
    html+=renderEmojiGroup(g, emojis, current);
  });
  body.innerHTML=html;
  body.scrollTop=0;
  document.getElementById('emoji-modal').classList.add('open');
}

function renderEmojiGroup(name, emojis, current){
  let h=`<div class="emoji-group-lbl">${name}</div><div class="emoji-grid">`;
  emojis.forEach(emo=>{
    const cls='emoji-cell'+(emo===current?' current':'');
    h+=`<button type="button" class="${cls}" onclick="pickEmoji('${emo}')">${emo}</button>`;
  });
  h+=`</div>`;
  return h;
}

// Elige un emoji: lo aplica al override del objetivo, refresca su botón y cierra.
function pickEmoji(emo){
  if(_emojiTarget==='madre'){
    editEmojiOverride=emo;
    refreshEditEmojiBtn();
  } else {
    editDesgEmojiOverrides[_emojiTarget]=emo;
    try{ if(typeof refreshDesgEmojiBtn==='function') refreshDesgEmojiBtn(_emojiTarget); }catch(e){}
  }
  closeEmojiPicker();
}

function closeEmojiPicker(ev){
  if(ev && ev.target!==document.getElementById('emoji-modal')) return;
  document.getElementById('emoji-modal').classList.remove('open');
}

// ── CATEGORY COLORS (consistent across all views) ──
const CAT_COLORS = {
  // Egresos
  'Hogar':       '#ff9500',
  'Casa':        '#ff9500',
  'Personal':    '#34c759',
  'Alimentos':   '#007aff',
  'Ocio':        '#af52de',
  'Transporte':  '#ff3b30',
  'Viajes':      '#5856d6',
  'Mascotas':    '#ff2d55',
  'Generosidad': '#00c7be',
  // Ingresos
  'Sueldo':           '#34c759',
  'Bono de despensa': '#ff9500',
  'Reembolsos':       '#a2845e',
  'Rendimientos':     '#5856d6',
  'Ventas':           '#ff3b30',
  'Regalos':          '#ff2d55',
  'Regalos recibidos':'#ff2d55',
  // Beneficios (nombres unificados con BEN_TYPES)
  // R7.2: 'Cashback' es ahora categoría de INGRESO; conserva su color.
  'Cashback':                 '#ff9500',
  'Dinero electrónico':       '#32ade6',
  'Puntos TDC':               '#af52de',
  'Puntos de lealtad':        '#ffcc00',
  'Millas aéreas':            '#00c7be',
  'Descuentos y promociones': '#ff2d55',
  'Otros (Beneficios)':       '#a2845e',
  'Otros (beneficios)':       '#a2845e',
  'Otros beneficios':         '#a2845e',
  // Nombres antiguos (por si hay registros históricos)
  'Descuento':                '#ff2d55',
  'Otro beneficio':           '#a2845e',
};

function catColor(cat){ return CAT_COLORS[cat]||'#8e8e93'; }

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16);
  const g=parseInt(hex.slice(3,5),16);
  const b=parseInt(hex.slice(5,7),16);
  return [r,g,b];
}

function lighten(hex, t){
  const [r,g,b]=hexToRgb(hex);
  const lr=Math.round(r+(255-r)*t);
  const lg=Math.round(g+(255-g)*t);
  const lb=Math.round(b+(255-b)*t);
  return `#${[lr,lg,lb].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
}


// ════════════════════════════════════════════
// UTILIDADES (fechas, monedas, orden)
// ════════════════════════════════════════════

function forceReload(ev){
  // R9 · El botón de recargar dejó de ser flotante: ahora hay uno dentro del
  // encabezado de cada página, así que ya no existe un #reload-btn único. Se
  // gira el que se tocó (o, en su defecto, el de la página activa).
  const btn = (ev && ev.currentTarget)
           || document.querySelector('.page.active .reload-btn')
           || document.querySelector('.reload-btn:not(.scrolltop-btn)');
  if(btn){
    btn.classList.add('spinning');
    setTimeout(()=>btn.classList.remove('spinning'),600);
  }
  loadFromSheets();
}
// R9 · "Otros (…)" SIEMPRE va al final de cualquier listado y no participa en el
// algoritmo de orden (recurrencia → alfabético). Nota: las etiquetas reales son
// 'Otros (Casa)', 'Otros (Ingresos)', 'Otros (beneficios)'… — comparar contra el
// texto exacto 'Otros' nunca coincidía, así que antes se ordenaban como una más.
function _esOtros(n){ return /^otros\b/i.test(String(n||'').trim()); }

function sortedCats(type) {
  const cats = Object.keys(CATS[type]);
  const others = cats.filter(c=>_esOtros(c));
  const rest = cats.filter(c=>!_esOtros(c));
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
  const others = subs.filter(s=>_esOtros(s));
  const rest = subs.filter(s=>!_esOtros(s));
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
