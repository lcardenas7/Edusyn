# Auditoría de aislamiento multiinstitución — módulo de Recuperaciones

Fecha: 2026-09-09 · Módulo completo: `apps/api/src/modules/recovery/`

> ## Resultado
>
> **21 de 33 rutas** del módulo recibían un identificador del cliente y operaban **sin resolver ni
> comprobar la institución**. Nueve de ellas **escriben**. Todas quedan acotadas al tenant
> autenticado, con 30 pruebas de rechazo cruzado A/B.

---

## 1. El defecto, y por qué nadie lo vio

Se repetía en los cuatro servicios:

```ts
const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: data.studentEnrollmentId } })
// …
institutionId: enr.institutionId,   // ← la del ESTUDIANTE, no la del actor
```

**La institución se deducía del recurso que nombraba el cliente**, no del actor. La fila creada
quedaba **coherente** —llevaba la institución correcta del estudiante—, así que:

> Ninguna auditoría de datos podía detectarlo. Había que leer el código.

Es la misma clase de defecto que ya se corrigió en Aprendizajes (A-1) y que allí se documentó como
«un `institutionId` correcto en la fila NO demuestra aislamiento si se derivó de un FK que eligió
el cliente».

## 2. Inventario, antes y después

| Controlador | Rutas | Sin contexto (antes) | Ahora |
|---|---|---|---|
| `period-recovery` | 14 | 9 | **0** |
| `final-recovery` | 8 | 4 | **0** |
| `academic-acts` | 6 | 5 | **0** |
| `recovery-config` | 5 | 4 | **0** |
| **Total** | **33** | **21** | **0** |

### Las que escribían sin comprobar nada

| Ruta | Qué permitía |
|---|---|
| `POST /period-recovery` | Abrir una recuperación a un estudiante de otra institución |
| `PATCH /period-recovery/:id/activity` | Modificar su actividad de refuerzo |
| `PATCH /period-recovery/:id/result` | Registrar su resultado **aplicándole las reglas de la propia institución** |
| `PATCH /period-recovery/:id/review` | Aprobar o rechazar su recuperación |
| `POST /period-recovery/close-window` | Cerrar la ventana de recuperación de un período ajeno |
| `POST /period-recovery/create-snapshot` | **Regenerar los boletines** de un período ajeno |
| `POST /period-recovery/finalize` | Finalizar el proceso de un período ajeno |
| `PATCH /final-recovery/:id/plan` | Reescribir un plan de refuerzo **sin cargar siquiera el registro** |
| `PATCH /academic-acts/:id/approve` | Aprobar un acta académica ajena |
| `POST /recovery-config/rules` · `DELETE /rules/:id` | Cambiarle a otra institución **la nota máxima que puede sacar un estudiante recuperando** |

### La trampa: dos que *parecían* protegidas

`registerResult` y `reviewResult` **recibían `institutionId`**, así que a primera vista estaban
bien. Pero solo lo usaban para elegir las **reglas**; la recuperación se cargaba con
`findUnique({ where: { id } })`, sin acotar.

## 3. Qué se hizo

**Una guarda por servicio, no una comprobación suelta por método.** Cada servicio expone
`assertTermScope` / `assertEnrollmentScope` / `assertConfigScope` / `loadRecoveryInScope`, y todos
los métodos entran por ahí.

Reglas aplicadas:

1. **La institución la pone el actor.** El controlador la resuelve con `requireInstitutionId`; el
   cuerpo de la petición ya no decide nada. Donde el cuerpo traía `institutionId`, se ignora y se
   escribe la del actor.
2. **Toda consulta lleva la institución en el `where`**, no solo la guarda previa. Una guarda que
   pasa y luego consulta sin filtro deja la puerta abierta a otra ruta.
3. **`NotFoundException`, nunca `Forbidden`.** Un 403 confirmaría que el recurso existe. Un recurso
   ajeno debe ser **indistinguible de uno inexistente**.
4. **Borrado acotado.** `deleteMany({ where: { id, institutionId } })` en vez de `delete({ id })`:
   si es ajeno no borra nada, y se responde como si no existiera.
5. **Ningún parámetro de institución opcional.** Una guarda que se puede omitir acaba omitiéndose.

## 4. Pruebas

**30 pruebas de rechazo cruzado A/B**, en dos archivos:

- `period-recovery.isolation.spec.ts` — 17
- `recovery-module.isolation.spec.ts` — 13

Están escritas al revés de lo habitual: **no comprueban que el caso legítimo funcione, sino que el
cruzado sea rechazado antes de leer o escribir nada.**

```
findByTerm: el período de B no existe para un actor de A
  → y `findMany` NO llegó a ejecutarse

closeRecoveryWindow no cierra la ventana de otra institución
  → y `recoveryPeriodConfig.findUnique` NO llegó a ejecutarse
```

El doble de Prisma **filtra de verdad** por institución: si alguien quitara una guarda, la prueba
falla en vez de pasar.

## 5. Verificación

| | Resultado |
|---|---|
| Pruebas API | **82 suites · 1 217 pruebas** |
| Pruebas web | 19 archivos · 203 pruebas |
| `tsc --noEmit` API y web | limpio |
| `nest build` | correcto |
| Re-auditoría de las 33 rutas | **0 sin contexto** |
| Migraciones | **ninguna** |
| Datos reales | **no se creó, editó ni borró nada** |

## 6. Lo que esta auditoría NO cubre

Hay que decirlo con precisión, porque es la diferencia entre «probado» y «demostrado»:

- **No hay reproducción HTTP cruzada real.** Las 30 pruebas son unitarias sobre los servicios.
  Prueban la guarda, no la ruta completa con sesión, `RolesGuard` e interceptor de tenant. Para eso
  hace falta el laboratorio con dos instituciones sintéticas.
- **No se validó la autorización por asignación docente.** Que un docente solo pueda tocar las
  recuperaciones de **sus** grupos es una pregunta distinta del aislamiento entre instituciones, y
  sigue abierta.
- **Grupo, período y año lectivo** se validan donde ya existía validación (`assertTermScope` cubre
  año vía `academicYear.institutionId`), pero **no se auditó la coherencia entre sí** — por ejemplo,
  que la matrícula pertenezca al año del período.
- **RLS no interviene.** Esto es aislamiento en la capa de aplicación. La deuda
  `RLS_REPRODUCIBILITY_DEBT` sigue abierta y es de otra línea de trabajo.

## 7. Riesgo residual

El aislamiento depende de que **cada método nuevo** entre por su guarda. No hay nada estructural
que lo imponga: un método futuro que consulte `periodRecovery` sin `institutionId` reabriría el
hueco sin que ninguna prueba existente lo note.

**Mitigación posible, no implementada:** una prueba que recorra los controladores del módulo y
falle si aparece una ruta sin `requireInstitutionId` — la misma auditoría automática que se hizo a
mano aquí. Es pequeña y valdría la pena.
