

import { esAppAndroid } from './appMode.js';

export function linkWhatsapp(numero, mensaje) {
  const num = String(numero ?? '').replace(/[^0-9]/g, '');   // 569XXXXXXXX
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}

// ¿Este navegador sabe abrir pestañas nuevas de verdad?
function admitePestanaNueva() {
  const ua = navigator.userAgent || '';
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: minimal-ui)').matches
    || window.navigator.standalone === true;          // iOS
  const navegadorAjeno = /Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|Threads/i.test(ua);
  return !(instalada || navegadorAjeno || esAppAndroid());
}

export function abrirWhatsapp(url) {
  if (admitePestanaNueva()) {
    const v = window.open(url, '_blank', 'noopener');
    if (v) return;
  }
  window.location.href = url;   // misma ventana: el teléfono se lo pasa a WhatsApp
}

// Deja un <a> listo para escribir. El href queda puesto (así se puede copiar el
// enlace o abrirlo en otra pestaña a mano) y el clic lo manejamos nosotros.
export function prepararBotonWhatsapp(a, url) {
  a.href = url;
  a.rel = 'noopener';
  a.target = admitePestanaNueva() ? '_blank' : '_self';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    abrirWhatsapp(url);
  });
}
