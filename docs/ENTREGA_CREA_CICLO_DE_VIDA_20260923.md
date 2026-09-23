# CREA: vencimiento y retiro de apps publicadas

Base local: `origin/staging` = `5c1287cf` al comenzar. Esta entrega no cambia el esquema ni toca datos existentes.

## Comportamiento

- Al aprobar una app sin fecha indicada, se usa el cierre del año lectivo del aula **más 30 días**, hasta las 23:59:59 de Colombia. La cadena aula → año → institución se comprueba antes de publicar. Si el año no tiene fecha de cierre o el margen ya pasó, se pide una fecha futura explícita. Las publicaciones existentes no reciben vencimiento retroactivo.
- «Retirar» conserva proyecto, versiones, enlace y métricas para poder reactivar. El texto advierte que una copia instalada puede funcionar sin conexión.
- «Eliminar publicación y detalle de uso» aparece cuando la app ya no está en línea. Requiere escribir el nombre exacto. Una transacción guarda métricas agregadas en la bitácora y borra la publicación; las filas de dispositivos y días se eliminan por cascada. El proyecto y las versiones permanecen. Al publicar otra vez se emitirá un enlace nuevo.
- `crea-apps` guarda respuestas positivas dos segundos como máximo y no sirve una copia antigua si la API deja de responder. Una app instalada y desconectada conserva la copia local; la plataforma no puede revocarla remotamente sin conexión.

## Verificación local

- API: 107 suites / 2201 pruebas; contrato de rutas verde; TypeScript y `nest build` limpios.
- Web: 36 archivos / 478 pruebas; TypeScript y Vite build limpios.
- `crea-apps`: 11 pruebas verdes, incluidas retirada y caída de API.
- `git diff --check` limpio.

## Antes de subir a staging

`git fetch origin staging` confirmó `origin/staging = 5c1287cf` tras la verificación. Preparar un commit aislado, comprobar en staging con docente y estudiante: fecha implícita/expresa, retiro, reactivación, eliminación, bitácora y enlace antiguo en línea. No borrar datos de prueba ajenos ni tocar producción para este recorrido.
