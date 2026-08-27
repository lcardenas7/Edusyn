import { useEffect, useRef, useState } from 'react'
import { PenLine, X, Upload } from 'lucide-react'
import { storageApi, toPublicFileUrl } from '../lib/api'
import { toast } from '../lib/toast'

interface Props {
  open: boolean
  onClose: () => void
  /** URL/clave guardada de la firma del usuario (user.signatureImageUrl). */
  initialUrl?: string | null
  /** Se invoca con la nueva URL tras subir, por si el padre quiere refrescar. */
  onUploaded?: (url: string) => void
}

/**
 * Modal personal "Mi firma": el docente (o director de grupo) sube su firma una
 * sola vez y queda asociada a su perfil. El boletín la lee automáticamente para
 * el rol Director(a) de Grupo. Vive en la tarjeta de usuario (disponible en
 * todas las pantallas), no en Asistencia.
 */
export default function MySignatureModal({ open, onClose, initialUrl, onUploaded }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Al abrir, se muestra la firma guardada (si hay).
  useEffect(() => {
    if (open) setPreviewUrl(initialUrl ? toPublicFileUrl(initialUrl) : '')
  }, [open, initialUrl])

  if (!open) return null

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const res = await storageApi.uploadMySignature(file)
      const url = res.data?.data?.url || res.data?.data?.path || ''
      if (url) {
        // El backend devuelve la clave/URL cruda; para mostrarla hay que pasarla
        // por el proxy público (igual que el boletín), o el <img> sale roto.
        setPreviewUrl(toPublicFileUrl(url))
        onUploaded?.(url)
        toast.success('Firma guardada. Aparecerá en tus boletines automáticamente.')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo subir la firma. Debe ser PNG o JPG y menor a 200KB.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <PenLine className="w-4 h-4 text-purple-600" />
            Mi firma
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Cerrar">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-slate-500">
            Sube tu firma (fondo transparente PNG, idealmente). Se adjunta automáticamente en los
            boletines de los grupos que diriges, en el espacio de <b>Director(a) de Grupo</b>.
          </p>

          <div className="flex items-center justify-center border border-dashed border-slate-300 rounded-xl bg-slate-50 p-4 min-h-[96px]">
            {previewUrl ? (
              <img src={previewUrl} alt="Mi firma" className="h-20 object-contain" />
            ) : (
              <span className="text-sm text-slate-400">Aún no has subido tu firma</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Subiendo…' : previewUrl ? 'Cambiar firma' : 'Subir mi firma'}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      </div>
    </div>
  )
}
