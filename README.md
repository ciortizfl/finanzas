# Tomín — Guía del proyecto

Esta es tu app de finanzas personales, organizada en archivos separados para que sea fácil de mantener.

**Importante:** todos los archivos deben estar **juntos en la misma carpeta** en GitHub. La app se abre desde `index.html`. No les cambies el nombre.

---

## Los archivos principales

### `index.html`
El **esqueleto** de la app: botones, formularios, pantallas. Llama al diseño (CSS) y a la lógica (los archivos `.js`).

### `estilos.css`
El **diseño visual**: colores, tipografías, animaciones, cómo se ve cada elemento.

---

## Los archivos de lógica (`.js`)

Numerados en el orden en que la app los carga. Cada uno cubre un tema:

| Archivo | ¿Para qué sirve? |
|---|---|
| `01_nucleo.js` | La base: dónde se guardan tus registros, las categorías, los emojis por comercio y las utilidades de fechas/monedas. |
| `02_registro.js` | El formulario para **registrar** un gasto o ingreso, incluyendo diferir en mensualidades. |
| `03_desgloses.js` | Dividir un gasto en **partes** (desgloses), en registro y edición. |
| `04_guardado_sync.js` | Guardar y **sincronizar con Google Sheets**, con la animación de guardado y la protección contra registros "desaparecidos". |
| `05_balance_vistas.js` | La pantalla de **balance**: totales, categorías, gráfica de dona y la vista anual. |
| `06_historial.js` | El **historial**: filtros (tipo, categoría, método, rango de fechas, búsqueda) y la lista de movimientos. |
| `07_datepicker_fechas.js` | El **calendario** para elegir fechas (con presets 1s/2s/3s/1m/3m/6m) y la tira de días del registro. |
| `08_edicion.js` | La ventana para **editar** un registro, borrar (con animación) y la propina en edición. |
| `09_edicion_diferir.js` | Editar diferidos: cambiar mensualidades o convertir un gasto en diferido. |
| `10_presupuesto_csv_init.js` | El **presupuesto** mensual, exportar a **CSV** y el arranque de la app. |

---

## ¿Cómo actualizo la app cuando me entregas cambios?

Cuando pidas un cambio, **yo decido qué archivo(s) tocar** y te entrego **solo esos**. Tú solo:

1. Sube a GitHub el archivo (o archivos) que te dé, **reemplazando** el viejo del mismo nombre.
2. Listo.

---

## Nota sobre Google Sheets

La app se conecta a Google Sheets mediante un script aparte (**Apps Script**) que vive dentro de tu hoja de Google. Cuando un cambio requiera tocarlo, te avisaré y te diré exactamente qué pegar allá.
