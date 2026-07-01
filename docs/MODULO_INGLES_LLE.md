# Language Learning Engine (LLE) — Módulo de Inglés en el Aula Virtual

> **Documento extraído para trabajar en una sesión dedicada.** Antes vivía como "Parte II" dentro de
> `REDISENO_AULA_VIRTUAL_2026.md`; se separó a petición del usuario para poder retomarlo "de forma correcta"
> sin mezclarse con el resto del rediseño del Aula Virtual (que ya está implementado y en producción).

---

## Briefing para retomar esta sesión (léelo primero)

**Qué es esto:** una propuesta de producto+arquitectura para dar a Edusyn una capacidad de idiomas (inglés)
integrada al Aula Virtual — no una app de idiomas aparte. El documento ya pasó por una crítica adversarial
(sección 0) antes de convertirse en propuesta fundacional, así que no es una primera idea sin filtrar.

**Estado de implementación: NINGUNO.** Todo lo que sigue es diseño/propuesta. No hay código, ni modelo de
datos, ni endpoints construidos para esto todavía. Es 100% punto de partida.

**Cómo encaja con el resto del sistema (contexto que la nueva sesión necesita, sin tener que releer todo):**
- El **Aula Virtual** (`Classroom.tsx`, `ClassroomActivity`) ya fue rediseñada (estado visual, filtros,
  jerarquía) — ver `REDISENO_AULA_VIRTUAL_2026.md` Parte I. El LLE se monta sobre esa base, no la reemplaza.
- El **Orquestador de IA por institución** (free/premium, cuota, medición y caché) ya existe en
  `apps/api/src/modules/apd/ai/apd-ai.service.ts` — el LLE debe activarse como un *entitlement premium* a
  través de ese orquestador, no construir su propio sistema de planes.
- El **Estudio / Diseño Pedagógico IA** (`LearningObject`, "Activo Pedagógico Vivo") ya existe —
  ver `DISENO_PEDAGOGICO_IA.md`. Los componentes de idioma deben vivir dentro de ese objeto, no en tablas
  nuevas aisladas.
- La referencia a **"Anexo A"** y a **"Valeria"** en este documento apunta a `VISION_PRODUCTO_2030.md`
  (la "Carta de Límites de Valeria" y el "presupuesto de atención" del docente están ahí, no en este doc).
- La referencia a **"§11 del rediseño"** (regla "XP por dominio, no por clics") apunta a
  `REDISENO_AULA_VIRTUAL_2026.md` §11.

**Primer paso recomendado al retomar:** no saltar directo a construir. Este documento ya tiene un roadmap
(§16) con una Fase 0 deliberadamente barata y sin riesgo (Reading/Listening/Writing, sin motor de voz) para
validar la tesis antes de comprometerse con Speaking (el subsistema caro y riesgoso). Empezar ahí.

---

> Mecanismo de activación: el LLE es un **entitlement premium por institución**, gobernado por el **Orquestador de IA ya existente** (`apd-ai.service.ts`, multi-key free/premium). Las instituciones bilingües o que paguen lo activan; las demás no lo ven. Cero impacto para quien no lo usa.
> Tesis: **no construimos un módulo de inglés. Extendemos las actividades del Aula Virtual con cuatro componentes de evidencia lingüística (Reading/Listening/Speaking/Writing) que alimentan calificaciones, competencias y analítica como cualquier otra evidencia.**

---

## 0. Crítica de la propuesta (sin complacencia)

Antes de elevarla a documento fundacional, hay que romperla. La propuesta es fuerte en filosofía y peligrosamente liviana en los tres puntos que deciden si vive o muere.

### 0.1 El error de subestimar la evaluación de pronunciación (riesgo #1, make-or-break)
La propuesta acierta en *"no asumir que un LLM evalúa pronunciación"*. Pero no reconoce que la alternativa es **el subsistema más caro, más difícil y más riesgoso de todo el LLE**:
- El ASR de consumo (Whisper, Google STT) está entrenado con **hablantes nativos adultos**. Con niños colombianos aprendiendo inglés (L2, acento marcado, voz infantil) **degrada fuertemente** → puntajes injustos → la confianza del docente y del colegio colapsa en la primera semana. Un solo puntaje injusto a un niño destruye la credibilidad del producto.
- *Forced alignment* + *Goodness of Pronunciation (GOP)* a nivel fonema es un problema de ML especializado, no un "feature".
- **Consecuencia:** si esto se construye mal o se promete antes de tiempo, el LLE nace muerto.
- **Decisión que la propuesta no toma — build vs buy:** NO construir motor de voz propio con el equipo actual. Usar un **proveedor turnkey de Pronunciation Assessment** (Azure Pronunciation Assessment, Speechace, ELSA API) detrás de una **interfaz `SpeechAssessmentProvider`** intercambiable. El moat NO es el motor de voz (cualquiera llama a Azure); el moat es la evidencia integrada (§10). Construir Kaldi/MFA propio es quemar 18 meses en lo que NO te diferencia.

### 0.2 "Confianza" no es medible desde el audio (riesgo pedagógico/ético)
La lista de evidencia de Speaking incluye *"confianza"*. **Eso es ingenuo y peligroso.** No existe señal acústica fiable de "confianza"; lo que se mide son *proxies* (tasa de muletillas, pausas, reinicios). Etiquetar eso como "confianza" **castiga injustamente a estudiantes tímidos, tartamudos o neurodivergentes**. Reformular: la evidencia es *fluidez, pausas, muletillas, tiempo hablado* — descriptores observables, nunca juicios sobre la persona. (Coherente con la "Carta de Límites de Valeria" de `VISION_PRODUCTO_2030.md`, Anexo A.)

### 0.3 El sesgo de acento es una bomba ética y, a la vez, tu mayor diferenciador
Casi todas las plataformas (Duolingo, ELSA) puntúan contra un ideal **nativo (General American)**. Puntuar a un niño colombiano contra ese ideal es injusto y pedagógicamente erróneo: el objetivo del MCER/CEFR es **inteligibilidad y comunicación, no sonar gringo**.
- **Riesgo:** reproducir sesgo lingüístico colonial dentro de un producto educativo colombiano.
- **Oportunidad (la conviertes en moat):** Edusyn puntúa por **inteligibilidad**, no por *native-likeness*, con **acento objetivo configurable** por institución. Esto es éticamente correcto *y* casi nadie lo hace. Es un diferenciador real, no cosmético.

### 0.4 CEFR no es un test; es un marco. Auto-asignar nivel es psicométricamente frágil
Mapear el desempeño de *una* actividad → un nivel A1/B2 es estadísticamente inválido. El nivel CEFR debe ser **derivado, validado por el docente y acumulado** sobre muchas evidencias a lo largo del tiempo, nunca un veredicto de una tarea. El átomo correcto no es "el nivel": son los **can-do statements** del CEFR ("puedo describir mi familia con frases simples"). Esos *can-do* son competencias → se enchufan directo al **grafo de competencias**. Este es el ajuste conceptual más importante de todo el documento (§9).

### 0.5 El fraude en 2026 es asistido por IA, y un par de medidas se contradicen con "sin biometría"
- El estudiante puede pedirle a una IA el ensayo, o generar el texto y leerlo con TTS en Speaking. Las contramedidas propuestas (oral espontáneo, imagen al momento, tiempo limitado, detección de lectura) son razonables.
- **Pero "consistencia de voz" entre sesiones ES una huella de voz (voiceprint) → es biometría.** Contradice el principio "sin biometría obligatoria". Hay que resolverlo: usar consistencia de voz solo como **señal blanda de revisión para el docente** (no como bloqueo ni identidad), opt-in, y nunca como prueba determinante. "Detección de lectura" (leído vs espontáneo) es además un modelo de ML no trivial: tratarlo como señal probabilística, no como acusación.

### 0.6 El costo real no es el LLM: es el segundo de audio evaluado
La propuesta optimiza el costo del LLM (correcto para Reading/Writing) pero **el driver de costo del LLE es el Speaking** (ASR + pronunciation API por enunciado). Reading y Listening pueden vivir casi gratis; Speaking cuesta dinero por cada grabación. Esto obliga a un **modelo de precio por habilidad** (§13): Speaking es el tier caro.

### 0.7 Alcance: esto es un producto de varios años, no un sprint
Cuatro habilidades × (flujo manual + flujo IA) × motor de voz × RPG gamificado × extensibilidad a otras materias = **enorme**. La ambición de extender la gamificación a Matemáticas/Programación/Ciencias es correcta como *arquitectura* pero **no se construye ahora**: solo se deja la puerta abierta. Sin una fase brutal (§16), el LLE se traga al equipo.

### 0.8 Lo que la propuesta acierta y hay que proteger
- *"Todo genera evidencia reutilizable, no archivos"* — **este es el moat entero.** Es lo que ninguna app de idiomas (Duolingo/ELSA) tiene, porque no son el sistema de registro del colegio.
- *Doble flujo (manual / IA), IA propone y el docente decide* — correcto y coherente con todo el ecosistema.
- *Componentes combinables dentro de la actividad* — correcto: encajan en el `LearningObject` (Activo Pedagógico Vivo), no en objetos nuevos.
- *Gamificación como identidad de aprendizaje transversal* — idea brillante; pertenece como capa genérica (§11).

**Veredicto de la crítica:** la propuesta tiene potencial real de ser **uno de los principales diferenciadores estratégicos de Edusyn para instituciones bilingües** — pero solo si (1) se compra el motor de voz en vez de construirlo, (2) se puntúa por inteligibilidad y no por acento nativo, (3) CEFR se trata como evidencia acumulada de can-do's, y (4) se fasea sin piedad. Con esos cuatro cambios, pasa de "buena idea" a "difícil de copiar en 10 años".

---

## 1. Visión

> **El Aula Virtual de Edusyn aprende a escuchar, leer, hablar y escribir contigo — y cada palabra del estudiante se convierte en evidencia que vive en su boletín, sus competencias y su historia de aprendizaje.**

El LLE no es una app de idiomas pegada al LMS. Es la prueba de que la filosofía de Edusyn —*todo genera evidencia, nada es un módulo aislado*— se sostiene incluso en el dominio más difícil de evaluar: la lengua hablada. Si el habla de un niño puede volverse evidencia académica reutilizable dentro del Aula Virtual, cualquier cosa puede.

---

## 2. Principios (no negociables)

1. **Todo ocurre dentro de la actividad del Aula Virtual.** No hay laboratorio, no hay app aparte, no hay "ir a otro lado". El Speaking se graba donde se entrega la tarea.
2. **El docente puede construir todo a mano, siempre.** La IA es opcional. Un colegio sin presupuesto de IA usa el LLE completo en modo manual.
3. **La IA propone borradores y explica; nunca decide.** Ni el texto, ni la nota, ni el nivel CEFR. El docente valida.
4. **Todo produce evidencia reutilizable, no archivos.** Un audio no es un .mp3: es transcripción + métricas + can-do's demostrados, consumibles por calificaciones, competencias y analítica.
5. **Se puntúa la inteligibilidad, no el acento nativo.** Acento objetivo configurable. Ética antes que imitación.
6. **Ninguna métrica juzga a la persona.** Se miden conductas observables (fluidez, pausas), nunca rasgos ("confianza", "timidez").
7. **CEFR es evidencia acumulada, no un veredicto de una tarea.** El nivel se deriva de can-do's a lo largo del tiempo y lo confirma el docente.
8. **Degradación elegante.** Sin IA premium: Reading/Listening/Writing funcionan; Speaking cae a "grabar + rúbrica manual del docente". Nunca se rompe; se reduce.
9. **Activable y aislable por institución.** Entitlement premium vía el orquestador existente. Quien no paga, no lo ve; quien no lo usa, no lo paga.

---

## 3. Arquitectura conceptual

```
                    ┌──────────────────────────────────────────┐
                    │   ACTIVIDAD DEL AULA VIRTUAL (existente)  │
                    │   ClassroomActivity + LearningObject      │
                    └───────────────────┬──────────────────────┘
                         contiene 1..n COMPONENTES de idioma
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
    READING        LISTENING       SPEAKING        WRITING
   (texto+Qs)    (audio+Qs)      (grabación)     (texto libre)
        │              │              │              │
        └──────────────┴──────┬───────┴──────────────┘
                              ▼
              ┌───────────────────────────────────┐
              │      MOTOR DE EVIDENCIA (LLE)      │
              │  normaliza cada componente a:      │
              │  • métricas observables            │
              │  • can-do's CEFR demostrados       │
              │  • nivel sugerido (no final)       │
              └───────────────┬───────────────────┘
        ┌──────────┬──────────┼──────────┬──────────────┐
        ▼          ▼          ▼          ▼              ▼
  CALIFICA-   COMPETEN-   ANALÍTICA   WORKSPACE     GAMIFICA-
   CIONES      CIAS                   (Biblioteca)   CIÓN (id.)
        ▲          ▲          ▲          ▲              ▲
        └──── proveedores intercambiables detrás de interfaces ────┘
   SpeechAssessmentProvider · TTSProvider · LLMProvider(orquestador)
```

**Claves arquitectónicas:**
- Los componentes **no son tablas nuevas de "inglés"**: son tipos de bloque dentro del `LearningObject` (Activo Pedagógico Vivo) y producen `ActivitySubmission` enriquecidas con un payload de evidencia lingüística.
- Tres **proveedores detrás de interfaces** para no acoplarse a un vendor: voz (Azure/Speechace), TTS (para generar Listening), y LLM (el orquestador free/premium ya existente).
- El **Motor de Evidencia** es el corazón: traduce señales crudas (audio, texto) a moneda académica (can-do's + métricas), que es lo único que el resto del ecosistema consume.

---

## 4. Los cuatro componentes (qué evidencia produce cada uno)

| Componente | Insumo del docente (manual) | Ayuda opcional de Valeria | Evidencia que genera | Costo IA |
|---|---|---|---|---|
| **Reading** | Escribe/pega texto, sube PDF | Genera texto + vocabulario + preguntas + objetivos, adaptado por nivel | Comprensión, vocabulario, can-do's de lectura | Bajo (LLM, cacheable) |
| **Listening** | Sube/graba audio | Genera guion y lo sintetiza (TTS): narración, diálogo, entrevista, podcast, anuncio — con velocidad/acento/nivel | Comprensión auditiva, can-do's de escucha | Medio (TTS, **cacheable y reutilizable**) |
| **Speaking** | Define la consigna ("Describe your family") + rúbrica | Sugiere consignas y rúbricas | Transcripción, pronunciación (inteligibilidad), fluidez, pausas, vocabulario, gramática, tiempo hablado, can-do's orales | **Alto (ASR+pron. por enunciado)** |
| **Writing** | Define la consigna | Sugiere mejoras *ancladas a rúbrica* (no "suena más nativo") | Coherencia, gramática, léxico, can-do's escritos | Bajo-medio (LLM) |

> Regla de oro del feedback de Writing/Speaking: la IA corrige **contra la rúbrica y el nivel objetivo**, no contra un ideal nativo. No homogeneizar; no borrar la voz del estudiante.

---

## 5. Arquitectura de evaluación de Speaking (el subsistema crítico)

Responsabilidades **separadas**, nunca mezcladas (esto la propuesta lo pide y es correcto):

```
 audio del estudiante
        │
        ▼
 [1] SPEECH RECOGNITION (ASR)  → transcripción
        │
        ▼
 [2] FORCED ALIGNMENT          → alinea fonemas con la transcripción
        │
        ▼
 [3] PRONUNCIATION ASSESSMENT  → GOP por fonema/palabra → score de INTELIGIBILIDAD
        │                         (acento objetivo configurable)
        ▼
 [4] FLUENCY/PROSODY           → ritmo, pausas, muletillas, tiempo hablado
        │
        ▼
 [5] LLM (orquestador)         → SOLO EXPLICA en lenguaje pedagógico
        │                         "tu /θ/ en 'think' suena como /t/; practica…"
        ▼
 EVIDENCIA + sugerencia de nota  →  el DOCENTE revisa y decide
```

- Pasos [1]–[4] = proveedor turnkey (Azure Pronunciation Assessment cubre 1–4 en una sola llamada). [5] = el LLM solo traduce números a consejo humano. **El LLM nunca puntúa pronunciación.**
- **Degradación:** sin proveedor de voz → Speaking sigue existiendo como "graba + el docente califica con rúbrica". La evidencia entonces es la rúbrica docente, no las métricas automáticas. El componente nunca desaparece.

---

## 6. Experiencia del estudiante

```
┌───────────────────────────────────────────────────────────────┐
│  Tarea: "My Family"  ·  English · Mrs. López        ⏱ 15 min   │
│  ── Speaking ─────────────────────────────────────────────────│
│   🎙  "Describe your family in 60 seconds."                    │
│        [ ● Hablar ]     (no sales del aula)                    │
│        ─ grabando ──────────────────────  0:42                 │
│        [ Escuchar ]  [ Reintentar (1/2) ]  [ Enviar → ]        │
│  ── después de enviar ───────────────────────────────────────│
│   ✔ Recibido. Valeria está analizando tu audio…               │
│   📊 Tu evidencia (borrador, tu profe confirma la nota):       │
│      Inteligibilidad ▓▓▓▓▓▓▓░ 78%  · Fluidez ▓▓▓▓▓░ buena      │
│      🗣 "Excelente uso de 'older/younger'. Tu /θ/ en           │
│          'brother' suena como /d/ — practica con esta pista."  │
│      🎯 Can-do alcanzado: "Puedo describir a mi familia"       │
└───────────────────────────────────────────────────────────────┘
```

El estudiante nunca recibe solo una nota: recibe **una dirección** (qué practicar) y **un logro** (qué can-do desbloqueó). La evidencia es async (segundos): se diseña para la espera, no se finge instantaneidad.

---

## 7. Experiencia del docente

- **Construcción:** abre una actividad, añade los componentes que quiera (solo Listening; o Speaking+Writing; o los cuatro). Modo manual completo o con borradores de Valeria.
- **Calificación:** una bandeja por habilidad. Para Speaking, ve transcripción + métricas + audio + sugerencia de nota; **ajusta y confirma** (la nota es suya). Atajos de teclado, rúbrica al lado.
- **Confianza:** cada métrica automática es etiquetada "borrador IA"; el docente la valida. La IA explica *por qué* sugiere lo que sugiere (explicable, como en todo el ecosistema).
- **Sin sorpresas de costo:** el colegio premium tiene cuota; el docente ve cuánto Speaking automático le queda en el periodo (gobernado por el orquestador).

---

## 8. Integración con el Aula Virtual y con el Estudio (Diseño Pedagógico IA)

- **Aula Virtual:** los componentes son bloques de la actividad existente; la entrega es una `ActivitySubmission` con payload lingüístico. Cero módulo nuevo en el menú.
- **Estudio / Activo Pedagógico Vivo:** Valeria puede generar un `LearningObject` que **ya nace con** componentes Reading/Listening/Speaking/Writing dentro — no son objetos separados, son parte del mismo activo. "Convertir en actividad" arrastra los componentes y su rúbrica. El LLE hereda el ADN pedagógico (nivel, objetivos, competencias) del activo.

---

## 9. Integración con Competencias (el ajuste conceptual clave)

El átomo de competencia lingüística es el **can-do statement del CEFR**, no el nivel:

```
  can-do: "Puedo describir mi familia con frases simples"   (A2 · Speaking)
        ▲ demostrado por
   evidencias: Speaking #3 (78%), Speaking #7 (85%)
        ▼ acumula
  → progreso en la competencia "Interacción oral A2"
        ▼ muchas competencias A2 dominadas + validación docente
  → NIVEL CEFR A2 sugerido al docente (nunca auto-otorgado)
```

Esto conecta el LLE directo al **grafo de competencias** de la visión (`VISION_PRODUCTO_2030.md`): las cuatro habilidades progresan como sub-competencias independientes, y el nivel CEFR es una **lectura derivada y validada**, no un puntaje de examen. Psicométricamente honesto y filosóficamente coherente.

---

## 10. Integración con Analítica, Workspace y Edusyn Play

- **Analítica:** el grupo se ve por habilidad y por can-do ("12/30 aún no demuestran A2 listening"). Valeria proactiva (`VISION_PRODUCTO_2030.md`, Anexo A, presupuesto de atención): "tu 8°B viene débil en Speaking spontaneous, ¿preparo 3 actividades?".
- **Workspace / Biblioteca Institucional:** cada audio de Listening generado y cada texto de Reading se guardan como **activo reutilizable institucional** (se generan una vez, se reusan muchas — clave de costo, §13).
- **Edusyn Play:** vocabulario y listening pueden convertirse en quizzes Play; el speaking en vivo es una fase 3 (cara, opcional).

---

## 11. Gamificación como **Identidad de Aprendizaje** (transversal, no solo inglés)

La gamificación NO se construye para inglés: se construye como una **capa genérica de identidad** que el inglés *estrena*.

```
  CEFR real (lo ve el docente)     Capa RPG (lo vive el estudiante)
  A1 ─────────────────────────────  Recruit → Explorer
  A2 ─────────────────────────────  Traveler → Communicator
  B1 ─────────────────────────────  Storyteller → Negotiator
  B2 ─────────────────────────────  Ambassador → Scholar
  C1/C2 ──────────────────────────  Master → Legend

  XP · misiones · boss battles · árboles de habilidad
  progreso INDEPENDIENTE por Speaking/Listening/Reading/Writing
  cosméticos · insignias · coleccionables · temporadas
```

**Reglas (para que no se corrompa ni infantilice):**
- **Progresión privada por defecto.** Nada de rankings públicos que humillen al que avanza lento (equidad). El estudiante compite contra sí mismo; comparar es opt-in.
- **XP por dominio, no por clics** (coherente con `REDISENO_AULA_VIRTUAL_2026.md` §11): se gana al demostrar can-do's, no al entregar.
- **Estética profesional, no Duolingo infantil.** Debe servir desde primaria hasta 11°.
- **Arquitectura agnóstica de materia:** el sistema de XP/identidad/árboles vive en una capa propia (`LearningIdentity`) para que mañana Matemáticas, Programación o Ciencias se enchufen — **pero esas materias NO se construyen ahora**, solo no se precluyen.

> Diferenciador profundo: el estudiante construye **una sola identidad de aprendizaje en Edusyn** que trasciende el inglés. Eso es retención e identidad, no una racha de Duolingo.

---

## 12. Anti-fraude (elevar el costo de hacer trampa, sin biometría obligatoria)

Capas combinables, todas **señales de revisión para el docente**, ninguna acusación automática:
- Oral espontáneo (consigna revelada al momento), tiempo limitado, imagen/prompt generado en el instante.
- Comparación audio↔texto (¿el hablado coincide con un texto pegado?), detección probabilística de *lectura* vs habla espontánea.
- Historial de fluidez del estudiante (un salto sospechoso → revisar, no sancionar).
- **Consistencia de voz: opt-in, señal blanda, nunca identidad ni bloqueo** (resolución de la tensión con "sin biometría": es ayuda al docente, no un voiceprint obligatorio).
- Principio: **subir el costo del fraude, no perseguir al estudiante.** Falsos positivos sobre menores son inaceptables.

---

## 13. Costo, orquestación y modelo de negocio

- **Reuso > generación:** un audio de Listening o un texto de Reading se generan **una vez** y se guardan en la Biblioteca Institucional → costo amortizado a casi cero con el uso.
- **Caché y degradación:** Reading/Writing/Listening usan el tier free del orquestador; **Speaking es el único tier caro** (ASR+pron. por enunciado) y se gobierna por cuota.
- **Precio por habilidad:** el entitlement bilingüe puede vender Reading/Listening/Writing en un tier base y **Speaking automático como add-on premium** (porque es el que cuesta dinero real por uso). Quien no paga Speaking automático, lo usa en modo manual (grabar + rúbrica docente).
- **Activación por institución:** vía el orquestador existente (multi-key, cuota, medición y caché ya implementados). Sin trabajo nuevo de infraestructura para "activar solo a quien paga".

---

## 14. Diferenciadores frente a la competencia

| Plataforma | Qué hace | Qué NO puede hacer (tu ventaja) |
|---|---|---|
| **Duolingo / ELSA** | Práctica de consumo, gamificada, pronunciación | No son el sistema de registro del colegio: **su evidencia no llega al boletín, ni al docente, ni a la competencia institucional**. App aislada. |
| **Moodle** | LMS abierto, plugins | Sin evaluación de habla nativa-integrada, UX pobre, sin evidencia lingüística reutilizable |
| **Google Classroom** | Distribución de tareas | No evalúa habilidades de idioma; no tiene competencias ni CEFR |
| **Canvas** | LMS institucional serio | Genérico, gringo, sin motor de idioma ni CEFR localizado; caro |
| **Pearson/plataformas de idiomas** | Contenido CEFR, exámenes | Cerradas, contenido fijo, **el docente no construye ni la evidencia se integra al SIS del colegio** |

**La frase que resume el moat:** *Duolingo te enseña inglés; Edusyn convierte cada palabra que dice el estudiante en evidencia que vive en su boletín, su competencia y su historia académica — dentro del aula, no en otra app.* Eso solo lo puede hacer quien ya es el sistema de registro del colegio. Edusyn lo es; las apps de idiomas no.

---

## 15. Análisis del moat (¿difícil de copiar en 10 años?)

- **Lo que NO es moat:** el motor de voz (lo compras; tu competidor también puede). El LLM (commodity). La gamificación (copiable).
- **Lo que SÍ es moat y hay que profundizar:**
  1. **Evidencia lingüística integrada al sistema de registro** (boletín + competencias + analítica). Una app de idiomas no puede copiar esto sin volverse el SIS del colegio — años de trabajo aburrido y de relaciones institucionales.
  2. **Dato longitudinal de habla por estudiante** (su trayectoria de inteligibilidad año a año). Solo lo tiene quien acompaña al estudiante varios años. Compone con el tiempo.
  3. **Banco institucional de activos de idioma** construido por los docentes (textos, audios, rúbricas, consignas) — crece con el uso y es propiedad del colegio.
  4. **Scoring por inteligibilidad con acento configurable + can-do's localizados** al currículo bilingüe colombiano — éticamente correcto y casi nadie lo hace.
- **Para hacerlo extremadamente difícil de copiar (cambios recomendados):**
  - **Portafolio de evidencia que viaja con el estudiante** entre años y grados (lock-in longitudinal).
  - **Calibración de can-do's propia y curada** (un activo de datos propietario, como el grafo canónico de la visión).
  - **La capa `LearningIdentity` transversal**: cuando la identidad de aprendizaje del estudiante abarca inglés + (mañana) matemáticas + ciencias, salirse de Edusyn cuesta *toda su identidad académica*, no solo un curso.

---

## 16. Roadmap — qué construir primero, qué dejar para después

### Fase 0 · Fundación sin voz (4–6 semanas) — valida la tesis barato
- Componentes **Reading, Listening, Writing** dentro de la actividad (los tres baratos).
- Listening con **TTS + caché en Biblioteca**. Writing con feedback LLM anclado a rúbrica.
- Evidencia → calificaciones + can-do's (sin pronunciación todavía).
- *Por qué primero:* prueba "todo genera evidencia" sin tocar el subsistema caro/riesgoso. Si esto no enamora a un colegio bilingüe, no construyas el motor de voz.

### Fase 1 · Speaking con proveedor turnkey (6–10 semanas) — el corazón
- Integrar `SpeechAssessmentProvider` (Azure/Speechace) detrás de interfaz.
- Scoring por **inteligibilidad**, acento configurable, métricas observables (sin "confianza").
- LLM solo explica. Docente valida. Degradación a rúbrica manual.
- Entitlement premium + cuota vía orquestador.

### Fase 2 · Identidad y gamificación (8–12 semanas)
- Capa `LearningIdentity` genérica (XP, árboles por habilidad, temporadas), estética profesional, progreso privado.
- CEFR↔RPG mapping; can-do's como competencias.

### Fase 3 · Profundidad y moat (continuo)
- Portafolio longitudinal, anti-fraude avanzado, Speaking en vivo (Play), analítica predictiva por habilidad.

### En espera explícita (NO construir ahora)
- Extender la gamificación a otras materias (solo dejar la arquitectura lista).
- Motor de voz propio (seguir comprando hasta que la escala lo justifique).

---

## 17. Visión 2035

Para 2035, un estudiante de un colegio bilingüe Edusyn habrá construido, desde primaria, un **portafolio vivo de su lengua**: miles de enunciados convertidos en evidencia, una trayectoria de inteligibilidad que su profesor de 11° puede ver desde 3°, una identidad de aprendizaje que abarca el inglés y más allá. El colegio no "usa una app de idiomas": **el idioma es una capacidad nativa de su Aula Virtual**, gobernada por sus docentes, alineada a su PEI bilingüe, y tan integrada a la vida académica que pensar en evaluarlo "por fuera" resultaría absurdo. Esa naturalidad — que el habla del niño sea, sin fricción, evidencia académica — es lo que ninguna plataforma de consumo podrá replicar, porque requiere ser, antes que nada, el sistema de la institución.

---

## 18. Veredicto estratégico

**¿Tiene potencial de ser uno de los principales diferenciadores de Edusyn para instituciones bilingües? Sí — alto.** Es uno de los pocos lugares donde la filosofía "todo genera evidencia" produce algo que las apps de idiomas (el competidor natural en bilingüismo) *estructuralmente no pueden copiar*, porque no son el sistema de registro del colegio.

**Los cuatro cambios que lo vuelven difícil de copiar en 10 años:**
1. **Comprar el motor de voz, no construirlo** — y poner el esfuerzo en la evidencia integrada (donde está el moat).
2. **Puntuar inteligibilidad, no acento nativo** — ético y diferenciador.
3. **CEFR como can-do's acumulados** enchufados al grafo de competencias — honesto e integrado.
4. **Capa `LearningIdentity` transversal + portafolio longitudinal** — el lock-in que crece con los años y que un entrante no puede fabricar.

> Cierre: el LLE no le enseña inglés a Edusyn. Le enseña a Edusyn que cualquier capacidad humana —hablar, escribir, razonar— puede volverse evidencia viva dentro del aula. El inglés es solo la primera lengua que el Aula Virtual aprende a escuchar.
