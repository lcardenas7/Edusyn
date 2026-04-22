# 🎮 Propuesta v2: Edusyn Play — Modo Docente Personal + Invitados

> **Estado:** Propuesta final — esperando aprobación para implementar
> **Fecha:** 2026-04-21
> **Regla innegociable:** 100 % aditivo. Nada destructivo en producción.

---

## 0. Nombres propuestos (tú eliges)

| Nombre | Vibe | Ruta |
|---|---|---|
| **Edusyn Play** 🎮 | Juvenil, juego, Kahoot-like | `edusyn.co/play` |
| Edusyn Live 📡 | Tiempo real | `edusyn.co/live` |
| Edusyn Jam 🎶 | Dinámico, sesión grupal | `edusyn.co/jam` |
| Edusyn Spark ⚡ | Energía, chispa | `edusyn.co/spark` |
| Edusyn Go 🚀 | Simple, inmediato | `edusyn.co/go` |
| Edusyn Game 🎲 | Literal | `edusyn.co/game` |

> **Mi recomendación: `Edusyn Play`** — corto, memorable, `edusyn.co/play` suena excelente.
> Uso este nombre en el resto del documento. Dime si prefieres otro.

---

## 1. Resumen ejecutivo (respuestas incorporadas)

| Tema | Tu decisión |
|---|---|
| Dominio | ✅ `edusyn.co` |
| Alcance Fase 1 | ✅ Live Quiz + Home Quiz + Lecciones SCORM + **Lección Live** (nuevo) |
| Workspace personal | ✅ **UNA sola institución compartida** `edusyn-personal`, aislada por dueño |
| Nombre visible | 🎮 **Edusyn Play** (propuesto) |
| Nota oficial | ✅ Invitados no califican, pero docente puede **Convertir a nota** con 1 click |
| Límites free | ✅ Sí, desde el inicio |
| Cambios BD | ✅ 100 % aditivos |

---

## 2. 🆕 Concepto clave nuevo: Lección Live (Nearpod / Pear Deck)

Además de la **Lección SCORM** (estudiante avanza a su ritmo, ya construida), agregamos:

### Lección Live = presentación sincronizada

El docente **controla el avance** de todas las diapositivas. Los invitados ven en sus celulares lo mismo que el docente proyecta. Pueden **reaccionar** (💡 🤔 ❤ 👏) y **responder** preguntas embebidas en tiempo real.

### Diferencias vs. Lección SCORM

| Característica | SCORM (ya existe) | 🆕 Live |
|---|---|---|
| Avance | cada estudiante a su ritmo | **docente controla, todos sincronizados** |
| Sincronización | no | **sí, SSE tiempo real** |
| Reacciones | no | **sí** (💡 🤔 ❤ 👏) |
| Preguntas embebidas | sí, scoring | **sí, scoring + vista agregada en vivo** |
| Resumable | sí | no (efímero por naturaleza) |
| Uso típico | tarea, repaso individual | clase magistral, charla, taller presencial |
| Requiere login | sí (o código si Edusyn Play) | **código de 6 dígitos** |

### Reutilizamos LessonSlide + agregamos playMode

El mismo modelo `LessonSlide` ya implementado sirve. Solo añadimos `Lesson.playMode: SCORM | LIVE`.

---

## 3. Workspace Personal compartido (una sola institución oculta)

Una **única** `Institution` con slug `edusyn-personal`, tipo `PERSONAL`, `isHidden=true`. Todos los docentes personales son miembros con rol DOCENTE.

```
Institution (única, seedeada)
├─ slug: "edusyn-personal"
├─ name: "Edusyn Play"
├─ type: PERSONAL
├─ isHidden: true   ← no aparece en selectores públicos ni superadmin
└─ Miembros:
   ├─ Laura   (rol DOCENTE)
   ├─ Carlos  (rol DOCENTE)
   └─ Ana     (rol DOCENTE)
```

### Aislamiento por dueño

Para que Laura no vea los recursos de Carlos, agregamos `ownerUserId` a los recursos relevantes:

```prisma
model Classroom {
  ownerUserId  String?    // 🆕 dueño personal (null en modo institucional)
  isPersonal   Boolean    @default(false)
  @@index([ownerUserId])
  @@index([isPersonal])
}
```

**Regla en todas las queries de Edusyn Play:**

```ts
if (institution.type === 'PERSONAL') {
  where.ownerUserId = currentUser.id
}
```

Esto se implementa en un helper `applyPersonalOwnership(where, ctx)` reutilizado en los services de Classroom, Activity, Lesson, LiveSession.

### Ventajas del workspace compartido

- ✅ Una sola fila en `Institution` → BD limpia
- ✅ Métricas agregadas triviales (ej. "docentes personales activos" = 1 query)
- ✅ Moderación centralizada
- ✅ Superadmin ve "Edusyn Play" como un solo producto
- 🟡 Requiere forzar el filtro `ownerUserId` en queries personales (manejable con helper)

---

## 4. Calificación opcional: "Convertir a nota con 1 click"

### Flujo

1. Al terminar la sesión, el docente ve ranking con `%` de aciertos por invitado.
2. Pulsa **"Convertir a notas"** → modal de configuración:
   - Nota máxima (default 5.0)
   - Nota mínima (default 1.0)
   - Nota de paso (default 3.0)
   - Método: proporcional al % de aciertos
3. Vista previa en tiempo real: `70% → 3.8`, `90% → 4.6`, etc.
4. Pulsa "Aplicar y descargar" → genera planilla CSV/PDF con:
   - Nickname, % aciertos, nota calculada, estado (Aprobado/Reprobado)
5. **No se crea `ActivitySubmission` automática** (los invitados no son estudiantes reales).
6. El docente usa esa planilla en su sistema externo, o si es HIBRIDO la ingresa manualmente a su colegio.

### Fórmula

```
nota = % aciertos × (notaMax - notaMin) + notaMin
Ejemplo: 70% × (5 - 1) + 1 = 3.8
         100% × (5 - 1) + 1 = 5.0
         0%  × (5 - 1) + 1 = 1.0
```

### Modo mixto (docente institucional con invitados)

Si un docente con cuenta **institucional** activa invitados en su sesión:
- Los **matriculados** generan `ActivitySubmission` oficial normal (flujo actual intacto).
- Los **invitados** solo aparecen en la planilla exportable, nunca en calificaciones oficiales.

---

## 5. Schema (100 % aditivo)

### 5.1 Nuevos enums

```prisma
enum AccountMode {
  INSTITUTIONAL       // flujo actual
  PERSONAL            // 🆕 docente de Edusyn Play
  HYBRID              // 🆕 tiene ambos
}

enum InstitutionType {
  SCHOOL              // default actual
  UNIVERSITY
  PERSONAL            // 🆕 workspace "Edusyn Play"
}

enum GuestMode {
  DISABLED            // solo matriculados (actual)
  MIXED               // matriculados + invitados
  GUESTS_ONLY         // solo invitados (modo Edusyn Play puro)
}

enum LessonPlayMode {
  SCORM               // autoavance (actual)
  LIVE                // 🆕 docente controla, sincronizado
}
```

### 5.2 Cambios en modelos existentes

```prisma
model Institution {
  type         InstitutionType  @default(SCHOOL)
  isHidden     Boolean          @default(false)
  @@index([type])
}

model User {
  accountMode  AccountMode      @default(INSTITUTIONAL)
}

model Classroom {
  ownerUserId  String?
  isPersonal   Boolean          @default(false)
  @@index([ownerUserId])
  @@index([isPersonal])
}

model LiveSession {
  joinCode       String?        @unique
  guestMode      GuestMode      @default(DISABLED)
  publicUrl      String?
  guestsCount    Int            @default(0)
  guests         LiveSessionGuest[]
}

model Lesson {
  playMode       LessonPlayMode  @default(SCORM)
}
```

### 5.3 Tablas nuevas

```prisma
// Invitado a cualquier sesión (quiz o lección live)
model LiveSessionGuest {
  id              String        @id @default(cuid())
  sessionId       String
  session         LiveSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  nickname        String
  avatarEmoji     String?       // 🦊 🐼 🐧 🦄 🐵 🐙 🦁 🐯
  guestToken      String        @unique

  ipHash          String?
  userAgent       String?       @db.Text
  fingerprint     String?

  score           Int           @default(0)
  correctAnswers  Int           @default(0)
  totalAnswers    Int           @default(0)
  finalRank       Int?
  percent         Float?        // % final de aciertos

  joinedAt        DateTime      @default(now())
  lastSeenAt      DateTime      @default(now())
  finishedAt      DateTime?

  claimedByUserId String?
  claimedAt       DateTime?

  answers         LiveSessionGuestAnswer[]
  reactions       LiveSessionReaction[]

  @@unique([sessionId, nickname])
  @@index([sessionId])
  @@index([guestToken])
}

model LiveSessionGuestAnswer {
  id              String            @id @default(cuid())
  guestId         String
  guest           LiveSessionGuest  @relation(fields: [guestId], references: [id], onDelete: Cascade)

  questionId      String?           // FK lógica (no constraint) a ActivityQuestion
  slideId         String?           // FK lógica a LessonSlide
  selectedOption  String?
  answerText      String?           @db.Text
  isCorrect       Boolean           @default(false)
  pointsAwarded   Int               @default(0)
  timeTakenMs     Int?
  answeredAt      DateTime          @default(now())

  @@index([guestId])
  @@index([questionId])
  @@index([slideId])
}

// 🆕 Sesión de Lección Live (Nearpod-style)
model LiveLessonSession {
  id                String        @id @default(cuid())
  lessonId          String
  activityId        String
  classroomId       String

  joinCode          String        @unique
  guestMode         GuestMode     @default(GUESTS_ONLY)
  currentSlideIndex Int           @default(0)
  status            String        @default("LOBBY")  // LOBBY, RUNNING, PAUSED, FINISHED
  publicUrl         String?

  startedAt         DateTime?
  endedAt           DateTime?
  createdAt         DateTime      @default(now())
  createdByUserId   String

  @@index([joinCode])
  @@index([activityId])
}

// 🆕 Reacciones en vivo
model LiveSessionReaction {
  id              String              @id @default(cuid())
  sessionId       String              // puede ser LiveSession.id o LiveLessonSession.id
  slideIndex      Int?
  guestId         String?
  guest           LiveSessionGuest?   @relation(fields: [guestId], references: [id], onDelete: SetNull)
  emoji           String              // 💡 🤔 ❤ 👏
  createdAt       DateTime            @default(now())

  @@index([sessionId, slideIndex])
}

// 🆕 Histórico de conversiones a nota (para que el docente pueda reimprimir)
model GuestGradeConversion {
  id              String        @id @default(cuid())
  sessionId       String
  createdByUserId String
  maxScore        Float         @default(5)
  minScore        Float         @default(1)
  passingScore    Float         @default(3)
  method          String        @default("PROPORTIONAL")
  payload         Json          // snapshot de nicknames + notas
  createdAt       DateTime      @default(now())

  @@index([sessionId])
  @@index([createdByUserId])
}
```

### 5.4 Resumen BD

- **4 enums nuevos**
- **5 tablas nuevas**
- **~10 columnas nuevas** en tablas existentes, **todas con default**
- **0 DROPs, 0 modificaciones de datos**
- **1 seed:** crear `Institution { slug: 'edusyn-personal', type: PERSONAL, isHidden: true }`

---

## 6. Flujos finales

### 6.1 Registro docente personal

```
edusyn.co → landing → "Soy docente, prueba gratis"
 ↓
edusyn.co/register-play  (form: email + password + nombre)
 ↓
POST /auth/register-play
 ├─ Crea User(accountMode=PERSONAL)
 ├─ Busca Institution { slug: 'edusyn-personal' } (siempre existe por seed)
 ├─ Crea InstitutionUser(role=DOCENTE)
 ├─ Emite JWT normal con institutionId=edusyn-personal.id
 └─ Redirect → /play
```

### 6.2 Shell /play (panel del docente)

```
┌──────────────────────────────────────┐
│ 🎮 Edusyn Play      Laura · Docente ▼│
├──────────────────────────────────────┤
│ 🏠 Inicio                            │
│ 📚 Mis Quizzes        (5)            │
│ 📖 Mis Lecciones      (2)            │
│ 🎬 Lecciones Live     (1) 🆕         │
│ 🎯 Mis Sesiones       (12)           │
│ 📊 Resultados                        │
│ ✨ Valeria IA                         │
│ ⚙️ Cuenta                             │
│ ──────                               │
│ Plan: Free   (3/20 sesiones)         │
│ [ Upgrade ]                          │
└──────────────────────────────────────┘
```

Internamente cada quiz/lección vive en un `Classroom` oculto con `isPersonal=true`, `ownerUserId=Laura.id`. Laura nunca ve la palabra "Classroom".

### 6.3 Live Quiz con código

```
Mis Quizzes → Fracciones → [ 🎮 Jugar en vivo ]
 ↓
POST /live-session  { guestMode: GUESTS_ONLY }  → joinCode "482917"
 ↓
Pantalla proyectable:
┌──────────────────────────────┐
│     edusyn.co/join           │
│     ┌──────────────┐         │
│     │  482 917     │         │
│     └──────────────┘         │
│     [ QR ]                   │
│  👥 0/50    [ Iniciar ]      │
└──────────────────────────────┘
 ↓
Estudiante en celular:
  edusyn.co/join → teclea 482917 → nickname + avatar → lobby
 ↓
Laura pulsa Iniciar → SSE broadcast → preguntas en tiempo real
 ↓
Al terminar: ranking + analíticas + [ Convertir a notas ]
```

### 6.4 🆕 Lección Live (Nearpod)

```
Mis Lecciones Live → "Revolución Francesa" → [ 🎬 Presentar ]
 ↓
POST /live-lesson-session → joinCode "731842"
 ↓
Panel de control del docente:
┌────────────────────────────────────────┐
│ Slide 3/10: Causas económicas          │
│ [contenido del slide proyectado]       │
│                                        │
│ [ ← ]  [ Pausa ]  [ → ]                │
│                                        │
│ Código: 731842    28 conectados        │
│ Reacciones: 💡 12  🤔 4  ❤ 8  👏 3    │
│                                        │
│ [ Finalizar ]                          │
└────────────────────────────────────────┘
 ↓
Docente avanza → PATCH /live-lesson-session/:id/advance
 → SSE broadcast → celulares cambian al slide siguiente
 ↓
Slide con pregunta:
 • Invitados responden en celular
 • Docente ve en vivo "18/28 respondieron, 72% correcto"
 • Al avanzar muestra resumen agregado
 ↓
Reacciones 💡 🤔 ❤ 👏 aparecen animadas en la pantalla del docente
 ↓
Al finalizar: analíticas + [ Convertir a notas ]
```

### 6.5 Conversión a notas (ya descrito en sección 4)

---

## 7. Endpoints nuevos

### Públicos (sin JWT, con `X-Guest-Token` cuando aplica)

```
POST   /auth/register-play                        registro docente personal
GET    /public/join/:code                         validar código + info mínima sesión
POST   /public/join/:code                         crear guest (nickname+avatar) → guestToken
GET    /public/session/:id/status                 estado (LOBBY/RUNNING/FINISHED)
GET    /public/session/:id/stream                 SSE eventos (preguntas, avance slide)
POST   /public/session/:id/answer                 enviar respuesta
POST   /public/session/:id/reaction               enviar reacción (💡🤔❤👏)
GET    /public/session/:id/ranking                ranking en vivo
```

### Privados (JWT docente personal o institucional)

```
GET    /play/dashboard                            resumen personal
GET    /play/quizzes                              mis quizzes
GET    /play/lessons                              mis lecciones
GET    /play/sessions                             historial de sesiones
POST   /play/convert-to-institutional             vincular cuenta a colegio real

POST   /live-lesson-session                       crear sesión de Lección Live
PATCH  /live-lesson-session/:id/advance           { currentSlideIndex }
POST   /live-lesson-session/:id/finish

GET    /live-session/:id/enable-guests            generar joinCode + activar modo
POST   /live-session/:id/disable-guests           cerrar entrada de invitados
GET    /live-session/:id/guests                   lista de invitados conectados
DELETE /live-session/:id/guests/:guestId          expulsar invitado (moderación)
GET    /live-session/:id/analytics                análisis completo post-sesión
POST   /live-session/:id/convert-grades           convertir a notas
GET    /live-session/:id/export.csv               descarga CSV
GET    /live-session/:id/export.pdf               descarga PDF diploma/ranking
```

---

## 8. Límites Free (desde Fase 1)

| Recurso | Free |
|---|---|
| Quizzes guardados | 10 |
| Lecciones guardadas (SCORM + Live) | 5 |
| Participantes por sesión | 50 |
| Sesiones por mes | 20 |
| Preguntas por quiz | 30 |
| Slides por lección | 20 |
| Exportar CSV | ✅ |
| Exportar PDF | ❌ (Pro) |
| Valeria IA | ✅ 10 peticiones/día |
| Branding propio | ❌ (Pro) |
| Analíticas avanzadas (drill-down) | ❌ (Pro) |

Plan Pro (Fase 4 futura): ilimitado + PDF + branding + analíticas avanzadas.

---

## 9. Seguridad y aislamiento

| Riesgo | Mitigación |
|---|---|
| Docente A ve recursos del docente B | Filtro forzado por `ownerUserId` en todo query del workspace PERSONAL |
| Invitado llama API privada | `GuestGuard` solo permite rutas `/public/*` |
| `TenantGuard` exento en públicas | `@SkipTenantCheck()` decorator en controladores públicos |
| Spam de joins | Rate-limit 5/min por IP + fingerprint |
| Nicknames ofensivos | Lista negra básica + docente puede expulsar |
| Docente sobrepasa límites free | Middleware `FreePlanGuard` en endpoints de creación |
| Un atacante crea 10.000 cuentas | Captcha en registro + rate-limit por IP |
| guestToken robado | TTL = fin de sesión + 30 min, claim `type=guest`, solo esa sesión |

**Regla innegociable:** invitados **NUNCA** generan `ActivitySubmission` oficial. Protege integridad académica del modo institucional.

---

## 10. Impacto en producción

| Recurso | Cambio | Riesgo |
|---|---|---|
| Tablas existentes | Solo `ALTER TABLE ADD COLUMN ... DEFAULT` | 🟢 Cero |
| Datos existentes | Ninguna modificación | 🟢 Cero |
| Flujos institucionales | 100 % iguales | 🟢 Cero |
| `TenantGuard` | Exento solo en `/public/*` con decorator | 🟢 Cero |
| Migración | 1 SQL aditiva + 1 seed idempotente | 🟢 Cero |
| Prisma Client | Regenerar (ya probado con lecciones) | 🟢 Cero |

**Nada se borra, nada se resetea, nada cambia.** La migración se puede aplicar en producción sin ventana de mantenimiento.

---

## 11. Plan por fases

### 🚀 Fase 1 — MVP Edusyn Play (4-5 días)

**Backend:**
- [ ] Schema Prisma + migración SQL aditiva
- [ ] Seed idempotente de `Institution 'edusyn-personal'`
- [ ] `POST /auth/register-play`
- [ ] `GuestGuard` + generación de guestToken JWT
- [ ] Endpoints `/public/join/*`, `/public/session/*`
- [ ] Helper `applyPersonalOwnership(where, ctx)` + integración en services
- [ ] Endpoints `/play/*` para el panel docente
- [ ] `convert-grades` + `export.csv`
- [ ] `FreePlanGuard` con límites
- [ ] Endpoint `/live-lesson-session` + SSE de avance

**Frontend:**
- [ ] Página `/register-play` (tab "Soy docente" en landing)
- [ ] Shell `/play` con sidebar simplificado
- [ ] Reutilización de editores existentes (Quiz, Lección SCORM) dentro de `/play`
- [ ] 🆕 Editor de Lección Live (variante del LessonEditor, con flag playMode=LIVE)
- [ ] 🆕 Presentador sincronizado (vista docente de lección live)
- [ ] 🆕 Cliente de invitado para lección live (ve slide + reacciona + responde)
- [ ] Página pública `/join` y `/join/:code` con lobby, selector nickname + avatar
- [ ] Pantalla "Proyectar código" con QR grande
- [ ] Analíticas post-sesión (ranking, % aciertos, pregunta más difícil)
- [ ] Modal "Convertir a notas" + descarga CSV

### 📊 Fase 2 — Polish y exportación avanzada (1-2 días)
- [ ] PDF bonito con ranking
- [ ] Gráficas avanzadas (distribución de respuestas por pregunta, tiempo)
- [ ] "Reclamar resultado" (invitado se loguea al final y vincula sesión)

### 🔁 Fase 3 — Onboarding (1 día)
- [ ] Tour guiado primer login
- [ ] Convertir personal → institucional

### 💎 Fase 4 — Freemium (futuro)
- [ ] Planes Pro, pagos, branding

---

## 12. Preguntas pendientes (últimas)

Antes de implementar necesito que confirmes:

1. **Nombre final:** ¿`Edusyn Play` 🎮 o prefieres otro de la lista (sección 0)?
2. **¿Incluimos Lección Live en Fase 1**, o la dejamos para Fase 2 y arrancamos con Quiz + SCORM?
   - Mi recomendación: **incluir Lección Live en Fase 1** — es el diferenciador clave vs. Kahoot/Quizizz.
3. **Límites Free de la tabla (sección 8):** ¿OK con esos números o los ajustamos?
4. **Registro:** ¿el docente debe verificar email antes de usar Edusyn Play, o puede entrar directo?
   - Mi recomendación: **entrar directo**, verificación opcional (para reducir fricción).
5. **Política de retención de sesiones:** las sesiones de invitados ¿se guardan para siempre o se archivan a los X meses?
   - Mi recomendación: **guardar siempre** por ahora (son pocos datos).

---

## 13. Respuesta directa a tus decisiones

| Tu pedido | Cómo lo resolvemos |
|---|---|
| Docente sin institución crea quizzes | Se registra en `/register-play` → auto-miembro de workspace compartido |
| Estudiantes ingresan por `edusyn.co/join` con código | Página pública `/join`, sin cuenta, genera `guestToken` corto |
| Docente ve analíticas (ranking, pregunta más difícil, etc.) | Endpoint `/live-session/:id/analytics` + vista en `/play` |
| Lecciones tipo presentación sincronizada (Nearpod) | Nuevo `LessonPlayMode.LIVE` + `LiveLessonSession` + SSE |
| Invitados no califican pero se mide % aciertos | `LiveSessionGuest.percent` calculado automáticamente |
| Docente convierte a nota con 1 click | Endpoint `convert-grades` + modal config nota max/min/paso |
| Una sola institución compartida para docentes personales | Seed de `edusyn-personal` + aislamiento por `ownerUserId` |
| Incluir Live Quiz, Home Quiz, Lecciones | Todos reutilizan infraestructura existente + guestMode |
| Nada destructivo en producción | Solo `ADD COLUMN ... DEFAULT`, `CREATE TABLE`, `CREATE TYPE` |
| Límites free desde el inicio | `FreePlanGuard` en creación/sesiones |

---

## 🚦 Siguiente paso

Responde estas 5 preguntas de la sección 12:

1. **Nombre:** `Edusyn Play` ✅ o ¿cuál?
2. **Lección Live en Fase 1:** sí ✅ o dejamos para Fase 2
3. **Límites Free (sección 8):** ¿OK los números?
4. **Verificación email:** ¿opcional o obligatoria?
5. **Retención sesiones:** ¿permanente o X meses?

O responde simplemente: **"procede con las recomendaciones por defecto"** y arranco con Fase 1.
