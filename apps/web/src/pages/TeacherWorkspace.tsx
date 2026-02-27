import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { teacherWorkspaceApi } from '../lib/api'
import {
  Plus, Trash2, X, GripVertical, MoreHorizontal,
  LayoutGrid, BookOpen, Archive, ChevronDown,
  Pencil, Check, Clock, AlertCircle, Loader2,
  DollarSign, Users, Target, Percent
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface WorkspaceItem {
  id: string
  boardId: string
  columnId: string | null
  studentId: string | null
  title: string
  content: string | null
  metadata: any
  status: string
  dueDate: string | null
  sortOrder: number
  isArchived: boolean
  student?: { id: string; firstName: string; lastName: string } | null
}

interface WorkspaceColumn {
  id: string
  boardId: string
  title: string
  sortOrder: number
  color: string | null
  items: WorkspaceItem[]
}

interface WorkspaceBoard {
  id: string
  type: string
  title: string
  description: string | null
  color: string | null
  groupId: string | null
  metadata: any
  isArchived: boolean
  group?: { id: string; name: string; grade?: { name: string } } | null
  columns?: WorkspaceColumn[]
  items?: WorkspaceItem[]
  _count?: { items: number }
}

const BOARD_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  KANBAN: { label: 'Tablero Kanban', icon: '📋', color: '#3b82f6' },
  CLASS_LOG: { label: 'Bitácora de Clase', icon: '📖', color: '#8b5cf6' },
  STUDENT_NOTES: { label: 'Seguimiento Individual', icon: '👤', color: '#10b981' },
  CHECKLIST: { label: 'Lista de Verificación', icon: '✅', color: '#f59e0b' },
  MICRO_COLLECT: { label: 'Micro-recaudo', icon: '💰', color: '#ef4444' },
  CLASSROOM_ROLES: { label: 'Roles del Aula', icon: '🎭', color: '#ec4899' },
  PROJECT: { label: 'Proyecto Especial', icon: '🚀', color: '#6366f1' },
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  TODO: <Clock className="w-3 h-3 text-slate-400" />,
  IN_PROGRESS: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
  DONE: <Check className="w-3 h-3 text-green-500" />,
  ARCHIVED: <Archive className="w-3 h-3 text-slate-300" />,
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TeacherWorkspace() {
  const { user } = useAuth()

  // State
  const [boards, setBoards] = useState<WorkspaceBoard[]>([])
  const [activeBoard, setActiveBoard] = useState<WorkspaceBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create board modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<{
    type: string; title: string; description: string;
    scopeType: string; groupId: string; gradeId: string; groupIds: string[];
    goalAmount: string; concept: string; allowPartial: boolean; roles: string[];
  }>({ type: 'KANBAN', title: '', description: '', scopeType: 'GROUP', groupId: '', gradeId: '', groupIds: [], goalAmount: '', concept: '', allowPartial: false, roles: ['Monitor', 'Líder', 'Secretario', 'Tesorero', 'Vigía ambiental'] })
  const [creating, setCreating] = useState(false)

  // Scope options from teacher assignments
  const [scopeOptions, setScopeOptions] = useState<{ groups: any[]; grades: any[] }>({ groups: [], grades: [] })

  // Board summary (for structured boards)
  const [boardSummary, setBoardSummary] = useState<any>(null)

  // Inline editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemTitle, setEditingItemTitle] = useState('')

  // Add item
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const newItemRef = useRef<HTMLInputElement>(null)

  // Drag state
  const [dragItem, setDragItem] = useState<WorkspaceItem | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // ─── Load boards ───
  const loadBoards = useCallback(async () => {
    try {
      setLoading(true)
      const res = await teacherWorkspaceApi.listBoards()
      setBoards(res.data || [])
    } catch (err: any) {
      setError('Error al cargar tableros')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Load full board ───
  const loadBoard = useCallback(async (boardId: string) => {
    try {
      setLoadingBoard(true)
      const res = await teacherWorkspaceApi.getBoard(boardId)
      setActiveBoard(res.data)
    } catch (err: any) {
      setError('Error al cargar tablero')
      console.error(err)
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  // ─── Load scope options (grades & groups from teacher's assignments) ───
  const loadScopeOptions = useCallback(async () => {
    try {
      const res = await teacherWorkspaceApi.getScopeOptions()
      setScopeOptions(res.data || { groups: [], grades: [] })
    } catch (err) {
      console.error('Error loading scope options:', err)
    }
  }, [])

  // ─── Load board summary ───
  const loadBoardSummary = useCallback(async (boardId: string) => {
    try {
      const res = await teacherWorkspaceApi.getBoardSummary(boardId)
      setBoardSummary(res.data)
    } catch { setBoardSummary(null) }
  }, [])

  useEffect(() => {
    loadBoards()
    loadScopeOptions()
  }, [loadBoards, loadScopeOptions])

  // Load summary when active board changes
  useEffect(() => {
    if (activeBoard && ['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(activeBoard.type)) {
      loadBoardSummary(activeBoard.id)
    } else {
      setBoardSummary(null)
    }
  }, [activeBoard?.id])

  const defaultCreateForm = { type: 'KANBAN', title: '', description: '', scopeType: 'GROUP', groupId: '', gradeId: '', groupIds: [] as string[], goalAmount: '', concept: '', allowPartial: false, roles: ['Monitor', 'Líder', 'Secretario', 'Tesorero', 'Vigía ambiental'] }

  // ─── Create board ───
  const handleCreateBoard = async () => {
    if (!createForm.title.trim()) return
    setCreating(true)
    try {
      const isStructured = ['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(createForm.type)

      // Build metadata based on board type
      let metadata: any = undefined
      if (createForm.type === 'MICRO_COLLECT') {
        metadata = {
          goalAmount: Number(createForm.goalAmount) || 0,
          concept: createForm.concept || createForm.title,
          allowPartial: createForm.allowPartial,
        }
      } else if (createForm.type === 'CLASSROOM_ROLES') {
        metadata = { roles: createForm.roles.filter(r => r.trim()) }
      }

      const res = await teacherWorkspaceApi.createBoard({
        type: createForm.type,
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        scopeType: isStructured ? createForm.scopeType : undefined,
        groupId: createForm.groupId || undefined,
        gradeId: createForm.scopeType === 'GRADE' ? createForm.gradeId || undefined : undefined,
        groupIds: createForm.scopeType === 'MULTI_GROUP' ? createForm.groupIds : undefined,
        metadata,
      })

      // Auto-populate structured boards
      if (isStructured && res.data?.id) {
        try {
          await teacherWorkspaceApi.populateBoard(res.data.id)
        } catch (e) {
          console.warn('Auto-populate failed:', e)
        }
      }

      setShowCreateModal(false)
      setCreateForm(defaultCreateForm)
      await loadBoards()
      // Auto-select the new board
      if (res.data?.id) loadBoard(res.data.id)
    } catch (err: any) {
      setError('Error al crear tablero')
    } finally {
      setCreating(false)
    }
  }

  // ─── Delete board ───
  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm('¿Eliminar este tablero y todo su contenido?')) return
    try {
      await teacherWorkspaceApi.deleteBoard(boardId)
      if (activeBoard?.id === boardId) setActiveBoard(null)
      await loadBoards()
    } catch (err: any) {
      setError('Error al eliminar tablero')
    }
  }

  // ─── Archive board ───
  const handleArchiveBoard = async (boardId: string) => {
    try {
      await teacherWorkspaceApi.updateBoard(boardId, { isArchived: true })
      if (activeBoard?.id === boardId) setActiveBoard(null)
      await loadBoards()
    } catch (err: any) {
      setError('Error al archivar tablero')
    }
  }

  // ─── Add item to column ───
  const handleAddItem = async (columnId: string) => {
    if (!newItemTitle.trim() || !activeBoard) return
    try {
      const res = await teacherWorkspaceApi.createItem({
        boardId: activeBoard.id,
        columnId,
        title: newItemTitle.trim(),
      })
      // Update local state
      setActiveBoard(prev => {
        if (!prev) return prev
        const cols = prev.columns?.map(c => {
          if (c.id === columnId) return { ...c, items: [...c.items, res.data] }
          return c
        })
        return { ...prev, columns: cols }
      })
      setNewItemTitle('')
      setAddingToColumn(null)
    } catch (err: any) {
      setError('Error al crear item')
    }
  }

  // ─── Update item inline ───
  const handleUpdateItemTitle = async (itemId: string) => {
    if (!editingItemTitle.trim()) return
    try {
      await teacherWorkspaceApi.updateItem(itemId, { title: editingItemTitle.trim() })
      setActiveBoard(prev => {
        if (!prev) return prev
        const cols = prev.columns?.map(c => ({
          ...c,
          items: c.items.map(i => i.id === itemId ? { ...i, title: editingItemTitle.trim() } : i),
        }))
        return { ...prev, columns: cols }
      })
    } catch (err) {
      console.error(err)
    } finally {
      setEditingItemId(null)
    }
  }

  // ─── Delete item ───
  const handleDeleteItem = async (itemId: string) => {
    try {
      await teacherWorkspaceApi.deleteItem(itemId)
      setActiveBoard(prev => {
        if (!prev) return prev
        const cols = prev.columns?.map(c => ({
          ...c,
          items: c.items.filter(i => i.id !== itemId),
        }))
        return { ...prev, columns: cols }
      })
    } catch (err: any) {
      setError('Error al eliminar item')
    }
  }

  // ─── Toggle item status ───
  const handleToggleStatus = async (item: WorkspaceItem) => {
    const next = item.status === 'TODO' ? 'IN_PROGRESS' : item.status === 'IN_PROGRESS' ? 'DONE' : 'TODO'
    try {
      await teacherWorkspaceApi.updateItem(item.id, { status: next })
      setActiveBoard(prev => {
        if (!prev) return prev
        const cols = prev.columns?.map(c => ({
          ...c,
          items: c.items.map(i => i.id === item.id ? { ...i, status: next } : i),
        }))
        return { ...prev, columns: cols }
      })
    } catch (err) {
      console.error(err)
    }
  }

  // ─── Drag & Drop ───
  const handleDragStart = (e: React.DragEvent, item: WorkspaceItem) => {
    setDragItem(item)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    if (!dragItem || dragItem.columnId === targetColumnId) {
      setDragItem(null)
      return
    }

    const targetCol = activeBoard?.columns?.find(c => c.id === targetColumnId)
    const newSortOrder = targetCol ? (targetCol.items.length + 1) * 100 : 100

    // Optimistic update
    setActiveBoard(prev => {
      if (!prev) return prev
      const cols = prev.columns?.map(c => {
        if (c.id === dragItem.columnId) {
          return { ...c, items: c.items.filter(i => i.id !== dragItem.id) }
        }
        if (c.id === targetColumnId) {
          return { ...c, items: [...c.items, { ...dragItem, columnId: targetColumnId, sortOrder: newSortOrder }] }
        }
        return c
      })
      return { ...prev, columns: cols }
    })

    try {
      await teacherWorkspaceApi.moveItem(dragItem.id, { columnId: targetColumnId, sortOrder: newSortOrder })
    } catch (err) {
      console.error('Error moving item:', err)
      if (activeBoard) loadBoard(activeBoard.id)
    }

    setDragItem(null)
  }

  // ─── Add column ───
  const handleAddColumn = async () => {
    if (!activeBoard) return
    const title = prompt('Nombre de la nueva columna:')
    if (!title?.trim()) return
    try {
      await teacherWorkspaceApi.createColumn({ boardId: activeBoard.id, title: title.trim() })
      await loadBoard(activeBoard.id)
    } catch (err: any) {
      setError('Error al crear columna')
    }
  }

  // ─── Delete column ───
  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('¿Eliminar esta columna? Los items se moverán a sin columna.')) return
    try {
      await teacherWorkspaceApi.deleteColumn(columnId)
      if (activeBoard) await loadBoard(activeBoard.id)
    } catch (err: any) {
      setError('Error al eliminar columna')
    }
  }

  // Focus new item input when adding
  useEffect(() => {
    if (addingToColumn && newItemRef.current) {
      newItemRef.current.focus()
    }
  }, [addingToColumn])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mi Espacio</h1>
            <p className="text-sm text-slate-500 mt-0.5">Espacio privado de trabajo del docente</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tablero
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ═══════ Sidebar: Board List ═══════ */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
          <div className="p-4 space-y-2">
            {boards.length === 0 ? (
              <div className="text-center py-12">
                <LayoutGrid className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Sin tableros aún</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Crear primer tablero
                </button>
              </div>
            ) : (
              boards.map(board => {
                const bt = BOARD_TYPES[board.type] || BOARD_TYPES.KANBAN
                const isActive = activeBoard?.id === board.id
                return (
                  <div
                    key={board.id}
                    onClick={() => loadBoard(board.id)}
                    className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? 'bg-blue-50 border border-blue-200 shadow-sm'
                        : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">{bt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                          {board.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {bt.label}
                          {board.group && ` · ${board.group.grade?.name || ''} ${board.group.name}`}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {board._count?.items ?? 0} items
                        </p>
                      </div>
                      {/* Actions */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleArchiveBoard(board.id) }}
                          className="p-1 rounded hover:bg-slate-100" title="Archivar"
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board.id) }}
                          className="p-1 rounded hover:bg-red-50" title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ═══════ Main: Kanban Board ═══════ */}
        <div className="flex-1 overflow-x-auto bg-slate-100">
          {loadingBoard ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : !activeBoard ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <LayoutGrid className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg">Selecciona o crea un tablero</p>
                <p className="text-slate-400 text-sm mt-1">Tu espacio privado de organización</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Board header */}
              <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
                <span className="text-xl">{BOARD_TYPES[activeBoard.type]?.icon || '📋'}</span>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">{activeBoard.title}</h2>
                  {activeBoard.description && (
                    <p className="text-xs text-slate-500">{activeBoard.description}</p>
                  )}
                </div>
                <button
                  onClick={handleAddColumn}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Columna
                </button>
              </div>

              {/* ═══════ MICRO_COLLECT View ═══════ */}
              {activeBoard.type === 'MICRO_COLLECT' ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Summary bar */}
                  {boardSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Target className="w-3.5 h-3.5" /> Meta</div>
                        <p className="text-lg font-bold text-slate-900">${(boardSummary.goalAmount || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><DollarSign className="w-3.5 h-3.5" /> Recaudado</div>
                        <p className="text-lg font-bold text-green-600">${(boardSummary.totalCollected || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Percent className="w-3.5 h-3.5" /> Progreso</div>
                        <p className="text-lg font-bold text-blue-600">{boardSummary.percentage || 0}%</p>
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(boardSummary.percentage || 0, 100)}%` }} />
                        </div>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1"><Users className="w-3.5 h-3.5" /> Estado</div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600 font-medium">{boardSummary.paidCount || 0}✓</span>
                          <span className="text-amber-500 font-medium">{boardSummary.partialCount || 0}~</span>
                          <span className="text-red-500 font-medium">{boardSummary.pendingCount || 0}✗</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Student payment table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">#</th>
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">Estudiante</th>
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">Monto</th>
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">Estado</th>
                          <th className="text-right px-4 py-2.5 font-medium text-slate-600">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeBoard.columns?.[0]?.items || activeBoard.items || []).map((item: WorkspaceItem, idx: number) => {
                          const meta = (item.metadata || {}) as any
                          const payStatus = meta.status || 'PENDING'
                          const amountPaid = Number(meta.amountPaid) || 0
                          return (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-2 font-medium text-slate-800">{item.title}</td>
                              <td className="px-4 py-2">
                                <input type="number" value={amountPaid} min={0}
                                  onChange={async (e) => {
                                    const val = Number(e.target.value) || 0
                                    const goalPer = (activeBoard.metadata as any)?.goalAmount ? Number((activeBoard.metadata as any).goalAmount) / (activeBoard.columns?.[0]?.items?.length || 1) : 0
                                    const newStatus = val <= 0 ? 'PENDING' : (goalPer > 0 && val >= goalPer ? 'PAID' : 'PARTIAL')
                                    await teacherWorkspaceApi.updateItem(item.id, { metadata: { ...meta, amountPaid: val, status: newStatus } })
                                    loadBoard(activeBoard.id)
                                    loadBoardSummary(activeBoard.id)
                                  }}
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                  payStatus === 'PAID' ? 'bg-green-100 text-green-700' :
                                  payStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {payStatus === 'PAID' ? 'Pagado' : payStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={async () => {
                                  const goalPer = (activeBoard.metadata as any)?.goalAmount ? Number((activeBoard.metadata as any).goalAmount) / (activeBoard.columns?.[0]?.items?.length || 1) : 0
                                  await teacherWorkspaceApi.updateItem(item.id, { metadata: { ...meta, amountPaid: goalPer || amountPaid, status: 'PAID' } })
                                  loadBoard(activeBoard.id)
                                  loadBoardSummary(activeBoard.id)
                                }}
                                  className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 mr-1"
                                  disabled={payStatus === 'PAID'}>
                                  <Check className="w-3 h-3 inline mr-0.5" /> Pagado
                                </button>
                                <button onClick={async () => {
                                  await teacherWorkspaceApi.updateItem(item.id, { metadata: { ...meta, amountPaid: 0, status: 'PENDING' } })
                                  loadBoard(activeBoard.id)
                                  loadBoardSummary(activeBoard.id)
                                }}
                                  className="px-2 py-1 text-xs bg-slate-50 text-slate-600 rounded hover:bg-slate-100">
                                  ↩ Deshacer
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              /* ═══════ CLASSROOM_ROLES View ═══════ */
              ) : activeBoard.type === 'CLASSROOM_ROLES' ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Summary bar */}
                  {boardSummary && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500 mb-1">Total estudiantes</div>
                        <p className="text-lg font-bold text-slate-900">{boardSummary.totalStudents || 0}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500 mb-1">Con rol asignado</div>
                        <p className="text-lg font-bold text-green-600">{boardSummary.assignedCount || 0}</p>
                      </div>
                      <div className="bg-white rounded-xl border border-slate-200 p-3">
                        <div className="text-xs text-slate-500 mb-1">Sin asignar</div>
                        <p className="text-lg font-bold text-amber-500">{boardSummary.unassignedCount || 0}</p>
                      </div>
                    </div>
                  )}

                  {/* Student roles table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">#</th>
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">Estudiante</th>
                          <th className="text-left px-4 py-2.5 font-medium text-slate-600">Rol asignado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeBoard.columns?.[0]?.items || activeBoard.items || []).map((item: WorkspaceItem, idx: number) => {
                          const meta = (item.metadata || {}) as any
                          const boardMeta = (activeBoard.metadata as any) || {}
                          const availableRoles: string[] = boardMeta.roles || []
                          return (
                            <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-2 font-medium text-slate-800">{item.title}</td>
                              <td className="px-4 py-2">
                                <select value={meta.role || ''}
                                  onChange={async (e) => {
                                    await teacherWorkspaceApi.updateItem(item.id, { metadata: { ...meta, role: e.target.value } })
                                    loadBoard(activeBoard.id)
                                    loadBoardSummary(activeBoard.id)
                                  }}
                                  className={`px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-blue-400 outline-none ${
                                    meta.role ? 'border-green-300 bg-green-50' : 'border-slate-300'
                                  }`}>
                                  <option value="">Sin rol</option>
                                  {availableRoles.map((r: string) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              /* ═══════ Generic Kanban View ═══════ */
              ) : (
              <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
                {activeBoard.columns?.map(column => (
                  <div
                    key={column.id}
                    className={`flex-shrink-0 w-72 flex flex-col bg-white rounded-xl shadow-sm border transition-colors ${
                      dragOverColumn === column.id ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'
                    }`}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-700">{column.title}</h3>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {column.items.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setAddingToColumn(column.id); setNewItemTitle('') }}
                          className="p-1 rounded hover:bg-slate-100" title="Agregar item"
                        >
                          <Plus className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteColumn(column.id)}
                          className="p-1 rounded hover:bg-red-50" title="Eliminar columna"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]">
                      {column.items.map(item => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, item)}
                          className={`group relative bg-white border border-slate-200 rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow ${
                            dragItem?.id === item.id ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => handleToggleStatus(item)}
                              className="mt-0.5 flex-shrink-0"
                              title={item.status}
                            >
                              {STATUS_ICONS[item.status] || STATUS_ICONS.TODO}
                            </button>
                            <div className="flex-1 min-w-0">
                              {editingItemId === item.id ? (
                                <input
                                  value={editingItemTitle}
                                  onChange={(e) => setEditingItemTitle(e.target.value)}
                                  onBlur={() => handleUpdateItemTitle(item.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateItemTitle(item.id)
                                    if (e.key === 'Escape') setEditingItemId(null)
                                  }}
                                  autoFocus
                                  className="w-full text-sm border border-blue-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-400 outline-none"
                                />
                              ) : (
                                <p
                                  className={`text-sm ${item.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800'}`}
                                  onDoubleClick={() => {
                                    setEditingItemId(item.id)
                                    setEditingItemTitle(item.title)
                                  }}
                                >
                                  {item.title}
                                </p>
                              )}
                              {item.student && (
                                <p className="text-xs text-blue-500 mt-0.5">
                                  {item.student.firstName} {item.student.lastName}
                                </p>
                              )}
                              {item.dueDate && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  <Clock className="w-3 h-3 inline mr-0.5" />
                                  {new Date(item.dueDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            {/* Item actions */}
                            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => {
                                  setEditingItemId(item.id)
                                  setEditingItemTitle(item.title)
                                }}
                                className="p-0.5 rounded hover:bg-slate-100"
                              >
                                <Pencil className="w-3 h-3 text-slate-400" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-0.5 rounded hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add item inline */}
                      {addingToColumn === column.id && (
                        <div className="border border-blue-200 rounded-lg p-2 bg-blue-50/30">
                          <input
                            ref={newItemRef}
                            value={newItemTitle}
                            onChange={(e) => setNewItemTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddItem(column.id)
                              if (e.key === 'Escape') setAddingToColumn(null)
                            }}
                            placeholder="Título del item..."
                            className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-400 outline-none"
                          />
                          <div className="flex justify-end gap-1.5 mt-2">
                            <button
                              onClick={() => setAddingToColumn(null)}
                              className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleAddItem(column.id)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Agregar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Add item button at bottom */}
                    {addingToColumn !== column.id && (
                      <div className="px-2 pb-2">
                        <button
                          onClick={() => { setAddingToColumn(column.id); setNewItemTitle('') }}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Agregar item
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add column button */}
                <div className="flex-shrink-0 w-72">
                  <button
                    onClick={handleAddColumn}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-sm">Nueva columna</span>
                  </button>
                </div>
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Create Board Modal ═══════ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Nuevo Tablero</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Board type selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de tablero</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(BOARD_TYPES).map(([key, bt]) => (
                    <button
                      key={key}
                      onClick={() => setCreateForm(f => ({ ...f, type: key }))}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-sm transition-colors ${
                        createForm.type === key
                          ? 'border-blue-400 bg-blue-50 text-blue-900'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span>{bt.icon}</span>
                      <span className="truncate">{bt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  value={createForm.title}
                  onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Plan semanal 7A, Bitácora Biología..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Breve descripción del tablero..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
                />
              </div>

              {/* Scope selector for structured boards */}
              {['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(createForm.type) ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Alcance</label>
                    <div className="flex gap-2">
                      {[{ v: 'GROUP', l: 'Grupo' }, { v: 'GRADE', l: 'Grado' }, { v: 'MULTI_GROUP', l: 'Varios grupos' }].map(o => (
                        <button key={o.v} onClick={() => setCreateForm(f => ({ ...f, scopeType: o.v, groupId: '', gradeId: '', groupIds: [] }))}
                          className={`flex-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${createForm.scopeType === o.v ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {createForm.scopeType === 'GROUP' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Grupo</label>
                      <select value={createForm.groupId} onChange={(e) => setCreateForm(f => ({ ...f, groupId: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                        <option value="">Seleccionar grupo...</option>
                        {scopeOptions.groups.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.gradeName} {g.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {createForm.scopeType === 'GRADE' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Grado</label>
                      <select value={createForm.gradeId} onChange={(e) => setCreateForm(f => ({ ...f, gradeId: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                        <option value="">Seleccionar grado...</option>
                        {scopeOptions.grades.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.name} ({g.groups?.length || 0} grupos)</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {createForm.scopeType === 'MULTI_GROUP' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Grupos ({createForm.groupIds.length} seleccionados)</label>
                      <div className="max-h-32 overflow-y-auto border border-slate-300 rounded-lg p-2 space-y-1">
                        {scopeOptions.groups.map((g: any) => (
                          <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-1 rounded">
                            <input type="checkbox" checked={createForm.groupIds.includes(g.id)}
                              onChange={(e) => setCreateForm(f => ({
                                ...f,
                                groupIds: e.target.checked ? [...f.groupIds, g.id] : f.groupIds.filter(id => id !== g.id)
                              }))}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span>{g.gradeName} {g.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MICRO_COLLECT specific fields */}
                  {createForm.type === 'MICRO_COLLECT' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Meta ($)</label>
                          <input type="number" value={createForm.goalAmount}
                            onChange={(e) => setCreateForm(f => ({ ...f, goalAmount: e.target.value }))}
                            placeholder="0" min="0"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Concepto</label>
                          <input value={createForm.concept}
                            onChange={(e) => setCreateForm(f => ({ ...f, concept: e.target.value }))}
                            placeholder="Ej: Libros, Salida..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={createForm.allowPartial}
                          onChange={(e) => setCreateForm(f => ({ ...f, allowPartial: e.target.checked }))}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span className="text-slate-700">Permitir pagos parciales</span>
                      </label>
                    </>
                  )}

                  {/* CLASSROOM_ROLES specific fields */}
                  {createForm.type === 'CLASSROOM_ROLES' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Roles disponibles</label>
                      <div className="space-y-1.5">
                        {createForm.roles.map((role, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input value={role}
                              onChange={(e) => setCreateForm(f => {
                                const roles = [...f.roles]
                                roles[idx] = e.target.value
                                return { ...f, roles }
                              })}
                              className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-blue-400 outline-none" />
                            <button onClick={() => setCreateForm(f => ({ ...f, roles: f.roles.filter((_, i) => i !== idx) }))}
                              className="p-1 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                        <button onClick={() => setCreateForm(f => ({ ...f, roles: [...f.roles, ''] }))}
                          className="text-xs text-blue-600 hover:underline">+ Agregar rol</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grupo (opcional)</label>
                  <select value={createForm.groupId}
                    onChange={(e) => setCreateForm(f => ({ ...f, groupId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                    <option value="">Sin grupo específico</option>
                    {scopeOptions.groups.map((g: any) => (
                      <option key={g.id} value={g.id}>{g.gradeName} {g.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateBoard}
                disabled={creating || !createForm.title.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Crear Tablero
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
