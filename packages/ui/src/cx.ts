/**
 * Utilidad interna de presentación: concatena clases condicionales.
 * No es lógica de negocio: solo compone strings de Tailwind.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
