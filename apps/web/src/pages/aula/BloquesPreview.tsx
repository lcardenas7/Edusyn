import { Link, useParams } from 'react-router-dom'

/** Pantalla de revisión accesible desde Actividades, sin crear una actividad evaluable. */
export default function BloquesPreview() {
  const { classroomId } = useParams<{ classroomId: string }>()

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#e9ede3]">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#cdd9c1] bg-white px-3 sm:px-5">
        <Link to={`/aula/${classroomId}/actividades`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-[#285e4d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#285e4d]">
          ← Volver a Actividades
        </Link>
        <span className="truncate text-xs font-medium text-[#5d6d65] sm:text-sm">Bloques · El bosque de Lía</span>
      </header>
      <iframe
        title="Maqueta interactiva del laberinto de bloques"
        src="/bloques-laberinto.html"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  )
}
