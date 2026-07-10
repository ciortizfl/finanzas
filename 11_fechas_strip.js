// ══════════════════════════════════════
// DATE STRIP PICKER
// ══════════════════════════════════════

// Offset en días desde "hoy" para cada strip
const stripOffsets = {};

function dateToISO(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function addDays(isoDate, n){
  const d = parseDate(isoDate);
  d.setDate(d.getDate()+n);
  return dateToISO(d);
}

// Renderiza RANGE días centrados en centerDate
// Range grande para que se pueda scrollear sin recargar
const STRIP_RANGE = 60; // 60 días antes y 60 después = 121 botones

// Detecta si estamos en móvil (viewport angosto)
function isMobileView(){
  return window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
}

function renderStrip(stripId, centerDate){
  const strip  = document.getElementById(stripId);
  const scroll = document.getElementById(stripId + '-scroll');
  if(!strip || !scroll) return;

  const inputId = stripId === 'tx-date-strip' ? 'tx-date' : 'e-date';
  const selected = document.getElementById(inputId)?.value || localToday();
  const today = localToday();
  const DAYS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MONTHS_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const mobile = isMobileView();
  // Móvil: rango amplio con scroll. Web: solo 5 días a cada lado (11 total).
  const range = mobile ? STRIP_RANGE : 5;

  // En web, el strip ocupa todo el ancho (cada botón 1/11); en móvil usa scroll
  strip.classList.toggle('web-full', !mobile);

  strip.innerHTML = '';
  let selectedBtn = null;
  let prevMonth = null;

  for(let i = -range; i <= range; i++){
    const iso = addDays(centerDate, i);
    const d   = parseDate(iso);
    const curMonth = d.getMonth();

    // Quiebre visual de mes (solo móvil): insertar separador antes del primer día de un mes nuevo
    if(mobile && prevMonth !== null && curMonth !== prevMonth){
      const brk = document.createElement('div');
      brk.className = 'month-break';
      brk.textContent = MONTHS_ABBR[curMonth];
      strip.appendChild(brk);
    }
    prevMonth = curMonth;

    const btn = document.createElement('button');
    btn.type  = 'button';
    btn.className = 'date-day-btn' + (mobile ? '' : ' web-mode');
    btn.dataset.iso = iso;
    if(iso === today)    btn.classList.add('today-marker');
    if(iso === selected){ btn.classList.add('selected'); selectedBtn = btn; }

    if(mobile){
      btn.innerHTML = `<span class="day-name">${DAYS[d.getDay()]}</span><span class="day-num">${d.getDate()}</span>`;
    } else {
      // Web: nombre de día completo arriba, número, y mes completo abajo
      btn.innerHTML = `<span class="day-name">${DAYS_FULL[d.getDay()]}</span><span class="day-num">${d.getDate()}</span><span class="day-month">${MONTHS_ES[curMonth]}</span>`;
    }
    btn.onclick = () => selectStripDate(stripId, iso);
    strip.appendChild(btn);
  }

  // Centrar el botón seleccionado (solo móvil; en web el strip ya llena el ancho)
  if(selectedBtn && mobile){
    requestAnimationFrame(()=>{
      const btnLeft   = selectedBtn.offsetLeft;
      const btnWidth  = selectedBtn.offsetWidth;
      const scrollW   = scroll.offsetWidth;
      scroll.scrollLeft = btnLeft - scrollW/2 + btnWidth/2;
    });
  }
}

function selectStripDate(stripId, iso){
  const inputId = stripId === 'tx-date-strip' ? 'tx-date' : 'e-date';
  document.getElementById(inputId).value = iso;

  if(!isMobileView()){
    // Web: re-centrar el strip en la fecha elegida (mantiene 5 a cada lado)
    stripOffsets[stripId] = iso;
    renderStrip(stripId, iso);
    return;
  }

  // Móvil: actualizar clase selected sin re-renderizar + scroll suave
  const strip = document.getElementById(stripId);
  strip.querySelectorAll('.date-day-btn').forEach(b=>{
    b.classList.toggle('selected', b.dataset.iso === iso);
  });
  const selectedBtn = strip.querySelector('.date-day-btn.selected');
  const scroll = document.getElementById(stripId + '-scroll');
  if(selectedBtn && scroll){
    const btnLeft  = selectedBtn.offsetLeft;
    const btnWidth = selectedBtn.offsetWidth;
    const scrollW  = scroll.offsetWidth;
    scroll.scrollTo({ left: btnLeft - scrollW/2 + btnWidth/2, behavior: 'smooth' });
  }
}

function shiftStrip(stripId, delta){
  if(isMobileView()){
    // Móvil: scroll nativo desplaza los días
    const scroll = document.getElementById(stripId + '-scroll');
    if(scroll){
      const amount = delta * (46 + 5) * 7;
      scroll.scrollBy({ left: amount, behavior: 'smooth' });
    }
  } else {
    // Web: re-centrar el strip 5 días en la dirección indicada
    const cur = stripOffsets[stripId] || localToday();
    const newCenter = addDays(cur, delta * 5);
    stripOffsets[stripId] = newCenter;
    renderStrip(stripId, newCenter);
  }
}

function initStrip(stripId, isoDate){
  stripOffsets[stripId] = isoDate;
  renderStrip(stripId, isoDate);
  // No necesitamos touch handlers — el scroll nativo ya lo maneja
}

function openDatePicker(inputId, stripId){
  // No-op: picker is now triggered directly by tapping the overlay input
}

function onNativeDateChange(inputId, stripId){
  const inp = document.getElementById(inputId);
  if(!inp || !inp.value) return;
  const iso = inp.value;
  // Si el día elegido está dentro del rango renderizado, solo scroll
  // Si está fuera, re-renderizar centrado en esa fecha
  const strip = document.getElementById(stripId);
  const existing = strip ? strip.querySelector(`[data-iso="${iso}"]`) : null;
  if(existing){
    selectStripDate(stripId, iso);
  } else {
    stripOffsets[stripId] = iso;
    renderStrip(stripId, iso);
  }
}

// Aplica una fecha elegida al input y actualiza su date-strip (registro o edición)
function _applyPickedDateToStrip(inputId, stripId, iso){
  const inp=document.getElementById(inputId);
  if(inp) inp.value=iso;
  const strip=document.getElementById(stripId);
  const existing=strip?strip.querySelector(`[data-iso="${iso}"]`):null;
  if(existing){ selectStripDate(stripId, iso); }
  else { stripOffsets[stripId]=iso; renderStrip(stripId, iso); }
}

// Datepicker para el campo de fecha del REGISTRO (sin presets)
function openRegDatePicker(){
  const cur=document.getElementById('tx-date')?.value;
  openDatepicker({
    initial: cur?parseDate(cur):new Date(),
    presets:false,
    onPick:(d)=>{ _applyPickedDateToStrip('tx-date','tx-date-strip', _dpFmt(d)); }
  });
}

// Datepicker para el campo de fecha de EDICIÓN (sin presets)
function openEditDatePicker(){
  const cur=document.getElementById('e-date')?.value;
  openDatepicker({
    initial: cur?parseDate(cur):new Date(),
    presets:false,
    onPick:(d)=>{ _applyPickedDateToStrip('e-date','e-date-strip', _dpFmt(d)); }
  });
}
