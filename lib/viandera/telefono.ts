const MINIMO_DIGITOS_TELEFONO = 8;

/**
 * `wa.me` espera el número en formato internacional completo y sin
 * separadores: código de país + código de área + número, todo junto (ej.
 * Argentina: 549 + área + número). Esta función NO agrega ningún código de
 * país ni reformatea el dato guardado — solo saca lo que no sea dígito y
 * exige un mínimo razonable de dígitos restantes, para no armar un link
 * roto (`https://wa.me/?text=...`) con un valor que en realidad son solo
 * espacios, guiones u otros símbolos. La validación estricta del formato
 * (código de país correcto, longitud exacta por país) queda señalada como
 * mejora posterior en el formulario de perfil de la viandera — acá es
 * solo la última red de seguridad antes de armar el enlace.
 *
 * Vive en un módulo aparte (no dentro de `WhatsAppIntent.tsx`) porque ese
 * componente es `"use client"` — una función exportada de un módulo
 * cliente no se puede invocar directo desde un Server Component como
 * `app/[slug]/page.tsx`, que también necesita este resultado para decidir
 * si renderiza `StickyContactBar`.
 */
export function telefonoParaWhatsapp(telefono: string | null): string | null {
  if (!telefono) return null;
  const soloDigitos = telefono.replace(/\D/g, "");
  return soloDigitos.length >= MINIMO_DIGITOS_TELEFONO ? soloDigitos : null;
}
