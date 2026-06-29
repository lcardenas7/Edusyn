import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import type { SpaceCardBoard } from './SpaceCard'

interface DeleteSpaceModalProps {
  board: SpaceCardBoard | null
  onClose: () => void
  onConfirm: (board: SpaceCardBoard) => Promise<void>
}

export function DeleteSpaceModal({ board, onClose, onConfirm }: DeleteSpaceModalProps) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    if (!board) return
    setBusy(true)
    try {
      await onConfirm(board)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {board && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => !busy && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl bg-white shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              ¿Eliminar “{board.title}”?
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Si el espacio tiene contenido (bitácora, recaudos, roles, recursos…),
              se <strong>archiva</strong> y podrás recuperarlo. Si está completamente
              vacío, se <strong>elimina</strong>. Esto no afecta notas, asistencia ni
              nada del sistema académico — es solo tu espacio personal.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !busy && onClose()}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Eliminar espacio
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
