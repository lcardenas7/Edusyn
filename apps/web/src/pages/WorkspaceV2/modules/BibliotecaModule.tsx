import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder, FolderPlus, Upload, Link2, Loader2, Search, Star, Trash2, X, Download,
  FileText, Image as ImageIcon, FileSpreadsheet, Film, File as FileIcon, ExternalLink,
} from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

interface Resource {
  id: string; name: string; type: string; url: string; mimeType?: string | null
  sizeBytes?: number | null; tags?: string[]; isFavorite?: boolean; folderId?: string | null; createdAt?: string
}
interface FolderT { id: string; name: string; count: number }

function fileIcon(r: Resource) {
  if (r.type === 'LINK') return ExternalLink
  if (r.type === 'VIDEO') return Film
  const m = r.mimeType || ''
  if (m.startsWith('image/')) return ImageIcon
  if (m.includes('pdf')) return FileText
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet
  if (m.includes('word') || m.includes('document')) return FileText
  return FileIcon
}
function sizeLabel(n?: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

export function BibliotecaModule({ boardId }: { boardId: string }) {
  const [folders, setFolders] = useState<FolderT[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [rootCount, setRootCount] = useState(0)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    teacherWorkspaceApi.listResources(boardId, activeFolder ?? undefined)
      .then((res) => { setFolders(res.data?.folders ?? []); setResources(res.data?.resources ?? []); setRootCount(res.data?.rootCount ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boardId, activeFolder])
  useEffect(() => { load() }, [load])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('boardId', boardId)
      if (activeFolder) fd.append('folderId', activeFolder)
      await teacherWorkspaceApi.uploadResource(fd)
      load()
    } catch { /* noop */ } finally { setUploading(false) }
  }
  const addLink = async () => {
    if (!linkUrl.trim()) return
    await teacherWorkspaceApi.addResourceLink({ boardId, url: linkUrl.trim(), name: linkName.trim() || linkUrl.trim(), folderId: activeFolder ?? undefined })
    setLinkUrl(''); setLinkName(''); setAddingLink(false); load()
  }
  const addFolder = async () => {
    if (!folderName.trim()) return
    await teacherWorkspaceApi.createFolder({ boardId, name: folderName.trim() })
    setFolderName(''); setAddingFolder(false); load()
  }
  const open = async (r: Resource) => {
    if (r.type !== 'FILE') { window.open(r.url, '_blank'); return }
    const res = await teacherWorkspaceApi.downloadResource(r.id)
    if (res.data?.url) window.open(res.data.url, '_blank')
  }
  const toggleFav = async (r: Resource) => {
    await teacherWorkspaceApi.updateResource(r.id, { isFavorite: !r.isFavorite })
    setResources((prev) => prev.map((x) => x.id === r.id ? { ...x, isFavorite: !x.isFavorite } : x))
  }
  const remove = async (r: Resource) => { await teacherWorkspaceApi.deleteResource(r.id); setResources((prev) => prev.filter((x) => x.id !== r.id)) }

  const q = search.toLowerCase().trim()
  const filtered = resources.filter((r) => !q || `${r.name} ${(r.tags ?? []).join(' ')}`.toLowerCase().includes(q))

  return (
    <div>
      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir archivo
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
        <button onClick={() => setAddingLink((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:border-slate-300">
          <Link2 className="w-4 h-4" /> Enlace
        </button>
        <button onClick={() => setAddingFolder((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:border-slate-300">
          <FolderPlus className="w-4 h-4" /> Carpeta
        </button>
        <div className="relative flex-1 min-w-[140px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-violet-400 focus:outline-none" />
        </div>
      </div>

      {addingLink && (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-2">
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400" />
          <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Nombre (opcional)" className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400" />
          <button onClick={addLink} disabled={!linkUrl.trim()} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">Agregar</button>
        </div>
      )}
      {addingFolder && (
        <div className="rounded-2xl bg-white border border-slate-200 p-3 mb-4 flex items-center gap-2">
          <input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addFolder() }} placeholder="Nombre de la carpeta" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400" />
          <button onClick={addFolder} disabled={!folderName.trim()} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">Crear</button>
        </div>
      )}

      {/* Carpetas (chips) */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setActiveFolder(null)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${!activeFolder ? 'bg-violet-100 text-violet-700' : 'bg-white border border-slate-200 text-slate-600'}`}>
            Todo ({rootCount + folders.reduce((a, f) => a + f.count, 0)})
          </button>
          {folders.map((f) => (
            <button key={f.id} onClick={() => setActiveFolder(f.id)} className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeFolder === f.id ? 'bg-violet-100 text-violet-700' : 'bg-white border border-slate-200 text-slate-600'}`}>
              <Folder className="w-3.5 h-3.5" /> {f.name} ({f.count})
              <span onClick={async (e) => { e.stopPropagation(); await teacherWorkspaceApi.deleteFolder(f.id); if (activeFolder === f.id) setActiveFolder(null); load() }} className="opacity-0 group-hover:opacity-100 hover:text-red-500"><X className="w-3 h-3" /></span>
            </button>
          ))}
        </div>
      )}

      {/* Grid de recursos */}
      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-12 text-center">
          <Upload className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Tu biblioteca está vacía. Sube archivos o guarda enlaces.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence initial={false}>
            {filtered.map((r) => {
              const Icon = fileIcon(r)
              return (
                <motion.div key={r.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  className="group relative rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition p-3">
                  <button onClick={() => open(r)} className="w-full text-left">
                    <div className="w-full h-16 rounded-xl bg-slate-50 flex items-center justify-center mb-2">
                      <Icon className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate">{r.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {r.type === 'FILE' ? sizeLabel(r.sizeBytes) : r.type === 'VIDEO' ? 'Video' : 'Enlace'}
                    </p>
                  </button>
                  {/* Acciones */}
                  <div className="absolute top-2 right-2 flex items-center gap-0.5">
                    <button onClick={() => toggleFav(r)} className={`p-1 rounded ${r.isFavorite ? 'text-amber-400' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}>
                      <Star className="w-3.5 h-3.5" fill={r.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => open(r)} className="p-1 rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:text-violet-500"><Download className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(r)} className="p-1 rounded text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
