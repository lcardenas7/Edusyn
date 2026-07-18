# ⚡ EVENT BIBLE — El Taller (arquitectura de eventos)

> **Documento complementario (no modifica la Biblia v2.x).** Define **qué sucede** en El Taller: el
> flujo de eventos sobre el que viven el **Timeline, Valeria, las Analíticas, la Gamificación y el
> Estado de Colaboración**. Tan importante como el de Objetos: si los Objetos son *qué existe*, los
> Eventos son *qué pasó*.
>
> **Gobierna:** [PRODUCT_BIBLE_EXPEDICION.md](PRODUCT_BIBLE_EXPEDICION.md) (v2.1). Complementa a
> [OBJECT_SCHEMA_BIBLE.md](OBJECT_SCHEMA_BIBLE.md). · Estado: borrador · 2026-07-18.

---

## 1. Principios

1. **Un evento es un hecho del pasado, inmutable.** Nombre en pasado (`IdeaCreated`, `VoteCast`). No
   se edita ni se borra; si algo cambia, se emite un evento nuevo.
2. **Append-only.** Los eventos se agregan en orden; el historial es la verdad de lo ocurrido.
3. **Todo read-model se deriva de eventos.** El Timeline, las métricas, los sellos, el Estado de
   Colaboración y las señales de Valeria **se calculan** a partir del stream, no se guardan a mano.
4. **Objetivo, no interpretativo.** Los eventos registran hechos (`TeamInactive4d` se *deriva* de la
   ausencia de eventos), nunca emociones.
5. **Las señales efímeras NO son eventos.** "Escribiendo…", cursores en vivo y presencia momentánea
   son estado transitorio (realtime N2), no se persisten en el log (lo ensuciarían).

## 2. Envelope común (todo evento lo lleva)

| Campo | Qué es |
|---|---|
| `id` | id único del evento |
| `type` | nombre del evento (dominio + pasado, p. ej. `abp.IdeaCreated`) |
| `occurredAt` | timestamp |
| `actor` | quién lo causó: `{ userId, role: student\|teacher\|valeria }` |
| `scope` | contexto: `{ institutionId, courseId, expeditionId, teamId?, stationId?, instrumentId? }` |
| `subject` | objeto afectado: `{ objectType, objectId }` (si aplica) |
| `payload` | datos específicos del evento |
| `causationId` / `correlationId` | trazabilidad (qué disparó qué) |

> `actor.role = valeria` permite atribuir en el Timeline "Valeria + equipo" y distinguir lo que
> sugiere la IA de lo que hace una persona.

## 3. Convenciones de nombre
- **PasadoSimple**, dominio como prefijo: `abp.`, `object.`, `team.`, `gamify.`, `valeria.`.
- Un evento = un hecho atómico. Evitar eventos "gordos" que mezclan varias cosas.

## 4. Catálogo de eventos

### 4.1 Identidad y equipo *(incluye la funcionalidad v2.1)*
| Evento | Cuándo | Payload clave | Alimenta |
|---|---|---|---|
| `team.TeamFormed` | el docente crea el equipo con sus miembros | memberIds | Crew, Analíticas |
| `team.TeamNamed` | los estudiantes fijan el nombre (fundación) | name, byUserIds | Timeline, Identidad |
| `team.TeamAvatarChosen` | eligen emblema del equipo | avatarId | Identidad, Crew |
| `team.MemberAvatarChosen` | un estudiante elige su avatar | userId, avatarId | Presencia, autoría |
| `team.TeamRenameRequested` | pulsan “solicitar cambio de nombre” → al docente | proposedName, reason?, byUserId | Cockpit (bandeja), Notificaciones |
| `team.TeamRenameApproved` | el docente autoriza el cambio | oldName, newName, byTeacherId | Timeline, Identidad |
| `team.TeamRenameRejected` | el docente rechaza | proposedName, reason?, byTeacherId | Timeline, Notificación al equipo |
| `team.MemberAdded` / `team.MemberRemoved` | edición de integrantes | userId | Crew, Analíticas |

### 4.2 Objetos universales (el grafo)
| Evento | Cuándo | Payload | Alimenta |
|---|---|---|---|
| `object.Created` | nace un objeto (PostIt, Evidencia, Tarea…) | objectType, data | Timeline, grafo, gamificación |
| `object.Updated` | se edita su contenido | patch | Historial |
| `object.Moved` | cambia de posición en el Canvas | x, y | (realtime; se persiste posición final) |
| `object.Deleted` | se elimina | — | grafo |
| `object.Commented` | se comenta un objeto | commentId, text | Timeline |
| `object.VoteCast` / `object.VoteRetracted` | voto sobre un objeto | targetId | Decisión, Analíticas |
| `object.RelationCreated` | se conecta A→B (generó/tiene/pertenece…) | relType, fromId, toId | **el grafo**, Valeria |
| `object.RelationRemoved` | se quita una relación | relId | grafo |

### 4.3 Trabajo en instrumentos
| Evento | Cuándo | Alimenta |
|---|---|---|
| `abp.InstrumentOpened` | se abre un instrumento | Analíticas, Estado de Colaboración |
| `abp.DynamicSelected` | el docente/equipo elige la Dinámica (Brainstorm, 6-3-5…) | config |
| `abp.IdeaCreated` | idea publicada en un Board | Timeline, gamificación |
| `abp.IdeasGrouped` | se agrupan ideas (a veces sugerido por Valeria) | Timeline |
| `abp.IdeaMerged` | se fusionan duplicadas | Timeline |
| `abp.TaskGenerated` | una idea/decisión se convierte en tarea | grafo (idea→generó→tarea) |
| `abp.TaskMoved` | avanza en el Kanban | Analíticas |
| `abp.EvidenceAttached` | se adjunta evidencia | Biblioteca, gamificación |
| `abp.DecisionMade` | el equipo acuerda algo (converger) | grafo, Timeline |

### 4.4 Convergencia, validación e hitos
| Evento | Cuándo | Alimenta |
|---|---|---|
| `abp.ConvergeStarted` | el equipo pasa de divergir a decidir | Modo/estado pedagógico |
| `abp.PhaseCriteriaMet` | se completan los obligatorios (compuerta enciende) | UI compuerta |
| `abp.ValidationRequested` | el equipo presenta al docente (Ritual) | Cockpit (cola), estado AWAITING |
| `abp.ValidationApproved` | el docente aprueba | → dispara `StationCompleted` |
| `abp.ValidationReturned` | el docente devuelve con feedback anclado | Timeline, Notificación |
| `abp.StationCompleted` | la estación queda validada | → dispara `MilestoneUnlocked` |
| `abp.MilestoneUnlocked` | **se genera el Hito** | Gamificación, Timeline, desbloqueo |
| `abp.ExpeditionCompleted` | se validan las 6 estaciones | Cima, Biblioteca |

### 4.5 Valeria *(rol acotado, v2.1)*
| Evento | Cuándo | Nota |
|---|---|---|
| `valeria.HintOffered` | ofrece un susurro contextual (docente o equipo) | **opcional, no se impone** |
| `valeria.HintAccepted` | el equipo aplica la sugerencia | queda “Valeria + equipo” |
| `valeria.HintDismissed` | la descartan | no vuelve a insistir |
| `valeria.SummaryCreated` | resume acuerdos en la Bitácora (a petición) | Timeline |
| `valeria.GuidanceShown` | **guía de uso al estudiante** (cómo votar, cómo presentar…) | solo indicaciones de plataforma; NO trabajo académico |
| `valeria.TeacherInsightRaised` | insight objetivo para el docente (Cockpit) | sobre hechos, no emociones |

### 4.6 Gamificación y presencia
| Evento | Cuándo | Alimenta |
|---|---|---|
| `gamify.SparksAwarded` | XP de equipo por aportar | contador de Chispas |
| `gamify.SealGranted` | sello al validar una estación (cara del Hito) | colección de sellos |
| `gamify.DiscoveryMade` | momento con sentido (“una causa raíz”) | celebración narrativa |
| `gamify.StreakUpdated` | racha del equipo (≥2 activos en días seguidos) | Crew Progress |
| `gamify.KudosGiven` | reconocimiento entre pares | Crew |
| `presence.SessionJoined` / `presence.SessionLeft` | entra/sale del workspace | Estado de Colaboración |

## 5. Read-models derivados (qué consume qué)

| Read-model | Eventos que consume |
|---|---|
| **Timeline / Bitácora** | los narrativos: Created, DecisionMade, ValidationApproved, MilestoneUnlocked, TeamNamed, SummaryCreated… |
| **Estado de Colaboración** (objetivo) | actividad y presencia: Created/VoteCast/TaskMoved/SessionJoined + **ausencia** de eventos (→ "sin actividad 4 días") |
| **Analíticas (Cockpit)** | participación por integrante, avance vs plazo del ADN, InstrumentOpened, aportes por autor |
| **Gamificación** | Sparks/Seal/Discovery/Streak/Kudos |
| **Valeria** | grafo (RelationCreated) + actividad + criterios; produce Hint/Insight |
| **Biblioteca del Proyecto** | Created de Evidencia/Idea/Decisión + Artefactos validados |

## 6. Notas de implementación (Etapa 3, no ahora)
- No exige un event-store completo desde el día 1: puede empezar como **tabla de eventos append-only**
  que alimenta los read-models por proyección. La escritura atómica ya implementada es compatible.
- Las señales efímeras (typing/cursores) van por el canal realtime (N2), **fuera** del log de eventos.

---

> **Fin de la Event Bible.** Referencia de comportamiento del sistema. Se implementa en Etapa 3
> consultando este documento + la Object Schema Bible.
