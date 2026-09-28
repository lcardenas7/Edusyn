# Duelos Edusyn — avance de bancos oficiales

Alcance aprobado: 8 categorías por cada grado de 6.º a 11.º; 48 bancos de 150 preguntas (7.200 preguntas en total). Cada institución decide si importa cada banco oficial. También puede ignorarlos y crear sus propios cuestionarios.

## Estado

| Grado | Arte y cultura | Historia | Deportes | Ciencia y naturaleza | Geografía | Lengua y literatura | Matemáticas y lógica | Tecnología |
|---|---|---|---|---|---|---|---|---|
| 6.º | Completo · staging | Completo · staging | Completo · staging | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 7.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 8.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 9.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 10.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| 11.º | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Bancos completos de sexto

- **Arte y cultura:** `docs/duelos/oficial/arte_cultura_6.json`. Tiene 150 preguntas, distribución 120/30 por tipo, 50/70/30 por dificultad y 30 claves correctas por letra. Las claves procedentes del PDF se detectaron por el espaciado de las opciones; se verificaron visualmente en una muestra. Antes de cerrar la edición del piloto conviene revisar visualmente las sustituciones del anexo, como indica la hoja de corrección.
- **Historia:** `docs/duelos/oficial/historia_6.json`. Tiene 150 preguntas y cumple las mismas distribuciones y el balance A/B/C/D. Los lotes de 25 están en `docs/DUELOS_HISTORIA_6_BLOQUE_01.md` a `docs/DUELOS_HISTORIA_6_BLOQUE_06.md`.
- **Deportes:** `docs/duelos/oficial/deportes_6.json` reúne 150 preguntas y cumple 120/30 por tipo, 50/70/30 por dificultad, 30 claves por letra y 150 conceptos únicos. Los lotes de revisión están en `docs/DUELOS_DEPORTES_6_BLOQUE_01.md` a `_06.md`. Se registró en el catálogo opcional de staging; cada institución decide si lo importa.

## Integración

El commit `c0e63bf6` incorpora Deportes · 6.º y está publicado en la rama remota `staging`. La web y la API responden; la ruta protegida del catálogo existe (responde 401 sin sesión). No se verificó el listado institucional con autenticación. La Biblioteca docente muestra los bancos completos del grado con la acción **Usar este banco**. La importación crea una copia publicada para Arena, limitada al grado y la institución, y conserva los cuestionarios creados por cada docente. Deportes se añadió al catálogo oficial de grado 6 y se conserva como importación voluntaria por institución.

## Siguiente

Continuar con **Ciencia y naturaleza · 6.º** y avanzar después por las categorías y grados pendientes.





