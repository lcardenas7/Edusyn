# @edusyn/types — Contratos backend/frontend de Edusyn

Formaliza en TypeScript el contrato que la Constitución
(`docs/EDUSYN_PRODUCT_ARCHITECTURE.md`) exige **antes de construir** (C5, AR11).
Este paquete es la fuente única de las formas compartidas; ni el backend ni el
frontend definen sus propias variantes (AR3).

**Paquete type-only.** No emite runtime ni valores. Importar siempre con
`import type { ... } from '@edusyn/types'`. Así funciona idéntico en
`apps/web` (Vite/bundler) y `apps/api` (NestJS/nodenext) sin build intermedio
ni aliases.

> ⚠️ **Regla dura (enforced).** El `exports` apunta a la fuente `.ts`. Esto
> funciona **solo** mientras todo import se borre al compilar. Un único valor
> runtime (un `const`, un `enum`, un helper) rompería el build de `apps/api`
> (nodenext → JS): node no carga `.ts` desde `node_modules`. Por eso, en este
> paquete **solo se permiten `type` e `interface`**; para conjuntos cerrados se
> usan **uniones de string-literal, nunca `enum`** (un `enum` emite runtime).
> Un check de CI/lint rechaza cualquier declaración de valor. Si necesitas
> lógica compartida (mapeos, constantes, validadores), va en otro paquete
> **no** type-only, jamás aquí.

## Qué contiene

| Módulo | Tipos | Constitución |
|---|---|---|
| `common.ts` | `Severity`, `Issue`, `Action` | C4, AR13, UX2, E2, UX5 |
| `canonical-state.ts` | `CanonicalState`, `OnboardingState`, `CanonicalStep`, `StepStatus` | §5, AR10, E1–E4 |
| `importer.ts` | `ImportAnalysis`, `ImportState`, `ApplyResult` | §7 I1–I8, C3, AR4/AR5 |

## Decisiones del contrato (cerradas el 2026-08-01)

1. **Keys en inglés camelCase; valores mostrables en español, ya localizados
   por el backend.** Nada de keys con tildes. El frontend nunca traduce
   códigos a texto: muestra `message`/`label` tal cual. `code`/`type`/`key`
   son identificadores estables para tests, telemetría y documentación.
2. **Una sola severidad para todo el sistema:** `Severity = 'blocking' |
   'warning' | 'info'`, equivalente a P0/P1/P2 (§7 I2). La misma en el Estado
   Canónico (§5.3), en la validación de importadores y en el cuadre final.
3. **`actions[]` viaja con metadatos presentables completos** (`label`,
   `variant`, `enabled`, `reason`, `requiresConfirmation`, `intent`) para que
   el cliente renderice botones sin decidir texto, estilo ni elegibilidad
   (E2, AR2).
4. **Versionado explícito:** todo objeto de contrato raíz lleva
   `contractVersion` (C6). Cambios incompatibles = nueva versión comunicada;
   nunca ruptura silenciosa.
5. **El progreso DURANTE una operación larga viaja en `ImportState`**
   (`phase`, `progress`, `operationId`). El cliente hace polling de ese
   estado; nunca simula progreso con timers (UX4, AR2).
6. **El frontend nunca calcula:** `status`, `blockedBy`, `progress`,
   `recommendedNext`, `enabled`, `canApply` llegan decididos (E1/E2). Si la
   UI necesita un dato que el contrato no tiene, se pide el endpoint/campo —
   no se deduce (restricción fundamental del proyecto).

## Enmienda 2026-08-01 — cierre de contrato antes de `packages/ui`

Revisión de arquitectura sobre v0.1. Resuelve tres ambigüedades **antes** de que
exista una sola línea de UI (C5). Estas decisiones son parte del contrato firmado:

7. **Barrera type-only enforced** (ver el aviso ⚠️ arriba). Solo `type`/`interface`;
   uniones de string-literal, no `enum`; cero valores runtime; check de CI/lint.
   Es la deuda de mayor riesgo del paquete y queda cerrada por regla, no por
   disciplina.
8. **`ActionIntent.submit` es SOLO para acciones sin payload del usuario**
   (`continue`, `retry`, `activate`, navegación…): el cliente ejecuta el `intent`
   tal cual, sin aportar datos. Toda acción que lleve **datos aportados por el
   usuario** (archivo, formulario con body) **no** se modela como `Action`
   genérica: la gobierna su componente, que conoce el payload y llama al endpoint
   que expone el paso. Motivo: un `apply` de importación necesita `file` +
   `academicYearId`; una `Action` no puede ser auto-describible ahí sin filtrar
   conocimiento de módulo al cliente. Mantener `Action` honesta = mantener AR2.
9. **La subida de archivo (multipart) se modela como `kind: 'upload'`, no como
   `submit`.** `analyze` de los importadores es `FormData` con campo `file`;
   ese flujo no cabe en un intent REST-JSON (revisión, punto #3). Entre las dos
   opciones planteadas por el arquitecto, se adopta **el tercer kind explícito
   desde v0.1** (no se difiere), porque la alternativa dejaba sin contrato de
   dónde obtiene `FileDropUpload` el endpoint — conocimiento de módulo que
   arañaría AR2. Reglas: el componente de upload envía el campo estándar
   `file`; el archivo lo aporta el usuario, nunca el módulo (la Action sigue
   sin payload de dominio); el endpoint devuelve el
   `ImportState.operationId` que habilita el seguimiento en vivo (decisión 5).
   El `apply` posterior opera sobre esa operación ya analizada y **sí** es un
   `submit` sin payload (punto 8).

**Decisiones conscientes (no cambian el shape, pero quedan registradas):**
- Los valores mostrables viajan **localizados en español** desde el backend. Es
  correcto hoy (producto Colombia), pero **compromete al backend a i18n
  server-side (Accept-Language)** si el producto crece al inglés (iniciativa
  bilingüe). La vía de escape ya existe: `code`/`type`/`key` son estables y
  permiten re-localizar en el cliente. **Mantenerlos sagrados.**
- `progress: number` es el avance ponderado. Para la UX de lotes masivos se
  agregó **en v0.1** (nadie consumía aún el tipo) `ImportState.progressDetail?:
  { processed, total }` — el contador estructurado "1.200/1.500" lo calcula el
  backend y el cliente lo muestra tal cual, sin derivarlo de `progress`. Si el
  total no es conocible, el campo se omite y la UI cae al porcentaje.

## Consumo

```ts
import type { OnboardingState, ImportAnalysis, ApplyResult, Issue } from '@edusyn/types';
```

Ambas apps declaran `"@edusyn/types": "*"` en sus dependencias (npm
workspaces resuelve el symlink local).

## Verificación

```bash
npm --workspace packages/types run typecheck
```
