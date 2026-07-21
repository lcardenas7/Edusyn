# 📕 PRODUCT BIBLE — El Taller (Workspace Colaborativo de Edusyn) · Expedición ABP

> **Documento fundador y fuente de verdad.** Define la visión completa del sistema. No contiene
> código. Se consulta SIEMPRE: cada motor, instrumento, componente y pantalla se implementa leyendo
> esta especificación, no reinterpretando conversaciones.
>
> **Estado:** 🧊 **CONGELADA · v2.0 — DOCUMENTO FUNDADOR** (2026-07-17). La arquitectura queda
> cerrada. No se vuelve a modificar antes de wireframes. Un cambio de visión = edición explícita con
> fecha/motivo + incremento de versión; nunca "en el chat".
>
> **Regla innegociable:** no se escribe una sola línea de código del rediseño hasta terminar la
> etapa de diseño (Wireframes → Diseño visual → Prototipos). Ver §26.
>
> **La frase que lo resume todo:**
> *No estamos diseñando una interfaz para hacer ABP. Estamos diseñando **el lugar donde ocurre el
> aprendizaje colaborativo**.*
>
> **Gate de toda decisión de diseño:** *"¿Esto hace que un equipo tenga más ganas de reunirse aquí
> que en un Google Doc compartido?"*

---

## Tabla de contenido
- [0. Cómo usar este documento](#0-cómo-usar-este-documento)
- [1. Principios del Taller (la filosofía permanente)](#1-principios-del-taller-la-filosofía-permanente)
- [2. Filosofía y diferenciación](#2-filosofía-y-diferenciación)
- [3. Arquitectura: separar el Workspace de la Pedagogía](#3-arquitectura-separar-el-workspace-de-la-pedagogía)
- [4. Integración total en el Aula Virtual](#4-integración-total-en-el-aula-virtual)
- [5. Motores → Configuración → Instrumentos → Dinámicas](#5-motores--configuración--instrumentos--dinámicas)
- [6. Modalidades de Instrumento](#6-modalidades-de-instrumento)
- [7. Objetos Universales y sus Relaciones (el grafo del proyecto)](#7-objetos-universales-y-sus-relaciones-el-grafo-del-proyecto)
- [8. Artefactos Vivos](#8-artefactos-vivos)
- [9. ExpeditionDNA (el ADN del proyecto)](#9-expeditiondna-el-adn-del-proyecto)
- [10. Hitos](#10-hitos)
- [11. Biblioteca del Proyecto (base de conocimiento)](#11-biblioteca-del-proyecto-base-de-conocimiento)
- [12. Modelo Pedagógico ABP (Estaciones y Espacios)](#12-modelo-pedagógico-abp-estaciones-y-espacios)
- [13. Ecosistema de componentes visuales](#13-ecosistema-de-componentes-visuales)
- [14. Crew System y Estado de Colaboración](#14-crew-system-y-estado-de-colaboración)
- [15. Timeline transversal](#15-timeline-transversal)
- [16. Cuartel General (workspace del estudiante)](#16-cuartel-general-workspace-del-estudiante)
- [17. Cockpit del Docente](#17-cockpit-del-docente)
- [18. Valeria — mentora contextual](#18-valeria--mentora-contextual)
- [19. Estados pedagógicos y Modos narrativos](#19-estados-pedagógicos-y-modos-narrativos)
- [20. Gamificación integrada](#20-gamificación-integrada)
- [21. Design System y gramática visual](#21-design-system-y-gramática-visual)
- [22. Catálogo de Estados](#22-catálogo-de-estados)
- [23. Colaboración: asíncrono-primero](#23-colaboración-asíncrono-primero)
- [24. Sistema de validación](#24-sistema-de-validación)
- [25. Lenguaje canónico (glosario)](#25-lenguaje-canónico-glosario)
- [26. Roadmap, gobernanza y congelamiento](#26-roadmap-gobernanza-y-congelamiento)

---

## 0. Cómo usar este documento
- **Autoridad:** esta Biblia vence sobre cualquier conversación. Si algo no está aquí, se define
  aquí antes de construirlo.
- **Vocabulario obligatorio:** §25. Nunca "actividad" (es Instrumento); nunca "plataforma
  independiente" (es Workspace del Aula); nunca inferir emociones (es Estado de Colaboración).
- **Cambios:** editar el documento con fecha/motivo + subir versión. Nunca decidir "en el chat".

---

## 1. Principios del Taller (la filosofía permanente)

> Esta es la brújula. Cuando dentro de tres años alguien construya un instrumento nuevo, esta página
> le dirá de inmediato si respeta la visión o la rompe. **Todo lo demás deriva de aquí.**

1. **El Taller nunca está vacío.** Siempre muestra vida (actividad, presencia, memoria).
2. **El Taller nunca pierde información.** Autosave, escritura atómica, tolerante a fallos y offline.
3. **El Taller nunca hace trabajar dos veces.** La información fluye y se reutiliza; no se recaptura.
4. **El Taller siempre sabe cuál es el siguiente paso.** Siempre hay una decisión siguiente evidente.
5. **El Taller celebra el progreso.** Cada avance con sentido tiene su momento.
6. **El Taller acompaña; nunca dirige.** La IA y el sistema sugieren; el equipo decide.
7. **El Taller favorece la conversación, no el formulario.** Se construye hablando y haciendo juntos.
8. **El Taller convierte ideas en conocimiento.** El proyecto deja una base de conocimiento, no respuestas sueltas.

**Prueba de aceptación de cualquier funcionalidad:** ¿respeta los 8 principios? Si rompe alguno,
está mal diseñada, por muy útil que parezca.

---

## 2. Filosofía y diferenciación

### ¿Qué ES?
**El Taller** es el **Workspace colaborativo de Edusyn**: el lugar, dentro del Aula Virtual, donde
un equipo del curso **construye conocimiento** trabajando junto. **Expedición ABP** es la primera
**Experiencia** que vive en ese Workspace, usando el **Modelo Pedagógico ABP**. El estudiante siente:
*"estoy sacando herramientas del taller para construir con mi equipo"* — sin salir nunca del Aula.

### ¿Qué NO es?
No es una plataforma aparte, ni un curso, ni una Lección, ni una Ruta, ni un formulario, ni un Miro
vacío. **Si aparece un scroll infinito de cajas de texto, hemos fallado.**

### Diferenciación
| Frente a… | Ellos | El Taller |
|---|---|---|
| **Ruta / Lección** (Edusyn) | Consumir contenido, individual | **Producir** un artefacto **en equipo** |
| **Miro / FigJam** | Lienzo libre y vacío, sin pedagogía | Lienzo **con propósito**: modelo pedagógico, guía, validación, gamificación |
| **Notion** | Documento frío y genérico | **Objetos con relaciones**, colaborativo, con identidad de taller y narrativa |
| **Google Doc compartido** | Editar texto juntos | Un **lugar** donde da ganas de reunirse: presencia, momentos, conocimiento vivo |

---

## 3. Arquitectura: separar el Workspace de la Pedagogía

> **La decisión fundacional de la v2.0.** El **Workspace pertenece al sistema**; la **Estación
> pertenece al ABP**. Son capas distintas. El Workspace debe existir aunque mañana creemos otra
> experiencia pedagógica.

### 3.1 Jerarquía correcta
```
Institución
  → Curso
     → Experiencia
        → WORKSPACE            (sistema · reutilizable · "El Taller")
           → MODELO PEDAGÓGICO (plugin · define la estructura del proyecto)
              → ABP            (un modelo)
                 → Estaciones  (estructura propia de ABP)
                    → Espacios de Trabajo
```
El **mismo Workspace** servirá mañana para **Design Thinking, Aprendizaje Basado en Retos,
Investigación Científica, Hackathon, Laboratorio…** sin construir otro. Cada uno es un **Modelo
Pedagógico** distinto montado sobre el mismo Taller. *Eso hace que Edusyn escale muchísimo.*

### 3.2 Qué pertenece a cada capa (separación estricta)
| Capa de SISTEMA (Workspace — reutilizable) | Capa PEDAGÓGICA (Modelo — específica de ABP) |
|---|---|
| Paneles y ecosistema visual (§13) | Estaciones (las 6 fases) (§12) |
| Motores → Instrumentos → Dinámicas (§5) | Espacios de Trabajo y qué instrumentos en cada uno |
| Objetos Universales + Relaciones (§7) | Criterios de completitud por estación |
| Crew System + Estado de Colaboración (§14) | Flujo de validación y rúbricas |
| Timeline transversal (§15) | Secuencia y desbloqueos de estaciones |
| Biblioteca del Proyecto (§11) | Los Hitos concretos de ABP |
| Valeria (§18), Gamificación (§20), Gramática visual (§21) | El "guion" pedagógico (qué se hace en cada momento) |
| ExpeditionDNA como contrato (§9) | Los **valores** del ADN para ABP |

**Regla de oro:** un Modelo Pedagógico nuevo **no toca el Workspace**; solo declara su estructura
(estaciones/espacios/instrumentos/criterios) vía su configuración. El Workspace la renderiza.

---

## 4. Integración total en el Aula Virtual

Expedición **no es independiente**: vive dentro del Aula. Jerarquía real: `Institución → Curso →
Estudiantes → Equipos → Experiencias → Expedición`. El estudiante **nunca siente que salió del Aula**
y la navegación siempre mantiene el contexto del curso.

**Reutiliza los servicios del Aula (no duplica):** Usuarios/Identidad · Equipos · Permisos/Roles ·
Archivos/Storage · Comentarios · Notificaciones · Valeria (orquestador IA) · Calificaciones. El
Taller aporta **únicamente la experiencia colaborativa**; para el usuario sigue siendo **un único
Aula Virtual**, internamente extensible (§5, §9).

---

## 5. Motores → Configuración → Instrumentos → Dinámicas

> **Instrumentos ≠ Motores.** No construimos 60 instrumentos: construimos **~10 Motores muy sólidos**
> de los que nacen decenas de Instrumentos por **configuración**, y sobre cada uno el docente elige
> una **Dinámica** (metodología). Edusyn ya tiene motores: eso es oro y se reutiliza.

### 5.1 La cadena
```
MOTOR          (fundación técnica sólida y reutilizable)
   ↓ configuración
INSTRUMENTO    (motor configurado con propósito pedagógico → "Instrumento Board")
   ↓ dinámica seleccionada por el docente
DINÁMICA       (la metodología: Brainstorm, 6-3-5, SCAMPER, Crazy 8…)
```

### 5.2 Catálogo de Motores (~10) → Instrumentos que nacen de ellos
| Motor | Qué es | Instrumentos (por configuración) |
|---|---|---|
| **Board** | Lienzo espacial 2D con objetos libres | Brainstorm, Mapa de Afinidad, Crazy 8, Post-it libre |
| **Graph** | Nodos + conexiones | Árbol de problemas, Mapa Mental, Mapa de Actores, Diagramas, 5 Porqués |
| **Cards** | Colección de fichas | Checklist, Evidencias, Personas, Actores, Galería |
| **Flow** | Columnas / etapas | Kanban, pipeline, embudo |
| **Timeline** | Eje temporal | Cronograma, Línea histórica, Diario, Bitácora |
| **Matrix** | Celdas por ejes | Matriz 2×2, FODA, Impacto/Esfuerzo, Eisenhower |
| **Poll** | Preferencia colectiva | Votación, Priorización, Encuesta, Decisión |
| **Frame** | Campos guiados (plantilla) | Canvas del reto, SMART, Contexto, Business Canvas |
| **Doc** | Documento rico | Notas, Conclusiones, Decisiones, Resumen |
| **Media** | Captura/reproducción (storage) | Evidencias, Fotos, Videos, Audios, Entrevistas |

> Un instrumento nuevo casi nunca es un motor nuevo: es **una configuración** de un motor existente.
> Escala 12 → 25 → 60 instrumentos **sin** 60 desarrollos.

### 5.3 Dinámicas configurables por el docente
El mismo motor sirve para metodologías distintas. No decimos "Instrumento → Brainstorm"; decimos:
```
Instrumento Board → Dinámica seleccionada → { Brainstorm | 6-3-5 (Brainwriting) | SCAMPER | Crazy 8 | Mapa de Afinidad }
```
La **Dinámica** cambia la guía, las reglas y el acompañamiento de Valeria — **no los datos** (los
Objetos son los mismos). El docente la elige al configurar el instrumento.

### 5.4 El Manifiesto de Instrumento (contrato declarativo)
Cada instrumento se declara con: **motor** · **configuración** · **dinámicas disponibles** ·
**modalidad de apertura** (§6) · **Objetos Universales que usa** · **capacidades requeridas** ·
**artefacto que produce** · **criterio de completitud** · **espacio pedagógico por defecto** ·
**plantillas disponibles**. Añadir un instrumento = añadir un manifiesto; **no toca el Workspace**.

---

## 6. Modalidades de Instrumento

No todos los instrumentos abren igual. La **modalidad** es una propiedad del manifiesto (§5.4).

| Modalidad | Cuándo | Instrumentos ejemplo |
|---|---|---|
| **Overlay (foco)** | Trabajo expansivo que merece toda la atención | Brainstorm, Mapa Mental |
| **Canvas completo** | Trabajo espacial grande y persistente | Canvas, Kanban, Timeline, Diagramas |
| **Panel lateral** | Apoyo consultable mientras se trabaja | Notas, Comentarios, Checklist |
| **Bottom Sheet** | Captura puntual (sobre todo táctil) | Adjuntar evidencia, Grabar audio, Subir imagen |
| **Modal rápido / Popover** | Micro-decisión atómica | Votar, Confirmar, Nombrar |

Regla: la modalidad **nunca "saca"** al estudiante del contexto de la estación; el Taller sigue vivo detrás.

---

## 7. Objetos Universales y sus Relaciones (el grafo del proyecto)

> Los Objetos existen **una sola vez** y los Instrumentos los **reutilizan** (sin lógica duplicada).
> Y —clave de la v2.0— los Objetos **se relacionan entre sí**: el proyecto es un **grafo de
> conocimiento**, no una lista.

### 7.1 Catálogo de Objetos Universales
**Post-it · Comentario · Voto · Nodo · Tarea · Archivo · Imagen · Video · Audio · Etiqueta ·
Checklist** (+ derivados: Decisión, Actor, Hito, Conexión, Campo, Idea). Archivo/Imagen/Video/Audio
se apoyan en el **Storage del Aula** (§4).

### 7.2 Capacidades transversales (mixins)
Cualquier objeto **compone**: Identidad/Autoría · Posición · Votabilidad · Comentabilidad ·
Adjuntabilidad · Historial · Estado · **Relacionabilidad** (nuevo).

### 7.3 Relaciones (el proyecto como grafo)
Los objetos se conectan con relaciones tipadas:
```
Idea —generó→ Tarea —tiene→ Evidencia —pertenece a→ Hito
```
Tipos de relación base: **generó / deriva-de · tiene / contiene · pertenece-a · responde-a ·
agrupa · evidencia-a · decide-sobre · bloquea-a**.

**Por qué importa:** convierte el proyecto en un **grafo** sobre el que **Valeria razona muchísimo
mejor** (detectar ideas sin tarea, tareas sin evidencia, evidencias huérfanas, decisiones sin
sustento) y sobre el que se construye la Biblioteca (§11) y la trazabilidad de los Artefactos (§8).

---

## 8. Artefactos Vivos
Los Artefactos **no son respuestas**: son el **conocimiento construido**. Cuando una estación
termina, **permanecen** (un Canvas, un Árbol, una Matriz siguen existiendo). Un Artefacto Vivo es el
**estado significativo de un subgrafo de objetos**, que **persiste**, es **trazable** (autoría),
**reutilizable/referenciable**, y es **lo que se valida** (§24). La Expedición **produce
conocimiento, no respuestas.**

---

## 9. ExpeditionDNA (el ADN del proyecto)

> Cada Expedición se define por un pequeño **objeto inicial** al que **todo el Workspace reacciona**.

```yaml
ExpeditionDNA:
  methodology: ABP            # el Modelo Pedagógico (mañana: DesignThinking, Reto, Hackathon…)
  duration: 6 semanas
  collaboration: equipos       # equipos | individual | curso
  validation: docente          # docente | pares | mixto
  evaluation: rúbrica          # rúbrica | insignias | nota
  stations: [...]              # estructura del modelo (para ABP: las 6)
  instruments: [...]           # instrumentos/dinámicas habilitados
  rhythm: [...]                # ritmo/modos esperados por fase
```
**El Workspace reacciona al ADN:** renderiza las estaciones declaradas, aplica el ritmo/modos (§19),
configura validación y evaluación, habilita instrumentos. El ADN es el **contrato** entre la Capa de
Sistema y la Capa Pedagógica (§3): cambiar de modelo pedagógico = cambiar el ADN, no el Workspace.

---

## 10. Hitos
Un **Hito** es un **estado del proyecto** (no una pantalla): una estación lo **genera** al cumplir
sus condiciones (instrumentos obligatorios completos + validación). Sirve para **celebrar**,
**desbloquear** la siguiente estación y **dar percepción clara del progreso**. Queda en el Timeline
(§15); su cara visible es el **Sello** (§20). El **Ritual de Validación** (§24), al aprobarse,
**produce el Hito**.

---

## 11. Biblioteca del Proyecto (base de conocimiento)

> No son solo plantillas: es una **biblioteca real** que **acumula** todo lo producido durante la
> Expedición y lo convierte en una **base de conocimiento** del equipo.

- Durante todo el proyecto se acumulan e **indexan**: Ideas · Archivos · Videos · Fotos ·
  Entrevistas · Encuestas · Links · Notas · Decisiones · Evidencias.
- **Todo reutilizable**: cualquier instrumento puede traer un objeto ya existente de la Biblioteca
  (coherente con "nunca hacer trabajar dos veces" — §1.3).
- **Buscable y relacionada**: al ser un grafo de objetos (§7), la Biblioteca no es una carpeta
  plana; es conocimiento conectado.
- Distinta de la **Biblioteca de Plantillas** (insumos de partida): esta es el **acervo producido**.
- Al final, la Biblioteca **es** el cuerpo de conocimiento del proyecto (base de la Presentación y
  de la evaluación, y memoria consultable después).

---

## 12. Modelo Pedagógico ABP (Estaciones y Espacios)

> Esta capa **pertenece a ABP**, no al Workspace (§3). Otro modelo pedagógico tendría otra estructura.

**6 Estaciones** (conservan 1:1 la lógica académica actual · `AbpPhaseState`):

| Código | Estación | Propósito | Fase real |
|---|---|---|---|
| EST-01 | El Terreno | Comprender el reto | Fase 1 · Canvas |
| EST-02 | La Chispa | Generar y elegir ideas | Fase 2 · Ideas+votación |
| EST-03 | La Brújula | Fijar el objetivo | Fase 3 · SMART |
| EST-04 | La Ruta | Planear el trabajo | Fase 4 · Kanban |
| EST-05 | La Fragua | Construir y evidenciar | Fase 5 · Prototipo |
| EST-06 | El Ágora | Presentar y coevaluar | Fase 6 · Socialización |

**Espacios de Trabajo:** secciones lógicas dentro de una estación que **agrupan instrumentos por
intención** (no son pantallas): Exploración · Análisis · Decisión · Construcción · Documentación ·
Validación · Conclusiones. Resuelven el caos de 18 instrumentos sueltos:
```
EST-01 · El Terreno → Exploración(4) · Análisis(3) · Documentación(2) · Validación(2)
```

---

## 13. Ecosistema de componentes visuales
No pensamos en páginas: **habitamos un lugar** (`Workspace → Paneles → Herramientas → Objetos`).
Componentes: **Crew Bar** · **Command Bar (⌘K/FAB)** · **Canvas** · **Mini Mapa** · **Dock superior**
(herramientas/dinámica) · **Dock inferior** (compuerta de validación) · **Panel lateral** ·
**Panel derecho** (inspector) · **Overlay** · **Bottom Sheet** · **Timeline transversal** (§15) ·
**Expedition Map** · **Reward Layer**. Todo **embebido en el marco del Aula** (nunca pantalla
completa que "expulse" del curso).

---

## 14. Crew System y Estado de Colaboración

> La presencia es un **sistema**, no una barra. **Se elimina "Crew Mood"**: inferir emociones de
> estudiantes es delicado y puede generar interpretaciones erróneas. Se reemplaza por un **Estado de
> Colaboración objetivo, basado en hechos.**

### 14.1 Subsistemas
| Subsistema | Responde | Basado en |
|---|---|---|
| **Crew Presence** | ¿Quién está aquí ahora? | conexión en vivo |
| **Crew Activity** | ¿Qué hace cada quien? | eventos reales (aportó, movió, votó, subió) |
| **Crew Roles** | ¿Quién es responsable de qué? | roles vivos (Facilitador, Investigador, Constructor) |
| **Crew Progress** | ¿Cómo va el equipo? | instrumentos completos, aportes por integrante |
| **Estado de Colaboración** | ¿Cómo va la colaboración? | **hechos objetivos** (ver 14.2) |

### 14.2 Estado de Colaboración (reemplaza a Crew Mood)
Estados **objetivos, no emocionales**: **Muy activo · Activo · Sin actividad reciente · Necesita
atención.** Se calcula de hechos: aportes recientes, nº de integrantes activos, tiempo desde la
última actividad, avance frente al plazo del ADN (§9).
- **Nunca infiere cómo se siente un estudiante.** Describe la colaboración, no a la persona.
- **Valeria usa esta señal para sugerir acciones** ("Este equipo no registra actividad hace 3 días,
  ¿les propongo un siguiente paso?"), sin asumir emociones.
- El docente la ve agregada en el Cockpit (§17); nunca expone ni etiqueta emocionalmente a un alumno.

### 14.3 Identidad del equipo — la construyen los estudiantes *(v2.1)*
La identidad del equipo **no la pone el docente: la crean los propios estudiantes**, como primer acto
de pertenencia.
- **Ritual de fundación:** al formarse el equipo, eligen **nombre** y **avatar/emblema** (de un set de
  avatares seleccionables). Es un pequeño proceso colaborativo, no un campo suelto.
- **Cambio de nombre gobernado:** si luego quieren cambiar el nombre, **no lo cambian directamente**:
  pulsan un botón que **envía una solicitud al docente**, y el **docente autoriza** (o rechaza) el
  cambio. Evita nombres inapropiados o cambios frívolos, y mantiene la trazabilidad.
- **Objetos y eventos:** la identidad vive en el objeto **Equipo** (nombre, avatar, estado de
  identidad); el cambio genera eventos `TeamRenameRequested` → `TeamRenameApproved/Rejected` (ver
  Event Bible y Object Schema Bible). El avatar de cada estudiante (elegible) alimenta la presencia
  (Crew, autoría por objeto).

---

## 15. Timeline transversal
> El Timeline **no es una pantalla**: es una **capa transversal** siempre disponible.

- Mientras trabajas, puedes **abrir "Hace 3 días…"** y ver qué pasó **sin salir** a otra pantalla
  (un panel/peek que se despliega y se cierra).
- Es **narrativo** (lenguaje humano, con autoría): *"Luis creó una idea", "Ana aprobó la propuesta",
  "el docente validó la estación", "Valeria resumió los acuerdos".*
- Es la **memoria del proyecto**: se genera automáticamente de los eventos del grafo (§7) y de los
  Hitos (§10); reutiliza Notificaciones del Aula (§4).

---

## 16. Cuartel General (workspace del estudiante)
> La Base **no es un Home ni una portada**: es un **Cuartel General** — una sala de situación. El
> estudiante entra muchas veces; no necesita bienvenida, necesita saber **qué está pasando**.

Lo primero al entrar (ejemplo):
```
Equipo Jaguar · Hoy
• Ana agregó dos ideas al Brainstorm
• Carlos espera aprobación de una propuesta
• Valeria dejó una sugerencia
• Falta una evidencia para validar El Terreno
• El docente revisará mañana
[ Continuar donde lo dejamos → ]
```
Muestra: estado del proyecto ahora · qué pasó **desde tu última visita** · qué te espera a ti · qué
falta para el próximo Hito · qué dijo Valeria · **un único** botón de continuidad. Glanceable (<5 s),
diferencial, vivo.

---

## 17. Cockpit del Docente
> El docente **no** trabaja en una simple "Sala de Control" con una cola: trabaja en un **Cockpit**.

Seis instrumentos del Cockpit:
| Módulo | Qué da |
|---|---|
| **Radar** | Vista de salud de **todos** los equipos (Estado de Colaboración §14.2) |
| **Alertas** | Equipos que **necesitan atención** (sin actividad, atascados, sin evidencias) |
| **Equipos** | Drill-down a un equipo: entrar en modo espectador, ver aportes por autoría |
| **Validaciones** | Cola de Rituales pendientes; validar con rúbrica o devolver con feedback anclado |
| **Analíticas** | Participación por integrante, avance vs plazo del ADN, riqueza de artefactos |
| **IA** | Insights de Valeria para el docente (quién no participa, qué equipo se estancó, sugerencias) |

El docente trabaja en **densidad de información**; el estudiante en **espacio de construcción**. Dos
gramáticas para dos trabajos.

---

## 18. Valeria — mentora contextual
Valeria **acompaña, nunca dirige** (Principio 6). Reutiliza el orquestador de IA del Aula (§4). **No
es un chat que se abre**: es una presencia **contextual** que aparece **donde tiene sentido**.

- **Susurros en contexto:** escribiendo una idea → *"¿convertir en tarea?"*; en Brainstorm → *"3
  ideas repetidas"*; en un Frame/Canvas → *"falta el segmento de clientes"*; equipo sin actividad
  (§14.2) → *"¿les propongo un siguiente paso?"*; al cerrar → *"resumí los acuerdos, ¿los guardo en
  la Bitácora?"*.
- **Razona sobre el grafo** (§7): detecta ideas sin tarea, evidencias huérfanas, decisiones sin sustento.
- **Instrumentos Inteligentes:** propone agrupar, deduplicar, nombrar categorías, votar, convertir a
  tareas. Siempre **opcional y reversible**; queda atribuido como "Valeria + equipo" en el Timeline.
- **Nunca auto-aplica, nunca interrumpe el flujo, nunca asume emociones** (usa Estado de Colaboración,
  no sentimientos). El docente puede regular su nivel de intervención por Expedición.

### 18.1 Valeria es APOYO, nunca se impone *(regla reforzada, v2.1)*
- Valeria **jamás se impone ni dirige el trabajo.** Es un apoyo que ayuda en los puntos ya definidos
  (agrupar ideas, detectar duplicados, evidencias faltantes, resumir acuerdos, sugerir el siguiente
  paso, avisos de colaboración). Todo es **opcional, reversible y descartable**; el equipo decide.
- **Discreta por defecto:** aparece de forma no intrusiva y se puede silenciar. Nunca bloquea, nunca
  ocupa el foco, nunca insiste. Un susurro, no una voz que manda.

### 18.2 Valeria para el ESTUDIANTE = solo guía de uso de la plataforma *(v2.1)*
- Para los estudiantes, Valeria funciona **únicamente como guía de la plataforma**: da **indicaciones
  de cómo usar El Taller** (qué es un instrumento, cómo se vota, cómo se presenta a validación, dónde
  está algo, qué falta para avanzar).
- **NO hace el trabajo académico del estudiante**: no genera sus ideas, no redacta su artefacto, no
  decide por el equipo. Acompaña el *cómo usar*, no el *qué pensar*.
- Las capacidades de razonamiento sobre el grafo y las sugerencias pedagógicas más ricas son sobre
  todo **para el docente** (Cockpit §17); para el estudiante, el modo por defecto es **ayuda de uso**.

---

## 19. Estados pedagógicos y Modos narrativos
Además de los estados **técnicos** (LOCKED/IN_PROGRESS/AWAITING/VALIDATED), existe la capa
**pedagógica** (el *modo de trabajo*) que **modifica ligeramente la interfaz**:
`Explorando → Investigando → Debatiendo → Construyendo → Validando → Presentando → Reflexionando`.
Cada uno cambia el **tono** (instrumentos al frente, densidad, animación).

Los **Modos narrativos** son la piel emocional del Taller (el proyecto tiene **ritmo**):
**Exploración · Construcción · Presentación · Celebración · Reflexión.** Cambian sutilmente
temperatura de color, energía de movimiento y densidad — "el mismo Taller en otra hora del día".
Respetan la gramática visual (§21) y `prefers-reduced-motion`.

---

## 20. Gamificación integrada
Momentos, no puntos; **de equipo**, sobria y narrativa, disparada **en el flujo**:
- **Descubrimientos** (con narrativa + animación): *"Equipo Jaguar ha descubierto **una causa raíz**"*.
- **Hitos** (§10) · **Sellos/Insignias** (cara de los Hitos) · **Rachas** (constancia colectiva) ·
  **Desbloqueos** (candado que se abre) · **Celebraciones** (micro/macro) · **Narrativa** (todo se
  cuenta en el Timeline).
- **Nada de rankings individuales**; la métrica visible es del equipo.

---

## 21. Design System y gramática visual

### 21.1 Design System (la sensación completa)
**Mood:** "estudio de oficio al atardecer", cálido y táctil, distinto del violeta-sobre-blanco del
LMS. **Color:** Marigold (energía/craft) · Teal (equipo) · hues de estación (wayfinding) · semánticos
separados · neutros con sesgo cálido · dos temas (papel de taller / estudio nocturno). **Tipografía:**
Display (sans peso 800) · Body (humanista ~65ch) · Utility mono (códigos, metadatos). **Forma:**
radios 14–20px, sombras suaves multicapa, elevación por capas z, glass solo en capas flotantes.
**Movimiento:** ease-out, física tangible, propósito no decoración, respeta reduced-motion.
**Texturas:** lienzo punteado; superficies táctiles. **Sonidos:** micro-refuerzos silenciables.

### 21.2 Gramática visual (color por intención — "leer sin leer")
| Categoría | Regla |
|---|---|
| **Color de intención** (Explorar/Analizar/Decidir/Construir/Documentar/Validar) | Tiñe el espacio/instrumento del tipo de trabajo actual. **Una intención dominante por espacio.** |
| **IA / Valeria** | Color propio y **constante**; nunca se usa para otra cosa. |
| **Equipo / Presencia** | Color propio constante (teal). |
| **Estación** (wayfinding) | Marco/etiqueta sutil = **dónde estás**. |
| **Semánticos** (válido/aviso/error) | Independientes; no cuentan como acento. |
Disciplina: jerarquía clara, sin seis colores compitiendo. Es una **capa semántica** sobre la paleta
de §21.1, no una paleta nueva.

---

## 22. Catálogo de Estados
Sistema **universal** (toda superficie los soporta): **Vacío · Nuevo · Colaborando · Editando ·
Esperando · Validado · Bloqueado · Error · Offline · Sin compañeros.** Cada uno se diseña con el
mismo cuidado (el vacío, el error y el offline son parte del diseño). Coherente con Principio 1 ("el
Taller nunca está vacío") y Principio 2 ("nunca pierde información").

---

## 23. Colaboración: asíncrono-primero
**Decisión congelada:** **asíncrono-primero; el tiempo real es enriquecimiento, no requisito.**
- La realidad del aula es mayormente asíncrona; el Taller debe sentirse vivo **aun con una sola
  persona conectada** ("Sin compañeros" es de primera clase).
- **Columna vertebral asíncrona:** Timeline transversal (§15), Crew Activity (§14), Comentarios,
  autoría por objeto, "desde tu última visita" (§16).
- **Aditivo (N2):** Crew Presence en vivo, "escribiendo…", cursores, reacciones. La UI se diseña para
  acomodarlo; el lanzamiento no se bloquea por él.
- **Regla:** ninguna función crítica requiere que otro esté conectado al mismo tiempo.

---

## 24. Sistema de validación
Máquina de estados real convertida en **ritual de paso** que **produce Hitos** (§10). Se conserva 1:1.

| Estado | En el Taller | El equipo puede |
|---|---|---|
| **LOCKED** | Estación con candado | ver, no editar |
| **IN_PROGRESS** | Taller abierto | construir; converger; al completar obligatorios se enciende la compuerta |
| **AWAITING** | "En revisión" (no bloqueo muerto) | seguir puliendo en solo-lectura suave |
| **VALIDATED** | **Hito** + siguiente estación abierta | celebrar y avanzar |
| **Devuelta** | FeedbackCard anclada | corregir lo señalado y volver a presentar |

Compuerta inteligente (solo se enciende con obligatorios completos; muestra qué falta) · Feedback
anclado al artefacto/instrumento · el Ritual es ceremonial y su aprobación **produce el Hito**.

---

## 25. Lenguaje canónico (glosario)
| Término | Definición | NO decir |
|---|---|---|
| **Aula Virtual** | El contenedor; el Taller vive dentro | "plataforma" |
| **Workspace / El Taller** | El sistema colaborativo reutilizable | — |
| **Experiencia** | Instancia de un Modelo Pedagógico en un curso | — |
| **Modelo Pedagógico** | Plugin que define la estructura (ABP, Design Thinking…) | — |
| **Expedición** | La experiencia ABP concreta de un equipo | "Proyecto" a secas |
| **ExpeditionDNA** | El objeto-contrato que parametriza la experiencia | — |
| **Motor** | La fundación técnica reutilizable (Board, Graph…) | confundir con Instrumento |
| **Instrumento** | Motor configurado con propósito ("Instrumento Board") | "Actividad", "herramienta" a secas |
| **Dinámica** | La metodología sobre un instrumento (Brainstorm, SCAMPER…) | confundir con Instrumento |
| **Estación** | Una de las 6 fases (pertenece a ABP) | "Fase" en la UI del estudiante |
| **Espacio de Trabajo** | Sección lógica que agrupa instrumentos | "Sección", "pestaña" |
| **Objeto Universal** | Unidad atómica reutilizable, con relaciones | "elemento", "item" |
| **Artefacto Vivo** | Conocimiento construido que permanece | "entrega", "respuesta" |
| **Hito** | Estado del proyecto al cumplir una estación | "logro" a secas |
| **Biblioteca del Proyecto** | Base de conocimiento acumulada | confundir con Plantillas |
| **Cuartel General** | Workspace del estudiante (sala de situación) | "Home", "dashboard" |
| **Cockpit** | Workspace del docente | "Sala de Control", "cola" |
| **Crew System** | Sistema de presencia del equipo | "barra de miembros" |
| **Estado de Colaboración** | Señal objetiva basada en hechos | "Crew Mood", inferir emociones |
| **Timeline / Bitácora** | Memoria narrativa transversal | "historial", "log" |
| **Valeria** | Mentora IA contextual | "el bot", "el chat" |
| **Sello / Chispa / Compuerta** | Insignia / XP de equipo / acceso a validar | "badge/puntos/enviar" |

---

## 26. Roadmap, gobernanza y congelamiento

### 26.1 🧊 Congelamiento
Con la v2.0, **la arquitectura queda CONGELADA**. No se modifica antes de wireframes. Esta Biblia es
la **fuente única de verdad**. Toda decisión posterior debe respetarla y superar los **Principios del
Taller** (§1) y el **gate del Google Doc**.

### 26.2 Etapas
- **Etapa 1 · Product Bible** ✅ (este documento, v2.0 congelada, sin código).
- **Etapa 2 · Diseño (sin código):** Wireframes → Diseño visual → Prototipos → Responsive →
  Interacciones. (El UX de flujos y la Capa de Experiencia ya están en
  `UX_EXPEDICION_ETAPA2.md` y `EXPERIENCIA_EXPEDICION_ETAPA2.md`, ahora absorbidos aquí.)
- **Etapa 3 · Implementación (modular, por el núcleo, no por pantallas):**
  1. **Objetos Universales + Relaciones** (§7) — el grafo, el núcleo.
  2. **Motores** (§5) — las ~10 fundaciones.
  3. **Instrumentos + Dinámicas** por manifiesto (§5, §6).
  4. **Crew System + Timeline transversal** (§14, §15).
  5. **Workspace + Modelo Pedagógico ABP + ExpeditionDNA** (§3, §9, §12).
  6. **Cuartel General** (§16).
  7. **Cockpit del Docente** (§17).
  8. **Valeria contextual** (§18) y **Gamificación** (§20).
  9. **Realtime (N2)** — co-presencia viva (§23).

### 26.3 Gobernanza (regla innegociable)
No se escribe código hasta terminar la Etapa 2. Cada pieza se implementa consultando esta Biblia.
Cambio de visión = edición explícita + versión. Cada funcionalidad nueva se integra como **una pieza
más** (un objeto/relación, una configuración de motor, una dinámica, una plantilla), no como excepción.

### 26.4 Criterio de éxito
No "tareas entregadas", sino: **% de integrantes que aportan** por estación, tiempo hasta el primer
aporte, estaciones validadas sin devolución, **riqueza del grafo/Biblioteca**, y una pregunta:
*"¿sentiste que construiste algo con tu equipo?"* — y el gate permanente: *"¿da más ganas de
reunirse aquí que en un Google Doc?"*.

---

### Registro de versiones
- **v2.1 — 2026-07-18 — amendas (no rompen la arquitectura).** (1) Valeria es APOYO y nunca se impone
  (§18.1). (2) Valeria para el estudiante = solo guía de uso de la plataforma, no hace el trabajo
  académico (§18.2). (3) Identidad del equipo creada por los estudiantes: eligen nombre + avatar; el
  cambio de nombre se hace por solicitud al docente que autoriza (§14.3). Detalle técnico en las
  nuevas Event Bible y Object Schema Bible.
- **v2.0 — 2026-07-17 — CONGELADA · DOCUMENTO FUNDADOR.** Separa Workspace (sistema) de Modelo
  Pedagógico (ABP); introduce Motores → Configuración → Instrumentos → Dinámicas; Objetos con
  Relaciones (grafo); ExpeditionDNA; Biblioteca del Proyecto; Timeline transversal; Cockpit del
  docente; reemplaza Crew Mood por Estado de Colaboración objetivo; añade los "Principios del Taller"
  como filosofía permanente (§1). Absorbe la Capa de Experiencia y el UX de Etapa 2.
- **v1.1** — (no publicada; sus amendas se integraron directamente en v2.0).
- **v1.0 — 2026-07-17** — integración en el Aula, 5 niveles, Objetos Universales, Artefactos Vivos,
  Hitos, Crew Bar, Timeline, Valeria mentora, Instrumentos Inteligentes, Plantillas, Instrumento ≠
  Dinámica.

> **Fin del Documento Fundador (v2.0).** Ninguna línea de código del rediseño se escribe hasta
> completar la Etapa 2 (diseño). Esta Biblia gobierna.
