# Estado del Aula Virtual — qué está hecho y qué no

Fecha: 2026-09-08 · Continúa [`REDISENO_AULA_VIRTUAL.md`](REDISENO_AULA_VIRTUAL.md), cuyo §9
(«Qué falta») queda **sustituido** por este documento.

> ## En una frase
>
> **El aula nueva es ya la predeterminada y no obliga a salir de ella para nada.** Pero eso se
> consiguió **reutilizando** cuatro pestañas del aula anterior, no reescribiéndolas: por eso el
> aula anterior no se puede retirar todavía.

---

## 1. Dónde vive cada cosa

| Dirección | Qué abre |
|---|---|
| `/aula` | **El aula nueva.** Es a donde entra el menú |
| `/classroom`, `/my-classes` | También el aula nueva — los enlaces antiguos siguen sirviendo |
| `/aula-clasica` | El aula anterior, como respaldo |

Cambiar de una a otra **no escribe nada en el servidor**: es solo una preferencia de interfaz.
El interruptor funciona en los dos sentidos.

## 2. Los ocho huecos de §9 — cerrados

| # | Faltaba (5-sep) | Hoy | Cómo |
|---|---|---|---|
| F1 | Editar una actividad | ✅ | Editor anterior montado dentro |
| F2 | Resolver quiz, examen, simulacro | ✅ | `ActivitiesTab` montado dentro |
| F3 | Añadir preguntas a un quiz | ✅ | Ídem |
| F4 | Publicar y editar anuncios | ✅ | `AnnouncementsTab` montado dentro |
| F5 | Foro | ✅ | `ForumTab` montado dentro |
| F6 | **Entrega por audio** | ✅ | **Escrito nuevo** (§4) |
| F7 | Subir material a una unidad | ✅ | `ContentTab` montado dentro |
| F8 | Valeria para generar contenido | ✅ | Lleva al editor, donde vive el asistente |

Y los dos destinos que solo mostraban un puente —**Rutas** y **Expedición ABP**— están montados
en el shell, cada uno con carga diferida propia.

**Los ocho destinos del riel funcionan:** Hoy · Actividades · Unidades · Notas · Rutas ·
Expedición · Foro · Estudiantes.

## 3. La decisión que hay que entender

Seis de los ocho huecos se cerraron **montando las pestañas del aula anterior dentro del shell
nuevo**:

```
// apps/web/src/pages/aula/views/HerramientasAula.tsx
import { ActivitiesTab, AnnouncementsTab, ContentTab, ForumTab } from '../../Classroom'
```

**Por qué está bien:** el docente ya no cambia de aula, y no se reescribieron ~1 500 líneas de
editores que funcionan y están probados en producción.

**Qué cuesta, y conviene tenerlo presente:**

1. **`Classroom.tsx` (7 167 líneas) no se puede borrar.** El aula nueva depende de él. El plan de
   §9.3 —«los 28 `catch {}` se van con la retirada del aula actual»— queda aplazado: van **26**, y
   no bajarán mientras exista esa dependencia.
2. **El lenguaje visual de esas cuatro herramientas sigue siendo el anterior**, dentro del marco
   nuevo.

**Lo que sí se cuidó:** `HerramientasAula` se carga con `lazy()`. Comprobado en el build —
`Classroom.tsx` queda en un trozo propio de **92,5 kB gzip**, fuera del paquete de entrada. La
frontera de R1 se respeta: esas 7 167 líneas no se descargan hasta que alguien abre una herramienta.

## 4. Entrega por audio

Único hueco que se escribió de cero, y el último que obligaba a salir del aula nueva.

| Paso | Dónde |
|---|---|
| El docente marca **«Se responde con un audio»** al crear la tarea | `CrearActividad.tsx` |
| Viaja como `audioResponse`; el backend lo guarda en `metadata` | ya existía |
| El estudiante **graba desde el panel de entrega** | `EntregaTarea.tsx` |
| La tarjeta lo indica en la lista | `ActivityCard.tsx` |

Se reutiliza el `AudioRecorder` de `components/media/SmartMedia.tsx`, que ya existía. La grabación
sale como un `File` normal, así que viaja por el mismo camino que un adjunto: **no hubo que tocar
el envío**. Si la tarea pide audio, el aviso de entrega vacía dice *graba*, no *escribe*.

Límite heredado del componente: **5 minutos** por grabación (el backend limita a 10 MB). Si el
navegador no permite grabar, lo dice y ofrece adjuntar un archivo de audio.

## 5. Lo que sigue abierto

| # | Qué | De quién depende |
|---|---|---|
| P0-6 | **El rol ACUDIENTE** cae en la vista de estudiante | **Decisión de producto tuya:** qué debe ver un acudiente. Verificado: las dos aulas usan el **mismo** criterio (`DOCENTE`/`COORDINADOR` → docente; el resto → estudiante), así que el cambio de predeterminada no empeoró nada |
| P0-5 | 26 `catch {}` en `Classroom.tsx` | Se van con la retirada del aula anterior (§3) |
| — | **Retirar el aula anterior** | Trabajo grande: extraer las cuatro pestañas a componentes propios |
| — | Lenguaje visual de las cuatro herramientas reutilizadas | Va con lo anterior |

## 6. Deuda de pruebas, sin cambios

Solo se prueba `model/`: **14 archivos, 171 pruebas** del modelo del aula (198 en todo el web).
**No hay pruebas de componentes** — el proyecto no tiene `@testing-library` y añadirlo es una
decisión aparte. La lógica que decide *qué se ve* sí está cubierta; el renderizado no.

## 7. Verificación

| | Resultado |
|---|---|
| Pruebas web | **18 archivos · 198 pruebas** |
| Pruebas API | **78 suites · 1 171 pruebas** |
| `tsc --noEmit` web y API | limpio |
| `vite build` | correcto |
| Paquete de entrada | 148,2 kB gzip (R1 dejó 144,5; +3,7 kB de este trabajo) |
| `Classroom.tsx` | trozo aparte de 92,5 kB gzip, fuera de la entrada |

## 8. Trampas que ya costaron una pantalla

Siguen vigentes y están detalladas en `REDISENO_AULA_VIRTUAL.md` §11. Resumen, porque se repiten:

1. **Las notas llegan como texto, no como número.** Prisma serializa `Decimal` como cadena;
   `"4.2".toFixed(1)` revienta y deja la pantalla en blanco. Pasó con datos reales. Usar `aNumero`.
2. **El texto del docente trae espacios duros** (U+00A0): rompen el corte de línea.
3. **Un `<select>` nativo corta su etiqueta**, no la recorta con «…».
4. **`truncate` necesita `min-w-0`** en toda la cadena de flex.
5. **Lo que flota sobre una portada le quita ancho a todas las líneas**, no solo a la primera.
