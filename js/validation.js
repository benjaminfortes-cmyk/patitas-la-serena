// Validaciones de formulario.

export function normalizarWhatsapp(input) {
  let d = (input || '').replace(/[^0-9]/g, ''); // solo dígitos
  if (d.startsWith('56')) d = d.slice(2);        // quita prefijo país si viene
  if (/^9\d{8}$/.test(d)) return '+56' + d;
  return null;
}

export function formatearWhatsapp(e164) {
  const m = e164.match(/^\+56(9)(\d{4})(\d{4})$/);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
