# Learning Engine — Operaciones (economía, escala, observabilidad, resiliencia)

> Documento 4 de 5. Cuando Edusyn crezca, esto será **tan importante como la pedagogía**. Define cómo el Learning
> Engine se mantiene **económicamente viable, escalable, observable, auditable y resiliente** a 500k estudiantes.
> Base: `EDUSYN_LEARNING_ENGINE.md` y `LEARNING_ENGINE_ARCHITECTURE.md`.
>
> **Versión 1.0 · Estado: fundacional (operaciones).** Se actualiza con datos reales de producción.

---

## 1. La ley económica del engine

> **Principio de oro:** separar **detección barata (siempre-on)** de **generación cara (bajo demanda)**. Si esto se
> mezcla, el COGS de IA supera el ingreso en colegios de bajo ARPU y la empresa muere de éxito.

| Operación | Costo | Cuándo corre |
|---|---|---|
| Actualizar Núcleo (Dominio/ADN/Timeline) | ~0 (cómputo) | En cada evidencia |
| Decidir próxima experiencia (reglas) | ~0 | En cada momento |
| Detectar señal (error, olvido, distracción) | ~0 (heurística) | Siempre-on |
| **Generar experiencia/ejercicios (LLM)** | **$$** | Bajo demanda, cacheable |
| **Valeria explica/proactiva (LLM)** | **$$** | Con presupuesto |
| Evaluar respuesta objetiva (MC/completar) | ~0 (local/server) | En cada respuesta |
| Evaluar abierto/proyecto (LLM/rúbrica) | **$$** | Bajo demanda |

**Reglas de contención de costo:**
1. **Reuso > generación.** Cada experiencia/texto/audio se genera **una vez** y se guarda en la **Biblioteca
   Institucional**; se reusa muchas (coste amortizado ≈ 0). Un Reading "My Family" A2 sirve a todo un grado.
2. **Tier free/premium por institución** (ya existe: `apd-ai` multi-key). Free (OpenRouter) para lo barato; premium
   (Gemini) para lo que exige calidad/latencia. El colegio que paga, obtiene premium.
3. **Speaking = el único caro por uso** (ASR + pronunciación por enunciado) → add-on premium con cuota.
4. **Presupuesto de Valeria** (§5): N intervenciones/sesión → cota dura al gasto por estudiante.

---

## 2. Escalabilidad (500k estudiantes / 10M+ interacciones)

- **El Núcleo es O(estudiantes × competencias activas)**, no O(interacciones). Estado compacto por estudiante;
  la Memoria (append-only) se archiva/particiona por periodo.
- **Evidencia idempotente** (ya implementado): reintentos y concurrencia no duplican ni corrompen.
- **Multi-tenant con RLS** (ya vigente): aislamiento por institución a nivel DB; el grafo canónico es compartido
  (una copia), los overlays y el estado son por institución.
- **Scheduler de repaso (Timeline)**: batch nocturno por institución que calcula `nextReviewDueAt`; no hay
  inferencia LLM en el batch (solo cómputo). Genera experiencias de repaso **bajo demanda** al abrirlas.
- **Colas para generación**: la generación LLM va por cola (no bloquea el request del docente/estudiante); estados
  "generando…" y notificación al terminar. Evita picos y timeouts.
- **Grafo canónico + overlays** (no un grafo por colegio desde cero) → gobernanza manejable a escala.

---

## 3. Latencia (la que ya nos duele)

Objetivos por operación:

| Operación | Objetivo | Estado hoy |
|---|---|---|
| Actualizar Núcleo / decidir momento | < 100 ms | ✅ (cómputo local) |
| Evaluar respuesta objetiva | < 100 ms | ✅ |
| Cargar experiencia **cacheada** | < 300 ms | ✅ (reuso) |
| **Generar experiencia (LLM premium)** | 3–8 s | ⚠️ hoy 45–70 s en **free** |
| Valeria explica (LLM) | 2–5 s | ⚠️ ídem free |

**Palancas de latencia:**
- **Caché primero, generar después** (la mayoría de aperturas son de la Biblioteca → rápidas).
- **Premium para lo interactivo** (el free se reserva para pre-generación en background, no para el momento en vivo).
- **Pre-generación asíncrona:** cuando el docente arma una ruta, las experiencias se generan en background (cola),
  no cuando el estudiante llega.
- **Cascada de modelos free saneada** (ya hecho): sin slugs muertos que quemen llamadas.

> Decisión pendiente del fundador (registrada): sin presupuesto premium hoy → se asume la latencia free; al conectar
> `GEMINI_API_KEY` de pago, la generación en vivo baja a segundos.

---

## 4. Observabilidad y métricas

**Métricas Norte (aprendizaje, no vanidad):**
- **Dominio ganado** por estudiante/periodo (Δ competencias demostradas) — no "lecciones completadas".
- **Retención real** (¿lo que se dominó, se sostiene en el repaso espaciado?).
- **Estudiantes en riesgo detectados a tiempo** (caída de dominio/racha antes de fracasar).
- **Docentes que avanzan en su viaje** (Visión 2030) — creación de experiencias, uso de adaptación.

**Métricas de producto:** tasa de aceptación de experiencias generadas por IA (señal de calidad real del Motor/Valeria);
% de experiencias abiertas desde caché vs generadas; intervenciones de Valeria por sesión; completitud de misiones.

**Observabilidad técnica:** por cada evento del lazo (§3 arquitectura) → traza con `studentId` (seudonimizado),
competencia, latencia, proveedor IA usado, tokens, costo estimado. **Panel de costo IA** (por institución, por día).
Alertas de: latencia p95, tasa de error de proveedor, presupuesto Valeria excedido, deriva del dominio.

---

## 5. Presupuesto de IA (Valeria y generación)

- **Presupuesto de intervención de Valeria por sesión** (ej. 3–5): protege el aprendizaje (no ayudar de más — SDT) y
  el costo. Al agotarse, Valeria solo interviene en errores críticos.
- **Cuota de generación por institución** (según plan): experiencias/mes; superada → modo manual o caché.
- **Medición y caché** ya implementados en `apd-ai` (multi-key, trazabilidad de tokens/proveedor).
- **Degradación por presupuesto:** sin cuota → el docente arma a mano y usa la Biblioteca; el estudiante nunca se
  queda sin experiencia (fallback de plantilla/caché).

---

## 6. Auditoría y explicabilidad

- **Toda decisión es citable:** el Motor y Valeria pueden mostrar de qué evidencia, rasgo del ADN y nodo del grafo
  nace una recomendación. Sin caja negra en educación.
- **Ledger de evidencia** (append-only, ya existe): trazabilidad forense de cómo se formó cada dominio.
- **Auditoría de IA:** log de cada generación (prompt-hash, proveedor, tokens, aceptación del docente) → mejora continua
  y control de calidad.
- **Datos de menores (Ley 1581 / Habeas Data):** propósito único (ayudar, no etiquetar), acceso de docente/familia,
  seudonimización en telemetría, retención y borrado reglados, RLS por institución. **El ADN nunca se expone como juicio.**

---

## 7. Resiliencia y degradación elegante

El lazo **nunca se rompe**; se **reduce**:

| Falla | Degradación |
|---|---|
| IA no disponible / sin key | Experiencia cae a **caché/plantilla**; el aprendizaje sigue (fallback ya implementado) |
| Proveedor free saturado (429) | **Cascada** de modelos; si todos fallan, caché/plantilla |
| Motor adaptativo indeciso | Cae a la **ruta que diseñó el docente** (recorrido base) |
| Evidencia falla al escribir | Idempotente + reintento; el flujo del estudiante no se bloquea (try/catch, ya implementado) |
| Valeria falla | Silencio (no interviene); nunca rompe el momento |
| Motor de voz (Speaking) caído | Cae a "graba + rúbrica del docente" |
| DB de un tenant degradada | Aislamiento RLS: no afecta a otros colegios |

**Principio:** la gamificación, la IA y la adaptación son **aditivas**; su ausencia degrada la experiencia, nunca la
rompe. El núcleo académico (evidencia, dominio, nota) siempre funciona.

---

## 8. Runbook de crecimiento (qué vigilar en cada fase)

- **Fase 1–2:** costo casi 0 (todo cacheable/reglas). Vigilar latencia de generación puntual.
- **Fase 3–4:** entra ADN + adaptación + Valeria proactiva → sube el uso de LLM. **Activar premium** y el panel de costo.
  Vigilar presupuesto de Valeria y tasa de aceptación.
- **Fase 5:** escala institucional → particionar Memoria, batch de Timeline, colas de generación, observabilidad completa.

> Regla: **medir el COGS de IA por estudiante activo desde el día 1.** Es la métrica que decide si el Learning Engine
> es un negocio o una fuga.
