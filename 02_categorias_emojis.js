const CATS = {
  ingreso: {
    'Sueldo':['—'],'Bono de despensa':['—'],'Aguinaldo':['—'],
    'Utilidades':['—'],'Fondo de ahorro':['—'],'Reembolsos':['—'],
    'Rendimientos':['—'],'Renta de propiedad':['—'],'Ventas':['—'],
    'Regalos':['—'],'Otros (Ingresos)':['—']
  },
  egreso: {
    'Casa':       ['Renta','Hipoteca','Mantenimiento','Servicios','Seguridad','Muebles y decoración','Servicio de limpieza','Equipamiento','Otros (Casa)'],
    'Personal':   ['Salud y médicos','Dentista','Medicamentos','Gimnasio','Ropa y calzado','Cuidado personal','Educación','Finanzas / Impuestos','Compras personales','Otros (Personal)'],
    'Alimentos':  ['Despensa','Restaurantes y cafés','Comida rápida','Snacks','Otros (Alimentos)'],
    'Ocio':       ['Cine','Espectáculos y conciertos','Bares y antros','Videojuegos','Suscripciones','Renta y venta digital','Museos','Media física','Otros (Ocio)'],
    'Transporte': ['Gasolina','Uber / taxi','Transporte público','Mantenimiento de auto','Seguro de auto','Estacionamiento','Autopartes','Autolavado','Trámites vehiculares','Vuelos','Otros pasajes','Seguro de viaje','Otros (Transporte)'],
    'Mascotas':   ['Comida','Veterinario','Accesorios y juguetes','Estética / grooming','Medicamentos','Hospedaje','Otros (Mascotas)'],
    'Generosidad':['Regalos','Donativos','Propinas','Préstamos','Otros (Generosidad)']
  },
  ahorro: {
    'Inversiones':['—'],'Otros (Ahorro)':['—']
  },
  'ahorro-pasivo': {} // Se llena dinámicamente desde BEN_TYPES (ver más abajo)
};

const ICONS = {
  'Casa':'🏠','Personal':'👤','Alimentos':'🍽️','Ocio':'🎭','Transporte':'🚗',
  'Mascotas':'🐾','Generosidad':'🎁','Sueldo':'💼','Bono de despensa':'🛒',
  'Aguinaldo':'🎄','Utilidades':'📊','Fondo de ahorro':'🏦','Reembolsos':'↩️',
  'Rendimientos':'📈','Renta de propiedad':'🏢','Ventas':'🛍️','Regalos':'🎁',
  'Inversiones':'💹','Cashback':'💳','Puntos TDC':'💎',
  'Puntos de lealtad':'⭐','Millas aéreas':'✈️','Descuentos y promociones':'🏷️','Otros beneficios':'🎁','Descuento':'🏷️','Otro beneficio':'🎁',
  'Renta':'🏠','Hipoteca':'🔑','Mantenimiento':'🔧','Servicios':'⚡',
  'Seguridad':'🔒','Muebles y decoración':'🛋️','Servicio de limpieza':'🧹',
  'Equipamiento':'📦','Salud y médicos':'🏥','Dentista':'🦷','Medicamentos':'💊','Gimnasio':'💪','Finanzas / Impuestos':'💼',
  'Ropa y calzado':'👕','Cuidado personal':'✂️','Educación':'📚',
  'Compras personales':'🛒','Despensa':'🛒','Restaurantes y cafés':'🍴',
  'Comida rápida':'🍔','Snacks':'🍿','Cine':'🎬',
  'Espectáculos y conciertos':'🎤','Bares y antros':'🕺','Videojuegos':'🎮',
  'Suscripciones':'📱','Renta y venta digital':'🎞️','Museos':'🏛️',
  'Media física':'💿','Gasolina':'⛽','Uber / taxi':'🚕',
  'Transporte público':'🚌','Mantenimiento de auto':'🔧','Seguro de auto':'🛡️',
  'Estacionamiento':'🅿️','Autolavado':'🚿','Trámites vehiculares':'📋','Autopartes':'⚙️','Vuelos':'✈️',
  'Otros pasajes':'🎫','Seguro de viaje':'🛡️','Comida':'🍖',
  'Veterinario':'💉','Accesorios y juguetes':'🦴','Estética / grooming':'✂️','Hospedaje':'🏨',
  'Donativos':'❤️','Propinas':'💰','Préstamos':'🤝',
  'Otros (Casa)':'📌','Otros (Personal)':'📌','Otros (Alimentos)':'📌',
  'Otros (Ocio)':'📌','Otros (Transporte)':'📌','Otros (Mascotas)':'📌',
  'Otros (Generosidad)':'📌','Otros (Ingresos)':'📌','Otros (Ahorro)':'📌'
};

// ── CATÁLOGO DE EMOJIS (curado, ~150) organizado por grupos temáticos ──
const EMOJI_GROUPS = {
  'Comida y bebida': ['🍽️','🍔','🍕','🌮','🌯','🥙','🥗','🍜','🍣','🍱','🍛','🍝','🥘','🍲','🥪','🌭','🍟','🍗','🍖','🥩','🍤','🧀','🥐','🥖','🍞','🥞','🧇','🥓','🥚','🍳','🥣','🍚','🍙','🍘','🍥','🥟','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍦','🍨','🍧','☕','🍵','🧃','🥤','🧋','🍺','🍻','🍷','🍸','🍹','🥂','🍾','🥛','🫖','🧉'],
  'Compras': ['🛒','🛍️','🏷️','💳','🧾','🎁','👕','👗','👖','👟','👞','👜','🎒','👓','🕶️','⌚','💄','💍','🧴','🧷','🪒','🧻','🧼','🧽','🛁','🪥'],
  'Hogar y servicios': ['🏠','🔑','🛋️','🛏️','🚿','🪑','🧹','🧺','🔧','🔨','🪛','⚡','💡','🔌','🚰','🔥','❄️','🌡️','📦','🪴','🕯️','🧯','🔒','🛡️','📺','🖥️','💻','📱','☎️','🖨️'],
  'Transporte': ['🚗','🚕','🚙','🚌','🚐','🚚','🏍️','🛵','🚲','🛴','⛽','🅿️','🚿','🛣️','🚦','🚧','🅰️','✈️','🚆','🚄','🚈','🚊','🚢','⛵','🛥️','🚁','🎫'],
  'Salud': ['🏥','💊','💉','🩺','🩹','🦷','🧠','❤️','🫀','👁️','🦴','🧬','🩻','🧪','🌡️','♿','🧘','🏃','💪','🥦'],
  'Ocio y entretenimiento': ['🎭','🎬','🎤','🎸','🎹','🥁','🎧','🎮','🕹️','🎰','🎲','🎳','🎯','🎨','🖼️','📷','🎥','🎞️','🎟️','🎫','🏛️','🎪','🎡','🎢','🎠','🕺','💃','🎉','🎊','📚','📖','🎧'],
  'Deporte y aire libre': ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥅','⛳','🏊','🚴','🧗','⛺','🏕️','🎿','🏂','🛹','🏋️','🤸','🧘'],
  'Viajes': ['✈️','🏨','🏖️','🏝️','🗺️','🧳','🎒','🛂','🛃','🏞️','⛰️','🗽','🗼','🏯','🏰','⛩️','🕌','⛪','🎡','📸'],
  'Mascotas': ['🐾','🐶','🐱','🐕','🐈','🦴','🐟','🐠','🐹','🐰','🐦','🦜','🐢','🦎','🐍','🐕‍🦺','💉','✂️'],
  'Trabajo y finanzas': ['💼','💰','💵','💴','💶','💷','💸','🏦','🏧','💳','📊','📈','📉','💹','🧮','🖊️','📝','📋','📁','🗂️','📌','📎','✂️','🖇️','💎','🪙','🧾'],
  'Personal y educación': ['👤','📚','📖','✏️','🖊️','🎓','🏫','🔬','🔭','🧪','🎨','🎼','🧵','🪡','💇','💅','✂️','🧴','👔','🕰️'],
  'Símbolos': ['⭐','🌟','✨','💫','🔥','💧','🌈','☀️','🌙','⚡','❤️','🧡','💛','💚','💙','💜','🖤','✅','❌','❗','❓','🔔','🎵','📌','🏷️','🔗','♻️','🆕','🆗','🔝']
};

// Mapeo de CATEGORÍA → grupo de emojis a mostrar PRIMERO en el selector.
const CAT_EMOJI_GROUP = {
  'Alimentos':'Comida y bebida',
  'Casa':'Hogar y servicios',
  'Transporte':'Transporte',
  'Ocio':'Ocio y entretenimiento',
  'Mascotas':'Mascotas',
  'Personal':'Personal y educación',
  'Generosidad':'Trabajo y finanzas',
  'Sueldo':'Trabajo y finanzas',
  'Ventas':'Compras',
  'Inversiones':'Trabajo y finanzas',
  'Rendimientos':'Trabajo y finanzas',
  'Renta de propiedad':'Hogar y servicios'
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
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveEmoji', key, emoji })
    });
  } catch(e){ console.warn('Sheets emoji save failed', e); }
}

// Emoji default DINÁMICO de una subcategoría: el más usado (personalizado por comercio)
// en el último año, con peso por cuartos de antigüedad (como la predicción de categorías).
function dynamicSubcatEmoji(subcat){
  if(!subcat) return null;
  const now=Date.now();
  const DAY=86400000;
  const votes={}; // emoji -> peso acumulado
  data.forEach(e=>{
    if((e.subcategory||'')!==subcat) return;
    const emo=getMerchantEmoji(e.desc, e.subcategory);
    if(!emo) return; // solo cuentan los que tienen emoji personalizado
    const d=parseDate(e.date);
    if(isNaN(d.getTime())) return;
    const ageDays=(now-d.getTime())/DAY;
    if(ageDays>365) return;
    // Peso por cuartos: 0-91→4, 92-182→3, 183-273→2, 274-365→1
    let w=1;
    if(ageDays<=91) w=4; else if(ageDays<=182) w=3; else if(ageDays<=273) w=2; else w=1;
    votes[emo]=(votes[emo]||0)+w;
  });
  let best=null, bestW=0;
  Object.entries(votes).forEach(([emo,w])=>{ if(w>bestW){ best=emo; bestW=w; } });
  return best;
}

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
function openEmojiPicker(){
  const body=document.getElementById('emoji-picker-body');
  if(!body) return;
  const current=currentEditEmoji();
  const primaryGroup=CAT_EMOJI_GROUP[editCat]||null;
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

// Elige un emoji: lo aplica al override, refresca el botón y cierra el selector.
function pickEmoji(emo){
  editEmojiOverride=emo;
  refreshEditEmojiBtn();
  closeEmojiPicker();
}

function closeEmojiPicker(ev){
  if(ev && ev.target!==document.getElementById('emoji-modal')) return;
  document.getElementById('emoji-modal').classList.remove('open');
}

// ── CATEGORY COLORS (consistent across all views) ──
const CAT_COLORS = {
  // Egresos
  'Casa':        '#ff9500',
  'Personal':    '#34c759',
  'Alimentos':   '#007aff',
  'Ocio':        '#af52de',
  'Transporte':  '#ff3b30',
  'Mascotas':    '#ff2d55',
  'Generosidad': '#00c7be',
  // Ingresos
  'Sueldo':           '#34c759',
  'Bono de despensa': '#ff9500',
  'Aguinaldo':        '#ffcc00',
  'Utilidades':       '#007aff',
  'Fondo de ahorro':  '#00c7be',
  'Reembolsos':       '#a2845e',
  'Rendimientos':     '#5856d6',
  'Renta de propiedad':'#af52de',
  'Ventas':           '#ff3b30',
  'Regalos':          '#ff2d55',
  // Ahorros / Beneficios (nombres unificados con BEN_TYPES)
  'Inversiones':              '#007aff',
  'Cashback':                 '#ff9500',
  'Puntos TDC':               '#af52de',
  'Puntos de lealtad':        '#ffcc00',
  'Millas aéreas':            '#00c7be',
  'Descuentos y promociones': '#ff2d55',
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
