/**
 * Generador de códigos de acceso de 6 dígitos para sesiones públicas.
 * Colisión extremadamente baja (1M combinaciones) y reintenta si ya existe.
 */
export function generateJoinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatJoinCode(code: string): string {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  return code;
}
