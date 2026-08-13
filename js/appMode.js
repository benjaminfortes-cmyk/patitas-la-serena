// ============================================================================
// ¿Estamos dentro de la app de Google Play?
//
// La app de Android es un TWA: el mismo buscahuellitas.cl abierto dentro de un
// contenedor. Mismo dominio, mismo código, misma base de datos — así que para
// tratar distinto a quien viene de la tienda hay que reconocerlo de algún modo.
//
// Android lo delata en el referrer de la primera carga:
//     document.referrer === 'android-app://cl.buscahuellitas.app'
//
// Ese referrer existe SOLO en la navegación inicial: si la persona recarga o
// vuelve de un enlace, se pierde. Por eso hay que guardarlo.
//
// Y acá está la trampa: se guarda en sessionStorage, NUNCA en localStorage.
// El TWA comparte el almacenamiento con el Chrome del teléfono, así que una
// marca en localStorage haría que el sitio abierto en el navegador —en ese
// mismo teléfono— también se creyera "la app" y empezara a exigir registro,
// justo lo contrario de lo que queremos. sessionStorage vive por pestaña y no
// se contagia.
// ============================================================================

const PAQUETE = 'android-app://cl.buscahuellitas.app';
const CLAVE = 'bh-desde-app';

function detectar() {
  if (document.referrer.startsWith(PAQUETE)) return true;
  // Respaldo: en PWABuilder se puede fijar la URL de arranque del paquete de
  // Android (y solo la de ese paquete). Si el referrer fallara en alguna
  // versión de Android, ?app=android sigue sirviendo.
  return new URLSearchParams(location.search).get('app') === 'android';
}

let cache = null;

/** true si esta pestaña se abrió desde la app instalada de Google Play. */
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
