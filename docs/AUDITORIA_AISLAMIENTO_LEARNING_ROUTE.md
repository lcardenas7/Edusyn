# Auditoría de aislamiento — `learning-route`

Fecha: 2026-09-11 · Autor: Claude · Encargo: [`ENCARGO_CLAUDE_BLINDAJE_LEARNING_ROUTE.md`](ENCARGO_CLAUDE_BLINDAJE_LEARNING_ROUTE.md)
Rama: `codex/blindaje-learning-route-claude`, desde `origin/staging` `38614231`.

> ## En una frase
>
> De las **16 rutas** del módulo, **14 pasaban el identificador del cliente directo a una consulta
> por id**: con un id de otro colegio se leía su ruta, se editaba, se borraba, se reordenaban sus
> pasos y se creaban actividades y lecciones **dentro de su aula**. Ahora la institución la pone el
> actor en las 14, con la cadena del esquema validada; las 2 restantes son globales, demostrado.

---

## 1. Inventario ANTES

`LearningRouteController` declara 16 rutas (contadas de nuevo, coincide con el encargo). Ninguna
llamada a `requireInstitutionId` en todo el módulo; `create` y `fromPlan` usaban `resolveInstitutionId`,
que puede devolver vacío, con un `throw new Error` genérico. Operaciones Prisma: 31 en
`learning-route.service.ts`, 5 en `competency-evidence.service.ts`, 1 en el controlador.

| # | Ruta | Rol | Estado ANTES | Consecuencia real |
|---|---|---|---|---|
| 1 | `GET competencies` | DOC/COORD | **Catálogo global** | Ninguna: `Competency` no tiene `institutionId` |
| 2 | `GET classroom/:classroomId` | DOC/COORD/EST | **Deuda** | `findMany({ classroomId })`: lista las rutas de un aula de otro colegio |
| 3 | `GET :routeId` | DOC/COORD/EST | **Deuda** | `findUnique`: devuelve ruta, pasos y actividades ajenas |
| 4 | `GET :routeId/progress` | EST | **Deuda doble** | Matrícula buscada sin institución + progreso de un `routeId` ajeno |
| 5 | `POST /` | DOC/COORD | Parcial | Validaba aula∈institución, pero resolvía con `resolveInstitutionId` |
| 6 | `POST generate` | DOC/COORD | **No institucional** | Sin persistencia: cero operaciones Prisma |
| 7 | `POST from-plan` | DOC/COORD | Parcial | Igual que 5 |
| 8 | `PUT :routeId` | DOC/COORD | **Deuda grave** | `update({ id }, data: any)`: editaba una ruta ajena **y** el cuerpo podía cambiar `institutionId`/`classroomId` |
| 9 | `DELETE :routeId` | DOC/COORD | **Deuda** | Borraba una ruta de otro colegio |
| 10 | `POST :routeId/steps` | DOC/COORD | **Deuda** | Creaba pasos dentro de una ruta ajena |
| 11 | `POST :routeId/steps/new-activity` | DOC/COORD | **Deuda** | Creaba una `ClassroomActivity` **en el aula ajena** |
| 12 | `PUT :routeId/steps/reorder` | DOC/COORD | **Deuda doble** | Actualizaba por id suelto: reordenaba pasos ajenos y colaba pasos de otra ruta |
| 13 | `POST steps/:stepId/generate-lesson` | DOC/COORD | **Deuda + coste** | Generaba con Valeria y creaba actividad y lección en el aula ajena; borraba su lección anterior |
| 14 | `PUT steps/:stepId` | DOC/COORD | **Deuda** | Editaba un paso ajeno y aceptaba `activityId` de otro colegio |
| 15 | `POST steps/:stepId/activity` | DOC/COORD | **Deuda** | Igual que 11, sobre un paso ajeno |
| 16 | `DELETE steps/:stepId` | DOC/COORD | **Deuda** | Borraba un paso ajeno |

**En los servicios**, además: `getMastery` y `getRouteProgress` no acotaban la evidencia, y
`recordFromActivity` buscaba los pasos de una actividad **sin institución** — con `updateStep`
aceptando `activityId` ajeno, eso podía producir evidencia cruzada.

## 2. Inventario DESPUÉS

| Clasificación | Rutas |
|---|---|
| **Institucional, resuelta con `requireInstitutionId` del actor** | 14 (todas menos `competencies` y `generate`) |
| **Catálogo global comprobado** | `GET competencies` — `Competency` no tiene `institutionId` en `schema.prisma` |
| **Sin operación de base** | `POST generate` — devuelve el borrador de Valeria; no lee ni escribe |
| **Deuda pendiente** | Ninguna en aislamiento entre instituciones. Ver §6 para el Bloque 4 |

Cadena validada en cada operación, con las relaciones reales del esquema:

```
ruta  → aula (classroomId) → institución
paso  → ruta               → institución        (LearningRouteStep tiene institutionId propio)
actividad → aula           → institución        (ClassroomActivity NO tiene institutionId)
evidencia → institución + estudiante            (CompetencyEvidence tiene institutionId propio)
```

## 3. Decisiones que conviene no revertir

| Decisión | Por qué |
|---|---|
| **404, no 403**, ante un recurso ajeno | Un 403 confirma que existe: convertiría la ruta en un detector de rutas de otros colegios |
| **Lista explícita de campos** en `updateRoute` y `updateStep` | El cuerpo llegaba como `any`; con `institutionId`/`classroomId` se mudaba el registro de colegio |
| **La actividad que se enlaza debe vivir en el aula de la ruta** | Sin eso, la evidencia de una actividad ajena entraba en esta ruta |
| **Generar con Valeria ANTES de escribir** | Si la IA falla, la lección anterior sigue en pie; y un id ajeno no gasta IA |
| **Reordenar exige que TODOS los pasos sean de esa ruta** | Antes, un id de otra ruta se colaba en el orden |
| **Matrícula del progreso: ACTIVE + institución + año y grupo del aula** | Autorizado por Astra. No se elige «la última creada»; sin matrícula compatible 404 y ante dos identidades 409 |

## 4. Qué se probó, y cómo

- **88 pruebas nuevas**: 48 de servicio A/B (`learning-route.isolation.spec.ts`) y 40 del
  laboratorio HTTP (`learning-route.http-isolation.spec.ts`), ambas direcciones (A→B y B→A).
- El doble de Prisma (`test/fixtures/learning-route.fixture.ts`) **aplica los filtros de verdad**,
  incluidos los de relación (`classroom: { institutionId }`) y `not`. Sin eso una prueba de
  aislamiento pasaría aunque la guarda no existiera.
- Se afirma sobre **lo que NO ocurrió**: ni lectura de colecciones, ni escrituras, ni llamadas de
  generación ante un identificador ajeno.
- **Laboratorio HTTP**: Nest, JWT firmado en la prueba, `RolesGuard` real, controlador y servicios
  reales; solo se sustituyen la persistencia y Valeria. Dos colegios sintéticos, sin datos ni
  cuentas reales y sin llamar a ningún proveedor de IA.
- **Comprobado por mutación:** quitar la institución de `getRoute` rompe **14** pruebas; quitar la
  comprobación de `reorderSteps`, **2**; volver a volcar el cuerpo entero en `updateRoute`, **1**.

> **Lo que estas pruebas NO demuestran:** el aislamiento de PostgreSQL. Todo se ejerce contra un
> doble en memoria; RLS es el programa aparte de Kimi. Aquí se demuestra la guarda de la aplicación.

### Revisión de integración de Astra

La integración añadió cuatro pruebas de servicio (52 de servicio, 40 HTTP): uso obligatorio del
cliente `tx`, rollback ante fallo intermedio y rechazo de ruta/paso con instituciones
denormalizadas contradictorias. También corrigió las cuatro operaciones compuestas para que usen
el cliente transaccional real. Total focal con contrato: 105 pruebas.

## 5. Cambios de comportamiento (declarados)

| Antes | Ahora |
|---|---|
| `myProgress` sin matrícula lanzaba `Error` genérico → **500** | **404**, igual que un recurso ajeno |
| `myProgress` elegía la matrícula por `createdAt desc` | ACTIVE, de la institución y del año/grupo del aula de la ruta |
| Dos identidades de estudiante bajo el mismo usuario: elegía una | **409**, documentado y probado |
| `updateRoute` aceptaba cualquier campo del cuerpo | Lista explícita; lo demás se ignora |
| `reorderSteps` con ids ajenos o de otra ruta: reordenaba | **404**, sin escribir |

## 6. Qué NO cubre

- **Autorización dentro del mismo colegio (Bloque 4).** Las 16 rutas siguen abiertas a cualquier
  `DOCENTE`/`COORDINADOR` **de esa institución**: un docente puede ver y editar rutas del aula de
  otro docente del mismo colegio. Inventariado, sin política nueva inventada, como pide el encargo.
  Los huecos concretos: `byClassroom`, `getOne`, `create`, `fromPlan`, `update`, `remove`, los
  cuatro de pasos, `reorder` y `generateStepLesson` no comprueban la asignación docente del aula.
- **Cuota de IA por institución.** `generate` y `generateStepLesson` consumen proveedor; ya no se
  pueden gastar con un id ajeno, pero no hay límite por colegio.
- **RLS en base de datos** para `LearningRoute`, `LearningRouteStep` y `CompetencyEvidence`: fuera
  de este encargo (no se tocan esquema ni migraciones).
- **La web.** No se modificó `apps/web`: el cliente nunca enviaba institución ni estudiante en el
  cuerpo (verificado en `lib/api/index.ts`), así que el endurecimiento no le cambia nada.
- **`Competency` como catálogo global** es una constatación del esquema actual: si algún día una
  institución define sus propias competencias, esta clasificación debe revisarse.
