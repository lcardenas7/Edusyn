import { AlertTriangle, BookOpenCheck, History, Lightbulb, Loader2, Rocket, Users2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from '../../lib/toast'
import { construyeApi, type ConstruyeTeamBrief, type ConstruyeTeamDetail } from '../../lib/api/construye'
import BriefBuilder from './BriefBuilder'
import CodeWorkspace from './CodeWorkspace'
import { manifestToProject, oversizedFiles, projectToManifest } from './manifest'
import type { PreviewProject } from './protocol'

type LoadState = 'loading' | 'ready' | 'error'

/** Conecta el editor F0 al equipo/proyecto real de F1: carga la última versión guardada,
 * persiste versiones nuevas y deja constancia en la bitácora de lo que el equipo hace
 * fuera del preview (prompt copiado, ayuda solicitada). El código sigue ejecutándose
 * solo en el origen aislado de PreviewFrame; esto únicamente guarda/lee texto estático. */
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

  const logJournal = (type: string, summary: string) => {
    if (!team) return
    construyeApi.addJournalEntry(team.team.id, { type, summary }).catch(() => {})
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
      toast.success('Idea del equipo guardada', 'El proceso quedó registrado en la bitácora.')
      return true
    } catch (error) {
      toast.error(error)
      return false
    }
  }

  const saveVersion = async (project: PreviewProject, note: string): Promise<boolean> => {
    if (!team) return false
    const tooLarge = oversizedFiles(project)
    if (tooLarge.length) {
      toast.warning('Algún archivo es muy grande', `Reduce ${tooLarge.join(', ')} antes de guardar.`)
      return false
    }
    const { data: version } = await construyeApi.createVersion(team.team.id, { manifest: projectToManifest(project), label: note })
    setTeam((current) => current && { ...current, versions: [version, ...current.versions] })
    toast.success(`Versión ${version.number} guardada como evidencia`, 'Tu docente ya puede revisarla en su panel.')
    return true
  }

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

  return <div className="crea-page">
    <section className="relative mt-6 overflow-hidden rounded-[28px] bg-[#10283a] px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-7">
      <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-cyan-300/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-emerald-300/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-emerald-300 text-slate-950 shadow-lg"><Rocket className="h-6 w-6" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-200">Edusyn Crea · Taller del equipo</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{team.team.name}</h1><p className="mt-1 text-sm text-slate-300">Una idea que se convierte en una aplicación, paso a paso.</p></div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-slate-200"><Users2 className="h-3.5 w-3.5 text-cyan-300" /> Trabajo en equipo</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-slate-200"><History className="h-3.5 w-3.5 text-emerald-300" /> {latest ? `Versión v${latest.number}` : 'Primera versión pendiente'}</span>
        </div>
      </div>
      <div className="relative mt-6 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><span className="inline-flex items-center gap-2 text-xs font-bold text-orange-200"><Lightbulb className="h-4 w-4" /> 1. Imaginen</span><p className="mt-1 text-xs leading-5 text-slate-300">Definan el problema y preparen una buena petición.</p></div>
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3"><span className="inline-flex items-center gap-2 text-xs font-bold text-cyan-200"><BookOpenCheck className="h-4 w-4" /> 2. Construyan</span><p className="mt-1 text-xs leading-5 text-slate-300">Relacionen cada parte visible con su código.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-200"><History className="h-4 w-4" /> 3. Dejen evidencia</span><p className="mt-1 text-xs leading-5 text-slate-300">Prueben y guarden versiones que el docente pueda revisar.</p></div>
      </div>
    </section>
    <BriefBuilder
      initialBrief={team.team.brief}
      onSave={saveBrief}
      onPromptCopied={() => logJournal('PROMPT_COPIED', 'El equipo copió el prompt para su IA externa.')}
    />
    <CodeWorkspace
      initialProject={latest ? manifestToProject(latest.manifest) : undefined}
      onSaveVersion={saveVersion}
      versions={team.versions}
      onHelpRequested={() => logJournal('HELP_REQUESTED', 'El equipo copió el contexto de ayuda para su IA externa.')}
    />
  </div>
}
