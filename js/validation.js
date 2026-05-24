// ============================================================================
// Validaciones de formulario.
// ============================================================================

// Normaliza un número de WhatsApp chileno a formato E.164: +569XXXXXXXX.
// Acepta entradas tipo "+56 9 1234 5678", "9 1234 5678", "912345678".
// Devuelve null si no es válido.
export function normalizarWhatsapp(input) {
  let d = (input || '').replace(/[^0-9]/g, ''); // solo dígitos
  if (d.startsWith('56')) d = d.slice(2);        // quita prefijo país si viene
  // Debe quedar 9 + 8 dígitos (móvil chileno)
  if (/^9\d{8}$/.test(d)) return '+56' + d;
  return null;
}

// Muestra el formato lindo: +56 9 1234 5678
export function formatearWhatsapp(e164) {
  const m = e164.match(/^\+56(9)(\d{4})(\d{4})$/);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
