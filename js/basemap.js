// Mapa base (las calles que se ven debajo de los pines).
//
// CARTO empezó a exigir una llave para sus tiles: sin ella estampa
// "API KEY REQUIRED" encima del mapa. La llave es gratis y sin cobro para
// proyectos sin fines de lucro (5 millones de tiles al mes) y se pide en
// https://carto.com/basemaps/apikey — llega al correo al momento.
//
// Mientras no haya llave usamos OpenStreetMap, que se ve un poco más
// cargado pero funciona sin registrarse.

import { CARTO_KEY } from './config.js';

export function agregarMapaBase(mapa) {
  const capa = CARTO_KEY
    ? L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      })
    : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      });

  capa.addTo(mapa);
  return capa;
}
