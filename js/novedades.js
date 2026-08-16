// Globito rojo con los reportes nuevos del día.

import { contarReportesDesde } from './data.js';

const CLAVE = 'bh_novedades_vistas';   // en localStorage, ISO de la última mirada
const CADA = 3 * 60 * 1000;            // cada cuánto vuelve a preguntar

const BOTONES = '.tabbar__item[data-tab="guia"], .sidenav__item[data-nav="guia"]';

export function initNovedades() {
  const botones = document.querySelectorAll(BOTONES);
  if (!botones.length) return;

  botones.forEach((b) => b.addEventListener('click', marcarVistas));
  window.marcarNovedadesVistas = marcarVistas;

  revisar();
  setInterval(() => { if (!document.hidden) revisar(); }, CADA);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisar(); });
}

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

  botones.forEach((b) => {
    if (cuantos > 0) {
      b.setAttribute('aria-label',
        cuantos === 1 ? 'Reportes · 1 novedad hoy' : `Reportes · ${cuantos} novedades hoy`);
    } else b.removeAttribute('aria-label');
  });
}
