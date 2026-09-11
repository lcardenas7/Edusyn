# Revisión de uso: Matrículas e Inclusión Educativa

Fecha: 2026-09-11. Complementa el aislamiento por petición explícita del usuario: corregir procesos, acciones ocultas y oportunidades de mejora.

## Matrículas y edición de estudiantes

- Filtros visibles al entrar, aviso si se ocultan con filtros activos, limpieza de filtros y resultados vacíos que distinguen una búsqueda sin coincidencias. «Todos» los años ya consulta todos, en lugar de mantener silenciosamente la lista anterior.
- Las respuestas antiguas no reemplazan una búsqueda reciente. El encabezado muestra el año seleccionado y se limpian datos y ventanas al cambiar de institución.
- «Nueva matrícula» abre el formulario existente de estudiante y matrícula inmediata; se retiró el diálogo que solo decía «en desarrollo».
- «Exportar lista filtrada» descarga las mismas filas visibles en CSV, con comillas, acentos y protección frente a fórmulas introducidas como texto.
- La tabla muestra «Cambiar grupo». Editar un estudiante ofrece el enlace explícito a su matrícula activa y avisa de cambios personales sin guardar antes de salir.
- El cambio de grado permite seleccionar un acta aprobada. Se muestran requisitos y advertencias antes de confirmar. El botón de confirmación dice «Confirmar cambio», no «Eliminar».
- Un error de operación se ve sobre la ventana abierta; no sustituye silenciosamente toda la lista. Un historial que falla no abre eventos de otro estudiante.
- No se guarda un estudiante sin matricularlo silenciosamente cuando la opción de matrícula inmediata está marcada pero falta un año activo.
- Si se guardan los datos personales pero falla el acudiente, se informa del resultado parcial y se mantiene abierto el formulario.

## Inclusión Educativa

- Entrada en «Seguimiento y planes», disponible para docentes. Antes se abría un dashboard que solo algunos roles podían ver y dejaba al docente sin contenido.
- Tres accesos explican el recorrido: conocer al estudiante, preparar apoyos y revisar avances. El resumen institucional y la configuración conservan sus permisos.
- Agenda del grupo y período seleccionados: búsqueda por estudiante/documento/estrategia, pendientes de hoy o vencidos, sin fecha, activos y completados. Los planes cerrados no cuentan como pendientes. Las fechas se comparan como fechas de calendario de Colombia.
- «Registrar avance» queda visible; un botón abre la edición del plan, antes inaccesible, para ajustar apoyos y reprogramar seguimiento.
- Año académico cargado independientemente de la pestaña; crear un perfil ya no depende de visitar antes los planes.
- Cambiar de año limpia períodos/grupos anteriores. Las peticiones de planes/perfiles no sobreescriben una selección reciente. Cambiar de institución o usuario reinicia el estado de la pantalla.
- Un fallo de carga muestra un error y opción de reintento, evitando presentar una consulta fallida como cero planes. Los errores de guardado son visibles sobre los formularios y permanecen hasta cerrarlos.
- Editar un perfil inactivo no lo reactiva por tener consentimiento. Borrar observaciones, compromisos o fechas persiste el vaciado, en lugar de omitir el campo y conservar su valor anterior.

## Verificación

Prueba reproducible: `apps/web/tests/enrollment-inclusion.smoke.cjs`. Usa las pantallas reales, AuthProvider, router y diálogos, con un colegio sintético y todas las peticiones API interceptadas. Bloquea dominios externos. No usa cuentas reales. La página temporal se elimina al terminar.

Requiere el servidor Vite local en `127.0.0.1:5179`, Playwright y Edge. Ejecución desde la raíz: `node apps/web/tests/enrollment-inclusion.smoke.cjs`. Si Playwright está en un runtime externo, establecer `PLAYWRIGHT_MODULE` a su ubicación antes de ejecutar. Las capturas quedan en `tmp/` y no se publican.

Comprobado: filtros, movimiento con cuerpo esperado, fallo de historial, búsqueda vacía y limpieza, alta real, enlace desde edición de estudiante, agenda, reprogramación, entrada docente, selección de estudiante para perfil, error de configuración y viewport móvil de 390 px sin desbordamiento. Se inspeccionaron capturas de escritorio y móvil. Las pruebas unitarias cubren la agenda y el CSV.

## Qué NO cubre

Esta entrega no declara APD auditado en seguridad. Sus 32 rutas y su servicio requieren revisión A/B independiente, al igual que la API compartida de planes pedagógicos. Tampoco sustituye una prueba integrada con la base de datos, el Layout completo, firmas/documentos, análisis institucional ni comprobación de despliegue. No se añadió asesoría clínica, generación de diagnósticos, migraciones ni cambios de permisos del servidor.

Pendientes funcionales identificados: selección docente de grupos según asignación y acceso de orientación; resistencia a fallos parciales del resumen institucional; revisión integral de adjuntos, participantes, firmas y cierre de planes. Deben resolverse con evidencia antes de declarar terminado todo el módulo de Inclusión.
