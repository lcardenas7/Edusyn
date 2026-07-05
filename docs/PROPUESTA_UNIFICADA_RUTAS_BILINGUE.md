# El Aula que Escucha — Rutas de Aprendizaje + Motor de Idiomas como wedge de Edusyn

> **Propuesta unificada.** Integra en una sola tesis dos documentos que hasta ahora vivían separados:
> - `VISION_PRODUCTO_2030.md` — la transformación del Aula Virtual de "lista de actividades" a **Rutas de Aprendizaje** gobernadas por competencias.
> - `MODULO_INGLES_LLE.md` — el **Language Learning Engine**: convertir cada palabra del estudiante en evidencia académica reutilizable.
>
> Autor: Product + Arquitectura de Experiencia. Estado: **propuesta fundacional para discusión de fundadores.**
> Regla operativa heredada: **staging primero, aditivo sobre el esquema actual, sin perder datos.**

---

## 0. La tesis en una frase (el "aha" de integrar)

**El inglés no es un módulo que se agrega al Aula Virtual. El inglés es cómo el Aula Virtual aprende a caminar.**

La Visión 2030 dice que el átomo de Edusyn debe dejar de ser la *actividad* y pasar a ser la *competencia*, organizada en **Rutas de Aprendizaje**. Pero esa visión tiene un talón de Aquiles que su propio Red Team marcó como el concepto peor resuelto (`VISION_PRODUCTO_2030.md`, A.3): **nadie sabe quién crea ni puebla el grafo de competencias.** Si cada colegio debe construirlo a mano, la adopción muere en el onboarding.

El inglés resuelve eso de fábrica. **El CEFR ya ES un grafo de competencias canónico, mundial, curado por 40 años de investigación, con niveles (A1–C2), habilidades (Reading/Listening/Speaking/Writing) y átomos accionables (los *can-do statements*).** No hay que inventarlo ni pedirle al docente que lo pueble: viene cargado.

Y a la vez, el inglés produce **el flujo de evidencia más rico y más difícil de copiar que existe** — la palabra hablada de un niño convertida en dato académico. Eso es exactamente la prueba de la tesis "todo genera evidencia, nada es un archivo".

> **La integración, entonces, no es cosmética. Es estratégica:**
> El motor de idiomas es la primera Ruta de Aprendizaje completa, corriendo sobre el primer grafo de competencias real, en el primer segmento que claramente paga (colegios bilingües), produciendo el moat más defendible (dato longitudinal de habla). **Un solo movimiento valida la Visión 2030 entera.**

---

## 1. El problema que los dos documentos comparten (y cómo integrarlos lo resuelve)

Cada documento, por separado, tiene un hueco. Juntos se tapan mutuamente.

| Hueco de la Visión 2030 (Anexo A) | Cómo lo tapa el motor de idiomas |
|---|---|
| **A.1 ¿Quién paga?** El doc es 100% usuario, 0% comprador. | El colegio **bilingüe** paga, y paga bien: el bilingüismo es su promesa de marca y su mayor gasto. Aquí sí hay ARPU alto y disposición a pagar. |
| **A.3 El grafo de competencias: ¿quién lo puebla?** Cold-start mortal. | El **CEFR llega pre-cargado** como grafo canónico (niveles × habilidades × can-do's). Cero onboarding de grafo. |
| **A.4 El moat declarado es débil (RAG sobre un PDF, 3/10 vs OpenAI).** | El **dato longitudinal de habla** (trayectoria de inteligibilidad año a año) sí compone y sí es propietario. Nadie lo tiene sin acompañar al niño varios años. |
| **A.0 / A.12 Falta wedge y Non-Goals; producto ancho y poco profundo.** | El bilingüismo **es** el wedge: un segmento estrecho, profundo y rico donde ser excelentes primero. |

| Hueco del Motor de Idiomas (LLE §0) | Cómo lo tapa la Visión 2030 |
|---|---|
| "El LLE es un producto de varios años, riesgo de tragarse al equipo." | La Visión da la **arquitectura de contención**: el LLE no es un sistema aparte, es una Ruta más sobre infraestructura que ya se está construyendo (grafo, Valeria, evidencia). |
| "CEFR no es un test; auto-asignar nivel es frágil." | La Visión ya tiene la respuesta: **competencia como átomo acumulativo**, validado por el docente. El nivel CEFR es una lectura derivada del grafo, no un veredicto. |
| "El moat es la evidencia integrada al sistema de registro." | La Visión **es** ese sistema de registro (boletín, promoción, MEN). El LLE hereda el moat en vez de tener que construirlo. |

**Conclusión:** no son dos proyectos. Es un proyecto que se prueba a sí mismo dos veces.

---

## 2. El concepto unificado: la Ruta que produce evidencia

Un solo modelo mental atraviesa todo:

```
  RUTA DE APRENDIZAJE  (unidad de trabajo — reemplaza la "lista de actividades")
   │  "Communicate about family & routines"  ·  objetivo: can-do's A2 Speaking/Writing
   │
   ├─ PASO 1 · Lección viva      (Reading + vocabulario)   ─┐
   ├─ PASO 2 · Práctica Play     (vocabulario gamificado)   │  cada paso
   ├─ PASO 3 · Listening         (audio TTS + preguntas)    │  produce
   ├─ PASO 4 · Speaking          (grabación espontánea)     │  EVIDENCIA
   └─ PASO 5 · Writing + Proyecto (texto libre)            ─┘
                        │
                        ▼
        ┌──────────────────────────────────────────┐
        │   MOTOR DE EVIDENCIA (unificado)          │
        │   traduce cada paso a:                     │
        │   • métricas observables                   │
        │   • can-do's CEFR demostrados  ◀── nodos del GRAFO
        │   • nivel sugerido (nunca final)           │
        └───────────────┬──────────────────────────┘
      ┌─────────┬───────┼────────┬──────────┬────────────┐
      ▼         ▼       ▼        ▼          ▼            ▼
  CALIFICA-  GRAFO DE  ANALÍTICA  VALERIA   LEARNING    BOLETÍN
   CIONES   COMPETENC.          (propone   IDENTITY    (MEN)
                                el sig.paso)(RPG XP)
```

Las tres decisiones fundacionales que hacen que todo encaje:

1. **El paso reemplaza a la actividad** (Visión #1). Toda actividad —incluidos los cuatro componentes de idioma— es un *paso* dentro de una Ruta, conectado a una competencia.
2. **El can-do CEFR es un nodo del grafo de competencias** (LLE §9 + Visión §6). Reading/Listening/Speaking/Writing progresan como sub-competencias independientes. El nivel es derivado.
3. **Un solo cerebro, una sola voz, un solo grafo** (Visión §5.3). Valeria genera la Ruta, genera los textos y audios, explica la pronunciación y propone el siguiente paso — con la misma personalidad en Classroom, Play, Lecciones e Idiomas.

---

## 3. Por qué el inglés es el wedge perfecto (y no cualquier materia)

No es casualidad ni "porque el usuario tiene un colegio bilingüe". El inglés cumple, único entre las materias, las cuatro condiciones de un buen wedge:

1. **Grafo pre-existente y universal.** El CEFR es el único marco de competencias que ya está estandarizado mundialmente, es público y no requiere que el colegio lo construya. Matemáticas o Ciencias exigirían curar el grafo primero (el cold-start que mata).
2. **Dolor agudo y presupuesto real.** Un colegio bilingüe *vive o muere* por su inglés y ya gasta fuerte en él (plataformas, textos Pearson, native teachers). Hay quién paga y por qué.
3. **Evidencia máximamente difícil de copiar.** La palabra hablada → evidencia longitudinal es un foso que ninguna app de consumo (Duolingo/ELSA) puede cavar, porque no son el sistema de registro del colegio.
4. **Prueba filosófica extrema.** Si Edusyn puede convertir el *habla* de un niño en evidencia académica dentro del aula, la tesis "todo genera evidencia" queda demostrada en el dominio más difícil. Cualquier otra materia después es más fácil.

> **Regla del wedge (Non-Goal explícito):** extender el motor a Matemáticas/Ciencias/Programación se **deja arquitectónicamente listo pero NO se construye ahora.** La capa de grafo y la de identidad de aprendizaje se diseñan agnósticas de materia; solo el inglés las estrena. (Coherente con `MODULO_INGLES_LLE.md` §11 y con la crítica A.0 que pedía Non-Goals.)

---

## 4. La experiencia que hace que se quiera usar (el demo que vende)

Esto es lo "super genial": no es una lista de features, es **un flujo continuo donde el trabajo del docente y del estudiante se convierte solo en evidencia, competencia y siguiente paso.**

### 4.1 El docente — de "poner tareas" a "diseñar un viaje" (5 minutos)

```
┌───────────────────────────────────────────────────────────────────┐
│  8°B · English · Mrs. López              [ + Nueva Ruta con Valeria ]│
├───────────────────────────────────────────────────────────────────┤
│  Valeria:  "¿Qué quieres que logren?"                               │
│   ▸ Objetivo: [ Describir su familia y rutina diaria ]             │
│                                                                     │
│  🤖 Detecté que esto mapea a 4 can-do's del CEFR nivel A2:         │
│     • "Puedo describir mi familia con frases simples" (Speaking)   │
│     • "Puedo escribir sobre mi rutina" (Writing)  ... +2           │
│                                                                     │
│  Te propongo esta Ruta de 5 pasos (edítala, es tuya):             │
│   ✔ Reading: texto "My Family" (A2) + 8 palabras clave            │
│   ✔ Play: quiz de vocabulario (auto-desde el texto)               │
│   ✔ Listening: diálogo generado (TTS, acento neutro, 0.9x)        │
│   ✔ Speaking: "Describe tu familia en 60s" + rúbrica              │
│   ✔ Writing: "Un día en mi vida" (80 palabras)                    │
│                                                                     │
│         [ Publicar Ruta ]   [ Ajustar pasos ]   [ Modo manual ]   │
└───────────────────────────────────────────────────────────────────┘
```

Lo que pasó por debajo, invisible para el docente: Valeria usó el **grafo CEFR** para mapear el objetivo a can-do's, usó el **cerebro único** (`apd-ai.service.ts`) para generar el texto/quiz/diálogo, y encadenó todo como **pasos** de una Ruta. El docente no tocó un grafo ni escribió un prompt. **La complejidad se reveló como una conversación** (Visión §3.3).

### 4.2 El estudiante — de "entregar" a "verse progresar"

```
┌───────────────────────────────────────────────────────────────────┐
│  Tu ruta:  Family & Routines          ▓▓▓▓░░  4/5 pasos · A2 62%   │
│  ── Paso 4 · Speaking ────────────────────────────────────────────│
│   🎙  "Describe your family in 60 seconds"   (no sales del aula)   │
│        [ ● Hablar ]  ── 0:42 ──  [ Escuchar ] [ Reintentar 1/2 ]  │
│  ── recibido ─────────────────────────────────────────────────────│
│   ✔ Valeria analizó tu audio (tu profe confirma la nota):         │
│      Inteligibilidad ▓▓▓▓▓▓▓░ 78%  · Fluidez ▓▓▓▓▓░ buena         │
│      🗣 "Excelente 'older/younger'. Tu /θ/ en 'brother' suena     │
│          como /d/ — practica con esta pista."                      │
│      🎯 Can-do desbloqueado: "Puedo describir a mi familia" (A2)   │
│      ⭐ +40 XP Speaking · 🔥 Racha 6 · subiste de Traveler→Communicator│
└───────────────────────────────────────────────────────────────────┘
```

El estudiante nunca recibe solo una nota: recibe **una dirección** (qué practicar), **un logro** (un can-do del grafo) y **una identidad que crece** (XP por habilidad). La nota es privada y secundaria (Visión #8); el avance es el protagonista.

### 4.3 El cierre del círculo — Valeria proactiva sobre el grafo

Aquí es donde los dos documentos se vuelven uno solo y aparece la magia que ninguna app de idiomas puede dar:

```
┌─ Valeria · Iniciativa ───────────────────────────────────┐
│ 🔍 12 de 30 de tu 8°B aún no demuestran "A2 Listening".  │
│    Y noté que Speaking va fuerte pero Writing se quedó.   │
│                                                           │
│    Te preparé una micro-ruta de refuerzo de 2 pasos       │
│    (Listening + Writing) enfocada solo en esos 12.        │
│         [ Ver propuesta ]  [ Ahora no ]  [ Descartar ]    │
└───────────────────────────────────────────────────────────┘
```

Esto es literalmente imposible en Duolingo/ELSA/Pearson: **requiere ser, al mismo tiempo, el motor de idiomas Y el sistema de registro del colegio.** Edusyn es lo segundo; las apps de idiomas nunca lo serán.

---

## 5. Arquitectura unificada (una sola pila, no dos)

```
╔══════════════════════════════════════════════════════════════╗
║ CAPA EVIDENCIA→ACCIÓN   Analítica · Valeria propone · Boletín ║
╠══════════════════════════════════════════════════════════════╣
║ GRAFO DE COMPETENCIAS   ▸ Canónico nacional (DBA/Saber) [futuro]║
║  (la columna vertebral) ▸ Canónico CEFR  ◀── se estrena AHORA  ║
║                         ▸ Overlays por institución (PEI)       ║
╠══════════════════════════════════════════════════════════════╣
║ MOTOR DE EVIDENCIA      normaliza cualquier paso → can-do's    ║
╠══════════════════════════════════════════════════════════════╣
║ RUTAS DE APRENDIZAJE    pasos = actividades (incl. R/L/S/W)    ║
║  sobre ClassroomActivity + LearningObject (existentes)         ║
╠══════════════════════════════════════════════════════════════╣
║ CEREBRO ÚNICO (Valeria) genera rutas, textos, audios, explica ║
║  desde apd-ai.service.ts (orquestador free/premium existente)  ║
╠══════════════════════════════════════════════════════════════╣
║ PROVEEDORES              LLM (orquestador) · TTS · Speech(Azure)║
║  detrás de interfaces intercambiables (no acoplarse a vendor)  ║
╚══════════════════════════════════════════════════════════════╝
```

**Claves de que esto es aditivo sobre lo que ya existe (no reescritura):**
- Los pasos se apoyan en `ClassroomActivity` y `LearningObject` (Activo Pedagógico Vivo) — ya existen. La Ruta es un contenedor + orden sobre ellos.
- El cerebro es `apd-ai.service.ts` con su orquestador multi-key free/premium, cuota, medición y caché — ya existe. El motor de idiomas se activa como **entitlement premium** por institución ahí mismo. Cero infraestructura nueva de planes.
- Solo hay **tres piezas genuinamente nuevas**: (1) el modelo de **Ruta** (contenedor de pasos + competencia objetivo), (2) el **grafo** (empezando por el CEFR pre-cargado), (3) el **`SpeechAssessmentProvider`** (comprado, no construido — Azure/Speechace, y solo en Fase 1).

---

## 6. El diferenciador y el moat (los dos, combinados)

**La frase que lo resume:**
> *Duolingo te enseña inglés. Edusyn convierte cada palabra que dice el estudiante en evidencia que vive en su boletín, su competencia y su historia académica — y usa esa evidencia para que ningún estudiante se pierda. Dentro del aula, no en otra app.*

Los cuatro fosos, ordenados de más a menos defendible (corrigiendo el error de la Visión A.4, que declaraba el moat equivocado):

1. **Sistema de registro + dato longitudinal de habla.** La trayectoria de inteligibilidad de un niño desde 3° hasta 11°. Solo lo tiene quien es el SIS del colegio y lo acompaña años. **Compone con el tiempo; un entrante no lo fabrica.**
2. **Profundidad regulatoria colombiana ya construida** (boletín, promoción, recuperaciones, MEN) sobre la cual la evidencia de idioma aterriza sin fricción. Nadie global la localizará.
3. **Grafo canónico curado** (CEFR hoy, DBA/Saber mañana) con overlays por PEI. Activo de datos propietario.
4. **Scoring por inteligibilidad con acento configurable + can-do's localizados** — éticamente correcto y casi nadie lo hace (LLE §0.3).

Lo que **NO** es moat (y por eso se compra, no se construye): el motor de voz, el LLM, la gamificación.

---

## 7. Cómo esto transforma al docente (el viaje, aplicado al bilingüe)

Aplicando el Transformation Design (Visión §3) al docente de inglés concreto:

| Etapa | El docente de inglés hoy | Con la Ruta bilingüe |
|---|---|---|
| **Caos** | Textos sueltos, audios en YouTube, rúbricas en Word, el speaking "se evalúa a ojo". | Trae su material; Valeria lo ordena en Rutas. |
| **Tiempo** | Corregir 30 writings y 30 audios a mano = noches perdidas. | El motor pre-evalúa; el docente **ajusta y confirma**. Recupera horas. |
| **Maestría** | Evalúa las 4 habilidades desigual (Speaking casi nunca, por costo de tiempo). | Speaking se vuelve rutina; enseña distinto. |
| **Evidencia** | "Creo que van bien en listening." | "12 de 30 no demuestran A2 listening" — decide con dato. |
| **Liderazgo** | Su banco de recursos muere con él. | Comparte Rutas; el banco institucional de idioma crece. |

> Y una respuesta directa a la crítica A.2.2 de la Visión ("no mates el número"): el boletín de inglés sigue saliendo con su nota numérica exacta para el MEN y el colegio. **El número es sagrado; la diferencia es que además del número entregamos el can-do, la dirección y la trayectoria.** Se le añade, no se le quita.

---

## 8. Roadmap — una sola fase valida las dos tesis

### Fase 0 · La Ruta bilingüe sin voz (6–8 semanas) — el experimento barato que prueba TODO
- **Ruta de Aprendizaje v1**: contenedor de pasos + competencia objetivo, sobre `ClassroomActivity`/`LearningObject`.
- **Grafo CEFR pre-cargado** (A1–C2 × 4 habilidades × can-do's) como primer grafo canónico real.
- Componentes **Reading + Listening (TTS) + Writing** — los tres baratos, sin motor de voz.
- **Cerebro único cableado a la Ruta** (mata el generador de plantillas de lecciones; usa `apd-ai.service.ts`).
- Evidencia → can-do's → grafo → boletín + analítica básica.
- **Por qué esto primero:** valida a la vez (a) que las Rutas funcionan, (b) que el grafo se puebla solo desde el CEFR, (c) que un colegio bilingüe paga. Si esto no enamora a un colegio bilingüe, **no se construye el motor de voz** (el subsistema caro).

### Fase 1 · Speaking con proveedor turnkey (8–10 semanas) — el corazón y el moat
- `SpeechAssessmentProvider` (Azure/Speechace) detrás de interfaz. **Comprar, no construir.**
- Scoring por **inteligibilidad**, acento configurable, métricas observables (nunca "confianza").
- Valeria explica; el docente valida; degradación a rúbrica manual si no hay presupuesto.
- Entitlement premium + cuota vía orquestador existente.

### Fase 2 · Identidad y proactividad (8–12 semanas)
- Capa `LearningIdentity` genérica (XP/árboles por habilidad, estética profesional, progreso privado).
- Valeria proactiva sobre el grafo ("12 de 30 no demuestran A2 listening → micro-ruta").

### Fase 3 · Profundidad y expansión (continuo)
- Portafolio longitudinal de habla (el moat que compone).
- **Recién aquí** se evalúa abrir la arquitectura a una segunda materia (Non-Goal hasta este punto).

---

## 9. Non-Goals y economía (lo que la Visión no tenía y mata empresas)

Honrando explícitamente las críticas A.0, A.1 y A.8 de la Visión:

**Non-Goals (lo que NO haremos ahora, a propósito):**
- No construir motor de voz propio (se compra hasta que la escala lo justifique).
- No extender el grafo a otras materias en Fases 0–2.
- No perseguir la categoría "SO Educativo" como mensaje de mercado; el mensaje es concreto: **"el sistema académico bilingüe nativo-IA de LATAM".**
- No prometer nivel CEFR automático de una tarea (es evidencia acumulada validada por el docente).

**Economía unitaria (la línea que decide viabilidad):**
- **Reading/Listening/Writing ≈ costo casi cero:** LLM tier free + **caché** (un audio/texto se genera una vez y se reutiliza como activo institucional).
- **Speaking = el único tier caro** (ASR + pronunciation por enunciado) → se vende como **add-on premium** y se gobierna por cuota del orquestador. Quien no lo paga, lo usa en modo manual.
- **Detección barata vs generación cara** (corrige A.8): la proactividad de Valeria sobre el grafo usa **heurísticas siempre-on** ("¿hay can-do's sin demostrar hace N semanas?") — no inferencia LLM continua. El LLM solo se invoca cuando el docente pide *ver la propuesta*.

**El comprador (corrige A.1):** el rector de un colegio bilingüe firma por dos razones que sí le importan — **evidencia demostrable del nivel de inglés de su colegio** (su promesa de marca) y **boletines/reportes bilingües sin trabajo extra**. La transformación del docente es el cómo; el resultado medible en inglés es el qué que le vendemos.

---

## 10. Crítica adversarial de ESTA propuesta unificada (Red Team)

No la confirmo; intento romperla.

1. **¿El wedge bilingüe es demasiado estrecho?** Los colegios plenamente bilingües en Colombia son pocos y ya suelen tener plataformas caras (Pearson, Cambridge). *Respuesta parcial:* el mercado real es más amplio — los cientos de colegios *con intensificación de inglés* que aspiran a bilingües y no tienen cómo evidenciarlo. Pero **hay que dimensionar ese TAM antes de comprometerse.** Riesgo abierto.
2. **El CEFR como grafo puede ser una trampa de simplicidad.** Enchufar el CEFR es fácil; que el resto del ecosistema (analítica, boletín, promoción MEN) consuma can-do's en vez de notas es donde está el trabajo de verdad. **El grafo no es el reto; es la plomería que cuelga de él.**
3. **Dependemos de un vendor de voz para el moat del habla.** Si Azure/Speechace cambian precios o discontinúan, el corazón se encarece. *Mitigación:* la interfaz `SpeechAssessmentProvider` lo hace intercambiable, pero **el riesgo de proveedor es real** y hay que tener un plan B contratado.
4. **Sesgo de acento con niños colombianos (riesgo #1 del LLE, sigue vivo).** Ningún ASR está entrenado con voz infantil L2 colombiana. Un solo puntaje injusto destruye la confianza. *Por eso* Fase 0 es sin voz y Fase 1 puntúa inteligibilidad con acento configurable y siempre bajo validación docente — pero **este sigue siendo el riesgo que más puede matar el producto.**
5. **Datos de menores (A.1.4 de la Visión, no resuelto aquí).** Grabar y analizar la voz de niños toca Ley 1581 / Habeas Data, consentimiento parental y biometría (la "consistencia de voz" es voiceprint). **Falta una sección de gobernanza de datos antes de grabar el primer audio.** Deuda pendiente, marcada.
6. **Capacidad de ejecución (A.0).** Rutas + grafo + motor de evidencia + 4 componentes + gamificación es mucho para un equipo pequeño, aun faseado. Fase 0 está deliberadamente recortada, pero **si Fase 0 se infla, se traga al equipo.** Disciplina de alcance = supervivencia.

**Veredicto de la crítica:** la integración es más fuerte que cualquiera de los dos documentos por separado, porque cada uno tapa el hueco del otro y juntos producen un wedge con comprador, grafo y moat. Pero **tres deudas deben resolverse antes de construir**: dimensionar el TAM bilingüe, escribir la gobernanza de datos de menores, y contratar un plan B de proveedor de voz.

---

## 11. Veredicto estratégico

**¿Es esto "algo super genial, diferenciador, que ayude al docente y que se quiera usar"? Sí — y por una razón estructural, no de marketing:**

- **Super genial / se quiere usar:** el docente diseña un viaje en una conversación de 5 minutos y el habla del niño se vuelve evidencia sola. El estudiante se ve progresar, no entregar.
- **Diferenciador / difícil de copiar:** requiere ser a la vez el motor de idiomas y el sistema de registro del colegio. Duolingo no puede; Canvas no localiza; OpenAI no tiene el dato longitudinal.
- **Ayuda al docente:** le devuelve las noches que hoy pierde corrigiendo 30 audios y 30 writings a mano, y lo mueve del caos a la evidencia.

Y lo más importante para Edusyn como empresa: **este único movimiento de-riesgea la Visión 2030 completa.** Prueba las Rutas, puebla el grafo, encuentra al comprador y cava el moat — todo en un segmento acotado y pagador, antes de apostar la compañía a construirlo para todas las materias.

> **La estrella polar de esta propuesta:** *El inglés es la primera lengua que el Aula Virtual aprende a escuchar — y al escucharla, Edusyn aprende a caminar como el sistema de aprendizaje que quiere ser en 2030.*

---

### Próximos pasos sugeridos (en orden)
1. **Dimensionar el TAM** de colegios bilingües + con intensificación de inglés en Colombia (deuda #1 de la crítica).
2. **Escribir la mini-constitución de gobernanza de datos de menores** antes de tocar audio (deuda #5).
3. **Prototipar Fase 0** en staging: modelo de Ruta + grafo CEFR pre-cargado + Reading/Listening/Writing sobre `ClassroomActivity`, cableado a `apd-ai.service.ts`. Cero motor de voz. Validar con un colegio bilingüe real.

---

## 12. Verificación contra el código real (staging + producción) — 2026-07-04

Auditoría del repositorio para separar lo que **ya existe** (aditivo real) de lo que es **greenfield**, y corregir supuestos falsos de las versiones anteriores de este documento y del LLE.

### 12.1 Lo que la propuesta asumía y SÍ existe (verde)

| Pieza que asumíamos | Realidad en el código | Veredicto |
|---|---|---|
| Orquestador IA free/premium por institución | `apps/api/src/modules/apd/ai/apd-ai.service.ts` — multi-key (OpenRouter free / Gemini premium), cuota, métodos reales: `generateQuizQuestions`, `generatePedagogicalDesign`, `answerTeacherQuestion`, `generateProgressReport`, `suggestActivities`, `predictRisk`. `isEnabled()` para degradar. | ✅ Existe |
| "Activo Pedagógico Vivo" con ADN y ciclo de evidencia | Es `PedagogicalDesign` + `PedagogicalDesignVersion` (schema:5459). Tiene `dna Json` (competencias/bloom), `content Json`, `evidenceSnapshot Json`, linaje y trazabilidad de IA. **NO se llama `LearningObject`.** | ✅ Existe (con otro nombre) |
| Contenedor de unidades para agrupar | `ClassroomSection` existe. | ✅ Existe |
| Enganche para colgar Ruta/componentes sin migrar | `ClassroomActivity.metadata Json?` (schema:5681) — punto natural para el payload de Ruta y de componentes de idioma. | ✅ Existe |
| Sustrato de Reading | `QuestionContext` (texto + imagen + `viewPolicy`) + `ActivityQuestion` ya soportan lectura con preguntas. | ✅ Existe |
| Etiqueta de competencia por pregunta | `ActivityQuestion.competency String?` + `subjectArea`. | ⚠️ Existe pero es **texto libre, no un grafo** |
| Lecciones con actividades/checkpoints/insignias | `Lesson`/`LessonSlide` (CONTENT/ACTIVITY/CHECKPOINT/BADGE_REVEAL, `activityData Json`) + `LessonProgress` (score, `badgeEarned`, `lastCheckpointIndex`, tiempo). | ✅ Existe |

### 12.2 Lo que la propuesta daba por hecho y NO existe (rojo — es greenfield)

1. **`LearningObject` no existe.** Corrección: donde el LLE y este doc decían `LearningObject`, el modelo real es `PedagogicalDesign`. Y hay un matiz que cambia el plan: `PedagogicalDesign` vive en el **Workspace del docente** (boards), **no dentro de `ClassroomActivity`**. El puente "Activo Pedagógico → pasos de una Ruta en Classroom" **hay que construirlo**; no está.
2. **No existe un grafo de competencias.** Lo único que hay es el string `ActivityQuestion.competency`. El **CEFR es dato canónico externo** (eso sí es "gratis"), pero **el modelo de grafo y su enganche al boletín/analítica son 100% nuevos.** La Fase 0 debe incluir crear ese modelo mínimo — es aditivo (tablas nuevas), pero es trabajo, no un enchufe.
3. **No existe capa de gamificación / XP / identidad de aprendizaje.** ⚠️ **Ojo con un falso amigo:** el modelo `Achievement` **NO es gamificación** — es el "logro" académico colombiano (boletín/MEN), atado a `academicTermId` y planilla. La gamificación real hoy se limita a: insignias de lección (`badgeEarned`) y puntajes/rankings de EdusynPlay. **No hay XP transversal, ni rachas globales, ni árboles de habilidad, ni `LearningIdentity`.** Todo eso es nuevo.
4. **Las Lecciones NO están cableadas a la IA (y está en PRODUCCIÓN).** El endpoint `POST classroom/lessons/generate-ai` (`classroom.controller.ts:995`) llama a `lessonService.generateLessonStructure()` — un **generador de plantilla** que parte párrafos e inserta placeholders literales (`"¿Qué aprendiste sobre ${topic}?"`, opciones `['Opción A','Opción B',...]`). El comentario del propio código dice *"the actual AI generation happens via Valeria API"* — **ese cableado no existe.** No usa ninguno de los métodos reales del orquestador.
5. **`SpeechAssessmentProvider` (motor de voz):** no existe — como estaba previsto, es Fase 1 y se compra.

### 12.3 Estado producción vs staging (a 2026-07-04)

- `staging` está **~22 commits adelante** de `main` (producción), pero **todos** en Reportes, Configuración SIEE, Catálogo académico y Notas. **Nada** de Classroom/Lecciones/Gamificación/Inglés.
- El código de Lecciones (`lesson.service.ts`, `classroom.controller.ts`) es **idéntico en `main` y `staging`** → **el generador de plantilla ya está en producción.** Cualquier cambio a Lecciones se despliega a prod: exige feature-flag o preservar el fallback con aviso "modo sin IA" (el patrón `isEnabled()` ya existe para eso).

### 12.4 Corrección al alcance de la "Fase 0 barata"

La Fase 0 sigue siendo el punto de entrada correcto, pero **honestamente NO es tan barata como la pintaba §8**, porque el modelo de Ruta, el grafo mínimo y la gamificación son netos. Reordenada por dependencia real y por lo que el fundador pidió (mejorar al docente + al proceso + gamificación fuerte):

**PASO 0 · Arreglar Lecciones (antes que cualquier inglés) — el quick win ya diagnosticado**
- Cablear `generate-ai` al orquestador real (`generatePedagogicalDesign`/`generateQuizQuestions`) con `VALERIA_PERSONA` y contexto (grado/materia/Bloom). Mantener la plantilla **solo** como fallback si `isEnabled() === false`.
- Añadir ramas adaptativas (falla checkpoint → slide de refuerzo) usando `lastCheckpointIndex` que ya existe.
- *Por qué primero:* es barato, es alto impacto, **ya está en prod fallando**, y es el sustrato de "la lección como paso de una Ruta". No se puede montar la Ruta sobre lecciones placeholder.

**PASO 1 · Capa `LearningIdentity` (gamificación transversal) — lo que el fundador quiere fuerte**
- Modelo nuevo de XP/racha/nivel **por habilidad y agnóstico de materia**, que consume eventos que ya existen (`LessonProgress`, submissions, Play). Estética profesional, progreso privado, XP por dominio (no por clics).
- Se estrena en Lecciones y Play de inmediato (no espera al inglés) → valor para **todos** los colegios, no solo bilingües.

**PASO 2 · Ruta + grafo mínimo + componentes R/L/W (el wedge bilingüe)**
- Modelo de Ruta (contenedor de pasos sobre `ClassroomActivity.metadata`), grafo mínimo sembrado con CEFR, componentes Reading/Listening(TTS)/Writing. Puente `PedagogicalDesign → pasos de Ruta`.

**PASO 3 · Speaking turnkey (Fase 1 original)** — sin cambios: comprar `SpeechAssessmentProvider`, previa gobernanza de datos de menores.

### 12.5 Veredicto de la verificación

**¿Lo propuesto cumple con lo necesario? Sí en estrategia; con tres correcciones en ejecución:**
1. Renombrar `LearningObject`→`PedagogicalDesign` y **presupuestar el puente Workspace↔Classroom** (no es gratis).
2. El grafo de competencias es **greenfield** (solo el dato CEFR es pre-existente); dejar de venderlo como "enchufe".
3. La **gamificación es casi toda nueva** y —dado que el fundador la quiere fuerte— sube de "Fase 2" a **workstream de primer nivel (Paso 1)**, estrenándose en Lecciones para dar valor a todos los colegios antes del inglés.

Y un ajuste de secuencia impuesto por producción: **arreglar Lecciones es el Paso 0 real**, porque ya está en prod con el generador de plantilla y es el cimiento de todo lo demás.

---

## 13. Bitácora de implementación

### Paso 0 · Cablear Lecciones a la IA real — HECHO y verificado (2026-07-04)
- `ApdAiService.generateLessonSlides()` genera la lección con el LLM real (Valeria); `LessonService.generateLesson()` intenta IA y **cae con gracia a la plantilla** si `isEnabled()` es false o falla. El endpoint `POST classroom/lessons/generate-ai` devuelve `source: 'AI' | 'TEMPLATE'` y la UI (`LessonEditor`) avisa al docente cuál motor se usó. Aditivo, sin migración, fallback intacto.
- **Verificado en vivo** contra la key de Railway (servicio `api`, provider OpenRouter free): generó lecciones bien estructuradas (CONTENT/ACTIVITY/CHECKPOINT/BADGE_REVEAL), respuestas correctas dentro de opciones, explicaciones y pistas reales — **sin los placeholders "Opción A/B/C/D"** que tenía la plantilla.
- De paso se **refrescó `OPENROUTER_MODEL_CASCADE`**: 3 de los 7 slugs viejos daban 404 (ya no free) y desperdiciaban llamadas. Reemplazados por modelos `:free` vigentes (solo instruct, no reasoning). Mejora toda la IA, no solo Lecciones.

### ⏳ Pendiente anotado — latencia y API premium
- **Con el tier gratuito de OpenRouter, la generación tarda ~45–70s** por dos causas: los modelos free están saturados (HTTP 429 "rate-limited upstream") y los que responden son lentos. La cascada corregida ya no desperdicia llamadas en slugs muertos, pero **el cuello de botella de fondo es el tier free y NO se resuelve con código.**
- El orquestador **ya soporta tier premium** (Gemini, `AiTier.PREMIUM`, multi-key por institución). Con una `GEMINI_API_KEY` de pago la latencia bajaría a ~3–8s sin 429.
- **Decisión del fundador (2026-07-04):** por ahora **no hay presupuesto para API premium**; se prueba más adelante. Hasta entonces, Lecciones IA funciona en free asumiendo la latencia. **Al conectar la key premium, re-medir la latencia y activar el entitlement.**
