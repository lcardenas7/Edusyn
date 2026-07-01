# LA CONSTITUCIÓN DEL MÓDULO DE NOTAS DE EDUSYN

> **Naturaleza:** Modelo conceptual del dominio académico (no es diseño técnico ni código).
> **Propósito:** Definir las reglas de negocio que el módulo de notas debe garantizar durante 10–20 años de operación, independientemente de la implementación. Es la **fuente normativa** a la que se subordina toda decisión técnica posterior (ETAPA 2 en adelante).
> **Fase:** BLOQUE A · ETAPA 1.5 (Análisis del Dominio). Pendiente de aprobación.
> **Relación:** se apoya en el diagnóstico de la ETAPA 1 (`AUDITORIA_NUCLEO_ACADEMICO.md`, `AUDITORIA_OPERACIONAL_FASE2.md`).
> **Principio rector:** *Una nota es un hecho académico con valor legal. El sistema custodia hechos, no números mutables.*

---

## ÍNDICE
1. Principios fundacionales
2. La fuente de verdad (modelo de 3 capas)
3. Invariantes del dominio (lo que NUNCA puede romperse)
4. Reglas inmutables del negocio
5. Modelo canónico del ciclo de vida de una nota
6. Máquinas de estado (nota, planilla, período, recuperación)
7. Matriz de conflictos del dominio
8. Catálogo de +140 casos extremos
9. Comparación conceptual con plataformas líderes
10. Glosario canónico
11. Decálogo constitucional (resumen ejecutable)

---

# 1. PRINCIPIOS FUNDACIONALES

Estos cinco principios son el "preámbulo" del que se derivan todas las reglas:

- **P1 · La evidencia es sagrada.** Lo que un docente registra (un puntaje en una actividad) es un hecho histórico. Nunca se destruye por un cálculo; a lo sumo se versiona o se corrige dejando rastro.
- **P2 · Las notas derivadas son funciones, no datos.** La nota de período, de área y la anual son el **resultado determinista** de (evidencia + configuración + reglas). No son valores primarios que puedan "quedar viejos".
- **P3 · Una sola verdad por coordenada.** Para una `(matrícula, asignatura, período)` existe **un único valor canónico** que ven boletín, promoción, MEN, acudiente y dashboard. Prohibido que dos vistas muestren números distintos.
- **P4 · Todo cambio es atribuible.** Quién, cuándo, qué valor anterior, qué valor nuevo y por qué. Sin excepción.
- **P5 · El pasado es reproducible.** Un boletín emitido en 2026 debe poder regenerarse idéntico en 2036, aunque la escala, los pesos o el plan hayan cambiado después. La configuración vigente se conserva con el registro publicado.

---

# 2. LA FUENTE DE VERDAD (MODELO DE 3 CAPAS)

El error estructural actual (tres modelos de nota que compiten: `StudentGrade`, `PartialGrade`, `PeriodFinalGrade` con 4 escritores) se resuelve conceptualmente separando **tres capas con responsabilidades distintas**:

```
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 1 — EVIDENCIA (fuente única de verdad de lo registrado)      │
│  "El docente puso 3.8 en el Taller 2 (componente Cognitivo)"      │
│  Atómica · Atribuible · Versionada · Nunca borrada por cálculo    │
│  Tipos de evidencia:                                              │
│   a) Puntaje de actividad   (entrada normal del docente)          │
│   b) Override manual         (coordinación fija la nota, con motivo)│
│   c) Ajuste por recuperación (mejora la nota según regla)          │
│   d) Importación             (evidencia migrada, con lote/origen)  │
└───────────────────────────────┬─────────────────────────────────┘
                                 │  (cálculo determinista, puro)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 2 — DERIVACIÓN (calculada, nunca digitada a mano)            │
│  nota_componente → nota_período → nota_área → nota_anual          │
│  = f(evidencia, pesos, escala, redondeo, estructura, reglas)      │
│  Cacheable por rendimiento, pero SIEMPRE recomputable desde Capa 1│
└───────────────────────────────┬─────────────────────────────────┘
                                 │  (congelado en momentos de verdad)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 3 — PUBLICACIÓN (acta/boletín: registro legal inmutable)     │
│  Snapshot versionado + configuración vigente al momento           │
│  Es el documento con validez jurídica. No se edita: se reemite v+1 │
└─────────────────────────────────────────────────────────────────┘
```

**Consecuencias conceptuales:**
- **La "nota final del período" deja de ser un dato editable a mano por múltiples rutas.** Es una **derivación** (Capa 2). Si alguien necesita fijarla manualmente, eso es una **evidencia de tipo override** (Capa 1b), no una escritura directa al valor derivado.
- **La recuperación** es **evidencia** (Capa 1c) que el cálculo incorpora según la regla de impacto. No se "pega" sobre el valor final, por eso un recálculo posterior **jamás puede borrarla** (resuelve A-3).
- **El override** y la **evidencia normal** coexisten visibles: la nota derivada respeta el override, pero la planilla conserva ambos. Nada se sobrescribe en silencio (resuelve A-1, A-2).
- **Boletín, promoción y MEN consumen la Capa 2** (o la Capa 3 si el período está publicado) — **nunca** dos rutas distintas (resuelve A-4, P3).

> **La fuente de verdad de una nota = la evidencia (Capa 1) + la configuración vigente. Todo lo demás se deriva o se publica.**

---

# 3. INVARIANTES DEL DOMINIO (LO QUE NUNCA PUEDE ROMPERSE)

Una invariante es una condición que debe ser verdadera **antes y después de toda operación**, sin importar el orden, la concurrencia ni los fallos.

| # | Invariante | Justificación |
|---|---|---|
| **INV-1** | Toda nota visible es trazable a su evidencia. No existen números huérfanos. | P1, defensa legal |
| **INV-2** | Todo valor de nota está dentro de la escala institucional vigente `[min, max]`. | Integridad |
| **INV-3** | "Sin nota" (ausencia) es un estado **distinto** de "cero". Nunca se confunden. | Resuelve A-5 |
| **INV-4** | Un recálculo **nunca** destruye evidencia; solo produce/actualiza valores derivados. | P1, P2 |
| **INV-5** | Un registro publicado (Capa 3) es **inmutable**. Toda corrección genera una **nueva versión**; la anterior se conserva. | P5, legal |
| **INV-6** | Un período finalizado no admite nueva evidencia salvo **reapertura formal registrada**. | Control de cierre |
| **INV-7** | **Determinismo:** misma evidencia + misma configuración ⇒ mismo resultado, siempre. | P2 |
| **INV-8** | Todo cambio de nota es atribuible (autor, fecha, antes/después, motivo). | P4 |
| **INV-9** | Una recuperación **no reduce** la nota original y **no puede ser sobrescrita silenciosamente** por un recálculo. | Resuelve A-3 |
| **INV-10** | Para `(matrícula, asignatura, período)` existe **un único valor canónico**, consumido por todos. | P3, resuelve A-4 |
| **INV-11** | La suma de pesos de los componentes de un plan es coherente (100% o normalización explícita y declarada). | Resuelve A-7 |
| **INV-12** | Borrar una entidad estructural (asignatura, asignación, grupo) **no** destruye notas históricas en silencio. | Resuelve A-9, Bloque C |
| **INV-13** | Toda nota pertenece a **exactamente una** coordenada `(matrícula, asignatura, período[, año])`. | Sin ambigüedad |
| **INV-14** | La configuración que afectó a un registro publicado se **conserva con él** (config temporal). | P5, horizonte 10–20 años |
| **INV-15** | El resultado de promoción de un año cerrado es **inmutable**. | Legal |
| **INV-16** | Toda operación compuesta de notas es **atómica**: ocurre completa o no ocurre. | Resuelve A-8 |
| **INV-17** | El redondeo y la política de aproximación son **únicos y configurables por institución**; no hay redondeos hardcoded divergentes. | Resuelve A-7 |
| **INV-18** | Una nota no puede existir para una matrícula inexistente, retirada antes del registro, o fuera del período de vigencia de la matrícula. | Integridad referencial |
| **INV-19** | La estructura cualitativa (preescolar/DIMENSIONS) nunca produce reprobación ni recuperación. | Norma pedagógica |
| **INV-20** | Ninguna lectura puede observar un estado intermedio de un recálculo en curso (aislamiento). | Concurrencia (Bloque D) |

---

# 4. REGLAS INMUTABLES DEL NEGOCIO

Reglas que provienen de la normatividad o de la naturaleza pedagógica y que el producto **no puede contradecir** (configurables en parámetros, pero no en esencia):

- **RN-1 · Aprobación:** una asignatura/área se aprueba si la nota ≥ nota mínima aprobatoria institucional.
- **RN-2 · Recuperación (Decreto 1290):** un estudiante con nota reprobatoria tiene derecho a actividades de recuperación/nivelación; la recuperación **mejora** la nota hasta un máximo configurable (`recoveryMaxScore`), nunca la empeora.
- **RN-3 · Promoción:** se determina por nota mínima + máximo de áreas/asignaturas reprobadas + asistencia mínima, según parámetros institucionales y normativa.
- **RN-4 · Preescolar:** evaluación cualitativa por dimensiones; promoción automática; sin reprobación ni recuperación.
- **RN-5 · Boletín = documento oficial:** una vez emitido para entrega a familias, es registro oficial; correcciones se reemiten con nueva versión y quedan trazadas.
- **RN-6 · Período cerrado = barrera:** tras el cierre, la nota es oficial; modificarla exige reapertura formal con autorización y registro.
- **RN-7 · Retención:** los registros académicos (notas finales, actas, certificados) deben conservarse según la ley (en Colombia, los certificados de estudio se expiden de por vida ⇒ retención **permanente** de la nota final consolidada).
- **RN-8 · Comisión de evaluación y promoción:** las decisiones de promoción/reprobación pueden requerir acta de la comisión; el acta es el sustento de la decisión.
- **RN-9 · Un estudiante, una nota oficial por coordenada:** no existen "dos notas oficiales" simultáneas para la misma asignatura-período.
- **RN-10 · La evidencia pertenece al acto evaluativo, no al docente:** si cambia el docente, la evidencia del estudiante **permanece**; cambia el responsable, no el hecho.

---

# 5. MODELO CANÓNICO DEL CICLO DE VIDA DE UNA NOTA

El recorrido de una nota desde que nace hasta el archivo histórico:

```
1. CONTEXTO        Existe matrícula activa + asignación docente + plan de evaluación + período ACTIVE
        ↓
2. CAPTURA         El docente registra evidencia (puntaje de actividad). Estado: BORRADOR
        ↓
3. CONSOLIDACIÓN   La planilla se "entrega" (SUBMITTED). El sistema deriva la nota de período (Capa 2)
        ↓
4. REVISIÓN        (Opcional) Coordinación revisa/aprueba; puede registrar override con motivo
        ↓
5. CIERRE          El período se FINALIZA. La nota se vuelve OFICIAL. Se congela snapshot (Capa 3)
        ↓
6. PUBLICACIÓN     Se emite el boletín v1 (registro legal con config vigente)
        ↓
7a. RECUPERACIÓN   Si reprobó: evidencia de recuperación → nueva derivación → snapshot v2 (post-rec)
7b. CORRECCIÓN     Si hubo error: reapertura formal → corrección de evidencia → boletín v2
        ↓
8. CONSOLIDACIÓN ANUAL  La nota anual se deriva de períodos + componentes finales
        ↓
9. PROMOCIÓN       Cierre de año: la nota anual alimenta la decisión de promoción (inmutable)
        ↓
10. ARCHIVO        La nota final consolidada pasa a histórico permanente (retención de por vida)
        ↓
11. CERTIFICACIÓN  Años después: se expiden certificados/constancias desde el histórico inmutable
```

**Reglas del ciclo:**
- Entre los pasos 2–4 la nota es **mutable libremente** (borrador del docente).
- En el paso 5 cruza la **barrera de oficialidad**: a partir de aquí toda modificación es versionada y auditada.
- Los pasos 7–11 **nunca** mutan registros anteriores; **agregan** versiones/decisiones.

---

# 6. MÁQUINAS DE ESTADO

## 6.1 Estado de una NOTA (valor de un componente/actividad)
```
VACÍA ──(docente registra)──> BORRADOR ──(planilla entregada)──> CONSOLIDADA
                                  │                                   │
                            (docente edita)                    (período cierra)
                                  ↑__________________________________ ▼
                                                                  OFICIAL
                                                          ┌──────────┼───────────┐
                                                   (recuperación)  (reapertura)  (sin cambio)
                                                          ▼          ▼            ▼
                                                     RECUPERADA   CORREGIDA     ARCHIVADA
                                                          └──────────┴────────────┘
                                                                     ▼
                                                                ARCHIVADA (histórico permanente)
```
Transición prohibida: OFICIAL → BORRADOR (solo vía REAPERTURA, que es CORREGIDA). VACÍA ≠ cero (INV-3).

## 6.2 Estado de la PLANILLA (gradebook por asignación+período)
```
ABIERTA ──> EN_PROGRESO ──> ENTREGADA(docente) ──> APROBADA(coordinación) ──> BLOQUEADA(cierre)
   ▲                                                                              │
   └──────────────────────── REABIERTA <───────(reapertura formal)───────────────┘
```
- Solo en ABIERTA/EN_PROGRESO/REABIERTA el docente edita libremente.
- ENTREGADA: el docente declara terminada la digitación (control de calidad; hoy inexistente — vacío del dominio).
- BLOQUEADA: ligada a período FINALIZED.

## 6.3 Estado del PERÍODO (AcademicTerm)
```
DRAFT ──> ACTIVE ──> EN_CIERRE(ventana de gracia) ──> FINALIZED ──> ARCHIVED
                                                          │
                                                    REOPENED ──> RE-FINALIZED (v+1)
```
- `EN_CIERRE` (no existe hoy) = ventana donde se entregan/aprueban planillas pero ya no entra evidencia nueva libre.
- Cada FINALIZED genera snapshot; cada REOPENED/RE-FINALIZED queda registrado (ya existe `TermReopeningRecord`).

## 6.4 Estado de la RECUPERACIÓN
```
NO_ELEGIBLE
   │ (nota < mínima y estructura lo permite)
   ▼
ELEGIBLE ──> ASIGNADA ──> EN_PROGRESO ──> ENTREGADA ──> EN_REVISIÓN ──> APROBADA / NO_APROBADA
                                                                            │
                                                                       APLICADA (evidencia 1c) ──> INMUTABLE
```
- APROBADA aplica la mejora como **evidencia** (Capa 1c), no como overwrite (resuelve A-3).
- NO_APROBADA conserva la nota original.
- Una vez APLICADA, es inmutable; corregirla exige reapertura formal.

---

# 7. MATRIZ DE CONFLICTOS DEL DOMINIO

Qué debe ocurrir cuando dos fuerzas chocan. `✔ regla canónica` define el comportamiento correcto:

| Conflicto | Situación | Regla canónica (✔) |
|---|---|---|
| **Recuperación × Recálculo** | Tras recuperación aprobada, el docente edita un parcial | ✔ La recuperación es evidencia (1c); el recálculo la **incorpora**, nunca la borra (A-3, INV-9) |
| **Recálculo × Cambio de %** | Coordinador cambia un peso con notas digitadas | ✔ El cambio de peso **dispara recálculo** de todas las derivaciones afectadas (no publicadas). Las publicadas conservan su config (INV-14) |
| **Cambio de escala × Notas existentes** | Rector cambia escala a mitad de año | ✔ La evidencia se **reinterpreta** bajo la nueva escala para lo no publicado; lo publicado mantiene su escala original (INV-14). Requiere autorización + auditoría |
| **Reapertura × Recuperación** | Se reabre un período que ya tuvo recuperaciones | ✔ La reapertura crea v+1; las recuperaciones previas permanecen como evidencia y se recalculan en el nuevo contexto |
| **Modificación de actividad × Notas puestas** | Se borra/edita una actividad con notas | ✔ Borrar la actividad **no borra** la evidencia en silencio; exige confirmación y queda auditado; recálculo posterior |
| **Override × Recálculo** | Override manual + edición posterior de evidencia | ✔ El override (1b) **prevalece** sobre el cálculo hasta que se retire explícitamente; ambos visibles (A-1) |
| **Override × Recuperación** | Nota fijada a mano y luego recuperación | ✔ Prevalece la **más favorable** según política institucional declarada; nunca silencioso |
| **Promoción × Recuperación pendiente** | Cierre de año con recuperación sin decidir | ✔ Bloquea el cierre hasta resolver (ya implementado) |
| **Cambio de docente × Evidencia** | Releva docente a mitad de período | ✔ La evidencia del estudiante **permanece** (RN-10); cambia el responsable, no el hecho. Prohibido `deleteMany` silencioso (A-9) |
| **Movimiento de grupo × Notas** | Estudiante cambia de grupo con notas | ✔ La evidencia **viaja con la matrícula/estudiante**; se reasocia atómicamente, sin orfandad |
| **Cierre × Digitación concurrente** | Se cierra mientras un docente guarda | ✔ El cierre es barrera atómica; lo no entregado antes del corte no entra (INV-6, INV-20) |
| **Snapshot × Recálculo** | Recálculo después de publicar boletín | ✔ El snapshot publicado no cambia; un recálculo produce, si acaso, una **nueva versión** explícita |
| **Componente final × Período** | Cambian pesos período vs. componentes anuales | ✔ La nota anual = Σ fuentes ponderadas; cambiar una fuente recalcula la anual no publicada |

---

# 8. CATÁLOGO DE +140 CASOS EXTREMOS

Escenarios reales que pueden ocurrir en 10–20 años. Cada uno debe tener comportamiento definido (✔ = comportamiento canónico esperado).

### A. Captura y escala (1–15)
1. Docente registra nota = mínimo exacto de la escala → ✔ válida.
2. Docente registra nota = máximo exacto → ✔ válida.
3. Docente registra **0.0** legítimo (no presentó) → ✔ se guarda como 0, distinta de "sin nota" (INV-3).
4. Docente deja celda vacía → ✔ "sin nota", no cuenta como 0 (INV-3).
5. Nota con 2 decimales en escala que solo admite 1 → ✔ se aplica redondeo institucional único (INV-17).
6. Nota fuera de escala (7.5 en escala 0–5) → ✔ rechazada (INV-2).
7. Nota negativa → ✔ rechazada.
8. Nota no numérica/texto en escala cuantitativa → ✔ rechazada.
9. Escala 0–100 (no 0–5) → ✔ el sistema opera sin hardcoding (corrige DTO A-6).
10. Escala 0–10 con decimales → ✔ soportada.
11. Institución cualitativa (DIMENSIONS) registra "nivel" no número → ✔ válido, sin reprobación.
12. Dos actividades con el mismo nombre/índice → ✔ coexisten o se distinguen por id; sin colisión de llave.
13. Registro de nota en asignatura sin plan de evaluación → ✔ se permite con promedio simple **declarado**, o se exige plan (política institucional).
14. Registro masivo desde Excel con una nota fuera de escala en la fila 250 → ✔ preview la marca; no se aplica nada hasta confirmar.
15. Nota registrada con coma decimal vs. punto (locale) → ✔ normalización al ingresar.

### B. Cero vs. ausencia (16–25)
16. Estudiante sin ninguna nota en el período → ✔ "sin nota", no 0; no reprueba por defecto, queda pendiente.
17. Estudiante con todas las notas en 0 → ✔ promedio 0, reprueba (no "sin nota").
18. Mezcla de notas y vacíos → ✔ promedio solo sobre lo registrado (política de "vacío no penaliza" configurable).
19. Política alternativa "vacío = 0" activada → ✔ el sistema lo declara explícitamente, no por accidente.
20. Importar Excel donde celda vacía significa 0 en el origen → ✔ el mapeo decide; nunca implícito.
21. Estudiante que ingresó tarde y no tiene notas de actividades previas → ✔ vacíos, no ceros.
22. Borrar la última nota de un componente → ✔ el componente queda "sin nota", no 0.
23. Componente con peso pero sin ninguna nota → ✔ no arrastra 0 al ponderado; se excluye o penaliza según política declarada.
24. Recuperación de un estudiante "sin nota" (nunca presentó) → ✔ definir: ¿elegible? Política institucional.
25. Nota 0 por fraude académico (sanción) → ✔ registrable como 0 con motivo/observación.

### C. Recálculo y pesos (26–40)
26. Cambiar peso de un componente con notas digitadas → ✔ recálculo de derivaciones no publicadas.
27. Suma de pesos = 90% → ✔ normalización explícita o rechazo (INV-11).
28. Suma de pesos = 110% → ✔ rechazo o normalización declarada.
29. Peso de un componente a 0% → ✔ el componente es informativo, no pondera.
30. Agregar un componente nuevo a mitad de período → ✔ recálculo; notas previas intactas.
31. Eliminar un componente con notas → ✔ confirmación + auditoría; evidencia conservada o archivada.
32. Cambiar el redondeo institucional (1 decimal → entero) → ✔ recálculo uniforme (INV-17).
33. Recálculo de 5.000 estudiantes tras cambio de peso → ✔ en segundo plano, atómico por estudiante (Bloque E).
34. Recálculo concurrente con digitación → ✔ aislamiento; no se ve estado intermedio (INV-20).
35. Cambiar pesos después de cerrar el período → ✔ no afecta lo publicado (INV-14); solo con reapertura.
36. Componente con un solo estudiante calificado → ✔ promedio = esa nota.
37. Promedio ponderado vs. simple según config de área → ✔ respeta `AreaCalculationType` (AVERAGE/WEIGHTED/INFORMATIVE).
38. Área informativa que no debe contar en el promedio general → ✔ excluida del general.
39. Recálculo tras corregir una sola nota → ✔ solo recalcula lo afectado.
40. Inconsistencia detectada: nota final almacenada ≠ recálculo → ✔ el sistema reconcilia a favor de la evidencia (Capa 1) y audita la corrección.

### D. Recuperación (41–60)
41. Recuperación mejora la nota → ✔ se aplica como evidencia 1c.
42. Recuperación con resultado inferior al original → ✔ se conserva el original (RN-2).
43. Recuperación que no alcanza el mínimo → ✔ NO_APROBADA, nota original.
44. Recuperación aprobada y luego docente edita un parcial → ✔ recuperación **persiste** (A-3, INV-9).
45. Recuperación tras boletín emitido → ✔ snapshot v2 post-recuperación.
46. Recuperación con tope `recoveryMaxScore` (ej. máx 3.0) → ✔ nota recuperada acotada al tope.
47. Recuperación de varias asignaturas a la vez → ✔ cada una independiente.
48. Recuperación de período vs. recuperación anual/final → ✔ tipos distintos, ambos definidos.
49. Recuperación extraordinaria fuera de calendario → ✔ requiere autorización + acta.
50. Recuperación de un estudiante que se retiró después → ✔ se conserva el histórico.
51. Recuperación anulada (CANCELLED) → ✔ vuelve a nota original; auditada.
52. Doble recuperación de la misma asignatura/período → ✔ política: ¿permitida? prevalece la última aprobada.
53. Recuperación en preescolar (DIMENSIONS) → ✔ no aplica (INV-19).
54. Recuperación con override manual previo → ✔ resolución por política (conflicto §7).
55. Recuperación pendiente al cerrar el año → ✔ bloquea cierre (ya implementado).
56. Recuperación aprobada por el docente pero rechazada por coordinación → ✔ NO_APROBADA, original.
57. Recuperación cuya evidencia se importó desde otra plataforma → ✔ marcada como migrada.
58. Recuperación que cambia el estado de promoción del estudiante → ✔ recalcula promoción (si año abierto).
59. Recuperación registrada en período ya finalizado → ✔ vía flujo formal, no edición libre.
60. Histórico de todas las recuperaciones de un estudiante → ✔ consultable y auditado.

### E. Cierre y reapertura de período (61–75)
61. Cerrar período con planillas sin entregar → ✔ advierte/bloquea según política.
62. Cerrar período con estudiantes sin nota → ✔ reporte de faltantes antes de cerrar.
63. Reabrir período finalizado → ✔ registro de reapertura + autorización (existe).
64. Editar nota en período reabierto → ✔ permitido, genera v+1 al re-finalizar.
65. Reapertura, corrección y re-finalización → ✔ boletín v2; v1 conservado.
66. Reapertura mientras otro usuario consulta boletín → ✔ ve la versión vigente, no estado intermedio.
67. Cerrar período dos veces (doble click/concurrencia) → ✔ idempotente; no duplica snapshot.
68. Cerrar período sin haber abierto el siguiente → ✔ permitido; años/períodos independientes.
69. Cierre con recuperación de período en curso → ✔ política: ¿bloquea? definir por institución.
70. Reapertura de período de un año ya cerrado → ✔ requiere reabrir año (cascada de autorizaciones).
71. Snapshot corrupto/incompleto por fallo durante cierre → ✔ cierre atómico; si falla, no queda snapshot parcial (INV-16).
72. Cerrar período con notas importadas pero sin parciales → ✔ definido por el modelo de evidencia (caso `recoverLostGrades`).
73. Reapertura solo para una asignatura/un estudiante → ✔ granularidad definida por política.
74. Consultar quién reabrió, cuándo y por qué → ✔ auditado.
75. Período cerrado por error inmediatamente → ✔ reapertura simple si nadie consumió el snapshot.

### F. Cambio de escala (76–83)
76. Escala 0–5 → 0–100 a mitad de año → ✔ reinterpretación para lo no publicado; publicado conserva 0–5 (INV-14).
77. Cambio de escala que invalida notas existentes (fuera de rango nuevo) → ✔ se detecta y bloquea hasta reconciliar.
78. Cambio de niveles de desempeño (rangos) → ✔ recálculo de clasificación; valores numéricos intactos.
79. Cambio de nota mínima aprobatoria → ✔ recalcula aprobado/reprobado, promoción, elegibilidad de recuperación (no publicado).
80. Escala distinta por nivel (preescolar cualitativo, resto cuantitativo) → ✔ coexisten.
81. Revertir un cambio de escala → ✔ posible mientras no se haya publicado bajo la nueva.
82. Boletín de 2026 (escala vieja) regenerado en 2030 → ✔ idéntico (config temporal, P5/INV-14).
83. Cambio de escala con override manual existente → ✔ el override se reexpresa o se marca para revisión.

### G. Modificación de plan/actividades (84–93)
84. Renombrar una actividad → ✔ sin efecto en evidencia.
85. Cambiar el componente de una actividad → ✔ recálculo; auditado.
86. Borrar actividad con notas → ✔ confirmación + evidencia conservada/archivada (no silencioso).
87. Cambiar la fecha de una actividad (corte preventivo) → ✔ afecta cálculos "a la fecha".
88. Duplicar una actividad por error → ✔ detectable; sin doble conteo.
89. Mover una actividad de período → ✔ recálculo en ambos períodos.
90. Plan de evaluación creado después de digitar notas → ✔ el modelo de evidencia lo soporta (caso real actual).
91. Plan con componentes que no coinciden con `componentType` de las notas → ✔ reconciliación explícita (acoplamiento `code`↔`componentType`).
92. Cambiar el plan de evaluación de toda la asignación → ✔ recálculo masivo controlado.
93. Importar un plan estándar institucional → ✔ aplicable a múltiples asignaciones.

### H. Movimiento de estudiante / matrícula (94–104)
94. Estudiante cambia de grupo con notas → ✔ evidencia viaja con la matrícula; sin orfandad.
95. Estudiante cambia de grupo y de docente (otra asignación) → ✔ evidencia reasociada atómicamente.
96. Estudiante se retira a mitad de período → ✔ notas conservadas; estado WITHDRAWN.
97. Estudiante reingresa meses después → ✔ histórico continuo; nueva matrícula vinculada.
98. Estudiante ingresa a mitad de período → ✔ vacíos en actividades previas (no ceros).
99. Estudiante matriculado en grado equivocado y reubicado → ✔ migración de notas o reinicio según política.
100. Estudiante con dos matrículas en el mismo año (error) → ✔ prohibido (unicidad estudiante-año).
101. Estudiante promovido anticipadamente con notas en el grado anterior → ✔ histórico conservado; acta.
102. Estudiante repitente: ¿hereda notas? → ✔ no; nuevo año, nueva matrícula, histórico aparte.
103. Cambio de jornada/sede conservando notas → ✔ evidencia intacta.
104. Estudiante con diagnóstico/ajustes (APD) cuya evaluación es diferenciada → ✔ el modelo soporta evaluación con ajustes sin romper invariantes.

### I. Cambio de docente (105–110)
105. Releva docente a mitad de período → ✔ evidencia del estudiante permanece (RN-10).
106. Dos docentes con notas en conflicto (misma actividad) → ✔ conciliación explícita, sin `deleteMany` silencioso (A-9).
107. Docente en licencia y suplente registra notas → ✔ ambas atribuibles; histórico de responsables.
108. Docente eliminado del sistema → ✔ sus notas conservan autoría histórica (no se borran).
109. Reasignación administrativa de varias asignaciones → ✔ evidencia preservada en cada una.
110. Docente que niega haber puesto una nota → ✔ auditoría resuelve (INV-8).

### J. Promoción y año (111–120)
111. Promoción con N áreas reprobadas dentro del límite → ✔ AT_RISK/PROMOVIDO según parámetros.
112. Promoción con recuperación final pendiente → ✔ bloquea (existe).
113. Cierre de año con un estudiante sin notas en una asignatura → ✔ reporte de faltantes.
114. Promoción de 5.000 estudiantes → ✔ en segundo plano, atómico, reanudable (Bloque E).
115. Crear año siguiente conservando histórico → ✔ años independientes; histórico permanente.
116. Promoción que debe revertirse por error → ✔ vía reapertura de año + acta (INV-15 protege lo correcto).
117. Estudiante NO promovido que recurre y gana → ✔ acta + corrección versionada.
118. Nota anual = períodos + componentes finales → ✔ fórmula universal de fuentes ponderadas.
119. Cambio de calendario (4 períodos → 3) a mitad de año → ✔ política de remapeo; evidencia conservada.
120. Graduación: consolidación de notas de 11° para certificado → ✔ desde histórico inmutable.

### K. Concurrencia (121–130)
121. Dos docentes editan la misma planilla → ✔ control de concurrencia; sin pérdida (Bloque D).
122. Coordinador cambia % mientras docente guarda → ✔ orden serializable; recálculo consistente.
123. Admin mueve estudiante mientras otro registra asistencia/nota → ✔ atómico; sin orfandad.
124. Docente edita nota mientras se generan boletines → ✔ boletín desde snapshot consistente.
125. Cierre de período mientras se digita → ✔ barrera atómica (INV-6, INV-20).
126. Dos procesos de recálculo simultáneos sobre el mismo estudiante → ✔ serializados; resultado único.
127. Importación masiva mientras docentes digitan → ✔ aislamiento por lote.
128. Doble envío del mismo guardado (red lenta) → ✔ idempotente; no duplica.
129. Recuperación aplicada dos veces por doble click → ✔ idempotente.
130. Reapertura concurrente del mismo período → ✔ una sola gana; la otra recibe estado actual.

### L. Migración e importación (131–138)
131. Importar notas con duplicados por documento → ✔ preview + conciliación.
132. Importar solo "definitivas" sin parciales → ✔ evidencia de tipo importación; nota canónica derivada/override.
133. Importar con escala distinta a la institucional → ✔ conversión declarada en el mapeo.
134. Importar períodos que no coinciden (bimestres → trimestres) → ✔ matriz de equivalencia.
135. Rollback de una importación equivocada → ✔ por lote (Bloque G).
136. Importación interrumpida a mitad → ✔ atómica por lote; sin estado parcial (INV-16).
137. Reimportar el mismo archivo → ✔ idempotente o detecta ya aplicado.
138. Migrar histórico de años anteriores → ✔ entra como publicado/archivado con su config.

### M. Legal, auditoría e histórico (139–145)
139. Acudiente reclama "la nota cambió" → ✔ historial antes/después/autor/fecha/motivo (INV-8).
140. Auditoría de una nota específica en su línea de tiempo completa → ✔ reconstruible.
141. Restaurar el estado de las notas de la semana pasada → ✔ posible (Bloque C/I).
142. Certificado de un egresado de hace 8 años → ✔ desde histórico permanente (RN-7).
143. Borrado accidental de notas → ✔ papelera/restauración (Bloque C).
144. Solicitud legal de exportar todo el histórico de un estudiante → ✔ trazable y completo.
145. Eliminación de institución que conserva obligaciones legales de retención → ✔ política de retención sobre borrado.

> **Total: 145 casos.** Cada caso del catálogo es un requisito de comportamiento que el diseño de la ETAPA 2 deberá satisfacer o declarar explícitamente como política institucional configurable.

---

# 9. COMPARACIÓN CONCEPTUAL CON PLATAFORMAS LÍDERES

Buenas prácticas a **adoptar conceptualmente** (sin copiar implementación):

| Plataforma | Práctica destacada | Qué adoptar para Edusyn |
|---|---|---|
| **PowerSchool** | Distinción explícita entre **"stored grade" vs "calculated grade"** y **manual override flagged** (un ícono marca que la nota fue fijada a mano). Historial de cambios de nota. | El modelo de 3 capas + override como evidencia visible y marcada (§2). Confirma INV-10 y A-1. |
| **Infinite Campus** | Flujo de **"post grades"**: el docente *publica* las notas y eso las **bloquea**; "grading tasks" y "composite grades" como fuentes ponderables. | Estado de planilla ENTREGADA/APROBADA (§6.2) — control de calidad hoy ausente. Fuentes ponderadas (nota anual). |
| **Blackbaud** | **"Grade plans"** y configuración por período con histórico; GPA acumulado; report card builder con versiones. | Configuración temporal conservada con el registro (INV-14, P5). Reproducibilidad del pasado. |
| **Q10 (Colombia)** | Escalas y períodos configurables, **recuperaciones** integradas, boletines y **Decreto 1290** nativo, multi-sede. | Recuperación como ciudadano de primera clase (§6.4) y cumplimiento normativo (RN-2, RN-8). |
| **Phidias** | Gradebook con ponderación flexible, **portal de acudientes** con la misma verdad que ve el docente. | Una sola verdad canónica para todos los actores (P3, INV-10). |
| **Master2000 (Colombia)** | Muy difundido: **planillas, definitivas, recuperaciones, comisiones de evaluación y promoción**, actas. Modelo mental familiar para colegios colombianos. | Respetar el vocabulario y los flujos que los colegios ya conocen (planilla, definitiva, comisión, acta) para minimizar fricción de adopción. |

**Síntesis de mejores prácticas del sector (consenso de líderes):**
1. **Separar evidencia de cálculo de publicación** (PowerSchool/Blackbaud) — núcleo de esta Constitución.
2. **Override manual explícito y marcado**, nunca silencioso (PowerSchool).
3. **Flujo de "entrega/publicación" de notas que bloquea** (Infinite Campus).
4. **Historial de cambios de nota con motivo** (todos).
5. **Configuración temporal**: el pasado se conserva con su contexto (Blackbaud).
6. **Una sola verdad para todos los portales** (Phidias).
7. **Recuperación y comisión como flujos nativos, no parches** (Q10/Master2000).
8. **Cumplimiento normativo local incorporado** (Q10/Master2000 — Decreto 1290).

**Dónde Edusyn puede superar a los líderes:** unificar el modelo de evidencia (muchos SIS aún arrastran "stored vs calculated" con drift) en un **modelo determinista 100% recomputable + override auditado**, lo que elimina por diseño la clase de bugs que la ETAPA 1 encontró (A-1 a A-7).

---

# 10. GLOSARIO CANÓNICO

- **Evidencia:** hecho atómico registrado (puntaje, override, recuperación, importación). Capa 1. Fuente de verdad.
- **Nota derivada:** valor calculado de forma determinista a partir de evidencia + configuración. Capa 2.
- **Registro publicado / Acta / Boletín:** snapshot inmutable con valor legal. Capa 3.
- **Override:** fijación manual de una nota, registrada como evidencia con autor y motivo; prevalece sobre el cálculo de forma visible.
- **Coordenada de nota:** la tupla `(matrícula, asignatura, período[, año])` que identifica unívocamente una nota canónica.
- **Configuración temporal:** el conjunto de parámetros (escala, pesos, redondeo, mínimos) vigente en un momento, conservado junto a los registros que afectó.
- **Barrera de oficialidad:** el cierre de período; antes la nota es borrador, después es oficial y versionada.
- **Política institucional declarada:** decisión configurable (ej. "vacío penaliza" sí/no) que el sistema hace explícita, nunca implícita.

---

# 11. DECÁLOGO CONSTITUCIONAL (resumen ejecutable)

1. La **evidencia** es la única fuente de verdad; las notas finales se **derivan**.
2. **"Sin nota" ≠ "cero".** Siempre distinguibles.
3. **Una sola nota canónica** por coordenada, para todos los actores.
4. Ningún cálculo **destruye** evidencia.
5. La **recuperación** es evidencia: nunca se pierde, nunca empeora la nota.
6. El **override** manual es explícito, marcado y auditado; nunca silencioso.
7. Lo **publicado es inmutable**: se corrige con nueva versión, no editando.
8. El **pasado es reproducible** gracias a la configuración temporal.
9. **Todo cambio es atribuible** (quién, cuándo, antes/después, por qué).
10. Toda operación de notas es **atómica, determinista y aislada** de la concurrencia.

---

## CIERRE DE LA ETAPA 1.5

Esta Constitución define **qué debe garantizar** el módulo de notas, con independencia de cómo se implemente. Resuelve conceptualmente todos los defectos del Bloque A (A-1 a A-10) elevándolos a invariantes y reglas:
- A-1/A-2 → modelo de 3 capas + nota canónica única (§2, INV-10).
- A-3/A-4 → recuperación como evidencia + una sola verdad (§6.4, §7, INV-9).
- A-5/A-6 → "sin nota ≠ cero" + escala como invariante (INV-2, INV-3).
- A-7 → determinismo + redondeo único (INV-7, INV-17).
- A-8 → atomicidad (INV-16).
- A-9 → la evidencia pertenece al hecho, no al docente (RN-10).
- A-10 → desaparece la necesidad de herramientas de reparación; el modelo es autoconsistente.

**Cuando apruebes esta Constitución**, la ETAPA 2 (Diseño de la Solución) traducirá estas reglas a una arquitectura técnica concreta: estructura de datos, servicios, migraciones de datos de producción, contrato de API y plan de compatibilidad — siempre subordinada a este documento.
