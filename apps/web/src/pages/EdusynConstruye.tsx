import { Code2, Compass, Palette, ShieldCheck, Sparkles, Users, type LucideIcon } from 'lucide-react'
import CodeWorkspace from '../features/construye/CodeWorkspace'
import BriefBuilder from '../features/construye/BriefBuilder'

/** Maqueta local de F0: sin red, sin proyecto real, solo para explorar la mecánica del
 * editor y el preview aislado durante desarrollo. El flujo conectado a un proyecto real
 * vive dentro del Aula Virtual, como el destino "Construye" (features/construye/ConstruyeTab). */
export default function EdusynConstruye() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <section className="relative mb-6 overflow-hidden rounded-[32px] bg-[#10283a] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-300/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div><p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-200"><Sparkles className="h-4 w-4" /> Edusyn Crea</p><h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">De una idea a una aplicación que pueden explicar.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Imaginen una solución, constrúyanla con apoyo de IA y descubran cómo cada parte del código cobra vida.</p></div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200"><Palette className="h-4 w-4 text-orange-300" /> Aprender creando</span>
        </div>
      </section>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Info icon={Compass} title="1. Imaginen" text="El equipo define el problema y prepara una petición clara para su IA externa." />
        <Info icon={Code2} title="2. Comprendan" text="Contenido, diseño y acciones se conectan visualmente con el resultado." />
        <Info icon={ShieldCheck} title="3. Prueben con seguridad" text="El proyecto se ejecuta aislado, sin sesión ni datos académicos." />
      </div>
      <BriefBuilder />
      <CodeWorkspace />
      <section className="mt-6 rounded-2xl border border-hairline bg-surface-1 p-5">
        <div className="flex items-center gap-2 text-slate-800"><Users className="h-5 w-5 text-indigo-600" /><h2 className="font-bold">Acompañamiento docente</h2></div>
        <p className="mt-2 text-sm text-slate-600">Edusyn Crea conserva fuentes, decisiones, pruebas y versiones por equipo. El docente acompaña con pistas y revisa entregas sin observar la pantalla ni el teclado del estudiante.</p>
      </section>
    </main>
  )
}

function Info({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Icon className="h-4 w-4" /></span><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{text}</p></article>
}
