# 🧩 OBJECT SCHEMA BIBLE — El Taller (contrato de los Objetos)

> **Documento complementario (no modifica la Biblia v2.x).** Define el **contrato** de cada Objeto
> Universal: campos, estados, permisos, capacidades, relaciones, eventos y versionado. Es la
> **referencia única** para backend, frontend e IA. Si el Event Bible es *qué pasa*, este es *qué es
> cada cosa*.
>
> **Gobierna:** [PRODUCT_BIBLE_EXPEDICION.md](PRODUCT_BIBLE_EXPEDICION.md) (v2.1). Complementa a
> [EVENT_BIBLE.md](EVENT_BIBLE.md). · Estado: borrador · 2026-07-18.

---

## 1. Plantilla común de Objeto
Todo objeto comparte una base + **capacidades** (mixins) que compone según su tipo.

```
Objeto {
  id            // único
  type          // PostIt | Idea | Vote | Comment | Task | Evidence | Decision | Relation | Team | Member
  scope         // { institutionId, courseId, expeditionId, teamId?, instrumentId? }
  authorId      // quién lo creó (capacidad Autoría)
  createdAt, updatedAt
  state         // depende del tipo (capacidad Estado)
  capabilities  // qué mixins tiene (ver §2)
  data          // campos propios del tipo
  relations     // aristas del grafo salientes/entrantes (capacidad Relacionabilidad)
  version        // capacidad Historial (para trazabilidad + escritura atómica)
}
```

## 2. Capacidades transversales (mixins)
| Capacidad | Aporta | La tienen (ej.) |
|---|---|---|
| **Autoría** | authorId, timestamps, avatar del autor | todos |
| **Posición** | x, y en el Canvas | PostIt, Nodo |
| **Votabilidad** | votos (objeto Vote relacionado) | PostIt, Idea, opciones |
| **Comentabilidad** | hilos (objetos Comment) | casi todos |
| **Adjuntabilidad** | evidencias adjuntas | Idea, Task, Decision |
| **Estado** | ciclo de vida propio | Task, Decision, Team, PhaseState |
| **Historial** | versionado + escritura atómica (anti lost-update) | todos los editables |
| **Relacionabilidad** | aristas tipadas (el grafo) | todos |

## 3. Modelo de permisos (base)
Roles: **student-author** (creó el objeto), **student-member** (del equipo), **teacher** (dueño),
**valeria** (IA, solo sugiere).

| Acción | author | member | teacher | valeria |
|---|:--:|:--:|:--:|:--:|
| Crear | ✔ | ✔ | ✔ | ✘ (solo sugiere) |
| Editar contenido | ✔ | ✔* | ✘** | ✘ |
| Votar / comentar | ✔ | ✔ | ✘** | ✘ |
| Eliminar | ✔ | ✔* | ✘** | ✘ |
| Ver (espectador) | ✔ | ✔ | ✔ | ✔ |

\* según el instrumento (colaborativo por defecto). \** el docente observa y valida; no edita el
artefacto del equipo (salvo casos de gestión). **Valeria nunca escribe el objeto: solo propone; el
equipo aplica** (queda como “Valeria + equipo”).

---

## 4. Contratos por objeto

### 4.1 `Team` — identidad del equipo *(v2.1: la crean los estudiantes)*
```
Team {
  data: { name, avatarId, emoji?, color? }
  members: [ Member ]
  state: identityState = DRAFT | CONFIRMED | RENAME_PENDING
  relations: pertenece-a → Expedition; tiene → [Member]
}
```
- **Fundación:** al formar el equipo, los estudiantes eligen `name` + `avatarId` (de un set curado) →
  `identityState: CONFIRMED`. Evento `TeamNamed` + `TeamAvatarChosen`.
- **Cambio de nombre gobernado:** el equipo pulsa “solicitar cambio” → `TeamRenameRequested`
  (`proposedName`), estado `RENAME_PENDING`; el docente decide → `TeamRenameApproved` (aplica el
  nombre) o `TeamRenameRejected` (vuelve a `CONFIRMED`). **El equipo no cambia el nombre por sí solo.**
- **Permisos:** los miembros proponen; **solo el docente aprueba** el rename. Set de avatares curado
  (evita contenido inapropiado).
- **Eventos:** `TeamFormed, TeamNamed, TeamAvatarChosen, TeamRenameRequested, TeamRenameApproved/Rejected`.

### 4.2 `Member` — participante
```
Member {
  data: { userId (studentEnrollment), avatarId, displayName }
  role?: Facilitador | Investigador | Constructor   // rol vivo, ganado (opcional)
  relations: pertenece-a → Team
}
```
- El estudiante **elige su avatar** (`MemberAvatarChosen`); alimenta la presencia (Crew) y la autoría
  visible en cada objeto. Identidad de sesión = la del Aula (no se duplica usuario).

### 4.3 `PostIt` (Objeto Universal más usado)
```
PostIt {
  data: { text, colorId }
  capabilities: Autoría, Posición, Votabilidad, Comentabilidad, Historial, Relacionabilidad
  state: — (contenido libre)
  relations: agrupa/agrupado-en (afinidad); generó → Idea/Task; pertenece-a → Instrumento
}
```
- Existe **una vez**; lo reutilizan Brainstorm, Mapa Mental, Matriz, Clasificación…
- Escritura **atómica** (ya implementada) para edición concurrente sin lost-update.
- Eventos: `object.Created/Updated/Moved/Deleted/VoteCast/Commented`.

### 4.4 `Vote`
```
Vote { data: { targetId }, authorId, scope; unique(authorId,targetId) }
```
- Un voto = un objeto. Reglas de negocio (máx por estudiante, no auto-voto) viven en el instrumento.
- Eventos: `object.VoteCast / VoteRetracted`.

### 4.5 `Comment`
```
Comment { data: { text, targetType, targetId }, authorId }
```
- Comentable **cualquier** objeto (foto, post-it, idea, evidencia, decisión). Hilos.
- Reutiliza el servicio de Comentarios del Aula. Evento: `object.Commented`.

### 4.6 `Task`
```
Task {
  data: { text, ownerMemberId }
  state: TODO | DOING | DONE
  capabilities: Autoría, Estado, Adjuntabilidad, Relacionabilidad
  relations: deriva-de → Idea/Decision; tiene → Evidence
}
```
- Eventos: `abp.TaskGenerated, abp.TaskMoved`. Al llegar a DONE por 1ª vez → `SparksAwarded` al owner.

### 4.7 `Evidence` (Archivo / Imagen / Video / Audio)
```
Evidence {
  data: { kind: LINK|FILE|IMAGE|VIDEO|AUDIO, url|storageKey, label }
  capabilities: Autoría, Comentabilidad, Relacionabilidad
  relations: evidencia-a → Idea/Task/Decision; pertenece-a → Biblioteca
}
```
- **Reutiliza el Storage del Aula** (no implementa subida propia). Evento: `abp.EvidenceAttached`.

### 4.8 `Decision`
```
Decision {
  data: { statement, rationale? }
  state: PROPUESTA | ACORDADA
  relations: deriva-de → Idea/Vote; genera → Task; pertenece-a → Conclusiones
}
```
- Emerge al **converger**. Evento: `abp.DecisionMade`. Nutre el grafo y la Bitácora.

### 4.9 `Relation` — la arista del grafo *(el “cerebro”)*
```
Relation {
  data: { relType, fromId, toId }
  relType ∈ { genero, deriva-de, tiene, pertenece-a, responde-a, agrupa, evidencia-a, decide-sobre, bloquea-a }
}
```
- Convierte los objetos sueltos en un **grafo navegable**. Habilita las preguntas de valor:
  *“ideas que terminaron en evidencia”, “decisiones sin evidencia”, “la 1ª idea que originó el
  prototipo”*. Eventos: `object.RelationCreated / RelationRemoved`.

---

## 5. Reglas globales
- **Nada suelto:** todo objeto vive en el grafo con al menos una relación de pertenencia (`pertenece-a`).
- **Persistencia (ver Wireframes del Sistema):** Objetos, Relaciones, Artefactos, Timeline y estado del
  Canvas **persisten**; las superficies efímeras (overlay/modal/bottom-sheet) no.
- **Escritura atómica** en todos los objetos editables (anti lost-update) — ya implementada como
  cimiento (Fase 0).
- **Valeria no es dueña de ningún objeto**: solo propone cambios que el equipo aplica.
- **Identidad = del Aula:** `userId`/permisos/avatares se apoyan en los servicios del Aula; el objeto
  guarda referencias, no copias.

---

> **Fin de la Object Schema Bible.** Referencia única de datos. Se implementa en Etapa 3 junto con la
> Event Bible; ambas derivan de la Product Bible v2.1.
