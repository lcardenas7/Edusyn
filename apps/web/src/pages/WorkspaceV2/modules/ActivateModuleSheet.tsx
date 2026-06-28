import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { activatableModules, type ModuleKey } from './moduleRegistry'

interface ActivateModuleSheetProps {
  open: boolean
  activeKeys: ModuleKey[]
  onClose: () => void
  onActivate: (key: ModuleKey) => void
}

export function ActivateModuleSheet({ open, activeKeys, onClose, onActivate }: ActivateModuleSheetProps) {
  const options = activatableModules(activeKeys)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden pointer-events-auto flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>Activar módulo</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Agrega una nueva forma de organizar este espacio</p>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition" aria-label="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto p-4">
                {options.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Ya activaste todos los módulos disponibles.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {options.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => onActivate(m.key)}
                        className="text-left rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-sm transition p-4 flex items-start gap-3"
                      >
                        <div className={`w-10 h-10 rounded-xl ${m.iconBg} flex items-center justify-center text-xl flex-shrink-0`}>{m.emoji}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{m.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
