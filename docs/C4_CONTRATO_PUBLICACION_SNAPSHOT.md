# C-4 — Congelar el contrato de publicación en el snapshot

**Implementada el 2026-08-16.** · **F2 sigue ABIERTA.** · **F0 sigue PARCIAL.** · **C-1 sin implementar.**

Sin cambios de esquema, sin migraciones, sin frontend, sin escrituras en producción.

---

## 1. El defecto

`buildGroupReportCards` produce tres campos que definen **qué dice y cómo se ve** el boletín:
`reportContent` (etiquetas y flags de publicación), `academicStructure` y `displayConfig`. Los
arma con consultas **vivas** de `AchievementConfig` y `ReportCardConfig`.

`finalizeTerm` y `reSnapshotTerm` los descartaban al congelar. Resultado: un período `FINALIZED`
servía el snapshot **sin** ellos, y el documento oficial cambiaba de aspecto respecto al aprobado
—etiquetas que revertían a «Aprendizaje/Evidencia», evidencias que aparecían aunque estuvieran
desactivadas, descriptor que desaparecía—.

## 2. Qué se cambió

| Archivo | Cambio |
|---|---|
| `reports.service.ts` → `finalizeTerm` | Congela los tres campos en el payload |
| `reports.service.ts` → `reSnapshotTerm` | Idéntico, mismo payload |
| `reports.service.ts` → `getReportCardYear` | Cada período conserva su contrato; el nivel superior toma el más reciente que lo tenga |
| `academic-data-source.service.ts` | La reconstrucción de grupo propaga `reportContent` |

**No se tocó** `buildGroupReportCards` (ya producía los tres campos) ni `RecoverySnapshotService`.

## 3. Criterios cumplidos

| # | Criterio | Prueba |
|---|---|---|
| 1 | `finalizeTerm` congela los tres | ✅ |
| 2 | `reSnapshotTerm` congela los mismos tres | ✅ + prueba de que ambos producen el mismo conjunto de claves |
| 3 | `RecoverySnapshotService` intacto | ✅ `git status` vacío en `modules/recovery` |
| 4 | Snapshots históricos no se reescriben | ✅ el cambio sólo afecta a escrituras nuevas |
| 5 | Degradado para snapshots sin los campos | ✅ se pasan tal cual; `undefined` sigue siendo `undefined`, sin valores por defecto |
| 6 | Los documentos `FINALIZED` consumen lo congelado | ✅ y se verifica que no se llama al generador en vivo |
| 7 | Multiperíodo preserva el valor de **cada** período | ✅ `periods[i]` lleva los tres campos |
| 8 | `buildGroupReportCards` sin cambios | ✅ diff vacío en el generador |

## 4. El criterio 7 en detalle

`getReportCardYear` tomaba los tres campos **del último período** y no devolvía `reportContent`
en absoluto. Si el último período era un snapshot histórico sin los campos, se perdían aunque los
períodos anteriores los tuvieran.

Ahora:
- **`periods[i]`** lleva `reportContent`, `academicStructure` y `displayConfig` **de ese período**.
- El **nivel superior** toma el **más reciente que tenga valor**, en lugar del último a ciegas.

No requirió ampliar el alcance: el contrato multiperíodo se resolvió de forma aditiva.

## 5. Pruebas convertidas de `[DEFECTO CONGELADO]` a `[CORREGIDO por C-4]`

Ocho pruebas de caracterización fallaron al implementar, **que es exactamente la señal esperada**.
Cada conversión queda registrada:

| Archivo | Prueba | Antes → después |
|---|---|---|
| `f0-baseline` | «el snapshot NO congela los tres» | → **congela los tres** |
| `c4-snapshot-baseline` | «el payload contiene EXACTAMENTE este conjunto de claves» | 18 → **21 claves** |
| `c4-snapshot-baseline` | «descarta los tres campos» | → **los congela** |
| `c4-snapshot-baseline` | «reSnapshotTerm pierde los tres» | → **los congela** |
| `c4-snapshot-baseline` | «la reconstrucción de grupo omite reportContent» | → **lo entrega** |
| `c4-read-routes` | «getReportCardYear NUNCA devuelve reportContent» | → **lo propaga** |
| `c4-read-routes` | «los tres salen SÓLO del último período» | → **cada período conserva el suyo** |
| `c4-read-routes` | «finalizeTerm NO escribe ninguno» (estática) | **retirada** — ver §6 |

## 6. Dos defectos encontrados **en las propias pruebas**

1. **Falso positivo.** La aserción estática «`reSnapshotTerm` NO escribe ninguno de los tres» no
   falló al implementar C-4 porque **su anclaje caía en el `update({ data: { status: 'OPEN' } })`
   temporal**, no en el payload del snapshot. Nunca inspeccionó lo que decía inspeccionar. Se
   retiró junto con su gemela de `finalizeTerm`: ambas están cubiertas de forma **conductual**.
2. **Error de tipos que las pruebas no detectan.** Con las pruebas en verde, `tsc` reportó 2
   errores: `Prisma.InputJsonValue` no admite `undefined`, y los tres campos provienen de tipos con
   propiedades opcionales. Resuelto casteando **sólo esos tres valores**, sin tocar el resto del
   payload. Recordatorio de que `jest` con `ts-jest` no sustituye al typecheck.

## 7. Qué NO se tocó

`validateTermGrades` · `closeTerm` · C-1 · C-2 · D-12 · cuantitativo · F4/R-2/A-2 ·
`RecoverySnapshotService` · las 12 huérfanas · `buildGroupReportCards` · el esquema · el frontend.

**Expresamente no se unificaron los tres escritores**, pese a que siguen teniendo dos formas de
payload distintas. Queda para F3.

## 8. Consecuencias operativas

- **Sólo afecta a snapshots nuevos.** Los 2 000 existentes no cambian y siguen degradando.
- **El JSON de cada snapshot crece** con los tres campos. Conviene medirlo antes de una
  finalización masiva.
- **El degradado debe conservarse indefinidamente**: un refactor futuro que lo elimine rompería
  los boletines históricos.
- El desfase de asimetría con `RecoverySnapshotService` **persiste**: un período que pasó por
  recuperación sigue teniendo un payload distinto.

## 9. Pruebas

C-4 nuevas **10/10** · módulo `reports` **87/87** (7 suites) · C-2 **11/11** · F1 **14/14** ·
D-12 **31/31** · suite completa **249 pasan / 1 falla** (`institution-config`, previa y ajena) ·
typecheck backend y frontend **0 / 0**.

## 10. Estado

| | |
|---|---|
| **C-4** | ✅ Implementada |
| **C-2** | ✅ Implementada |
| **C-1** | ❌ Sin implementar |
| **F0** | 🟡 Parcial |
| **F2** | 🟡 **ABIERTA** |

> **Actualizado el 2026-08-17.** La tabla de arriba refleja el estado en la fecha de C-4 y se
> conserva como registro. Estado actual: **C-1 ✅ · C-2 ✅ · C-4 ✅ · D-12 ✅ · F0 🟡 parcial ·
> F2 🟡 abierta**. La FK de `StudentEvidenceValuation → AchievementEvidence` está aplicada con
> `RESTRICT` y quedan **0 huérfanas** (`docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md`).
> **C-1, C-2 y C-4 NO están desplegadas a producción.**
