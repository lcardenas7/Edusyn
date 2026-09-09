# Bitácora de consolidación académica y Aula

Fecha de apertura: 2026-09-08. Estado: trabajo local documentado; sin despliegue ni cambios en staging/producción.

## Alcance y salvaguardas

- Luis autorizó revisar y mejorar la consolidación académica, navegación, menús y Aula Virtual, respetando que existen datos reales e información sensible en los ambientes compartidos.
- Se preservó la rama de trabajo `feat/aula-rediseno` y el trabajo paralelo de Claude. La ejecución se realizó contra una copia aislada de la referencia local de staging `0eec42ba7b364efc3408a48db27de2d564f0de4d`.
- Se creó un laboratorio PostgreSQL local efímero en el puerto 55434 y una API local en 3018. Se usaron instituciones, personas, cursos, matrículas, notas y documentos exclusivamente sintéticos. No se conectó a ni se modificó una base compartida.
- El paquete de integración es selectivo: `consolidacion-academica-aula.patch` y `MANIFIESTO_CAMBIOS.json`. Excluye datos, secretos, dependencias, builds y documentación privada.

## Plan ejecutado

1. Se definió el recorrido de institución a cambio de año: configuración, matrícula, evaluación, recuperación, reportes, observador, inclusión, promoción y apertura del siguiente año.
2. Se probó cada módulo de forma individual y después los traspasos de datos entre ellos mediante pruebas unitarias, HTTP real contra el laboratorio, navegación docente/estudiante y revisión de PDF.
3. Se guardó el primer resultado defectuoso separado del resultado corregido para que la evidencia no oculte hallazgos.
4. Se revisó Aula Virtual sobre el rediseño existente, integrando herramientas en el shell nuevo sin crear endpoints ni migraciones adicionales.

## Hallazgos y correcciones aplicadas

| Área | Hallazgo reproducido | Corrección local | Evidencia |
|---|---|---|---|
| Boletín histórico | Después del cierre, el reporte excluía la matrícula cuyo estado ya no era ACTIVE. | El universo histórico admite estados de cierre y restringe el grupo al año del período. | `academic-cycle-results.json` conserva el fallo; `report-fixes-results.json` confirma la corrección. |
| PDF de boletín | Columnas finales se salían de la página; la fecha civil podía desplazarse; sin registros parecía 0%. | Se ajustaron ancho, alto, encabezados repetidos, fecha y leyendas. | PDF normal y cuatro páginas de caso extenso inspeccionadas (`boletin-extenso-page2.png`, `boletin-extenso-page4.png`). |
| Recuperación | Una recuperación con tope bajo podía bajar la nota original. | La nota final usa el mayor valor entre original y resultado calculado. | Regresión de recuperación y flujo HTTP. |
| Rechazo de recuperación | El registro podía guardar 3 mientras boletín mostraba 2. | La revisión persiste `finalScore` al rechazar. | `recovery-review-fixed.json`. |
| Inclusión/APD | Revocar consentimiento podía mantener activo el perfil. | La revocación desactiva el perfil y registra la transición. | Pruebas de contrato APD. |
| Acompañamiento pedagógico | El cuerpo de la petición podía reemplazar la institución resuelta; algunas lecturas no recibían contexto institucional. | Se corrigió el orden de datos y se acotaron lectores. | Pruebas de aislamiento; aún requiere cobertura A/B integral. |
| Navegación administrativa | Procesos relacionados aparecían dispersos y permisos se confundían con roles del personal. | Se agruparon Seguimiento/Inclusión, se aclaró cambio de año y se diferenciaron permisos. | Revisión de código y navegación local. |
| Aula: acciones canceladas | Cancelar programación o devolución podía continuar la acción. | Cancelar programación despublica; cancelar devolución detiene la operación. | HTTP y navegación con calificación conservada. |
| Aula: copia | La copia inicial de un Aula no trasladaba actividades sin sección. | Se incluyen actividades seccionadas y no seccionadas; se mapea período equivalente; el destino queda borrador y sin trabajo de estudiantes. | `aula-copy-before.json` y regresión aprobada `aula-copy-after.json`. |

## Recorrido funcional comprobado

- Configuración y evaluación: notas 0, 2 y 4, cálculo anual ponderado, cierre e intento de segundo cierre rechazado.
- Reportes: consulta de boletín antes y después del cierre; fecha, asistencia y PDF con nombres/textos largos y 40 asignaturas.
- Recuperaciones: pendiente conserva nota, aprobación respeta tope y rechazo conserva nota original en registro y boletín.
- Cambio de año 2026 a 2027: períodos, escala y asignación sintéticos; activación, traslado de una matrícula y repetición sin duplicado; el histórico de 2026 permaneció consultable.
- Aula HTTP: diez casos aprobados para materiales, anuncios, tarea, programación, publicación, foro, acceso de estudiante, entrega, respuesta y calificación.
- Aula navegada: foro con respuesta de estudiante; edición de actividad guardada; devolución cancelada; selector con 2026 cerrado y 2027; creación de Aula C; copia comprobada; acceso rápido de quiz abre formulario específico y se agregó una pregunta.

## Validación automatizada disponible

- API: 61 suites y 1006 pruebas aprobadas en la ejecución consolidada (`jest-final.json`).
- Aula modelo frontend: 14 archivos y 171 pruebas aprobadas.
- Contrato de copia de Aula aprobado después de la corrección (`aula-copy-after.json`): fuente con dos actividades, destino con dos actividades, período correctamente mapeado y cero entregas/calificaciones copiadas.
- La compilación API, TypeScript web y build Vite se ejecutaron satisfactoriamente durante la consolidación. Vite informó paquetes grandes; es una mejora de rendimiento pendiente, no un fallo funcional.

## Riesgos y trabajo pendiente

1. La evidencia local no certifica staging ni producción. Para aceptar un ambiente compartido debe verificarse la revisión desplegada con cuentas de prueba y operaciones permitidas que no modifiquen información real.
2. Falta blindaje A/B completo en recuperaciones, configuración de recuperaciones, acompañamiento, Aula y reportes. Claude debe priorizar estos P0 con pruebas de lectura y escritura cruzada, y roles asignado/no asignado.
3. El indicador de inclusión mostró 15% con cero perfiles APD activos y un plan genérico. Se debe acordar la definición antes de presentarlo como resultado confiable.
4. Faltan preescolar, escala 0–100, importaciones, matrícula tardía/retiro/reingreso, graduación, exportaciones restantes, sesiones/rutas/proyectos/Valeria de Aula y navegación móvil controlada.
5. Los editores reutilizados de Aula siguen teniendo detalles visuales del diseño anterior; requieren una pasada de consistencia y rendimiento después de asegurar permisos y flujos.

## Coordinación con Claude

Se dejó una instrucción de continuidad en `RELEVO_CLAUDE.md`: blindar primero recuperaciones/configuraciones por institución, después acompañamiento, Aula y reportes; probar A/B con roles; mantener cambios pequeños y documentados; no desplegar, migrar, sembrar, cerrar años ni operar datos reales. Este relevo queda local y no se incorpora al producto.

La instrucción fue enviada el 2026-09-08 a la tarea de continuidad de blindaje de Codex (`01a05071-bde5-7383-bf8b-cac9be7820b7`).

## Estado de entrega

La corrección queda preparada para revisión selectiva, no para promoción automática. Los documentos de referencia son `PLAN_Y_ENCARGO.md`, `RESULTADO_Y_PENDIENTES.md`, esta bitácora, `RELEVO_CLAUDE.md`, el manifiesto y el parche. Los hallazgos P0/P1 pendientes mantienen abierta la auditoría.
