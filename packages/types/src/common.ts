/**
 * @edusyn/types — Primitivas compartidas del contrato backend/frontend.
 *
 * Reglas de la Constitución (docs/EDUSYN_PRODUCT_ARCHITECTURE.md) que aquí se formalizan:
 *  - AR2  El frontend solo representa estado: todo valor de este archivo lo calcula el backend.
 *  - C4   Los errores viajan como datos estructurados, no como texto suelto.
 *  - AR13 Fallar fuerte y claro: todo hallazgo dice qué pasó, dónde y cómo corregir.
 *  - UX2  Todo error es entendible y accionable.
 *
 * Convenciones del contrato (decisión de arquitectura, ver README del paquete):
 *  - Las KEYS son siempre inglés camelCase. Nunca español, nunca con tildes.
 *  - Los VALORES mostrables (`label`, `message`, `howToFix`, `reason`) llegan
 *    ya localizados en español desde el backend. El frontend NUNCA traduce
 *    códigos a texto por su cuenta.
 */

/**
 * Severidad única de todo el sistema.
 *
 * Unifica los tres lugares donde la Constitución habla de severidad:
 *  - §5.3 `issues[].severidad` del Estado Canónico
 *  - §7 I2 clasificación P0/P1/P2 de los Importadores
 *  - CH8 errores estructurados del checklist
 *
 * Mapeo normativo:
 *  - 'blocking' = P0 Bloqueante  → impide continuar / impide el apply
 *  - 'warning'  = P1 Advertencia → no bloquea, se destaca
 *  - 'info'     = P2 Sugerencia  → informativa
 *
 * El frontend SOLO usa este campo para elegir presentación (color, ícono,
 * orden). Nunca para decidir si algo bloquea: eso llega ya decidido en
 * `enabled`, `canApply`, `status`, etc. (AR2/E2).
 */
export type Severity = 'blocking' | 'warning' | 'info';

/**
 * Ubicación de un hallazgo dentro de la entrada del usuario (C4/AR13).
 * Ambos campos son opcionales: un hallazgo global no tiene fila ni campo.
 */
export interface IssueLocation {
  /** Fila del archivo importado (1-based, como la ve el usuario en Excel). */
  row?: number;
  /** Nombre del campo/columna tal como lo conoce el usuario. */
  field?: string;
}

/**
 * Hallazgo estructurado (C4, AR13, CH8, UX2).
 * Es la unidad de error/advertencia/sugerencia en TODO el sistema:
 * Estado Canónico, validación de importadores y cuadre de resultado.
 */
export interface Issue {
  severity: Severity;
  /**
   * Código estable y único por tipo de hallazgo (ej. 'DUPLICATE_DOCUMENT',
   * 'EMAIL_COLLISION', 'GRADE_SEQUENCE_GAP'). Sirve para telemetría, tests
   * y documentación. El frontend NO lo traduce a texto: muestra `message`.
   */
  code: string;
  /** Qué pasó. Texto final, localizado (es), redactado para humanos. */
  message: string;
  /** Cómo corregirlo. Texto final, localizado (es). Obligatorio para 'blocking'. */
  howToFix?: string;
  location?: IssueLocation;
}

/** Variante visual de una acción. Decisión de UX del backend, no del cliente. */
export type ActionVariant = 'primary' | 'secondary' | 'destructive';

/**
 * Qué debe hacer el cliente cuando el usuario activa la acción.
 * El frontend ejecuta el intent sin interpretarlo (G3: nunca asume
 * comportamiento no contratado).
 */
export type ActionIntent =
  /** Navegación interna del cliente (react-router o equivalente). */
  | { kind: 'navigate'; path: string }
  /**
   * Llamada al endpoint indicado SIN payload (decisión de contrato 2026-08-01,
   * enmienda punto #2, opción (a)).
   *
   * `submit` es solo para acciones auto-contenidas: confirmar, reintentar,
   * activar, cerrar. Las acciones que requieren DATOS del dominio (ej. apply
   * con academicYearId) NO se modelan como Action genérica: las gobierna el
   * componente del módulo según su propio contrato. Así la Action sigue
   * siendo auto-describible y el frontend no necesita conocimiento del
   * módulo para construir un body (E2).
   */
  | { kind: 'submit'; method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }
  /**
   * Subida de archivo al endpoint indicado (decisión de contrato 2026-08-01,
   * enmienda punto #3).
   *
   * El componente de upload (FileDropUpload) ejecuta este intent enviando
   * multipart/form-data con el campo ESTÁNDAR `file`. El archivo lo aporta
   * el usuario a través del componente, no el módulo: la Action sigue sin
   * payload de dominio y el frontend no conoce el endpoint por su cuenta
   * (AR2). Si un módulo necesita campos extra, es extensión de contrato
   * de ese módulo, no de esta forma base.
   */
  | { kind: 'upload'; path: string };

/**
 * Acción disponible AHORA sobre un paso o proceso (§5.3 `actions[]`, E2).
 *
 * Viaja con TODOS los metadatos presentables para que el frontend renderice
 * el botón sin decidir nada: ni el texto, ni el estilo, ni la elegibilidad.
 */
export interface Action {
  /**
   * Tipo estable de la acción (ej. 'continue', 'apply', 'retry', 'download_template').
   * Sirve para tests y analítica. El frontend no ramifica lógica por `type`:
   * renderiza según `enabled`/`variant` y ejecuta `intent`.
   */
  type: string;
  /** Texto del botón. Final, localizado (es). */
  label: string;
  /**
   * Elegibilidad calculada por el backend (E2). Si es `false`, el cliente
   * deshabilita el control y muestra `reason` (UX5: nunca bloquear sin explicar).
   */
  enabled: boolean;
  /** Por qué está deshabilitada / qué la desbloquea. Localizado (es). */
  reason?: string;
  variant: ActionVariant;
  /**
   * Si es `true`, el cliente DEBE pedir confirmación explícita antes de
   * ejecutar el intent (I4, UX9). La UI de confirmación es genérica
   * (ConfirmationDialog); el motivo se muestra con `label`/`reason`.
   */
  requiresConfirmation: boolean;
  intent: ActionIntent;
}
