# @edusyn/edulab-runtime

Runtime headless para ejecutar definiciones declarativas de EduLab en navegador,
pruebas Node y futuros procesos de replay o validación del servidor.

La versión `0.1.0` fija estas reglas de determinismo:

- la definición se canonicaliza con claves ordenadas y se identifica con FNV-1a de 32 bits;
- `xorshift32` es el único PRNG de reglas y recibe una semilla explícita;
- las reglas se ordenan por dependencias `after` y después por orden UTF-16;
- las cantidades son enteros seguros que representan unidades de punto fijo;
- el tiempo es un contador lógico y solo cambia mediante `advanceClock`;
- ninguna definición puede ejecutar callbacks, JavaScript arbitrario, I/O ni APIs del entorno.

Una definición debe pasar validación estructural y semántica antes de crear un intento.
Los objetivos conservan por separado el resultado alcanzado (`achieved`) y la evidencia
observable de comprensión (`demonstrated`).
