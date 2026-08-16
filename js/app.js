// Orquestador principal: arranca el mapa, los filtros y la carga de reportes.

import { initMap, renderReports, getMap, flyTo } from './map.js';
import { initFilters, onFiltersChange, filterState, filtrarPorTipo } from './filters.js';
import { fetchReports, fetchReportById } from './data.js';
import { openReportCard, closeReportCard } from './reportCard.js';
import { toast } from './ui.js';
import { isConfigured } from './supabase.js';
import { initAuth, initAdminAccess } from './auth.js';
import { initAppGate } from './appGate.js';
import { initReportForm } from './reportForm.js';
import { initMatching } from './matching.js';
import { initHistorias } from './historias.js';
import { initPWA } from './pwa.js';
import { initAlertas } from './alerts.js';
import { initSoporte } from './support.js';
import { initGuia } from './guia.js';
import { initEstadisticas } from './stats.js';
import { initRevisiones } from './revisiones.js';
import { initNovedades } from './novedades.js';

async function recargar() {
  const reports = await fetchReports(filterState);
  renderReports(reports, openReportCard);
}
window.recargarMapa = recargar;

function init() {
  initMap();
  initFilters();
  onFiltersChange(recargar);

  initAuth();
  initAppGate();       // en la app de Google Play (y solo ahí): registro obligatorio
  initAdminAccess();   // botón de admin, solo si se entró con ?admin=1
  initEstadisticas();  // botón "Estadística", al lado del de admin y solo para admins
  initRevisiones();    // botón "Avisos", los reencuentros por verificar
  initReportForm(recargar);
  initMatching();
  initHistorias();
  initAlertas();
  initSoporte();
  initGuia();
  initPWA();
  initNovedades();   // globito rojo con los reportes nuevos del día

  abrirDesdeEnlace();

  document.getElementById('backdrop').addEventListener('click', closeReportCard);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReportCard(); });

  document.getElementById('btn-report').addEventListener('click', () => {
    window.openReportForm?.();
  });

  const mostrarVista = (v) => {
    document.body.dataset.vista = v;
    document.querySelectorAll('.tabbar__item').forEach((t) =>
      t.classList.toggle('tabbar__item--active', t.dataset.tab === 'inicio' && v === 'home'));
    document.querySelectorAll('.sidenav__item').forEach((t) =>
      t.classList.toggle('sidenav__item--active',
        (t.dataset.nav === 'inicio' && v === 'home') || (t.dataset.nav === 'mapa' && v === 'mapa')));
    if (v === 'mapa') getMap()?.invalidateSize();
  };
  window.mostrarVista = mostrarVista;
  document.getElementById('btn-ir-mapa')?.addEventListener('click', () => mostrarVista('mapa'));

  document.querySelectorAll('.accion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.accion;
      if (accion === 'publicar') return window.openReportForm?.();
      if (accion === 'adoptar') filtrarPorTipo('encontrado');
      else if (filterState.kinds.length) filtrarPorTipo('');
      mostrarVista('mapa');
    });
  });
  document.getElementById('btn-alertas')?.addEventListener('click', () => window.openAlertas?.());
  document.querySelector('.brand')?.addEventListener('click', () => mostrarVista('home'));

  document.querySelector('[data-tab="inicio"]')?.addEventListener('click', () => mostrarVista('home'));
  document.querySelector('[data-tab="reportar"]')?.addEventListener('click', () => window.openReportForm?.());
  document.querySelector('[data-tab="historias"]')?.addEventListener('click', () => document.getElementById('btn-historias')?.click());
  document.querySelector('[data-tab="soporte"]')?.addEventListener('click', () => document.getElementById('btn-soporte')?.click());
  document.querySelector('[data-tab="guia"]')?.addEventListener('click', () => window.openGuia?.());

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switch (btn.dataset.nav) {
        case 'inicio':    return mostrarVista('home');
        case 'mapa':      return mostrarVista('mapa');
        case 'reportar':  return window.openReportForm?.();
        case 'guia':      return window.openGuia?.();
        case 'historias': return document.getElementById('btn-historias')?.click();
        case 'alertas':   return document.getElementById('btn-alertas')?.click();
        case 'soporte':   return document.getElementById('btn-soporte')?.click();
        case 'instalar':  return document.getElementById('btn-instalar')?.click();
      }
    });
  });
  mostrarVista(document.body.dataset.vista === 'mapa' ? 'mapa' : 'home');

  if (!isConfigured) {
    toast('Modo demo: configura Supabase para usar datos reales.', 'info');
  }

  entradaDesdeAliado();

  recargar();

  window.addEventListener('resize', () => getMap()?.invalidateSize());
}

const ALIADOS = {
  marigen: 'Fundación Marigen',
};

function entradaDesdeAliado() {
  const params = new URLSearchParams(location.search);
  const ref = (params.get('ref') || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);

  if (ref) {
    try { localStorage.setItem('bh_ref', ref); } catch { /* modo incógnito */ }
    const aliado = ALIADOS[ref];
    if (aliado) toast(`Llegaste desde ${aliado}. Aquí puedes publicar tu reporte.`, 'info');
  }

  const ir = params.get('ir');
  if (ir === 'reportar') window.openReportForm?.();
  else if (ir === 'mapa') window.mostrarVista?.('mapa');
}

async function abrirDesdeEnlace() {
  const id = new URLSearchParams(location.search).get('reporte');
  if (!id) return;
  const r = await fetchReportById(id);
  if (r) { window.mostrarVista?.('mapa'); openReportCard(r); if (r.lat != null) flyTo(r.lat, r.lng, 16); }
}

document.addEventListener('DOMContentLoaded', init);
