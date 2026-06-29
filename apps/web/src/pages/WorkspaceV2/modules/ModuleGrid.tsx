import { motion } from 'framer-motion'
import { Plus, ChevronRight } from 'lucide-react'
import { MODULES, type ModuleKey } from './moduleRegistry'

interface ModuleGridProps {
  activeKeys: ModuleKey[]
  counts: Partial<Record<ModuleKey, number>>
  onOpen: (key: ModuleKey) => void
  onActivate: () => void
}

export function ModuleGrid({ activeKeys, counts, onOpen, onActivate }: ModuleGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Módulos</h2>
        <button
          type="button"
          onClick={onActivate}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800 transition"
        >
          <Plus className="w-4 h-4" /> Activar módulo
        </button>
      </div>

      {activeKeys.length === 0 ? (
        <button
          type="button"
          onClick={onActivate}
          className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 py-10 text-center hover:border-violet-300 transition"
        >
          <span className="text-sm text-slate-500">
            Este espacio aún no tiene módulos. <span className="text-violet-600 font-medium">Activa el primero</span>.
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeKeys.map((key, idx) => {
            const m = MODULES[key]
            const count = counts[key] ?? 0
            return (
              <motion.button
                key={key}
                type="button"
                onClick={() => onOpen(key)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                whileHover={{ y: -2 }}
                className="group text-left rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md transition p-4 flex items-start gap-3"
              >
                <div className={`w-10 h-10 rounded-xl ${m.iconBg} flex items-center justify-center text-xl flex-shrink-0`}>
                  {m.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-800 text-sm">{m.label}</h3>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {m.status === 'soon'
                      ? 'Próximamente'
                      : count > 0
                        ? `${count} ${count === 1 ? 'registro' : 'registros'}`
                        : 'Sin registros aún'}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
