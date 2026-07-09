# Learning Experience — Especificación (estados, transiciones, evidencia)

> Documento 3 de 3. Especifica con precisión **cómo vive el estudiante cada experiencia**: qué momentos
> existen, qué estados atraviesa, qué desencadena cada transición, cómo se mide la evidencia, cómo adapta el
> sistema, y cómo se siente. Es el puente entre la visión (`EDUSYN_LEARNING_ENGINE.md`) y la arquitectura
> (`LEARNING_ENGINE_ARCHITECTURE.md`) y la futura implementación.
>
> **Principio rector:** el estudiante nunca "hace un ejercicio de relacionar". El estudiante **vive un momento**
> (descubrir, practicar, dominar…). El "relacionar" es implementación interna que él nunca nombra.

---

## 1. La unidad: el Momento (no el ejercicio, no la pantalla)

Una experiencia se compone de **Momentos cognitivos**. Cada Momento es un acto mental con un propósito, un
estado emocional objetivo y una forma de producir evidencia. El arco canónico:

| Momento | Propósito cognitivo | Emoción objetivo | ¿Produce evidencia? |
|---|---|---|---|
| **Descubrir** | Abrir la brecha (curiosidad) | Curiosidad | No (engancha) |
| **Comprender** | Input con andamiaje (I do) | Claridad | Débil (reconocimiento) |
| **Experimentar** | Práctica guiada (we do) | Competencia naciente | Sí (baja) |
| **Practicar** | Recuperación autónoma (you do) | Competencia | Sí (media) |
| **Equivocarse** | Enseñanza en el error | Seguridad | Sí (diagnóstica) |
| **Reflexionar** | Metacognición | Consciencia | Cualitativa |
| **Dominar** | Demostrar sin andamiaje | Orgullo | Sí (alta, decisiva) |

El Motor **no sirve todos los momentos siempre**: los elige/omite/repite según el Núcleo (§6).

---

## 2. Máquina de estados de un Momento (universal)

Todo Momento con interacción sigue la misma máquina — esto **mata de raíz** bugs como "no deja escribir"
(el input existe según el estado, no según el tipo suelto):

```
        ┌────────┐   entra    ┌───────────┐  responde  ┌───────────┐
        │ ENTER  │──────────▶│ ENGAGED   │──────────▶│ CHECKING  │
        └────────┘           │ (interac. │            └─────┬─────┘
                             │  activa)  │                  │ evalúa
                             └───────────┘             ┌────▼─────┐
                                   ▲                   │ FEEDBACK │
                          reintento│                   └────┬─────┘
                          andamiado│         correcto ┌─────┴─────┐ incorrecto
                                   └─────────────────│  BRANCH   │
                                                     └─────┬─────┘
                                        advance / adapt /  │
                                        retry / valeria ───┘
```

**Estados:**
- `ENTER` — el Momento se materializa (transición suave desde el anterior; sin "cambiar de pantalla").
- `ENGAGED` — el estudiante interactúa (la UI del acto es visible: opciones, input, grabación, lienzo…).
- `CHECKING` — se evalúa la respuesta (cliente + servidor).
- `FEEDBACK` — feedback inmediato y específico (sobre el proceso, no solo "correcto/incorrecto").
- `BRANCH` — el Motor decide: `advance` | `retry andamiado` | `adapt` (cambiar dificultad/ejemplo) | `valeria`.

**Regla:** ningún Momento salta de `ENTER` a `advance` sin pasar por evidencia si su propósito la produce.

---

## 3. Los escenarios (cómo se vive cada tipo)

Cada escenario es una *forma* del Momento. El estudiante lo vive como experiencia, no como formulario. Para
cada uno: **qué vive · cómo se mide la evidencia · qué observa el ADN.**

### 3.1 Lectura / Texto (Reading)
- **Vive:** un texto inmersivo con un propósito ("necesitas esto para ayudar a Emma"). Vocabulario clave a mano.
- **Evidencia:** débil por lectura; fuerte por las preguntas de comprensión que siguen (§3.4). Score = % comprensión.
- **ADN:** tiempo de lectura → `pace`; relecturas → `scaffoldingNeed`.

### 3.2 Video
- **Vive:** video con propósito; se **pausa en timestamps** con una pregunta incrustada (no es pasivo).
- **Evidencia:** las respuestas en pausa. Score = aciertos en los checkpoints del video.
- **ADN:** re-reproducciones → `scaffoldingNeed`; saltos → `pace`.

### 3.3 Audio (Listening)
- **Vive:** audio (TTS o real) con control de velocidad; luego responde. Guion oculto (revelable como andamiaje).
- **Evidencia:** comprensión auditiva. Score = aciertos.
- **ADN:** uso de velocidad lenta / revelar guion → `scaffoldingNeed`.

### 3.4 Pregunta (decisión) — internamente selección múltiple / V-F
- **Vive:** una decisión con foco. Opciones neutras; feedback inmediato tras comprobar.
- **Evidencia:** correcto/incorrecto ponderado por dificultad. Score directo.
- **ADN:** tiempo de decisión → `pace`; cambios de opción → `persistence`.

### 3.5 Construir la frase — internamente ordenar / arrastrar
- **Vive:** "arma la oración para que Emma la diga bien" (banco de palabras → ranura).
- **Evidencia:** orden correcto. Score parcial por posición.
- **ADN:** intentos → `persistence`; uso de pista → `scaffoldingNeed`.

### 3.6 Conectar ideas — internamente relacionar columnas
- **Vive:** "empareja cada palabra con su significado para ayudar a Emma". Líneas al conectar.
- **Evidencia:** pares correctos. Score = % pares.
- **ADN:** patrón de aciertos → `transfer`.

### 3.7 Completar — internamente fill-in (input en línea)
- **Vive:** completar la palabra **dentro** de la frase ("My mother ___ dinner"). El hueco es un input inline.
- **Evidencia:** palabra exacta (normalizada). Score directo.
- **ADN:** escritura vs. duda → `pace`; uso de pista → `scaffoldingNeed`.

### 3.8 Pronunciación (Speaking) — futuro motor de voz
- **Vive:** "díselo a Emma" → graba. Feedback de **inteligibilidad** (no acento nativo).
- **Evidencia:** score de inteligibilidad + fluidez (proveedor turnkey). Sin voz: graba + rúbrica docente.
- **ADN:** reintentos de grabación → `persistence`.

### 3.9 Proyecto / Aplicación (transfer)
- **Vive:** crear algo propio ("presenta TU familia"). Aplicación auténtica.
- **Evidencia:** rúbrica (IA sugiere, docente valida). Score = rúbrica. **Máxima señal de transferencia.**
- **ADN:** iniciativa/creatividad → `curiosity`, `transfer`.

### 3.10 Reflexión (metacognición)
- **Vive:** escritura libre y calma ("¿qué te costó más?"). Serif, sin bordes duros.
- **Evidencia:** cualitativa (no puntúa dominio); nutre `selfRegulation` en el ADN.
- **ADN:** profundidad/consistencia → `selfRegulation`.

### 3.11 Reto / Evaluación (Dominar)
- **Vive:** "demuestra tu dominio" — sin pistas, con tensión positiva (canvas oscurecido, ◆ en el riel).
- **Evidencia:** **decisiva y de alto peso.** Superarlo marca la competencia como `demonstrated`.
- **ADN:** desempeño bajo presión → `selfRegulation`, `persistence`.

### 3.12 Celebración
- **Vive:** el **can-do desbloqueado** (no XP). El medidor de dominio salta; el grafo muestra el vecino que se abre.
- **Evidencia:** ninguna nueva (cierra el episodio). Escribe `LearningEpisode(mastered)` en la Memoria.
- **Confeti:** solo aquí.

---

## 4. Cómo se mide la evidencia (unificado)

Toda evidencia se normaliza a **0..100** y se registra idempotente (ver arquitectura §5.4):
```
Evidence.record({ studentId, competencyId, source, score(0..100), routeStepId?, idempotencyKey })
```
- **Fuente** ∈ { READING, LISTENING, SPEAKING, WRITING, QUIZ, LESSON, PROJECT, MANUAL, PLAY }.
- **Peso por momento:** Experimentar < Practicar < Reto (el Reto pesa más para `demonstrated`).
- **Dominio** = promedio de las mejores-N evidencias (recientes), modulado por dificultad → sube **en vivo**.
- **Confianza** sube con n y recencia; una competencia no es `demonstrated` sin confianza mínima (evita falsos positivos).

---

## 5. Transiciones y sus desencadenantes

| Desde | Evento/señal | Hacia | Quién decide |
|---|---|---|---|
| FEEDBACK correcto | dominio < objetivo | siguiente Momento (Practicar) | Motor |
| FEEDBACK correcto | dominio ≥ objetivo + confianza | Reto (Dominar) | Motor |
| FEEDBACK incorrecto | 1er error | retry con pista | Momento |
| FEEDBACK incorrecto | 2º error mismo concepto | Valeria + retry andamiado | Valeria/Motor |
| ENGAGED | idle prolongado | micro-nudge / cambiar modalidad | Motor |
| cualquiera | racha + `DNA.pace` alto | saltar redundancia, ofrecer reto | Motor |
| cualquiera | `RetentionState.due` | insertar repaso espaciado | Scheduler |
| cualquiera | estudiante explora | Modo Exploración (§7) | Estudiante |
| Dominar superado | evidencia suficiente | Celebración + agendar repaso | Motor |

---

## 6. Reglas de adaptación (concretas)

El recorrido **no es lineal**. Casos y respuesta del sistema:

| El estudiante… | La experiencia… |
|---|---|
| **Falla varias veces** | baja dificultad, inserta *Comprender* extra, Valeria explica el proceso, retry andamiado |
| **Aprende muy rápido** | salta práctica redundante, ofrece un *Reto* de mayor nivel |
| **Se distrae** | micro-nudge cálido, acorta el bloque, cambia de modalidad (de leer a interactuar) |
| **No comprende** | **cambia el ejemplo** (no repite el mismo), activa conocimiento previo |
| **Sobresale** | propone un *Proyecto*/aplicación creativa |
| **Necesita más ejemplos** | Valeria genera variantes al vuelo |
| **Ya domina (grafo)** | **test-out:** un reto corto; si lo pasa, salta la experiencia y registra evidencia |
| **Olvidó (Timeline)** | reintroduce la competencia como repaso, entrelazada con lo nuevo |

Todo lo "caro" (variante/explicación) se genera **bajo demanda** vía Valeria/`apd-ai`.

---

## 7. Modo Exploración (curiosidad y autonomía)

El estudiante puede **desviarse del camino del Motor** en cualquier momento:
- **Explorar el grafo:** tocar una competencia vecina y ver de qué trata ("¿y esto qué es?").
- **Preguntar a Valeria** por iniciativa propia (aquí sí responde a demanda, brevemente).
- **Curiosear** contenido de descubrimiento **sin evaluación ni penalización**.
- **Efecto en el Núcleo:** la exploración **sube `DNA.curiosity`** y puede **reorientar** la ruta hacia el
  interés detectado. Se registra `LearningEpisode(explored)`. La curiosidad se **premia con más autonomía**,
  nunca se corrige.

---

## 8. Experiencias colaborativas (aprendizaje social)

Ciudadanas de primera clase (Edusyn es escolar):
- **Misión en pareja/grupo:** co-construir una respuesta, enseñarse mutuamente (el que explica aprende doble).
- **Evidencia compartida:** `CollaborationEvidence(studentIds[], competencyId, contribution)` → alimenta el
  Núcleo de cada participante según su aporte.
- **Cultura del aula** (definida por el docente): competitiva vs. cooperativa, qué se celebra.
- **Equidad:** progreso privado por defecto; la comparación es opt-in; sin rankings que humillen.

---

## 9. Diseño emocional por momento (resumen operativo)

| Momento | Señal visual/interacción | Emoción |
|---|---|---|
| Descubrir | narrativa + personaje + misterio; medidor de dominio parcial ("ya sabes algo") | Curiosidad |
| Comprender | lectura inmersiva, calma, acento de habilidad | Claridad |
| Practicar | el medidor **sube en vivo** con cada acierto | Competencia |
| Equivocarse | Valeria crece inline, cálida, específica; sin rojo agresivo | Seguridad |
| Explorar | libertad, sin evaluación | Descubrimiento |
| Reflexionar | serif, lienzo sereno | Consciencia |
| Dominar | canvas se oscurece, ◆ en el riel, sin pistas | Tensión buena |
| Celebración | can-do desbloqueado + vecino del grafo; confeti | Orgullo |

---

## 10. La Superficie Viva (consecuencia de todo lo anterior)

- **No hay "1/11".** Hay un **Journey Rail** de momentos nombrados que **se adapta** (si el Motor inserta refuerzo,
  aparece un nodo → el estudiante ve que el camino le respondió).
- **El héroe permanente** es el **medidor de dominio** de la competencia (sube en vivo).
- **Valeria** es presencia ambiental que crece inline y se repliega — nunca una ventana.
- **Un acento por pantalla**, color = significado (habilidad + feedback + dominio). Canvas neutro; el fondo calla.
- **Cada Momento morfa el escenario** (leer ≠ decidir ≠ crear ≠ reflexionar) dentro de un mismo Design System.
- **Máquina de estados (§2)** por Momento → consistencia e imposibilidad de estados rotos (input siempre presente
  cuando el acto lo requiere).

> El resultado: el estudiante no siente que "usa una plataforma". Siente que **avanza en una misión donde su mente
> crece a la vista, alguien lo acompaña justo cuando tropieza, y lo que logra queda en su historia.**
