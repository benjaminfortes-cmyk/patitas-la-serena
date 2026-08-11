// ============================================================================
// Globito rojo de novedades (barra inferior en el celular, menú lateral en el
// computador: los dos llevan la pestaña "Reportes" y los dos lo muestran).
//
// Igual que en Instagram: si hoy hubo novedades que esta persona todavía no
// mira, la pestaña "Reportes" lleva un círculo rojo con cuántas son. Cuentan
// como novedad tanto un reporte nuevo como uno que volvió a casa (la historia
// feliz). Al tocarla se apaga, y vuelve a encenderse con la próxima.
//
// "Nuevo" se mide desde la última vez que tocó la pestaña, y nunca más atrás de
// las 00:00 de hoy: al día siguiente el globito parte limpio.
// ============================================================================
import { contarReportesDesde } from './data.js';

const CLAVE = 'bh_novedades_vistas';   // en localStorage, ISO de la última mirada
const CADA = 3 * 60 * 1000;            // cada cuánto vuelve a preguntar

// Las dos pestañas "Reportes": la de la barra de abajo y la del menú lateral.
const BOTONES = '.tabbar__item[data-tab="guia"], .sidenav__item[data-nav="guia"]';

export function initNovedades() {
  const botones = document.querySelectorAll(BOTONES);
  if (!botones.length) return;

  botones.forEach((b) => b.addEventListener('click', marcarVistas));
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
  const globitos = document.querySelectorAll('.js-badge-nuevos');
  const botones = document.querySelectorAll(BOTONES);
  if (!globitos.length) return;

  const texto = cuantos > 9 ? '9+' : String(cuantos);
  globitos.forEach((g) => {
    if (cuantos > 0) { g.textContent = texto; g.hidden = false; }
    else g.hidden = true;
  });

  // El número está en un span decorativo: quien use lector de pantalla lo
  // escucha aquí, dicho con palabras.
  botones.forEach((b) => {
    if (cuantos > 0) {
      b.setAttribute('aria-label',
        cuantos === 1 ? 'Reportes · 1 novedad hoy' : `Reportes · ${cuantos} novedades hoy`);
    } else b.removeAttribute('aria-label');
  });
}
