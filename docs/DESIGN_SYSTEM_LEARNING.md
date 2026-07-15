# Design System — La Superficie Viva del aprendizaje

> Documento 5 de 5. Traduce la filosofía del Learning Engine en **componentes, tokens, motion, accesibilidad y
> reglas de diseño**. Es la capa L7 (la interfaz) hecha sistema. La interfaz es la **última consecuencia** de la
> filosofía; este documento asegura que sea excepcional y coherente.
> Base: `EDUSYN_LEARNING_ENGINE.md` (§13) y `LEARNING_EXPERIENCE_SPEC.md` (§10).
>
> **Estado: documento de trabajo (evoluciona con la implementación).**

---

## 1. Filosofía visual

> **Premium = silencio + un momento de color cuando importa.** (Apple / Linear / Arc, con identidad propia.)

Tres reglas que gobiernan todo:
1. **El fondo calla.** Canvas neutro, nunca degradados full-screen ni decoración que compita con el contenido.
2. **El color es significado, no adorno.** Codifica **habilidad**, **feedback** y **dominio**. Un acento saturado
   por pantalla, máximo.
3. **El contenido es el escenario.** Muere la tarjeta flotante de 18%. El contenido usa la pantalla; el vacío es
   respiración deliberada, no error.

La firma reconocible de Edusyn: **el medidor de dominio siempre presente** + **la marca viva de Valeria** + **la
quietud del canvas**. Se ve como *una plataforma que se toma en serio el aprendizaje.*

---

## 2. Tokens

### 2.1 Color
```
canvas:      #FAFAF9 (light)  ·  #0B0B0F (dark)      ← el fondo, silencioso
surface-1/2/3: escalones sutiles sobre el canvas (elevación por superficie, no sombra)
text: primary (casi-negro/blanco) · secondary · muted   ← SIEMPRE contraste ≥ 4.5:1

skill.reading    #2E6BE6      skill.listening  #0E9F8E
skill.speaking   #7C5CFF      skill.writing    #E08A1E     ← acentos al 10–15%, 100% solo en lo activo

feedback.correct #1FA971  ·  feedback.error #E5484D  ·  feedback.warn #E0A020   ← SOLO en feedback
mastery          teal-violeta (llena el medidor de dominio — el héroe)
valeria          #7C5CFF suave (su presencia ambiental)
```
**Regla de texto sobre color:** nunca texto oscuro sobre acento saturado; usar el par correcto (canvas + texto casi-negro/blanco).

### 2.2 Tipografía
```
sans (UI/enunciados): Inter / system  ·  escala 12 · 14 · 16(body) · 20 · 28 · 40  ·  pesos 400/500
lectura inmersiva: 18–20px · line-height 1.7 · medida 66ch
voz/reflexión: serif (--font-voice) — cuando el estudiante ESCRIBE, no rellena un form
```

### 2.3 Espaciado, radios, sombras
```
space (base 4): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64   (ritmo vertical en múltiplos de 8)
radius: control 8 · card 16 · stage 24
border: 1px hairline (--border)  ·  2px SOLO en el elemento "featured"
sombras: casi ninguna → elevación por CONTRASTE DE SUPERFICIE. Sombra solo en overlays.
```

### 2.4 Motion
```
dur: micro 150ms · base 220ms · enter 300ms · celebrate 600ms
ease: cubic-bezier(.2,.8,.2,1)
respeta prefers-reduced-motion → todo cae a fades simples
```

---

## 3. Componentes (el Design System)

Todos consumen los mismos tokens. **Sin componentes huérfanos.**

| Componente | Rol | Estados / variantes |
|---|---|---|
| `<Quest>` | Contenedor de la misión | — |
| `<CompetencyMeter>` | **El héroe:** dominio en vivo | subiendo · demostrado · nivel |
| `<JourneyRail>` | Progreso por **momentos** (no puntitos) | activo · hecho · pendiente · checkpoint(◆) · adaptado |
| `<ActionBar>` | **Una** acción primaria contextual | continue · check · submit · retry · finish |
| `<Stage variant>` | Escenario adaptativo | reading · question · media · reflection · challenge · celebration |
| `<BlockRenderer>` | Switch por tipo → bloque puro | — |
| `<ValeriaPresence>` | Presencia ambiental | latente · interviniendo · replegada |
| `<LearningContract>` | Contrato de apertura | — |
| `<SkillAccent data-skill>` | Token de color por habilidad | reading/listening/speaking/writing |
| `<ContentColumn>` | Columna de lectura óptima | 640/720px |
| `<VocabChip>` | Vocabulario | idle · hover · tapped |
| `<ChoiceCard>` | Opción (neutra, no Kahoot) | idle · selected · correct · incorrect · disabled |
| `<InlineBlank>` | Completar en línea | idle · typing · correct · incorrect |
| `<WordBank>` | Ordenar/construir frase | — |
| `<MatchPairs>` | Conectar ideas | — |
| `<MediaFrame>` | Video/audio | con preguntas en timestamp |
| `<RecordButton>` | Pronunciación | idle · recording · result |
| `<ReflectionCanvas>` | Escritura libre | serif, sin bordes duros |
| `<FeedbackInline>` | Feedback inmediato | correct · incorrect · hint |
| `<MasteryBurst>` | Recompensa | dominio ▲ · can-do desbloqueado |
| `<CelebrationScene>` | Cierre | confeti (solo aquí) |

**Estados estándar en todo componente interactivo:** `idle · hover · focus · active · selected · correct · incorrect · disabled`.

---

## 4. Patrones de interacción

### 4.1 El Stage adaptativo
Un solo contenedor que recibe `variant` y aplica el grid/tipografía correctos. **Los bloques NO manejan su layout
de pantalla** — lo heredan del Stage. Esto garantiza consistencia (leer ≠ decidir ≠ crear, un solo sistema).

### 4.2 El Journey Rail (reemplaza "1/11")
Momentos con **nombre**, no números. El checkpoint activo late suavemente. **Se adapta**: si el Motor inserta
refuerzo, aparece un nodo → el estudiante *ve que el camino le respondió*.

### 4.3 Una sola acción primaria
La `ActionBar` cambia de verbo por contexto (Continuar/Comprobar/Enviar). "Atrás" = gesto discreto (←/swipe), nunca
un botón que compite. Teclado: Enter/Espacio = primaria, 1–4 = opciones, ←/→ = navegar.

### 4.4 Máquina de estados (universal, del Spec §2)
`ENTER → ENGAGED → CHECKING → FEEDBACK → BRANCH`. El input/UI del acto existe **según el estado**, no según el tipo
suelto → imposible el bug "no deja escribir".

---

## 5. Motion y microinteracciones

- **Entre momentos:** cross-fade + slide de 12px (220ms). No "pasar diapositiva"; se siente *avanzar*.
- **Selección:** escala 1.02 + acento; al comprobar, correcta hace *settle* verde, incorrecta *shake* de 6px.
- **Completar:** el input correcto "se sella" (borde verde + check con spring).
- **Medidor de dominio:** sube **animado** con cada evidencia (no aparece de golpe) — el progreso se *ve* crecer.
- **Valeria:** crece inline desde su marca (300ms) y se repliega — nunca modal.
- **Journey Rail:** el checkpoint alcanzado se ilumina con un barrido.
- **Confeti:** SOLO en la celebración final (un can-do). En aciertos: micro-burst de 6 partículas, opcional.
- Todo detrás de `useReducedMotion()`.

---

## 6. Feedback

- **Inmediato, específico y sobre el proceso** (no solo "correcto"). Toast inline **bajo** la pregunta, no modal
  (no rompe el flujo).
- Error = información, no castigo: color de error contenido, tono cálido, y **Valeria enseña** en el 2º fallo.
- El feedback positivo se **conecta al dominio** ("+ dominio en describir familia"), no a puntos vacíos.

---

## 7. Responsive (Mobile First)

- **Móvil (base):** Stage full-screen, contenido a ancho completo (padding 20px). Journey Rail colapsa a barra fina
  arriba. ActionBar **fija abajo** (thumb-zone, 56px). Avance por swipe.
- **Tablet:** columna de lectura 680px centrada; el Rail muestra nombres de momento.
- **Desktop:** el espacio lateral es **respiración deliberada**; el contenido a ~760px, nunca una cajita de 18%.
- **Un solo sistema escalado**, no tres diseños distintos.

---

## 8. Dark mode

- **Real, no invertido:** canvas `#0B0B0F`, superficies en escalones, acentos de habilidad ajustados a luminancia.
- Los tokens (§2) definen ambos modos; los componentes nunca hardcodean color → dark mode "gratis".

---

## 9. Accesibilidad

- **Contraste ≥ 4.5:1** en todo texto (el fallo #1 del diseño viejo). Canvas neutro + texto casi-negro/blanco lo garantiza.
- **Teclado completo:** Tab entre opciones, Enter = primaria, 1–4 = elegir, ←/→ = navegar. Focus ring visible siempre (2px acento).
- **Lectores de pantalla:** cada bloque con `role`/`aria-label`; feedback con `aria-live`.
- **Objetivos táctiles ≥ 44px.**  **Reduced motion** respetado.
- **Dislexia-friendly:** interlineado 1.7, medida corta, opción de fuente legible.

---

## 10. Cómo se ve cada escenario (resumen)

Wireframes detallados en la conversación de diseño; regla por escenario:

| Escenario | Identidad visual |
|---|---|
| Lectura | columna inmersiva, azul (Reading), calma; el texto ES la pantalla |
| Video/Audio | full-bleed / onda; pregunta en timestamp |
| Pregunta | opciones **neutras** (no Kahoot); acento al seleccionar; verde/rojo solo tras comprobar |
| Construir/Conectar | banco de palabras / líneas al unir |
| Completar | input **en línea** dentro de la frase |
| Pronunciación | botón grabar; inteligibilidad (futuro) |
| Reflexión | serif, lienzo sereno, sin bordes duros |
| Reto/Evaluación | canvas oscurecido, ◆ en el Rail, sin pistas |
| Celebración | can-do desbloqueado + vecino del grafo; confeti |

---

## 11. React + Tailwind (implementación)

```tsx
<Quest quest={q} student={ctx}>
  <CompetencyMeter competency={q.target} live />       // el héroe, siempre visible
  <JourneyRail moments={adaptivePath} current={i} />    // adaptativo, no puntitos
  <ValeriaPresence signals={signals} />                 // ambiental, inline
  <Stage variant={moment.stage} data-skill={moment.skill}>
    <BlockRenderer moment={moment} onEvidence={emit} /> // switch por tipo
  </Stage>
  <ActionBar action={contextualAction} />
</Quest>
```
- **Tokens en `tailwind.config`:** `colors.{canvas,surface,skill,feedback,mastery,valeria}`, spacing 4-base, radios, motion.
  **Cero hex sueltos** en componentes.
- **`data-skill` en el root del Stage** → el acento se resuelve por CSS var (`--accent`), un solo lugar.
- **framer-motion** (ya en uso): `AnimatePresence` entre momentos, `layout` en Rail y medidor, variants para feedback/Valeria.
  Todo tras `useReducedMotion()`.
- **Máquina de estados por momento** (XState o reducer) → mata bugs de estado (input/feedback siempre correctos).
- **Reusa el backend:** `LessonSlide`→momentos, grafo CEFR, evidencia, orquestador. **El rediseño es ~90% frontend.**
- **Regla Tailwind de oro:** el fondo de `<Quest>` es `bg-canvas` fijo; el acento vive en `--accent` por `data-skill`.
  **Eliminar `bg-gradient-to-br from-*-900` por slide.**

---

## 12. Roadmap de diseño

- **DS-0 · Higiene (sobre el LessonPlayer actual):** canvas neutro, contraste WCAG, columna de lectura, fuera
  puntitos/etiquetas meta, opciones neutras (matar Kahoot). *60% de la mejora percibida, riesgo bajo.*
- **DS-1 · Stage + máquina de estados:** `<Stage variant>` + `<BlockRenderer>` (reading/question/media). Arregla escribir/completar.
- **DS-2 · Competencia como héroe + Journey Rail:** `<CompetencyMeter>` en vivo + Rail de momentos.
- **DS-3 · Valeria ambiental + Contrato + microinteracciones.**
- **DS-4 · Escenarios ricos:** reflexión, reto, celebración, arrastrar/relacionar/proyecto, video con preguntas.

> Empezar por **DS-0 + DS-1**: se ve y se siente el cambio en staging en días, con bajo riesgo, y desbloquea todo lo demás.
