import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react'
import { academicGradesApi, areasApi, finalComponentsApi } from '../../lib/api'
import { toast } from '../../lib/toast'

/**
 * D-19 · Alcance de las fuentes de evaluación final.
 *
 * Permite declarar qué grados —y opcionalmente qué asignaturas de un grado—
 * presentan cada prueba semestral. Antes esto sólo podía inferirse de que no
 * hubiera nota, lo cual era indistinguible de «al docente le falta subirla».
 *
 * REGLA (la resuelve el BACKEND; aquí sólo se pinta lo que devuelve `getScope`):
 *     1. regla (componente, grado, asignatura) → manda
 *     2. regla (componente, grado)             → manda
 *     3. sin regla                             → el `scopeMode` del componente
 *
 * La UI nunca calcula la aplicabilidad por su cuenta: si lo hiciera, podría
 * divergir del cálculo real y mostrar una casilla marcada que el backend
 * rechaza al guardar una nota.
 */

type ScopeMode = 'ALL_GRADES' | 'SELECTED_GRADES'

interface Component {
  id: string
  name: string
  weightPercentage: number
  order: number
  scopeMode: ScopeMode
}

interface Rule {
  id: string
  finalComponentId: string
  gradeId: string
  subjectId: string | null
  applies: boolean
  reason: string | null
}

interface Grade {
  id: string
  name: string
  stage: string
}

interface Subject {
  id: string
  name: string
}

export default function FinalComponentScopeMatrix({
  academicYearId,
  institutionId,
  canEdit,
}: {
  academicYearId: string | null
  institutionId: string | null
  canEdit: boolean
}) {
  const [components, setComponents] = useState<Component[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null) // `${componentId}|${gradeId}`

  const load = useCallback(async () => {
    if (!academicYearId) return
    setLoading(true)
    try {
      const [scopeRes, gradesRes] = await Promise.all([
        finalComponentsApi.getScope(academicYearId),
        academicGradesApi.getAll(institutionId || undefined),
      ])
      setComponents(scopeRes.data?.components || [])
      setRules(scopeRes.data?.rules || [])
      setGrades((gradesRes.data || []).map((g: any) => ({ id: g.id, name: g.name, stage: g.stage })))
    } catch (err) {
      console.error('Error cargando el alcance de fuentes finales:', err)
      toast.error('No se pudo cargar el alcance de las evaluaciones.')
    } finally {
      setLoading(false)
    }
  }, [academicYearId, institutionId])

  useEffect(() => { load() }, [load])

  // Las asignaturas sólo hacen falta al abrir el nivel 2 (excepción por
  // asignatura), así que se cargan la primera vez que se despliega un grado.
  const loadSubjects = useCallback(async () => {
    if (subjects.length || !institutionId) return
    try {
      const res = await areasApi.getAll(institutionId)
      const list: Subject[] = []
      for (const area of res.data || []) {
        for (const s of area.subjects || []) list.push({ id: s.id, name: s.name })
      }
      setSubjects(list.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('Error cargando asignaturas:', err)
    }
  }, [subjects.length, institutionId])

  const ruleFor = (componentId: string, gradeId: string, subjectId: string | null) =>
    rules.find(r => r.finalComponentId === componentId && r.gradeId === gradeId && r.subjectId === subjectId)

  /** Estado EFECTIVO de una casilla de grado, según la misma jerarquía del backend. */
  const gradeApplies = (comp: Component, gradeId: string): boolean => {
    const r = ruleFor(comp.id, gradeId, null)
    if (r) return r.applies
    return comp.scopeMode === 'ALL_GRADES'
  }

  /** ¿Cuántas asignaturas de ese grado tienen una excepción declarada? */
  const exceptionCount = (componentId: string, gradeId: string) =>
    rules.filter(r => r.finalComponentId === componentId && r.gradeId === gradeId && r.subjectId !== null).length

  const gradesByStage = useMemo(() => {
    const orden = ['PREESCOLAR', 'BASICA_PRIMARIA', 'BASICA_SECUNDARIA', 'MEDIA']
    return [...grades].sort((a, b) => {
      const d = orden.indexOf(a.stage) - orden.indexOf(b.stage)
      return d !== 0 ? d : a.name.localeCompare(b.name, 'es', { numeric: true })
    })
  }, [grades])

  const withBusy = async (key: string, fn: () => Promise<any>) => {
    setBusy(key)
    try {
      await fn()
      await load()
    } catch (err: any) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'No se pudo guardar el cambio.')
    } finally {
      setBusy(null)
    }
  }

  const toggleGrade = (comp: Component, gradeId: string) => {
    if (!canEdit) return
    const actual = gradeApplies(comp, gradeId)
    const existente = ruleFor(comp.id, gradeId, null)
    const deseado = !actual
    const key = `${comp.id}|${gradeId}`

    // Si el estado deseado coincide con el que da el `scopeMode`, la regla sobra:
    // se retira en vez de guardar una fila redundante.
    const redundante = deseado === (comp.scopeMode === 'ALL_GRADES')
    return withBusy(key, async () => {
      if (redundante && existente) {
        await finalComponentsApi.removeScopeRule(existente.id)
      } else {
        await finalComponentsApi.upsertScopeRule({
          finalComponentId: comp.id,
          gradeId,
          subjectId: null,
          applies: deseado,
        })
      }
    })
  }

  const toggleSubject = (comp: Component, gradeId: string, subjectId: string) => {
    if (!canEdit) return
    const existente = ruleFor(comp.id, gradeId, subjectId)
    const base = gradeApplies(comp, gradeId)
    const actual = existente ? existente.applies : base
    const deseado = !actual
    const key = `${comp.id}|${gradeId}|${subjectId}`

    return withBusy(key, async () => {
      if (deseado === base && existente) {
        await finalComponentsApi.removeScopeRule(existente.id) // vuelve a heredar del grado
      } else {
        await finalComponentsApi.upsertScopeRule({
          finalComponentId: comp.id,
          gradeId,
          subjectId,
          applies: deseado,
        })
      }
    })
  }

  const changeMode = (comp: Component, mode: ScopeMode) =>
    withBusy(`mode|${comp.id}`, () => finalComponentsApi.setScopeMode(comp.id, mode))

  if (!academicYearId) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando alcance…
      </div>
    )
  }

  if (components.length === 0) {
    return (
      <p className="text-xs text-slate-500 py-3">
        No hay evaluaciones finales configuradas. Al crearlas aparecerán aquí para definir a qué grados aplican.
      </p>
    )
  }

  return (
    <div className="mt-6 pt-6 border-t border-slate-200">
      <h3 className="text-sm font-semibold text-slate-800">¿Qué grados presentan cada evaluación?</h3>
      <p className="text-xs text-slate-500 mt-1">
        Desmarque un grado que no presente la evaluación. Su nota anual se calculará solo con las
        fuentes que sí le apliquen —nunca se le cuenta como cero—. Los cambios se guardan al instante.
      </p>

      <div className="mt-4 space-y-6">
        {components.map(comp => (
          <div key={comp.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-200">
              <div className="text-sm font-medium text-slate-800">
                {comp.name} <span className="text-xs font-normal text-slate-500">· {comp.weightPercentage}%</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                Por defecto
                <select
                  value={comp.scopeMode}
                  disabled={!canEdit || busy === `mode|${comp.id}`}
                  onChange={e => changeMode(comp, e.target.value as ScopeMode)}
                  className="px-2 py-1 border border-slate-200 rounded text-xs disabled:opacity-50"
                >
                  <option value="ALL_GRADES">La presentan todos</option>
                  <option value="SELECTED_GRADES">Solo los que marque</option>
                </select>
              </label>
            </div>

            <div className="divide-y divide-slate-100">
              {gradesByStage.map(g => {
                const aplica = gradeApplies(comp, g.id)
                const key = `${comp.id}|${g.id}`
                const abierto = expanded === key
                const excepciones = exceptionCount(comp.id, g.id)
                return (
                  <div key={g.id}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aplica}
                          disabled={!canEdit || busy === key}
                          onChange={() => toggleGrade(comp, g.id)}
                          className="rounded border-slate-300"
                        />
                        <span className={`text-sm ${aplica ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {g.name}
                        </span>
                      </label>

                      {excepciones > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          {excepciones} excepción{excepciones > 1 ? 'es' : ''}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => { setExpanded(abierto ? null : key); if (!abierto) loadSubjects() }}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        {abierto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Por asignatura
                      </button>
                    </div>

                    {abierto && (
                      <div className="px-3 pb-3 bg-slate-50/60">
                        <p className="text-[11px] text-slate-500 mb-2 flex items-start gap-1">
                          <Info className="w-3 h-3 mt-0.5 shrink-0" />
                          Solo si alguna asignatura se aparta de lo marcado arriba. Lo que no toque, hereda del grado.
                        </p>
                        {subjects.length === 0 ? (
                          <p className="text-xs text-slate-400">Cargando asignaturas…</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                            {subjects.map(s => {
                              const r = ruleFor(comp.id, g.id, s.id)
                              const efectivo = r ? r.applies : aplica
                              const sKey = `${comp.id}|${g.id}|${s.id}`
                              return (
                                <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                                  <input
                                    type="checkbox"
                                    checked={efectivo}
                                    disabled={!canEdit || busy === sKey}
                                    onChange={() => toggleSubject(comp, g.id, s.id)}
                                    className="rounded border-slate-300"
                                  />
                                  <span className={efectivo ? 'text-slate-700' : 'text-slate-400 line-through'}>
                                    {s.name}
                                  </span>
                                  {r && (
                                    <span className="text-[10px] text-amber-600" title="Se aparta de lo marcado para el grado">
                                      excepción
                                    </span>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
