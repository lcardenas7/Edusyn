/**
 * Aula Virtual rediseñada — punto de entrada del módulo.
 *
 * Corrige P1-7: hoy el aula y la pestaña abierta viven solo en `useState`, así que refrescar
 * la página devuelve a la lista de aulas, el botón "atrás" del navegador no funciona dentro
 * del aula y es imposible mandarle a alguien el enlace de una actividad.
 *
 * Rutas:
 *   /aula                                   lista de aulas
 *   /aula/:classroomId                      redirige a /hoy
 *   /aula/:classroomId/:vista               hoy · unidades · actividades · rutas · …
 *   /aula/:classroomId/actividades/:id      una actividad concreta
 *
 * Convive con el aula actual (`/classroom`), que queda intacta como respaldo (decisión D4 y
 * garantía G3: cambiar entre una y otra no escribe nada en el servidor).
 */

import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { alertDialog } from '../../components/ui/confirm'
import { AulaShell } from './ui/AulaShell'
import { AulaState, EmptyState } from './ui/EmptyState'
import { LiveSessionBanner } from './ui/LiveSessionBanner'
import { DESTINOS, vistaLabel, type Vista } from './ui/destinations'
import { SelectorAula } from './views/SelectorAula'
import { Hoy } from './views/Hoy'
import { Actividades } from './views/Actividades'
import { ActividadDetalle } from './views/ActividadDetalle'
import { Unidades } from './views/Unidades'
import { Notas } from './views/Notas'
import { Estudiantes } from './views/Estudiantes'
import { CrearActividad } from './ui/CrearActividad'
import { useAula, useAulas, type Rol } from './data/useAula'
import { useActividad } from './data/useActividad'
import { useLiveSession } from './data/useLiveSession'
import { useProgresoAulas } from './data/useProgresoAulas'
import { buildTeacherToday, buildStudentToday } from './model/today'
import { PERIOD_ALL } from './model/list'

const LessonEditor = lazy(() => import('../../components/LessonEditor'))
// Rutas y Expedición ya son componentes propios y reutilizables: se montan en el shell nuevo
// sin tocarlos. El Foro todavía vive dentro de Classroom.tsx y por eso sigue con puente.
const LearningRoutesTab = lazy(() => import('../../components/LearningRoutesTab'))
const AbpTab = lazy(() => import('../../components/AbpTab'))

const VISTAS = new Set(DESTINOS.map((d) => d.id))

/**
 * El detalle carga sus propios datos (la actividad completa y sus entregas), que la lista no
 * trae. Va aparte para que su estado de carga y de error no arrastre a todo el aula.
 */
function DetalleCargado({
  activityId,
  aulaId,
  rol,
  totalEstudiantes,
  onVolver,
  onIrAlAulaActual,
  onAbrirActividad,
  onEditarLeccion,
}: {
  activityId: string
  aulaId: string
  rol: Rol
  totalEstudiantes?: number | null
  onEditarLeccion: (a: { id: string; title: string; gameType?: string }) => void
  onVolver: () => void
  onIrAlAulaActual: () => void
  onAbrirActividad: (id: string) => void
}) {
  const { actividad, miEntrega, entregas, cargando, error, recargar } = useActividad(activityId, rol)

  return (
    <AulaState
      loading={cargando}
      error={error}
      onRetry={recargar}
      isEmpty={!actividad}
      empty={
        <div className="mx-auto max-w-3xl">
          <EmptyState
            scene="sin-resultados"
            title="No encontramos esta actividad"
            detail="Puede que se haya eliminado o que ya no esté disponible para ti."
            action={{ label: 'Volver a la lista', onClick: onVolver }}
          />
        </div>
      }
    >
      {actividad && (
        <ActividadDetalle
          actividad={actividad}
          rol={rol}
          miEntrega={miEntrega}
          entregas={entregas}
          onVolver={onVolver}
          onCambio={recargar}
          onIrAlAulaActual={onIrAlAulaActual}
          aulaId={aulaId}
          totalEstudiantes={totalEstudiantes}
          onAbrirActividad={onAbrirActividad}
          onEditarLeccion={() =>
            onEditarLeccion({
              id: actividad.id,
              title: actividad.title,
              gameType: actividad.metadata?.gameType,
            })
          }
        />
      )}
    </AulaState>
  )
}

function esVista(v: string | undefined): v is Vista {
  return !!v && VISTAS.has(v as Vista)
}

export default function AulaVirtual() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { classroomId, vista: vistaParam, activityId } = useParams()
  const [params, setParams] = useSearchParams()
  const [creando, setCreando] = useState(false)
  // El editor de lecciones y juegos SÍ es reutilizable, así que se abre aquí mismo en vez de
  // mandar al aula anterior.
  const [editandoLeccion, setEditandoLeccion] = useState<{ id: string; title: string; gameType?: string } | null>(null)

  const rol: Rol = useMemo(() => {
    const roles: any[] = user?.roles ?? []
    const nombres = roles.map((r) => r.role?.name ?? r.roleName ?? '')
    return nombres.some((n) => ['DOCENTE', 'COORDINADOR'].includes(n)) ? 'docente' : 'estudiante'
  }, [user])

  const nombre = user?.firstName || (rol === 'docente' ? 'profe' : 'estudiante')

  // ─── Sin aula: la lista ────────────────────────────────────────────────
  const listado = useAulas(rol)
  // El avance de cada aula llega en segundo plano: la lista se pinta enseguida.
  const avances = useProgresoAulas(
    classroomId ? [] : listado.aulas.map((a) => a.id),
    rol,
  )

  // ─── Con aula: sus datos ───────────────────────────────────────────────
  const { aula, actividades, cargando, error, recargar } = useAula(classroomId ?? null, rol)
  const { session } = useLiveSession(classroomId ?? null)

  // La ruta del detalle (`/aula/:id/actividades/:activityId`) no lleva `:vista`, así que sin
  // esto el aula se creía en "Hoy" mientras mostraba una actividad: las migas de pan y el
  // destino resaltado mentían sobre dónde estás. Salió al recorrer el aula en el navegador.
  const vista: Vista = activityId ? 'actividades' : esVista(vistaParam) ? vistaParam : 'hoy'
  /*
   * El período vive en la URL para que un enlace lleve a lo mismo que veía quien lo mandó.
   *
   * Sin parámetro se arranca en el período EN CURSO, no en "Todos": probando con un aula real
   * de 26 actividades repartidas en cuatro períodos, "Todos" mezclaba trabajo que venció hace
   * noventa días con el de esta semana. El aula actual también arranca en un período.
   * Elegir "Todos" sí se escribe en la URL, así que la elección del usuario manda.
   */
  const periodo = params.get('periodo') ?? aula?.periodoActual?.id ?? PERIOD_ALL
  const filtroEstado = params.get('estado')

  const irA = useCallback(
    (v: Vista) => {
      if (!classroomId) return
      // Cambiar de destino limpia el filtro de estado: venía de otro contexto.
      // Se arrastra el período tal cual estaba, incluido "todos": cambiar de destino no debe
      // deshacer la elección del usuario.
      const elegido = params.get('periodo')
      const q = elegido ? `?periodo=${encodeURIComponent(elegido)}` : ''
      navigate(`/aula/${classroomId}/${v}${q}`)
    },
    [classroomId, navigate, params],
  )

  const cambiarPeriodo = useCallback(
    (p: string) => {
      // Se escribe siempre, incluido "todos": si se borrara el parámetro, la vista volvería
      // sola al período en curso y parecería que el selector no funciona.
      const next = new URLSearchParams(params)
      next.set('periodo', p)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const abrirActividad = useCallback(
    (id: string) => {
      if (!classroomId) return
      navigate(`/aula/${classroomId}/actividades/${id}`)
    },
    [classroomId, navigate],
  )

  /**
   * Puente al aula actual para lo que todavía no se ha traído. Se avisa ANTES de saltar: un
   * botón que te cambia de aula sin decírtelo se siente como un error de la aplicación.
   */
  const irAlAulaActualPara = useCallback(
    async (que: 'crear' | 'valeria' | 'editar') => {
      const textos: Record<typeof que, string> = {
        crear: 'Crear actividades todavía se hace en el aula de siempre. Te llevamos allí; abre esta misma aula y usa "Nueva Actividad". Lo que crees aparecerá también aquí.',
        valeria: 'Pedirle contenido a Valeria todavía se hace en el aula de siempre. Te llevamos allí.',
        editar: 'Editar una actividad todavía se hace en el aula de siempre. Te llevamos allí.',
      }
      await alertDialog(textos[que], { title: 'Esto aún vive en el aula anterior' })
      navigate('/classroom')
    },
    [navigate],
  )

  const verActividades = useCallback(
    (estado?: string) => {
      if (!classroomId) return
      const q = new URLSearchParams()
      if (periodo !== PERIOD_ALL) q.set('periodo', periodo)
      if (estado) q.set('estado', estado)
      const s = q.toString()
      navigate(`/aula/${classroomId}/actividades${s ? `?${s}` : ''}`)
    },
    [classroomId, navigate, periodo],
  )

  if (!classroomId) {
    return (
      <SelectorAula
        nombre={nombre}
        role={rol}
        aulas={listado.aulas}
        cargando={listado.cargando}
        error={listado.error}
        onReintentar={listado.recargar}
        onEntrar={(id) => navigate(`/aula/${id}/hoy`)}
        onVolverAlActual={() => navigate('/classroom')}
        avances={avances}
      />
    )
  }

  // Conteos del riel: lo que reclama atención en cada destino.
  const badges = (() => {
    if (cargando || !actividades.length) return {}
    if (rol === 'docente') {
      const t = buildTeacherToday(actividades)
      return { actividades: t.porCalificar.entregas }
    }
    const t = buildStudentToday(actividades)
    return { actividades: t.meToca.length + (t.siguiente ? 1 : 0) }
  })()

  return (
    <AulaShell
      aula={{
        id: classroomId,
        titulo: aula?.titulo ?? 'Aula',
        asignatura: aula?.asignatura,
        grupo: aula?.grupo,
        color: aula?.color ?? null,
      }}
      role={rol}
      vista={vista}
      onNavegar={irA}
      onSalir={() => navigate('/aula')}
      // `/` es la página pública de marketing, no el inicio de la aplicación: salir por ahí
      // parecía que te desconectaba. El inicio del docente es `/dashboard`.
      onSalirDelModulo={() => navigate('/dashboard')}
      periodos={aula?.periodos ?? []}
      periodo={periodo}
      onPeriodo={cambiarPeriodo}
      badges={badges}
      aviso={
        session ? (
          <LiveSessionBanner
            session={session}
            role={rol}
            // El reproductor del quiz vive en el aula actual; hasta que se traiga, el enlace
            // lleva allí en vez de dejar el aviso muerto.
            onEntrar={() => navigate('/classroom')}
          />
        ) : undefined
      }
    >
      <AulaState
        loading={cargando}
        error={error}
        onRetry={recargar}
        isEmpty={false}
        empty={null}
      >
        {activityId ? (
          <DetalleCargado
            activityId={activityId}
            aulaId={classroomId}
            rol={rol}
            totalEstudiantes={aula?.estudiantes ?? null}
            onVolver={() => verActividades()}
            onIrAlAulaActual={() => irAlAulaActualPara('editar')}
            onAbrirActividad={abrirActividad}
            onEditarLeccion={setEditandoLeccion}
          />
        ) : vista === 'hoy' ? (
          <Hoy
            role={rol}
            nombre={nombre}
            aulaTitulo={[aula?.asignatura ?? aula?.titulo, aula?.grupo].filter(Boolean).join(' ')}
            periodoNombre={aula?.periodoActual?.name ?? null}
            estudiantes={aula?.estudiantes ?? null}
            actividades={actividades}
            anuncios={aula?.anuncios ?? []}
            onAbrirActividad={abrirActividad}
            onVerActividades={verActividades}
            totalEstudiantes={aula?.estudiantes ?? null}
            // Crear todavía vive en el aula actual (el formulario por intención y el editor de
            // preguntas no son componentes reutilizables). Se ofrece igual: sin estos botones
            // el docente entra al aula nueva y no encuentra por dónde crear, que es peor que
            // un puente honesto.
            onCrear={rol === 'docente' ? () => setCreando(true) : undefined}
            onValeria={rol === 'docente' ? () => irAlAulaActualPara('valeria') : undefined}
          />
        ) : vista === 'unidades' ? (
          <Unidades
            aulaId={classroomId}
            role={rol}
            secciones={aula?.secciones ?? []}
            actividades={actividades}
            periodo={periodo}
            onAbrirActividad={abrirActividad}
            totalEstudiantes={aula?.estudiantes ?? null}
            onAbrirMaterial={() => irAlAulaActualPara('editar')}
            onCrear={() => setCreando(true)}
          />
        ) : vista === 'actividades' ? (
          <Actividades
            role={rol}
            actividades={actividades}
            periodo={periodo}
            onPeriodo={cambiarPeriodo}
            filtroEstadoInicial={filtroEstado}
            onAbrirActividad={abrirActividad}
            totalEstudiantes={aula?.estudiantes ?? null}
            onCrear={rol === 'docente' ? () => setCreando(true) : undefined}
          />
        ) : vista === 'notas' ? (
          <Notas
            classroomId={classroomId}
            role={rol}
            actividades={actividades}
            onAbrirActividad={abrirActividad}
          />
        ) : vista === 'rutas' ? (
          <div className="mx-auto max-w-4xl">
            <Suspense fallback={null}>
              <LearningRoutesTab classroomId={classroomId} isTeacher={rol === 'docente'} />
            </Suspense>
          </div>
        ) : vista === 'expedicion' ? (
          <div className="mx-auto max-w-5xl">
            <Suspense fallback={null}>
              <AbpTab classroomId={classroomId} isTeacher={rol === 'docente'} />
            </Suspense>
          </div>
        ) : vista === 'estudiantes' && rol === 'docente' ? (
          <Estudiantes classroomId={classroomId} />
        ) : (
          <div className="mx-auto max-w-3xl">
            <EmptyState
              scene="sin-unidades"
              title={`"${vistaLabel(vista)}" todavía no está en el aula nueva`}
              detail="Se irán trayendo una por una. Mientras tanto puedes usarla en el aula actual, con los mismos datos."
              secondary={{ label: 'Abrir el aula actual', onClick: () => navigate('/classroom') }}
            />
          </div>
        )}
      </AulaState>
      {creando && (
        <CrearActividad
          aulaId={classroomId}
          unidades={aula?.secciones ?? []}
          periodos={aula?.periodos ?? []}
          periodoActual={aula?.periodoActual?.id ?? null}
          onCerrar={() => setCreando(false)}
          onCreada={(nueva, siguiente) => {
            setCreando(false)
            recargar()
            if (siguiente === 'editor-leccion') {
              // Lecciones y juegos se editan aquí: LessonEditor es un componente propio.
              const gameType = (nueva as { metadata?: { gameType?: string } }).metadata?.gameType
              setEditandoLeccion({ id: nueva.id, title: nueva.title, gameType })
            } else {
              // El resto abre su detalle; las preguntas de quiz todavía se añaden en el aula
              // anterior, y el detalle lo dice.
              abrirActividad(nueva.id)
            }
          }}
        />
      )}

      {editandoLeccion && (
        <Suspense fallback={null}>
          <div className="fixed inset-0 z-50 bg-canvas">
            <LessonEditor
              activityId={editandoLeccion.id}
              activityTitle={editandoLeccion.title}
              classroomTitle={aula?.titulo}
              subjectName={aula?.asignatura ?? undefined}
              initialGameType={editandoLeccion.gameType}
              onClose={() => {
                setEditandoLeccion(null)
                recargar()
              }}
              // Cerrar el editor y abrir el detalle: desde ahí se previsualiza con el mismo
              // reproductor que ve el estudiante.
              onPreview={() => {
                const id = editandoLeccion.id
                setEditandoLeccion(null)
                recargar()
                abrirActividad(id)
              }}
            />
          </div>
        </Suspense>
      )}
    </AulaShell>
  )
}
