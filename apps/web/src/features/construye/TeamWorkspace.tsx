import { AlertTriangle, History, Loader2, Rocket, Users2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../lib/toast'
import { construyeApi, type ConstruyeTeamBrief, type ConstruyeTeamDetail } from '../../lib/api/construye'
import BriefBuilder from './BriefBuilder'
import CodeWorkspace from './CodeWorkspace'
import { evidenceByVersion, normalizeBrief, type ChangeRequest, type VersionEvidenceInput } from './journey'
import { manifestToProject, oversizedFiles, projectToManifest } from './manifest'
import type { PreviewProject } from './protocol'
import type { SavedVersionSummary } from './VersionEvidence'

type LoadState = 'loading' | 'ready' | 'error'

/** Conecta el recorrido y el editor al equipo/proyecto real: carga la idea y la última
 * versión, persiste decisiones y versiones con evidencia, y deja constancia en la bitácora
 * de lo que el equipo hace fuera del preview (peticiones copiadas, ayuda solicitada). El
 * código sigue ejecutándose solo en el origen aislado de PreviewFrame. */
export default function TeamWorkspace({ projectId }: { projectId: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [team, setTeam] = useState<ConstruyeTeamDetail | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)

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

  const savedBrief = useMemo(() => normalizeBrief(team?.team.brief), [team?.team.brief])
  const versions = useMemo<SavedVersionSummary[]>(() => {
    if (!team) return []
    const evidence = evidenceByVersion(team.journal)
    return team.versions.map(version => ({ number: version.number, label: version.label, createdAt: version.createdAt, evidence: evidence.get(version.id) }))
  }, [team])

  const logJournal = (type: string, summary: string, detail?: Record<string, unknown>) => {
    if (!team) return
    construyeApi.addJournalEntry(team.team.id, { type, summary, detail }).catch(() => {})
  }

  const saveBrief = async (brief: ConstruyeTeamBrief): Promise<boolean> => {
    if (!team) return false
    try {
      const { data } = await construyeApi.updateBrief(team.team.id, brief)
      setTeam((current) => current && {
        ...current,
        team: data.team,
        journal: data.journalEntry ? [data.journalEntry, ...current.journal] : current.journal,
      })
      toast.success('Decisiones guardadas', 'Quedaron registradas en la bitácora del equipo.')
      return true
    } catch (error) {
      toast.error(error)
      return false
    }
  }

  const saveVersion = async (project: PreviewProject, evidence: VersionEvidenceInput): Promise<boolean> => {
    if (!team) return false
    const tooLarge = oversizedFiles(project)
    if (tooLarge.length) {
      toast.warning('Algún archivo es muy grande', `Reduce ${tooLarge.join(', ')} antes de guardar.`)
      return false
    }
    const { data: version } = await construyeApi.createVersion(team.team.id, { manifest: projectToManifest(project), evidence })
    const entry = { id: `local-${version.id}`, type: 'VERSION_CREATED', summary: `Guardaron la versión ${version.number}: ${evidence.attempted}`, detail: { versionId: version.id, evidence }, createdAt: version.createdAt }
    setTeam((current) => current && { ...current, versions: [version, ...current.versions], journal: [entry, ...current.journal] })
    toast.success(`Versión ${version.number} guardada como evidencia`, 'Su docente ya puede revisarla.')
    return true
  }

  const onChangeRequestCopied = (request: ChangeRequest) => logJournal(
    'PROMPT_COPIED',
    `El equipo preparó una petición de cambio: ${request.change.trim().slice(0, 200)}`,
    { kind: 'CHANGE_REQUEST', request: { change: request.change.trim(), reason: request.reason.trim(), keep: request.keep.trim(), check: request.check.trim() } },
  )

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

  const latest = team.versions[0]
  const initialProject = latest ? manifestToProject(latest.manifest) : undefined

  return <div className="crea-page">
    <section className="relative mt-6 overflow-hidden rounded-[28px] bg-[#10283a] px-5 py-5 text-white shadow-xl shadow-slate-900/10 sm:px-7">
      <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-cyan-300/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-emerald-300 text-slate-950 shadow-lg"><Rocket className="h-6 w-6" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-200">Edusyn Crea · Taller del equipo</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{team.team.name}</h1><p className="mt-1 text-sm text-slate-300">Primero entiendan el problema; después construyan una solución que puedan explicar.</p></div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-slate-200"><Users2 className="h-3.5 w-3.5 text-cyan-300" /> Trabajo en equipo</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-slate-200"><History className="h-3.5 w-3.5 text-emerald-300" /> {latest ? `Versión v${latest.number}` : 'Primera versión pendiente'}</span>
        </div>
      </div>
    </section>
    <BriefBuilder
      initialBrief={team.team.brief}
      onSave={saveBrief}
      versionCount={team.versions.length}
      hasCode={Boolean(latest)}
      onPromptCopied={() => logJournal('PROMPT_COPIED', 'El equipo copió su petición inicial para la IA externa.', { kind: 'INITIAL' })}
      onOpenBuild={() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    />
    <div ref={workspaceRef} className="scroll-mt-4">
      <CodeWorkspace
        initialProject={initialProject}
        onSaveVersion={saveVersion}
        versions={versions}
        brief={savedBrief}
        buildGate={team.buildGate}
        onChangeRequestCopied={onChangeRequestCopied}
        onHelpRequested={() => logJournal('HELP_REQUESTED', 'El equipo copió el contexto de ayuda para su IA externa.')}
      />
    </div>
  </div>
}
