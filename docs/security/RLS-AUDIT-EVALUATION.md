# Auditoría de aislamiento multi-tenant — módulo `evaluation`

> **Fase:** solo lectura. Ningún archivo de `apps/api/src/modules/evaluation/` fue modificado.
> **Baseline:** commit `6214974`, suite 658/658 en verde, typecheck limpio.
> **Alcance:** 11 controladores, 12 servicios, 5 671 líneas. El módulo más grande auditado hasta ahora.

---

## 0. Advertencia previa sobre el método

Esta auditoría **no parte de `periodFinalGrade.delete`**. Ese hallazgo previo se trató como una
muestra, no como el objetivo. La conclusión es que era, en efecto, un caso particular de un
patrón mucho más amplio: **29 escrituras sin ninguna referencia a institución**, de las cuales
`DELETE /period-final-grades/:id` es solamente una, y ni siquiera la más grave.

### 0.1 Defecto detectado en mi propia herramienta de mapeo

El primer mapeador que escribí atribuía la presencia de `requireInstitutionId` mirando una
ventana de ±6 líneas alrededor del decorador de ruta. Eso produjo **falsos positivos**: métodos
sin resolver quedaban marcados como resueltos porque el método *vecino* sí lo tenía.
`DELETE /partial-grades/:id` y `DELETE /partial-grades/activity` aparecían como protegidos y
**no lo están**.

Se rehízo la atribución acotando estrictamente al cuerpo de cada método. Cifras corregidas:

| Métrica | Primera medición (errónea) | **Verificada** |
|---|---|---|
| Endpoints totales | 66 | **66** |
| Resuelven institución | 20 | **15** |
| Sin ninguna referencia a tenant | 46 | **51** |
| — de ellas, escrituras | 24 | **29** |

Se documenta el error porque la cifra errónea habría subestimado la superficie en un 20 %.

---

## 1. Fundamento estructural: el esquema

Antes de clasificar endpoints hay que establecer cuál es el camino al tenant de cada entidad,
porque **no todas lo tienen**.

| Entidad | Ruta al tenant |
|---|---|
| `PartialGrade` | `institutionId` directo |
| `PeriodFinalGrade` | `institutionId` directo |
| `StudentGrade` | `institutionId` directo |
| `FinalComponentGrade` | `institutionId` directo |
| `EvaluationComponent` | `institutionId` directo |
| `EvaluativeActivity` | `institutionId` directo |
| `PreventiveAlert` | `institutionId` directo |
| `PerformanceScale` | `institutionId` directo |
| `FinalComponent` / `FinalComponentScope` | `institutionId` directo |
| **`AcademicTerm`** | **sin columna** → `academicYear.institutionId` (1 salto) |
| **`EvaluationPlan`** | **sin columna** → `academicTerm.academicYear.institutionId` (2 saltos) |
| **`EvaluationPlanComponentWeight`** | **sin columna** → 3 saltos |

`AcademicTerm` es el pivote de todo el módulo — 18 entidades cuelgan de él — y **no tiene
`institutionId`**. Cualquier política RLS sobre el núcleo académico tendrá que resolverse por
relación indirecta, no por columna. Esto es una restricción de diseño para la fase RLS, no un
defecto a corregir aquí.

### 1.1 Radio de explosión de `AcademicTerm`

18 relaciones hijas declaran `onDelete: Cascade` hacia `AcademicTerm`:

```
TermReportCardSnapshot   TermReopeningRecord      GradingPeriodConfig
RecoveryPeriodConfig     EvaluativeActivity       EvaluationPlan
PeriodFinalGrade         PartialGrade             PreventiveCutConfig
PreventiveAlert          PeriodRecovery           SubjectPerformance
PerformanceManualEdit    Achievement              AttitudinalAchievement
StudentEvidenceValuation ConvivenciaEntry         StudentAchievement
```

Borrar un `AcademicTerm` borra el período académico completo: notas parciales, notas finales,
**boletines ya congelados**, recuperaciones, valoraciones de evidencias y actas de reapertura.

**Ampliación (fase de diseño E-1):** la verificación relación por relación encontró además
2 excepciones no detectadas en esta primera pasada — `ClassroomSection` y `ClassroomActivity`
(`onDelete: SetNull`) y, sobre todo, **`PedagogicalSupportPlan`, que declara la relación sin
`onDelete` y por tanto es `Restrict`**: un período con planes de apoyo no se puede borrar.
Radio real = **18 Cascade + 2 SetNull + 1 Restrict**. Detalle en
`DISENO-CIERRE-E1-ACADEMIC-TERMS.md` §3.

---

## 2. Matriz de endpoints

15 de 66 resuelven institución. Los 51 restantes no la mencionan en absoluto.

### 2.1 Las 29 escrituras sin tenant

| Endpoint | Roles | Efecto |
|---|---|---|
| `POST /academic-terms/sync` | SUPERADMIN, ADMIN, COORDINADOR | crea/actualiza/**borra** períodos |
| `POST /academic-terms` | SUPERADMIN, ADMIN, COORDINADOR | crea período |
| `PATCH /academic-terms/:id` | SUPERADMIN, ADMIN, COORDINADOR | modifica período |
| **`DELETE /academic-terms/:id`** | SUPERADMIN, ADMIN | **cascada de 18 entidades** |
| `PATCH /academic-terms/:id/toggle-bulletins` | SUPERADMIN, ADMIN | libera boletines |
| `POST /evaluation-components` | SUPERADMIN, ADMIN, COORDINADOR | `dto.institutionId` crudo |
| `PATCH /evaluation-components/:id` | SUPERADMIN, ADMIN, COORDINADOR | IDOR |
| `DELETE /evaluation-components/:id` | SUPERADMIN, ADMIN | IDOR destructivo |
| `POST /evaluation-plans/upsert` | + DOCENTE | `deleteMany` de pesos |
| `POST /evaluative-activities` | + DOCENTE | tenant derivado del FK |
| `POST /final-component-grades/upsert` | + DOCENTE | tenant derivado del FK |
| `POST /final-component-grades/bulk-upsert` | + DOCENTE | 3 IDs sin cotejar |
| `DELETE /final-component-grades/:id` | + DOCENTE | IDOR destructivo |
| `PUT /final-components/:id/toggle-open` | SUPERADMIN, ADMIN, COORDINADOR | IDOR |
| `PUT /final-components/:id` | SUPERADMIN, ADMIN, COORDINADOR | IDOR |
| `DELETE /final-components/:id` | SUPERADMIN, ADMIN, COORDINADOR | IDOR destructivo |
| `POST /partial-grades` | + DOCENTE | **escribe notas** |
| `POST /partial-grades/bulk` | + DOCENTE | **escribe notas en lote** |
| `DELETE /partial-grades/:id` | + DOCENTE | borra nota |
| **`DELETE /partial-grades/activity`** | + DOCENTE | **borrado masivo por query** |
| `POST /performance-scale/upsert` | SUPERADMIN, ADMIN, COORDINADOR | `dto.institutionId` crudo |
| `POST /period-final-grades` | + DOCENTE | escribe nota final |
| `POST /period-final-grades/bulk` | + DOCENTE | escribe notas finales |
| `DELETE /period-final-grades/:id` | + DOCENTE | *(el hallazgo ya conocido)* |
| `POST /preventive-cuts/config` | SUPERADMIN, ADMIN, COORDINADOR | config de corte |
| `POST /preventive-cuts/execute` | + DOCENTE | genera alertas en masa |
| `PATCH /preventive-cuts/alerts/:id` | + DOCENTE | IDOR |
| `POST /student-grades` | + DOCENTE | escribe nota |
| `POST /student-grades/bulk` | + DOCENTE | escribe notas en lote |

Todos los controladores aplican `@UseGuards(JwtAuthGuard, RolesGuard)`. El problema no es de
autenticación ni de rol: es que **el rol se comprueba y la institución no**.

### 2.2 Lecturas sin tenant (22)

Destaca por su alcance de roles:

```
GET /partial-grades/by-student?studentEnrollmentId=…
    Roles: SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, DOCENTE, ESTUDIANTE, ACUDIENTE
```

No hay filtro de institución **ni** comprobación de que la matrícula consultada corresponda al
estudiante autenticado. Un acudiente de la institución A que disponga de un
`studentEnrollmentId` de la institución B puede leer sus notas. Lo mismo aplica a
`GET /period-final-grades/by-group`, `by-student` y `GET /student-grades/by-activity`.

---

## 3. Los tres sub-patrones de defecto

### 3.1 Tenant derivado del FK que envía el cliente — **el patrón dominante**

```ts
// partial-grades.service.ts:88,104
const ta = await this.prisma.teacherAssignment.findUnique({
  where: { id: data.teacherAssignmentId },     // ← ID del cliente
  select: { institutionId: true },
});
...
create: { ...createData, institutionId: ta!.institutionId },   // ← tenant del ID del cliente
```

Mismo patrón en `student-grades.service.ts:25` (`enr!.institutionId`),
`final-component-grades.service.ts:101`, `evaluative-activities.service.ts:14`,
`preventive-cuts.service.ts:171,213`.

Este es el caso exacto que la instrucción anticipaba: **`institutionId` presente no es evidencia
de aislamiento**. La fila resultante queda perfectamente coherente — su `institutionId` es el
correcto para el `teacherAssignmentId` recibido — y precisamente por eso la anomalía es
invisible en la base de datos. Lo que nunca se comprueba es que **el actor pertenezca a esa
institución**. Un docente de A que envíe un `teacherAssignmentId` de B escribe una nota válida y
bien etiquetada dentro de B.

Es el mismo defecto que se cerró en `observer` (`createCommitment` y hermanos), aquí replicado
sobre el núcleo de calificaciones.

### 3.2 `institutionId` directamente del cuerpo (D-entrada clásico)

`performance-scale.service.ts:14,27` y `evaluation-components.service.ts:264` escriben
`dto.institutionId` sin que el controlador invoque resolver alguno. Es la forma más simple y
directa: el cliente declara en qué institución escribe.

Contraste útil: `final-components.controller.ts` **sí** llama `resolveInstitutionId` en sus 5
rutas de escritura de configuración y pasa el valor resuelto al servicio. El patrón correcto ya
existe dentro del propio módulo; simplemente no se aplicó de forma uniforme.

### 3.3 Múltiples identificadores sin cotejo entre sí

`POST /final-component-grades/bulk-upsert` acepta por cada fila `studentEnrollmentId`,
`teacherAssignmentId` y `finalComponentId`. Ninguno se coteja contra los otros: nada impide
combinar una matrícula de A con una asignación de B.

`POST /preventive-cuts/execute` recibe `teacherAssignmentId` y `academicTermId` y **no verifica
que el período pertenezca al año lectivo de la asignación**; después enumera las matrículas del
grupo y escribe alertas.

---

## 4. Operaciones destructivas (16)

| Ubicación | Operación | Acotada por |
|---|---|---|
| `academic-terms.service.ts:80` | `academicTerm.delete` | **nada** |
| `academic-terms.service.ts:145` | `academicTerm.delete` en bucle | `order > maxOrder` |
| `evaluation-components.service.ts:293` | `evaluationComponent.delete` | **nada** |
| `evaluation-plans.service.ts:60` | `…ComponentWeight.deleteMany` | `evaluationPlanId` |
| `final-component-grades.service.ts:134` | `deleteMany` | 3 IDs del cliente |
| `final-component-grades.service.ts:147` | `delete` | **nada** |
| `final-components.service.ts:220,245,305` | `delete` / `deleteMany` | parcialmente |
| `partial-grades.service.ts:214,231,285` | `deleteMany` / `updateMany` | recálculo interno |
| `partial-grades.service.ts:377` | `periodFinalGrade.deleteMany` | recálculo interno |
| `partial-grades.service.ts:603` | `partialGrade.delete` | **nada** |
| `partial-grades.service.ts:731` | `partialGrade.deleteMany` | query del cliente |
| `period-final-grades.service.ts:113` | `periodFinalGrade.delete` | **nada** |

Las de `partial-grades.service.ts:214–377` son **recálculos internos legítimos**: su ámbito
(`studentEnrollmentId`, `teacherAssignmentId`, `academicTermId`) se deriva de la nota que se está
editando. Si el punto de entrada queda acotado, quedan acotadas por construcción. **No deben
tocarse**: son las reglas de evaluación, no el tenant.

### 4.1 Salvaguarda funcional inerte en `syncPeriods`

```ts
// academic-terms.service.ts:145
try {
  await this.prisma.academicTerm.delete({ where: { id: t.id } });
} catch (e) {
  // Si tiene dependencias, no eliminar
}
```

El comentario declara la intención: no borrar períodos que tengan datos colgando. Pero las 18
relaciones hijas son `onDelete: Cascade` — **la operación no lanza error de clave foránea, borra
en cascada**. El `catch` nunca se ejecuta para esos casos y la salvaguarda no protege nada.

Esto es **integridad académica, no aislamiento multi-tenant**. Se reporta aquí porque se
encontró en el mismo recorrido, y se deja explícitamente fuera del alcance de la corrección de
tenant.

---

## 5. Rutas alternativas fuera de `evaluation` (20)

Escrituras a entidades de `evaluation` desde otros módulos:

| Archivo | Línea | Operación |
|---|---|---|
| `academic/academic-year-lifecycle.service.ts` | 142 | `academicTerm.createMany` |
| `academic/enrollment.service.ts` | 711 | `partialGrade.updateMany` |
| `classroom/attitudinal.service.ts` | 627 | `partialGrade.upsert` |
| `classroom/classroom.service.ts` | 3101 | `partialGrade.upsert` |
| `iam/grades-bulk-import.service.ts` | 995, 1047 | `partialGrade` + `periodFinalGrade.upsert` |
| `institution-config/institution-config.service.ts` | 380, 484, 495, **517** | `performanceScale.upsert`, `academicTerm` update/create/**delete** |
| `recovery/period-recovery.service.ts` | 500, 573 | `periodFinalGrade.updateMany` |
| `recovery/recovery-snapshot.service.ts` | 276, 355 | `academicTerm.update` |
| `reports/reports.service.ts` | 4075, 4226, 4283, 4355, 4444 | `academicTerm.update` |

**Ninguno se modifica en esta fase.** Se trazan y se reportan, siguiendo el mismo procedimiento
aplicado con `reports` en la auditoría de `students`. Dos merecen atención prioritaria:

- ~~`institution-config.service.ts:517` — segunda vía de `academicTerm.delete`, con el mismo
  radio de cascada. Cerrar solo la de `evaluation` dejaría la puerta abierta.~~
  **CORREGIDO (fase de diseño E-1):** esta afirmación era errónea. La traza completa
  (`PUT /institution-config/periods` → `getInstitutionId(req.user.id)` → `updatePeriods` →
  `syncPeriodsToAcademicTerms`) demuestra que el `institutionId` proviene **del actor**, nunca
  del cliente, y que el año se resuelve con `where: { institutionId, status }`. La ruta **ya
  está acotada por derivación** y no requiere cambios. Ver
  `DISENO-CIERRE-E1-ACADEMIC-TERMS.md` §2.
- `grades-bulk-import.service.ts:995,1047` — importación masiva de notas; es la vía de mayor
  volumen de escritura sobre el núcleo académico.

---

## 6. Clasificación de hallazgos

### Confirmados (ruta HTTP alcanzable, sin control de tenant, con efecto verificado en código)

- **E-1** `DELETE /academic-terms/:id` — cascada sobre 18 entidades, incluidos boletines
  congelados. El de mayor severidad del módulo.
- **E-2** Escritura de notas con tenant derivado del FK del cliente — `partial-grades`,
  `student-grades`, `final-component-grades`, `evaluative-activities`.
- **E-3** `DELETE /partial-grades/activity` — borrado masivo por parámetros de query.
- **E-4** `DELETE /period-final-grades/:id` — el hallazgo previo; confirmado como caso
  particular de E-2/E-3.
- **E-5** `dto.institutionId` sin resolver en `performance-scale` y `evaluation-components`.
- **E-6** Lecturas IDOR de notas con `ESTUDIANTE` y `ACUDIENTE` entre los roles admitidos.

> Nota de rigor: «confirmado» significa que la ruta existe, es alcanzable con un rol legítimo y
> la consulta carece de filtro de tenant. **No se ha ejecutado ninguna explotación** contra
> ningún entorno.

### Candidatos (requieren traza adicional antes de afirmar explotabilidad)

- **C-1** `POST /preventive-cuts/execute` — falta cotejo `academicTermId` ↔ año de la asignación.
- **C-2** `POST /final-component-grades/bulk-upsert` — 3 identificadores sin cotejo mutuo.
- **C-3** Las 20 rutas alternativas de la §5, pendientes de trazar sus consumidores reales.

### Legítimos (no tocar)

- Recálculos internos de `partial-grades.service.ts:214–377`.
- `guardTermNotFinalized` en `partial-grades.delete` y `period-final-grades.delete`: es una
  salvaguarda de integridad académica que **debe preservarse intacta** al acotar el tenant.
- `GradeAuditService` (`actorFrom`): auditoría forense, no control de acceso. Correcto como está.
- Las 5 rutas de escritura de `final-components` que ya usan `resolveInstitutionId`.

### Deuda de diseño (fase RLS, no ahora)

- **D-1** `AcademicTerm`, `EvaluationPlan` y `EvaluationPlanComponentWeight` sin `institutionId`.
  Políticas RLS por relación indirecta. **No improvisar migración.**
- **D-2** Salvaguarda inerte de `syncPeriods` (§4.1) — integridad académica.
- **D-3** Aserciones no-nulas `ta!` / `enr!`: con un ID inexistente producen `TypeError` → 500 en
  lugar de 404. Robustez, no aislamiento.

---

## 7. Separación explícita de los tres ejes

La instrucción de auditoría pedía no confundir planos. Se separan:

| Eje | Qué incluye | Estado |
|---|---|---|
| **Aislamiento multi-tenant** | E-1 … E-6, C-1 … C-3 | objeto de la próxima fase |
| **Integridad académica** | D-2 (salvaguarda inerte), cascadas de `AcademicTerm` | **fuera de alcance**; se documenta |
| **Salvaguardas funcionales existentes** | `guardTermNotFinalized`, recálculos, control de concurrencia optimista (`expectedUpdatedAt`), auditoría forense | **preservar sin cambios** |

`evaluation` ya sufrió el incidente de evidencias reemplazadas sin IDs que dejó valoraciones
huérfanas. La lección aplicada aquí: acotar el tenant **no debe alterar ninguna de las reglas de
evaluación ya corregidas**. En particular, el control de concurrencia optimista de
`partial-grades.upsert` y la rama de `deleteMany` por score 0 en `final-component-grades` son
comportamiento intencionado, no defectos.

---

## 8. Recomendación

El módulo necesita el mismo tratamiento aplicado a `observer`: resolver la institución en el
controlador y convertir el servicio en el punto de control, con asertos de pertenencia por
entidad. Pero **`evaluation` no debe cerrarse de una sola vez**: 29 escrituras y 20 rutas
alternativas es demasiada superficie para un solo cambio sobre el núcleo de calificaciones.

Orden sugerido, de mayor a menor riesgo contenido:

1. `academic-terms` (E-1) — junto con `institution-config.service.ts:517`, que es su vía gemela.
   Requiere autorización explícita para tocar `institution-config`.
2. `partial-grades` + `period-final-grades` (E-2, E-3, E-4) — el núcleo de notas.
3. `student-grades`, `final-component-grades`, `evaluative-activities` (E-2, C-2).
4. `evaluation-components`, `performance-scale`, `final-components` (E-5).
5. `preventive-cuts` (C-1).
6. Lecturas IDOR (E-6), en bloque con la auditoría sistemática de lecturas ya prevista.

**Esta fase termina aquí.** No se implementa nada sin autorización explícita del alcance.
