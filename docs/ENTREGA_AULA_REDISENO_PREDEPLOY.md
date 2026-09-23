# Aula virtual: estado de la entrega y puertas de despliegue

Fecha: 2026-09-23. Rama local `fix/aula-movil-app-claude`, basada en `origin/staging` anterior a `5c1287cf`. No se ha empujado ni desplegado esta rama.

## Alcance de esta entrega

- Aula móvil y navegación de períodos: cuatro commits de Claude, terminando en `578e6ce3`.
- Estilo interior del editor y del contenido embebido: cambios locales de colores y superficies del aula nueva.
- Vista Hoy: cuando no hay pendientes en el período actual, distingue actividades publicadas de otro período y ofrece ver todos los períodos. Ya no afirma «Estás al día» incondicionalmente.
- Entregas del docente: apellido como clave de orden, «Entregaron» como vista inicial, filtros «Todos» y «Sin entregar», y borradores excluidos del cómputo de entregados. Si falla la consulta del alumnado, el filtro se deshabilita y se muestra el error.
- Avisos de nueva actividad: la búsqueda de destinatarios valida la cadena completa de institución, año, grupo, grado, asignatura y estudiante antes de crear mensajes. El fixture A/B hace fallar la prueba al quitar el filtro `student.institutionId`.

Verificación local: API 109 suites / 2234 pruebas verdes, `tsc --noEmit` y `nest build` limpios; web 41 archivos / 526 pruebas verdes, `tsc` limpio y Vite compiló con `--configLoader runner`. El build Vite con el cargador por defecto no pudo leer el árbol padre por el sandbox local; el cargador runner produjo los archivos finales sin errores. `git diff --check` limpio. Falta la revisión visual autenticada.

## Dependencia de seguridad antes de staging

La ruta actual `GET /classrooms/:id/students-for-assignment`, usada para «Todos» y «Sin entregar», selecciona matrículas activas por grupo, sin filtrar año ni institución. La rama local `codex/blindaje-classroom-b1-integracion` ya corrige esta ruta con `classroomInScope`, actor institucional, año y estudiante acotados. Esa rama **no está en `origin/staging`** y diverge ampliamente de ella. Hay que integrar y verificar Classroom B1 junto con el aula; no copiar solo el filtro visual ni declarar Classroom cerrado (B1 cubre 17/98 rutas).

## Puertas pendientes

1. Integrar Classroom B1 sobre el `origin/staging` vigente y resolver sus conflictos; repetir la suite API, el contrato estructural y la prueba de matrícula ajena/año ajeno en `students-for-assignment`.
2. Rebasar la rama del aula sobre el `origin/staging` vigente para conservar `5c1287cf` de CREA; revisar juntos `Classroom.tsx`, la navegación y los estilos locales.
3. Generar Prisma con la migración aditiva `20260923010000_aviso_actividad_publicada` y comprobar `migrate deploy` en una base desechable antes de staging. La generación local fue bloqueada por la revisión automática de permisos; no se debe sortear ese bloqueo.
4. Compilar API y web, ejecutar suites completas y recorrer con una sesión de docente y estudiante: publicación/aviso, cambio de período, actividad restringida, los tres filtros de entregas, devolución/calificación, y CREA en móvil.
5. Subir primero a `staging`, verificar el despliegue y la migración en Railway y repetir el recorrido con datos de prueba controlados. Solo entonces preparar un avance selectivo a `main`: ambas ramas difieren en muchos commits, por lo que no procede fusionar `staging` entero. Registrar ambos despliegues en `REGISTRO_DESPLIEGUES.md`.

Estado: **no apto aún para producción**. Esta nota describe las dependencias; no certifica una prueba en staging.
