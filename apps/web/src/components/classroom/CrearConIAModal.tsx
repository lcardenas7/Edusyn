import { useMemo, useRef, useState } from 'react'
import {
  Sparkles, X, Copy, Check, ArrowLeft, Loader2, BookOpen, HelpCircle,
  ClipboardList, FileUp, Upload, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { classroomApi, lessonApi } from '../../lib/api'
import { extractJson } from '../../lib/extractJson'

// ─────────────────────────────────────────────────────────────────────────────
// "Crear con IA" — flujo guiado dentro del Aula.
//
// Principio: Edusyn guía, la IA genera, el docente decide. Edusyn NO es un chat de
// IA: prepara el prompt exacto (derivado del formato real que entiende el importador),
// el docente lo lleva a ChatGPT/Gemini/Claude, y trae el resultado de vuelta.
//
// Reutiliza los motores que ya existen (no duplica importadores):
//   - Quiz    → createActivity(QUIZ)  + importQuestions (endpoint tolerante)
//   - Lección → createActivity(LESSON) + lessonApi.create (mismo camino que "Importar")
//   - Tarea   → createActivity(TASK)   con el texto generado como enunciado
// Todo se crea como BORRADOR (isPublished:false): nunca se publica solo.
// ─────────────────────────────────────────────────────────────────────────────

type ContentType = 'lesson' | 'quiz' | 'task'
type Step = 'type' | 'instructions' | 'bring' | 'done'

interface Props {
  classroomId: string
  academicTermId?: string
  onClose: () => void
  onCreated: (activityId: string) => void
}

// Clases Tailwind LITERALES (no interpolar: el purge no detecta `bg-${x}-50`).
const TYPES: { key: ContentType; label: string; desc: string; icon: any; iconWrap: string; iconColor: string }[] = [
  { key: 'lesson', label: 'Lección', desc: 'Contenido interactivo con explicaciones y actividades', icon: BookOpen, iconWrap: 'bg-violet-50', iconColor: 'text-violet-600' },
  { key: 'quiz', label: 'Quiz', desc: 'Banco de preguntas con sus respuestas', icon: HelpCircle, iconWrap: 'bg-purple-50', iconColor: 'text-purple-600' },
  { key: 'task', label: 'Tarea', desc: 'Enunciado y criterios para que el alumno entregue', icon: ClipboardList, iconWrap: 'bg-blue-50', iconColor: 'text-blue-600' },
]

const DIFICULTADES = ['Básica', 'Media', 'Alta']

export default function CrearConIAModal({ classroomId, academicTermId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('type')
  const [type, setType] = useState<ContentType | null>(null)
  const [tema, setTema] = useState('')
  const [grado, setGrado] = useState('')
  const [asignatura, setAsignatura] = useState('')
  const [dificultad, setDificultad] = useState('Media')
  const [cantidad, setCantidad] = useState('5')
  const [copied, setCopied] = useState(false)
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ type: string; title: string; count?: number; skipped?: any[]; activityId: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cantidadLabel = type === 'lesson' ? 'Número de actividades' : type === 'quiz' ? 'Número de preguntas' : ''

  // ── Prompt generado a la medida (se copia hacia la IA externa) ────────────────
  const prompt = useMemo(() => buildPrompt(type, { tema, grado, asignatura, dificultad, cantidad }), [type, tema, grado, asignatura, dificultad, cantidad])

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setError('No se pudo copiar automáticamente. Selecciona el texto y cópialo a mano.') }
  }

  const loadFile = async (file: File) => {
    try { setRaw(await file.text()) } catch { setError('No se pudo leer el archivo.') }
  }

  // ── Traer a Edusyn: valida y crea reutilizando el motor por tipo ──────────────
  const handleBring = async () => {
    if (!type || !raw.trim()) return
    setError('')
    setBusy(true)
    try {
      const titulo = tema.trim() || defaultTitle(type)

      if (type === 'quiz') {
        let parsed: any
        try { parsed = extractJson(raw) } catch (e: any) { throw new FriendlyError(e?.message || 'No se pudo leer el JSON. Revisa que hayas copiado el resultado completo de la IA.') }
        const { data: act } = await classroomApi.createActivity(classroomId, { type: 'QUIZ', title: titulo, academicTermId })
        try {
          const { data: imp } = await classroomApi.importQuestions(act.id, parsed)
          setResult({ type: 'Quiz', title: titulo, count: imp.created, skipped: imp.skipped, activityId: act.id })
        } catch (e: any) {
          // La actividad ya se creó vacía; el docente puede reintentar el import adentro.
          throw new FriendlyError(e?.response?.data?.message || 'No se pudieron leer las preguntas del archivo. Verifica que la IA haya generado el quiz completo.')
        }
      } else if (type === 'lesson') {
        let parsed: any
        try { parsed = extractJson(raw) } catch (e: any) { throw new FriendlyError(e?.message || 'No se pudo leer el JSON. Revisa que hayas copiado el resultado completo de la IA.') }
        const snap = parsed?.lesson || (Array.isArray(parsed?.slides) ? parsed : null)
        if (!snap || !Array.isArray(snap.slides) || snap.slides.length === 0) {
          throw new FriendlyError('La lección no tiene diapositivas. Verifica que la IA haya generado el contenido completo.')
        }
        const t = (snap.title || titulo).toString()
        const { data: act } = await classroomApi.createActivity(classroomId, { type: 'LESSON', title: t, academicTermId })
        await lessonApi.create(act.id, {
          title: t,
          description: snap.description || undefined,
          estimatedMinutes: snap.estimatedMinutes ? parseInt(snap.estimatedMinutes) : undefined,
          slides: snap.slides.map((s: any, i: number) => ({ ...s, id: undefined, sortOrder: i })),
        } as any)
        setResult({ type: 'Lección', title: t, count: snap.slides.length, activityId: act.id })
      } else {
        // Tarea: el texto pegado es el enunciado.
        const { data: act } = await classroomApi.createActivity(classroomId, { type: 'TASK', title: titulo, description: raw.trim(), academicTermId })
        setResult({ type: 'Tarea', title: titulo, activityId: act.id })
      }
      setStep('done')
    } catch (e: any) {
      setError(e instanceof FriendlyError ? e.message : (e?.response?.data?.message || 'No se pudo crear el contenido. Inténtalo de nuevo.'))
    } finally { setBusy(false) }
  }

  const isJsonType = type === 'lesson' || type === 'quiz'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && onClose()}>
      <div className="bg-surface-1 rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-hairline">
          <div className="flex items-center gap-2">
            {step !== 'type' && step !== 'done' && (
              <button onClick={() => { setError(''); setStep(step === 'bring' ? 'instructions' : 'type') }} className="p-1.5 rounded-lg hover:bg-slate-100 -ml-1.5" title="Atrás"><ArrowLeft className="w-5 h-5 text-slate-500" /></button>
            )}
            <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" /> Crear con IA
            </h4>
          </div>
          <button onClick={() => !busy && onClose()} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          {/* PASO 1 — Tipo */}
          {step === 'type' && (
            <div>
              <p className="text-sm text-slate-500 mb-4">¿Qué quieres crear? La IA lo genera y tú lo revisas antes de usarlo.</p>
              <div className="grid gap-3">
                {TYPES.map(t => {
                  const Icon = t.icon
                  return (
                    <button key={t.key} onClick={() => { setType(t.key); setError(''); setStep('instructions') }}
                      className="flex items-center gap-4 text-left border-2 border-hairline rounded-2xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${t.iconWrap}`}>
                        <Icon className={`w-6 h-6 ${t.iconColor}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{t.label}</div>
                        <div className="text-xs text-slate-500">{t.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* PASO 2 — Instrucciones (params + prompt) */}
          {step === 'instructions' && type && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Cuéntale a la IA qué necesitas. Edusyn arma las instrucciones exactas para que el archivo sea compatible.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Tema" value={tema} onChange={setTema} placeholder="Ej. La fotosíntesis" full />
                <Field label="Grado" value={grado} onChange={setGrado} placeholder="Ej. 6º" />
                <Field label="Asignatura" value={asignatura} onChange={setAsignatura} placeholder="Ej. Ciencias" />
                <div>
                  <label className="text-xs font-semibold text-slate-600">Dificultad</label>
                  <select value={dificultad} onChange={e => setDificultad(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                    {DIFICULTADES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {cantidadLabel && <Field label={cantidadLabel} value={cantidad} onChange={setCantidad} placeholder="Ej. 5" type="number" />}
              </div>

              <div className="bg-slate-50 border border-hairline rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600">Instrucciones para la IA</span>
                  <button onClick={copyPrompt} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">
                    {copied ? <><Check className="w-3.5 h-3.5" /> ¡Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar instrucciones</>}
                  </button>
                </div>
                <pre className="text-[11px] leading-relaxed text-slate-500 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">{prompt}</pre>
              </div>
              <p className="text-xs text-slate-500">Pégalas en ChatGPT, Gemini o Claude. Cuando la IA responda, copia su resultado y vuelve aquí.</p>

              <div className="flex justify-end">
                <button onClick={() => { setError(''); setRaw(''); setStep('bring') }} disabled={!tema.trim()} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  Ya tengo el resultado →
                </button>
              </div>
            </div>
          )}

          {/* PASO 3 — Traer a Edusyn */}
          {step === 'bring' && type && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  {isJsonType ? 'Pega aquí lo que generó la IA' : 'Pega aquí el enunciado que generó la IA'}
                </label>
                {isJsonType && (
                  <>
                    <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      <Upload className="w-3.5 h-3.5" /> Subir archivo
                    </button>
                    <input ref={fileRef} type="file" accept=".json,application/json,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.currentTarget.value = '' }} />
                  </>
                )}
              </div>
              <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={12}
                placeholder={isJsonType ? '{\n  "questions": [ ... ]\n}' : 'Objetivo, instrucciones y criterios de la tarea…'}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 resize-y" />
              <p className="text-xs text-slate-500">Se creará como <strong>borrador</strong>. Nada se publica automáticamente: tú decides.</p>
            </div>
          )}

          {/* PASO 4 — Listo */}
          {step === 'done' && result && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h5 className="text-lg font-bold text-slate-800">¡{result.type} creada!</h5>
              <p className="text-sm text-slate-500 mt-1">“{result.title}” está lista para revisar.</p>
              <div className="mt-4 inline-block text-left bg-slate-50 border border-hairline rounded-xl px-4 py-3 text-sm text-slate-600">
                <div><span className="text-slate-400">Tipo:</span> {result.type}</div>
                {result.count !== undefined && <div><span className="text-slate-400">{result.type === 'Lección' ? 'Diapositivas' : 'Preguntas'}:</span> {result.count}</div>}
                {!!result.skipped?.length && (
                  <div className="mt-1 text-amber-700 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{result.skipped.length} pregunta(s) se omitieron: {result.skipped[0]?.reason}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-3">Está en modo borrador. Revísala y publícala cuando quieras.</p>
            </div>
          )}
        </div>

        {/* Footer acciones (solo paso traer / done) */}
        {step === 'bring' && (
          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-hairline">
            <button onClick={() => { setError(''); setStep('instructions') }} disabled={busy} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50">Atrás</button>
            <button onClick={handleBring} disabled={busy || !raw.trim()} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</> : <><FileUp className="w-4 h-4" /> Traer a Edusyn</>}
            </button>
          </div>
        )}
        {step === 'done' && result && (
          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-hairline">
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cerrar</button>
            <button onClick={() => onCreated(result.activityId)} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700">Revisar contenido</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', full = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
  )
}

class FriendlyError extends Error {}

function defaultTitle(type: ContentType): string {
  return type === 'lesson' ? 'Lección con IA' : type === 'quiz' ? 'Quiz con IA' : 'Tarea con IA'
}

// ── Generadores de prompt (derivados del formato real que entiende el importador) ──
function paramsBlock(p: { tema: string; grado: string; asignatura: string; dificultad: string; cantidad: string }, incluirCantidad: boolean, cantidadLabel: string): string {
  const lines = [
    `- Tema: ${p.tema || '[especifica el tema]'}`,
    p.grado ? `- Grado: ${p.grado}` : '',
    p.asignatura ? `- Asignatura: ${p.asignatura}` : '',
    `- Dificultad: ${p.dificultad}`,
    incluirCantidad ? `- ${cantidadLabel}: ${p.cantidad || '5'}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

function buildPrompt(type: ContentType | null, p: { tema: string; grado: string; asignatura: string; dificultad: string; cantidad: string }): string {
  if (type === 'quiz') {
    return `Genera un quiz en formato JSON para importarlo en la plataforma educativa Edusyn.

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional y sin bloque de código markdown) con esta estructura:

{
  "questions": [
    { "type": "MULTIPLE_CHOICE", "text": "Enunciado", "options": ["A", "B", "C", "D"], "correct": "A", "explanation": "Por qué es correcta" },
    { "type": "TRUE_FALSE", "text": "Afirmación", "correct": true },
    { "type": "MULTIPLE_SELECT", "text": "Selecciona todas las correctas", "options": ["A", "B", "C", "D"], "correct": ["A", "C"] },
    { "type": "SHORT_ANSWER", "text": "Pregunta de respuesta corta", "correct": "respuesta esperada" },
    { "type": "FILL_BLANK", "text": "Completa: el cielo es ___", "answers": ["azul"] },
    { "type": "ORDERING", "text": "Ordena de menor a mayor", "items": ["1", "2", "3"] },
    { "type": "MATCHING", "text": "Une cada elemento", "pairs": [{ "left": "Perú", "right": "Lima" }] }
  ]
}

Reglas:
- En MULTIPLE_CHOICE, "correct" debe ser exactamente igual a una de las opciones.
- En ORDERING, "items" deben estar ya en el orden correcto.
- Incluye "explanation" en cada pregunta cuando ayude a aprender.
- Usa solo los tipos que necesites (no es obligatorio incluir todos).

IMPORTANTE — cómo entregarlo:
- Si tu herramienta puede generar archivos, entrégame además un archivo .json DESCARGABLE con este contenido (nómbralo quiz.json).
- Muéstrame también el JSON como texto plano para poder copiarlo, SIN cercas de código y sin comentarios.

Contenido solicitado:
${paramsBlock(p, true, 'Número de preguntas')}`
  }

  if (type === 'lesson') {
    return `Genera una lección interactiva en formato JSON para importarla en la plataforma educativa Edusyn.

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional y sin bloque de código markdown) con esta estructura:

{
  "lesson": {
    "title": "Título de la lección",
    "description": "Breve descripción",
    "estimatedMinutes": 15,
    "slides": [
      { "type": "CONTENT", "title": "Introducción", "body": "<p>Texto explicativo en HTML simple. Puedes usar &lt;p&gt;, &lt;ul&gt;&lt;li&gt;, &lt;strong&gt;.</p>" },
      { "type": "ACTIVITY", "activityData": { "questionType": "MULTIPLE_CHOICE", "question": "¿…?", "options": ["A", "B", "C"], "correctAnswer": "A", "explanation": "…" } },
      { "type": "ACTIVITY", "activityData": { "questionType": "TRUE_FALSE", "question": "…", "options": ["Verdadero", "Falso"], "correctAnswer": "Verdadero" } },
      { "type": "BADGE_REVEAL", "badgeEmoji": "🏆", "badgeTitle": "¡Lección completada!" }
    ]
  }
}

Reglas:
- Alterna diapositivas CONTENT (explicación) con ACTIVITY (una pregunta para practicar).
- questionType permitido: MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER.
- En MULTIPLE_CHOICE, "correctAnswer" debe ser el texto exacto de una de las opciones.
- Termina con una diapositiva BADGE_REVEAL.
- "body" admite HTML simple; no incluyas imágenes ni scripts.

IMPORTANTE — cómo entregarlo:
- Si tu herramienta puede generar archivos, entrégame además un archivo .json DESCARGABLE con este contenido (nómbralo leccion.json).
- Muéstrame también el JSON como texto plano para poder copiarlo, SIN cercas de código y sin comentarios.

Contenido solicitado:
${paramsBlock(p, true, 'Número de actividades')}`
  }

  // Tarea → texto plano, no JSON.
  return `Redacta el enunciado completo de una tarea escolar, lista para entregar a los estudiantes.

Devuelve ÚNICAMENTE el texto de la tarea (puedes usar viñetas y saltos de línea), sin JSON, sin comentarios ni explicaciones para mí.

Incluye:
- Objetivo de aprendizaje.
- Instrucciones paso a paso.
- Qué debe entregar el estudiante y en qué formato.
- Criterios de evaluación (una rúbrica breve).

Contenido solicitado:
${paramsBlock(p, false, '')}`
}
