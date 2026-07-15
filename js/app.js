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

  // Si se abrió con ?reporte=ID (enlace compartido), abre esa ficha.
  abrirDesdeEnlace();

  // Cerrar la ficha al tocar el fondo oscuro o presionar Escape.
  document.getElementById('backdrop').addEventListener('click', closeReportCard);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReportCard(); });

  // Botón flotante "Reportar"
  document.getElementById('btn-report').addEventListener('click', () => {
    window.openReportForm?.();
  });

  // Cambio de vistas Inicio <-> Mapa (misma app, sin recargar).
  const mostrarVista = (v) => {
    document.body.dataset.vista = v;
    document.querySelectorAll('.tabbar__item').forEach((t) =>
      t.classList.toggle('tabbar__item--active', t.dataset.tab === 'inicio' && v === 'home'));
    if (v === 'mapa') requestAnimationFrame(() => getMap()?.invalidateSize());
  };
  window.mostrarVista = mostrarVista;
  document.getElementById('btn-ir-mapa')?.addEventListener('click', () => mostrarVista('mapa'));
  document.querySelector('.brand')?.addEventListener('click', () => mostrarVista('home'));

  // Barra de navegación inferior (móvil): reutiliza los controles ya existentes.
  document.querySelector('[data-tab="inicio"]')?.addEventListener('click', () => mostrarVista('home'));
  document.querySelector('[data-tab="reportar"]')?.addEventListener('click', () => window.openReportForm?.());
  document.querySelector('[data-tab="historias"]')?.addEventListener('click', () => document.getElementById('btn-historias')?.click());
  document.querySelector('[data-tab="soporte"]')?.addEventListener('click', () => document.getElementById('btn-soporte')?.click());
  document.querySelector('[data-tab="alertas"]')?.addEventListener('click', () => window.openAlertas?.());

  // Aviso de modo demo
  if (!isConfigured) {
    toast('Modo demo: configura Supabase para usar datos reales.', 'info');
  }

  recargar();

  // Ajusta el mapa cuando la pantalla cambia de tamaño (orientación móvil).
  window.addEventListener('resize', () => getMap()?.invalidateSize());
}

// Abre una ficha directamente si la URL trae ?reporte=ID (enlace compartido).
async function abrirDesdeEnlace() {
  const id = new URLSearchParams(location.search).get('reporte');
  if (!id) return;
  const r = await fetchReportById(id);
  if (r) { window.mostrarVista?.('mapa'); openReportCard(r); if (r.lat != null) flyTo(r.lat, r.lng, 16); }
}

document.addEventListener('DOMContentLoaded', init);
