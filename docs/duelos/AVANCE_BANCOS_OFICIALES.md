# Duelos Edusyn — avance de bancos oficiales

Alcance aprobado: 8 categorías × 6 grados (6.º–11.º), 48 bancos de 150 preguntas, 7.200 preguntas en total. Cada institución elige qué bancos oficiales importar y puede crear cuestionarios propios.

## Estado

| Grado | Arte y cultura | Historia | Deportes | Ciencia y naturaleza | Geografía | Lengua y literatura | Matemáticas y lógica | Tecnología |
|---|---|---|---|---|---|---|---|---|
| 6.º | Completo · staging | Completo · staging | Completo · staging | Completo · staging | Completo · staging (importado en 8C) | Completo · staging | Completo · staging | Pendiente |
| 7.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 8.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 9.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 10.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 11.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Bancos completos de sexto

- **Lengua y literatura:** banco completo de 150 preguntas en `docs/duelos/oficial/lengua_literatura_6.json` y sus seis lotes de revisión en `docs/DUELOS_LENGUA_LITERATURA_6_BLOQUE_01.md`. Conversión con validación automática de cantidad, tipos, dificultad, claves y conceptos mediante `scripts/convert-duel-bank.ps1`; integrado localmente al catálogo y listo para publicar en staging.

- **Arte y cultura:** `docs/duelos/oficial/arte_cultura_6.json`. Banco piloto de 150 preguntas con las distribuciones previstas y opción de importación institucional. El documento incluye una nota para revisar visualmente las sustituciones del anexo fuente.
- **Historia:** `docs/duelos/oficial/historia_6.json`. 150 preguntas con 120/30 por tipo, 50/70/30 por dificultad y claves A/B/C/D equilibradas.
- **Deportes:** `docs/duelos/oficial/deportes_6.json`. 150 preguntas, 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y conceptos únicos. Está registrado en el catálogo opcional de staging.
- **Ciencia y naturaleza:** `docs/duelos/oficial/ciencia_naturaleza_6.json`. 150 preguntas, 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y 150 conceptos únicos. Sus seis lotes de revisión están en `docs/DUELOS_CIENCIA_NATURALEZA_6_BLOQUE_01.md` a `_06.md`. Ya está en el catálogo opcional de staging; pasan la prueba de importación y la compilación de la API.
- **Geografía:** `docs/duelos/oficial/geografia_6.json`. 150 preguntas, 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y 150 conceptos únicos. En catálogo opcional de staging e importado en el aula 8C; se corrigió la clave de la pregunta 37 tras detectar el error en revisión.
- **Matemáticas y lógica:** banco de 150 preguntas auditado y convertido en `docs/duelos/oficial/matematicas_logica_6.json`, con su revisión legible en `docs/DUELOS_MATEMATICAS_LOGICA_6_BLOQUE_01.md`. Publicado y verificado en el catálogo opcional de staging; aparece como banco disponible para importar en el aula de 8.º.

## Integración

Arte, Historia, Deportes, Ciencia y naturaleza, Geografía, Lengua y literatura y Matemáticas y lógica · 6.º están publicados en `staging`. Cada institución elige si importa los bancos, y la copia queda disponible para Arena. La Biblioteca docente ofrece **Usar este banco** y mantiene independientes los cuestionarios creados por los docentes.

## Siguiente

Cuando Matemáticas y lógica esté publicado, continuar con **Tecnología · 6.º**.
