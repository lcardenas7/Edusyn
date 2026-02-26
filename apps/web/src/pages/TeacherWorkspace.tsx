import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { teacherWorkspaceApi, teacherAssignmentsApi } from '../lib/api'
import {
  Plus, Trash2, X, GripVertical, MoreHorizontal,
  LayoutGrid, BookOpen, Archive, ChevronDown,
  Pencil, Check, Clock, AlertCircle, Loader2
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
  const [createForm, setCreateForm] = useState({ type: 'KANBAN', title: '', description: '', groupId: '' })
  const [creating, setCreating] = useState(false)

  // Groups for board assignment
  const [groups, setGroups] = useState<Array<{ id: string; name: string; gradeName?: string }>>([])

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

  // ─── Load groups from assignments ───
  const loadGroups = useCallback(async () => {
    try {
      const res = await teacherAssignmentsApi.getAll({ teacherId: user?.id })
      const data = res.data || []
      const unique = new Map<string, { id: string; name: string; gradeName?: string }>()
      data.forEach((a: any) => {
        if (a.group && !unique.has(a.group.id)) {
          unique.set(a.group.id, { id: a.group.id, name: a.group.name, gradeName: a.group.grade?.name })
        }
      })
      setGroups(Array.from(unique.values()))
    } catch (err) {
      console.error('Error loading groups:', err)
    }
  }, [user?.id])

  useEffect(() => {
    loadBoards()
    loadGroups()
  }, [loadBoards, loadGroups])

  // ─── Create board ───
  const handleCreateBoard = async () => {
    if (!createForm.title.trim()) return
    setCreating(true)
    try {
      await teacherWorkspaceApi.createBoard({
        type: createForm.type,
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        groupId: createForm.groupId || undefined,
      })
      setShowCreateModal(false)
      setCreateForm({ type: 'KANBAN', title: '', description: '', groupId: '' })
      await loadBoards()
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

              {/* Columns */}
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

              {/* Group */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grupo (opcional)</label>
                <select
                  value={createForm.groupId}
                  onChange={(e) => setCreateForm(f => ({ ...f, groupId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                >
                  <option value="">Sin grupo específico</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.gradeName} {g.name}</option>
                  ))}
                </select>
              </div>
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
