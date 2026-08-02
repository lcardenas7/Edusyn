# Spec — `GET /onboarding/state` (Estado Canónico del Onboarding)

> Módulo 8 del Onboarding v2, elevado a **corazón** del proceso (auditoría: "Estado como corazón").
> Implementa §5 de la Constitución (AR10, E1–E4) contra el tipo **`OnboardingState`** ya firmado en `@edusyn/types`.
> Branch: `staging` · Fecha: 2026-08-02 · Regla: el backend **calcula**, el frontend **pinta** (AR2).

---

## 1. Objetivo

Un único endpoint que devuelve el estado completo del onboarding de la institución del usuario: qué pasos hay, cuáles están hechos/bloqueados/disponibles, con qué precondiciones, con qué conteos ya resueltos, y qué acción se puede hacer ahora. **El frontend no deriva nada** — cambia una línea del adaptador (`mockSource` → `httpSource`) y la pantalla existente se vuelve real.

## 2. Contrato

```
GET /onboarding/state
Auth:  JwtAuthGuard + RolesGuard
Roles: SUPERADMIN, ADMIN_INSTITUTIONAL, RECTOR, COORDINADOR
Tenant: requireInstitutionId(prisma, req)  // multi-tenant obligatorio (AR6)
200 → OnboardingState   // tipo importado de @edusyn/types (import type, AR3)
```

La respuesta **es** `OnboardingState` (no una variante nueva): `{ kind: 'onboarding', contractVersion: 1, progress, recommendedNext?, steps: CanonicalStep[] }`.

## 3. Los pasos (orden y señales reales)

Cada paso se calcula de datos que **ya existen** en el modelo. No se inventan tablas.

| # | `key` | `label` | `status = done` cuando… | `blockedBy` (precondición) | Fuente |
|---|-------|---------|--------------------------|----------------------------|--------|
| 1 | `siee-config` | Configuración SIEE | `getConfigCompleteness().ready === true` | — | `InstitutionConfigService.getConfigCompleteness` |
| 2 | `academic-year` | Año lectivo | existe un `AcademicYear` DRAFT o ACTIVE | `siee-config` | `academicYear.findFirst` |
| 3 | `students-import` | Estudiantes | hay ≥1 `StudentEnrollment` en el año destino | `siee-config`, `academic-year` | count enrollments + inferencia ecosistema |
| 4 | `teachers-import` | Docentes | hay ≥1 usuario con rol DOCENTE en la institución | `academic-year` | count InstitutionUser∩DOCENTE |
| 5 | `academic-load` | Carga académica | hay ≥1 `TeacherAssignment` en el año | `teachers-import`, `students-import` | count TeacherAssignment |
| 6 | `activation` | Activación del año | el año está `ACTIVE` | `students-import` | `AcademicYear.status` + `validate-activation` |

**Reglas de status por paso** (calculadas en backend, E1):
- `done` — cumple la señal de la columna 4.
- `locked` — alguna precondición de `blockedBy` no está `done`. Se llena `blockedBy[]` con mensaje humano.
- `available` — precondiciones cumplidas y aún no `done`.
- `error` — el paso corrió pero dejó hallazgos bloqueantes (ej. import con duplicados). *En v1 no persistimos hallazgos de import entre requests → sólo se marca `error` para `activation` si `validate-activation` devuelve errores.*
- `in_progress` — reservado para operaciones largas vía `ImportState` (no aplica a este endpoint de lectura).

## 4. Campos derivados (todos backend, E1/E3)

- **`progress`** — ponderado, no lineal. Pesos: `siee-config` 15, `academic-year` 15, `students-import` 30, `teachers-import` 15, `academic-load` 15, `activation` 10 (= 100). `progress = Σ pesos de pasos done`, redondeado.
- **`recommendedNext`** — `key` del primer paso en orden que **no** esté `done` y **no** esté `locked`. Si todo está `done`, se omite (onboarding completo).

## 5. Acciones por paso (`actions[]`, E2)

Cada acción viaja con todos los metadatos presentables. `enabled` lo decide el backend; el cliente nunca lo deduce.

- `siee-config` → `{ type:'apply_base', label:'Aplicar plantilla MEN', intent:{kind:'submit',method:'POST',path:'/institution-config/apply-base'} }` (si no `done`); `{ type:'view', intent:{kind:'navigate', path:'/setup'} }` (si `done`).
- `academic-year` → `{ type:'create_year', intent:{kind:'navigate', path:'/academic-years'} }` si no hay año.
- `students-import` → `{ type:'analyze', label:'Subir Excel de estudiantes', intent:{kind:'upload', path:'/onboarding/students/analyze'} }` + (deshabilitada si locked, con `reason`).
- `teachers-import` → `{ type:'analyze', intent:{kind:'upload', path:'/onboarding/teachers/analyze'} }` — **backend pendiente (Módulo 4)**: la acción se expone pero `enabled:false` con `reason:'Disponible próximamente'` hasta que exista el endpoint.
- `academic-load` → igual, `enabled:false` (Módulo 5 pendiente).
- `activation` → `{ type:'activate', variant:'destructive', requiresConfirmation:true, intent:{kind:'submit',method:'POST',path:'/academic-years/{yearId}/activate'} }`; `enabled` = `students-import` done Y `validate-activation.isValid`. `reason` desde los `errors` de validación.

> **Honestidad de la interfaz (UX11):** los pasos con backend pendiente (docentes, carga) se muestran con acción `enabled:false` y `reason` claro — nunca una puerta sin cuarto.

## 6. Conteos (`summary[]` por paso)

Valores ya formateados (es-CO, punto de miles). El cliente no formatea (§5.3).
- `academic-year`: año, períodos.
- `structure` (dentro de `students-import` o como fact): niveles, grados, grupos, sedes, jornadas.
- `students-import`: estudiantes matriculados.
- `teachers-import`: docentes.
- `academic-load`: asignaciones.

## 7. Arquitectura de implementación

- **Servicio nuevo**: `onboarding-state.service.ts` en `modules/iam/`. Método `getState(institutionId): Promise<OnboardingState>`. Reúne conteos con `Promise.all` (una pasada, sin N+1) y arma los pasos.
- **Controller nuevo**: `onboarding-state.controller.ts`, ruta `@Controller('onboarding')`, `@Get('state')`. Reusa `requireInstitutionId`.
- **Reutiliza** `InstitutionConfigService.getConfigCompleteness` (inyectado) — no reimplementa la regla SIEE (AR3). Requiere exportar `InstitutionConfigService` desde su módulo e importarlo en `IamModule` (o mover el servicio de estado al módulo que ya lo tiene). Decisión: importar `InstitutionConfigModule` en `IamModule`.
- **Tipos**: `import type { OnboardingState, CanonicalStep, Action } from '@edusyn/types'`. Cero redefinición (AR3, CH3).
- **Sin escritura**: es read-only puro (como analyze, I1). No toca datos.

## 8. Qué NO hace (v1)

- No persiste hallazgos de import entre requests (los `issues` de un análisis viven en el flujo de import, no en el estado). El estado refleja **hechos consumados** (conteos, estados), no el resultado transitorio de un análisis.
- No implementa los importadores de docentes/carga (Módulos 4/5) — solo expone sus pasos con acción deshabilitada y `reason`.
- No calcula promoción ni cierre (fuera del onboarding inicial).

## 9. Pruebas (staging)

Crear institución simulada y recorrer: SIEE base → crear año DRAFT → analyze/apply estudiantes → volver a pedir `state` y verificar que `progress` sube, `students-import` pasa a `done`, `recommendedNext` avanza, y `activation` se habilita cuando corresponde. Eventualidades a probar: sin año lectivo (students locked), Excel con duplicados (analyze reporta), doble apply (idempotente, no duplica), activar sin validación (bloqueado con reason).
