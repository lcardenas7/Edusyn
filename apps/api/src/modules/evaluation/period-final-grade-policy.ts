/**
 * F-1 · Quién puede fijar la nota final de período, y bajo qué condiciones.
 *
 * Hasta este cambio la única validación era que el período no estuviera
 * finalizado: cualquier docente podía fijar la nota final de una asignatura que
 * no imparte, en un grupo que no es suyo, y el alcance institucional se deducía
 * de la matrícula recibida en la petición en vez de la sesión.
 *
 * La política adoptada NO cierra la capacidad legítima del docente —hay casos
 * reales en que es él quien debe fijarla— sino el permiso indiscriminado.
 *
 * Esta función es deliberadamente pura: recibe hechos ya averiguados y devuelve
 * una decisión. Así la regla se puede probar entera sin base de datos, y el
 * servicio se limita a reunir los hechos y obedecer.
 */

/** Causales admitidas. Lista cerrada: no existe una opción libre. */
export const CAUSALES_NOTA_FINAL = [
  'INGRESO_TARDIO',
  'HOMOLOGACION',
  'RECUPERACION_NIVELACION',
  'EVALUACION_CUALITATIVA',
  'SIN_ACTIVIDADES_CONFIGURADAS',
  'CORRECCION_DOCUMENTADA',
] as const;

export type CausalNotaFinal = (typeof CAUSALES_NOTA_FINAL)[number];

export function esCausalValida(valor: unknown): valor is CausalNotaFinal {
  return typeof valor === 'string' && (CAUSALES_NOTA_FINAL as readonly string[]).includes(valor);
}

/**
 * Roles que operan y supervisan dentro de su propia institución sin necesidad
 * de titularidad ni causal. El rector llega además por herencia de la autoridad
 * institucional, de modo que basta con que figure aquí una vez.
 */
const ROLES_SUPERVISORES = [
  'SUPERADMIN',
  'SUPER_ADMIN',
  'ADMIN_INSTITUTIONAL',
  'RECTOR',
  'COORDINADOR',
];

export interface HechosNotaFinal {
  /** Roles efectivos de la sesión, ya expandidos por la jerarquía. */
  roles: readonly string[];
  esSuperAdmin?: boolean;
  /** Institución derivada de la SESIÓN. Nunca de la petición. */
  institucionSesion: string;
  /** Institución de cada recurso recibido, para contrastarla con la anterior. */
  institucionMatricula: string | null;
  institucionPeriodo: string | null;
  institucionAsignatura: string | null;
  /** Estado del período académico. */
  periodoFinalizado: boolean;
  /** ¿La institución habilitó que sus docentes fijen notas finales? */
  habilitacionInstitucional: boolean;
  /** ¿El docente imparte esa asignatura en ese grupo? Irrelevante para supervisores. */
  esTitular: boolean;
  /** Causal declarada en la petición. */
  causal: unknown;
}

export type MotivoRechazo =
  | 'FUERA_DE_INSTITUCION'
  | 'PERIODO_FINALIZADO'
  | 'HABILITACION_INSTITUCIONAL_INACTIVA'
  | 'SIN_TITULARIDAD'
  | 'CAUSAL_INVALIDA'
  | 'ROL_NO_AUTORIZADO';

export interface Decision {
  permitido: boolean;
  motivo?: MotivoRechazo;
  /** Causal que debe quedar registrada en la auditoría, si la hay. */
  causalRegistrada?: CausalNotaFinal;
}

const PERMITIDO = (causal?: CausalNotaFinal): Decision => ({ permitido: true, causalRegistrada: causal });
const RECHAZADO = (motivo: MotivoRechazo): Decision => ({ permitido: false, motivo });

/**
 * Decide si una escritura de nota final puede seguir adelante.
 *
 * El orden de las comprobaciones no es casual. El alcance institucional se
 * evalúa PRIMERO y por separado: un recurso de otra institución debe tratarse
 * como inexistente, no como prohibido, para no revelar que existe.
 */
export function decidirEscrituraNotaFinal(h: HechosNotaFinal): Decision {
  // 1. Alcance institucional. La sesión manda; la petición solo se contrasta.
  const ajenos = [h.institucionMatricula, h.institucionPeriodo, h.institucionAsignatura];
  if (ajenos.some((x) => x === null || x !== h.institucionSesion)) {
    return RECHAZADO('FUERA_DE_INSTITUCION');
  }

  // 2. Período. La excepción del período cerrado exige un segundo actor y se
  //    tratará en su propio bloque; hasta entonces se mantiene cerrado.
  if (h.periodoFinalizado) return RECHAZADO('PERIODO_FINALIZADO');

  // 3. Supervisores: operan dentro de su institución sin causal ni titularidad.
  //    Su rastro queda igualmente en la auditoría.
  const esSupervisor = h.esSuperAdmin === true || h.roles.some((r) => ROLES_SUPERVISORES.includes(r));
  if (esSupervisor) {
    // Si declaran causal, se respeta y se registra; no se les exige.
    return PERMITIDO(esCausalValida(h.causal) ? h.causal : undefined);
  }

  // 4. Docente: las cuatro condiciones son acumulativas.
  if (!h.roles.includes('DOCENTE')) return RECHAZADO('ROL_NO_AUTORIZADO');
  if (!h.habilitacionInstitucional) return RECHAZADO('HABILITACION_INSTITUCIONAL_INACTIVA');
  if (!h.esTitular) return RECHAZADO('SIN_TITULARIDAD');
  if (!esCausalValida(h.causal)) return RECHAZADO('CAUSAL_INVALIDA');

  return PERMITIDO(h.causal);
}

/** Mensaje para la persona que recibe el rechazo. Explica qué hacer, no qué falló por dentro. */
export function mensajeDeRechazo(motivo: MotivoRechazo): string {
  switch (motivo) {
    case 'PERIODO_FINALIZADO':
      return 'El período está finalizado. Debe reabrirse formalmente para modificar notas.';
    case 'HABILITACION_INSTITUCIONAL_INACTIVA':
      return 'Tu institución no tiene habilitado que los docentes registren notas finales de período. Solicítalo a coordinación o a la administración institucional.';
    case 'SIN_TITULARIDAD':
      return 'Solo puedes registrar la nota final de las asignaturas y grupos que tienes asignados.';
    case 'CAUSAL_INVALIDA':
      return 'Indica el motivo por el que registras la nota final directamente. Debe ser uno de los motivos previstos.';
    case 'ROL_NO_AUTORIZADO':
      return 'Tu perfil no puede registrar notas finales de período.';
    case 'FUERA_DE_INSTITUCION':
    default:
      return 'Registro no encontrado.';
  }
}
