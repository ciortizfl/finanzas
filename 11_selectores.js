// ══════════════════════════════════════════════════════════════════════════
// 11_selectores.js · CAPA PURAMENTE ESTÉTICA sobre los <select> nativos
// ══════════════════════════════════════════════════════════════════════════
// Mismo patrón que ya se usa en Balance e Historial con los selectores de
// mes/año: el <select> NO se elimina — se oculta y sigue siendo la ÚNICA
// fuente de verdad. Encima se monta un botón (con el valor actual) y una
// burbuja con las opciones; al elegir una se le asigna el valor al <select>
// y se dispara su evento 'change', así todos los onchange/handlers
// existentes corren exactamente igual que antes.
//
// NINGUNA función, condición ni comportamiento de la app cambia aquí: este
// archivo solo pinta. Marcar un <select> con la clase `fsel` lo convierte.
//
// FUERA DE ALCANCE A PROPÓSITO: la sección de Presupuesto (#bud-month-sel /
// #bud-year-sel) NO lleva la clase `fsel` y por lo tanto no se toca.
// ══════════════════════════════════════════════════════════════════════════

// Crea el envoltorio (botón + burbuja) alrededor de un <select> marcado.
// Idempotente: si ya está montado, no hace nada.
function _fselBuild(sel){
  if(!sel || !sel.parentNode) return null;
  if(sel.closest('.fsel-wrap')) return sel.closest('.fsel-wrap');

  const wrap=document.createElement('div');
  wrap.className='fsel-wrap';
  // El primer nombre de clase del <select> (desg-cat, desg-subcat,
  // ben-type-select, cur-sel) identifica la variante visual en el CSS.
  const variante=Array.from(sel.classList).find(c=>c!=='fsel')||'';
  wrap.setAttribute('data-fsel', variante);

  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  const btn=document.createElement('button');
  btn.type='button';
  btn.className='fsel-btn';
  btn.addEventListener('click',(e)=>{
    e.preventDefault(); e.stopPropagation();
    _fselToggle(wrap);
  });

  const bub=document.createElement('div');
  bub.className='fsel-bubble';

  wrap.appendChild(btn);
  wrap.appendChild(bub);
  return wrap;
}

// Abre esta burbuja y cierra cualquier otra que estuviera abierta.
function _fselToggle(wrap){
  const abierta=wrap.classList.contains('open');
  _fselCloseAll();
  if(!abierta) wrap.classList.add('open');
}
function _fselCloseAll(){
  document.querySelectorAll('.fsel-wrap.open').forEach(w=>w.classList.remove('open'));
}

// Pinta el botón y reconstruye la burbuja a partir de las <option> REALES
// del <select>. Así cualquier cambio que la lógica existente le haga al
// <select> (opciones nuevas, value distinto) se refleja sin lógica paralela.
function _fselPaint(sel){
  const wrap=sel.closest('.fsel-wrap');
  if(!wrap) return;
  const btn=wrap.querySelector(':scope > .fsel-btn');
  const bub=wrap.querySelector(':scope > .fsel-bubble');
  if(!btn || !bub) return;

  const idx=sel.selectedIndex;
  const opt=(idx>=0)?sel.options[idx]:null;
  const elegido=!!sel.value;
  btn.textContent=(opt && opt.text) ? opt.text : '';
  btn.classList.toggle('chosen', elegido);

  bub.innerHTML='';
  Array.from(sel.options).forEach((o,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.textContent=o.text;
    if(o.disabled) b.disabled=true;
    if(i===idx) b.classList.add('sel');
    b.addEventListener('click',(e)=>{
      e.preventDefault(); e.stopPropagation();
      if(o.disabled) return;
      _fselChoose(sel, o.value);
    });
    bub.appendChild(b);
  });
}

// Elegir = asignar el valor al <select> y disparar su 'change'.
// Toda la lógica existente (los onchange inline) corre desde aquí, igual
// que si el usuario hubiera usado el desplegable nativo. Igual que el nativo,
// NO se dispara 'change' si el valor no cambió.
function _fselChoose(sel, val){
  const wrap=sel.closest('.fsel-wrap');
  if(wrap) wrap.classList.remove('open');
  if(sel.value===val){ return; }
  sel.value=val;
  sel.dispatchEvent(new Event('change', { bubbles:true }));
  // El handler pudo reconstruir la tarjeta completa; si este <select>
  // sobrevivió, repintar su botón.
  try{ if(sel.isConnected) _fselPaint(sel); }catch(e){}
}

// Monta lo que falte y repinta todo dentro de `root` (o del documento).
// Es la única función que hay que llamar desde el código existente, y solo
// para REPINTAR — nunca cambia estado.
function _fselSyncAll(root){
  const scope=root||document;
  try{
    // Envoltorios huérfanos: la lógica existente puede eliminar un <select>
    // (p. ej. la subcategoría cuando la categoría no tiene subcats).
    scope.querySelectorAll('.fsel-wrap').forEach(w=>{
      if(!w.querySelector('select')) w.remove();
    });
    scope.querySelectorAll('select.fsel').forEach(sel=>{
      _fselBuild(sel);
      _fselPaint(sel);
    });
  }catch(e){}
}

// Cerrar al tocar fuera (mismo patrón que .method-bubble y los demás popovers).
document.addEventListener('click',(e)=>{
  if(!document.querySelector('.fsel-wrap.open')) return;
  if(e.target && e.target.closest && e.target.closest('.fsel-wrap')) return;
  _fselCloseAll();
}, true);

// Montaje inicial (moneda de Registro y de Edición, que viven en el HTML).
document.addEventListener('DOMContentLoaded', ()=>{ _fselSyncAll(document); });
