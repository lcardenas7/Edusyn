# Edusyn Construye — estado del circuito Código ⇄ Preview (Pasos 2 → 5.3)

Documento de traspaso. Está escrito para que alguien que no participó en la construcción
—incluida otra IA— entienda qué existe, por qué está hecho así y qué NO se puede hacer sin
romperlo. Complementa a `EDUSYN_CONSTRUYE_OPERACION_SEGURA.md` (reglas de despliegue) y a
`EDUSYN_CONSTRUYE_F0_AMENAZAS.md` (aislamiento del preview).

**Estado a la fecha de este documento:** Pasos 2, 3, 4.0, 4.1, 4.2, 4.3, 4.4, 5.0, 5.1, 5.2 y
5.3 cerrados y protegidos como baseline. Todo vive solo en el espacio local: **no se ha hecho
push, merge ni despliegue** de este trabajo.

---

## 1. Qué es esto

Construye es un editor de código HTML/CSS/JS para estudiantes dentro del Aula Virtual. Lo que
se construyó en estos pasos no es "un editor con más botones", sino un **circuito pedagógico**
que conecta lo que el estudiante ve con el código que lo produce:

```
VER → LOCALIZAR → RELACIONAR → COMPRENDER → MODIFICAR
```

El proyecto del estudiante se ejecuta en un iframe aislado (`apps/construye-preview`, el
*runner*), servido desde otro origen, con `sandbox="allow-scripts"` y **sin**
`allow-same-origin`. El host (`apps/web`) nunca toca el DOM del preview: se comunican por
`postMessage` con un protocolo validado en los dos extremos.

---

## 2. Las reglas que gobiernan todo el diseño

Estas no son preferencias de estilo. Son las decisiones que hacen que el producto sea honesto
con un estudiante que está aprendiendo. Romper cualquiera invalida el trabajo anterior.

1. **Nunca inventar una correspondencia.** Si Construye no puede demostrar que este elemento
   corresponde a este código, responde "no determinable". Nunca adivina por parecido de texto
   ni por el ancestro más cercano.
2. **El código es la fuente de verdad.** Toda modificación cambia el archivo real del
   estudiante. No hay estilos inline, variables ocultas, overlays ni estado visual paralelo.
3. **Nunca buscar por texto.** Toda operación usa rangos exactos (offsets) que vienen del
   parser (parse5 para HTML, css-tree para CSS). Dos botones que digan "Comprar" tienen rangos
   distintos; editar uno jamás toca el otro.
4. **No afirmar el resultado visual final.** Construye no resuelve cascada, especificidad ni
   herencia. Dice "esta propiedad cambia el color de fondo", nunca "esta tarjeta es azul".
5. **Respetar el modelo draft/applied.** Editar produce un borrador; el preview solo cambia
   cuando el estudiante pulsa "Aplicar al preview". Nunca se puentea esa puerta.
6. **Ante la duda, no ofrecer.** Es preferible que una función no aparezca a que haga algo que
   el estudiante no esperaba. Toda la lista de "casos no soportados" de este documento es
   intencional.

### Regla Cero (restricciones de trabajo)

Sin backend, Prisma, migraciones, producción, deploy, push, merge, `allow-same-origin` ni
relajación de CSP/sandbox. **Sin IA conectada** (ver §8).

---

## 3. Arquitectura en dos capas

| | RUNNER (`apps/construye-preview`) | HOST (`apps/web/src/features/construye`) |
|---|---|---|
| Rol | Autoridad sobre DOM, CSSOM, `matchMedia` y relaciones reales | Estado de interacción, lenguaje, UI y escritura de archivos |
| Puede | Parsear, resolver selectores, medir, resaltar | Componer frases, construir planes, escribir en los archivos |
| No puede | Escribir en los archivos del estudiante | Tocar el DOM/CSSOM del iframe |

El runner **solo reporta hechos demostrables**. El host **solo compone y escribe**. Esa
frontera es lo que permite que el preview siga aislado.

---

## 4. Qué hace cada paso

| Paso | Qué añadió |
|---|---|
| **2** | Preview → HTML. Clic en el preview señala el código exacto (parse5 + `data-edusyn-id`). |
| **3** | HTML → Preview. El cursor en el código resalta el elemento; "¿Qué es esto?" explica la etiqueta. |
| **4.0** | Viewports Computador (1280×800) y Celular (390×844) con `transform: scale`. **Sin recargar**: mismo iframe, mismo documento, mismo JS. |
| **4.1** | CSS → Preview. El cursor en una regla resalta los elementos que coinciden y dice si su `@media` está activa. |
| **4.2** | Preview → CSS. Clic en un elemento lista sus reglas relacionadas (`element.matches`), sin elegir "la ganadora". |
| **4.3** | Comprensión pedagógica del CSS: explica qué hace la declaración bajo el cursor, en lenguaje de estudiante, sin IA. |
| **4.4** | Contexto reactivo al viewport: al alternar Computador/Celular, la ficha se recalcula sola. |
| **5.0** | Edición visual de CSS: cambiar `background-color`, `color`, `font-size`, `border-radius` desde la ficha. |
| **5.1** | Edición segura de texto HTML: cambiar el contenido visible de un elemento con texto simple. |
| **5.2** | "Ayúdame a modificarlo": intención → plan → confirmación → ejecución transaccional. |
| **5.3** | Inserción de una declaración CSS certificada dentro de una regla existente. |

---

## 5. Mapa de archivos

### Runner (`apps/construye-preview/src/`)
- `bridge.ts` — validación de todo mensaje entrante del host.
- `instrument.ts` — parse5: marca elementos con rango fuente y detecta el **texto simple editable** (5.1).
- `explore.ts` — modo Explorar: hover, clic, resaltado, y `reevaluateSelection()` (4.4).
- `styles.ts` — css-tree: rangos de reglas/declaraciones/valores/bloques, puente AST⇄CSSOM, reglas relacionadas.
- `main.ts` — orquestación y listeners (`message`, `resize`, `ResizeObserver`).

### Host (`apps/web/src/features/construye/`)
- `protocol.ts` — contrato y validación de todos los mensajes.
- `explanations.ts` / `cssProperties.ts` — diccionarios pedagógicos (sin IA).
- `sourceEdits.ts` — **única puerta de escritura**: `replaceExactRange`.
- `cssEdits.ts` / `htmlEdits.ts` / `cssInsert.ts` — gramáticas seguras de valor, escape y formato.
- `capabilities.ts` / `intent.ts` / `plan.ts` — capas del Paso 5.2/5.3.
- `PreviewFrame.tsx` — iframe, fichas y controles.
- `CodeWorkspace.tsx` — dueño de los archivos; el único que escribe.

---

## 6. Los cuatro mecanismos que hay que entender

### 6.1 Rangos exactos
Todo se apoya en offsets del parser: rango del elemento, del nodo de texto, de la regla, de la
declaración, del **valor** y del bloque `{...}`. Se conservan byte a byte: `12PX` no se
normaliza a `12px`.

### 6.2 La única puerta de escritura
`replaceExactRange(content, range, expected, replacement)` sustituye **solo** ese rango y solo
si el texto que hay ahí sigue siendo exactamente el esperado. Si no coincide, **no escribe y no
busca el valor en otra parte**. Una inserción es un rango de longitud cero — misma puerta, cero
maquinaria nueva.

### 6.3 Capacidades con IDs opacos (5.2/5.3)
Antes de interpretar nada, el host calcula **qué se puede modificar de verdad** en el elemento
seleccionado y lo expone con IDs opacos (`text-1`, `css-1`, `css-add-3`). El manifiesto **no
contiene archivos, offsets ni selectores**; la tabla que traduce ID → rango es privada. Una
intención elige un ID; jamás una posición del archivo.

### 6.4 Plan transaccional
Nada se ejecuta al interpretar. Se construye un plan que el estudiante lee (qué cambia, de qué
a qué, a cuántos elementos afecta, qué no se pudo hacer), y solo al confirmar se revalida todo
contra los archivos de ese instante. **O se aplican todas las operaciones o ninguna**, aunque
toquen `index.html` y `styles.css` a la vez.

---

## 7. Qué NO hace (y es intencional)

- No resuelve cascada ni especificidad. Si una propiedad aparece en varias reglas relacionadas,
  **no se ofrece** — elegir sería afirmar cuál gana.
- No edita valores complejos: `var()`, `calc()`, `clamp()`, `rgb()`/`hsl()`, gradientes,
  shorthands de varios valores (`10px 20px`) ni colores con nombre (`white`).
- No edita texto con estructura: `<p>Hola <strong>Luis</strong></p>` no es editable (el
  `<strong>` interior sí lo es). Tampoco texto con espacio alrededor (`<h1>\n  Título\n</h1>`),
  para no reformatear la indentación.
- No edita atributos, imágenes ni JavaScript. No añade ni elimina elementos.
- No crea reglas, selectores, `@media` ni hojas de estilo. 5.3 solo inserta **dentro de una
  regla existente e inequívoca**.
- No inserta `font-size` cuando no existe: exigiría conocer el tamaño heredado (computed style),
  que está fuera de alcance.
- No inserta en reglas con comentarios: la inserción cambiaría a qué declaración parece
  referirse el comentario.

---

## 8. Sobre la IA

**No hay IA conectada en Construye.** Es una decisión de diseño, no una tarea pendiente de
cablear. La arquitectura se construyó precisamente para que una IA futura sea **una pieza
intercambiable y sin permiso de escritura**:

> **La IA puede proponer. La IA no puede escribir.**

Cuando se conecte, sustituirá **una sola función**:

```ts
interpretIntent(request: string, manifest: CapabilityManifest) => ModificationIntent
```

- **Entrada:** la petición del estudiante y el manifiesto **sanitizado** (tipo de elemento,
  capacidades, valores actuales, elementos afectados). Nunca los archivos del proyecto.
- **Salida:** JSON conforme a un esquema cerrado con tres operaciones (`SET_TEXT`,
  `SET_CSS_VALUE`, `INSERT_CSS_DECLARATION`), cada una apuntando a un **ID opaco**. Nunca
  código, diffs, HTML, CSS, offsets ni comandos.

Todo lo demás (capacidades, plan, revalidación, atomicidad, escape, ejecución) ya está probado
de forma independiente, así que una respuesta inválida o malintencionada del modelo solo puede
terminar en operaciones rechazadas.

**Lo que ya existe en el repo** (fuera de Construye): `apps/api/src/modules/apd/ai/` tiene un
servicio multi-proveedor (OpenRouter, Gemini, Groq, XAI) y un orquestador con planes
FREE/PREMIUM/BYOK, cuota de tokens, caché y degradación. Es el candidato natural para alojar el
intérprete el día que se autorice, con dos ajustes: vive en el backend (hoy prohibido por Regla
Cero para este módulo) y hace `JSON.parse` sin validación de esquema, que el contrato de
Construye sí exige.

**Agentes de codificación (tipo OpenCode):** no encajan aquí. Son agentes que editan archivos y
ejecutan comandos, justo el modelo que este diseño descarta. Tienen sentido como herramienta de
desarrollo del equipo, no dentro del producto del estudiante.

---

## 9. Verificación

- **Pruebas unitarias:** 117 en `apps/construye-preview` (4 archivos) y 398 en `apps/web`
  (26 archivos). `tsc --noEmit` limpio en `apps/web`.
- **Bundle del runner:** `vite build` + verificación de integridad (sin corrupción CDO/CDC, JS
  válido). Hay dos bugs históricos de inlining de esbuild ya corregidos en `vite.config.ts`; por
  eso el bundle se revisa en cada paso.
- **Navegador real:** cada paso se verificó en Chrome con el proyecto de prueba de su gate.

### Cómo probar a mano
El editor está en `CodeWorkspace`. Para probarlo aislado se sustituye temporalmente
`apps/web/src/main.tsx` por un bootstrap que renderice `<CodeWorkspace />` y un `<Toaster />`,
y se revierte después con `git checkout -- apps/web/src/main.tsx`. Hacen falta los dos
servidores: `web-local` (5173) y `construye-preview` (5174).

**Aviso para automatización:** los clics dentro del iframe del preview son poco fiables desde
herramientas automatizadas (Chrome aísla ese iframe en otro proceso). La alternativa usada fue
inyectar el mensaje real del runner con `dispatchEvent(new MessageEvent(...))` y `source =
iframe.contentWindow`, que ejerce exactamente el mismo camino del host.

---

## 10. Deudas registradas

1. **Undo (la principal).** `Ctrl+Z` no revierte de forma fiable las ediciones visuales. Causa
   verificada: el `<textarea>` es un componente controlado de React, y Chrome descarta la
   entrada de deshacer cuando el componente se re-renderiza y se reposiciona la selección justo
   después. Se probaron cuatro variantes y ninguna lo resuelve sin un retardo arbitrario.
   **Decisión explícita: documentarlo, no construir un historial paralelo.** Se resolverá al
   migrar a un editor con API transaccional (CodeMirror/Monaco).
2. **Normalización de whitespace en 5.1.** El texto nuevo se recorta y colapsa espacios.
   Registrado para revisión futura; no ampliar ahora.
3. **Texto indentado no editable** (`<h1>\n  Título\n</h1>`): el límite más probable de
   encontrar en uso real y primer candidato a ampliar.
4. **UI manual de "Agregar propiedad"** (punto 24 del gate 5.3): no implementada. Hoy la
   inserción se alcanza por "Ayúdame a modificarlo".
5. `apps/construye-preview` no tiene `tsconfig` propio; se verifica con `vite build`. Deuda de
   tooling preexistente, deliberadamente no mezclada con estos pasos.

---

## 11. Cómo se ha trabajado (y cómo conviene seguir)

Cada paso siguió el mismo ciclo, y conviene mantenerlo:

1. Autorización explícita del alcance, con lista de lo que **no** se debe implementar.
2. Análisis antes de escribir código cuando hay una decisión de arquitectura de por medio.
3. Implementación mínima, sin adelantar capacidades futuras.
4. Pruebas unitarias exhaustivas, incluidos los casos que **deben** fallar.
5. Verificación en navegador real.
6. Regresión completa de todos los pasos anteriores.
7. Informe de cierre con veredicto y **limitaciones declaradas sin maquillar**.

Cuando una prueba de un paso anterior cambia de expectativa porque el nuevo paso cambió el
comportamiento a propósito, se dice explícitamente en el informe. Ese registro es lo que hace
que el baseline sea confiable.
