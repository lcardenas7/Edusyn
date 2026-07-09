# Edusyn Learning Engine — Documento Fundacional (Visión 2035)

> Documento de Chief Product Officer + Learning Experience Architect. No es un rediseño de UI ni una
> especificación técnica. Es la **constitución del aprendizaje en Edusyn**: la referencia con la que se
> juzga toda decisión sobre cómo aprende un estudiante en la plataforma durante los próximos 15 años.
> Complementa `VISION_PRODUCTO_2030.md` y `PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md`, y los trasciende en un
> punto: define el **motor** que gobierna el aprendizaje, no solo la experiencia de una lección.
>
> **Documentos hermanos (leer en orden):**
> 1. `EDUSYN_LEARNING_ENGINE.md` — este (visión + principios).
> 2. `LEARNING_ENGINE_ARCHITECTURE.md` — capas, eventos, flujos de datos, APIs internas, integración.
> 3. `LEARNING_EXPERIENCE_SPEC.md` — cómo vive el estudiante cada experiencia: estados, transiciones, evidencia.

---

## 0. La tesis (y por qué es un paradigma nuevo)

Toda plataforma educativa existente tiene como **objeto primario el contenido** (curso, lección, ejercicio,
video) e *infiere* el aprendizaje a partir de completarlo. Ese es el límite de Moodle, Classroom, Canvas,
Duolingo y Brilliant por igual: **ninguna tiene un modelo vivo de la mente del estudiante que gobierne el
sistema.**

> **Edusyn invierte el objeto.** Lo soberano no es el contenido: es el **estudiante modelado**. El contenido
> es solo un *actuador*. El Learning Engine es un **lazo cerrado de control de competencia** que reduce, con
> evidencia, la distancia entre lo que el estudiante puede hacer hoy y una competencia que le importa.

**La frase que lo captura:** *las demás plataformas te muestran contenido y esperan que aprendas; Edusyn
modela tu mente, decide qué necesitas, te lo hace vivir como una experiencia, mide que de verdad lo
aprendiste, agenda cuándo repasarlo antes de que lo olvides, y hace que todo el colegio lo sepa.*

---

## 1. Principios científicos (10, fundamentados)

1. **Aprender es cambiar la memoria a largo plazo, no "hacer actividad"** (Kirschner, Sweller & Clark, 2006). → El engine mide *aprendizaje*, no *completar*. Engagement sin retención es ruido.
2. **Se aprende recuperando con esfuerzo, no releyendo** (testing effect, Roediger & Karpicke; desirable difficulties, Bjork). → Toda interacción es *recuperación con feedback*.
3. **Contra el olvido: espaciado + entrelazado** (Ebbinghaus; spacing/interleaving). → El engine **reintroduce** competencias en el momento de casi-olvido. **(→ eje Tiempo, §5.3.)**
4. **La memoria de trabajo es finita** (carga cognitiva, Sweller). → Eliminar carga extraña; gestionar la intrínseca con andamiaje (ejemplo resuelto → desvanecido).
5. **El error es información, no fracaso** (productive failure, Kapur; feedback, Hattie & Timperley). → El error es el punto de máxima enseñanza; el feedback va sobre el *proceso*.
6. **Dificultad óptima = ZDP + flow** (Vygotsky; Csikszentmihalyi). → El engine calibra la dificultad por estudiante, en tiempo real.
7. **Motivación intrínseca = autonomía + competencia + relación** (Deci & Ryan, SDT). → Nada de premios extrínsecos que erosionan. **(→ Modo Exploración = autonomía, §9; aprendizaje social = relación, §10.)**
8. **El significado se construye en contexto auténtico y transfiere** (constructivismo). → Aprender aplicando a problemas reales, no ítems descontextualizados.
9. **La metacognición multiplica el aprendizaje** (Zimmerman; Flavell). → Reflexión y autorregulación estructuradas. **(→ el ADN modela la autorregulación, §5.2.)**
10. **Emoción y narrativa consolidan** (curiosity gap, Loewenstein; consolidación afectiva). → La historia y la curiosidad son *mecanismo de retención*, no adorno. **(→ Memoria episódica, §5.4.)**

---

## 2. Filosofía: ¿qué significa aprender en Edusyn?

> **Aprender no es avanzar por contenido. Es reducir, con evidencia y en el tiempo, la distancia entre lo
> que el estudiante puede hacer hoy y una competencia que le importa — en un proceso que el sistema modela,
> adapta, acompaña y recuerda.**

No "viste el video". Sino: *"tu dominio de 'describir tu familia' pasó de 22% a 78% con evidencia, quedó
agendado para repaso en 9 días, y desbloqueó una competencia vecina."* El aprendizaje es un **cambio de
estado medible en tu Núcleo**, no una pantalla completada.

---

## 3. ¿Qué reemplaza a la "Lección"?

La lección **no desaparece: se degrada de rango.** Sigue siendo una **herramienta interna del docente**
(planear, secuenciar, alinear al currículo). El estudiante **nunca** percibe "una lección".

**El objeto soberano es el Núcleo de Aprendizaje (§5).** Alrededor de él, cada actor ve el aprendizaje con
su lente:

| Actor | Lo vive como… | Objeto |
|---|---|---|
| **Estudiante** | una **Experiencia / Misión / Reto** | Experiencia |
| **Docente** | una **Lección / planeación** (interna) | Lección |
| **Institución** | **competencias** fortalecidas + evidencia | Grafo |
| **El Engine** | un **estado del Núcleo** que reduce una brecha | Núcleo |

Una misma verdad ("hoy trabajaste describir tu familia") se proyecta distinto para cada uno. **Nadie ve el
objeto del otro.** Eso es lo que ninguna plataforma hace.

---

## 4. El objeto soberano: el Núcleo de Aprendizaje (Edusyn Learning Core)

> Un modelo **vivo, privado y explicable** por estudiante. No es un perfil estático ni un porcentaje: es un
> organismo con cuatro dimensiones que evolucionan.

```
              ┌───────────────────────────────────────────────┐
              │        NÚCLEO DE APRENDIZAJE (por estudiante)  │
              ├───────────────────────────────────────────────┤
   ¿QUÉ sabe? │ ① DOMINIO   · el "Twin": dominio por competencia
   ¿CÓMO?     │ ② ADN       · Learning DNA: cómo aprende (rasgos dinámicos)
   ¿CUÁNDO?   │ ③ TIEMPO    · Timeline: aprendió / olvidará / recuperar
   ¿HISTORIA? │ ④ MEMORIA   · Learning History: la historia episódica
              └───────────────────────────────────────────────┘
```

### 4.1 ① Dominio (Competency Twin) — *qué sabe*
Dominio (0–100) por cada competencia del grafo, derivado de evidencia acumulada. Es el "gemelo cognitivo":
lo que puede demostrar. (Ya existe en germen: `LearningIdentity` + `CompetencyEvidence` + `mastery`.)

### 4.2 ② ADN de Aprendizaje (Learning DNA) — *cómo aprende*
La innovación que faltaba. Una capa **encima** del Dominio que responde *cómo* aprende este estudiante, con
rasgos **dinámicos** (no etiquetas fijas, no diagnósticos):
- **Ritmo** (rápido/reflexivo), **Persistencia** (ante el error), **Curiosidad** (explora vs. sigue),
  **Necesidad de andamiaje**, **Transferencia** (aplica a contextos nuevos), **Autorregulación**,
  **Preferencia de modalidad** (visual/auditiva/manipulativa) como *observación conductual*, no como estilo fijo.
- **Regla ética:** el ADN existe para **adaptar la experiencia**, jamás para **etiquetar, ordenar o
  predecir un destino**. Es reversible, revisable por el docente, y nunca visible como un juicio sobre la persona.
- **Es identidad de aprendiz**, no de persona: *"disfruta retos, le cuesta iniciar, alta perseverancia"* → el
  sistema le ofrece un reto inicial atractivo y lo sostiene en la meseta, sin decirle que "es así".

### 4.3 ③ Línea de Tiempo (Learning Timeline) — *cuándo*
Aprender ocurre **en el tiempo**. Por cada competencia dominada, el Núcleo modela:
- **cuándo** se alcanzó el dominio,
- **cuándo se predice el olvido** (curva de retención personalizada — Ebbinghaus modulado por el ADN),
- **cuándo tocará recuperarla** (repaso espaciado óptimo).
Esto convierte al engine de un "avanzador lineal" en un **gestor del olvido**: reintroduce lo que estás a
punto de perder. Ninguna competencia se "termina": entra en un ciclo de retención.

### 4.4 ④ Memoria (Learning History) — *la historia*
El Núcleo **almacena recuerdos**, no solo estados. La trayectoria episódica de cada competencia:
```
aprendió → la dominó → la olvidó parcialmente → la recuperó → la conectó con otra
```
Esto vuelve al Núcleo una **historia de aprendizaje** (portafolio longitudinal vivo), no un porcentaje. Es el
dato que compone con los años y que **ningún entrante puede fabricar** — el moat, hecho memoria.

---

## 5. Arquitectura conceptual (el lazo cerrado)

Ocho capas; un lazo. (Detalle técnico en `LEARNING_ENGINE_ARCHITECTURE.md`.)

```
   L0 CEREBRO INSTITUCIONAL  · PEI · DBA · currículo · políticas · cultura   (restricciones)
   L1 GRAFO DE COMPETENCIAS  · el mapa del dominio                           (referencia)
   L2 ★ NÚCLEO DE APRENDIZAJE ★ · Dominio + ADN + Tiempo + Memoria           (estado, soberano)
        │
        ▼ (el lazo)
   L3 MOTOR DE DECISIÓN  ─── decide la próxima experiencia ───► L6 VALERIA (capa pedagógica)
        ▼
   L4 BANCO DE EXPERIENCIAS  ── actúa ──►  L7 SUPERFICIE VIVA  (la interfaz, última)
        ▼ el estudiante actúa
   L5 MOTOR DE EVIDENCIA  ── sensa ──► actualiza L2 (Núcleo) y L1 (grafo) ── y el ciclo se repite
```

El lazo: **Núcleo (estado) → Motor (decide) → Experiencia (actúa) → Evidencia (sensa) → Núcleo (actualiza).**
El docente fija los *setpoints* (§7); el Cerebro aporta *restricciones* y *cultura*; Valeria es el
*controlador pedagógico*; la interfaz solo *renderiza el estado actual*.

---

## 6. El recorrido del estudiante (arco de momentos)

No es una secuencia fija: es el lazo, vivido como momentos cognitivos (no como pantallas):

```
DESCUBRIR   → crea la brecha (curiosidad + narrativa)
COMPRENDER  → input con andamiaje calibrado a TU ZDP (ejemplo resuelto → desvanecido)
EXPERIMENTAR→ recuperación guiada, feedback inmediato; el dominio sube a la vista
PRACTICAR   → recuperación autónoma; cada intento = evidencia
[ERROR]     → Valeria entra: explica el proceso, reintento más andamiado
REFLEXIONAR → metacognición (consolida)
DOMINAR     → reto sin andamiaje → evidencia suficiente → can-do demostrado
   ▼
El Núcleo se actualiza · el grafo desbloquea vecinos · el Timeline AGENDA el repaso
```
Termina en *"tu Núcleo cambió y ya sé cuándo volveré a ponerte esto"*, no en "lección completada".

---

## 7. El docente — amplificado y creador de cultura

El docente es el **arquitecto de setpoints** y el **creador de cultura**. Nunca pierde el mando pedagógico.
- **Fija setpoints:** objetivos (competencias), grado de autonomía del Motor (dial de "fijo" ↔ "adaptación total"),
  participación de Valeria, momentos obligatorios, límites de dificultad.
- **Crea cultura** (lo que ChatGPT señaló, y es clave): define **qué se valora** (esfuerzo vs. acierto),
  el **tono**, las **normas de colaboración**, qué se celebra y cómo. La cultura de aprendizaje del aula es
  configurable y el Motor la respeta — dos aulas del mismo colegio pueden *sentirse* distintas por decisión del docente.
- **Recibe del lazo** lo que ningún LMS le da: *"12 de 30 no demuestran A2 Listening; María falla en el verbo;
  el grupo está listo para B1 en Reading"* — accionable, por competencia.
- **Principio sagrado:** el Motor **nunca decide solo** sobre lo crítico (notas, promoción, juicios). Propone; el docente dispone.

El docente diseña el *terreno*; el Motor traza el *camino* de cada estudiante.

---

## 8. El Cerebro Institucional — personalización con identidad

El Cerebro (L0) hace la experiencia de *esta* institución, no genérica. Alimenta el lazo con currículo/DBA/PEI
(qué priorizar), historial/observador/asistencia/evaluaciones (el Núcleo arranca informado), estilo del docente
y del colegio, familia e intereses (contexto y motivación). Y **evoluciona**: cada evidencia mejora el modelo
agregado del colegio. Es un activo de datos que compone con los años.

**Riesgo ético (máxima prioridad):** predicción sobre menores (Ley 1581 / Habeas Data). Principio-faro:
**el Núcleo del estudiante existe para activar ayuda humana, nunca para etiquetarlo, ordenarlo ni mostrarle un
destino.** Privado, explicable, al servicio del estudiante. (Gobernanza en `LEARNING_ENGINE_ARCHITECTURE.md`.)

---

## 9. Curiosidad y autonomía — el Modo Exploración

El lazo no puede ser una jaula. La autonomía (SDT) exige que el estudiante pueda **desviarse**:
- **Explorar el grafo:** ver competencias vecinas, adelantarse por curiosidad ("¿y esto qué es?").
- **Preguntar a Valeria** por iniciativa propia (una de las pocas veces que ella responde a demanda).
- **Curiosear libremente:** contenido de descubrimiento sin evaluación, que *no penaliza* y sí **nutre el ADN**
  (la curiosidad observada sube el rasgo Curiosidad).
- **El Motor lo integra:** una exploración no es "salirse del camino"; es señal. El Motor puede reorientar la
  ruta hacia el interés detectado. La curiosidad se **premia con más autonomía**, no se corrige.

Sin esto, Edusyn sería un tutor eficiente pero sin alma. Con esto, es un lugar donde da gusto perderse.

---

## 10. Aprendizaje social — Edusyn es escolar

El aprendizaje no ocurre solo entre estudiante–Motor–Valeria. Ocurre **entre pares**. El engine incorpora
**experiencias colaborativas** como ciudadanas de primera clase:
- **Misiones en pareja/grupo** (co-construir, enseñarse mutuamente — el que explica, aprende doble).
- **Evidencia compartida** que alimenta el Núcleo de cada participante según su aporte.
- **Cultura del aula** (definida por el docente, §7) que gobierna la colaboración (competitiva vs. cooperativa).
- **Progreso privado por defecto** (equidad): la comparación es opt-in; nunca rankings que humillen.

La "relación" de la SDT no es decorativa: es un tercio de la motivación. Un sistema puramente individual la desperdicia.

---

## 11. Conexión con el resto de Edusyn (nada aislado)

El Núcleo y el grafo son el **bus común**: cuando el estudiante aprende, **todo se actualiza solo**.

| Módulo | Cómo se conecta al lazo |
|---|---|
| **Aula Virtual** | Las experiencias *son* pasos de las Rutas; la evidencia fluye a competencias |
| **Workspace Docente** | Diseña lecciones/experiencias, fija setpoints y cultura; ve el Núcleo agregado |
| **Evaluación** | La nota es *subproducto* de la evidencia; evalúa competencias, no llena una planilla aislada |
| **Seguimiento / Observador** | Un desplome de dominio o de racha dispara alertas; el observador informa al Núcleo |
| **Edusyn Play** | Motor separado hoy; a futuro, práctica espaciada gamificada que también emite evidencia |
| **Planeación** | Currículo/DBA (Cerebro) restringen qué prioriza el Motor |
| **Reportes** | Reflejan *dominio, memoria y evidencia longitudinal*, no "actividades completadas" |
| **Valeria** | Transversal: una sola voz en aula, reportes y Workspace |

Regla: **una sola verdad (Núcleo + grafo), muchas proyecciones.**

---

## 12. La experiencia emocional (diseñada, no accidental)

| Momento | Debe sentir | Mecanismo |
|---|---|---|
| Descubrir | **Curiosidad** | brecha narrativa + misterio |
| Comprender | **Claridad** | andamiaje a su ZDP |
| Practicar | **Competencia creciente** | dominio que sube a la vista |
| Equivocarse | **Seguridad** | Valeria cálida, sin castigo |
| Explorar | **Descubrimiento** | autonomía real (§9) |
| Colaborar | **Pertenencia** | experiencias sociales (§10) |
| Reflexionar | **Consciencia** | metacognición |
| Dominar | **Orgullo real** | can-do desbloqueado en su grafo |
| Repaso (después) | **Confianza** | espaciado exitoso |

Lo que **NO** debe sentir: ansiedad por la nota, aburrimiento por repetición vacía, humillación por comparación,
o el vacío de un premio sin sentido. **Sin gamificación superficial.**

---

## 13. La interfaz (la última consecuencia)

La interfaz solo *renderiza el estado del lazo*. Es una **Superficie Viva**, no pantallas:
- Lienzo continuo y calmado que **morfa** según el momento cognitivo (leer ≠ decidir ≠ crear ≠ reflexionar) sin
  "cambiar de diapositiva".
- **El héroe permanente: el medidor de dominio** de la competencia (sube en vivo). No hay "1/11".
- **Journey Rail** (momentos nombrados) que **se adapta** — el estudiante ve que el camino le respondió.
- **Valeria = presencia ambiental** que crece inline y se repliega.
- **Color = significado** (habilidad + feedback + dominio), nunca decoración. Un acento por pantalla.
Especificación completa por escenario en `LEARNING_EXPERIENCE_SPEC.md` §.

---

## 14. Roadmap evolutivo (5 años, sin romper lo actual)

Construir el lazo **por dentro, reusando lo que ya existe.** No es un big-bang.

- **Año 0–1 · Hacer real el Núcleo (cimiento):** consolidar `LearningIdentity` + `CompetencyEvidence` + `mastery`
  en un **Learning Core** explícito con las 4 dimensiones (empezando por Dominio + Tiempo). Superficie F0
  (canvas, contraste, medidor de dominio como héroe).
- **Año 1–2 · Motor de Decisión v1 (reglas):** adaptación por heurísticas + repaso espaciado (Timeline). Valeria inline en el error.
- **Año 2–3 · Banco de Experiencias + narrativa + ADN v1:** experiencias como misiones; el ADN empieza a observar rasgos.
- **Año 3–4 · Adaptación profunda + Cerebro + social:** IA elige la próxima mejor experiencia; PEI/DBA moldean; experiencias colaborativas; Modo Exploración.
- **Año 4–5 · El SO del aprendizaje:** todo el ecosistema lee/escribe el Núcleo; Memoria/portafolio longitudinal; Valeria proactiva institucional.

Cada fase entrega valor sola y no rompe la anterior porque todas se apoyan en el mismo estado (Núcleo + grafo).

---

## 15. Cómo se usa este documento

- Toda decisión sobre aprendizaje responde: *¿sirve a un principio del §1? ¿respeta la soberanía del Núcleo (§4)?
  ¿el docente conserva el mando (§7)? ¿protege al estudiante (§8)?*
- Si una propuesta trata el aprendizaje como *entrega de contenido*, se rechaza o se rediseña.
- Es un documento vivo; cambiar la tesis o un principio es decisión de fundadores.

> **La estrella polar:** *Edusyn no reproduce contenido. Modela cómo aprende cada estudiante, decide qué
> necesita, se lo hace vivir, mide que lo aprendió, recuerda cuándo repasarlo — y lo transforma en competencia
> que vive en su historia académica.*
