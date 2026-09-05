/**
 * Banco de pruebas del aula REAL — **solo desarrollo**.
 *
 * Se sirve en `/aula-local.html` con `npm run dev` y no entra al build de producción.
 *
 * Para qué sirve, y en qué se diferencia de `/shell-aula.html`: aquella demo monta las vistas
 * a mano con datos ya cocinados. Esta monta el módulo **entero y sin tocar** —el enrutado de
 * `index.tsx`, los hooks `useAula`/`useActividad`/`useLiveSession`, la normalización del
 * payload— contra un backend simulado. Es la única forma de ejercitar ese cableado sin una
 * sesión real, porque las rutas `/aula/*` están protegidas.
 *
 * Cómo funciona el simulacro: se sustituye el adaptador de axios (misma técnica que
 * `lib/api.interceptor.test.ts`), así que **ninguna petición sale de la pestaña**, y se deja
 * un token de mentira en `localStorage` para que `AuthProvider` crea que hay sesión.
 *
 * Las respuestas imitan la forma real del backend, incluidos los detalles que rompen cosas:
 * la asignatura y el grupo anidados en `teacherAssignment`, una actividad sin período (la que
 * produce el defecto P0-1) y una unidad oculta.
 */

import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import '../../../index.css'
import api from '../../../lib/api'
import { AuthProvider } from '../../../contexts/AuthContext'
import { DialogHost } from '../../../components/ui/confirm'
import AulaVirtual from '../index'

// ─── Sesión de mentira ───────────────────────────────────────────────────────

const ROLES = {
  docente: [{ role: { name: 'DOCENTE' } }],
  estudiante: [{ role: { name: 'ESTUDIANTE' } }],
}

let rolActivo: 'docente' | 'estudiante' =
  (localStorage.getItem('demo:rol') as 'docente' | 'estudiante') || 'docente'

localStorage.setItem('token', 'token-de-prueba')

// ─── Backend de mentira ──────────────────────────────────────────────────────

const HOY = new Date()
const enDias = (d: number) => new Date(HOY.getTime() + d * 86_400_000).toISOString()

const UNIDADES = [
  { id: 'u3', title: 'Unidad 3: Álgebra básica', isVisible: true, academicTermId: 'p2', sortOrder: 1 },
  { id: 'u4', title: 'Unidad 4: Geometría y medida', isVisible: true, academicTermId: 'p2', sortOrder: 2 },
  { id: 'u5', title: 'Unidad 5: Estadística (en preparación)', isVisible: false, academicTermId: 'p2', sortOrder: 3 },
  // Sin período: es la que dispara el aviso del asistente de copia (defecto P0-1).
  { id: 'uSuelta', title: 'Material suelto', isVisible: true, academicTermId: null, sortOrder: 4 },
]

const MATERIALES: Record<string, any[]> = {
  u3: [
    { id: 'm1', type: 'VIDEO_YOUTUBE', title: 'Qué es una ecuación', isVisible: true, content: 'https://youtu.be/x' },
    { id: 'm2', type: 'DOCUMENT', title: 'Guía de ejercicios resueltos.pdf', isVisible: true, fileUrl: '#' },
    { id: 'm3', type: 'TEXT', title: 'Del lenguaje natural al algebraico', isVisible: true, content: 'Resumen' },
    { id: 'm4', type: 'LINK', title: 'Simulador de balanzas (borrador)', isVisible: false, fileUrl: '#' },
  ],
  u4: [{ id: 'm5', type: 'IMAGE', title: 'Mapa de fórmulas de áreas', isVisible: true, fileUrl: '#' }],
  u5: [],
  uSuelta: [],
}

const secc = (id: string) => {
  const u = UNIDADES.find((x) => x.id === id)!
  return { id: u.id, title: u.title, academicTermId: u.academicTermId }
}

function actividades(rol: 'docente' | 'estudiante') {
  const base = [
    {
      id: 'act-1',
      classroomId: 'aula-1',
      sectionId: 'u3',
      section: secc('u3'),
      type: 'TASK',
      title: 'Taller de ecuaciones lineales',
      description: '<p>Resuelve los cinco ejercicios de la guía y sube tu procedimiento.</p>',
      maxScore: 5,
      dueDate: enDias(0),
      isVisible: true,
      isPublished: true,
      publishedAt: enDias(-8),
      allowLateSubmit: true,
      createdAt: enDias(-9),
      updatedAt: enDias(-8),
      academicTermId: 'p2',
      gradingPending: rol === 'docente' ? 6 : undefined,
      _count: { submissions: 18 },
      studentCount: 32,
      submissions: rol === 'estudiante' ? [{ status: 'DRAFT', attemptNumber: 1 }] : undefined,
    },
    {
      id: 'act-2',
      classroomId: 'aula-1',
      sectionId: 'u3',
      section: secc('u3'),
      type: 'QUIZ',
      title: 'Quiz de proporciones',
      maxScore: 5,
      dueDate: enDias(-3),
      isVisible: true,
      isPublished: true,
      publishedAt: enDias(-10),
      createdAt: enDias(-11),
      updatedAt: enDias(-10),
      academicTermId: 'p2',
      metadata: { maxAttempts: 3 },
      _count: { submissions: 24 },
      studentCount: 32,
      submissions: rol === 'estudiante' ? [{ status: 'GRADED', score: 4.2, submittedAt: enDias(-4) }] : undefined,
    },
    {
      id: 'act-3',
      classroomId: 'aula-1',
      sectionId: 'u3',
      section: secc('u3'),
      type: 'LESSON',
      title: 'Lección: del lenguaje natural al algebraico',
      isVisible: true,
      isPublished: true,
      publishedAt: enDias(-6),
      createdAt: enDias(-7),
      updatedAt: enDias(-6),
      academicTermId: 'p2',
      _count: { submissions: 30 },
      studentCount: 32,
      submissions: rol === 'estudiante' ? [{ status: 'RETURNED' }] : undefined,
    },
    {
      id: 'act-4',
      classroomId: 'aula-1',
      sectionId: 'u4',
      section: secc('u4'),
      type: 'EXAM',
      title: 'Examen del período',
      maxScore: 5,
      isVisible: true,
      isPublished: false,
      scheduledPublishAt: enDias(9),
      createdAt: enDias(-2),
      updatedAt: enDias(-2),
      academicTermId: 'p2',
      _count: { submissions: 0 },
    },
    {
      id: 'act-5',
      classroomId: 'aula-1',
      sectionId: 'u4',
      section: secc('u4'),
      type: 'ICFES_SIMULATOR',
      title: 'Simulacro ICFES · razonamiento cuantitativo',
      isVisible: true,
      isPublished: true,
      publishedAt: enDias(-1),
      openDate: enDias(6),
      dueDate: enDias(12),
      createdAt: enDias(-1),
      updatedAt: enDias(-1),
      academicTermId: 'p2',
      _count: { submissions: 0 },
      studentCount: 32,
    },
    {
      id: 'act-6',
      classroomId: 'aula-1',
      sectionId: 'u4',
      section: secc('u4'),
      type: 'TASK',
      title: 'Taller que nadie entregó',
      maxScore: 5,
      dueDate: enDias(-6),
      isVisible: true,
      isPublished: true,
      publishedAt: enDias(-12),
      createdAt: enDias(-12),
      updatedAt: enDias(-12),
      academicTermId: 'p2',
      _count: { submissions: 0 },
      studentCount: 32,
      submissions: rol === 'estudiante' ? [] : undefined,
    },
  ]
  // El estudiante no recibe los borradores, igual que en el backend real.
  return rol === 'estudiante' ? base.filter((a) => a.isPublished) : base
}

const ENTREGAS = [
  {
    id: 'e1',
    activityId: 'act-1',
    status: 'SUBMITTED',
    content: 'Adjunto el desarrollo de los cinco ejercicios.',
    submittedAt: enDias(-1),
    studentEnrollment: { student: { id: '1', firstName: 'Ana', lastName: 'Martínez', secondLastName: 'Ruiz' } },
  },
  {
    id: 'e2',
    activityId: 'act-1',
    status: 'GRADED',
    score: 4.2,
    feedback: 'Buen procedimiento; revisa el signo del ejercicio 3.',
    submittedAt: enDias(-2),
    studentEnrollment: { student: { id: '2', firstName: 'Carlos', lastName: 'Gómez' } },
  },
  {
    id: 'e3',
    activityId: 'act-1',
    status: 'LATE',
    content: 'Perdón profe, se me pasó la fecha.',
    submittedAt: enDias(0),
    studentEnrollment: { student: { id: '3', firstName: 'Beatriz', lastName: 'Álvarez', secondLastName: 'Peña' } },
  },
]

const original = api.defaults.adapter
api.defaults.adapter = async (config) => {
  const url = config.url ?? ''
  const metodo = (config.method ?? 'get').toLowerCase()
  const ok = (data: unknown) => ({ data, status: 200, statusText: 'OK', headers: {}, config }) as never
  const log = (que: string) => console.info('[simulacro]', metodo.toUpperCase(), url, '→', que)

  if (url === '/auth/me') {
    return ok({
      id: 'u-1',
      firstName: rolActivo === 'docente' ? 'Luis' : 'Ana',
      lastName: rolActivo === 'docente' ? 'Cárdenas' : 'Martínez',
      email: 'demo@edusyn.local',
      roles: ROLES[rolActivo],
      institution: { id: 'i-1', name: 'Institución de prueba' },
    })
  }

  if (metodo === 'get' && url === '/classrooms') {
    return ok([
      {
        id: 'aula-1',
        title: 'Matemáticas 8-A',
        isActive: true,
        studentCount: 32,
        teacherAssignment: { subject: { name: 'Matemáticas' }, group: { name: '8-A', grade: { name: '8' } } },
        _count: { sections: 4, activities: 6, announcements: 3 },
      },
      {
        id: 'aula-2',
        title: 'Ciencias Naturales 8-A',
        isActive: true,
        studentCount: 32,
        teacherAssignment: { subject: { name: 'Ciencias Naturales' }, group: { name: '8-A', grade: { name: '8' } } },
        _count: { sections: 2, activities: 3, announcements: 1 },
      },
      {
        id: 'aula-3',
        title: 'Matemáticas 7-B (año pasado)',
        isActive: false,
        studentCount: 30,
        teacherAssignment: { subject: { name: 'Matemáticas' }, group: { name: '7-B', grade: { name: '7' } } },
        _count: { sections: 5, activities: 12, announcements: 4 },
      },
    ])
  }

  if (metodo === 'get' && /^\/classrooms\/[^/]+$/.test(url)) {
    const id = url.split('/')[2]
    return ok({
      id,
      title: id === 'aula-2' ? 'Ciencias Naturales 8-A' : 'Matemáticas 8-A',
      studentCount: 32,
      teacherAssignment: {
        subject: { name: id === 'aula-2' ? 'Ciencias Naturales' : 'Matemáticas' },
        group: { name: '8-A', grade: { name: '8' } },
      },
      currentPeriod: { id: 'p2', name: 'Período 2' },
      academicPeriods: [
        { id: 'p1', name: 'Período 1' },
        { id: 'p2', name: 'Período 2' },
        { id: 'p3', name: 'Período 3' },
      ],
      announcements: [
        {
          id: 'an1',
          title: 'Recuerden traer calculadora el jueves',
          content: '<p>Para el taller de <strong>ecuaciones</strong> necesitamos calculadora científica.</p>',
          isPinned: true,
          createdAt: enDias(-6),
          author: { id: 'u-1', firstName: 'Luis', lastName: 'Cárdenas' },
        },
        {
          id: 'an2',
          title: 'Cambio de fecha del examen',
          content: '<p>El examen del período se corre una semana.</p>',
          isPinned: false,
          createdAt: enDias(-1),
          author: { id: 'u-1', firstName: 'Luis', lastName: 'Cárdenas' },
        },
      ],
      sections: UNIDADES.map((u) => ({ ...u, materials: MATERIALES[u.id] ?? [] })),
    })
  }

  if (metodo === 'get' && /\/activities$/.test(url)) {
    const rol = config.params?.role === 'student' ? 'estudiante' : 'docente'
    return ok(actividades(rol))
  }

  if (metodo === 'get' && /\/classrooms\/activities\/[^/]+$/.test(url)) {
    const id = url.split('/').pop()!
    const rol = config.params?.role === 'student' ? 'estudiante' : 'docente'
    return ok(actividades(rol).find((a) => a.id === id) ?? null)
  }

  if (/my-submission/.test(url)) {
    const rol = 'estudiante'
    const id = url.split('/')[3]
    const a = actividades(rol).find((x) => x.id === id)
    const s = (a as any)?.submissions?.[0]
    if (!s) return Promise.reject({ response: { status: 404 } })
    return ok({ id: 'mia', activityId: id, ...s })
  }

  if (/\/submissions$/.test(url) && metodo === 'get') {
    const id = url.split('/')[3]
    return ok(ENTREGAS.filter((e) => e.activityId === id))
  }

  if (/my-grades/.test(url)) {
    return ok({
      submissions: [{ score: 4.2, activity: { maxScore: 5 } }],
      pending: [],
    })
  }

  if (/\/students$/.test(url)) {
    return ok([
      { student: { id: '1', firstName: 'Ana', lastName: 'Martínez', secondLastName: 'Ruiz', email: 'ana@colegio.edu.co' } },
      { student: { id: '2', firstName: 'Carlos', lastName: 'Gómez', email: 'carlos@colegio.edu.co' } },
      { student: { id: '3', firstName: 'Beatriz', lastName: 'Álvarez', secondLastName: 'Peña' } },
      { student: { id: '4', firstName: 'Daniel', lastName: 'Gómez', secondLastName: 'Ariza' } },
    ])
  }

  if (/live-session\/active/.test(url)) return ok(null)

  // Mutaciones: se registran en consola para poder comprobar QUÉ se envía.
  if (metodo !== 'get') {
    log('mutación aceptada · cuerpo: ' + JSON.stringify(config.data ?? null))
    if (/duplicate-to/.test(url)) return ok({ id: 'act-copia' })
    return ok({ ok: true })
  }

  log('sin respuesta simulada')
  return ok(null)
}
void original

// ─── Montaje ─────────────────────────────────────────────────────────────────

function Barra() {
  const navigate = useNavigate()
  const [rol, setRol] = useState(rolActivo)
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-2 px-4 py-2 text-body-sm">
      <span className="font-semibold text-ink-primary">Aula real · backend simulado</span>
      <button
        onClick={() => {
          const nuevo = rol === 'docente' ? 'estudiante' : 'docente'
          localStorage.setItem('demo:rol', nuevo)
          setRol(nuevo)
          rolActivo = nuevo
          window.location.href = '/aula-local.html'
        }}
        className="rounded-lg border border-hairline bg-surface-1 px-3 py-1.5 font-medium text-ink-primary"
      >
        Rol: {rol}
      </button>
      <button
        onClick={() => navigate('/aula')}
        className="rounded-lg border border-hairline bg-surface-1 px-3 py-1.5 font-medium text-ink-primary"
      >
        Ir a /aula
      </button>
      <span className="text-ink-muted">Ninguna petición sale de esta pestaña.</span>
    </div>
  )
}

// MemoryRouter: el enrutado se ejercita igual (useParams, useSearchParams) sin tocar la URL
// del navegador, que en un archivo estático servido por Vite acabaría cargando la app real.
function App() {
  return (
    <MemoryRouter initialEntries={['/aula']}>
      <Barra />
      <Routes>
        <Route path="/aula" element={<AulaVirtual />} />
        <Route path="/aula/:classroomId" element={<AulaVirtual />} />
        <Route path="/aula/:classroomId/:vista" element={<AulaVirtual />} />
        <Route path="/aula/:classroomId/actividades/:activityId" element={<AulaVirtual />} />
        <Route
          path="*"
          element={
            <div className="p-8 text-ink-secondary">
              Aquí saltaría el aula anterior (<code>/classroom</code>). En este banco de pruebas no
              existe: pulsa «Ir a /aula».
            </div>
          }
        />
      </Routes>
      <DialogHost />
    </MemoryRouter>
  )
}

createRoot(document.getElementById('aula')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
)
