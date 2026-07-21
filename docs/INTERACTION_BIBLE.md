# 🖐️ INTERACTION BIBLE — El Taller (comportamiento de las interacciones)

> **Documento complementario (no modifica la Biblia v2.x).** Define **cómo se comporta** cada
> interacción — no la UI. Un mismo conjunto de reglas de comportamiento vale para **todos los Motores
> e Instrumentos**, para que se sientan como un solo producto.
>
> **Gobierna:** [PRODUCT_BIBLE_EXPEDICION.md](PRODUCT_BIBLE_EXPEDICION.md) (v2.1). Pareja con
> [MOTION_BIBLE.md](MOTION_BIBLE.md) (el *cómo se ve* el movimiento). · Estado: borrador · 2026-07-18.

---

## 1. Principios de interacción
1. **Comportamiento consistente entre Motores.** Arrastrar, seleccionar, comentar se sienten igual en
   Board, Graph, Cards… El Motor cambia el *qué*, no el *cómo* se manipula.
2. **Paridad de entrada:** todo se puede hacer con **puntero, táctil y teclado**. Ninguna acción
   depende exclusivamente del ratón.
3. **Perdona siempre:** toda acción es **deshacer-able** (undo) y el trabajo se autosalva. "El Taller
   nunca pierde información" (Principio 2).
4. **Optimista pero atómico:** la UI responde al instante (optimistic), y el guardado es **atómico**
   para no perder aportes concurrentes (anti lost-update, ya implementado).
5. **Feedback inmediato:** toda interacción responde en < 100 ms (aunque el guardado siga en curso).
   El *cómo* de ese feedback lo define la Motion Bible.
6. **Nunca dos focos** (Principio espacial): una interacción de foco a la vez.

## 2. Primitivas de interacción (valen para todo instrumento)

| Primitiva | Puntero | Táctil | Teclado |
|---|---|---|---|
| **Seleccionar** | clic | tap | Tab / flechas para mover foco; Enter selecciona |
| **Seleccionar múltiple** | shift-clic / rubber-band | tap + “seleccionar varios” | Shift+flechas |
| **Crear objeto** | doble-clic en Canvas / botón + | botón + / long-press vacío | tecla `N` |
| **Editar contenido** | doble-clic en el objeto | tap para abrir edición | Enter para editar, Esc para salir |
| **Mover (drag)** | arrastrar | arrastrar con inercia | flechas (paso fino con Shift) |
| **Redimensionar** | tirar de un handle | handle táctil (≥44px) | Shift+flechas sobre handle |
| **Conectar (relación)** | arrastrar desde el borde a otro nodo | arrastrar desde el conector | menú “conectar con…” |
| **Votar / reaccionar** | clic en la píldora de voto | tap | tecla `V` sobre el objeto |
| **Comentar** | botón comentar → hilo | tap | tecla `C` |
| **Eliminar** | botón / tecla | swipe o botón | Supr / Backspace (con confirmación suave) |
| **Reordenar** | drag; los votados suben solos | drag | mover foco + Shift+flechas |

## 3. Navegación del Canvas
- **Pan:** espacio + arrastre (puntero) · arrastre con dos dedos (táctil) · flechas cuando no hay
  selección.
- **Zoom:** rueda + ⌘ · pinch (táctil) · `⌘ +/−`, `⌘0` = ajustar. Límites de zoom sensatos.
- **Fit / centrar:** botón “ajustar a contenido”. **Mini Mapa** para saltar.
- El Canvas **nunca está vacío** (Regla del Canvas): sin contenido, muestra un *hint fantasma* con la
  acción sugerida.

## 4. Teclado (atajos)
**Globales:** `⌘K` Command Bar · `Esc` cerrar la superficie de foco (Principio: todo cierra con Esc) ·
`⌘↵` presentar a validación (si la compuerta está encendida) · `?` ayuda de atajos.
**En Canvas:** `N` nueva idea/objeto · `V` votar el seleccionado · `C` comentar · `Supr` eliminar ·
`⌘Z` deshacer · `⌘⇧Z` rehacer · `⌘C`/`⌘V` copiar/pegar · `⌘A` seleccionar todo · flechas mover foco.
**Foco:** orden de tabulación lógico; **foco visible siempre**; `Esc` devuelve el foco al origen
(ruta de retorno).

## 5. Undo / Redo
- **Pila por usuario** (undo colaborativo): `⌘Z` deshace **mi** última acción, no la de un compañero.
- **Undo-able:** crear/editar/mover/eliminar/votar/conectar. Acciones de sistema (validación, hitos)
  **no** se deshacen con `⌘Z` (tienen su propio flujo: devolver, re-presentar).
- Interacción con lo atómico: el undo emite un evento nuevo (`object.Updated/Deleted`…), no reescribe
  el historial (coherente con la Event Bible: append-only).

## 6. Autosave
- **Silencioso y con debounce** (~600 ms tras dejar de escribir) + al perder foco (blur).
- **Atómico** (ya implementado): dos integrantes editando a la vez no se pisan.
- Feedback mínimo: micro-texto “Guardado ✓” que aparece y se desvanece; **nunca un spinner** que
  asuste. Ver Motion Bible §autosave.
- **Offline:** los cambios se encolan localmente y se sincronizan al reconectar (banner “reintentando”,
  sin bloquear el trabajo).

## 7. Copiar / Pegar y flujo entre instrumentos
- **Dentro de un instrumento:** `⌘C`/`⌘V` duplica objetos (nueva identidad).
- **Entre instrumentos (flujo de conocimiento):** la acción **“Enviar a → [instrumento]”** **no copia**:
  crea una **relación** y **referencia** el mismo Objeto (idea ganadora → tarea del Kanban) — coherente
  con “nunca hacer trabajar dos veces”. Pegar desde fuera (texto plano) crea objetos nuevos.

## 8. Selección múltiple y acciones en lote
- **Rubber-band** (arrastre sobre vacío) o shift-clic. En táctil, modo “seleccionar varios”.
- Acciones en lote: **agrupar** (crea afinidad), **enviar a →**, **eliminar**, **etiquetar**. El voto
  es individual por objeto (no en lote).

## 9. Táctil (dispositivo del aula)
- Objetivos de toque **≥ 44 px**. Arrastre con **inercia**. **Long-press** = menú contextual.
- **Pinch-zoom** en Canvas. En móvil, los lienzos complejos pasan a **modo lectura + edición guiada por
  pasos** (no board libre) — ver Biblia §responsive.

## 10. Colaboración durante la interacción
- **Optimista + atómico:** mi cambio aparece ya; el servidor confirma sin pisar a otros.
- **Presencia:** al tocar un objeto, los demás ven quién lo edita (in vivo, N2) o su autoría (N1).
- **Conflicto:** por objeto/campo, **último-en-confirmar** gana a nivel de campo (no de blob); las
  listas (ideas, tareas) hacen **append** sin perder elementos. Ver Bible §Capa 1 (ya implementada).

## 11. Accesibilidad (no negociable)
- **Paridad de teclado** para toda acción (ver §4). **Foco visible** siempre.
- Roles/labels ARIA en objetos y controles; anuncios para lectores de pantalla en eventos clave
  (“idea añadida por Mateo”, “compuerta lista”).
- **`prefers-reduced-motion`:** todas las animaciones tienen fallback (ver Motion Bible); ninguna
  interacción depende de una animación para entenderse.
- Contraste y tamaños heredados del Design System (Biblia §21).

## 12. Reglas de oro
- Toda interacción: **inmediata, reversible, accesible y atómica.**
- Si una interacción necesita explicación escrita para entenderse, está mal diseñada.
- Ninguna acción crítica requiere que otro esté conectado (asíncrono-primero).

---

> **Fin de la Interaction Bible.** Comportamiento único para todos los Motores. Se implementa en Etapa
> 3 junto con la Motion Bible.
