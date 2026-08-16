// ¿Estamos dentro de la app de Google Play?

const PAQUETE = 'android-app://cl.buscahuellitas.app';
const CLAVE = 'bh-desde-app';

function detectar() {
  if (document.referrer.startsWith(PAQUETE)) return true;
  return new URLSearchParams(location.search).get('app') === 'android';
}

let cache = null;

export function esAppAndroid() {
  if (cache !== null) return cache;
  try {
    if (detectar()) sessionStorage.setItem(CLAVE, '1');
    cache = sessionStorage.getItem(CLAVE) === '1';
  } catch {
    cache = detectar();   // modo incógnito: sin memoria, queda el referrer
  }
  return cache;
}
