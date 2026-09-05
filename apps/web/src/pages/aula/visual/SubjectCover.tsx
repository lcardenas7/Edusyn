/**
 * La portada de un aula: la banda ilustrada que encabeza su tarjeta.
 *
 * Viene de una referencia del fundador —tarjetas de curso con imagen de cabecera— y responde a
 * lo que ha pedido tres veces: que el aula entre por los ojos.
 *
 * Por qué ilustración y no fotografía: Edusyn no tiene biblioteca de imágenes ni forma de
 * subirlas por aula. Fotos de banco se ven bien en una maqueta, pero pesan, envejecen mal y
 * dejarían aulas sin portada. Esto es SVG: no se descarga nada, escala sin pixelarse y **toda**
 * aula tiene la suya.
 *
 * Lo que hace distinta a cada portada: el color del aula (el que eligió el docente) y el glifo
 * de la asignatura. Un docente con once aulas de Informática las distingue por color; uno con
 * cinco asignaturas, por dibujo.
 */

import { SubjectMark, SubjectPattern, subjectIdentity, type SubjectHue } from './SubjectMark'

export function SubjectCover({
  subject,
  color,
  alto = 104,
  className = '',
}: {
  subject: string | null | undefined
  /** Color del aula. Si falta, se usa el de la asignatura. */
  color?: string | null
  alto?: number
  className?: string
}) {
  const identidad = subjectIdentity(subject)
  const tinte = color?.trim() || identidad.hue.ink
  const hue: SubjectHue = { ink: tinte, wash: `${tinte}1A`, deep: tinte }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        height: alto,
        // Degradado suave del color del aula: da profundidad sin competir con el contenido.
        backgroundImage: `linear-gradient(135deg, ${tinte}26 0%, ${tinte}0F 55%, ${tinte}08 100%)`,
      }}
      aria-hidden="true"
    >
      <SubjectPattern subject={subject} hue={hue} opacity={0.1} />

      {/* Formas de fondo: dan sensación de escena sin dibujar una escena distinta por materia */}
      <svg className="absolute inset-0 h-full w-full" style={{ color: tinte }} focusable="false">
        <circle cx="14%" cy="118%" r="70" fill="currentColor" opacity="0.08" />
        <circle cx="88%" cy="-25%" r="52" fill="currentColor" opacity="0.07" />
      </svg>

      {/* El glifo grande, desplazado: es la "foto" de la tarjeta */}
      <span className="absolute -right-3 -bottom-3 opacity-[0.22]">
        <SubjectMark subject={subject} size={alto + 16} variant="bare" hue={hue} />
      </span>

      {/* El glifo nítido, a escala legible */}
      <span className="absolute bottom-3 left-4">
        <SubjectMark subject={subject} size={44} hue={hue} />
      </span>
    </div>
  )
}
