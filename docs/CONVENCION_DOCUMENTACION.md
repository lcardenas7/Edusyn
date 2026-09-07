# Qué documentación vive en este repositorio, y cuál no

Este repositorio es **público**. Todo lo que se rastrea en Git queda publicado, y
publicar no se deshace: retirar un fichero en un commit posterior no lo borra del
historial ni de las copias que alguien haya hecho.

De ahí una única regla, sencilla de aplicar:

> **Si un documento ayudaría a atacar Edusyn, no entra en el repositorio.**

No importa que no contenga contraseñas. Un documento sin un solo secreto puede
seguir siendo un mapa: decir qué está protegido y qué no, dónde quedan huecos
abiertos o cómo se recupera un entorno es información que solo beneficia a quien
quiera aprovecharla.

---

## Lo que sí vive aquí

- Documentación de producto y de diseño funcional.
- Decisiones pedagógicas y de negocio.
- Guías de uso, convenciones de código y arquitectura general.
- Auditorías de trabajo **ya cerrado**, cuando describen un problema resuelto y
  no una debilidad vigente.

## Lo que no

- Bitácoras y checkpoints operativos del programa de seguridad.
- Censos de aislamiento, matrices de qué tablas están protegidas y cuáles no.
- Listas de pendientes, huecos abiertos o rutas todavía vulnerables.
- Procedimientos internos de recuperación y de despliegue.
- Detalles operativos de roles, propiedad de objetos e infraestructura real.
- Evidencia de auditorías: volcados JSON, resultados de sondeos, registros.
- Herramientas de inspección que revelen cómo está montado el entorno real.
- Cualquier dato de personas o de instituciones. Los datos de ejemplo del
  repositorio son **sintéticos**, siempre.

Ante la duda, **fuera**. Es más barato mover un documento al repositorio que
retirarlo de uno público.

---

## Dónde vive lo demás

Fuera de este árbol de Git, en el espacio interno del equipo, más el respaldo
cifrado del programa de seguridad.

Una advertencia que conviene no aprender por las malas: **una carpeta no se
vuelve privada por llamarse `private`**. Si está rastreada, se publica. La única
separación real es no tenerla en el repositorio.

Las rutas `docs/security/` y `docs/internal/` quedan **reservadas**: están
ignoradas por Git y el chequeo previo falla si alguna aparece rastreada. Sirven
como red, no como permiso para guardar ahí material interno.

---

## Comprobación antes de publicar

```bash
npm run check:publicable
```

Revisa lo que Git tiene rastreado y avisa de rutas reservadas, ficheros que
nunca deben publicarse y posibles secretos. **Informa el fichero, la categoría y
el motivo, y nunca el valor encontrado** — de otro modo el propio aviso
publicaría el secreto en el registro de la integración continua.

Si algo aparece, la solución no es borrarlo y seguir: es sacarlo del repositorio
y, **si era una credencial, rotarla**. Para un secreto ya publicado, rotar es lo
único que de verdad funciona; limpiar el historial llega tarde.
