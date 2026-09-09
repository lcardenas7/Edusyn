# Consolidación académica — encargo y plan ejecutable

Fecha: 2026-09-08. Base examinada: copia aislada de origin/staging, commit 0eec42ba7b364efc3408a48db27de2d564f0de4d. La referencia remota almacenada no acredita por sí sola qué versión está desplegada.

## Encargo

Auditar Edusyn por módulos y después por relaciones: configuración institucional, matrículas, evaluación, recuperaciones, reportes, observador e inclusión. Comprobar el ciclo desde la creación institucional hasta el cambio de año. Identificar causas, reproducir defectos y corregirlos en una copia aislada, con evidencia de regresión. No declarar garantía global por pruebas unitarias. Registrar por caso datos, rol, pasos, resultado esperado, observado y evidencia. Separar PASS, FAIL, PENDIENTE y BLOQUEADO. Preservar trabajo ajeno, especialmente el rediseño incompleto del Aula.

## Límites de ejecución

- Staging y producción contienen datos reales: no ejecutar seeds, borrados, recalculados, cierres, promociones, migraciones ni simulaciones sobre ellos.
- Las pruebas con escrituras requieren destino LOCAL_EPHEMERAL verificado; localhost por sí solo no demuestra aislamiento.
- No usar credenciales, archivos, copias o información personal reales como fixtures. Desactivar correo, almacenamiento remoto y servicios externos en el laboratorio.
- Sin despliegues en este encargo de revisión. Las correcciones se entregan revisables con sus pruebas.
- No alterar la rama abierta ni el esquema para acomodar una versión antigua. La copia aislada de staging preserva los cambios locales existentes.

## Dataset y oráculo

Dos instituciones ficticias A/B, dos años, dos sedes, jornadas y grupos; roles rector, administración, coordinación, docente asignado/no asignado, estudiante y acudiente vinculado/no vinculado. Cubrir preescolar cualitativo, primaria y secundaria cuantitativas; escalas 0–5 y 0–100. Estudiantes con tildes/nombres largos, matrícula tardía, retiro, reingreso, traslado, inclusión y graduación.

Ejemplo independiente de cálculo: períodos 20/30/50%, notas 2/3/4 dan anual 3,3. Cero registrado conserva cero; ausencia permanece sin nota. Recuperación de 2 a 3 bajo política de reemplazo aprobada produce 3 y conserva el original y la autoría. Otras políticas deben tener su propio resultado calculado antes de ejecutar. Ninguna política se inventa para la institución real.

## Casos por módulo

| ID | Flujo y variantes | Resultado verificable |
|---|---|---|
| INS-01 | Crear institución, administrador, sedes/jornadas, niveles, año, períodos, escala y malla | Institución utilizable; duplicados y configuración inválida rechazados; contexto A/B aislado |
| INS-02 | Arranque a mitad de año e importación con filas inválidas/repetidas | Errores por fila, sin duplicados ni pérdida de historia |
| MAT-01 | Matrícula, traslado, retiro y reingreso; cambio de docente | Historia y evidencia conservadas, listados según vigencia |
| EVA-01 | Actividades, componentes, pesos, nota cero, vacía y límites | Valores según escala y oráculo; ausencia distinta de cero |
| EVA-02 | Guardado repetido, doble sesión, pérdida de red y reintento | Sin duplicación ni sobrescritura silenciosa; error claro |
| EVA-03 | Entrega, cierre, finalización, corrección y reapertura | Roles/estados autorizados y trazabilidad antes/después |
| REC-01 | Elegibilidad, actividad, resultado, revisión y aprobación | Solo elegibles; política institucional aplicada; autoría |
| REC-02 | Resultado inferior, duplicado, pendiente y recálculo posterior | No reduce ni elimina recuperación válida; rechazo de transiciones inválidas |
| REP-01 | Boletín individual/grupal, consolidado, estadísticas y reprobación | Misma nota canónica, período/año/grupo correctos y totales reconciliados |
| REP-02 | PDF/Excel: tildes, textos extensos, muchas asignaturas y varias páginas | Sin recortes, encabezados repetidos, orden estable, leyendas y escala correctas |
| REP-03 | Cierre, cambio de configuración y reemisión histórica | Versión y configuración histórica conservadas; exportación trazable |
| OBS-01 | Observación, seguimiento, compromiso, adjunto y consulta histórica | Permisos por vínculo, cronología, autoría y privacidad |
| INC-01 | Caracterización, apoyos/PIAR, responsables, seguimiento y cierre | Acceso restringido; continuidad; reporte pertinente sin datos sensibles innecesarios |
| ANO-01 | Consolidación, comisión, promoción, repetición y graduación | Resultado conforme al reglamento; sin doble matrícula ni pérdida de historia |
| ANO-02 | Abrir siguiente año, copiar configuración, asignar docentes y consultar anterior | Nuevo año operativo; notas, observador, inclusión y documentos anteriores preservados |
| SEC-01 | Repetir lecturas/escrituras con IDs de B desde A y roles no autorizados | Denegación sin datos ni efectos secundarios |

## Integración y navegación

Ejecutar en orden INS → MAT → EVA → REC → REP → OBS/INC → ANO. En cada etapa contrastar pantalla, API, persistencia y documento. Repetir cambio institución/año/grupo durante una carga, recarga de página, vuelta atrás y sesión expirada. Navegar como cada rol, escritorio y móvil. No confundir una UI con respuestas simuladas con una prueba real de integración.

## Criterio de aceptación

Todos los casos críticos deben pasar con evidencia sobre la misma revisión. Cada reporte se reconcilia con el oráculo y se inspecciona visualmente. Ningún P0/P1 abierto; ningún caso crítico pendiente puede presentarse como aprobado. La aceptación de staging/producción requiere verificar su revisión desplegada y los flujos permitidos con cuentas de prueba, sin modificar registros reales.

## Registro de ejecución

La ejecución y los hallazgos se guardan junto a este plan, en `RESULTADO_Y_PENDIENTES.md` y los JSON de resultados. Las pruebas unitarias usan dobles de servicios; se complementan con HTTP real contra PostgreSQL nuevo y exclusivamente sintético, navegación CUA y revisión visual de PDF. Ninguna de esas evidencias acredita por sí sola staging o producción.

## Ampliación autorizada: Aula Virtual

Luis autorizó completar el rediseño e integrar sus funcionalidades, mejorar visuales y navegación, preservando el trabajo de Claude. Se incorporaron herramientas existentes dentro del shell nuevo (foro, anuncios, materiales, actividades), creación/copia/color y diálogos propios. Se valida tanto el rol docente como el estudiante, enlaces profundos, cancelaciones, persistencia y cambio de año. No confundir una integración funcional de editores existentes con una reescritura visual completa de sus componentes.

## Bitácora de continuidad

- Se creó laboratorio independiente en 55434 y API 3018; 97 migraciones aplicadas, cero fallidas, siete tablas con RLS. Sin datos reales.
- Se corrigieron aislamiento puntual de acompañamiento, consentimiento APD, no disminución por recuperación, rechazo de recuperación, histórico de boletín y formato/fecha/asistencia del PDF.
- API: 61 suites / 1006 pruebas aprobadas. Modelo Aula: 14 archivos / 171 pruebas aprobadas. El contrato de copia de Aula se ejecutó de nuevo después de corregir actividades no seccionadas; la evidencia se conserva separada.
- Cambio de año sintético 2026→2027 por HTTP: activación, traslado y repetición sin duplicado; histórico conservado.
- Aula: diez casos HTTP aprobados; navegación confirmó foro con respuesta, edición guardada, cancelación de devolución, etiquetas por año, creación de aula C, copia y quiz con pregunta creada.
- Se preservan fallos originales en los archivos `*-before.json`, `academic-cycle-results.json` y `recovery-http-results.json`; las regresiones aprobadas se guardan por separado.
- Bitácora cronológica: `BITACORA_CONSOLIDACION_20260908.md`. Relevo de blindaje: `RELEVO_CLAUDE.md`. Paquete de fuente y pruebas: `consolidacion-academica-aula.patch`; hashes: `MANIFIESTO_CAMBIOS.json`. Pendientes y cobertura: `RESULTADO_Y_PENDIENTES.md`.
