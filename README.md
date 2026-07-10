# Tomín — Guía del proyecto

Esta es tu app de finanzas personales. Antes era **un solo archivo gigante**; ahora está **separada en varios archivos** para que sea más fácil de mantener y para que cada cambio sea más rápido (y gaste menos).

**Importante:** todos estos archivos deben estar **juntos en GitHub** (respetando la carpeta `js/`). La app se abre desde `index.html`. No muevas los archivos de lugar ni les cambies el nombre, o la app dejará de encontrarlos.

---

## Los archivos principales

### `index.html`
Es el **esqueleto** de la app: los botones, los formularios, las pantallas. Es lo que se abre en el navegador. Por dentro, este archivo "llama" al diseño (el CSS) y a toda la lógica (los archivos de la carpeta `js/`).

### `estilos.css`
Es el **diseño visual**: colores, tipografías, tamaños, animaciones, cómo se ve cada botón y cada tarjeta. Si algún día quieres cambiar un color o cómo se ve algo, va aquí.

---

## La carpeta `js/` — la lógica de la app

Aquí vive todo lo que **hace funcionar** la app. Están numerados en el orden en que la app los usa. Cada uno se encarga de un tema:

| Archivo | ¿Para qué sirve? |
|---|---|
| `01_base_datos.js` | El "cerebro" base: dónde se guardan tus registros, el estado general y el filtro de método de pago. |
| `02_categorias_emojis.js` | Las categorías (Casa, Personal, etc.), los íconos y los emojis personalizados por comercio. |
| `03_utilidades.js` | Herramientas internas: manejo de fechas, conversión de monedas, ordenar listas. |
| `04_registro_form.js` | El formulario para **registrar** un gasto o ingreso: elegir tipo, categoría, nota, propina, beneficios. |
| `05_diferidos.js` | Repartir un gasto en **mensualidades** (por ejemplo, algo a 12 meses). |
| `06_desgloses.js` | Dividir un solo gasto en **partes** (por ejemplo, una compra con varios conceptos). |
| `07a_guardado_sync.js` | Guardar tus registros y **sincronizarlos con Google Sheets**, con su animación. |
| `07b_render_balance.js` | Dibujar la pantalla de **balance**: totales, categorías, métodos y la gráfica de dona. |
| `07c_historial_filtros.js` | La pantalla de **historial**: los filtros (tipo, categoría, método) y la lista de movimientos. |
| `08_datepicker.js` | El **calendario** para elegir fechas (el bonito, con presets como 1s, 1m, etc.). |
| `09a_edicion_modal.js` | La ventana para **editar** un registro ya guardado. |
| `09b_edicion_diferir.js` | Editar un gasto para convertirlo en diferido (o cambiar sus mensualidades). |
| `09c_eliminar_propina.js` | Borrar un registro (con su animación) y la propina dentro de la edición. |
| `10_presupuesto.js` | La pantalla de **presupuesto** mensual. |
| `11_fechas_strip.js` | La **tira de días** que aparece bajo la fecha al registrar o editar. |
| `12_vista_anual.js` | La vista de balance **por año** (en vez de por mes). |
| `13_csv_init.js` | Exportar tus datos a **CSV** y el arranque final de la app. |

---

## ¿Cómo actualizo la app cuando me entregas cambios?

Cuando pidas un cambio, **yo decido qué archivo(s) tocar** y te entrego **solo esos**. Tú solo tienes que:

1. Subir a GitHub el archivo (o archivos) que te dé, **reemplazando** el viejo con el mismo nombre.
2. Listo. La app toma el cambio.

No necesitas saber cuál es cuál: yo te digo "sube este archivo aquí" y ya.

---

## Nota sobre Google Sheets

La app se conecta a una hoja de Google (Google Sheets) mediante un script aparte (**Apps Script**). Ese script **no está en estos archivos** — vive dentro de tu Google Sheets. Cuando un cambio requiera tocar también esa parte, te avisaré por separado y te diré exactamente qué pegar allá.
