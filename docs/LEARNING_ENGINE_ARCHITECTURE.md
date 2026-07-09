# Learning Engine — Arquitectura (responsabilidades, eventos, flujos, APIs internas)

> Documento 2 de 3. Especifica **cómo funciona** el Learning Engine por dentro: las responsabilidades de cada
> capa, el modelo de eventos, los flujos de datos del lazo, los contratos internos (APIs conceptuales), la
> integración con el resto de Edusyn, el mapeo a lo que ya existe en el código, y la gobernanza de datos.
> Base conceptual: `EDUSYN_LEARNING_ENGINE.md`. Experiencia del estudiante: `LEARNING_EXPERIENCE_SPEC.md`.
>
> **Regla de oro:** este documento describe *contratos y responsabilidades*, no implementación. Debe seguir
> siendo válido aunque cambien React, NestJS o la IA subyacente en 10 años.

---

## 1. Las 8 capas y sus responsabilidades

| Capa | Nombre | Responsabilidad única | NO le corresponde |
|---|---|---|---|
| **L0** | Cerebro Institucional | Aportar restricciones (PEI, DBA, currículo, políticas) y **cultura del aula** | Decidir la experiencia individual |
| **L1** | Grafo de Competencias | Ser el mapa canónico + overlays: nodos (can-do) y aristas (prerrequisitos/vecindad) | Guardar el estado del estudiante |
| **L2** | **Núcleo de Aprendizaje** | Ser el **estado soberano** por estudiante: Dominio + ADN + Tiempo + Memoria | Decidir; renderizar |
| **L3** | Motor de Decisión | Elegir la **próxima experiencia** (mostrar/ocultar/repetir/reforzar/desafiar/detener) | Enseñar; medir |
| **L4** | Banco de Experiencias | Proveer/generar micro-experiencias etiquetadas por competencia y momento | Decidir cuál se sirve |
| **L5** | Motor de Evidencia | Traducir cada interacción en **evidencia** y actualizar L2 y L1 | Calificar críticamente sin docente |
| **L6** | Valeria | Controlador **pedagógico**: intervenir, explicar, calibrar andamiaje | Decidir notas/promoción |
| **L7** | Superficie Viva | Renderizar el estado actual del lazo y capturar la acción | Contener lógica de decisión |

**Invariante arquitectónico:** la lógica de aprendizaje vive en L2–L6. **L7 (interfaz) no decide nada** —
solo proyecta el estado y emite intenciones. Cualquier tecnología de UI futura se conecta a los mismos contratos.

---

## 2. Modelo de datos del Núcleo (L2) — conceptual

Cuatro agregados por estudiante. (Nombres de entidad conceptuales; el mapeo a Prisma en §8.)

### 2.1 Dominio (Domain) — *qué sabe*
```
CompetencyState { studentId, competencyId,
  mastery: 0..100,          // dominio derivado de evidencia
  confidence: 0..1,          // qué tan seguros estamos (n de evidencias, recencia)
  status: emerging|developing|demonstrated|mastered,
  lastEvidenceAt, evidenceCount }
```
Regla de derivación: `mastery = f(mejores-N evidencias, recencia, dificultad)`. `demonstrated` cuando
`mastery ≥ umbral` (hoy 70) **con** `confidence ≥ mínimo`.

### 2.2 ADN de Aprendizaje (LearningDNA) — *cómo aprende*
```
LearningDNA { studentId,
  traits: {                 // 0..1, DINÁMICOS, observados, no diagnósticos
    pace, persistence, curiosity, scaffoldingNeed,
    transfer, selfRegulation },
  modalitySignals: { visual, auditory, kinesthetic },  // frecuencias observadas
  updatedAt, evidenceWindow }   // se recalcula con ventana móvil
```
Reglas: cada rasgo es una **media móvil** de señales conductuales (no una etiqueta). Reversible. Nunca se
expone como juicio; solo alimenta al Motor. Auditable por el docente.

### 2.3 Línea de Tiempo (Timeline) — *cuándo*
```
RetentionState { studentId, competencyId,
  masteredAt,
  forgettingHalfLife,        // personalizado (Ebbinghaus × ADN.persistence/selfRegulation)
  predictedDecayAt,          // cuándo el dominio caerá bajo el umbral
  nextReviewDueAt,           // repaso espaciado óptimo
  reviewCount, lastReviewAt }
```
El Motor consulta `nextReviewDueAt` para programar repasos **antes** del olvido (SM-2/half-life como base).

### 2.4 Memoria (LearningHistory) — *la historia*
```
LearningEpisode { studentId, competencyId, kind, at, detail }
   kind ∈ { learned, mastered, forgot, recovered, connected, struggled, explored }
```
Log **append-only** de eventos episódicos. Es el portafolio longitudinal y la fuente de la narrativa
("aprendió → dominó → olvidó → recuperó → conectó").

---

## 3. Modelo de eventos (el sistema es event-driven)

El lazo se comunica por **eventos de dominio** en un bus interno. Beneficio: desacople total — cualquier
módulo (aula, seguimiento, reportes, Play) **reacciona** sin acoplarse al motor.

### 3.1 Catálogo de eventos (canónico)
```
ExperienceRequested   { studentId, competencyId?, context }        → L3 responde
ExperienceServed      { studentId, experienceId, moment, skill }   ← L4
InteractionSubmitted  { studentId, experienceId, response, timing } → el estudiante actúa
EvidenceProduced      { studentId, competencyId, score, source, routeStepId? }  ← L5
MasteryUpdated        { studentId, competencyId, from, to, status } ← L2
DNAUpdated            { studentId, trait, from, to }               ← L2
RetentionScheduled    { studentId, competencyId, nextReviewDueAt }  ← L2/L3
ForgettingPredicted   { studentId, competencyId, predictedDecayAt } ← L2
ValeriaIntervened     { studentId, trigger, kind, message }         ← L6
CompetencyUnlocked    { studentId, competencyId }                   ← L1 (vecinos)
ExplorationStarted    { studentId, competencyId }                   ← Modo Exploración
CollaborationEvidence { studentIds[], competencyId, contribution }  ← experiencias sociales
```

### 3.2 Regla de emisión
- **L5 es el único que puede escribir Dominio y emitir `EvidenceProduced`.** (Un solo escritor de la verdad.)
- Cualquier módulo puede **suscribirse** a los eventos (ver §7). Nadie muta el Núcleo directamente salvo por su API (§5).

---

## 4. Flujos de datos (el lazo, como secuencias)

### 4.1 Lazo principal (aprender)
```
1. Superficie(L7) → DecisionEngine(L3): ExperienceRequested(studentId, competencyId?)
2. L3 lee: Núcleo(L2) + Grafo(L1) + restricciones/cultura(L0) + setpoints del docente
3. L3 → ExperienceBank(L4): "dame/genera experiencia para (competency, moment, DNA, difficulty)"
4. L4 → L7: ExperienceServed  → el estudiante la vive
5. L7 → EvidenceEngine(L5): InteractionSubmitted(response, timing)
6. L5 califica (client+server) → EvidenceProduced → escribe Dominio(L2) → MasteryUpdated
7. L2 recalcula ADN (§2.2) → DNAUpdated ; recalcula Timeline (§2.3) → RetentionScheduled
8. L2 → LearningHistory(memoria): LearningEpisode(learned/mastered/…)
9. L1: si mastery≥umbral en un nodo → CompetencyUnlocked(vecinos)
10. vuelve a 1 (el Motor decide el próximo mejor movimiento) — hasta demostrar el objetivo
```

### 4.2 Sub-lazo del error (Valeria)
```
EvidenceProduced(score bajo) + patrón (2 fallos mismo concepto)
   → L6 Valeria: evalúa contexto (Núcleo + error) → decide intervención
   → ValeriaIntervened(explain|example|prior-knowledge|encourage)
   → L3 inserta un momento de refuerzo andamiado en la ruta (adaptación visible)
```

### 4.3 Sub-lazo del olvido (Timeline)
```
Scheduler(diario) → consulta RetentionState.nextReviewDueAt ≤ hoy
   → ForgettingPredicted → L3 programa un repaso espaciado (entrelazado con lo nuevo)
   → el repaso exitoso extiende forgettingHalfLife (la retención mejora con cada repaso)
```

---

## 5. APIs internas (contratos conceptuales)

> Firmas conceptuales, agnósticas de lenguaje. Definen *qué* hace cada capa, no *cómo*.

### 5.1 Núcleo (L2) — el estado
```
Core.get(studentId): LearningCore                       // Dominio+ADN+Tiempo+Memoria (lectura)
Core.getCompetency(studentId, competencyId): CompetencyState
Core.getDNA(studentId): LearningDNA
Core.getDue(studentId, at): RetentionState[]            // qué toca repasar
Core.history(studentId, competencyId?): LearningEpisode[]
// Escritura SOLO vía eventos de L5/L2; no hay setter público de mastery.
```

### 5.2 Motor de Decisión (L3)
```
Decision.next(studentId, opts): ExperiencePlan
   // opts = { targetCompetencyId?, constraints(L0), setpoints(docente) }
   // ExperiencePlan = { competencyId, moment, difficulty, scaffolding, skill, source }
Decision.onError(studentId, competencyId, errorPattern): ExperiencePlan  // reinserción andamiada
Decision.scheduleReviews(studentId): void               // usa Timeline
```
Política: **detección barata siempre-on** (reglas sobre Núcleo), **generación cara bajo demanda** (IA solo
cuando aporta). El docente ajusta el "dial de autonomía" que limita cuánto puede reordenar el Motor.

### 5.3 Banco de Experiencias (L4)
```
Experiences.resolve(plan): Experience                    // curada o generada (Valeria)
Experiences.generate(competency, moment, DNA, difficulty): Experience   // vía apd-ai
```
Una `Experience` es **agnóstica de UI**: describe momento, contenido, interacción esperada y cómo se mide la
evidencia (ver `LEARNING_EXPERIENCE_SPEC.md`).

### 5.4 Motor de Evidencia (L5)
```
Evidence.record(params): void      // idempotente; único escritor de Dominio
   // params = { studentId, competencyId, source, score(0..100), routeStepId?, idempotencyKey }
Evidence.mastery(studentId, competencyId): number
Evidence.routeProgress(routeId, studentId): Progress
```
(Ya existe como `CompetencyEvidenceService` — §8.)

### 5.5 Valeria (L6)
```
Valeria.evaluate(studentId, momentContext): Intervention | null   // decide SI interviene
Valeria.explain(concept, error, DNA): Message                     // enseña el proceso
Valeria.budget(studentId): int                                    // presupuesto de intervención
```
Regla: `evaluate` puede devolver `null` **a propósito** (silencio pedagógico). Presupuesto por sesión.

---

## 6. El Motor de Decisión — política (resumen)

Entradas: Núcleo (Dominio+ADN+Tiempo+Memoria), Grafo, restricciones/cultura (L0), setpoints del docente.
Salida: la próxima experiencia. Reglas base (heurísticas siempre-on):

| Señal | Decisión |
|---|---|
| Competencia objetivo con brecha grande y prerrequisitos cumplidos | Programarla |
| `RetentionState.due` hoy | Insertar repaso espaciado (entrelazado) |
| 2 errores mismo concepto | Bajar dificultad + `Decision.onError` + Valeria |
| Racha de aciertos + `DNA.pace` alto | Saltar práctica redundante, ofrecer reto |
| `DNA.scaffoldingNeed` alto | Más ejemplos resueltos antes de la práctica |
| Dominio ya alto (grafo) | **Test-out:** reto corto; si pasa, salta y registra evidencia |
| Idle / respuestas erráticas | Micro-nudge, cambiar modalidad, acortar |
| Exploración iniciada | Reorientar hacia el interés; subir `DNA.curiosity` |

Todo lo "caro" (generar variante, explicación) se delega a Valeria/`apd-ai` **bajo demanda**.

---

## 7. Integración con el resto de Edusyn (event-driven)

Cada módulo **se suscribe** a eventos del lazo y **proyecta** su vista. Nadie muta el Núcleo salvo por su API.

| Módulo | Escucha | Reacciona |
|---|---|---|
| **Aula Virtual** | `ExperienceServed`, `MasteryUpdated` | Refleja el paso de la ruta y el % dominado |
| **Workspace Docente** | `MasteryUpdated`, `ValeriaIntervened` | Núcleo agregado del grupo; alertas por competencia |
| **Evaluación** | `EvidenceProduced` | La nota como subproducto de la evidencia |
| **Seguimiento/Observador** | `ForgettingPredicted`, caída de racha/dominio | Alerta temprana; el observador escribe contexto al Núcleo |
| **Reportes** | `MasteryUpdated`, `LearningEpisode` | Dominio + memoria longitudinal (no "completadas") |
| **Edusyn Play** | (futuro) `EvidenceProduced` | Práctica espaciada que también emite evidencia |
| **Planeación** | provee restricciones (L0) | Currículo/DBA priorizan el Motor |

**Una sola verdad (Núcleo + grafo), muchas proyecciones.** Por eso "aprender" actualiza aula/seguimiento/reportes
sin sincronización manual.

---

## 8. Mapeo a lo que YA existe (y lo que falta)

**Ya construido en staging (reusable como cimiento del Núcleo):**
- `Competency` (grafo CEFR canónico) → **L1**.
- `CompetencyEvidence` + `CompetencyEvidenceService` (record idempotente, mastery, routeProgress) → **L5** + base de **Dominio**.
- `LearningIdentity` (XP/nivel/racha, skillXp) → parte motivacional; insumo del **Núcleo**.
- `LearningRoute`/`LearningRouteStep` → contenedor de experiencias (**L4** parcial).
- `apd-ai.service` (orquestador free/premium; genera lecciones/ejercicios) → motor de **L4/L6**.

**Falta (greenfield, por fases del roadmap):**
- `LearningCore` explícito (Dominio consolidado + **ADN** + **Timeline** + **Memoria**) → **L2**.
- `DecisionEngine` (reglas → IA) → **L3**.
- Bus de eventos de dominio → §3.
- `ValeriaService` como controlador pedagógico con presupuesto → **L6**.
- Scheduler de repaso espaciado (Timeline) → §4.3.
- Experiencias sociales + Modo Exploración.

**Consecuencia:** el Núcleo **no se construye desde cero** — se consolida sobre `CompetencyEvidence`+`mastery`+
`LearningIdentity` que ya emiten y almacenan la señal. El primer incremento real es *materializar el `LearningCore`
y su Timeline*.

---

## 9. Gobernanza de datos (no negociable)

El Núcleo modela a un **menor**. Riesgo legal y ético máximo (Ley 1581 / Habeas Data).
- **Propósito único:** el Núcleo (y en especial el ADN) existe para **activar ayuda y adaptar**, jamás para
  etiquetar, ordenar, comparar públicamente o predecir un destino.
- **Explicable y citable:** toda decisión del Motor/Valeria debe poder mostrar de qué evidencia y de qué rasgo nace.
- **Reversible:** el ADN es dinámico; ningún rasgo es permanente ni visible como juicio.
- **Privado por defecto:** progreso y ADN no se exponen a pares; comparación opt-in.
- **Consentimiento y control:** el docente y la familia pueden revisar; datos aislados por institución (RLS, ya vigente).
- **Nunca diagnostica** condiciones de aprendizaje/salud; deriva a acompañamiento humano.

---

## 10. Escala y economía (para que sobreviva a su éxito)

- **Detección barata siempre-on** (reglas/modelos pequeños sobre el Núcleo) vs. **generación cara bajo demanda** (LLM).
- **Presupuesto de intervención de Valeria** por sesión (evita inundar y controla COGS).
- **Grafo canónico + overlays** (no un grafo por colegio desde cero).
- **Caché de experiencias** generadas (una vez, reusadas muchas — Biblioteca Institucional).
- Con esto, el lazo escala a 500k estudiantes sin que el COGS de IA supere el ingreso.
