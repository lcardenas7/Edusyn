# Edusyn Construye — F0: modelo de amenazas

F0 valida que un proyecto HTML, CSS y JavaScript de prueba pueda ejecutarse sin compartir el origen, la sesión o los datos académicos de Edusyn.

## Fronteras

| Origen principal | Preview aislado |
|---|---|
| Edusyn autenticado; puede tener JWT en almacenamiento local y APIs académicas | Servicio independiente; no recibe cookies, JWT, usuarios, datos del Aula ni secretos |
| Aloja el host y traduce errores a ayuda pedagógica | Ejecuta código no confiable dentro de iframe sandbox |

El host utiliza iframe con sandbox="allow-scripts" y sin allow-same-origin. El preview aplica CSP con red, recursos externos, formularios, objetos, frames y base URL denegados. El servicio de preview debe desplegarse en un dominio distinto al de Edusyn; el puerto separado sólo sirve para el prototipo local.

## Mensajes permitidos

El preview sólo puede informar ready, runtime-error, syntax-error, resource-error y preview-log. El host comprueba source, identificador de instancia, versión de protocolo, tipo, tamaño y esquema. Como un iframe sandboxed tiene origen opaco, el host no usa un origin nulo como prueba de identidad. Los eventos del preview nunca deciden calificaciones ni permisos.

El host puede enviar sólo load-project al origen opaco. El runner comprueba que ese mensaje venga del origen principal indicado al cargar. No se usa eval, new Function ni srcdoc. El runner escribe el documento únicamente dentro de su propio contexto sandboxed, que no tiene privilegios sobre Edusyn.

## Recursos

F0 permite un subconjunto explícito de SVG. Se rechazan scripts, eventos, referencias externas, foreignObject, enlaces activos y etiquetas/atributos no permitidos. Las fotos y recursos de producción entran en F1 con escaneo, eliminación EXIF, licencia y almacenamiento aislado.

## Fuera de F0

Persistencia, RLS, equipos, datos de demostración, publicación, PWA, APK/AAB, IPA y llamadas API a proveedores de IA quedan fuera del prototipo. Antes de habilitar estudiantes reales se requiere revisión adversarial de mensajes, CSP, fuga de sesión, carga de recursos, acceso entre proyectos y agotamiento de recursos.
