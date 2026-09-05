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
import api from '../../../lib/api'
import { AulaShell } from '../ui/AulaShell'
import type { Vista } from '../ui/destinations'
import { ActivityCard } from '../ui/ActivityCard'
import { EmptyState } from '../ui/EmptyState'
import { Hoy } from '../views/Hoy'
import { Actividades } from '../views/Actividades'
import { ActividadDetalle } from '../views/ActividadDetalle'
import { Unidades } from '../views/Unidades'
import { Notas } from '../views/Notas'
import { Estudiantes } from '../views/Estudiantes'
import { LiveSessionBanner } from '../ui/LiveSessionBanner'
import type { LiveSessionLike } from '../model/liveSession'
import type { ActivityLike } from '../model/activityState'
import type { AnnouncementLike } from '../model/today'

const AHORA = new Date('2026-05-20T15:00:00.000Z')

/**
 * Respuestas simuladas para la demo. Se sustituye el adaptador de axios (la misma técnica que
 * usa `lib/api.interceptor.test.ts`), así que **nada sale de esta pestaña**. Vive solo en este
 * archivo, que no entra al build de producción.
 *
 * Sirve para poder revisar el asistente de copia, que sin datos no enseña lo importante: el
 * período de cada unidad destino y el aviso cuando una unidad no tiene ninguno.
 */
api.defaults.adapter = async (config) => {
  const url = config.url ?? ''
  const responder = (data: unknown) =>
    ({ data, status: 200, statusText: 'OK', headers: {}, config }) as never

  if (config.method === 'get' && /^\/classrooms$/.test(url)) {
    return responder([
      { id: 'a1', title: 'Matemáticas 8-A', teacherAssignment: { subject: { name: 'Matemáticas' }, group: { name: '8-A' } } },
      { id: 'a2', title: 'Matemáticas 8-B', teacherAssignment: { subject: { name: 'Matemáticas' }, group: { name: '8-B' } } },
    ])
  }
  if (config.method === 'get' && /^\/classrooms\/[^/]+$/.test(url)) {
    return responder({
      id: url.split('/')[2],
      sections: [
        { id: 'u3', title: 'Unidad 3: Álgebra básica', academicTermId: 'p2' },
        { id: 'u4', title: 'Unidad 4: Geometría y medida', academicTermId: 'p2' },
        // La que dispara el aviso del defecto P0-1.
        { id: 'uSin', title: 'Unidad suelta (sin período)', academicTermId: null },
      ],
      academicPeriods: [
        { id: 'p1', name: 'Período 1' },
        { id: 'p2', name: 'Período 2' },
        { id: 'p3', name: 'Período 3' },
      ],
    })
  }
  if (config.method === 'put' && /update|sections/.test(url)) return responder({ ok: true })
  if (config.method === 'post' && /duplicate-to/.test(url)) return responder({ id: 'copia-1' })
  if (/my-grades/.test(url)) {
    return responder({
      submissions: [
        { score: 4.3, activity: { maxScore: 5 } },
        { score: 3.6, activity: { maxScore: 5 } },
      ],
      pending: [],
    })
  }
  if (/\/students$/.test(url)) {
    return responder([
      { student: { id: '1', firstName: 'Ana', lastName: 'Martínez', secondLastName: 'Ruiz', email: 'ana@colegio.edu.co' } },
      { student: { id: '2', firstName: 'Carlos', lastName: 'Gómez', email: 'carlos@colegio.edu.co' } },
      { student: { id: '3', firstName: 'Beatriz', lastName: 'Álvarez', secondLastName: 'Peña' } },
      { student: { id: '4', firstName: 'Daniel', lastName: 'Gómez', secondLastName: 'Ariza' } },
    ])
  }

  return responder(null)
}

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

const SECCIONES = [
  {
    id: 'u3',
    title: 'Unidad 3: Álgebra básica',
    academicTermId: 'p2',
    materials: [
      { id: 'm1', type: 'VIDEO_YOUTUBE', title: 'Qué es una ecuación (video de 8 min)' },
      { id: 'm2', type: 'DOCUMENT', title: 'Guía de ejercicios resueltos.pdf', fileUrl: '#' },
      { id: 'm3', type: 'TEXT', title: 'Resumen: pasar del lenguaje natural al algebraico' },
      { id: 'm4', type: 'LINK', title: 'Simulador de balanzas (borrador)', isVisible: false },
    ],
  },
  {
    id: 'u4',
    title: 'Unidad 4: Geometría y medida',
    academicTermId: 'p2',
    materials: [{ id: 'm5', type: 'IMAGE', title: 'Mapa de fórmulas de áreas' }],
  },
  {
    id: 'u5',
    title: 'Unidad 5: Estadística (en preparación)',
    academicTermId: 'p2',
    isVisible: false,
    materials: [],
  },
]

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
  {
    id: '4',
    type: 'EXAM',
    title: 'Examen del período',
    isPublished: false,
    scheduledPublishAt: '2026-05-29T13:00:00.000Z',
    section: UNIDAD,
    maxScore: 5,
    _count: { submissions: 0 },
  },
  {
    id: '5',
    type: 'TASK',
    title: 'Taller de áreas y perímetros',
    isPublished: false,
    section: UNIDAD,
    _count: { submissions: 0 },
  },
  {
    id: '6',
    type: 'ICFES_SIMULATOR',
    title: 'Simulacro ICFES · razonamiento cuantitativo',
    isPublished: true,
    section: UNIDAD,
    dueDate: '2026-06-18T22:00:00.000Z',
    _count: { submissions: 0 },
    ...({ studentCount: 32 } as object),
  },
  {
    id: '7',
    type: 'TASK',
    title: 'Ensayo sobre modelos matemáticos',
    isPublished: true,
    section: UNIDAD,
    dueDate: '2026-05-12T22:00:00.000Z',
    maxScore: 5,
    submissions: [{ status: 'GRADED', score: 4.3, submittedAt: '2026-05-11T20:00:00.000Z' }],
    _count: { submissions: 31 },
    ...({ studentCount: 32 } as object),
  },
  {
    id: '8',
    type: 'QUIZ',
    title: 'Quiz de factorización',
    isPublished: true,
    section: UNIDAD,
    dueDate: '2026-05-08T22:00:00.000Z',
    maxScore: 5,
    submissions: [{ status: 'GRADED', score: 3.6, submittedAt: '2026-05-07T20:00:00.000Z' }],
    _count: { submissions: 29 },
    ...({ studentCount: 32 } as object),
  },
  {
    id: '9',
    type: 'TASK',
    title: 'Taller desierto de la semana pasada',
    isPublished: true,
    section: UNIDAD,
    dueDate: '2026-05-13T22:00:00.000Z',
    _count: { submissions: 0 },
    ...({ studentCount: 32 } as object),
  },
]

const ANUNCIOS: AnnouncementLike[] = [
  {
    id: 'an1',
    title: 'Recuerden traer calculadora el jueves',
    content: '<p>Para el taller de <strong>ecuaciones</strong> vamos a necesitar calculadora científica.</p>',
    isPinned: true,
    createdAt: '2026-05-14T13:00:00.000Z',
    author: { firstName: 'Luis', lastName: 'Cárdenas' },
  },
  {
    id: 'an2',
    title: 'Cambio de fecha del examen',
    content: '<p>El examen del período se corre para el viernes 29 de mayo.</p>',
    isPinned: false,
    createdAt: '2026-05-19T15:30:00.000Z',
    author: { firstName: 'Luis', lastName: 'Cárdenas' },
  },
  {
    id: 'an3',
    title: 'Resultados del simulacro anterior',
    content: '<p>Ya pueden ver sus resultados en la pestaña de notas.</p>',
    isPinned: false,
    createdAt: '2026-05-05T10:00:00.000Z',
    author: { firstName: 'Luis', lastName: 'Cárdenas' },
  },
]

function Demo() {
  const [role, setRole] = useState<'docente' | 'estudiante'>('estudiante')
  const [vista, setVista] = useState<Vista>('hoy')
  const [periodo, setPeriodo] = useState('todos')
  const [aulaIdx, setAulaIdx] = useState(0)
  const [sesion, setSesion] = useState<'ninguna' | 'en-vivo' | 'en-casa'>('ninguna')
  const [unidadAbierta, setUnidadAbierta] = useState<string | null>(null)
  const aula = AULAS[aulaIdx]

  const sesionActiva: LiveSessionLike | null =
    sesion === 'ninguna'
      ? null
      : {
          id: 'sesion-1',
          activityId: '2',
          status: 'ACTIVE',
          deliveryMode: sesion === 'en-casa' ? 'ASYNC_HOME' : 'SYNC',
          activity: { title: 'Quiz de proporciones' },
        }

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
        <button
          onClick={() =>
            setSesion((s) => (s === 'ninguna' ? 'en-vivo' : s === 'en-vivo' ? 'en-casa' : 'ninguna'))
          }
          className="rounded-lg border border-hairline bg-surface-1 px-3 py-1.5 font-medium text-ink-primary"
        >
          Sesión: {sesion}
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
        aviso={
          sesionActiva ? (
            <LiveSessionBanner
              session={sesionActiva}
              role={role}
              onEntrar={() => alert('Abrir la sesión de quiz')}
            />
          ) : undefined
        }
      >
        {vista === 'hoy' ? (
          <Hoy
            role={role}
            nombre={role === 'docente' ? 'profe Luis' : 'Ana'}
            aulaTitulo={`${aula.asignatura} ${aula.grupo}`}
            periodoNombre="Período 2"
            estudiantes={32}
            actividades={MUESTRA}
            anuncios={ANUNCIOS}
            onAbrirActividad={(id) => alert(`Abrir actividad ${id}`)}
            onVerActividades={(f) => alert(`Ir a Actividades${f ? ` filtrando por ${f}` : ''}`)}
            onCrear={(t) => alert(`Crear ${t}`)}
            onValeria={() => alert('Abrir Valeria')}
            now={AHORA}
          />
        ) : vista === 'unidades' ? (
          <Unidades
            aulaId={aula.id}
            role={role}
            secciones={SECCIONES}
            actividades={MUESTRA}
            periodo={periodo}
            asignatura={aula.asignatura}
            unidadAbierta={unidadAbierta}
            onAbrirUnidad={setUnidadAbierta}
            onAbrirActividad={(id) => alert(`Abrir actividad ${id}`)}
            onAbrirMaterial={(m) => alert(`Abrir material "${m.title}"`)}
            onCrear={() => alert('Crear unidad')}
            now={AHORA}
          />
        ) : vista === 'rutas' ? (
          // Se aprovecha este destino para revisar el detalle sin backend.
          <ActividadDetalle
            actividad={MUESTRA[0]}
            rol={role}
            miEntrega={
              role === 'estudiante'
                ? {
                    id: 'e1',
                    activityId: MUESTRA[0].id,
                    status: 'SUBMITTED',
                    content: 'Adjunto el desarrollo de los cinco ejercicios.',
                    submittedAt: '2026-05-19T20:00:00.000Z',
                  }
                : null
            }
            entregas={
              role === 'docente'
                ? [
                    {
                      id: 'e1',
                      activityId: MUESTRA[0].id,
                      status: 'SUBMITTED',
                      content: 'Adjunto el desarrollo de los cinco ejercicios.',
                      submittedAt: '2026-05-19T20:00:00.000Z',
                      studentEnrollment: { student: { id: '1', firstName: 'Ana', lastName: 'Martínez' } },
                    },
                    {
                      id: 'e2',
                      activityId: MUESTRA[0].id,
                      status: 'GRADED',
                      score: 4.2,
                      feedback: 'Buen procedimiento; revisa el signo del ejercicio 3.',
                      submittedAt: '2026-05-18T14:00:00.000Z',
                      studentEnrollment: { student: { id: '2', firstName: 'Carlos', lastName: 'Ruiz' } },
                    },
                    {
                      id: 'e3',
                      activityId: MUESTRA[0].id,
                      status: 'LATE',
                      content: 'Perdón profe, se me pasó la fecha.',
                      submittedAt: '2026-05-20T11:00:00.000Z',
                      studentEnrollment: { student: { id: '3', firstName: 'Laura', lastName: 'Gómez' } },
                    },
                  ]
                : []
            }
            onVolver={() => setVista('actividades')}
            onCambio={() => alert('Recargar')}
            onIrAlAulaActual={() => alert('Ir al aula actual')}
            aulaId={aula.id}
            onAbrirActividad={(id) => alert(`Abrir la copia ${id}`)}
            now={AHORA}
          />
        ) : vista === 'notas' ? (
          <Notas
            classroomId={aula.id}
            role={role}
            actividades={MUESTRA}
            onAbrirActividad={(id) => alert(`Abrir actividad ${id}`)}
            now={AHORA}
          />
        ) : vista === 'estudiantes' ? (
          <Estudiantes classroomId={aula.id} />
        ) : vista === 'actividades' ? (
          <Actividades
            role={role}
            actividades={MUESTRA}
            periodo={periodo}
            onPeriodo={setPeriodo}
            onAbrirActividad={(id) => alert(`Abrir actividad ${id}`)}
            onCrear={() => alert('Crear actividad')}
            now={AHORA}
          />
        ) : (
          <div className="mx-auto max-w-3xl">
            <EmptyState
              scene="sin-actividades"
              title={`Aquí va "${vista}"`}
              detail="Esta vista todavía no está construida; el armazón ya la sostiene."
            />
          </div>
        )}
      </AulaShell>
    </>
  )
}

createRoot(document.getElementById('shell')!).render(<Demo />)
