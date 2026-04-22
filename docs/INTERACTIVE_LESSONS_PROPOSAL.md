# 📚 Lecciones Interactivas — Propuesta de Diseño

## Visión General

Una **lección interactiva** es una experiencia tipo "curso en miniatura" dentro de un Classroom. El docente construye un tema con **diapositivas multimedia + actividades embebidas** que el estudiante debe completar secuencialmente. La IA (Valeria) puede generar todo el contenido a partir de un tema o texto pegado.

---

## 🎯 Objetivos

| Requisito | Solución |
|---|---|
| Contenido tipo diapositivas | Slides con texto rico, imágenes, videos, audio |
| Actividades interactivas | Mini-quizzes embebidos entre slides (MC, V/F, drag&drop, fill-blank) |
| Barra de progreso | Progress bar persistente por estudiante |
| Puntaje | Score acumulado de actividades dentro de la lección |
| Insignias/Badges | Al completar 100%: badge con animación confetti |
| Anti-trampa (no salir) | Si sale, reinicia desde el último checkpoint (no desde 0) |
| Control docente | Publicar/ocultar lecciones, ver progreso de cada alumno |
| IA Valeria | Pegar tema → genera secciones + slides + actividades automáticamente |

---

## 🏗️ Arquitectura de Datos

### Nuevos modelos Prisma (100% aditivos)

```
Lesson (1 por actividad LESSON)
├── LessonSlide[] (diapositivas ordenadas)
│   ├── type: CONTENT | ACTIVITY | CHECKPOINT | BADGE_REVEAL
│   ├── content (JSON): título, texto rico, imagen, video, audio
│   └── activityData (JSON): pregunta embebida si type=ACTIVITY
└── LessonProgress (1 por estudiante × lección)
    ├── currentSlideIndex
    ├── completedSlides[] (JSON array)
    ├── score / maxScore
    ├── status: NOT_STARTED | IN_PROGRESS | COMPLETED
    ├── badgeEarned: Boolean
    ├── startedAt / completedAt
    └── answers (JSON): respuestas dadas en cada slide ACTIVITY
```

### Tipos de Slide

| Tipo | Descripción | UX |
|---|---|---|
| `CONTENT` | Texto rico + imagen/video/audio | Lectura, el estudiante avanza con "Siguiente" |
| `ACTIVITY` | Mini-quiz embebido (MC, V/F, fill, drag) | Debe responder para avanzar; feedback inmediato |
| `CHECKPOINT` | Marcador de progreso seguro | Si sale, vuelve aquí (no al inicio) |
| `BADGE_REVEAL` | Último slide: insignia + confetti + resumen | Celebración final |

### Estructura del `content` JSON (slide CONTENT)

```json
{
  "title": "Fotosíntesis",
  "body": "<p>La fotosíntesis es el proceso...</p>",
  "imageUrl": "https://...",
  "videoUrl": "https://youtube.com/...",
  "audioUrl": "https://...",
  "layout": "text-left-image-right" | "image-top" | "full-text" | "video-center"
}
```

### Estructura del `activityData` JSON (slide ACTIVITY)

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "question": "¿Qué gas absorben las plantas?",
  "options": ["O2", "CO2", "N2", "H2"],
  "correctAnswer": "CO2",
  "explanation": "Las plantas absorben CO2 durante la fotosíntesis",
  "points": 10,
  "hint": "Piensa en el intercambio gaseoso..."
}
```

---

## 🎮 Experiencia del Estudiante (LessonPlayer)

### Flujo completo

1. **Pantalla de inicio**: Título de la lección, descripción, número de slides, puntos posibles, badge preview
2. **Slide a slide**: Navegación secuencial (no puede saltar adelante, sí volver atrás a slides ya vistos)
3. **Slides de contenido**: Lee, ve video, escucha audio → botón "Continuar"
4. **Slides de actividad**: Responde → feedback inmediato (correcto/incorrecto + explicación) → score se actualiza
5. **Checkpoints**: Guarda progreso automático; si sale, vuelve aquí
6. **Badge final**: Confetti + insignia personalizada + resumen de puntos + botón "Volver al aula"

### Anti-trampa

- **Fullscreen mode** recomendado (no forzado)
- Si el estudiante **cierra o navega fuera**: al reabrir, vuelve al último CHECKPOINT
- Los slides de ACTIVIDAD ya respondidos **mantienen su respuesta** (no se repiten)
- Las respuestas se guardan en `LessonProgress.answers` en el servidor
- **Timer opcional**: si el docente configura tiempo, hay countdown
- **No se puede copiar texto** del slide (CSS user-select: none + JS)

### UX Diseño

- **Fondo degradado** que cambia según la sección (como el Live Quiz)
- **Barra de progreso** en la parte superior (porcentaje + slide actual / total)
- **Animaciones framer-motion** entre slides (slide-in, fade, scale)
- **Sonidos sutiles** en aciertos/errores (reutilizar Web Audio del Live Quiz)
- **Mascota/avatar** del estudiante visible en esquina (si tienen avatar del Live Quiz)
- **Transiciones smooth** entre slides con gesture de swipe en mobile

---

## 🧑‍🏫 Experiencia del Docente (LessonEditor)

### Editor visual

1. **Panel izquierdo**: Lista de slides (drag-to-reorder)
2. **Panel central**: Editor del slide seleccionado
3. **Panel derecho**: Propiedades (tipo, puntos, layout, checkpoint)
4. **Toolbar**: Agregar slide (contenido/actividad/checkpoint), IA Valeria, preview

### Controles docente

- **Publicar/ocultar** lecciones individuales
- **Orden secuencial obligatorio**: el estudiante no puede saltar lecciones
- **Ver progreso**: tabla con cada estudiante, su %, score, badge, tiempo
- **Duplicar lección** para reutilizar en otro classroom
- **Importar/Exportar** JSON de lección

### Integración IA Valeria

**Flujo "Crear con IA":**
1. Docente pega un texto largo o describe un tema
2. Valeria genera automáticamente:
   - Secciones lógicas del tema
   - Slides de contenido con texto organizado
   - Actividades intercaladas (1 actividad cada 2-3 slides de contenido)
   - Checkpoints automáticos (1 cada sección)
   - Badge final
3. El docente puede editar, reordenar, agregar/quitar slides
4. Un solo clic para publicar

**Prompt para Valeria:**
```
"Organiza el siguiente tema en una lección interactiva para estudiantes de [grado].
Divide en secciones lógicas, cada una con 2-4 slides de contenido y 1-2 actividades intercaladas.
Las actividades deben ser variadas (opción múltiple, verdadero/falso, completar).
Incluye explicaciones para cada respuesta correcta.
Agrega checkpoints entre secciones."
```

---

## 🏅 Sistema de Badges

- Cada lección tiene un **badge temático** (emoji + color + título)
- El docente puede personalizar el badge o usar uno automático
- Al completar 100% de los slides: badge se desbloquea con animación
- Los badges se muestran en el perfil del estudiante
- Gamificación: "Has completado 5/10 lecciones de Ciencias"

---

## 📊 Panel de Progreso (Docente)

| Estudiante | Progreso | Score | Badge | Tiempo | Último acceso |
|---|---|---|---|---|---|
| Juan Pérez | ████░░ 67% | 45/70 | ⏳ | 12m | Hace 2h |
| María López | ██████ 100% | 68/70 | 🏆 | 18m | Hace 1d |
| Pedro Ruiz | ░░░░░░ 0% | 0/70 | — | — | Nunca |

---

## 🔧 Endpoints API

| Método | Ruta | Descripción |
|---|---|---|
| POST | /classrooms/:id/lessons | Crear lección (con slides) |
| GET | /classrooms/:id/lessons | Listar lecciones del classroom |
| GET | /lessons/:id | Obtener lección con slides |
| PUT | /lessons/:id | Actualizar lección (slides, config) |
| DELETE | /lessons/:id | Eliminar lección |
| POST | /lessons/:id/slides | Agregar slide |
| PUT | /lessons/:id/slides/reorder | Reordenar slides |
| GET | /lessons/:id/progress | Progreso del estudiante actual |
| POST | /lessons/:id/progress | Actualizar progreso (avanzar slide, responder) |
| GET | /lessons/:id/progress/all | Progreso de todos (docente) |
| POST | /lessons/:id/generate-ai | Generar lección con IA |

---

## Implementación por fases

### Fase 1 (este PR): Core funcional
- Schema Prisma + migración aditiva
- Backend: CRUD lección + slides + progreso + IA
- Frontend: LessonPlayer (estudiante) + LessonEditor (docente)
- Integración en Classroom

### Fase 2 (futuro): Mejoras
- Drag & drop en actividades de ordenar
- Slides de audio/podcast
- Modo presentación para el docente (proyector)
- Analytics avanzados
- Exportar a PDF
