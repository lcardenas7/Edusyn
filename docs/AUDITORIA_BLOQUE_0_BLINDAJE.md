# Bloque 0 — contrato estructural de rutas

Fecha: 2026-09-10. Base: `996263f8` de `origin/staging`.

## Problema y alcance

Un controlador nuevo podía operar sobre recursos institucionales sin resolver la institución y sin que la suite lo detectara. Se añade un inventario AST de todos los archivos fuente del API, incluso controladores fuera de archivos llamados controller.ts. Reconoce decoradores HTTP importados de Nest (incluidos alias, All y SSE), y exige una llamada directa e incondicional con await al resolver importado.

La prueba se ejecuta dentro de la suite Jest habitual. Incluye pruebas negativas: añadir ruta, quitar resolución, comentarios, strings, import sin uso, llamada sin await, función distinta con igual nombre, callback sin ejecutar, rama muerta y excepción modificada/obsoleta.

## Objeción al encargo y deuda de transición

No es posible tener a la vez una suite verde, conservar todos los módulos aún sin auditar y exceptuar solamente recursos no institucionales. Se registra la deuda previa explícitamente por ruta como `pending-audit`, separada de `non-institutional`. NO son certificados de seguridad. La tabla de los 39 módulos y sus cantidades está en `ESTADO_BLINDAJE.md`.

No hay exclusiones por carpeta ni excepciones que se apliquen a futuros métodos. La huella incluye imports, decoradores de clase y método completo sin comentarios. Una ruta nueva sin resolución hace fallar la suite, incluso en Play o SuperAdmin. Si se corrige una ruta pendiente hay que retirar su excepción; si se modifica, hay que revisarla. No hay comando que regenere excepciones en CI.

## Qué NO cubre

- La presencia del resolver no demuestra que su resultado llegue a Prisma ni que proceda de un argumento legítimo. No es análisis de flujo de datos o dominancia completo; rutas que resuelven mediante helpers quedan pendientes.
- No demuestra ausencia de efectos anteriores a la resolución, pertenencia de IDs relacionados, filtrado en cada consulta ni autorización docente. Eso exige las pruebas A/B por módulo del encargo.
- La huella de una excepción no vigila el código del servicio al que llama. Cambiar ese servicio requiere auditoría y pruebas específicas.
- El inventario estático cuenta declaraciones de decoradores; no certifica el registro efectivo de Nest, herencia, decoradores personalizados, rutas registradas dinámicamente o combinaciones de arrays/prefijos/versiones. Su alcance es el patrón actual de controladores Nest del repositorio.
- No hay reproducción HTTP ni conexión a datos; RLS, producción, migraciones, R1 y EduLab no se modifican.
- La lista pendiente puede contener falsos positivos, contextos indirectos y recursos globales aún por clasificar. No debe comunicarse su tamaño como número de vulnerabilidades.

## Mantenimiento

Ejecutar desde apps/api: `npm test -- --runInBand institution-route-contract`. La suite completa lo incluye automáticamente. Para cada error revisar la ruta y servicio: implementar resolución y retirar excepción, o justificar una excepción exacta con revisión explícita. No añadir comodines ni actualizar huellas en masa para obtener verde.

Para volver a contar los 39 módulos: `npx ts-node scripts/inventory-institution-routes.ts` desde apps/api. Es de solo lectura y termina con error si el inventario viola el contrato.

No se declara cerrado el encargo ni el aislamiento de nuevos módulos mediante este contrato.

## Verificación local

83 suites / 1.232 pruebas API, 19 archivos / 203 pruebas web, tipos API/web y build Nest correctos. 13 pruebas del contrato estructural. Cliente Prisma local regenerado desde el esquema versionado sin tocar el cliente compartido ni ejecutar migraciones. Inventario: 1.110 declaraciones, 236 resoluciones directas, 816 pendientes de calibración, 58 excepciones no institucionales.
