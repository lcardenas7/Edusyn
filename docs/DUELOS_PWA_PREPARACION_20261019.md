# PWA de Edusyn — preparación del 19 de octubre

## Síntoma y diagnóstico

El usuario informa que la instalación desde Chrome en Android abre con apariencia de escritorio. Falta una captura y una comprobación en el dispositivo para establecer la causa concreta. Probar Edge puede ayudar a distinguir una preferencia del navegador de un problema de diseño, pero cambiar de navegador no confirma que el problema esté resuelto.

El HTML de staging ya declara `width=device-width, initial-scale=1.0, viewport-fit=cover`. No se debe añadir zoom forzado ni deshabilitar la ampliación del usuario.

Se encontraron deficiencias independientes en la preparación de la instalación: el manifiesto solo declaraba un icono de 196 px y el registro del service worker ocurría exclusivamente al habilitar avisos del evento. Estas deficiencias no demuestran por sí solas la causa del tamaño pequeño.

## Cambios locales preparados

- Iconos PNG reales de 192 y 512 px, versión maskable de 512 px con margen de seguridad y apple-touch-icon de 180 px, derivados del recurso de marca existente. Generador reproducible `scripts/generate-pwa-icons.ps1`.
- Manifiesto con identificador estable `/aula`, idioma `es-CO`, apertura independiente y los nuevos iconos. Se conserva la entrada al aula virtual.
- Registro del service worker al cargar la web en un contexto seguro, sin pedir notificaciones. Se comparte la misma función con la activación explícita de avisos de Duelos y se espera a un worker activo antes de suscribirse.
- Captura temprana de la oferta de instalación del navegador. El usuario autenticado ve «Instalar Edusyn» cuando el navegador ofrece esa posibilidad y la app no está ya abierta en modo independiente.
- Ayuda descartable cuando coinciden pantalla física pequeña, entrada táctil y viewport anormalmente ancho. Es una detección orientativa; no identifica todos los dispositivos y no modifica preferencias de Chrome.
- Revalidación de manifiesto, worker y documento de entrada mediante `Cache-Control: no-cache` en la configuración de `serve`. No se añade almacenamiento offline de páginas autenticadas ni respuestas de la API.

## Límites y comprobación antes de publicar

- Comprobación local completada: `npm --workspace apps/web run build` finaliza correctamente, incluida la comprobación de tipos. Vite informa advertencias de tamaño de algunos paquetes; no impidieron la compilación. No se añadieron ni ejecutaron pruebas automatizadas.
- Los cambios son locales en `worktrees/math-event-fix`; este documento no confirma publicación en staging ni producción.
- Si Chrome fuerza «Sitio para computadoras», la web no debe afirmar que puede desactivar esa preferencia por el usuario. Revisar menú del sitio y, si procede, Configuración → Configuración de sitios → Sitio para computadoras.
- Confirmar en Android real: primera instalación, apertura desde icono, ancho y tamaño de controles, aula, evento y retorno desde notificación. Comparar Chrome/Edge si persiste el síntoma.
- Confirmar que el hosting entrega los nuevos iconos y cabeceras después del despliegue y comprobar una instalación ya existente, porque el navegador controla cuándo actualiza los metadatos de una app instalada.
- No se han solicitado nuevas contraseñas, borrado datos del navegador ni cambiado puntuaciones.

Referencias oficiales consultadas:

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://developer.chrome.com/blog/desktop-mode
