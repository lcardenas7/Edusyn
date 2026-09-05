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

import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AulaShell } from './ui/AulaShell'
import { AulaState, EmptyState } from './ui/EmptyState'
import { LiveSessionBanner } from './ui/LiveSessionBanner'
import { DESTINOS, type Vista } from './ui/destinations'
import { SelectorAula } from './views/SelectorAula'
import { Hoy } from './views/Hoy'
import { Actividades } from './views/Actividades'
import { ActividadDetalle } from './views/ActividadDetalle'
import { useAula, useAulas, type Rol } from './data/useAula'
import { useActividad } from './data/useActividad'
import { useLiveSession } from './data/useLiveSession'
import { buildTeacherToday, buildStudentToday } from './model/today'
import { PERIOD_ALL } from './model/list'

const VISTAS = new Set(DESTINOS.map((d) => d.id))

/**
 * El detalle carga sus propios datos (la actividad completa y sus entregas), que la lista no
 * trae. Va aparte para que su estado de carga y de error no arrastre a todo el aula.
 */
function DetalleCargado({
  activityId,
  rol,
  onVolver,
  onIrAlAulaActual,
}: {
  activityId: string
  rol: Rol
  onVolver: () => void
  onIrAlAulaActual: () => void
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

  const rol: Rol = useMemo(() => {
    const roles: any[] = user?.roles ?? []
    const nombres = roles.map((r) => r.role?.name ?? r.roleName ?? '')
    return nombres.some((n) => ['DOCENTE', 'COORDINADOR'].includes(n)) ? 'docente' : 'estudiante'
  }, [user])

  const nombre = user?.firstName || (rol === 'docente' ? 'profe' : 'estudiante')

  // ─── Sin aula: la lista ────────────────────────────────────────────────
  const listado = useAulas(rol)

  // ─── Con aula: sus datos ───────────────────────────────────────────────
  const { aula, actividades, cargando, error, recargar } = useAula(classroomId ?? null, rol)
  const { session } = useLiveSession(classroomId ?? null)

  const vista: Vista = esVista(vistaParam) ? vistaParam : 'hoy'
  // El período vive en la URL para que un enlace lleve a lo mismo que veía quien lo mandó.
  const periodo = params.get('periodo') ?? PERIOD_ALL
  const filtroEstado = params.get('estado')

  const irA = useCallback(
    (v: Vista) => {
      if (!classroomId) return
      // Cambiar de destino limpia el filtro de estado: venía de otro contexto.
      const q = periodo !== PERIOD_ALL ? `?periodo=${encodeURIComponent(periodo)}` : ''
      navigate(`/aula/${classroomId}/${v}${q}`)
    },
    [classroomId, navigate, periodo],
  )

  const cambiarPeriodo = useCallback(
    (p: string) => {
      const next = new URLSearchParams(params)
      if (p === PERIOD_ALL) next.delete('periodo')
      else next.set('periodo', p)
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
      }}
      role={rol}
      vista={vista}
      onNavegar={irA}
      onSalir={() => navigate('/aula')}
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
            rol={rol}
            onVolver={() => verActividades()}
            onIrAlAulaActual={() => navigate('/classroom')}
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
          />
        ) : vista === 'actividades' ? (
          <Actividades
            role={rol}
            actividades={actividades}
            periodo={periodo}
            onPeriodo={cambiarPeriodo}
            filtroEstadoInicial={filtroEstado}
            onAbrirActividad={abrirActividad}
          />
        ) : (
          <div className="mx-auto max-w-3xl">
            <EmptyState
              scene="sin-unidades"
              title={`"${vista}" todavía no está en el aula nueva`}
              detail="Se irán trayendo una por una. Mientras tanto puedes usarla en el aula actual."
              secondary={{ label: 'Abrir el aula actual', onClick: () => navigate('/classroom') }}
            />
          </div>
        )}
      </AulaState>
    </AulaShell>
  )
}
