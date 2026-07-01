# Edusyn — Documento Fundacional de Producto (Visión 2030)

> Documento de Chief Product Officer. No es un rediseño ni una especificación técnica.
> Es la **constitución del producto**: la referencia con la que se juzga toda decisión futura.
> Si una propuesta contradice este documento, la propuesta cede — o cambiamos el documento a conciencia.
> Versión 2.0 · Estado: fundacional · Complementa (y trasciende) `docs/REDISENO_AULA_VIRTUAL_2026.md`.
> Cambios v2.0: se añade el **Transformation Design** (§3), el **Sistema Operativo Educativo por capas** (§6), dos principios-faro nuevos (§11) y se anticipa **The Edusyn Experience Bible** (§14).

---

## 0. La tesis en una frase

**Edusyn no administra actividades. Acompaña procesos de aprendizaje, gobernados por competencias, con una IA que piensa como un docente de la institución.**

Pero hay una verdad más profunda detrás de esa tesis, y es la que de verdad mueve a la empresa:

### Lo que Edusyn vende no es software. Vende transformación.

Los productos que marcan época no venden funciones, venden un cambio en quién eres:
- Duolingo no vende ejercicios → vende *"aprende un idioma"*.
- Notion no vende bloques → vende *"organiza tu mente"*.
- GitHub no vende repositorios → vende *"construye software"*.

**Edusyn no vende un LMS, ni IA, ni rutas, ni actividades. Edusyn transforma docentes.** Toma a un docente desorganizado, intuitivo y sobrecargado, y lo convierte —con el tiempo— en un docente extraordinario que enseña con evidencia, acompaña a cada estudiante y se vuelve referente. Ese viaje de transformación (§3) es el centro absoluto del producto. Todo módulo, toda pantalla, toda decisión de Valeria existe para empujar ese viaje un paso más.

### Las tres estrellas polares
1. **Edusyn acompaña procesos, no administra tareas.**
2. **Ningún dato termina en un número; todo dato termina en una acción.**
3. **Ningún estudiante debería perderse sin que Edusyn lo note primero.**

Todo lo demás en este documento se deriva de estas frases.

---

## 1. El error que vamos a corregir: el producto piensa en "actividades"

Hoy el átomo de Edusyn es la **actividad** (`ClassroomActivity`). Eso convierte al producto en un *administrador de tareas con nota*. Pero ni el docente ni el estudiante piensan en tareas:

- El **docente** piensa en un proceso: *introduzco → enseño → practico → discuto → retroalimento → evalúo → reflexiono → la competencia queda dominada → sigo*.
- El **estudiante** piensa en una meta: *¿qué estoy aprendiendo, qué me falta, voy bien?*

Una lista de actividades no representa ninguno de los dos. Es un contenedor administrativo que heredamos de Google Classroom y Moodle. **Lo vamos a jubilar como concepto central.**

### Decisión fundacional #1
> El átomo de Edusyn deja de ser la *actividad*. El átomo es la **competencia**. La unidad de trabajo es el **Learning Journey** (Ruta de Aprendizaje). Las actividades, lecciones, quizzes y simulacros dejan de ser objetos de primer nivel: pasan a ser **pasos** (eventos de aprendizaje) dentro de una ruta, conectados a una competencia.

Esto no es semántica. Cambia el modelo mental, la navegación, la analítica y el papel de la IA. Una actividad suelta no sabe a dónde pertenece. Un paso dentro de una ruta sabe de dónde viene el estudiante, hacia qué competencia va, y qué sigue si la domina o si falla.

---

## 2. La esencia: ¿qué hace único a Edusyn?

Si mañana desaparecieran Classroom, Canvas, Moodle, Schoology y todas las demás, y solo sobreviviera Edusyn, esto es lo que la haría irremplazable:

### Edusyn es la única plataforma donde la **identidad pedagógica de la institución es computable**, y una IA que **piensa como docente de esa institución** cierra el círculo entre lo que se enseña, lo que se aprende y lo que hay que hacer después.

1. **El PEI, el modelo pedagógico, el currículo, las mallas, los DBA y los resultados Saber dejan de ser PDFs muertos** y se vuelven el cerebro contextual de la plataforma. Classroom no sabe qué es un DBA; Canvas no entiende la promoción colombiana; Moodle no conoce tu PEI.
2. **El bucle se cierra.** La mayoría de plataformas se detienen en "el estudiante entregó". Edusyn convierte cada dato en la **siguiente acción pedagógica**: detecta el vacío, propone el refuerzo, genera el material, mide la mejora.
3. **Valeria no es un asistente: es un colega que conoce tu institución.**

Esa es la esencia. No es "tiene IA" (todos la tendrán). Es **"la IA piensa dentro de tu institución, nunca te deja solo con un dato, y te transforma como docente con el tiempo"**.

### Decisión fundacional #2
> El diferenciador de Edusyn no es una funcionalidad: es una **postura**. Ningún dato termina en un número. Todo dato termina en una recomendación de qué hacer. Edusyn es proactiva por diseño.

---

## 3. Transformation Design — el viaje del docente (el corazón del producto)

Esta es la pregunta más importante de todo el documento: **¿cómo evoluciona un docente desde que entra por primera vez a Edusyn hasta convertirse en un docente extraordinario gracias a Edusyn?**

No vendemos funciones; vendemos este viaje. Cada función debe poder señalar en qué etapa del viaje ayuda. Si no empuja a un docente de una etapa a la siguiente, sobra.

### 3.1 Las seis etapas de la transformación docente

```
 DÍA 1        MES 1        MES 3         MES 6          AÑO 1          AÑO 3-5
 ──────────────────────────────────────────────────────────────────────────────▶
 CAOS    →   ORDEN    →   TIEMPO    →   MAESTRÍA  →   EVIDENCIA   →   LIDERAZGO
 (disperso)  (organizado) (liberado)   (enseña      (decide con     (referente
                                        distinto)     datos)          institucional)
```

| Etapa | Dónde está el docente | Qué hace Edusyn | Emoción objetivo |
|---|---|---|---|
| **Día 1 · Caos** | Archivos sueltos: PDF, WhatsApp, Word, Excel, cuadernos, notas. Todo separado. | **Workspace** acoge y ordena su mundo sin pedirle que cambie de golpe. "Trae lo que tienes." | Alivio ("por fin un lugar") |
| **Mes 1 · Orden** | Empieza a crear clases dentro de Edusyn. | **Valeria** ayuda a planear, sugiere, estructura. El docente deja de empezar de cero. | Acompañamiento ("no estoy solo") |
| **Mes 3 · Tiempo** | Usa la IA para preparar quizzes, lecciones, retroalimentaciones, reportes. | Edusyn le **devuelve horas**. El trabajo operativo se desploma. | Liberación ("recuperé mi tiempo") |
| **Mes 6 · Maestría** | Ya no solo usa herramientas: **enseña diferente**. Más participación, más aprendizaje. | Las rutas, las lecciones vivas y el feedback inmediato cambian su práctica. | Orgullo ("mis clases mejoraron") |
| **Año 1 · Evidencia** | Toma decisiones basadas en datos, no en intuición. | La **analítica** y Valeria le muestran qué funciona y qué no, por competencia y por estudiante. | Confianza ("sé por qué hago lo que hago") |
| **Año 3–5 · Liderazgo** | Comparte rutas, mentoriza, marca el estándar institucional. | Edusyn le da la **plataforma para multiplicarse**: compartir, mentorizar, influir. | Trascendencia ("dejo huella") |

### 3.2 La meta final

> **Año 5: Edusyn ya no es una plataforma que el docente usa. Es parte de su forma de enseñar.** Cuando una herramienta deja de sentirse como herramienta y se vuelve identidad profesional, ganamos. Esa es la verdadera retención: no la del login diario, sino la del docente que no sabría enseñar de otra forma.

### Decisión fundacional #3
> Cada función se diseña preguntando: **¿en qué etapa del viaje del docente interviene, y a qué etapa lo empuja?** Una función que no mueve a nadie de etapa es decoración. El roadmap (§12) y la métrica norte (§13) se ordenan alrededor de este viaje.

### 3.3 Diseñar para "no abrumar en el Día 1"
El mayor riesgo del Transformation Design es mostrar el Año 3 en el Día 1 y espantar al docente. Por eso Edusyn **revela complejidad progresivamente**: el Día 1 solo ve "trae tus archivos y organízate"; las rutas, la analítica y la IA proactiva aparecen cuando ya hay terreno ganado. La plataforma crece con el docente, no contra él.

---

## 4. Valeria — de chatbot a copiloto pedagógico

Hoy Valeria es **reactiva**: espera una pregunta. Eso es el 10% de su potencial. Un copiloto verdadero es **proactivo, contextual y con memoria**.

### 4.1 Los cuatro verbos de Valeria

| Verbo | Qué significa | Ejemplo |
|---|---|---|
| **Observa** | Vigila datos en segundo plano sin que se lo pidan | "El 68% del curso falló en proporcionalidad" |
| **Conecta** | Cruza información de módulos distintos | "Juan baja en notas *y* subió sus ausencias hace 3 semanas" |
| **Propone** | Convierte la observación en una acción lista | "Te preparé una clase de refuerzo, ¿la publico?" |
| **Acompaña** | Recuerda el hilo y da seguimiento | "El refuerzo subió el promedio a 74%, ¿seguimos?" |

### 4.2 De respuestas a iniciativas

Valeria **genera tarjetas de iniciativa** (no espera el chat):

```
┌─ Valeria · Iniciativa ───────────────────────────────────┐
│ 🔍 Detecté que tu última evaluación de 8°B mide solo      │
│    memoria (nivel Bloom: recordar).                       │
│    El PEI de tu institución prioriza pensamiento crítico. │
│                                                           │
│    Puedo transformarla en una evaluación de análisis,     │
│    manteniendo los mismos temas.                          │
│         [ Ver propuesta ]   [ Ahora no ]   [ Descartar ]  │
└───────────────────────────────────────────────────────────┘
```

### 4.3 El motor de proactividad

```
EVENTOS (entregas, notas, asistencia, simulacros, tiempo)
        │
        ▼
   OBSERVADORES  ── detectan patrones ──▶ "vacío de competencia",
   (segundo plano)                        "evaluación de bajo nivel Bloom",
        │                                 "estudiante en declive",
        ▼                                 "competencia sin evaluar en N semanas"
   JUICIO PEDAGÓGICO (¿esto importa para ESTA institución? usa PEI/modelo)
        │
        ▼
   INICIATIVA (genera la acción lista) ──▶ tarjeta para el docente
```

### Decisión fundacional #4
> Valeria nunca actúa sola sobre datos críticos (notas, promoción). **Propone, el humano decide.** La IA tiene iniciativa; el docente tiene autoridad. Este límite es sagrado y protege la confianza.

---

## 5. Inteligencia Institucional — la IA que piensa como docente del colegio

Para que Valeria razone como docente de *tu* institución necesita un **cerebro institucional**: memoria estructurada de la identidad pedagógica del colegio.

### 5.1 Las tres capas de memoria

```
┌──────────────────────────────────────────────────────────────┐
│ MEMORIA 1 · IDENTIDAD INSTITUCIONAL (lo que el colegio ES)    │
│   PEI · modelo pedagógico · enfoque evaluativo · currículo ·  │
│   mallas · proyectos transversales · rúbricas                 │
│   → cambia poco · define el "cómo enseñamos aquí"            │
├──────────────────────────────────────────────────────────────┤
│ MEMORIA 2 · MARCO ACADÉMICO (lo que se debe lograr)         │
│   DBA · estándares MEN · competencias Saber/ICFES ·          │
│   escalas de desempeño · calendario · periodos                │
├──────────────────────────────────────────────────────────────┤
│ MEMORIA 3 · MEMORIA VIVA (lo que está pasando)              │
│   historial del estudiante y del grupo · estilo evaluativo    │
│   del docente · fortalezas/debilidades · apoyos · resultados  │
│   → cambia a diario · define el "dónde estamos hoy"         │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
        Valeria razona SIEMPRE con las tres a la vez.
```

### 5.2 Cómo se construye (conceptual)
- **Identidad y Marco** se cargan una vez (el colegio sube su PEI, currículo, mallas) y se estructuran como conocimiento consultable que la IA puede **citar textualmente**.
- **Memoria viva** se alimenta automáticamente de los eventos que ya genera la plataforma.

### Decisión fundacional #5
> Toda recomendación de Valeria debe ser **explicable y citable**: debe poder mostrar de qué identidad institucional, de qué marco académico y de qué memoria viva nace. Una IA que no justifica por qué propone algo no se usa en educación.

### 5.3 Un solo cerebro (corrige el hallazgo técnico)
Hoy EdusynPlay usa el LLM real y Classroom genera lecciones con plantillas locales — dos IA que se sienten distintas. En la visión 2030 hay **un solo cerebro pedagógico** que alimenta a todo el ecosistema. Que Play y Classroom usen motores distintos no es un detalle técnico: es una traición a la esencia "una sola inteligencia". Se unifica.

---

## 6. Arquitectura conceptual: el Sistema Operativo Educativo

Dejamos de hablar de **módulos**. Empezamos a hablar de **capas**. Un LMS es una caja de funciones; un sistema operativo educativo es una pila de capas donde cada una habilita a la siguiente. Ese cambio de lenguaje cambia lo que somos.

### 6.1 Las 8 capas del SO Educativo

```
╔══════════════════════════════════════════════════════════════╗
║  CAPA 8 · MEJORA CONTINUA                                     ║
║     el sistema aprende de sí mismo y se ajusta solo          ║
╠══════════════════════════════════════════════════════════════╣
║  CAPA 7 · ANALÍTICA      → todo dato se vuelve información    ║
╠══════════════════════════════════════════════════════════════╣
║  CAPA 6 · EVALUACIÓN     → mide competencia, no memoria       ║
╠══════════════════════════════════════════════════════════════╣
║  CAPA 5 · EXPERIENCIAS   → Classroom, Lecciones, Play, ICFES  ║
║                            (rutas que se viven)               ║
╠══════════════════════════════════════════════════════════════╣
║  CAPA 4 · PLANEACIÓN     → diseño de rutas (Workspace)        ║
╠══════════════════════════════════════════════════════════════╣
║  CAPA 3 · INTELIGENCIA   → Valeria + cerebro institucional    ║
║                            (atraviesa todas las capas)        ║
╠══════════════════════════════════════════════════════════════╣
║  CAPA 2 · PERSONAS       → docente, estudiante, coord., rector,║
║                            familia (roles y relaciones)       ║
╠══════════════════════════════════════════════════════════════╣
║  CAPA 1 · IDENTIDAD INSTITUCIONAL → PEI, modelo, currículo    ║
║                            (el suelo sobre el que todo corre) ║
╚══════════════════════════════════════════════════════════════╝
```

La lectura es de abajo hacia arriba: **la Identidad** es el suelo; sobre ella viven **las Personas**; la **Inteligencia** las atraviesa todas; encima se **Planea**, se vive la **Experiencia**, se **Evalúa**, se **Analiza**, y todo retroalimenta la **Mejora Continua**, que vuelve a bajar a la Identidad. No es una lista de productos: es un sistema operativo.

### 6.2 El círculo que recorre las capas (la dinámica)

Las capas son la estática; el círculo es la dinámica. Es el latido del SO:

```
            Cerebro Institucional + Valeria (Capa 1+3, el núcleo)
                              │
   ┌──────────┬──────────┬───┴──────┬───────────┬──────────┐
   ▼          ▼          ▼          ▼           ▼          ▼
PLANEAR → ENSEÑAR → APRENDER → EVALUAR → COMPRENDER → ACTUAR
(Workspace)(Classroom)(Lecciones (Evaluac.)(Analítica) (Valeria
            +Play)    +ICFES)                            propone) ──┐
   ▲                                                                │
   └────────────────── se cierra el círculo ◀───────────────────────┘
                    (sobre el GRAFO DE COMPETENCIAS)
```

**La columna vertebral es el Grafo de Competencias.** Cada lección, quiz, proyecto y simulacro se engancha a competencias. Por eso la analítica puede decir *"domina X pero no Y"* y Valeria puede proponer el siguiente paso exacto. Sin esa columna, todo vuelve a ser una lista.

---

## 7. Los módulos, reimaginados (dentro de las capas)

No mejoro lo existente: redefino el rol de cada pieza dentro del SO.

### 7.1 Workspace → **El Cockpit Docente** (Capa 4 · Planeación)
Centro operativo de todo: planeaciones, banco de preguntas, material, investigaciones, ideas, proyectos, evaluaciones, observaciones, recursos e IA — **conectado por competencia y por ruta, no por carpetas**. Es el *back-of-house* del docente; Classroom es el *front-of-house* del estudiante. Misma realidad, dos proyecciones. **Y es el primer hogar del docente en el Día 1 del viaje (§3).**

### 7.2 Classroom → **Recorridos de Aprendizaje** (Capa 5 · Experiencias)
Deja de ser lista cronológica. Es el **mapa visual de la ruta**:

```
 UNIDAD 2 · Proporcionalidad                          ▓▓▓▓░░ 62% dominado
  ●━━━━━●━━━━━○┄┄┄┄┄○ ┄┄┄┄ ○ ┄┄┄┄ ◇
  Intro Lección Mini  Discu-  Quiz   Proyecto → 🎯 Competencia
        IA      activ. sión          + Evaluación   alcanzada
  ✔     ✔      ⏳     🔒      🔒       🔒
        └─ estás aquí
```

La "actividad" desaparece como concepto visible: se llama "paso" y siempre pertenece a una ruta.

### 7.3 Lecciones → **Experiencia continua tipo Notion** (Capa 5)
Muere el editor de diapositivas. Nace un **lienzo de bloques mezclables**: texto, video, simulación, pregunta, discusión, actividad, "Valeria explica", checkpoint, proyecto, retroalimentación — en flujo continuo, adaptativo (fallas → bloque de refuerzo; dominas → saltas).

### 7.4 Evaluaciones → **Medición de competencia** (Capa 6)
Enganchadas a competencias y niveles de Bloom. La nota es subproducto; el producto es *qué competencia quedó demostrada*.

### 7.5 EdusynPlay → **Motor de motivación y práctica** (Capa 5)
Se queda y se integra: comparte el cerebro único y el grafo. Lo que se practica en Play cuenta para el dominio en la ruta.

### 7.6 Simulacros ICFES → **Entrenador personal** (Capa 5+7, ver §9).

### 7.7 ¿Qué desaparece o se fusiona?
- **Desaparece como concepto:** la "lista de actividades" y la actividad suelta → se absorben en Rutas/pasos.
- **Se fusionan:** los dos motores de IA (Play y Classroom) en **un solo cerebro**.
- **Se unifican como dos caras:** Workspace (docente) y Classroom (estudiante) como proyecciones de la misma ruta.

---

## 8. El estudiante — de "entregar tareas" a tener un entrenador

El estudiante debe entrar a **entrenar y verse progresar**, no a entregar. Su inicio es un coach:

```
┌──────────────────────────────────────────────────────────────┐
│  Hola, Luis 👋                              🔥 Racha: 8 días  │
│  Esta semana tienes 2 objetivos:                             │
│   ◯ Dominar "regla de tres" (vas 60%)                        │
│   ◯ Terminar tu proyecto de Lengua                           │
│  📈 Subiste 12 puntos en Matemáticas este periodo.           │
│  🤖 Valeria notó que mejoraste en resolución de problemas.   │
│  💡 Te recomiendo reforzar comprensión lectora.              │
│  🎯 Tu probabilidad de mejorar el puntaje Saber subió +9%.   │
│           [ Continuar mi ruta → ]                            │
└──────────────────────────────────────────────────────────────┘
```

### Decisión fundacional #6
> Para el estudiante, el aprendizaje **siempre** se representa como progreso hacia el dominio, nunca solo como una calificación. La nota es privada y secundaria; el avance es protagonista.

---

## 9. Simulacros ICFES — el entrenador personal

No es un examen: es un ciclo de entrenamiento que nunca termina en una nota.

```
  Simulacro ─▶ Diagnóstico ─▶ Explicación de errores ─▶ Microlecciones
      ▲                                                       │
      │                                                       ▼
  Siguiente simulacro  ◀── Nuevos ejercicios ◀── Refuerzo dirigido
  (autogenerado)                                  por competencia débil
```

Tras cada simulacro Valeria identifica fortalezas y debilidades, **explica por qué** fallaste, crea microlecciones y ejercicios para tus vacíos, estima tu puntaje ICFES y su evolución, calcula tu probabilidad de mejora, y **construye automáticamente el siguiente simulacro** sobre tus debilidades. El estudiante entrena como un atleta con coach.

---

## 10. Experiencias por rol — productos distintos, no botones distintos

| Rol | Pregunta central | Su Edusyn es… |
|---|---|---|
| **Docente** | "¿Cómo logro que aprendan?" | Un cockpit de diseño de rutas + copiloto que le quita lo operativo |
| **Estudiante** | "¿Qué tan lejos he llegado?" | Un entrenador personal con ruta, racha y dirección |
| **Coordinador** | "¿Cómo va el aprendizaje en mis grados?" | Un radar de competencias por grupo, con alertas tempranas |
| **Rector** | "¿Cómo va la institución y su PEI?" | Un tablero estratégico: Saber/ICFES, alineación con el PEI, salud académica |
| **Familias** | "¿Cómo va mi hijo y cómo ayudo?" | Una ventana de progreso + recomendaciones accionables en casa |
| **Valeria** | (transversal) | El hilo que conecta todas las anteriores |

### Decisión fundacional #7
> No construimos "una plataforma con roles". Construimos **experiencias distintas sobre un mismo cerebro**. La cohesión la garantiza el grafo de competencias y Valeria, no una UI compartida.

---

## 11. Principios del producto (la constitución)

Inviolables. Cualquier feature que rompa uno, no se construye.

1. **Edusyn organiza procesos, no tareas.**
2. **Ningún dato muere en un número.** Todo dato se convierte en una recomendación de qué hacer.
3. **🌟 Ningún estudiante se pierde sin que Edusyn lo note primero.** Este es el principio-faro: resume toda la IA, toda la analítica, toda la institución. Le da propósito a cada capa — Workspace planea mejor, Classroom acompaña mejor, Lecciones explica mejor, Evaluaciones mide mejor, Analítica detecta mejor, Valeria actúa antes. Todo conduce a que ningún estudiante caiga en silencio.
4. **🌟 Edusyn transforma docentes.** Cada función debe empujar al docente en su viaje (§3), del caos al liderazgo. No vendemos herramientas: vendemos en quién se convierte el docente.
5. **La IA propone antes de que se lo pidan.** Proactividad por defecto.
6. **La IA propone, el humano decide.** Jamás autoridad de la máquina sobre notas, promoción o juicios sobre personas.
7. **Todo lo que la IA recomienda, lo puede justificar** (explicable y citable).
8. **El aprendizaje siempre se ve como progreso.** Para el estudiante, dirección antes que calificación.
9. **Todo módulo se siente parte del mismo organismo.** Una sola voz (Valeria), un solo cerebro, un solo grafo.
10. **Cada pantalla ayuda a tomar una decisión.** Si no mueve a una acción, sobra.
11. **La institución es el contexto, no el decorado.** El PEI se respeta y se cita; Edusyn se adapta al colegio.
12. **La complejidad se revela progresivamente.** La plataforma crece con el docente, nunca lo abruma en el Día 1.

---

## 12. Roadmap — de hoy a líder en cinco años

Ordenado alrededor del **viaje del docente (§3)** y de las **capas (§6)**. Cada fase entrega una *experiencia*, no solo tecnología.

### Visión inmediata (0–3 meses) · etapa "Caos → Orden"
- **Unificar el cerebro de IA** (un motor para Play y Classroom; cablear Lecciones a IA real). Corrige el problema raíz ya detectado.
- **Estado y progreso visibles** (quick wins de `REDISENO_AULA_VIRTUAL_2026.md`).
- **Valeria da su primer paso proactivo** (2–3 iniciativas de alto valor).
- *Le entrega al docente:* alivio y orden. *Al estudiante:* progreso visible. *A la IA:* una sola voz.

### Visión a 1 año · etapa "Orden → Tiempo → Maestría"
- **Grafo de Competencias** como columna vertebral.
- **Classroom como Recorrido de Aprendizaje** (mapa visual).
- **Cerebro Institucional v1** (cargar PEI/currículo/DBA, Valeria los cita).
- **Estudiante-entrenador v1**.
- *Le entrega al docente:* tiempo recuperado y una nueva forma de enseñar.

### Visión a 3 años · etapa "Maestría → Evidencia"
- **Lecciones tipo Notion** (lienzo continuo, adaptativo).
- **ICFES como entrenador personal** con bucle cerrado.
- **Valeria copiloto pleno** (observa-conecta-propone-acompaña con memoria viva).
- **Experiencias por rol** (coordinador, rector, familias).
- *Le entrega al docente:* decisiones con evidencia, no intuición.

### Visión a 5 años · etapa "Evidencia → Liderazgo"
- **Predicción y prevención**: anticipar rezago y deserción antes de que ocurran.
- **Personalización a escala**: cada estudiante con su ruta adaptativa, sostenible porque la IA carga lo operativo.
- **Compartir y mentorizar**: el docente referente multiplica sus rutas y estrategias.
- **Edusyn como estándar LATAM**: el SO Educativo de la región.
- *Le entrega al docente:* trascendencia — Edusyn ya es parte de su forma de enseñar.

---

## 13. Métrica Norte y preguntas fundacionales

### 13.1 La Métrica Norte
No es DAU ni clases creadas. Es: **número de docentes que avanzaron de etapa en su viaje de transformación (§3) este trimestre.** Y como contrapeso de misión: **número de estudiantes en riesgo detectados *a tiempo* por Edusyn antes de fracasar.** Esas dos cifras miden si cumplimos las estrellas polares.

### 13.2 Las preguntas fundacionales, respondidas
- **¿Qué significa enseñar con Edusyn?** Diseñar rutas hacia competencias con un copiloto que se anticipa y te devuelve tiempo para lo humano — y, en el camino, volverte mejor docente.
- **¿Qué significa aprender con Edusyn?** Avanzar por un camino visible hacia el dominio, con un entrenador que te explica los errores y siempre te dice el siguiente paso.
- **¿Cuál es el papel de la IA?** Tejido conectivo proactivo que observa, conecta, propone y acompaña — pensando como docente de *tu* institución, nunca decidiendo por el humano.
- **¿Cómo se conectan los módulos?** No son módulos: son 8 capas de un SO Educativo, recorridas por un círculo sobre el grafo de competencias.
- **¿Qué experiencia queremos construir?** Que docentes, estudiantes y directivos sientan que Edusyn no los administra: los acompaña, los entiende, los transforma y nunca los deja solos con un dato.
- **¿Qué principios no debemos romper?** Los doce del §11, en especial las tres estrellas polares.

---

## 14. El siguiente documento: *The Edusyn Experience Bible*

Este manifiesto define **qué** es Edusyn y **por qué**. Falta un documento hermano que defina **cómo se siente**. No hablaría de software: hablaría de experiencia y emoción. Sería la guía que asegure que cualquier función futura tenga la misma alma.

Respondería preguntas como:
- ¿Cómo debe **sentirse** un docente la primera vez que entra (Día 1 del viaje)?
- ¿Qué emoción debe generar **terminar una planeación**? ¿Y completar una ruta, para el estudiante?
- ¿Cómo debe intervenir Valeria para ayudar **sin resultar invasiva**? ¿Cuándo celebra un logro y cuándo **guarda silencio**?
- ¿Cuál es la **voz y el tono** de Edusyn? ¿Cómo habla cuando algo sale bien, cuando un estudiante está en riesgo, cuando el docente se equivoca?
- ¿Qué principios de **lenguaje, diseño, microinteracción y pedagogía** nunca se rompen?

Definiría la **personalidad completa de Edusyn**: su voz, su tono, su comportamiento, sus microinteracciones y la experiencia emocional que transmite. Es el equivalente educativo de una *brand & interaction bible*. Cuando exista, ningún diseñador o desarrollador podrá inventar una interacción que "no suene a Edusyn".

> Recomendación: este es el **próximo documento fundacional** a escribir, una vez validada esta visión.

---

## 15. Cómo se usa este documento
- Toda iniciativa nueva debe responder: *¿a qué principio del §11 sirve? ¿en qué capa del §6 vive? ¿en qué etapa del viaje del docente (§3) interviene? ¿acerca a las estrellas polares del §0?*
- Si una propuesta solo "agrega una función" sin servir a la transformación, se rechaza o se rediseña.
- Es un documento vivo, pero se cambia **a conciencia**: modificar la tesis, una estrella polar o un principio es decisión de fundadores, no ajuste de sprint.

> **La estrella polar:** *Edusyn no administra el aprendizaje. Lo acompaña — y transforma a quienes enseñan.*

---
---

# ANEXO A · Crítica adversarial de la Visión (Red Team CPO)

> Propósito: este anexo NO confirma la visión; intenta romperla. Es la auditoría de un CPO cuya responsabilidad es evitar que la empresa pierda diez años siguiendo una visión equivocada.
> Regla de lectura: cuando el cuerpo del documento (§0–§15) y este anexo se contradigan, **el anexo gana hasta que una decisión de fundadores resuelva la tensión**. Las debilidades aquí listadas son deuda de visión pendiente, no opiniones.
> Veredicto de madurez: **~55–60%** como Constitución (≈90% como narrativa de Visión). Inspira magníficamente y decide poco sobre lo que mata empresas.

## A.0. El riesgo no listado y más grave: capacidad de ejecución
El documento describe lo que a Notion le tomó ~200 ingenieros y a Canvas una década, y lo escribe un equipo muy pequeño. Una constitución que exige un Sistema Operativo Educativo sin una sola línea de **Non-Goals** no es una visión: autoriza dispersarse y no ser excelente en nada. *Consecuencia a 5 años:* producto ancho y poco profundo, copiable en cada vertical por alguien enfocado. **Recomendación:** la constitución necesita una sección de **Non-Goals** y un **wedge** explícito. Una visión sin restricción no protege; autoriza.

## A.1. Vacíos estratégicos (lo nunca respondido)
- **¿Quién paga?** El doc es 100% usuario (docente/estudiante), 0% comprador. En K-12 LATAM firma el rector / dueño / secretaría, y a ese comprador no le importa la transformación docente: le importan Saber, cumplimiento MEN, costo y boletines a tiempo. Tesis ("vendemos transformación") y venta real (compliance + resultados) están desalineadas. *Rec.:* tesis para el comprador → *"Transformamos al docente y entregamos resultados medibles al rector — la primera produce la segunda."*
- **Economía unitaria de la IA proactiva.** "Valeria observa todo" = inferencia LLM continua por estudiante·evento. A 500k estudiantes el COGS puede superar el ingreso en colegios de bajo ARPU. *Rec.:* separar **detección barata** (heurísticas/modelos pequeños, siempre on) de **generación cara** (LLM bajo demanda). Hoy el §4.3 las mezcla.
- **Conectividad/infraestructura.** Público/rural: mala conexión, dispositivos compartidos de gama baja, luz intermitente. La experiencia continua y rica en IA asume infraestructura que ese mercado no tiene. *Offline-first / bajo ancho de banda* no se menciona. Define si el mercado direccionable es grande o diminuto.
- **Ética y datos de menores (potencialmente fatal).** "Ningún estudiante se pierde" = predicción de riesgo sobre niños → falsos positivos que etiquetan, profiling, consentimiento parental, Ley 1581 / Habeas Data. Cero líneas sobre privacidad del estudiante, sesgo o derecho a no ser perfilado. *Rec.:* principio-faro adicional → *"La predicción sobre un estudiante existe para activar ayuda humana, nunca para etiquetarlo, ordenarlo ni mostrarle un destino."* + sección de gobernanza de datos.
- **El moat real no está nombrado** (ver A.4).

## A.2. Inconsistencias internas
1. **"Plataforma/SO" vs "todo first-party".** Un OS vale porque otros construyen encima; el doc no tiene API pública, ecosistema de terceros, app store ni interoperabilidad (LTI/OneRoster/xAPI). No puedes ser OS y construir cada app tú mismo.
2. **"Ningún dato muere en un número" vs por qué te compran.** El colegio *legalmente necesita* el número (boletín, promoción, MEN). Decirle al rector que la nota es "secundaria" es suicidio de PMF. *Rec.:* *"El número es obligatorio y sagrado para la institución; nuestra diferencia es que además del número siempre entregamos la acción."* No mates el número: añádele.
3. **"Complejidad progresiva (Día 1 = organizar archivos)" vs "el átomo es la competencia".** Si el Día 1 el grafo está invisible, no se arranca justo cuando hay que poblarlo. La divulgación progresiva contradice la arquitectura competency-first.
4. **"Propone, humano decide" vs proactividad a escala.** Si Valeria es muy buena → sello sin leer (muere la salvaguarda); si no → citas peligrosas. A escala inunda → rubber-stamping o ruido. Salvaguarda y proactividad se contradicen bajo carga.

## A.3. El concepto peor resuelto: el Grafo de Competencias
Es "la columna vertebral" y el doc no responde: ¿quién lo crea? ¿por institución o canónico nacional? ¿quién lo mantiene? Si cada colegio debe poblarlo, **la adopción muere en el onboarding (cold-start).** *Rec.:* Edusyn trae **grafo canónico nacional pre-cargado** (DBA + estándares + competencias Saber, públicos y comunes) + *overlays* por institución. Eso resuelve el cold-start de fábrica y el grafo curado se vuelve activo defendible (A.4).

## A.4. El documento defiende el moat equivocado
Moat declarado: "identidad pedagógica computable + IA que piensa como docente del colegio".
- **vs OpenAI:** "computar el PEI" es RAG sobre un PDF → copiable en una tarde. Framing AI-céntrico = flanco más expuesto. **Baja (3/10).**
- **vs Google: media-baja (4/10).** No localizan, pero AI-generan.
- **vs Microsoft: media (5/10).** Distribución (Teams Ed) + Copilot; ganas por foco LATAM.
- **vs Canvas: media-alta (6.5/10).** Lento, gringo, caro; tu localización K-12 LATAM es ventaja real.
- **vs Moodle: alta en experiencia (8/10)**, pero su precio (gratis) amenaza al público sin presupuesto.

**El moat real, hoy tratado como "plomería heredada":** (1) **profundidad regulatoria/administrativa colombiana** —boletines, recuperaciones, observador, reportes MEN, promoción, escalas— que ya construiste y que nadie global localizará; (2) **dato longitudinal propietario** (único activo que compone, network effect de datos); (3) **system of record + switching cost**; (4) **grafo canónico curado**. *Rec.:* reescribir §2 → *"el sistema de registro académico de la institución colombiana + el dato longitudinal que solo nosotros acumulamos + el grafo curado, con IA encima"*. La IA es la experiencia; el moat es el registro y el dato. Hoy está al revés. **Prueba ácida:** si OpenAI saca un LMS, lo que no pueden copiar no es Valeria — es tu dato + tu integración MEN + ser ya su sistema de notas.

## A.5. Valeria: hasta dónde y dónde parar
- **Alucinación institucional:** citar mal el PEI es un evento de reputación a nivel institución. "Citable" debe ser "verificado".
- **Solo muestras el caso feliz** de la predicción. "+9% Saber" motiva; "−12%" puede ser profecía autocumplida. Valeria debe tener prohibido mostrar predicciones desmotivadoras al estudiante.
- **Dónde debe DETENERSE (no está en el doc):** nunca diagnosticar (condición de aprendizaje, salud mental, situación socioeconómica); nunca juzgar a la *persona*; nunca volverse vigilancia del docente (riesgo de deskilling/resistencia/sindical — el doc asume que el docente quiere ser transformado).
- **Capacidad que falta:** Valeria como **memoria institucional que sobrevive a la rotación docente**.
- *Rec.:* añadir una **"Carta de Límites de Valeria"**: qué nunca hace, qué nunca muestra, a quién nunca juzga.

## A.6. "Sistema Operativo Educativo": ¿real o LMS rebautizado?
Hoy es un LMS+IA con nombre aspiracional. Un OS real tiene kernel, apps de terceros, file system, permisos y **APIs para que otros construyan encima**. Las 8 capas (§6.1) son funciones de LMS apiladas y rebautizadas. **Para merecer el nombre:** API/plataforma de extensión, interoperabilidad (LTI/OneRoster/xAPI), espacio de apps de comunidad, y el grafo como "file system" común. *Rec.:* abandonar "SO Educativo" como **categoría de mercado** y reclamar una defendible —*"el sistema académico nativo-IA de las instituciones de LATAM"*—; mantener "SO" como aspiración interna a 5 años condicionada a escala. Crear categoría es el camino que más fracasa (A.11).

## A.7. Transformation Design: escalera de productividad disfrazada de transformación
Caos→Orden→Tiempo son pura eficiencia; Maestría→Evidencia→Liderazgo *afirman* transformación pero el mecanismo está en hand-wave (mejor herramienta ≠ mejor docente). **Falta:** (a) **comunidad** —no existe capa social en todo el doc; transformación sin comunidad es solo una herramienta; (b) **camino de fracaso** (meseta, recaída, abandono, docente cerca del retiro); (c) es **individualista** —falta el **viaje de transformación de la institución** (lo que importa al comprador); (d) **motivación intrínseca/sentido**. *Rec.:* añadir capa de comunidad + viaje institucional; reposicionar la **analítica de evidencia** como el motor real de transformación pedagógica, no las rutas.

## A.8. Escalabilidad (500k estudiantes / 10M actividades)
- "Valeria observa todo" = O(estudiantes×eventos) en llamadas caras → no escala económicamente.
- Grafo por institución ×100 colegios = pesadilla de gobernanza → canónico + overlays.
- "Explicable/citable" a escala = costo de verificación lineal por cada PEI.
- "Humano decide" + proactividad a escala = inundación → rubber-stamping (la arquitectura de confianza colapsa al tener éxito).
- *Rec.:* sección de "principios de escala": detección heurística siempre-on, generación bajo demanda, grafo canónico+overlays, y **presupuesto de atención del docente** (máx N iniciativas/semana priorizadas).

## A.9. Ecosistema: módulos ausentes para aspirar a "SO"
Faltan: **comunicación familia-escuela** (en LATAM el canal real es WhatsApp), **convivencia/disciplina** más allá del observador, **bienestar/orientación (psicología)**, **asistencia↔deserción**, **calendario/operación**, **contenido de terceros/editoriales**, **formación docente**, **interoperabilidad con el Estado (SIMAT)**. El doc confunde "lo académico" con "lo escolar". *Rec.:* mapear el sistema escolar completo y decidir qué entra, qué se integra y qué se ignora.

## A.10–11. Filosofía, identidad, emoción
- **Fortaleza real:** §0 y §3 inspiran y atraen talento ("ningún estudiante se pierde" es misión, no spec).
- **Debilidad:** todavía te defines **en oposición** a Classroom/Canvas/Moodle (~8 menciones) pese a haber pedido no hacerlo. Una identidad fuerte no necesita al enemigo en cada párrafo.
- **Tono:** §6.1, §7 y §10 caen a specs corporativas; la emoción se concentra al inicio y se diluye en el medio técnico.

## A.12. ¿Le basta a un PM senior? No.
Construiría algo hermoso que nadie pidió. Falta: **segmentación** (¿privado bilingüe urbano o público rural? casi dos productos), **el comprador y su ROI**, **la suposición más riesgosa a validar primero**, **métricas con línea base**, **non-goals**, **evidencia/investigación de usuario** (el doc es 100% convicción, 0% evidencia: ¿confirmaste con docentes reales que quieren ser "transformados"?), y el **plan de cold-start/onboarding**.

## A.13. Veredictos finales
- **Madurez:** ~55–60% como Constitución; ~90% como narrativa de Visión.
- **Defensibilidad:** OpenAI 3/10 · Google 4/10 · Microsoft 5/10 · Canvas 6.5/10 · Moodle 8/10 (amenaza = su precio cero). *Todas suben si el moat pivota a dato+registro+localización en vez de "IA pedagógica".*
- **Creación de categoría ("SO Educativo"):** baja-media; **no perseguirla**. Ganar una categoría existente (sistema académico nativo-IA de LATAM) es más probable que inventar una que nadie busca.
- **Próximo documento (NO la Experience Bible):** **"El Wedge y la Tesis Económica" (Beachhead + Unit Economics + Moat).** Responde las tres preguntas que matan la empresa: (1) ¿la única cosa en que seremos excelentes que nos gana el derecho a lo demás, y para qué colegio exacto? (2) ¿quién paga, cuánto, y la IA proactiva sobrevive a su COGS? (3) ¿cuál es el foso real (dato+registro+localización) y cómo se compone en el tiempo? De-riesgea las dos amenazas existenciales: capacidad de ejecución y viabilidad económica. Pulir la *Experience Bible* antes que esto sería decorar una casa sin cimientos.
