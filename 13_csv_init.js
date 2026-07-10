// ══════════════════════════════════════
// CSV EXPORT
// ══════════════════════════════════════
function exportCSV(){
  const mSel=document.getElementById('hist-month-sel');
  const ySel=document.getElementById('hist-year-sel');
  const selMonth=mSel?parseInt(mSel.value):new Date().getMonth();
  const selYear=ySel?parseInt(ySel.value):new Date().getFullYear();
  const rows=data.filter(e=>{const d=parseDate(e.date);return d.getMonth()===selMonth&&d.getFullYear()===selYear;});
  const headers=['ID','Fecha','Tipo','Categoría','Subcategoría','Descripción','Monto original','Moneda','Monto MXN','Método de pago','Nota'];
  const escape=v=>`"${String(v||'').replace(/"/g,'""')}"`;
  const csv=[headers.join(','),...rows.map(e=>[e.id,e.date,e.type,e.category,e.subcategory||'',escape(e.desc),e.amount,e.currency,e.amountMXN,e.method||'',escape(e.note)].join(','))].join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;
  a.download=`finanzas_${MONTHS_ES[selMonth]}_${selYear}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('✓ CSV descargado');
}

init();
