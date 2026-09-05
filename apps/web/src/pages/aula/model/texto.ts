/**
 * Texto libre escrito por personas, preparado para pintarse. **Lógica pura.**
 *
 * Por qué existe. Las instrucciones de una tarea real llegaron con sus 66 espacios en U+00A0
 * —espacio duro— porque el docente las pegó desde un procesador de texto. Para el navegador un
 * espacio duro **no es sitio por donde cortar**, así que el párrafo entero contaba como una sola
 * palabra: estiró la página a 2000 px en un celular de 375. Y al forzar el corte, partía a mitad
 * de palabra ("docu / mento"), que se lee como si la aplicación estuviera rota.
 *
 * Se arregla al pintar, no en la base: el dato del colegio se queda como está.
 */

/** Espacios que no ofrecen dónde cortar la línea: duro, fino, y el de tabular cifras. */
const ESPACIOS_DUROS = /[   ]/g

/**
 * Deja el texto tal cual —saltos de línea incluidos— pero con espacios por los que sí se puede
 * cortar. Perder el "no cortes aquí" de un espacio duro cuesta mucho menos que un párrafo
 * ilegible.
 */
export function textoLegible(valor: string | null | undefined): string {
  if (!valor) return ''
  return valor.replace(ESPACIOS_DUROS, ' ')
}
