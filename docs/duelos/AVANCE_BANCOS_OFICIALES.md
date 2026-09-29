# Duelos Edusyn — avance de bancos oficiales

Alcance aprobado: 8 categorías × 6 grados (6.º–11.º), 48 bancos de 150 preguntas, 7.200 preguntas en total. Cada institución elige qué bancos oficiales importar y puede crear cuestionarios propios.

## Estado

| Grado | Arte y cultura | Historia | Deportes | Ciencia y naturaleza | Geografía | Lengua y literatura | Matemáticas y lógica | Tecnología |
|---|---|---|---|---|---|---|---|---|
| 6.º | Completo · staging | Completo · staging | Completo · staging | Completo · staging | Completo · staging (importado en 8C) | Completo · staging | Completo · staging | Completo · staging |
| 7.º | Completo · staging | Completo · staging | Completo · staging | Completo · staging | Completo · staging | Completo · staging | Completo · pendiente staging | Pendiente |
| 8.º | Pendiente | Completo · staging | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 9.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 10.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 11.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

- **Historia · 7.º:** 150 preguntas auditadas y convertidas en `docs/duelos/oficial/historia_7.json`; disponible en el catálogo opcional de staging. Incluye seis lotes de revisión en `docs/DUELOS_HISTORIA_7_BLOQUE_01.md`.
- **Historia · 8.º:** banco completo de 150 preguntas en `docs/duelos/oficial/historia_8.json` y seis lotes de revisión en `docs/DUELOS_HISTORIA_8_BLOQUE_01.md`. Aborda revoluciones atlánticas, industrialización, formación de repúblicas, imperialismo y Colombia del siglo XIX; cumple las proporciones acordadas, tiene claves balanceadas y conceptos únicos, y pasa la prueba de importación. Disponible en el catálogo opcional de staging.
- **Deportes · 7.º:** banco completo de 150 preguntas en `docs/duelos/oficial/deportes_7.json` y seis lotes en `docs/DUELOS_DEPORTES_7_BLOQUE_01.md`. Combina reglas, estrategia, seguridad, inclusión, cultura deportiva y análisis, evitando récords dinámicos; está disponible en el catálogo de staging y tiene prueba de importación.
- **Ciencia y naturaleza · 7.º:** banco de 150 preguntas en `docs/duelos/oficial/ciencia_naturaleza_7.json` y seis lotes de revisión en `docs/DUELOS_CIENCIA_NATURALEZA_7_BLOQUE_01.md`. Cumple las cantidades y distribuciones acordadas, 30 respuestas correctas por letra y 150 conceptos únicos; está disponible en el catálogo opcional de staging y pasa la prueba de importación.
- **Geografía · 7.º:** banco de 150 preguntas en `docs/duelos/oficial/geografia_7.json` y seis lotes de revisión en `docs/DUELOS_GEOGRAFIA_7_BLOQUE_01.md`. Incluye referencias de IGAC, DANE, UNGRD e IDEAM; cumple las distribuciones y tiene 150 conceptos únicos; está disponible en staging y tiene prueba de importación.
- **Lengua y literatura · 7.º:** banco completo de 150 preguntas en `docs/duelos/oficial/lengua_literatura_7.json` y seis lotes de revisión en `docs/DUELOS_LENGUA_LITERATURA_7_BLOQUE_01.md`. Incluye comprensión, gramática, géneros, argumentación y lectura crítica; cumple las distribuciones, tiene claves balanceadas y conceptos únicos, e incluye referencias del MEN y la RAE. Disponible en staging y probado para importación.
- **Matemáticas y lógica · 7.º:** banco completo de 150 preguntas en `docs/duelos/oficial/matematicas_logica_7.json` y seis lotes de revisión en `docs/DUELOS_MATEMATICAS_LOGICA_7_BLOQUE_01.md`. Auditado con 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y 150 conceptos únicos; prueba de importación aprobada. Pendiente de staging.

## Bancos completos de sexto

- **Lengua y literatura:** banco completo de 150 preguntas en `docs/duelos/oficial/lengua_literatura_6.json` y sus seis lotes de revisión en `docs/DUELOS_LENGUA_LITERATURA_6_BLOQUE_01.md`. Conversión con validación automática de cantidad, tipos, dificultad, claves y conceptos mediante `scripts/convert-duel-bank.ps1`; integrado localmente al catálogo y listo para publicar en staging.

- **Arte y cultura:** `docs/duelos/oficial/arte_cultura_6.json`. Banco piloto de 150 preguntas con las distribuciones previstas y opción de importación institucional. El documento incluye una nota para revisar visualmente las sustituciones del anexo fuente.
- **Historia:** `docs/duelos/oficial/historia_6.json`. 150 preguntas con 120/30 por tipo, 50/70/30 por dificultad y claves A/B/C/D equilibradas.
- **Deportes:** `docs/duelos/oficial/deportes_6.json`. 150 preguntas, 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y conceptos únicos. Está registrado en el catálogo opcional de staging.
- **Ciencia y naturaleza:** `docs/duelos/oficial/ciencia_naturaleza_6.json`. 150 preguntas, 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y 150 conceptos únicos. Sus seis lotes de revisión están en `docs/DUELOS_CIENCIA_NATURALEZA_6_BLOQUE_01.md` a `_06.md`. Ya está en el catálogo opcional de staging; pasan la prueba de importación y la compilación de la API.
- **Geografía:** `docs/duelos/oficial/geografia_6.json`. 150 preguntas, 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y 150 conceptos únicos. En catálogo opcional de staging e importado en el aula 8C; se corrigió la clave de la pregunta 37 tras detectar el error en revisión.
- **Matemáticas y lógica:** banco de 150 preguntas auditado y convertido en `docs/duelos/oficial/matematicas_logica_6.json`, con su revisión legible en `docs/DUELOS_MATEMATICAS_LOGICA_6_BLOQUE_01.md`. Publicado y verificado en el catálogo opcional de staging; aparece como banco disponible para importar en el aula de 8.º.
- **Tecnología:** banco de 150 preguntas en `docs/duelos/oficial/tecnologia_6.json` y sus seis lotes de revisión en `docs/DUELOS_TECNOLOGIA_6_BLOQUE_01.md`, con base en las orientaciones curriculares de Tecnología e Informática para 6.º–7.º. Convertido, registrado, probado y verificado en staging como opción institucional para importar; no se importó al aula.

## Integración

Arte, Historia, Deportes, Ciencia y naturaleza, Geografía, Lengua y literatura, Matemáticas y lógica y Tecnología · 6.º están publicados en `staging`. También están disponibles siete bancos completos de 7.º y el banco de Historia · 8.º. Se verificó en la biblioteca docente del aula de 8.º; cada institución decide si importa cada banco. La Biblioteca docente ofrece **Usar este banco** y mantiene independientes los cuestionarios creados por los docentes.

## Siguiente

Siguiente: completar **Tecnología · 7.º**; después avanzar con las demás combinaciones de grado y categoría.
