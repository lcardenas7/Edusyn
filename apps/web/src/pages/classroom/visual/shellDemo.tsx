/**
 * Demostración del armazón del aula — **solo desarrollo**.
 *
 * Se sirve en `/shell-aula.html` con `npm run dev`. Permite probar el riel colapsable, las
 * migas de pan, el selector de período y la barra inferior de móvil sin backend, cambiando de
 * rol y de asignatura para ver cómo se tiñe el acento.
 */

import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../index.css'
import { AulaShell } from '../ui/AulaShell'
import type { Vista } from '../ui/destinations'
import { ActivityCard } from '../ui/ActivityCard'
import { EmptyState } from '../ui/EmptyState'
import { decorate } from '../model/list'
import { isVisibleTo, type ActivityLike } from '../model/activityState'

const AHORA = new Date('2026-05-20T15:00:00.000Z')

const AULAS = [
  { id: 'a1', titulo: 'Matemáticas 8-A', asignatura: 'Matemáticas', grupo: '8-A' },
  { id: 'a2', titulo: 'Ciencias Naturales 8-A', asignatura: 'Ciencias Naturales', grupo: '8-A' },
  { id: 'a3', titulo: 'Lengua Castellana 8-A', asignatura: 'Lengua Castellana', grupo: '8-A' },
  { id: 'a4', titulo: 'Inglés 8-A', asignatura: 'Inglés', grupo: '8-A' },
]

const PERIODOS = [
  { id: 'p1', name: 'Período 1' },
  { id: 'p2', name: 'Período 2', activo: true },
  { id: 'p3', name: 'Período 3' },
]

const UNIDAD = { id: 'u3', title: 'Unidad 3: Álgebra básica', academicTermId: 'p2' }

const MUESTRA: ActivityLike[] = [
  {
    id: '1',
    type: 'TASK',
    title: 'Taller de ecuaciones lineales',
    isPublished: true,
    section: UNIDAD,
    dueDate: '2026-05-20T22:00:00.000Z',
    maxScore: 5,
    gradingPending: 6,
    _count: { submissions: 18 },
    ...({ studentCount: 32 } as object),
  },
  {
    id: '2',
    type: 'QUIZ',
    title: 'Quiz de proporciones',
    isPublished: true,
    section: UNIDAD,
    dueDate: '2026-05-17T22:00:00.000Z',
    metadata: { maxAttempts: 3 },
    submissions: [{ status: 'DRAFT', attemptNumber: 2 }],
    _count: { submissions: 24 },
    ...({ studentCount: 32 } as object),
  },
  {
    id: '3',
    type: 'LESSON',
    title: 'Lección: del lenguaje natural al algebraico',
    isPublished: true,
    section: UNIDAD,
    submissions: [{ status: 'RETURNED' }],
    _count: { submissions: 30 },
    ...({ studentCount: 32 } as object),
  },
]

function Demo() {
  const [role, setRole] = useState<'docente' | 'estudiante'>('estudiante')
  const [vista, setVista] = useState<Vista>('hoy')
  const [periodo, setPeriodo] = useState('todos')
  const [aulaIdx, setAulaIdx] = useState(0)
  const aula = AULAS[aulaIdx]

  const visibles = MUESTRA.filter((a) => isVisibleTo(role, a))

  return (
    <>
      {/* Barra de pruebas: no forma parte del aula */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-2 px-4 py-2 text-body-sm">
        <span className="font-semibold text-ink-primary">Demo del armazón</span>
        <button
          onClick={() => setRole(role === 'docente' ? 'estudiante' : 'docente')}
          className="rounded-lg border border-hairline bg-surface-1 px-3 py-1.5 font-medium text-ink-primary"
        >
          Rol: {role}
        </button>
        <button
          onClick={() => setAulaIdx((i) => (i + 1) % AULAS.length)}
          className="rounded-lg border border-hairline bg-surface-1 px-3 py-1.5 font-medium text-ink-primary"
        >
          Aula: {aula.asignatura}
        </button>
        <span className="text-ink-muted">
          Achica la ventana por debajo de 1024 px para ver la barra inferior.
        </span>
      </div>

      <AulaShell
        aula={aula}
        role={role}
        vista={vista}
        onNavegar={setVista}
        onSalir={() => alert('Volver a la lista de aulas')}
        periodos={PERIODOS}
        periodo={periodo}
        onPeriodo={setPeriodo}
        badges={role === 'docente' ? { actividades: 6 } : { actividades: 2 }}
      >
        <div className="mx-auto max-w-3xl">
          <h1 className="text-h1 font-bold text-ink-primary">
            {vista === 'hoy' ? (role === 'docente' ? 'Hola, profe 👋' : 'Hola, Ana 👋') : null}
          </h1>

          {vista === 'actividades' || vista === 'hoy' ? (
            <div className="mt-4 space-y-2">
              {visibles.map((a) => (
                <ActivityCard
                  key={a.id}
                  item={decorate(a, role, AHORA)}
                  role={role}
                  onOpen={() => {}}
                  now={AHORA}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                scene="sin-actividades"
                title={`Aquí va "${vista}"`}
                detail="Esta vista todavía no está construida; el armazón ya la sostiene."
              />
            </div>
          )}

          {/* Relleno para poder comprobar que el encabezado se queda pegado al hacer scroll */}
          <div className="mt-6 space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-card border border-hairline bg-surface-1 p-6 text-ink-muted">
                Contenido de relleno {i + 1} — comprueba que el encabezado de contexto se queda
                fijo arriba y no se esconde debajo del header.
              </div>
            ))}
          </div>
        </div>
      </AulaShell>
    </>
  )
}

createRoot(document.getElementById('shell')!).render(<Demo />)
