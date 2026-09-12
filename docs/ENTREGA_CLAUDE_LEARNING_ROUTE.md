# Entrega a Astra — aislamiento de `learning-route`

Fecha: 2026-09-11 · Autor: Claude · Encargo: [`ENCARGO_CLAUDE_BLINDAJE_LEARNING_ROUTE.md`](ENCARGO_CLAUDE_BLINDAJE_LEARNING_ROUTE.md)
Auditoría completa: [`AUDITORIA_AISLAMIENTO_LEARNING_ROUTE.md`](AUDITORIA_AISLAMIENTO_LEARNING_ROUTE.md)

> **Entrega COMPLETA**, no parcial: las 16 rutas quedan clasificadas y resueltas o justificadas.
> **Sin push a `staging` ni a `main`.** La rama vive en el worktree y espera tu integración.

## 1. Dónde está

| | |
|---|---|
| Rama | `codex/blindaje-learning-route-claude` |
| Base | `origin/staging` `38614231` (el commit donde autorizaste el contrato y la política de matrícula) |
| Worktree | `C:/Users/LUIS C/edusyn-wt-learning-route` (máquina DESKTOP-PF4DF8Q, la misma de tu checkout) |
| Rama publicada | No. Es local; si la quieres en el remoto, dilo y la publico sin tocar `staging` |

## 2. Commits, en orden

| Hash | Qué | Archivos |
|---|---|---|
| `555bf5f1` | **El trabajo.** Institución del actor en las 14 rutas institucionales, guardas de cadena, listas explícitas de campos, borrados acotados, política de matrícula, y las 88 pruebas nuevas | `learning-route.controller.ts`, `learning-route.service.ts`, `competency-evidence.service.ts`, `learning-route.isolation.spec.ts` (nuevo), `learning-route.http-isolation.spec.ts` (nuevo), `test/fixtures/learning-route.fixture.ts` (nuevo) |
| `56932eab` | **Commit AISLADO del contrato estructural** (el que puedes descartar o rebasar por separado) | solo `institution-route-exceptions.json` |
| `72a8ac06` | Tipado del doble de Valeria en una aserción de la prueba | `learning-route.isolation.spec.ts` |
| _(este documento)_ | Auditoría y entrega | `docs/AUDITORIA_AISLAMIENTO_LEARNING_ROUTE.md`, `docs/ENTREGA_CLAUDE_LEARNING_ROUTE.md` |

`learning-route.module.ts` **no** se tocó. No hay cambios en esquema, migraciones, RLS, APIs de IA
compartidas, `templates*`, Matrículas, APD, Classroom, R1, EduLab ni `apps/web`.

## 3. Contrato estructural: las claves exactas (commit `56932eab`)

**Retiradas, por resolución directa** (14). Todas pasaron a resolver con `requireInstitutionId` del
actor, así que el contrato las marcaba «Remove obsolete exception»:

```
modules/learning-route/learning-route.controller.ts#LearningRouteController.byClassroom @Get('classroom/:classroomId')
modules/learning-route/learning-route.controller.ts#LearningRouteController.getOne @Get(':routeId')
modules/learning-route/learning-route.controller.ts#LearningRouteController.myProgress @Get(':routeId/progress')
modules/learning-route/learning-route.controller.ts#LearningRouteController.create @Post()
modules/learning-route/learning-route.controller.ts#LearningRouteController.fromPlan @Post('from-plan')
modules/learning-route/learning-route.controller.ts#LearningRouteController.update @Put(':routeId')
modules/learning-route/learning-route.controller.ts#LearningRouteController.remove @Delete(':routeId')
modules/learning-route/learning-route.controller.ts#LearningRouteController.addStep @Post(':routeId/steps')
modules/learning-route/learning-route.controller.ts#LearningRouteController.addStepWithNewActivity @Post(':routeId/steps/new-activity')
modules/learning-route/learning-route.controller.ts#LearningRouteController.reorder @Put(':routeId/steps/reorder')
modules/learning-route/learning-route.controller.ts#LearningRouteController.generateStepLesson @Post('steps/:stepId/generate-lesson')
modules/learning-route/learning-route.controller.ts#LearningRouteController.updateStep @Put('steps/:stepId')
modules/learning-route/learning-route.controller.ts#LearningRouteController.createStepActivity @Post('steps/:stepId/activity')
modules/learning-route/learning-route.controller.ts#LearningRouteController.removeStep @Delete('steps/:stepId')
```

**Reclasificadas** de `pending-audit` a `non-institutional`, con evidencia y huella recalculada por
el propio inventario del contrato (2):

| Clave | Motivo |
|---|---|
| `…#LearningRouteController.competencies @Get('competencies')` | `Competency` **no tiene `institutionId`** en `schema.prisma`: catálogo CEFR global, no hay dato institucional que acotar |
| `…#LearningRouteController.generate @Post('generate')` | Devuelve un borrador de Valeria **sin persistir**: cero operaciones Prisma en el camino |

No se regeneró la lista: 839 → 825 entradas, y **ninguna clave de otro módulo cambia**
(`git show --stat 56932eab`). El contrato estructural queda **en verde**.

## 4. Verificación ejecutada

| | Resultado |
|---|---|
| `npx tsc --noEmit` (API) | limpio |
| `npx tsc --noEmit` (web) | limpio |
| Suite API completa | **92 suites · 1 614 pruebas**, todas en verde (incluye el contrato estructural) |
| Suite web completa | **22 archivos · 214 pruebas**, en verde (no se tocó `apps/web`) |
| `nest build` | correcto |
| Pruebas nuevas | **88** — 48 de servicio A/B (ambas direcciones) + 40 del laboratorio HTTP |

**No hubo fallos previos que distinguir:** la suite estaba en verde antes y después. Nada se
debilitó ni se silenció: el contrato pasa porque las rutas resuelven de verdad, no porque se
quitaran aserciones.

**Comprobado por mutación** (y restaurado): quitar el filtro de institución en `getRoute` rompe 14
pruebas; quitar la comprobación de pertenencia de `reorderSteps`, 2; volver a volcar el cuerpo
entero en `updateRoute`, 1.

**Advertencia honesta:** todo se ejerce contra un doble en memoria que aplica los filtros. Esto
demuestra la guarda de la aplicación, **no** el aislamiento de PostgreSQL ni RLS.

## 5. Filas propuestas para los documentos compartidos

No edité `ESTADO_BLINDAJE.md` ni `REGISTRO_DESPLIEGUES.md`, como pediste. Propuestas:

**Estado del módulo** (`ESTADO_BLINDAJE.md`):

```
| learning-route | 16/16 | Cerrado | 14 institucionales con `requireInstitutionId` del actor y cadena
ruta→aula→institución validada; 2 no institucionales con evidencia (catálogo CEFR global y
generación sin persistencia). 88 pruebas A/B y HTTP, verificadas por mutación. Bloque 4 (asignación
docente dentro del colegio) inventariado, sin cerrar. Ver AUDITORIA_AISLAMIENTO_LEARNING_ROUTE.md |
```

**Registro de publicación** (`REGISTRO_DESPLIEGUES.md`), cuando lo subas:

```
| <fecha> | `staging` | `<hash de integración>` | **No** | **Aislamiento de Rutas de aprendizaje.**
Catorce de las dieciséis rutas pasaban el id del cliente directo a una consulta por id: se leía,
editaba, borraba y reordenaba una ruta de otro colegio, y se creaban actividades y lecciones dentro
de su aula. Ahora la institución la pone el actor, con la cadena ruta→aula→institución validada;
cuerpos con lista explícita de campos; borrados acotados; la evidencia de competencias se filtra por
institución. `myProgress` exige matrícula ACTIVE del año y grupo del aula (404 sin matrícula
compatible —antes 500— y 409 ante dos identidades). Cero migraciones y cero cambios de esquema.
Contrato estructural: 14 excepciones retiradas y 2 reclasificadas. 92 suites / 1 614 pruebas API,
`tsc` limpio en API y web, `nest build` correcto. |
```

## 6. Lo que queda fuera (resumen; detalle en la auditoría §6)

- **Bloque 4**: dentro del mismo colegio, cualquier DOCENTE/COORDINADOR puede ver y editar rutas de
  otro docente. Inventariado ruta por ruta, sin inventar política.
- **Cuota de IA por institución** en `generate` y `generateStepLesson`.
- **RLS** para `LearningRoute`, `LearningRouteStep` y `CompetencyEvidence` (programa de Kimi).
- **`Competency` global**: si algún día una institución define competencias propias, hay que
  revisar esa clasificación y las dos excepciones `non-institutional`.

## 7. Notas para integrar

- `recordFromActivity` **conserva su firma**: `classroom.service.ts` y `lesson.service.ts`, sus
  únicos llamadores externos, ya pasaban `institutionId`. **No hace falta ningún parche externo.**
- `getMastery` y `getRouteProgress` **sí** cambiaron de firma (ahora reciben `institutionId`
  primero). Sus únicos llamadores están dentro del módulo.
- Si prefieres integrar sin el contrato, descarta `56932eab`: el resto compila y pasa igual, pero
  el contrato estructural fallará señalando las 14 excepciones obsoletas.
- La rama está rebasable sobre el `staging` que tengas al integrar; no hay merges ni reescrituras.

---

## 8. Estado al cierre de la sesión (2026-09-11)

**Learning-route: entregado y cerrado.** Último commit de la rama, con todo verificado; árbol limpio;
**sin publicar en el remoto** y sin push a `staging` ni `main`. Comprobado además que la rama
**rebasa limpia** sobre `origin/staging` `e229b21e` (el staging ya avanzó con el trabajo de
plantillas de Astra); la comprobación se hizo en una rama desechable que se borró.

**Decisión pendiente del fundador:** publicar o no esta rama en el remoto. Solo hace falta si Astra
integra desde otra máquina o desde la nube; en este equipo puede integrarla desde el worktree.

**Siguiente frente (Attendance): bloqueado por secuencia.** El encargo
`ENCARGO_CLAUDE_BLINDAJE_ATTENDANCE.md` existe ya —redactado y completo— pero sigue **sin confirmar**
en el worktree de Astra, y pide crear el worktree «desde el `origin/staging` que ya contenga la
entrega de learning-route **integrada por Astra**». Hasta esa integración no se abre ese frente.
Contrastado contra el código: 17 rutas (10 + 7), 16 excepciones declaradas, y hoy solo el
controlador principal resuelve institución (en 2 sitios). Los documentos previos que exige leer
están en staging.

**Inclusión (APD):** Astra la dejó **parcial y pospuesta**, con el pendiente enumerado en
`AUDITORIA_AISLAMIENTO_INCLUSION.md` (participantes y firmas, materias del plan, documentos y
adjuntos, categorías, reportes y agregaciones, índice/estadísticas, alertas, cruce académico,
listados de perfiles, escritura de configuración y la excepción de `POST ai/valeria`), más la API
compartida `pedagogical-support` y la función heredada `syncProfileFromDiagnosis`, que activa
perfiles sin consentimiento. Hoy Astra no tiene archivos de APD modificados, así que el frente está
libre; **retomarlo cambiaría el orden que ella fijó** (Inclusión pospuesta, Attendance siguiente),
así que requiere su visto bueno o el del fundador.
