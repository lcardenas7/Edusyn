# Edusyn Crea — Publicar apps funcionales (datos, juegos, notificaciones)

Estado: **aprobado** (2026-09-21) con dos decisiones: publicación **con aprobación del docente** y
dominio a elección técnica (servicio propio `crea-apps` en Railway; se puede mover a un dominio
propio después sin cambiar código, solo `CREA_APPS_ORIGIN`). **Entrega 1 implementada** (ver §12).

## 1. Qué queremos

Que lo que construye un estudiante **funcione de verdad** cuando se publica:

- una **app estudiantil** que guarda registros (tareas, préstamos, reportes, inscripciones) y que
  todos los usuarios ven igual;
- un **juego** con tabla de puntajes compartida y partidas guardadas;
- una **web** con formulario de contacto, encuesta o muro de mensajes que guarda las respuestas;
- **avisos** (notificaciones) cuando pasa algo: «nueva tarea publicada», «te superaron en el ranking».

Y que se pueda **abrir con un enlace o QR e instalar en el celular** (Android y iPhone).

Las cuentas no son el objetivo. Si una app necesita saber «quién soy», se usa un apodo (sección 5.4).

### 1.1 El objetivo pedagógico: que otros la usen

El producto final no es el código ni la instalación: es **una app que otras personas usan**.
El estudiante la crea completa en Edusyn, la instala en su teléfono, consigue que compañeros,
amigos y familia la instalen y la usen, y el docente **evalúa esa adopción con datos**, además
de la calidad de la app. Esto convierte a Crea en un ciclo real de producto: construir →
publicar → conseguir usuarios → aprender de cómo la usan → mejorar (nueva versión).

## 2. Principio de diseño: capacidades, no servidor propio

El estudiante **no programa un servidor ni una base de datos**. Edusyn le da capacidades listas
a través de un objeto `edusyn` disponible en `app.js`, igual que un navegador ofrece
`localStorage`. Así:

- una IA externa lo usa con una sola línea de instrucción en el prompt;
- el código sigue siendo HTML/CSS/JS de tres archivos (lo que el taller ya maneja);
- Edusyn controla límites, aislamiento y seguridad en un solo punto.

```js
// Registros compartidos (todos los que usan la app ven lo mismo)
await edusyn.datos.agregar("tareas", { titulo: "Taller de física", entrega: "2026-10-02" })
const tareas = await edusyn.datos.listar("tareas", { orden: "entrega" })
await edusyn.datos.actualizar("tareas", id, { hecha: true })
await edusyn.datos.borrar("tareas", id)
edusyn.datos.escuchar("tareas", lista => pintar(lista))      // se actualiza solo

// Juegos
await edusyn.puntajes.enviar("nivel-1", 1200)
const top = await edusyn.puntajes.top("nivel-1", 10)
await edusyn.partida.guardar({ nivel: 3, vidas: 2 })          // por dispositivo/apodo
const partida = await edusyn.partida.cargar()

// Avisos
await edusyn.avisos.pedirPermiso()                            // el usuario acepta
await edusyn.avisos.enviar("Nueva tarea", "Taller de física para el 2 de octubre")

// Quién soy (opcional)
const yo = await edusyn.usuario.apodo()                       // pide un apodo una vez
```

## 3. Cómo corre cada cosa

| Lugar | Datos | Avisos | Internet |
|---|---|---|---|
| Vista previa del taller | **Espacio de prueba** del equipo (datos reales pero separados; se pueden vaciar) | Se simulan dentro de la vista previa | Bloqueado; `edusyn.*` pasa por el host (postMessage) |
| App publicada (enlace/QR/instalada) | **Espacio publicado** de esa app | Notificaciones reales del sistema (push) | Solo hacia la API de Edusyn Datos |
| Archivo descargado | Solo `localStorage` (sin `edusyn.datos`) | No | — |

La vista previa **no abre la red**: el runner envía cada llamada `edusyn.*` al taller por
`postMessage`, y el taller la reenvía a la API con la sesión del estudiante. Se mantiene la
política actual (`connect-src 'none'`).

La app publicada vive en un **origen aparte** (p. ej. `apps.edusyn.co/<token>/`), sin cookies
ni sesión de Edusyn. Su CSP solo permite `connect-src` hacia la API pública de Datos.

## 4. Publicar

1. El equipo pulsa **Publicar** sobre una versión guardada (nunca sobre código a medias).
2. Edusyn genera un **token largo e imposible de adivinar** → enlace + QR.
3. La página publicada incluye automáticamente: `manifest.webmanifest` (nombre, ícono, colores),
   un **service worker** (instalable + funciona sin conexión con lo último cargado) y el SDK
   `edusyn`.
4. Republicar actualiza la misma dirección; los datos se conservan.
5. El **docente** puede: activar/desactivar la publicación, ponerle vencimiento, ver y vaciar
   los datos, y exigir su aprobación antes de que la app quede pública.

Instalación: Android (Chrome) muestra «Instalar app»; iPhone: Compartir → «Agregar a pantalla
de inicio». La app queda con ícono propio y pantalla completa.

## 5. Capacidades en detalle

### 5.1 Datos (`edusyn.datos`)
- Colecciones de documentos JSON por app (como una hoja de cálculo por pestaña).
- Operaciones: agregar, listar (filtro simple, orden, límite), obtener, actualizar, borrar.
- `escuchar`: actualización casi en vivo por sondeo cada pocos segundos (sin websockets en la
  primera versión; suficiente para muros, listas y rankings).
- Cada documento guarda automáticamente fecha y autor (apodo/dispositivo).
- **Reglas simples** que el equipo marca por colección: «cualquiera agrega», «solo el autor
  edita/borra lo suyo», «solo lectura» (datos que carga el equipo desde el taller).

### 5.2 Juegos (`edusyn.puntajes`, `edusyn.partida`)
- Tablas de puntajes por nombre (tabla «nivel-1», «semanal»…), con top N y posición propia.
- Partida guardada por dispositivo o apodo: continúa en otro momento o tras instalar.
- Multijugador en tiempo real queda fuera de la primera versión (ver §9).

### 5.3 Avisos (`edusyn.avisos`)
- **Web Push** estándar (claves VAPID en la API, suscripción guardada por app y dispositivo).
- Android: funciona desde el navegador o instalada. iPhone (iOS 16.4+): **solo con la app
  instalada** en la pantalla de inicio — el taller lo explica.
- Quién puede enviar: la propia app (p. ej. al agregar una tarea, avisa a los suscritos) y el
  equipo desde el taller («Enviar aviso»). Con límite por hora y texto corto, sin enlaces
  externos.
- Avisos programados («recordar el 2 de octubre a las 7 a. m.») en una segunda etapa.

### 5.4 Apodo (`edusyn.usuario`)
- La primera vez pide un apodo y lo recuerda en ese dispositivo. Sirve para «mis tareas», el
  ranking y la autoría. No hay correo, contraseña ni datos personales.
- Si una app lo necesita, se añade un PIN corto para recuperar el apodo en otro dispositivo.

### 5.5 Imágenes (etapa 2)
- `edusyn.archivos.subir(foto)` para fotos de reportes o galerías, sobre el almacenamiento R2
  que Edusyn ya usa, con límite de tamaño y solo imágenes.

### 5.6 Uso e impacto (medición automática)

Toda app publicada mide su uso **sin que el estudiante programe nada** (lo hace el SDK que Edusyn
inyecta al publicar):

| Indicador | Cómo se obtiene |
|---|---|
| **Visitas** y **dispositivos únicos** | Identificador anónimo aleatorio guardado en el dispositivo (no es la persona, no hay IP guardada) |
| **Instalaciones** | Evento `appinstalled` (Android) + primera apertura en modo instalado (`display-mode: standalone`, también iPhone) |
| **Usuarios activos** por día y por semana | Aperturas de la app por dispositivo |
| **Sesiones** y tiempo aproximado de uso | Apertura/cierre y visibilidad de la pestaña |
| **Retención** | Dispositivos que vuelven 1, 7 y 30 días después de la primera vez |
| **Uso real de las funciones** | Registros creados, puntajes enviados, avisos aceptados |
| **Origen** | QR, enlace compartido o instalada (parámetro del enlace) |

El **equipo** ve su tablero («32 dispositivos, 14 instalaciones, 9 activos esta semana») y lo usa
para mejorar su app. El **docente** ve el mismo tablero por equipo y el comparativo del curso.

**Para evaluar:** el docente puede fijar una **meta de adopción** (p. ej. «10 instalaciones y 5
usuarios activos en la semana 2») y se incluye un criterio de rúbrica «Adopción e impacto» junto a
«Funciona», «Cumple el plan» y «Explica su código». Los indicadores quedan en la bitácora del
equipo como evidencia (quién publicó, cuándo, cómo creció el uso).

**Contra trampas:** se cuentan dispositivos únicos (recargar mil veces no suma); se marcan picos
anómalos (muchas «instalaciones» en minutos desde el mismo origen) y los dispositivos de los
propios integrantes se muestran aparte («uso del equipo» vs. «uso de otros»).

**Privacidad:** no se guardan nombres, IP, ubicación ni datos del teléfono; solo conteos por
identificador anónimo. La app muestra un aviso breve de que es un proyecto escolar que mide uso
anónimo.

## 6. Seguridad y cuidado de menores

- **Aislamiento total por app:** una app no lee datos de otra; nada toca datos del colegio.
- **Límites:** p. ej. 5 MB y 5.000 registros por app, 60 escrituras/min por dispositivo,
  documentos de hasta 10 KB, avisos limitados por hora. Se reutiliza el throttler de la API.
- **Moderación:** botón «Reportar» en la app publicada; el docente ve lo reportado y puede
  borrar, vaciar o despublicar. Aviso visible: «App escolar de práctica — no compartas datos
  personales».
- **Nada de datos personales ni contraseñas reales**; se advierte en el prompt de la IA.
- Los tokens públicos solo dan acceso a esa app y se pueden revocar en un clic.
- Retención: los datos publicados se borran al vencer la publicación o al cerrar el año.

## 7. Lo que ve cada quien

- **Estudiante (taller):** botón «Publicar» → enlace, QR e instrucciones de instalación;
  pestaña **«Datos»** para ver y vaciar los registros (de prueba y publicados); «Enviar aviso».
- **Docente:** en la tarjeta del equipo, estado de publicación, uso de datos, reportes y los
  controles de §4.
- **Prompt de la IA:** según el tipo (web/app/juego) indica cómo usar `edusyn.datos`,
  `edusyn.puntajes` y `edusyn.avisos` en vez de inventar servidores.

## 8. Piezas técnicas

- **API (NestJS):** módulo `crea-publish` con modelos `ConstruyePublication` (token, versión,
  estado, vencimiento), `ConstruyeAppRecord` (app, colección, id, datos JSON, autor, fechas),
  `ConstruyeAppScore`, `ConstruyePushSubscription`; endpoints públicos por token con límites y
  endpoints del taller con sesión. Migración aditiva.
- **Servicio de publicación:** el servicio `crea-preview` actual (u otro gemelo) sirve
  `apps.<dominio>/<token>/` con manifest, service worker y SDK. Requiere un dominio y un servicio
  en Railway (staging y producción).
- **Runner de vista previa:** inyecta el SDK en modo «puente» (postMessage).
- **Dependencia nueva:** `web-push` en la API.

## 9. Fuera de la primera versión

Multijugador en tiempo real (websockets), pagos, correo/SMS, acceso a APIs externas, subir
archivos que no sean imágenes, publicar en tiendas (Play Store/App Store).

## 10. Entregas propuestas

1. **Publicar + QR + instalable + medición de uso** (manifest, service worker, origen aparte,
   controles docente, tablero de uso del equipo y del docente). Es la base de la evaluación.
2. **Datos compartidos + reglas + pestaña Datos + espacio de prueba en la vista previa**, y
   meta de adopción + criterio de rúbrica.
3. **Juegos:** puntajes y partida guardada. **Apodo.**
4. **Avisos** (push) y envío desde el taller; luego avisos programados.
5. **Imágenes** y moderación ampliada.

Cada entrega pasa por staging y revisión antes de producción.

## 11. Decisiones pendientes

- Dominio para las apps publicadas (p. ej. `apps.edusyn.co`).
- ¿Publicación inmediata o con aprobación del docente por defecto?
- Límites finales por app (§6) según el plan del colegio.

## 12. Entrega 1 — cómo quedó construida

**Flujo.** Pestaña **Publicar** del estudio → «Pedir publicación (versión N)» → el docente ve en la
tarjeta del equipo «Aprobar y publicar» / «No aprobar todavía» (con comentario) y fecha opcional
de vencimiento → la app queda en `https://<crea-apps>/a/<token>/` con QR. El equipo puede pedir
publicar una versión nueva: la anterior sigue en línea hasta que el docente apruebe la nueva. El
docente puede **retirarla** y **volver a publicarla** con el mismo enlace.

**Piezas.**
- API: `ConstruyePublication` (copia de la versión aprobada + token), `ConstruyeAppDevice`,
  `ConstruyeAppDay` (migración `20260922010000_edusyn_crea_publicacion`, aditiva). Estas tres
  tablas **no llevan RLS a propósito**: el enlace público no tiene sesión; solo se leen por token
  (público) o filtrando `institutionId` (taller). Rutas del taller en `construye.controller.ts`;
  rutas públicas en `construye-public.controller.ts` (`GET public/crea-apps/:token`,
  `POST public/crea-apps/:token/events`, con límite de peticiones), declaradas como excepción
  `non-institutional` en el contrato de rutas.
- Servicio `apps/crea-apps` (Node sin dependencias): página con CSP propia (`connect-src 'self'`,
  sin recursos externos), `manifest.webmanifest`, `sw.js` (instalable y sin conexión), íconos PNG
  generados (inicial + color por app), proxy del uso anónimo hacia la API, caché de 20 s.
- SDK inyectado antes del código del equipo: `localStorage` separado por app, identificador
  anónimo del dispositivo, aperturas/tiempo visible/instalación, `?src=qr|link|team`, botón
  «Instalar» (Android) o guía «Compartir → Agregar a inicio» (iPhone).
- Web: `PublishPanel` (estudiante: petición, QR, enlace, instrucciones, tablero), `AppUsage`
  (tablero), `TeacherPublication` (docente), aviso de aprobaciones pendientes en el proyecto.

**Límite conocido.** Todas las apps comparten el origen de `crea-apps` (rutas `/a/<token>/`). El SDK
separa el `localStorage` de cada app, pero una app escrita con mala intención podría leer datos
locales de otra en el mismo teléfono. Mitigación futura: un subdominio por app con un dominio
propio y comodín (`*.apps.<dominio>`). Mientras tanto se aplica la regla de no guardar datos
personales y la aprobación del docente.

**Variables.** API: `CREA_APPS_ORIGIN` (p. ej. `https://crea-apps-production.up.railway.app`).
Servicio crea-apps: `EDUSYN_API_URL` (URL de la API con `/api`).
