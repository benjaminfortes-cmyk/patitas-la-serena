// ============================================================================
// Orquestador principal: arranca el mapa, los filtros y la carga de reportes.
// ============================================================================
import { initMap, renderReports, getMap, flyTo } from './map.js';
import { initFilters, onFiltersChange, filterState } from './filters.js';
import { fetchReports, fetchReportById } from './data.js';
import { openReportCard, closeReportCard } from './reportCard.js';
import { toast } from './ui.js';
import { isConfigured } from './supabase.js';
import { initAuth, initAuthUI } from './auth.js';
import { initReportForm } from './reportForm.js';
import { initMatching } from './matching.js';
import { initHistorias } from './historias.js';
import { initPWA } from './pwa.js';
import { initAlertas } from './alerts.js';
import { initSoporte } from './support.js';

// Recarga reportes según los filtros actuales y los pinta en el mapa.
async function recargar() {
  const reports = await fetchReports(filterState);
  renderReports(reports, openReportCard);
}
// Disponible para que las acciones de la ficha (resolver, denunciar) refresquen.
window.recargarMapa = recargar;

function init() {
  initMap();
  initFilters();
  onFiltersChange(recargar);

  // Sesión (Google) y formulario de publicación
  initAuth();
  initAuthUI();
  initReportForm(recargar);
  initMatching();
  initHistorias();
  initAlertas();
  initSoporte();
  initPWA();
  initInfobar();

  // Si se abrió con ?reporte=ID (enlace compartido), abre esa ficha.
  abrirDesdeEnlace();

  // Cerrar la ficha al tocar el fondo oscuro o presionar Escape.
  document.getElementById('backdrop').addEventListener('click', closeReportCard);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReportCard(); });

  // Botón flotante "Reportar"
  document.getElementById('btn-report').addEventListener('click', () => {
    window.openReportForm?.();
  });

  // Aviso de modo demo
  if (!isConfigured) {
    toast('Modo demo: configura Supabase para usar datos reales.', 'info');
  }

  recargar();

  // Ajusta el mapa cuando la pantalla cambia de tamaño (orientación móvil).
  window.addEventListener('resize', () => getMap()?.invalidateSize());
}

// Franja institucional fija: solo mide su alto real para que no tape el mapa.
function initInfobar() {
  const bar = document.getElementById('infobar');
  if (!bar) return;
  const ajustar = () => {
    document.documentElement.style.setProperty('--infobar-h', bar.offsetHeight + 'px');
    getMap()?.invalidateSize();
  };
  ajustar();
  window.addEventListener('resize', ajustar);
}

// Abre una ficha directamente si la URL trae ?reporte=ID (enlace compartido).
async function abrirDesdeEnlace() {
  const id = new URLSearchParams(location.search).get('reporte');
  if (!id) return;
  const r = await fetchReportById(id);
  if (r) { openReportCard(r); if (r.lat != null) flyTo(r.lat, r.lng, 16); }
}

document.addEventListener('DOMContentLoaded', init);
