import { AlertTriangle, Check, Cloud, CloudOff, Code2, Flag, Loader2, Megaphone, NotebookPen, RotateCw, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../lib/toast'
import { formatBogota, isoToBogotaDateInput, todayBogotaInput } from '../../lib/datetime'
import { construyeApi, type ConstruyeSessionNote, type ConstruyeTeamBrief, type ConstruyeTeamDetail } from '../../lib/api/construye'
import SessionCard from './SessionCard'
import CodeWorkspace from './CodeWorkspace'
import DocumentStep, { ShareStep } from './DocumentStep'
import PromptStep from './PromptStep'
import PublishPanel from './PublishPanel'
import { documentationProgress, evidenceByVersion, initialStudioMode, nextDocumentPhase, normalizeBrief, type ChangeRequest, type StudioMode, type VersionEvidenceInput } from './journey'
import { APP_STARTER, manifestToProject, oversizedFiles, projectToManifest } from './manifest'
import type { CodeDraftSync } from './useCodeAutosave'
import type { PreviewProject } from './protocol'
import type { SavedVersionSummary } from './VersionEvidence'
import { useAutosave, type AutosaveStatus } from './useAutosave'

type LoadState = 'loading' | 'ready' | 'error'

// Preferencias de navegación de este navegador (no datos del proyecto): se leen con cuidado
// porque el almacenamiento puede no existir (modo privado, vista embebida).
const skipKey = (projectId: string) => `crea:${projectId}:prompt-omitido`
const readFlag = (key: string) => { try { return window.localStorage.getItem(key) === '1' } catch { return false } }
const writeFlag = (key: string) => { try { window.localStorage.setItem(key, '1') } catch { /* sin almacenamiento: solo se pierde la preferencia */ } }

/** Carga el equipo y monta el estudio de Crea. */
export default function TeamWorkspace({ projectId }: { projectId: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [team, setTeam] = useState<ConstruyeTeamDetail | null>(null)

  useEffect(() => {
    let active = true
    setState('loading')
    construyeApi.myTeam(projectId)
      .then(({ data }) => { if (active) { setTeam(data); setState('ready') } })
      .catch((error) => {
        if (!active) return
        setErrorMessage(error?.response?.status === 404
          ? 'Todavía no perteneces a un equipo de este proyecto. Pide a tu docente que te agregue.'
          : 'No pudimos cargar tu proyecto de Edusyn Crea. Intenta de nuevo en un momento.')
        setState('error')
      })
    return () => { active = false }
  }, [projectId])

  if (state === 'loading') {
    return <div className="mt-6 flex items-center gap-2 rounded-2xl border border-hairline bg-surface-1 p-6 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" /> Cargando tu proyecto…
    </div>
  }
  if (state === 'error' || !team) {
    return <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>{errorMessage}</p>
    </div>
  }
  return <CreaStudio projectId={projectId} team={team} setTeam={setTeam} />
}

const MODES: { key: StudioMode; label: string; icon: typeof NotebookPen }[] = [
  { key: 'document', label: 'Documentar', icon: NotebookPen },
  { key: 'prompt', label: 'Prompt', icon: Sparkles },
  { key: 'code', label: 'Código', icon: Code2 },
  { key: 'share', label: 'Publicar', icon: Megaphone },
]

/** Estudio de Crea, con la limpieza de un editor por bloques: una barra arriba con los cuatro
 * momentos (documentar → prompt → código → presentar), el estado de guardado siempre visible
 * y una sola tarea en pantalla. Conecta el recorrido y el taller al equipo real: el plan se
 * guarda solo, las versiones se guardan con evidencia y la bitácora registra lo que el equipo
 * hace fuera del preview. El código sigue ejecutándose solo en el origen aislado del preview. */
function CreaStudio({ projectId, team, setTeam }: {
  projectId: string
  team: ConstruyeTeamDetail
  setTeam: React.Dispatch<React.SetStateAction<ConstruyeTeamDetail | null>>
}) {
  const startingBrief = useMemo(() => normalizeBrief(team.team.brief), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<StudioMode>(() => initialStudioMode(startingBrief, team.versions.length, readFlag(skipKey(projectId))))
  const [sessionOpen, setSessionOpen] = useState(false)
  // El taller se monta la primera vez que se abre y luego solo se oculta: cambiar de pestaña no
  // debe borrar el código que aún no se guardó como versión.
  const [codeMounted, setCodeMounted] = useState(mode === 'code')
  useEffect(() => { if (mode === 'code') setCodeMounted(true) }, [mode])

  // Último plan confirmado por el servidor: se envían solo los campos que cambiaron desde ahí.
  const lastSaved = useRef<ConstruyeTeamBrief>(startingBrief)
  const autosave = useAutosave<ConstruyeTeamBrief>(startingBrief, async (brief) => {
    try {
      const fields = (Object.keys(brief) as (keyof ConstruyeTeamBrief)[]).filter(field => brief[field] !== lastSaved.current[field])
      const { data } = await construyeApi.updateBrief(team.team.id, brief, fields)
      lastSaved.current = brief
      const entry = data.journalEntry
      // Una racha de edición actualiza la misma entrada: se reemplaza en vez de duplicarla.
      setTeam(current => current && {
        ...current,
        team: data.team,
        journal: entry ? [entry, ...current.journal.filter(item => item.id !== entry.id)] : current.journal,
      })
      return true
    } catch {
      return false
    }
  })
  const brief = autosave.value
  const setField = (field: keyof ConstruyeTeamBrief, value: string) => autosave.update(current => ({ ...current, [field]: value }))

  const versions = useMemo<SavedVersionSummary[]>(() => {
    const evidence = evidenceByVersion(team.journal)
    return team.versions.map(version => ({ number: version.number, label: version.label, createdAt: version.createdAt, evidence: evidence.get(version.id) }))
  }, [team])

  const logJournal = (type: string, summary: string, detail?: Record<string, unknown>) => {
    construyeApi.addJournalEntry(team.team.id, { type, summary, detail }).catch(() => {})
  }

  const saveVersion = async (project: PreviewProject, evidence: VersionEvidenceInput): Promise<boolean> => {
    const tooLarge = oversizedFiles(project)
    if (tooLarge.length) {
      toast.warning('Algún archivo es muy grande', `Reduce ${tooLarge.join(', ')} antes de guardar.`)
      return false
    }
    // El plan pendiente se guarda antes: la condición de la primera versión se revisa con él.
    await autosave.flush()
    const { data: version } = await construyeApi.createVersion(team.team.id, { manifest: projectToManifest(project), evidence })
    const entry = { id: `local-${version.id}`, type: 'VERSION_CREATED', summary: `Guardaron la versión ${version.number}: ${evidence.attempted}`, detail: { versionId: version.id, evidence }, createdAt: version.createdAt }
    setTeam(current => current && { ...current, versions: [version, ...current.versions], journal: [entry, ...current.journal] })
    toast.success(`Versión ${version.number} guardada como evidencia`, 'Su docente ya puede revisarla.')
    return true
  }

  const saveSessionNote = async (note: ConstruyeSessionNote, summary: string): Promise<boolean> => {
    try {
      const { data: entry } = await construyeApi.addJournalEntry(team.team.id, { type: 'SESSION_NOTE', summary, detail: note })
      setTeam(current => current && { ...current, journal: [entry, ...current.journal] })
      toast.success(note.kind === 'GOAL' ? 'Meta de la sesión guardada' : 'Salida guardada', 'Su docente puede verla en su panel.')
      return true
    } catch (error) {
      toast.error(error)
      return false
    }
  }

  const onChangeRequestCopied = (request: ChangeRequest) => logJournal(
    'PROMPT_COPIED',
    `El equipo preparó una petición de cambio: ${request.change.trim().slice(0, 200)}`,
    { kind: 'CHANGE_REQUEST', request: { change: request.change.trim(), reason: request.reason.trim(), keep: request.keep.trim(), check: request.check.trim() } },
  )

  const latest = team.versions[0]
  const kind = team.project?.kind === 'APP' ? 'APP' : 'WEB'
  // El taller abre lo más reciente del equipo: el borrador guardado solo si es posterior a la
  // última versión (si no, la versión). Se calcula una vez: el taller lo lee solo al montarse.
  const [opening] = useState(() => {
    const versionProject = latest ? manifestToProject(latest.manifest) : undefined
    const draft = team.team.codeDraft
    const draftAt = team.team.codeDraftUpdatedAt
    const draftIsNewer = !!draft && !!draftAt && (!latest || new Date(draftAt).getTime() > new Date(latest.createdAt).getTime())
    const draftProject = draftIsNewer ? manifestToProject(draft) : undefined
    const differs = !!draftProject && (!versionProject || draftProject.html !== versionProject.html || draftProject.css !== versionProject.css || draftProject.js !== versionProject.js)
    return {
      project: differs ? draftProject : versionProject,
      versionProject,
      recoveredAt: differs ? draftAt : null,
    }
  })
  const draftSync = useMemo<CodeDraftSync>(() => ({
    revision: team.team.codeDraftRevision ?? 0,
    save: async (project, baseRevision) => {
      try {
        const { data } = await construyeApi.saveCodeDraft(team.team.id, { manifest: projectToManifest(project), baseRevision })
        return { ok: true, revision: data.revision, updatedAt: data.updatedAt }
      } catch (error) {
        const response = (error as { response?: { status?: number; data?: { draft?: { manifest?: unknown; revision?: number; updatedAt?: string | null; by?: string | null } } } })?.response
        const theirs = response?.status === 409 ? response.data?.draft : undefined
        if (!theirs || !theirs.manifest) throw error
        return { ok: false, conflict: { project: manifestToProject(theirs.manifest as Parameters<typeof manifestToProject>[0]), revision: theirs.revision ?? 0, updatedAt: theirs.updatedAt ?? null, by: theirs.by ?? null } }
      }
    },
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const progress = documentationProgress(brief)
  const hasGoalToday = team.journal.some(entry => entry.type === 'SESSION_NOTE' && (entry.detail as ConstruyeSessionNote | undefined)?.kind === 'GOAL' && isoToBogotaDateInput(entry.createdAt) === todayBogotaInput())

  return <div className="crea-page -mx-1 mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:mx-0">
    {/* Barra superior: identidad a la izquierda, los cuatro momentos al centro, estado a la derecha. */}
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[#16293a] px-3 py-2 text-white sm:px-4">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Edusyn Crea</p>
        <p className="truncate text-sm font-semibold">{team.team.name}</p>
      </div>
      <nav aria-label="Momentos del proyecto" className="order-3 w-full sm:order-none sm:mx-auto sm:w-auto">
        <div className="flex rounded-full bg-white/10 p-1">
          {MODES.map(item => {
            const Icon = item.icon
            const current = mode === item.key
            return <button key={item.key} type="button" onClick={() => setMode(item.key)} aria-current={current ? 'page' : undefined}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-semibold transition sm:flex-none sm:px-4 sm:text-xs ${current ? 'bg-white text-slate-900 shadow' : 'text-slate-200 hover:bg-white/10'}`}>
              <Icon className="hidden h-3.5 w-3.5 sm:inline" aria-hidden="true" /> <span className="truncate">{item.label}</span>
              {item.key === 'document' && progress.done === progress.total && <Check className="hidden h-3 w-3 text-emerald-500 sm:inline" aria-label="Documentación lista" />}
            </button>
          })}
        </div>
      </nav>
      <div className="ml-auto flex items-center gap-2 sm:ml-0">
        <SaveStatus status={autosave.status} savedAt={autosave.savedAt} onRetry={() => { void autosave.flush() }} />
        <button type="button" onClick={() => setSessionOpen(v => !v)} aria-expanded={sessionOpen} title="Meta de hoy y salida de la sesión"
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${sessionOpen ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          <Flag className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Meta de hoy</span>{!hasGoalToday && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="sin meta" />}
        </button>
      </div>
    </header>

    {sessionOpen && <div className="relative border-b border-slate-200 bg-[#16293a] px-3 pb-3">
      <button type="button" onClick={() => setSessionOpen(false)} aria-label="Cerrar" className="absolute right-4 top-6 z-10 rounded-md p-1 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button>
      <SessionCard journal={team.journal} onSave={saveSessionNote} />
    </div>}

    <div className={mode === 'code' ? '' : 'min-h-[560px]'}>
      {mode === 'document' && <DocumentStep brief={brief} onChange={setField} initialPhase={nextDocumentPhase(brief)} onContinue={() => { void autosave.flush(); setMode('prompt') }} />}
      {mode === 'prompt' && <PromptStep
        brief={brief}
        kind={kind}
        onBack={() => setMode('document')}
        onGoCode={() => setMode('code')}
        onSkip={() => { writeFlag(skipKey(projectId)); setMode('code') }}
        onCopied={() => logJournal('PROMPT_COPIED', 'El equipo copió su petición inicial para la IA externa.', { kind: 'INITIAL' })}
      />}
      {codeMounted && <div className={mode === 'code' ? '' : 'hidden'}><CodeWorkspace
        initialProject={opening.project}
        lastVersionProject={opening.versionProject}
        recoveredDraftAt={opening.recoveredAt}
        starter={kind === 'APP' ? APP_STARTER : undefined}
        defaultViewport={kind === 'APP' ? 'mobile' : 'desktop'}
        draftSync={draftSync}
        projectTitle={team.project?.title || team.team.name}
        onSaveVersion={saveVersion}
        versions={versions}
        brief={brief}
        buildGate={team.buildGate}
        onChangeRequestCopied={onChangeRequestCopied}
        onHelpRequested={() => logJournal('HELP_REQUESTED', 'El equipo copió el contexto de ayuda para su IA externa.')}
      /></div>}
      {mode === 'share' && <div className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-8 sm:pt-7"><PublishPanel teamId={team.team.id} latestVersion={latest ? { id: latest.id, number: latest.number } : null} defaultTitle={team.project?.title || team.team.name} /></div>
        <ShareStep brief={brief} onChange={setField} />
      </div>}
    </div>
  </div>
}

function SaveStatus({ status, savedAt, onRetry }: { status: AutosaveStatus; savedAt: Date | null; onRetry: () => void }) {
  if (status === 'error') {
    return <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/30" title="No se pudo guardar. Pulsa para intentar de nuevo.">
      <CloudOff className="h-3.5 w-3.5" /> No se guardó · Reintentar <RotateCw className="h-3 w-3" />
    </button>
  }
  const text = status === 'saving' ? 'Guardando…' : status === 'pending' ? 'Cambios sin guardar' : savedAt ? `Guardado ${formatBogota(savedAt, { hour: 'numeric', minute: '2-digit' })}` : 'Todo guardado'
  return <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-slate-300">
    {status === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === 'pending' ? <Cloud className="h-3.5 w-3.5 text-amber-300" /> : <Check className="h-3.5 w-3.5 text-emerald-400" />}
    <span className="hidden md:inline">{text}</span>
  </span>
}
