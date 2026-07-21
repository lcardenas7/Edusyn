# 🎞️ MOTION BIBLE — El Taller (el movimiento como lenguaje)

> **Documento complementario (no modifica la Biblia v2.x).** En un producto tan centrado en la
> experiencia, el **movimiento es parte del lenguaje**, no un detalle estético. Define duraciones,
> curvas, física, transiciones, celebraciones y ritmo — con **tokens concretos** listos para
> implementar.
>
> **Gobierna:** [PRODUCT_BIBLE_EXPEDICION.md](PRODUCT_BIBLE_EXPEDICION.md) (v2.1). Pareja con
> [INTERACTION_BIBLE.md](INTERACTION_BIBLE.md). · Estado: borrador · 2026-07-18.

---

## 1. Principios
1. **El movimiento comunica**, no decora: dice que algo se guardó, se desbloqueó, llegó o se logró.
2. **Calma por defecto.** Sutil y breve; el exceso de animación hace que un producto se sienta
   “generado”. Menos, mejor.
3. **Un momento orquestado > muchos efectos sueltos.** Se reserva la expresividad para los hitos.
4. **Respeto absoluto a `prefers-reduced-motion`:** todo tiene fallback (aparición por opacidad o
   instantánea). Nada se entiende *solo* por su animación.
5. **Solo `transform` y `opacity`** (60 fps). Nada de animar `width/top/left`.
6. **El ritmo cambia con el Modo narrativo** (Exploración/Construcción/Presentación/Celebración/Reflexión).

## 2. Tokens de duración
| Token | ms | Uso |
|---|---|---|
| `--mo-instant` | 80 | feedback táctil, cambios de estado mínimos |
| `--mo-fast` | 150 | hover, selección, tooltips |
| `--mo-base` | 240 | entradas de objetos, paneles, la mayoría |
| `--mo-slow` | 400 | overlays, transiciones de vista |
| `--mo-celebrate` | 700 | sellos, hitos, celebraciones |

## 3. Tokens de easing (curvas)
| Token | cubic-bezier | Uso |
|---|---|---|
| `--ease-standard` | (.2,.8,.2,1) | movimiento general (entra rápido, asienta suave) |
| `--ease-decelerate` | (0,.7,.2,1) | algo que **entra** (aparece) |
| `--ease-accelerate` | (.4,0,1,1) | algo que **sale** (se va) |
| `--ease-spring` | (.2,1.4,.4,1) | rebote tangible (post-it, sello) |

## 4. Primitivas de movimiento
- **Fade** — opacidad; base de todo (y el fallback universal de reduced-motion).
- **Slide** — `translateY/X` pequeño (8–12px) + fade; para entradas de tarjetas/paneles.
- **Scale-in** — `scale(.96→1)` + fade; para overlays y modales (desde el centro).
- **Lift (hover)** — `translateY(-3px)` + sombra; señala “interactivo”.
- **Drop (física)** — el objeto “cae” con `--ease-spring` y micro-rotación; para crear un Post-it.
- **Pulse** — anillo que se expande y desvanece; presencia (“escribiendo”), voto.
- **Shimmer** — skeleton de carga, teñido con el color de la estación (no gris genérico).

## 5. Física tangible (el sello del Taller)
- **Post-it que cae:** al crearlo, entra con `scale-spring` + rotación leve (−2°…2°); al soltar drag,
  se asienta con un micro-rebote.
- **Voto con pulso:** el contador late (`--mo-fast`) y la nota más votada **flota** hacia arriba con
  reordenamiento animado (`--mo-base`, `--ease-standard`).
- **Drag:** el objeto sigue al puntero 1:1; al soltar en táctil, breve inercia.
- **Avatar que respira:** anillo `pulse` de 1.7s en quien escribe (Crew).

## 6. Transiciones por Superficie (modalidad)
| Superficie | Entra | Sale | Token |
|---|---|---|---|
| **Overlay (foco)** | scale-in desde centro + fade; fondo se atenúa | scale-out + fade | `--mo-slow` / `--ease-decelerate` |
| **Bottom Sheet** | slide-up desde abajo | slide-down / swipe | `--mo-base` |
| **Panel lateral** | slide desde el borde; empuja/convive | colapsa | `--mo-base` |
| **Modal rápido** | fade + scale-in pequeño | fade | `--mo-fast` |
| **Canvas completo** | crossfade con el anterior | crossfade | `--mo-slow` |
| **Cambio de vista** (Cuartel→Estación) | fade + slide-up 10px | — | `--mo-base` |

Regla espacial: nunca dos overlays; la superficie saliente termina antes de que entre la nueva.

## 7. Presencia (movimiento de colaboración)
- **“Escribiendo…”**: anillo `pulse` bajo el avatar.
- **Entrar/salir de sesión:** avatar aparece con `scale-in` (`--mo-fast`); sale con fade.
- **Aporte ajeno:** el objeto nuevo entra con `drop`, y su AuthorChip destella brevemente.
- **Cursores con nombre (N2):** siguen con leve *lerp* (suavizado), no a saltos.

## 8. Celebración y gamificación
- **Compuerta que se enciende:** al completar el último obligatorio, el dock pasa de gris a marigold
  con un **flash** (`--mo-base`) — invita a presentar.
- **Sello estampado (Hito):** `scale-spring` (de 0.4→1) + un halo breve; `--mo-celebrate`.
- **Chispas / confeti:** **sobrio y breve** (< 1s), pocas partículas; nunca invasivo.
- **Descubrimiento:** la tarjeta narrativa (“una causa raíz”) entra con `slide+fade` y un sutil brillo.
- **Desbloqueo de estación:** el candado se **abre** y el siguiente nodo del mapa **se ilumina** con un
  trazo animado en el conector.

## 9. Coreografía del Hito (momento orquestado)
Secuencia al aprobar la validación (respeta reduced-motion → versión estática):
1. La superficie de validación se cierra (`--mo-fast`).
2. **Sello se estampa** (`--mo-celebrate`, `--ease-spring`) + chispas breves.
3. Titular “¡[Estación] conquistada!” entra con `slide+fade`.
4. En el mapa, la estación actual → verde, el **conector se ilumina**, la siguiente **se abre**.
5. Al volver al Cuartel, el estado ya está actualizado (sin re-animar de golpe).

## 10. Ritmo por Modo narrativo
El movimiento **cambia de energía** según el Modo (mismo Taller, otra hora del día):
| Modo | Energía de movimiento |
|---|---|
| **Exploración** | suelto, ligero; entradas con más rebote |
| **Construcción** | preciso, sobrio; transiciones cortas y firmes |
| **Presentación** | escénico; el artefacto entra con protagonismo |
| **Celebración** | expresivo pero breve; física de rebote |
| **Reflexión** | lento y tenue; fades largos, sin rebote |

## 11. Prohibido / cuidado
- **Nada de animación en esperas críticas de datos** → usar **skeleton** (shimmer), no un spinner que
  bloquee ni un “salto” cuando llega el dato.
- Sin animaciones en bucle infinito llamativas (salvo el `pulse` sutil de presencia).
- Sin `will-change` permanente; solo durante la animación.

## 12. Reduced-motion (fallback obligatorio)
Con `prefers-reduced-motion: reduce`: todas las animaciones se reducen a **aparición por opacidad** o
**instantánea**; se elimina rebote, flotación y confeti; los estados finales son idénticos. La
información **nunca** depende del movimiento.

---

> **Fin de la Motion Bible.** Cierra el set de 4 Bibles complementarias (Event · Object Schema ·
> Interaction · Motion). Con esto, la Etapa 2 queda completa para pasar a implementación (Etapa 3).
