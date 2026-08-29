# Edusyn — instrucciones de proyecto

## Despliegues (leer y actualizar siempre)

Existe una bitácora compartida: **[docs/REGISTRO_DESPLIEGUES.md](docs/REGISTRO_DESPLIEGUES.md)**.

- **Antes de desplegar:** lee su tabla de historial para saber qué ya se envió y si algo llevó migración. No reinvestigues la mecánica de Railway cada sesión: está documentada ahí.
- **Después de cada `push` a `staging` o `main`:** añade una fila a la tabla (más reciente arriba) y, si el cambio es relevante, una nota corta. Mantenlo append-only.
- Ramas: **`staging`** despliega staging, **`main`** despliega producción. Railway corre `prisma migrate deploy` en el arranque (deploy OK = migración aplicada).
- No despliegues WIP sin confirmar que no sea tuyo sin avisar al usuario. Antes de `main`, `tsc --noEmit` en `apps/api` y `apps/web`.

## Convenciones

- **Diálogos/avisos web:** usa `confirmDialog`/`alertDialog` (`components/ui/confirm`) + `toast` (`lib/toast`), nunca `confirm()`/`alert()` nativos (no se ven en móvil/embebido).
- **Fechas Colombia (UTC-5):** usa los helpers de `lib/datetime` (web) / `common/utils` (api); no dependas de la zona del dispositivo.
- **Aula Virtual:** un "quiz" es una `ClassroomActivity` (QUIZ/EXAM/HOME_QUIZ/ICFES) con preguntas en `ActivityQuestion`. El juez de respuestas vive en `common/utils/answer-matching.util.ts` (espejo de `web/grading.ts`).
