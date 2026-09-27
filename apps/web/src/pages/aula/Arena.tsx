import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Check, ChevronRight, Clock3, Swords, Trophy, Users, X } from 'lucide-react'
import api from '../../lib/api/client'

type Source = { id: string; title: string; questionCount: number; enabled: boolean }
type Peer = { id: string; name: string }
type DuelSummary = { id: string; status: string; opponent: string; isInvitee: boolean; myProgress: number; opponentProgress: number; createdAt: string }
type Dashboard = { classroomTitle: string; role: 'teacher' | 'student'; questionCount: number; minimumQuestions: number; sources: Source[]; peers: Peer[]; duels: DuelSummary[] }
type Duel = { id: string; status: string; isInvitee: boolean; myProgress: number; opponentProgress: number; total: number; question: { ordinal: number; text: string; options: string[] } | null; result: { myScore: number; opponentScore: number; review: { text: string; correctAnswer: string; explanation: string | null; myCorrect: boolean }[] } | null }

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message)) return message.join(' · ')
  }
  return 'No se pudo completar la acción. Intenta de nuevo.'
}

const statusLabel: Record<string, string> = { INVITED: 'Invitación pendiente', ACTIVE: 'En juego', COMPLETED: 'Terminado', DECLINED: 'Rechazado', EXPIRED: 'Venció' }

export default function Arena() {
  const { classroomId } = useParams<{ classroomId: string }>()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [duel, setDuel] = useState<Duel | null>(null)
  const [selectedPeer, setSelectedPeer] = useState('')
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!classroomId) return
    const response = await api.get<Dashboard>(`/classroom-duels/classrooms/${classroomId}`)
    setDashboard(response.data)
  }, [classroomId])

  const openDuel = useCallback(async (id: string) => {
    const response = await api.get<Duel>(`/classroom-duels/${id}`)
    setDuel(response.data)
    setSelectedAnswer('')
  }, [])

  useEffect(() => {
    refresh().catch((err) => setError(errorMessage(err))).finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (!duel || (duel.status !== 'ACTIVE' && duel.status !== 'INVITED')) return
    const timer = window.setInterval(() => {
      api.get<Duel>(`/classroom-duels/${duel.id}`).then((response) => setDuel(response.data)).catch(() => undefined)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [duel?.id, duel?.status, openDuel])

  async function act(operation: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await operation() } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  async function invite() {
    if (!classroomId || !selectedPeer) return
    await act(async () => {
      const response = await api.post<{ id: string }>(`/classroom-duels/classrooms/${classroomId}`, { opponentEnrollmentId: selectedPeer })
      await Promise.all([refresh(), openDuel(response.data.id)])
    })
  }

  async function respond(accept: boolean) {
    if (!duel) return
    await act(async () => {
      const response = await api.post<Duel>(`/classroom-duels/${duel.id}/${accept ? 'accept' : 'decline'}`)
      setDuel(response.data)
      await refresh()
    })
  }

  async function submit() {
    if (!duel?.question || !selectedAnswer) return
    await act(async () => {
      const response = await api.post<Duel>(`/classroom-duels/${duel.id}/answers`, { ordinal: duel.question!.ordinal, answer: selectedAnswer })
      setDuel(response.data)
      setSelectedAnswer('')
      await refresh()
    })
  }

  async function toggle(source: Source) {
    if (!classroomId) return
    await act(async () => {
      const response = await api.put<Dashboard>(`/classroom-duels/classrooms/${classroomId}/sources/${source.id}`, { enabled: !source.enabled })
      setDashboard(response.data)
    })
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#10132c] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(108,74,230,.28),transparent_35%),radial-gradient(circle_at_95%_25%,rgba(38,193,183,.14),transparent_35%)]" />
      <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-5 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to={`/aula/${classroomId}/actividades`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10"><ArrowLeft size={17} /> Actividades</Link>
          <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em] text-violet-200">Edusyn Arena</span>
        </header>

        <div className="mt-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-teal-300">{dashboard?.classroomTitle ?? 'Aula'}</p>
            <h1 className="mt-2 flex items-center gap-3 text-4xl font-black tracking-tight sm:text-5xl"><Swords className="h-9 w-9 text-amber-300" /> Duelos</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Siete preguntas compartidas. Cada estudiante responde a su ritmo; el resultado aparece cuando ambos terminan.</p>
          </div>
          {dashboard && <div className="rounded-2xl border border-white/10 bg-white/[.06] px-5 py-3 text-sm"><span className="text-2xl font-black text-amber-300">{dashboard.questionCount}</span><span className="ml-2 text-slate-300">preguntas disponibles</span></div>}
        </div>

        {error && <div role="alert" className="mt-6 rounded-xl border border-rose-400/40 bg-rose-400/10 p-4 text-sm text-rose-100">{error}</div>}
        {loading && <p className="mt-10 text-slate-300">Cargando Arena…</p>}

        {dashboard?.role === 'teacher' && <main className="mt-8 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <section className="rounded-3xl border border-white/10 bg-[#202445] p-5 shadow-2xl sm:p-7">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/15 text-teal-200"><Check size={22} /></span><div><h2 className="text-xl font-bold">Prepara el banco de preguntas</h2><p className="text-sm text-slate-300">Habilita cuestionarios publicados para esta aula.</p></div></div>
            {dashboard.sources.length === 0 ? <p className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-slate-300">Publica un cuestionario con preguntas de opción múltiple o verdadero/falso para activar los duelos.</p> : <div className="mt-5 space-y-3">{dashboard.sources.map((source) => <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4"><div><p className="font-semibold">{source.title}</p><p className="mt-1 text-xs text-slate-300">{source.questionCount} preguntas en la actividad</p></div><button type="button" disabled={busy} onClick={() => toggle(source)} className={`min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${source.enabled ? 'bg-teal-300 text-[#132238]' : 'border border-white/25 text-white'}`}>{source.enabled ? 'Habilitado' : 'Habilitar'}</button></div>)}</div>}
          </section>
          <aside className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-6"><h2 className="text-lg font-bold text-amber-200">Reglas de esta actividad</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200"><li>• Necesita al menos 7 preguntas compatibles.</li><li>• Ambos reciben las mismas preguntas.</li><li>• Al terminar los dos, ven respuestas y explicaciones.</li><li>• El resultado es privado para los participantes.</li><li>• No cambia las notas del aula.</li><li>• Cada estudiante puede enviar 3 retos en 24 horas.</li></ul></aside>
        </main>}

        {dashboard?.role === 'student' && <main className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-violet-300/20 bg-[#222348] p-5 shadow-2xl sm:p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-400/20 text-violet-200"><Users size={22} /></span>
              <h2 className="mt-4 text-xl font-bold">Invita a un compañero</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Puede aceptar el reto durante 48 horas. Después, ambos responden a su ritmo.</p>
              {dashboard.questionCount < dashboard.minimumQuestions ? <p className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">El docente aún debe habilitar {dashboard.minimumQuestions} preguntas compatibles para abrir Arena.</p> : <div className="mt-5 flex flex-col gap-3"><label htmlFor="duel-peer" className="text-sm font-semibold">Compañero del grupo</label><select id="duel-peer" value={selectedPeer} onChange={(event) => setSelectedPeer(event.target.value)} className="min-h-12 rounded-xl border border-white/20 bg-[#151936] px-4 text-white"><option value="">Elige a alguien</option>{dashboard.peers.map((peer) => <option key={peer.id} value={peer.id}>{peer.name}</option>)}</select><button type="button" disabled={!selectedPeer || busy} onClick={invite} className="mt-1 min-h-12 rounded-xl bg-amber-300 px-5 font-bold text-[#202036] disabled:opacity-50">Enviar reto <ChevronRight size={18} className="ml-1 inline" /></button></div>}
            </section>
            <section className="rounded-3xl border border-white/10 bg-[#1d2240] p-5 sm:p-7"><h2 className="text-xl font-bold">Mis duelos</h2><div className="mt-4 space-y-2">{dashboard.duels.length === 0 && <p className="text-sm text-slate-300">Todavía no tienes partidas.</p>}{dashboard.duels.map((item) => <button key={item.id} type="button" onClick={() => act(() => openDuel(item.id))} className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ${duel?.id === item.id ? 'border-teal-300 bg-teal-300/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}><span><span className="block font-semibold">{item.opponent}</span><span className="mt-0.5 block text-xs text-slate-300">{statusLabel[item.status] ?? item.status} · {item.myProgress}/7 respondidas</span></span><ChevronRight size={18} /></button>)}</div></section>
          </div>

          <section className="min-h-[320px] rounded-3xl border border-white/10 bg-[#f7f4e8] p-5 text-[#24243c] shadow-2xl sm:p-7" aria-live="polite">
            {!duel && <div className="flex h-full min-h-[270px] flex-col items-center justify-center text-center"><Swords size={44} className="text-violet-600" /><h2 className="mt-4 text-2xl font-black">Tu próxima partida empieza aquí</h2><p className="mt-2 max-w-sm text-sm text-[#5d6074]">Elige un compañero o abre uno de tus duelos para continuar.</p></div>}
            {duel?.status === 'INVITED' && <div><Clock3 className="text-violet-600" size={36} /><h2 className="mt-5 text-2xl font-black">{duel.isInvitee ? 'Te invitaron a jugar' : 'Esperando respuesta'}</h2><p className="mt-2 text-sm text-[#5d6074]">{duel.isInvitee ? 'Las siete preguntas serán iguales para ambos. ¿Aceptas el duelo?' : 'Tu compañero verá la invitación al entrar en esta aula.'}</p>{duel.isInvitee && <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => respond(true)} className="min-h-12 rounded-xl bg-violet-700 px-5 font-bold text-white">Aceptar reto</button><button type="button" disabled={busy} onClick={() => respond(false)} className="min-h-12 rounded-xl border border-[#c4c4ce] px-5 font-semibold">Rechazar</button></div>}</div>}
            {duel?.status === 'ACTIVE' && duel.question && <div><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">Pregunta {duel.question.ordinal + 1} de {duel.total}</span><span className="text-xs font-semibold text-[#5d6074]">Rival: {duel.opponentProgress}/{duel.total}</span></div><div className="mt-5 flex gap-1.5" aria-label={`${duel.myProgress} de ${duel.total} preguntas respondidas`}>{Array.from({ length: duel.total }, (_, index) => <span key={index} className={`h-2 flex-1 rounded-full ${index < duel.myProgress ? 'bg-teal-500' : 'bg-[#dcdbe6]'}`} />)}</div><h2 className="mt-7 text-xl font-bold leading-snug sm:text-2xl">{duel.question.text}</h2><div className="mt-6 space-y-3">{duel.question.options.map((option, index) => <button key={`${index}-${option}`} type="button" onClick={() => setSelectedAnswer(option)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${selectedAnswer === option ? 'border-violet-600 bg-violet-100 text-violet-900' : 'border-[#d5d4db] bg-white hover:border-violet-400'}`} aria-pressed={selectedAnswer === option}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#efedf5] text-xs font-black">{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><button type="button" disabled={!selectedAnswer || busy} onClick={submit} className="mt-6 min-h-12 w-full rounded-xl bg-violet-700 px-5 font-bold text-white disabled:opacity-50">Confirmar respuesta <ChevronRight size={18} className="ml-1 inline" /></button></div>}
            {duel?.status === 'ACTIVE' && !duel.question && <div className="flex min-h-[270px] flex-col items-center justify-center text-center"><Clock3 size={43} className="text-teal-600" /><h2 className="mt-4 text-2xl font-black">Terminaste tus preguntas</h2><p className="mt-2 text-sm text-[#5d6074]">Tu compañero lleva {duel.opponentProgress} de {duel.total}. El resultado aparecerá aquí cuando termine.</p></div>}
            {duel?.status === 'COMPLETED' && duel.result && <div><Trophy className="text-amber-600" size={39} /><h2 className="mt-4 text-2xl font-black">Duelo terminado</h2><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-violet-100 p-4"><span className="block text-xs font-bold uppercase text-violet-700">Tú</span><strong className="text-3xl">{duel.result.myScore}/{duel.total}</strong></div><div className="rounded-xl bg-teal-100 p-4"><span className="block text-xs font-bold uppercase text-teal-700">Compañero</span><strong className="text-3xl">{duel.result.opponentScore}/{duel.total}</strong></div></div><p className="mt-4 font-semibold">{duel.result.myScore === duel.result.opponentScore ? '¡Empate!' : duel.result.myScore > duel.result.opponentScore ? '¡Ganaste este duelo!' : 'Esta vez ganó tu compañero. Sigue practicando.'}</p><details className="mt-5 rounded-xl border border-[#dedce5] bg-white p-4"><summary className="cursor-pointer font-bold">Repasar respuestas</summary><ol className="mt-4 space-y-4">{duel.result.review.map((item, index) => <li key={index} className="border-t border-[#e8e5ed] pt-3 text-sm"><span className={`mr-2 inline-flex align-middle ${item.myCorrect ? 'text-teal-700' : 'text-rose-600'}`}>{item.myCorrect ? <Check size={16} /> : <X size={16} />}</span><strong>{item.text}</strong><p className="mt-1">Respuesta: {item.correctAnswer}</p>{item.explanation && <p className="mt-1 text-[#5d6074]">{item.explanation}</p>}</li>)}</ol></details></div>}
            {(duel?.status === 'DECLINED' || duel?.status === 'EXPIRED') && <div className="flex min-h-[270px] flex-col items-center justify-center text-center"><Clock3 size={38} className="text-[#8d8b9b]" /><h2 className="mt-4 text-2xl font-black">{duel.status === 'EXPIRED' ? 'Este reto venció' : 'El reto fue rechazado'}</h2><p className="mt-2 text-sm text-[#5d6074]">Puedes iniciar otro duelo con un compañero.</p></div>}
          </section>
        </main>}
      </div>
    </div>
  )
}
