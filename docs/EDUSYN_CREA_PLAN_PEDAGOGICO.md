# Edusyn Crea — Plan pedagógico de trabajo

> Documento de metodología y hoja de ruta. Complementa el diseño ya implementado en
> `docs/EDUSYN_CREA_RECORRIDO_PEDAGOGICO.md` (4 fases, sin desplegar al 2026-09-16).
> Fecha: 2026-09-16.

## 0. La idea en una frase

Edusyn Crea no enseña a "hacer apps con IA": enseña a **resolver un problema real con una
solución digital que el equipo puede explicar, probar y mejorar**. La IA es una herramienta del
equipo, no su autora.

**Prueba de éxito (la misma para docente, estudiante y plataforma):**
> "Este era el problema, diseñamos esta solución por estas razones, probamos esto, y en la
> siguiente versión mejoraríamos aquello."

## 1. Fundamentos (por qué este flujo y no otro)

| Enfoque | Qué tomamos | Dónde se ve en Crea |
|---|---|---|
| Aprendizaje basado en problemas / proyectos (ABP) | Partir de una situación real y cercana | Fase Descubrir |
| Design Thinking | Empatizar → definir → idear → prototipar → probar | Las fases del recorrido |
| Construccionismo (Papert) | Se aprende construyendo algo que se puede mostrar | Editor + preview + versiones |
| Metodología ágil (Scrum escolar) | Ciclos cortos, versiones pequeñas, revisión frecuente | Versiones v1, v2, v3… |
| Evaluación formativa | Retroalimentación durante el proceso, no solo al final | Evidencias por versión, comentarios del docente |
| Metacognición | Pensar sobre cómo se piensa y se decide | "Qué intentamos / probamos / aprendimos" |
| DUA (Diseño Universal para el Aprendizaje) | Varias formas de participar y de expresarse | Ejemplos, roles, bocetos, trabajo en papel permitido |
| Alfabetización crítica en IA | Pedir bien, leer, verificar y decidir | Petición guiada, "explicar antes de pegar" |

**Principios de diseño que no se negocian**
1. **Problema antes que código.** Nadie pide código sin haber dicho qué problema resuelve y cómo lo comprobará.
2. **Pequeño y funcionando mejor que grande y roto.** La v1 es mínima; lo demás va a "después".
3. **Explicar antes de pegar.** Todo código que entra, el equipo lo puede ubicar y explicar.
4. **Probar con personas, no solo con el equipo.**
5. **Evidencia breve, no burocracia.** Máximo 3 preguntas por momento; lo demás lo registra la plataforma sola.
6. **Se premia el proceso, no la velocidad ni la cantidad de código.**

## 2. El flujo de trabajo: 5 etapas en ciclo

Recomiendo pasar de 4 a **5 etapas visibles**, agregando una etapa final para compartir y
reflexionar, y convirtiendo "Construir" en un **ciclo** explícito.

```
 1. DESCUBRIR ─► 2. IMAGINAR ─► 3. PLANEAR ─► 4. CONSTRUIR Y PROBAR ─► 5. COMPARTIR
   (problema)     (solución)     (versión 1)    ┌───────────────────┐     (mostrar y
                                                │ pedir → leer →    │      reflexionar)
                                                │ probar → explicar │
                                                │ → guardar versión │
                                                └──────── ↺ ────────┘
```

### Etapa 1 — Descubrir: "¿Qué está pasando?"
- **Objetivo:** entender una situación real, cercana y concreta.
- **El equipo responde** (ya implementado): qué ocurre · a quién afecta · por qué importa.
- **Se incorpora:** una **mini-investigación**: hablar con 2 o 3 personas afectadas y anotar una frase de cada una ("la voz del usuario"). Es el paso que más mejora la calidad de las soluciones y hoy no existe.
- **El docente pregunta:** "¿Cómo saben que eso pasa?", "¿A quién le preguntaron?".
- **Evidencia:** el problema en sus palabras + 2 o 3 voces de usuarios.
- **Tiempo:** 1 sesión.

### Etapa 2 — Imaginar: "¿Qué vamos a crear?"
- **Objetivo:** proponer varias ideas y escoger una con razones.
- **El equipo responde:** qué hará y cómo ayuda · quién la usará · cómo se vería.
- **Se incorpora:**
  - **Tres ideas antes de elegir una** (lluvia de ideas rápida): evita quedarse con la primera ocurrencia. Solo se guarda la elegida y el porqué.
  - **Historia de usuario** como apoyo opcional: "Como ___, quiero ___ para ___".
  - **Boceto en papel** (foto opcional en una fase futura): dibujar las pantallas antes de pedir código.
- **Se quita de esta etapa:** grado (lo conoce el aula) y estilo visual (pasa a Construir, donde tiene sentido).
- **Evidencia:** la solución elegida y su razón.

### Etapa 3 — Planear: "¿Qué hacemos primero?"
- **Objetivo:** una versión 1 mínima y una prueba concreta.
- **El equipo responde** (ya implementado): qué tendrá la v1 · qué queda para después · cómo sabremos que funciona.
- **Se incorpora:** la prueba se escribe como **criterio "si… entonces…"** ("Si escribo una tarea y pulso Agregar, entonces aparece en la lista"). Es la semilla del pensamiento de pruebas.
- **Al terminar:** aparece la petición para la IA, editable (ya implementado).
- **Tiempo:** Imaginar + Planear caben en 1 sesión.

### Etapa 4 — Construir y probar (ciclo de versiones)
Cada vuelta del ciclo es una versión. Cinco pasos cortos:

1. **Pedir.** Petición guiada: qué, por qué, qué conservar, cómo comprobarlo (ya implementado).
2. **Leer y explicar antes de pegar.** *Se incorpora:* una lista corta, "¿dónde está en el código cada punto de nuestro plan?". El equipo marca cada punto con ayuda de "Explorar elementos". Si no lo encuentra, pregunta a la IA "explícanos esta parte" antes de seguir.
3. **Probar.** Aplicar al preview, ejecutar la prueba "si… entonces…", en computador y en celular.
4. **Probar con otros** (desde la v2). *Se incorpora:* **prueba cruzada**: otro equipo usa la app durante 5 minutos y deja 3 notas: "me gustó / me confundió / te sugiero".
5. **Guardar versión con evidencia:** intentamos · probamos · aprendimos (ya implementado).

- **Roles rotativos por versión:** Coordinación, Voz del usuario (antes "Investigación"), Diseño, Desarrollo y Pruebas. En el teclado, **piloto y copiloto** que se turnan en cada versión.
- **Tiempo:** 2 a 3 sesiones (v1, v2 y, si hay tiempo, v3).

### Etapa 5 — Compartir y reflexionar *(nueva)*
- **Objetivo:** que el equipo cuente su proceso, no solo que muestre la app.
- **Muestra de 2 minutos** (feria o "demo day") con una estructura fija: problema → solución y por qué → qué probamos → qué mejoraríamos.
- **Reflexión final breve:** qué aprendí de programar · qué aprendí de trabajar con IA · qué haría diferente.
- **Autoevaluación y coevaluación** con la misma rúbrica del docente (sección 5).
- **Evidencia:** la reflexión + la versión final.
- **Tiempo:** 1 sesión.

## 3. Estructura de cada sesión (rutina fija de 3 momentos)

| Momento | Tiempo (sesión de 90') | Qué pasa | Registro |
|---|---|---|---|
| **Arranque** | 5–10' | El equipo escribe su **meta del día** en una frase ("hoy logramos que se puedan borrar tareas") | Tarjeta de meta (se incorpora) |
| **Trabajo** | 65–70' | La etapa o el ciclo de versión | Lo registra la plataforma |
| **Cierre** | 10' | **Salida**: ¿cumplimos la meta? · ¿qué nos bloquea? · ¿qué sigue? | Tarjeta de salida (se incorpora) |

Estas dos tarjetas son el "latido" del proyecto. Le dicen al docente, sin revisar código, qué
equipos avanzan y cuáles están atascados.

## 4. Temporalización sugerida (flexible)

| Formato | Sesiones | Distribución |
|---|---|---|
| **Estándar** | 6 × 90' | Descubrir · Imaginar + Planear · v1 · Prueba cruzada + v2 · v3 · Compartir |
| **Corto** | 3 × 90' | Descubrir + Imaginar · Planear + v1 · Prueba cruzada + Compartir |
| **Extendido** (periodo) | 10–12 | Igual que el estándar, con más versiones y una investigación de usuarios más profunda |

**Flexibilidad:** un equipo puede volver a cualquier etapa (ya implementado). El docente puede
habilitar la construcción sin plan para quien trabajó en papel o necesita otro ritmo (ya
implementado).

## 5. Evaluación (formativa y compatible con el SIEE / Decreto 1290)

**Rúbrica de 5 criterios** (4 niveles: Inicial · En desarrollo · Logrado · Destacado):

| Criterio | Qué se observa | Evidencia en Crea |
|---|---|---|
| 1. Comprensión del problema | Problema concreto, personas identificadas, voces de usuarios | Etapa 1 |
| 2. Solución centrada en las personas | La solución responde al problema; eligieron con razones | Etapa 2 |
| 3. Proceso iterativo | V1 pequeña, pruebas "si… entonces", mejoras por versión | Etapas 3–4, evidencias |
| 4. Comprensión del código | Ubican y explican cada parte del plan en su código | Lista "explicar antes de pegar", demo |
| 5. Colaboración y uso responsable de la IA | Roles, peticiones claras, deciden qué usar | Peticiones, bitácora, coevaluación |

- **Tres miradas:** autoevaluación (estudiante), coevaluación (equipo y prueba cruzada) y heteroevaluación (docente).
- **Qué NO se califica:** cantidad de código, velocidad, parecido a una app profesional.
- La nota final vive en la `ClassroomActivity` vinculada (ya existe el vínculo); Crea aporta las evidencias.

## 6. Uso de la IA: niveles que define el docente

El docente escoge, por proyecto, cuánto se puede apoyar el equipo en la IA:

| Nivel | Nombre | Qué se permite |
|---|---|---|
| 1 | Sin IA | El equipo escribe el código con ejemplos y plantillas |
| 2 | IA para ideas | Preguntar y pedir explicaciones, no código |
| 3 | IA guiada *(recomendado)* | Código con petición guiada y "explicar antes de pegar" |
| 4 | IA abierta | Uso libre, con la misma exigencia de explicar y probar |

**Reglas fijas en cualquier nivel:** no compartir datos personales, leer antes de pegar, y el
equipo decide. Edusyn no envía nada a la IA: el equipo copia la petición.

## 7. Gamificación con sentido (se premia pensar, no hacer clic)

**Mecánicas recomendadas**
- **Insignias de proceso** (por equipo, se ganan con evidencia real, nunca por tiempo en pantalla):
  - 🔎 *Detective del problema*: registraron 3 voces de usuarios.
  - 🎯 *Pequeño y funcionando*: v1 guardada con su prueba cumplida.
  - 🧪 *Probador*: evidencia con prueba "si… entonces" en 3 versiones.
  - 🔁 *Mejora continua*: v2 que atiende una nota de la prueba cruzada.
  - 🗣️ *Lo explicamos*: lista "explicar antes de pegar" completa.
  - 🤝 *Buen compañero*: dejaron retroalimentación útil a otro equipo.
- **Niveles del equipo:** Aprendices → Creadores → Mentores. Los "Mentores" pueden apoyar a otros equipos.
- **Retos opcionales** ("misiones") para quien va adelante: que funcione bien en celular, hacerla accesible (contraste, textos claros), agregar una pantalla de ayuda.
- **Logro colectivo del curso:** una barra común ("entre todos: 20 versiones probadas") en lugar de rankings entre equipos.
- **Narrativa:** cada equipo es un "estudio de creación" con un cliente real (las personas afectadas).

**Lo que evitamos a propósito**
- Tablas de posiciones entre equipos: desmotivan a quien va atrás y premian la velocidad.
- Puntos por cantidad de código o de versiones: incentivan pegar sin entender.
- Recompensas por usar la IA.

## 8. El papel del docente

**Tablero de acompañamiento (semáforo)** en lugar del actual "Necesita apoyo", que hoy aparece
en todo equipo sin versiones:
- 🟢 **Avanza:** cumplió la meta del día o guardó una versión.
- 🟡 **Revisar:** lleva 2 sesiones en la misma etapa o copió peticiones sin guardar versión.
- 🔴 **Apoyar ya:** pidió ayuda, marcó un bloqueo en la salida o no puede guardar la primera versión.

**Preguntas de acompañamiento por etapa** (sugeridas en pantalla, nunca como respuestas):

| Etapa | Preguntas |
|---|---|
| Descubrir | ¿Cómo saben que pasa? ¿A quién le preguntaron? |
| Imaginar | ¿Qué otras ideas tuvieron? ¿Por qué esta? |
| Planear | ¿Qué es lo mínimo para probarla mañana? |
| Construir | Muéstrenme dónde está esto en el código. ¿Cómo lo probaron? |
| Compartir | ¿Qué cambiarían si empezaran de nuevo? |

**Herramientas del docente:** comentar (ya existe), ver razonamiento (ya implementado), habilitar
excepciones (ya implementado), configurar el nivel de IA y la duración, y usar plantillas de reto.

## 9. Inclusión y flexibilidad (DUA)

- Ejemplos en cada etapa (ya implementado) y lectura en voz alta de las preguntas.
- Dictado por voz para responder (navegador).
- Boceto en papel como forma válida de pensar la solución (con la excepción docente, ya implementada).
- Roles que no exigen programar (Voz del usuario, Pruebas, Coordinación) con el mismo valor en la rúbrica.
- Equipos de 2 a 4; más de 4 diluye la participación frente a un solo teclado.

## 10. Hoja de ruta de producto (qué incorporar, qué quitar)

### Ahora — ya construido, pendiente de desplegar
- Recorrido de 4 fases, petición editable, petición de cambio guiada, evidencia por versión, razonamiento y excepción docente.

### Siguiente paso (P1) — cierra el ciclo pedagógico
1. **Etapa 5 "Compartir y reflexionar"** con guion de 2 minutos y reflexión final.
2. **Prueba cruzada entre equipos** (me gustó / me confundió / te sugiero), visible para el equipo probado y para el docente.
3. **Lista "explicar antes de pegar"**: cada punto del plan se enlaza con una parte del código usando "Explorar". Es el paso de producto que convierte "copiamos de la IA" en "entendemos nuestro código".
4. **Tarjetas de meta y de salida** por sesión.
5. **Semáforo del docente** en lugar de "Necesita apoyo".

### Después (P2) — personalización y motivación
6. Configuración del proyecto por el docente: nivel de IA, duración y etapas obligatorias u opcionales.
7. Voces de usuarios en Descubrir y tres ideas en Imaginar.
8. Insignias de proceso, niveles del equipo y logro colectivo del curso.
9. Rúbrica integrada: autoevaluación, coevaluación y paso de nota a la actividad vinculada.

### Más adelante (P3)
10. Foto del boceto en papel (con almacenamiento seguro).
11. Plantillas de reto por asignatura (Ciencias, Matemáticas, Sociales, Inglés).
12. Galería del curso para ver las apps de otros equipos (solo dentro de la institución).
13. Analítica de aprendizaje para el docente: tiempo por etapa, versiones con prueba, peticiones con criterio.

### Quitar o simplificar
- **Grado y estilo** en la fase de solución: el grado viene del aula; el estilo se decide al construir.
- **Los pasos "1. Editen · 2. Apliquen · 3. Guarden"** del encabezado del taller: repiten el recorrido. Se reemplazan por el ciclo de la etapa 4.
- **"Pantalla completa" y "Ver en grande"** hacen cosas parecidas: dejar "Pantalla completa" para el taller y "Ver en grande" solo para la app, con nombres que lo digan.
- **"Necesita apoyo"** automático para todo equipo sin versiones: genera ruido. Lo reemplaza el semáforo.

## 11. Cómo sabremos que funciona (indicadores del proceso)

| Indicador | Meta inicial |
|---|---|
| Equipos que completan Descubrir antes de pedir código | 90 % |
| Versiones guardadas con prueba "si… entonces" | 80 % |
| Equipos que ubican en su código cada punto del plan | 70 % |
| Equipos con al menos 2 versiones | 75 % |
| Estudiantes que en la demo dicen la frase de éxito completa | 70 % |
| Docentes que usan "Ver razonamiento" al menos una vez por semana | 60 % |

**Pilotaje sugerido:** un curso, formato estándar (6 sesiones), con observación del docente y una
encuesta corta a estudiantes al final. Ajustar antes de abrirlo a más instituciones.
