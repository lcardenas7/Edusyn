# Abigail — promoción cualitativa, 7 de noviembre de 2026

## Evidencia observada en staging

Rector QA inició sesión. Cierre y promoción del año mostró 2026 activo, 144 matrículas y 68 asignaciones. La previsualización calculó 143 matrículas activas y dejó pendientes los 12 estudiantes de Transición A/B. No se intentó forzar el cierre ni se registraron decisiones ficticias.

## Cambio preparado

- Configuración SIEE centraliza una política versionada por año y grado DIMENSIONS: valorar propósitos o evidencias, exigir informe final y confirmar administrativamente o continuar al completar requisitos. Guardar política no aprueba estudiantes.
- La evaluación anual usa el plan efectivo por grupo/año y las obligaciones compartidas con reportes. Sin política, plan, dimensiones u obligaciones, permanece pendiente. No convierte valoraciones en notas numéricas.
- Desde cada caso cualitativo pendiente se abre la revisión individual con cobertura por período/dimensión, informe y motivo. La decisión conserva actor de sesión, fecha, matrícula, institución, año, revisión y huella de valoraciones. Cambios en política o valoraciones invalidan la confirmación anterior.
- Se rechazan matrículas inactivas, grados numéricos y cambios de política entre evaluación y escritura. La interfaz exige actualizar la previsualización tras guardar decisiones y deshabilita cierre cuando aún hay pendientes.
- El catálogo de Transición muestra carga o error antes de afirmar que no existen dimensiones.

## Validación

- 85 pruebas focales de motor, política, confirmación, cobertura, evaluación anual y regresión de reportes/cierre de períodos.
- Seis pruebas HTTP con guard de roles y resolución institucional reales; JWT reemplazado por fixture local. Docente no puede consultar el informe administrativo ni guardar políticas; coordinación consulta, rector confirma; actor de cuerpo no sustituye al actor de sesión. El parámetro de otra institución no sustituye al tenant de sesión.
- PostgreSQL 17 desechable: esquema anterior completo generado con Prisma, fila de año previa, migración aditiva, verificación de datos/defaults y rechazo de comparación JSON obsoleta. Todo revertido en esa base y servidor detenido. No equivale a probar RLS de producción ni toda la cadena histórica de migraciones.
- TypeScript API/web aprobados; API repetida tras el último ajuste. Build web aprobado (advertencias existentes de tamaño de chunks).

## Límites que siguen abiertos

El historial JSON tiene controles de escritura en aplicación; no se afirma inmutabilidad de auditoría en BD. Comparación de políticas protege la confirmación, pero no sustituye una protección integral frente a cambios simultáneos en notas/planes durante el cálculo y cierre anual.

Falta comprobar el lote publicado en navegador, configurar explícitamente Transición, conciliar su plan/valoraciones de los cuatro períodos, guardar informes sintéticos sustentados en esos datos y confirmar las 12 decisiones. También permanecen la conciliación numérica por áreas/asignaturas, recuperación final, casos de repitencia/aplazamiento, documentos/snapshots y siguiente año. Una previsualización sin pendientes no certifica por sí sola todos estos puntos.

No se cerró 2026 ni se inició 2027 durante esta verificación.

## Flujo para documentar en Valeria tras validarlo en navegador

Configuración SIEE → política del año/grado → plan y valoraciones por período → Cierre y promoción → consultar previsualización → revisar informe y continuidad → guardar informe/motivo → actualizar previsualización → conciliación final de reportes → cierre. Este recorrido está implementado, pero su ejecución completa en staging aún no está validada.
