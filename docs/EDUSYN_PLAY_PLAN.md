# Edusyn Play — Plan de Mejora Completo

> **Estado:** Producción activa. Schema solo cambios aditivos. Nunca `migrate reset` ni `db push` en prod.  
> **Última actualización:** 2026-04-26

---

## Contexto del módulo

Edusyn Play es una app paralela a Edusyn Normal, accesible en `/play/*` con su propio `PlayAuthProvider`.  
Los docentes se loguean en `/login-play` y los invitados (sin cuenta) entran por `/join/:code`.  
**No tiene botón de acceso desde la app principal todavía (se añade en Fase 0).**

### Archivos clave — leer antes de tocar el módulo

| Qué              | Dónde                                                                                  |
|------------------|----------------------------------------------------------------------------------------|
| Rutas Play       | `apps/web/src/App.tsx` líneas ~180-214                                                 |
| Auth Play        | `apps/web/src/contexts/PlayAuthContext.tsx`                                             |
| API client       | `apps/web/src/lib/playApi.ts`                                                          |
| Panel docente    | `apps/web/src/pages/play/` (PlayDashboard, PlayQuizzes, PlayQuizEditor, PlayLessons, PlaySessions, JoinPage) |
| Layout           | `apps/web/src/components/play/PlayLayout.tsx`                                          |
| Quiz live (inst) | `apps/web/src/components/LiveQuiz.tsx` — versión institucional COMPLETA, fuente de patrones |
| Backend service  | `apps/api/src/modules/edusyn-play/services/play.service.ts`                            |
| Backend lessons  | `apps/api/src/modules/edusyn-play/services/live-lesson.service.ts`                     |
| Backend guests   | `apps/api/src/modules/edusyn-play/services/guest.service.ts`                           |
| Backend auth     | `apps/api/src/modules/edusyn-play/services/auth-play.service.ts`                       |
| Backend convert  | `apps/api/src/modules/edusyn-play/services/conversion.service.ts`                      |
| Controller Play  | `apps/api/src/modules/edusyn-play/controllers/play.controller.ts`                      |
| Controller guest | `apps/api/src/modules/edusyn-play/controllers/guest-public.controller.ts`              |
| SSE inst.        | `apps/api/src/modules/live-session/live-session.controller.ts` — patrón SSE a replicar |
| Schema           | `apps/api/prisma/schema.prisma` líneas 5185-5802 (ActivityQuestion, LiveSession, Lesson, LessonSlide, LiveSessionGuest, LiveSessionReaction, etc.) |

---

## Estado actual (diagnóstico)

### ✅ Lo que ya funciona
- CRUD quizzes + preguntas (MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER)
- Sesión live quiz básica con `joinCode` (6 dígitos) y lobby de invitados
- Backend de lecciones + slides schema completo (CONTENT/ACTIVITY/CHECKPOINT/BADGE_REVEAL)
- Acceso anónimo por código, `LiveSessionGuest`, `LiveSessionGuestAnswer`, `LiveSessionReaction`
- Conversión de resultados a nota (`GuestGradeConversion`)
- Auth Play separada (JWT propio, registro independiente)
- Modo `ASYNC_HOME` parcialmente implementado en `LiveQuiz.tsx` institucional

### ❌ Brechas críticas
- **Polling en lugar de SSE** — `setInterval(3s)` en editor y JoinPage. La infra SSE existe en `live-session.controller.ts` pero no se porta al módulo Play.
- **Editor de lecciones inexistente** — Schema listo, UI no existe (ni editor de slides, ni presenter, ni vista invitado para lecciones).
- **Quiz sin calidad Kahoot** — Sin imágenes, timer visible, música, podio animado, streaks, contexto compartido, bonus. `LiveQuiz.tsx` institucional tiene todo esto pero Play no lo reutiliza.
- **Sin animaciones** — No hay framer-motion ni CSS animations en Play. `LiveQuiz.tsx` tiene patrones completos.
- **Sin acceso desde app principal** — El docente no descubre Play sin escribir la URL.
- **Tipos de pregunta limitados** — Schema soporta MULTIPLE_SELECT, MATCHING, FILL_BLANK, ORDER pero editor solo muestra 3.

---

## Fases del plan

### FASE 0 — Descubrimiento (XS) `[PENDIENTE]`

Que el docente encuentre Play desde la app principal.

- **F0.1** Tarjeta "Edusyn Play" en Dashboard principal del docente → CTA `/play`.
- **F0.2** Ítem "Play" en `Layout.tsx` sidebar, solo roles docente/admin. Abre en nueva pestaña.
- **F0.3** Banner contextual en módulo Aulas: "¿Quieres jugar este contenido en vivo? → Edusyn Play".

Sin cambios en backend.

---

### FASE 1 — Realtime SSE para Play (S) `[EN PROGRESO]`

Eliminar polling. Usar la misma infra SSE del módulo institucional.

**Patrón de referencia:** `apps/api/src/modules/live-session/live-session.controller.ts:72` usa `Subject<LiveEvent>` con `getOrCreateStream(sessionId)` y emite `MessageEvent` vía `@Sse()`.

- **F1.1** Crear `apps/api/src/modules/edusyn-play/services/play-stream.service.ts`:
  - `Map<string, Subject<LiveEvent>>` en memoria.
  - `getOrCreateStream(sessionId)`: devuelve o crea `Subject`.
  - `emit(sessionId, event)`: emite a todos los suscriptores.
  - `cleanup(sessionId)`: cierra el subject y borra el mapa.

- **F1.2** Agregar endpoint SSE en `play.controller.ts`:
  ```
  @SkipTenantCheck()
  @Sse('/live/:sessionId/stream')
  streamLiveSession(@Param('sessionId') sessionId, @Query('token') token, @Query('guestToken') guestToken)
  ```
  Autenticación: JWT del docente **o** `guestToken` de `LiveSessionGuest`.  
  Replay del estado actual (un evento inicial con el estado completo).  
  Luego stream de eventos futuros.

- **F1.3** Emitir eventos desde `play.service.ts` en cada mutación de `LiveSession`:
  | Mutación               | Evento SSE emitido         |
  |------------------------|----------------------------|
  | `createLiveQuizSession`| (no emitir — sesión nueva) |
  | Invitado se une        | `GUEST_JOINED`             |
  | Invitado abandona      | `GUEST_LEFT`               |
  | `startLiveQuizSession` | `SESSION_STARTED`          |
  | `nextQuestionLive`     | `QUESTION_OPENED`          |
  | Revelar respuesta      | `QUESTION_CLOSED`          |
  | Actualizar ranking     | `RANKING_UPDATED`          |
  | `finishLiveQuiz`       | `SESSION_FINISHED`         |
  | Reacción de invitado   | `REACTION`                 |

- **F1.4** Frontend — Reemplazar `setInterval` en:
  - `apps/web/src/pages/play/PlayQuizEditor.tsx` (polling del docente)
  - `apps/web/src/pages/play/JoinPage.tsx` (polling del invitado)
  
  Crear hook `usePlaySSE(sessionId, token)` en `apps/web/src/lib/play-sse.ts`.  
  Fallback: si SSE falla 3 veces consecutivas, volver a polling de 5s con banner "Conexión degradada".

**Archivos a crear/modificar:**
- `apps/api/src/modules/edusyn-play/services/play-stream.service.ts` ← NUEVO
- `apps/api/src/modules/edusyn-play/edusyn-play.module.ts` ← agregar PlayStreamService al providers[]
- `apps/api/src/modules/edusyn-play/controllers/play.controller.ts` ← agregar @Sse endpoint
- `apps/api/src/modules/edusyn-play/services/play.service.ts` ← inyectar PlayStreamService y emitir eventos
- `apps/web/src/lib/play-sse.ts` ← NUEVO hook
- `apps/web/src/pages/play/PlayQuizEditor.tsx` ← reemplazar polling
- `apps/web/src/pages/play/JoinPage.tsx` ← reemplazar polling

**Aceptación:** Lobby se actualiza < 500ms. Sin `setInterval` de 3s.

---

### FASE 2 — Paridad Kahoot (M) `[PENDIENTE]`

- **F2.1** Extraer de `LiveQuiz.tsx` componentes/hooks reutilizables en `apps/web/src/lib/play-shared.ts`:
  - `useAnimatedCounter(value, duration)`
  - `getAvatarColor(name)`, `ANIMAL_AVATARS`, `AVATAR_COLORS`
  - `shuffleArray<T>(items)`
  - `normalizeQuestionMedia(question)`
  - Tipos: `RankEntry`, `LiveQuizPhase`

- **F2.2** Refactorizar `PlayQuizEditor.tsx` — panel live usa `LiveQuizPlayer` component (SSE de F1).

- **F2.3** Editor de pregunta extendido:
  - Imagen por pregunta (`imageUrl`) — subida a R2 vía `storageApi`
  - Timer por pregunta (`timeLimitSeconds` ya en schema)
  - Explicación editable (`explanation`)
  - Puntos configurables
  - Vista previa de pregunta al editarla

- **F2.4** Animaciones (CSS + Framer Motion):
  - Podio con revelación escalonada (3ro → 2do → 1ro)
  - Popup `+N pts` con bounce en corrección
  - Racha: flame icon pulsante
  - Contador regresivo: pulso en últimos 5s + rojo
  - Reveal respuesta: flip card o slide down

- **F2.5** Música / SFX (Web Audio API — mismo patrón que `LiveQuiz.tsx`):
  - Archivos en `apps/web/public/sounds/play/` (lobby, question, results, correct, wrong)
  - Toggle persistente en `localStorage('playSound')`

- **F2.6** Modo equipos opcional (ya soportado por `LiveSessionMode.TEAM` en schema).

- **F2.7** Tipos de pregunta adicionales: `MULTIPLE_SELECT` y `ORDER`.

Schema: cero cambios. Todo existe.

---

### FASE 3 — Editor + Player de Lecciones tipo Nearpod (L) `[PENDIENTE]`

- **F3.1** `apps/web/src/pages/play/PlayLessonEditor.tsx` en ruta `/play/lessons/:lessonId/edit`:
  - Sidebar izquierda: miniaturas de slides (drag para reordenar)
  - Área central: editor del slide actual
  - Tipos de slide: CONTENT (title + body + imagen/video + layout), ACTIVITY (pregunta), CHECKPOINT, BADGE_REVEAL
  - Auto-save con debounce 1.5s

- **F3.2** Backend — nuevos endpoints en `play.service.ts` o `lesson-slides.service.ts`:
  - `POST /play/lessons/:id/slides`
  - `PUT /play/lessons/:id/slides/:slideId`
  - `DELETE /play/lessons/:id/slides/:slideId`
  - `PATCH /play/lessons/:id/slides/reorder` (body: `{ order: string[] }`)

- **F3.3** `apps/web/src/pages/play/PlayLessonPresenter.tsx` (vista docente durante sesión):
  - Sidebar miniaturas + slide actual grande
  - Controles: anterior / siguiente / pausar / terminar
  - Panel lateral de reacciones en vivo (SSE)
  - QR code del joinCode

- **F3.4** `JoinPage.tsx` — modo LESSON:
  - Detecta `session.type === 'lesson'`
  - Renderiza `LessonGuestView`: sigue `currentSlideIndex` por SSE
  - Botones reacciones flotantes (💡 🤔 ❤ 👏)
  - Slides ACTIVITY: mini-quiz embebido con feedback

- **F3.5** Animaciones de transición entre slides (fade / slide), confeti en BADGE_REVEAL.

- **F3.6** Botón "Lanzar Live" en `PlayLessons.tsx` y en `PlayLessonEditor.tsx`.

Schema: cero cambios. `Lesson`, `LessonSlide`, `LiveLessonSession`, `LiveSessionReaction` ya existen.

---

### FASE 4 — Tres herramientas nuevas (M) `[PENDIENTE]`

> Todas reutilizan `LiveSession` + `LiveSessionGuest` + `LiveSessionGuestAnswer`.  
> El tipo se distingue por `ClassroomActivity.type` (verificar si requiere migración de enum).

#### A — Mural Colaborativo (tipo Padlet)
- Invitados pegan notas (texto + color) que aparecen en pantalla del docente en tiempo real.
- Backend: tipo `BOARD`. Notas en `LiveSessionGuestAnswer` (content=answerText, color=selectedOption). Posiciones x/y en `LiveSession.config.boardLayout`.
- UI docente: canvas con notas posicionadas + drag para agrupar.
- UI invitado: input "+ nota" + lista de mis notas.

#### B — Nube de Palabras / Brainstorm (tipo Mentimeter)
- Pregunta abierta; invitados envían 1-3 palabras; word cloud en vivo (tamaño = frecuencia).
- Backend: tipo `WORD_CLOUD`. Palabras en `LiveSessionGuestAnswer.answerText`. Endpoint agregador `GET /play/live/:id/wordcloud` devuelve `[{ word, count }]` con normalización (lowercase + stop-words ES).
- Frontend: `react-wordcloud` o layout CSS propio.

#### C — Pulso / Encuesta Relámpago (tipo Mentimeter poll)
- Multipregunta sin respuesta correcta (Likert 1-5 o emojis).
- Backend: tipo `POLL`. Preguntas `MULTIPLE_CHOICE` con `correctAnswer=null`. Resultado: agregación por `selectedOption`.
- Frontend: barras animadas con porcentaje en tiempo real.

**Schema:** Si `ActivityType` es enum estricto, agregar `BOARD`, `WORD_CLOUD`, `POLL` via `prisma migrate dev --create-only` local → revisar SQL → commit → Railway `migrate deploy`.  
**Nunca** `db push` en producción.

---

### FASE 5 — Pulido global (S) `[PENDIENTE]`

- **F5.1** Auto-save en editor de quiz (debounce 1s) + indicador "Guardado ✓ / Guardando…"
- **F5.2** Validaciones: imagen ≤ 2MB, mínimo 2 opciones, al menos 1 correcta, puntos 1-1000, timer 5-120s
- **F5.3** Exportar resultados (Excel/PDF) vía `conversion.service.ts` + export raw sin convertir a nota
- **F5.4** Empty states ilustrados, skeleton loaders en Dashboard/Lessons/Sessions
- **F5.5** Desconexión invitado: badge "Reconectando…" + retry SSE x3 + persistir estado en `localStorage`
- **F5.6** Telemetría liviana por tipo de herramienta (contador en `LiveSession.config`)

---

## Orden de sprints

| Sprint | Fases           | Resultado visible                              |
|--------|-----------------|------------------------------------------------|
| 1      | F0 + F1 + F2.1-F2.4 | Quiz descubrible + realtime + animaciones básicas |
| 2      | F2.5-F2.7 + F3.1-F3.3 | Kahoot completo + editor de lecciones     |
| 3      | F3.4-F3.6 + F5.1-F5.2 | Lecciones live end-to-end                 |
| 4      | F4 + F5 resto   | 3 herramientas nuevas + pulido final           |

---

## Reglas absolutas (no negociables)

1. **Schema:** Solo migraciones aditivas. `prisma migrate dev --create-only` local → revisar SQL → commit → Railway hace `migrate deploy`. **NUNCA** `migrate reset`, `migrate dev` (interactivo), ni `db push` en producción.
2. **Storage:** Imágenes/audio de slides van a R2 via `StorageService`. No base64 en JSON.
3. **Tenants:** Endpoints públicos de invitados llevan `@SkipTenantCheck()` y autentican por `guestToken`. Endpoints del docente usan JWT Play estándar.
4. **No romper institucional:** No modificar `LiveQuiz.tsx` hasta extraer su lógica compartida a `play-shared.ts`. Probar ambos flujos antes de cada merge.
5. **SSE en prod:** Si Railway escala a > 1 instancia, el `Subject` en memoria no comparte estado. Documenta esto como deuda técnica (Redis pub/sub) sin bloquearte.
6. **Preguntar antes de git add/commit** para que el usuario cambie modo de razonamiento.

---

## FASE 6 — Calidad Kahoot del Quiz Live (XL) `[NUEVO]`

> Análisis hecho post-Fase 2 sobre el flujo real ejecutado por el usuario.
> Objetivo: cerrar la brecha entre **lo que tenemos** y **una experiencia tipo Kahoot/Blooket** real.
> Cada item lleva una referencia concreta al archivo+línea donde está el problema.

### 🔴 BUGS funcionales que rompen la experiencia (prioridad MÁX)

#### F6.1 — Scoring siempre suma `1000` con default
`apps/api/src/modules/edusyn-play/services/guest.service.ts:239` y `:251`

```ts
pointsAwarded = isCorrect ? Math.round(Number(q.points || 1) * 100) : 0;
```

- Cada pregunta nueva se crea con `points = 10` (`play.service.ts:398`).
- `10 * 100 = 1000`. **Por eso siempre suma exactamente 1000**.
- Además ignora completamente `timeTakenMs` → no premia velocidad.
- `JoinPage.tsx:287` envía siempre `timeTakenMs: 0`.

**Solución (algoritmo tipo Kahoot):**

```ts
// Servidor: server-driven timer es la fuente de verdad
const elapsedMs = Date.now() - questionOpenedAt;
const totalMs = (q.timeLimitSeconds ?? 15) * 1000;
const speedFactor = Math.max(0.5, 1 - 0.5 * (elapsedMs / totalMs));
pointsAwarded = isCorrect ? Math.round(q.points * speedFactor) : 0;
```

- Default `points` deberá pasar a `1000` para sentirse Kahoot, o dejarlo configurable y mostrar barra de “puntos máximos por velocidad”.
- El frontend manda `timeTakenMs` real desde `Date.now() - questionOpenedAt`.

#### F6.2 — Feedback se revela inmediatamente al alumno
`apps/web/src/pages/play/JoinPage.tsx:629-645`

- El alumno **ve “Correcta / +N pts” en cuanto envía**.
- En Kahoot el alumno ve solo `Respuesta enviada, esperando…` y **el reveal ocurre cuando el docente cierra la pregunta**, sincronizado con la pantalla del salón.
- Backend debe diferir la entrega: `submitAnswer` retorna `{ accepted: true }` y guarda el resultado. El cliente lo muestra solo cuando recibe `QUESTION_CLOSED` por SSE.
- Necesita un nuevo evento `QUESTION_CLOSED` (declarado pero no emitido nunca: revisar `play-stream.service.ts:10` y `play.service.ts`).

#### F6.3 — “Siempre sale en borrador”
`apps/web/src/pages/play/PlayQuizzes.tsx:191-193`

- El badge `Publicado / Borrador` lee `quiz.isPublished`.
- Ningún endpoint actualiza `isPublished`. No hay botón “Publicar”.
- Crucialmente, **no es necesario publicar para jugar**: `createLiveQuizSession` (`play.service.ts:449`) no valida `isPublished`.
- Decisión sugerida: **eliminar el badge** o agregar acción `togglePublish` y mostrarlo como “Listo para vivo / Borrador”.

#### F6.4 — “Siguiente pregunta” no se dispara automáticamente al acabar el timer
`apps/web/src/components/play/LiveQuizPlayer.tsx:79-92`

- El timer corre en cliente con `setInterval`, llega a 0 y **no pasa nada**.
- No hay autocierre server-side. El docente debe presionar `Siguiente` manualmente.
- Cada cliente cuenta su propio tiempo → desincronización.

**Solución:** timer **server-driven**. Backend define `questionOpenedAt`, agenda `setTimeout(timeLimitMs)` y al expirar emite `QUESTION_CLOSED` + stats. Frontend solo renderiza `(closesAt - now())`.

#### F6.5 — Sesión zombi en `localStorage` impide reentrar a otro quiz
`apps/web/src/pages/play/JoinPage.tsx:96-130`

- Al cargar `JoinPage`, si hay `guest_token` y `guest_session` guardados, **siempre** salta a `lobby` sin validar.
- Si la sesión guardada es de otro código que ya finalizó, queda atascado.
- No hay botón “Salir / Cambiar código” visible en `lobby` ni `active`.
- El `guestToken` no caduca y la API no lo invalida cuando la sesión termina.

**Solución:**
- Validar al restaurar: `GET /public/session/:id/status` → si `FINISHED` o 404, limpiar localStorage y mostrar entry code.
- Botón visible `Salir` en lobby/active que llama `localStorage.removeItem` y vuelve a step `code`.
- `guestToken` con `exp` corto (2-4h) y endpoint `DELETE /public/session/:id/leave`.

#### F6.6 — Lobby del invitado solo muestra contador, sin sentido de juego
`apps/web/src/pages/play/JoinPage.tsx:464-507`

- El alumno ve solo “Esperando que inicie la sesión” + `guestsCount`.
- Falta: **lista de avatares de los conectados**, animación al entrar nuevo participante, música de espera, texto de bienvenida del docente.
- Kahoot muestra una **grilla de bloques pulsantes** con nombres + avatares moviéndose.

#### F6.7 — `imageUrl` y `timeLimitSeconds` no llegan al alumno
`apps/web/src/pages/play/JoinPage.tsx:534-535`

- `sessionStatus.currentQuestion` no incluye `imageUrl` (mira `SessionStatus` interface en `:30-44` y `getQuizSessionStatus` en `guest.service.ts:357-364`).
- Aunque el docente sube la imagen y configura el timer, el alumno **nunca la ve**.
- Hay que añadir `imageUrl` y `timeLimitSeconds` al `select` de `getQuizSessionStatus` y al payload de `QUESTION_OPENED`.

---

### 🟡 UX que aleja del feel Kahoot (prioridad ALTA)

#### F6.8 — Sin colores/formas Kahoot por opción
- Las 4 opciones son botones grises (`JoinPage.tsx:548-563`). Kahoot usa **rojo/azul/amarillo/verde + triángulo/diamante/círculo/cuadrado**.
- Variante: opciones grandes en grid 2×2 con altura 50% pantalla en móvil para tap rápido.

#### F6.9 — Sin timer visual al alumno
- El alumno **no ve cuánto tiempo le queda**. En Kahoot hay una barra que se vacía dramáticamente.
- Ya existe `CircularTimer` en `AnimalAvatars.tsx`. Reusar.

#### F6.10 — Sin avatares animales reales en JoinPage
- `JoinPage.tsx:17` usa una lista plana de 16 emojis.
- Existe `ANIMAL_AVATARS` en `AnimalAvatars.tsx:8-29` con colores por avatar y componentes `<AnimalAvatar>` `<AvatarSelector>` ya listos.
- Migrar JoinPage a usar `AvatarSelector` y guardar `avatarId` en lugar de emoji raw → colores consistentes en ranking, podio y reveals.

#### F6.11 — Sin sonido / SFX
- `LiveQuiz.tsx:43-109` ya tiene `playSound('correct'|'incorrect'|'tick'|'winner'|'countdown')` con Web Audio API.
- Ni `JoinPage` ni `LiveQuizPlayer` lo importan.
- Toggle persistente en `localStorage('playSound')`.

#### F6.12 — Sin confeti al acertar
- `canvas-confetti` ya está instalado y `LiveQuiz.tsx:112-160` define `fireConfetti('correct'|'winner'|'celebration')`.
- Reusar en `JoinPage` cuando llegue `QUESTION_CLOSED` con `isCorrect=true`, en `LiveQuizPlayer` al `SESSION_FINISHED`.

#### F6.13 — Sin retro háptica móvil
- En `handleAnswer` (JoinPage:277): `if ('vibrate' in navigator) navigator.vibrate(40)` al tocar opción, `[80, 40, 80]` correcto, `[200]` incorrecto.

#### F6.14 — Sin reacciones en vivo (UI)
- Backend listo: `submitReaction` (`guest.service.ts:293`), endpoint `/public/session/:id/reaction`.
- Frontend invitado **no tiene botones flotantes** de reacciones (💡 🤔 ❤ 👏 🔥 👍).
- Frontend docente recibe el evento `REACTION` por SSE pero no lo renderiza.

#### F6.15 — Sin ranking visible al alumno entre preguntas
- En `JoinPage.tsx:648-651` solo hay `Puntaje acumulado`. No ve a sus compañeros.
- Kahoot/Blooket muestran **scoreboard breve** entre preguntas: tu posición, el top 3, cuánto te falta para subir.
- Necesita una fase intermedia `interlude` entre `QUESTION_CLOSED` y siguiente `QUESTION_OPENED`.

#### F6.16 — Sin streak (rachas)
- `LiveQuiz.tsx` ya implementa streak (`setStreak(prev => prev + 1)` :909). Replicar en JoinPage.
- Bonus por racha: x1.1, x1.25, x1.5 cada 3, 5, 7 aciertos seguidos.

---

### 🟡 Editor del docente (prioridad MEDIA)

#### F6.17 — Drag-and-drop del orden no funciona
`PlayQuizEditor.tsx:431` muestra `<GripVertical>` decorativo.
Implementar reorder con `@dnd-kit/core` (que ya existe en el proyecto si se usa en lecciones) o HTML5 drag nativo (como en `PlayLessonEditor.tsx:281-287`).
Nuevo endpoint `PATCH /play/quizzes/:id/questions/reorder`.

#### F6.18 — Sin edición inline de preguntas existentes
- Solo se puede `delete + add`. Endpoint `updateQuestion` ya existe (`play.controller.ts:73`), falta UI.

#### F6.19 — Tipos de pregunta limitados
- Solo `MULTIPLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER`.
- Schema soporta `MULTIPLE_SELECT`, `MATCHING`, `FILL_BLANK`, `ORDER`. Habilitar al menos `MULTIPLE_SELECT` y `ORDER`.

#### F6.20 — Sin preview “como lo ve el alumno”
- Botón “Vista previa” que abra modal mostrando la pregunta tal cual la verá el invitado en móvil + desktop.

#### F6.21 — Sin auto-save en editor de quiz
- `PlayLessonEditor.tsx` ya implementa autosave debounce. Replicar.

#### F6.22 — Validación SHORT_ANSWER muy estricta
`guest.service.ts:236-238` — `submitted === correct` con `lowercase + trim`.
- Sin tolerancia a tildes (`tia` vs `tía`), espacios extra, signos.
- Implementar `normalizeAnswer(s)`: `s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, ' ')`.
- Soportar múltiples respuestas correctas separadas por `|` o un array `correctAnswers[]`.

---

### 🟡 Presenter docente (prioridad MEDIA)

#### F6.23 — Sin QR del joinCode
- En `LiveQuizPlayer.tsx:144-155` solo se muestra el código en texto.
- Agregar QR (`qrcode.react` o `react-qr-code`) que apunte a `https://edusyn.co/join/${joinCode}`.

#### F6.24 — Sin contador “X/Y respondieron”
- Backend tiene los datos en `LiveSessionGuestAnswer`. Falta endpoint o evento `ANSWER_STATS` (declarado en `play-stream.service.ts:14` pero **nunca emitido**).
- Emitir tras cada `submitAnswer`: `{ answeredCount, totalGuests, percent }`.
- UI: barra de progreso con %, “Esperando 3 respuestas más…”.

#### F6.25 — Sin botón “Pausar / Saltar”
- Solo `Siguiente / Terminar`. Agregar `Pause` que detenga el timer server-side.

#### F6.26 — Sin modo proyector / pantalla grande
- Pantalla con código gigante + lista de avatares flotantes + sin chrome del editor. Ruta `/play/quizzes/:id/projector/:sessionId` o tecla `F`.

#### F6.27 — Sin “Volver a jugar / Mezclar”
- Al `FINISHED`, ofrecer:
  - “Jugar de nuevo con los mismos invitados” (mantener `LiveSessionGuest`)
  - “Jugar mezclando preguntas” (`config.shuffle = true`)
  - “Nueva sesión limpia”

#### F6.28 — `LiveQuizPlayer` es solo preview, no presentador
- Hoy el docente ve el **mismo grid 2×2 que el alumno**, pero pequeño dentro de su panel.
- Presenter debería ser pantalla completa con la pregunta enorme, las 4 opciones grandes con colores Kahoot, contador del timer prominente y barra de respuestas.

---

### 🟢 Mobile + UX general (prioridad MEDIA)

#### F6.29 — JoinPage no usa toda la altura del móvil
- `JoinPage.tsx:327` `max-w-sm` centra una tarjeta pequeña.
- En móvil el alumno necesita **tap-targets grandes**: opciones de 50% de altura, sin scroll, sticky el header con avatar+score+timer.

#### F6.30 — `PLAY_API_URL` falla silenciosamente en prod
`apps/web/src/lib/play-sse.ts:3`
- Default `localhost:3000`. Si la env no se setea en build de producción, el SSE intenta conectar al localhost del cliente.
- Loggear warning al cargar el módulo si se queda con default.

#### F6.31 — Reconexión silenciosa por desconexión móvil
- Hoy hay 3 retries y luego fallback polling. Falta:
  - Banner visible “Reconectando…” entre retries.
  - Listener de `window.online/offline` para forzar reconexión inmediata.
  - Persistir respuesta enviada en `localStorage` mientras espera ack del backend (idempotencia).

#### F6.32 — Nicknames duplicados / sanitización inconsistente
`guest.service.ts:11-17` blacklist hardcoded muy corta.
- Falta: lista canónica de palabras prohibidas (mantener archivo `nickname-blocklist.txt`), comparación con `normalizeAnswer`.

---

### 🟢 Backend / infra (prioridad BAJA pero importante)

#### F6.33 — `QUESTION_CLOSED` y `ANSWER_STATS` declarados pero no emitidos
- Tipos en `play-stream.service.ts:10-14` y `play-sse.ts:14-18`.
- Implementar emisión real al cerrar pregunta (timer server o `Next` manual del docente).

#### F6.34 — `submitAnswer` sin throttling
- `guest-public.controller.ts` tiene throttle solo en `reaction` (línea 87). Falta en `submitAnswer` para evitar spam.

#### F6.35 — `guestToken` infinito
- No expira, no se invalida al `SESSION_FINISHED`.
- Firmar con `exp` y rechazar tokens de sesión finalizada.

#### F6.36 — SSE token visible en query string (logs)
- Mitigación: emitir un token efímero (1 min, single-use) en el join response específicamente para SSE, distinto del `guestToken` general.

#### F6.37 — Sin métricas de calidad por pregunta
- Tras cada sesión, agregado: `% acierto`, `tiempo promedio`, `pregunta más difícil`, `pregunta peor calificada`.
- Útil para que el docente refine el banco de preguntas.

---

### Plan de ataque sugerido (orden recomendado)

| Sprint | Items                                                                | Por qué primero                                                |
|--------|----------------------------------------------------------------------|-----------------------------------------------------------------|
| 6A     | F6.1, F6.2, F6.3, F6.4, F6.5, F6.7                                   | **Bugs que rompen el juego**. Sin esto nada se siente Kahoot.   |
| 6B     | F6.8, F6.9, F6.10, F6.11, F6.12, F6.13, F6.14, F6.15                 | Núcleo de la experiencia: colores, sonido, confeti, ranking.    |
| 6C     | F6.6, F6.16, F6.23, F6.24, F6.28, F6.29                              | Lobby vivo + presenter pro + móvil cómodo.                      |
| 6D     | F6.17, F6.18, F6.19, F6.20, F6.21, F6.22                             | Editor potente.                                                 |
| 6E     | F6.25, F6.26, F6.27, F6.30, F6.31, F6.32                             | Pulido + edge cases.                                            |
| 6F     | F6.33, F6.34, F6.35, F6.36, F6.37                                    | Endurecimiento backend + analytics.                             |

### Aceptación final de Fase 6

Una sesión live con 5 alumnos en móvil + 1 docente en proyector debe:

1. Cargar `/join` sin sesión zombi.
2. Lobby con avatares animados saltando al unirse.
3. Pregunta con imagen, 4 colores Kahoot, timer barra-grande, sonido tick últimos 5s.
4. Alumno toca → vibra → ve “Esperando a los demás…”.
5. Timer server-driven cierra → reveal sincronizado con confeti si acierta + sonido.
6. Scoreboard intermedio 5s antes de la siguiente pregunta.
7. Puntos = `points * speedFactor`, no fijo.
8. Final con podio animado, opción “Volver a jugar”.
9. Si pierdo conexión, banner reconectando, recupero estado al volver.
10. Docente ve QR + “3/5 respondieron” + botón pausar.
