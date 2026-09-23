# CREA: alcance de las apps y juegos de estudiantes

Fecha: 2026-09-23.

## Lo que funciona hoy

El editor, la vista previa y la publicación comparten un contrato de tres archivos: `index.html`, `styles.css` y `app.js`, con un máximo de 250 000 bytes UTF-8 por archivo. El servidor valida ese manifiesto antes de guardarlo. La app publicada funciona sin red, admite `localStorage` y puede dibujar gráficos con CSS, SVG inline y Canvas. Con ese contrato se puede entregar una app pequeña completa y un juego 2D jugable sin Godot: controles, animación, colisiones, puntuación, estados de victoria/derrota y reinicio caben en esos archivos.

El límite actual es de producto, no una prueba de que el modelo «pro» sea incapaz: el código se pega desde una IA externa y CREA no ejecuta una batería de pruebas del juego ni verifica que cada botón funcione. Por eso un resultado a medias puede guardarse si cumple el formato. El prompt ahora pide código ejecutable, sin `TODO` ni controles inertes, y añade criterios de partida completa cuando el plan menciona un juego. El equipo todavía debe probar la vista previa y corregir fallos antes de guardar o publicar.

## Lo que no admite este formato

- Subir sprites, fondos, fuentes o audio como archivos independientes. Referencias externas tampoco sirven: la vista previa y la app publicada restringen red y recursos externos por diseño.
- Importar módulos JavaScript adicionales, paquetes npm o un motor como Godot.
- Datos compartidos entre usuarios, cuentas, multijugador o backend propio de la app. `localStorage` vive en el navegador de cada persona.

## Siguiente ampliación recomendada

Agregar un paquete de recursos locales, empezando por PNG/WebP y audio con límites de cantidad y tamaño, nombres seguros y validación de tipo real. El editor debe permitir subirlos y referenciarlos, y la vista previa, el publicador y el service worker deben servir exactamente esos mismos recursos aislados y sin acceso a la sesión de Edusyn. Exigir pruebas de previsualización en móvil/teclado y una lista de controles funcionales antes de publicar. Esto requiere cambios coordinados en manifiesto, API, almacenamiento, editor, vista previa, publicador y caché offline; no conviene ampliar solo el límite de archivos del validador porque los demás componentes los ignorarían.

No se necesitan archivos extra para un primer juego 2D con gráficos Canvas/SVG. Sí hacen falta para juegos con arte o sonido propio y para proyectos que deban crecer de manera modular. Una app con servidor o multijugador sería otra categoría de producto, con costos y controles de seguridad propios.
