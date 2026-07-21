# 🎯 Sistema de Misiones — El Taller (Expedición ABP)

> **La tesis:** en el ABP real el docente casi nunca pone a todos a hacer lo mismo.
> Dice: *"Juan, tú averigua esto. María, entrevista a la coordinadora. Pedro, consigue
> fotografías."* Hoy eso ocurre por WhatsApp o de palabra. **En Edusyn queda integrado** —
> y es uno de los diferenciadores más fuertes de la plataforma.
>
> **El principio rector:** el estudiante sabe **en todo momento qué debe hacer y cómo**.
> Complementa: [PRODUCT_BIBLE_EXPEDICION.md](PRODUCT_BIBLE_EXPEDICION.md) ·
> [BIBLIOTECA_INSTRUMENTOS.md](BIBLIOTECA_INSTRUMENTOS.md). Estado: v1 · 2026-07-19.

---

## 1. Los cuatro tipos de misión

| Tipo | Quién la recibe | Ejemplo |
|---|---|---|
| 👤 **Individual** | UN estudiante (solo él la ve como suya) | "Entrevistar al encargado de mantenimiento" |
| 🎭 **Por rol** | Todos los que tienen ese rol en el equipo | "Investigadores: buscar estadísticas" (si cambia el rol, cambia quién la recibe) |
| 🚀 **De equipo** | Todo el equipo, todos participan | "Construir el prototipo — video máx. 2 min" |
| 🌍 **Global** | Toda la clase (todos los equipos) | "Antes del viernes, cada equipo visita un lugar distinto del colegio" |

## 2. Anatomía de una misión

```
MISIÓN (👤 solo Juan)
──────────────────────────────
Entrevistar al encargado del mantenimiento.
Objetivo   Descubrir por qué existen tantas fugas.
Fecha      Mañana.
Producto   Audio o video.          ← ENTREGABLE OBLIGATORIO
Recompensa +20 XP · Contribuye al Hito "Investigación".
```

Campos: título · objetivo (el *para qué*) · fecha límite · **producto esperado**
(foto / audio / video / documento / enlace / N objetos en un instrumento) ·
XP · a qué estación/hito contribuye.

## 3. Completar = ENTREGAR (interacción real, nunca un checkbox)

**Regla innegociable** (feedback directo del fundador, 2 veces): una misión NO se
"marca como completada". Se **entrega**:

- El estudiante sube el producto (foto/audio/video/doc/enlace) o el sistema detecta
  el hecho (p. ej. "8 fotografías en la Galería", "3 marcadores en el Mapa").
- **La entrega se convierte automáticamente en Evidencia del proyecto**: aparece en
  la Biblioteca con su autor ("Nueva evidencia — Autor: Juan"). *No queda escondida;
  todo el equipo puede usarla. No hay que volverla a subir.*
- Estados: `PENDIENTE → ENTREGADA → ACEPTADA / DEVUELTA (con nota del docente)`.
- El XP se concede al ACEPTAR (o al entregar, configurable), vía el ledger idempotente.

Esto reemplaza el modelo actual de checkboxes (AbpMissionActivity.completed y las
misiones sembradas "Práctica · Investigar el contexto"): **las misiones las agrega el
docente** (con plantillas sugeridas por fase, editables), no vienen pre-marcables.

## 4. El flujo de validación CON misiones (lo que faltaba)

Hoy: el equipo presenta la estación → el docente aprueba o devuelve con feedback.
**Nuevo:** al revisar, el docente puede **devolver CON misiones**:

1. Le llega la solicitud de validación al Cockpit.
2. En vez de aprobar, crea 1..N misiones (de equipo o individuales: "María, falta
   la entrevista"; "equipo: suban 3 evidencias del patio").
3. El equipo recibe **notificación**: *"El docente revisó El Reto: hay 2 misiones
   nuevas antes de la validación"*.
4. La estación vuelve a EN CURSO y la **compuerta exige esas misiones entregadas**
   (no marcadas: ENTREGADAS) para volver a presentar.
5. Al aprobar → notificación de Hito + celebración.

### Notificaciones del sistema (mínimas)
| Evento | Quién la recibe |
|---|---|
| Misión nueva asignada | El/los destinatarios (con tipo e ícono) |
| Misión entregada | El docente |
| Validación devuelta con misiones | Todo el equipo |
| Validación aprobada (Hito) | Todo el equipo |
| Fecha límite de misión próxima | El destinatario |

## 5. El Cuartel General como agenda ("Hoy deberán…")

El estudiante entra y NO ve una lista de tareas: ve **qué toca hoy**, derivado de
(estación actual + misiones pendientes + instrumentos obligatorios sin usar + mensajes):

```
CUARTEL GENERAL · Equipo Acuáticos
──────────────────────────────────
Hoy deberán:
 ✔ Comprender el problema           (misión de equipo)
 ✔ Investigar el colegio            (instrumento obligatorio sin usar)
 ⭐ MISIÓN PERSONAL · Pendiente
    Entrevistar al encargado. +20 XP
Docente: "Recuerden tomar fotografías."
Valeria: "Todavía no existe ninguna idea registrada."
                                        Continuar →
```

*"No tienen que pensar qué hacer. Simplemente continúan."*

## 6. Valeria sugiere misiones (acompaña, nunca dirige)

Valeria razona sobre HECHOS del grafo/eventos y **sugiere al docente** (jamás asigna):

> "Luis aún no ha realizado ningún aporte en esta estación. ¿Deseas asignarle una
> misión individual de investigación o documentación?"

El docente **acepta, modifica o rechaza**. Promueve participación equitativa sin
quitarle el control (Biblia §18.1: Valeria es apoyo, nunca se impone). Otras señales:
estudiante sin aportes en N días · evidencias duplicadas ("¿fusionarlas?") · lugares
del mapa repetidos ("3 marcaron el mismo lugar, ¿agruparlos?").

## 7. Modelo de datos (evolución de AbpMission, aditiva)

```prisma
model AbpMission {
  // existentes: id, phaseState, title, description, required, sortOrder, status…
  assigneeType        AbpMissionAssignee @default(TEAM)   // TEAM | INDIVIDUAL | ROLE | GLOBAL
  assigneeEnrollmentId String?   // INDIVIDUAL: el estudiante
  assigneeRole        String?    // ROLE: id del rol del equipo
  deliverableKind     String?    // PHOTO | AUDIO | VIDEO | DOC | LINK | INSTRUMENT_OBJECTS | NONE
  deliverableConfig   Json?      // { instrumentKey, minObjects } para las automáticas
  dueAt               DateTime?
  xp                  Int @default(20)
  deliveryState       String @default("PENDING") // PENDING | SUBMITTED | ACCEPTED | RETURNED
  deliveryUrl         String?    // storage path o enlace del producto
  deliveryNote        String?    // nota del docente al devolver
  tallerObjectId      String?    // la Evidencia creada en el núcleo al entregar
}
```

La entrega crea un `TallerObject(type: Evidence)` + evento `mission.Delivered` en el
núcleo → aparece en Biblioteca/Timeline/analíticas sin trabajo extra. Las misiones
GLOBAL viven a nivel proyecto y se materializan por equipo.

## 8. Estado de construcción

> **M1 HECHO (2026-07-20, commit e40ddbe):** misiones individuales con entrega, verificado 15/15
> end-to-end. **M2 HECHO (commit ba5b997):** devolver validación con misiones + aviso al
> equipo. **M4 parcial HECHO (commit 6cd0b8d):** misiones de equipo con entregable
> (completar = ENTREGAR). Pendientes: M3 (agenda ya hecha en commit 34dd6b0),
> M5 (misiones por rol — requiere instrumento Roles), M6 (misión global + sugerencias
> de Valeria).

### Orden original (tickets)

1. **M1 — Misión individual + entrega con producto** (el corazón): assigneeType
   INDIVIDUAL, subir producto (storage ya existe), entrega→Evidencia automática,
   estados PENDIENTE→ENTREGADA→ACEPTADA/DEVUELTA, XP al aceptar. UI: "Nueva misión →
   elegir estudiante" (docente) + "MISIÓN PERSONAL" destacada (estudiante).
2. **M2 — Devolver validación con misiones + notificaciones** (§4): integra el sistema
   de notificaciones existente de Edusyn; compuerta exige entregas.
3. **M3 — Cuartel General como agenda** "Hoy deberán…" (§5).
4. **M4 — Misión de equipo con entregable** (reemplaza checkboxes de las actuales) +
   plantillas por fase editables (adiós misiones sembradas fijas).
5. **M5 — Misiones por rol** (requiere roles de equipo — instrumento Roles del catálogo).
6. **M6 — Misión global + sugerencias de Valeria** (§6).

> Con M1+M2 ya se vive el ejemplo "Guardianes del Agua": el docente interviene desde
> el Cockpit con misiones dirigidas y el estudiante siempre sabe qué sigue.
