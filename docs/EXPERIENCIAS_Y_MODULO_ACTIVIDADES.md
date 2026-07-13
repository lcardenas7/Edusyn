# Experiencias de Aprendizaje y reorganización del módulo de actividades

> Documento de diseño (design-first). No es implementación: es el norte para reorganizar
> cómo el docente crea y el alumno consume, y para convertir las "actividades aisladas"
> en **Experiencias de Aprendizaje**. Ver visión: `docs/VISION_PRODUCTO_2030.md`,
> `docs/PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md`.

## 0. Principio rector

Edusyn no debe sentirse como un LMS (lista de actividades sueltas) sino como una
**experiencia de aprendizaje** con inicio, desarrollo y objetivo. El docente deja de
pensar "creo un Quiz" y pasa a pensar "cómo quiero que aprendan"; el alumno deja de ver
una lista inconexa y ve **un recorrido con una misión**. Ese es el diferenciador frente a
Moodle / Google Classroom / Canvas.

## 1. Hallazgo clave: la "Experiencia" YA existe como modelo

No hay que construir el concepto desde cero. En `schema.prisma` ya viven los 3 niveles:

| Nivel | Concepto | Modelo actual |
|---|---|---|
| 1 | Experiencia / Misión / Ruta | `LearningRoute` |
| 2 | Bloque de la experiencia | `LearningRouteStep` (`activityId? → ClassroomActivity`) — *"el paso ES una actividad"* |
| 3 | Config del bloque (nota, fecha, intentos, rúbrica) | `ClassroomActivity` |

**Consecuencia:** el trabajo grande es *surface + generalizar* `LearningRoute`, no rehacerlo.
Hoy `LearningRoute` está sesgado a inglés (`targetCompetencyId` CEFR, `targetLevel` "A2") y
sus pasos enlazan sobre todo Tarea/Writing inline; falta generalizarlo por asignatura y que
un paso pueda ser cualquier bloque (quiz, lección, juego, foro).

## 2. Los dos cubos (separados por costo/riesgo)

### Cubo A — Reorganización UX (frontend, sin migración) → hacer pronto

1. **Creación en 2 pasos** (¿Qué quieres crear? → categoría → tipo). Menos carga cognitiva.
2. **Filtros separados**: barra de **Tipo** y barra de **Estado** (hoy están mezclados:
   "Todas/Tareas/Quiz" con "Por calificar/Vence hoy/Borradores").
3. **Tarjetas con el tipo prominente** y datos propios de cada tipo (quiz: nº preguntas/tiempo;
   tarea: entregas/pendientes; live quiz: conectados).
4. **Vista del alumno como misiones** — 🥇 *el de mayor ROI*: "Para hoy / Próximamente /
   Completado" por **fecha + estado**, no por tipo. El alumno nunca ve "es un Quiz o un Examen";
   ve *qué tiene que hacer hoy*.

Ninguno toca backend ni el núcleo de notas.

### Cubo B — Experiencias de Aprendizaje (design-first, apalanca LearningRoute)

- **Puerta de entrada con plantillas**: "Nueva Experiencia" → plantilla (Aprender / Proyecto /
  Clase Invertida / Escape Room), cada una un esqueleto de pasos.
- **Pasos heterogéneos**: un paso puede ser explicación, video, juego, tarea, quiz, foro, lab.
  (Gap actual: los pasos solo enlazan Tarea/Writing inline.)
- **Generalización por asignatura**: converge con la deuda ya registrada de "Rutas por
  asignatura" (el framework de competencias sale de la asignatura del aula, no default CEFR).

## 3. Restricciones duras (lo que NO se debe hacer)

1. **Variantes, no tipos.** No crear enums de backend nuevos (Proyecto, Taller, Laboratorio,
   Evidencia, Diagnóstico…). Cada tipo real multiplica grading + reportes + RLS. Mantener
   **pocos tipos reales** (TASK, QUIZ, EXAM, LESSON, LIVE_QUIZ, …) y que el resto sean
   **etiquetas/plantillas** encima. Es el mismo argumento de "son variantes" aplicado al dato.
2. **El átomo de nota sigue siendo `ClassroomActivity`.** El boletín y el núcleo de notas
   (con su propia auditoría/constitución — lo más sensible del sistema) leen la nota de la
   actividad. La Experiencia **envuelve y ordena** actividades; NO puede volverse el átomo
   calificable. El modelo de 3 niveles ya lo respeta (paso → actividad).
3. **Design-first para el Cubo B.** Es fundacional y toca el núcleo; no improvisar entre commits.

## 4. Diseño UX propuesto (Cubo A, detalle)

**Creación (paso 1 — 4 categorías, no 8 tipos):**
`📄 Actividad` · `🧩 Evaluación` · `🎮 Experiencia` · `📚 Recurso`

**Creación (paso 2 — según categoría):**
- Actividad → Tarea / Proyecto / Taller / Foro (variantes = plantillas de TASK).
- Evaluación → Quiz / Examen / Live Quiz / Simulacro ICFES / Autoevaluación / Diagnóstico
  (variantes de QUIZ/EXAM).
- Experiencia → plantillas (Aprender / Proyecto / Clase Invertida / Escape Room).

**Filtros (docente):** barra Tipo (Todas/Actividades/Evaluaciones/Experiencias/Recursos) +
barra Estado (Publicadas/Programadas/Borradores/Por calificar/Finalizadas) + barra opcional
por periodo/materia.

**Vista alumno:** 🔥 Para hoy → 📅 Próximamente → ✅ Completado. Nunca 20 tarjetas mezcladas.

## 5. Plan por fases (recomendado)

- **Fase 1 (ya, barato):** vista del alumno como misiones (§4) + separar filtros Tipo/Estado.
- **Fase 2 (barato):** creación en 2 pasos + tarjetas ricas.
- **Fase 3 (design-first):** Experiencias sobre `LearningRoute` generalizado + plantillas +
  pasos heterogéneos + generalización por asignatura. Migración cuidadosa, sin tocar el átomo
  de nota.

## 6. Preguntas abiertas para el fundador

- ¿"Experiencia" reemplaza a "Lección Interactiva" o conviven? (Propuesta: la Lección
  Interactiva es *una* plantilla de Experiencia; converge con el tiempo.)
- ¿Las plantillas de Experiencia se editan como el editor de lección actual, o merecen un
  constructor de flujo (pasos) propio?
- ¿Diagnóstico y Autoevaluación son plantillas de Evaluación o merecen tratamiento aparte
  (no cuentan para el boletín)?
