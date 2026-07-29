// ============================================================================
// Globito rojo de novedades (barra inferior, móvil).
//
// Igual que en Instagram: si hoy se publicaron reportes que esta persona
// todavía no mira, la pestaña "Reportes" lleva un círculo rojo con cuántos son.
// Al tocarla se apaga, y vuelve a encenderse cuando llegue otro reporte nuevo.
//
// "Nuevo" se mide desde la última vez que tocó la pestaña, y nunca más atrás de
// las 00:00 de hoy: al día siguiente el globito parte limpio.
// ============================================================================
import { contarReportesDesde } from './data.js';

const CLAVE = 'bh_novedades_vistas';   // en localStorage, ISO de la última mirada
const CADA = 3 * 60 * 1000;            // cada cuánto vuelve a preguntar

export function initNovedades() {
  const boton = document.querySelector('.tabbar__item[data-tab="guia"]');
  if (!boton) return;

  boton.addEventListener('click', marcarVistas);
  // Para que el formulario apague el globito al publicar: el reporte propio no
  // es una novedad para quien acaba de escribirlo.
  window.marcarNovedadesVistas = marcarVistas;

  revisar();
  setInterval(() => { if (!document.hidden) revisar(); }, CADA);
  // Volver a la app después de un rato es el momento típico para encontrarse
  // con algo nuevo: se revisa al retomar la pestaña.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
}

// Desde cuándo cuenta como "nuevo": la última mirada, o las 00:00 de hoy.
function desdeCuando() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let visto = null;
  try { visto = localStorage.getItem(CLAVE); } catch { /* modo incógnito */ }

  const vistoMs = visto ? new Date(visto).getTime() : 0;
  return new Date(Math.max(vistoMs, hoy.getTime()));
}

async function revisar() {
  try { pintar(await contarReportesDesde(desdeCuando())); }
  catch { /* sin conexión: el globito se queda como estaba */ }
}

function marcarVistas() {
  try { localStorage.setItem(CLAVE, new Date().toISOString()); } catch { /* modo incógnito */ }
  pintar(0);
}

function pintar(cuantos) {
  const globito = document.getElementById('badge-nuevos');
  const boton = document.querySelector('.tabbar__item[data-tab="guia"]');
  if (!globito) return;

  if (cuantos > 0) {
    globito.textContent = cuantos > 9 ? '9+' : String(cuantos);
    globito.hidden = false;
    // El número está en un span decorativo: quien use lector de pantalla lo
    // escucha aquí, dicho con palabras.
    boton?.setAttribute('aria-label',
      cuantos === 1 ? 'Reportes · 1 nuevo hoy' : `Reportes · ${cuantos} nuevos hoy`);
  } else {
    globito.hidden = true;
    boton?.removeAttribute('aria-label');
  }
}
