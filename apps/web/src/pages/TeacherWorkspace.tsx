import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { teacherWorkspaceApi } from '../lib/api'
import {
  Plus, LayoutGrid, AlertCircle, Loader2, Calendar, X,
  PanelLeftClose, PanelLeft
} from 'lucide-react'
import { WorkspaceItem, WorkspaceBoard, BOARD_TYPES } from '../components/workspace/types'
import { WButton } from '../components/workspace/ui'
import WorkspaceSidebar from '../components/workspace/WorkspaceSidebar'
import { CalendarView, MicroCollectView, ClassroomRolesView, StudentNotesView, ProjectBoardView, GenericKanbanView, ClassroomSeatingView } from '../components/workspace/views'
import { CreateBoardModal, PaymentModal, AssignRoleModal, ObservationModal, TaskModal } from '../components/workspace/modals'

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

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Create board modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<{
    type: string; title: string; description: string;
    scopeType: string; groupId: string; gradeId: string; groupIds: string[];
    template: string; seatingRows: string; seatingColumns: string;
    goalAmount: string; concept: string; allowPartial: boolean; roles: string[];
    autoPopulate: boolean;
  }>({ type: 'KANBAN', title: '', description: '', scopeType: 'GROUP', groupId: '', gradeId: '', groupIds: [], template: 'DEFAULT', seatingRows: '6', seatingColumns: '6', goalAmount: '', concept: '', allowPartial: false, roles: ['Monitor', 'Líder', 'Secretario', 'Tesorero', 'Vigía ambiental'], autoPopulate: false })
  const [creating, setCreating] = useState(false)

  // Scope options from teacher assignments
  const [scopeOptions, setScopeOptions] = useState<{ groups: any[]; grades: any[] }>({ groups: [], grades: [] })

  // Board summary (for structured boards)
  const [boardSummary, setBoardSummary] = useState<any>(null)

  // Calendar view
  const [showCalendar, setShowCalendar] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date())
  const [calEvents, setCalEvents] = useState<any[]>([])
  const [loadingCal, setLoadingCal] = useState(false)
  const [calSelectedDay, setCalSelectedDay] = useState<string | null>(null)

  // Add student search
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<any[]>([])
  const [addingStudent, setAddingStudent] = useState<string | null>(null)

  // Payment modal (MICRO_COLLECT)
  const [payModal, setPayModal] = useState<{ itemId: string; title: string; currentAmount: number; meta: any; item?: WorkspaceItem } | null>(null)
  const [payAmount, setPayAmount] = useState('')

  // Role assignment modal (CLASSROOM_ROLES)
  const [assignRoleModal, setAssignRoleModal] = useState<string | null>(null) // role name
  const [roleStudentSearch, setRoleStudentSearch] = useState('')
  const [roleStudentResults, setRoleStudentResults] = useState<any[]>([])

  // Edit roles on existing board
  const [editingRoles, setEditingRoles] = useState(false)

  // Observation modal (STUDENT_NOTES)
  const [obsModal, setObsModal] = useState<{ columnId: string; columnTitle: string; item?: WorkspaceItem } | null>(null)
  const [obsStudentSearch, setObsStudentSearch] = useState('')
  const [obsStudentResults, setObsStudentResults] = useState<any[]>([])
  const [obsSelectedStudent, setObsSelectedStudent] = useState<{ studentRecordId: string; fullName: string } | null>(null)
  const [obsText, setObsText] = useState('')
  const [obsCategory, setObsCategory] = useState('GENERAL')
  const [obsDate, setObsDate] = useState(new Date().toISOString().slice(0, 10))
  const [savingObs, setSavingObs] = useState(false)

  // Project task modal
  const [taskModal, setTaskModal] = useState<{ columnId: string; item?: WorkspaceItem } | null>(null)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', checklist: [] as { text: string; done: boolean }[] })
  const [savingTask, setSavingTask] = useState(false)

  // Inline editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemTitle, setEditingItemTitle] = useState('')

  // Add item
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemDate, setNewItemDate] = useState('')
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

  const openNewObservationModal = (columnId: string, columnTitle: string) => {
    setObsModal({ columnId, columnTitle })
    setObsStudentSearch('')
    setObsStudentResults([])
    setObsSelectedStudent(null)
    setObsText('')
    setObsCategory('GENERAL')
    setObsDate(new Date().toISOString().slice(0, 10))
  }

  const openEditObservationModal = (item: WorkspaceItem) => {
    const meta = (item.metadata || {}) as any
    setObsModal({
      columnId: item.columnId || '',
      columnTitle: 'Editar observación',
      item,
    })
    setObsStudentSearch(item.title)
    setObsStudentResults([])
    setObsSelectedStudent({
      studentRecordId: meta.studentRecordId || '',
      fullName: item.title,
    })
    setObsText(item.content || '')
    setObsCategory(meta.category || 'GENERAL')
    setObsDate((meta.observationDate || item.eventDate || item.createdAt || new Date().toISOString()).slice(0, 10))
  }

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
    if (activeBoard && (['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(activeBoard.type) || isSeatingBoard(activeBoard))) {
      loadBoardSummary(activeBoard.id)
    } else {
      setBoardSummary(null)
    }
  }, [activeBoard?.id])

  // Load calendar events when calendar view is active
  const loadCalendarEvents = useCallback(async (month: Date) => {
    setLoadingCal(true)
    try {
      const from = new Date(month.getFullYear(), month.getMonth(), 1)
      const to = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59)
      const res = await teacherWorkspaceApi.getCalendarEvents(from.toISOString(), to.toISOString())
      setCalEvents(res.data || [])
    } catch (err) {
      console.error('Error loading calendar events:', err)
      setCalEvents([])
    } finally {
      setLoadingCal(false)
    }
  }, [])

  useEffect(() => {
    if (showCalendar) loadCalendarEvents(calMonth)
  }, [showCalendar, calMonth, loadCalendarEvents])

  // ─── Search & add student to structured board ───
  const searchTimerRef = useRef<any>(null)
  const handleStudentSearchChange = (q: string) => {
    setStudentSearch(q)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!activeBoard) return
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await teacherWorkspaceApi.searchStudents(activeBoard.id, q)
        setStudentResults(res.data || [])
      } catch { setStudentResults([]) }
    }, 300)
  }

  const handleAddStudent = async (studentRecordId: string) => {
    if (!activeBoard || addingStudent) return
    setAddingStudent(studentRecordId)
    try {
      await teacherWorkspaceApi.addStudent(activeBoard.id, studentRecordId)
      // Remove from results
      setStudentResults(prev => prev.filter(s => s.studentRecordId !== studentRecordId))
      // Reload board + summary
      loadBoard(activeBoard.id)
      loadBoardSummary(activeBoard.id)
    } catch (err: any) {
      console.error('Error adding student:', err)
    } finally {
      setAddingStudent(null)
    }
  }

  // ─── Pay student (MICRO_COLLECT) ───
  const handlePayStudent = async (overrideAmount?: number) => {
    if (!payModal || !activeBoard) return
    const val = overrideAmount !== undefined ? overrideAmount : (Number(payAmount) || 0)
    if (val <= 0) return // don't save $0 payments
    const perStudent = Number((activeBoard.metadata as any)?.goalAmount) || 0
    // If no per-student goal set, any payment = PAID. Otherwise compare against goal.
    const newStatus = val <= 0 ? 'PENDING' : (perStudent > 0 ? (val >= perStudent ? 'PAID' : 'PARTIAL') : 'PAID')
    await teacherWorkspaceApi.updateItem(payModal.itemId, { metadata: { ...payModal.meta, amountPaid: val, status: newStatus } })
    setPayModal(null)
    setPayAmount('')
    loadBoard(activeBoard.id)
    loadBoardSummary(activeBoard.id)
  }

  const openEditPaymentModal = (item: WorkspaceItem, meta: any, amountPaid: number) => {
    setPayModal({
      itemId: item.id,
      title: item.title,
      currentAmount: amountPaid,
      meta,
      item,
    })
    setPayAmount(amountPaid > 0 ? String(amountPaid) : String(Number((activeBoard?.metadata as any)?.goalAmount) || ''))
  }

  // ─── Role student search (CLASSROOM_ROLES) ───
  // Searches within EXISTING board items (students already populated on the board)
  const handleRoleStudentSearchChange = (q: string) => {
    setRoleStudentSearch(q)
    if (!activeBoard || !q.trim()) { setRoleStudentResults([]); return }
    const allItems = activeBoard.columns?.flatMap(c => c.items) || []
    const query = q.trim().toLowerCase()
    const filtered = allItems
      .filter((item: WorkspaceItem) => {
        const meta = (item.metadata || {}) as any
        // Exclude students already assigned to a role
        if (meta.role) return false
        return item.title.toLowerCase().includes(query)
      })
      .map((item: WorkspaceItem) => ({
        itemId: item.id,
        studentRecordId: ((item.metadata || {}) as any).studentRecordId || '',
        fullName: item.title,
      }))
      .slice(0, 20)
    setRoleStudentResults(filtered)
  }

  const handleAssignRole = async (itemId: string, role: string) => {
    if (!activeBoard) return
    setAddingStudent(itemId)
    try {
      // Update existing item's metadata to assign the role
      const item = activeBoard.columns?.flatMap(c => c.items).find((i: WorkspaceItem) => i.id === itemId)
      const existingMeta = (item?.metadata || {}) as any
      await teacherWorkspaceApi.updateItem(itemId, { metadata: { ...existingMeta, role } })
      setRoleStudentResults(prev => prev.filter(s => s.itemId !== itemId))
      setAssignRoleModal(null)
      loadBoard(activeBoard.id)
      loadBoardSummary(activeBoard.id)
    } catch (err: any) {
      console.error('Error assigning role:', err)
    } finally {
      setAddingStudent(null)
    }
  }

  // ─── Observation student search (STUDENT_NOTES) ───
  const obsSearchTimerRef = useRef<any>(null)
  const handleObsStudentSearch = (q: string) => {
    setObsStudentSearch(q)
    if (obsSearchTimerRef.current) clearTimeout(obsSearchTimerRef.current)
    if (!activeBoard) return
    obsSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await teacherWorkspaceApi.searchStudents(activeBoard.id, q)
        setObsStudentResults(res.data || [])
      } catch { setObsStudentResults([]) }
    }, 300)
  }

  const handleSaveObservation = async () => {
    if (!obsModal || !obsSelectedStudent || !obsText.trim() || !activeBoard) return
    setSavingObs(true)
    try {
      const metadata = {
        studentRecordId: obsSelectedStudent.studentRecordId,
        category: obsCategory,
        observationDate: obsDate,
      }
      if (obsModal.item) {
        await teacherWorkspaceApi.updateItem(obsModal.item.id, {
          title: obsSelectedStudent.fullName,
          content: obsText.trim(),
          metadata: { ...((obsModal.item.metadata || {}) as any), ...metadata },
          eventDate: obsDate,
        })
      } else {
        await teacherWorkspaceApi.createItem({
          boardId: activeBoard.id,
          columnId: obsModal.columnId,
          title: obsSelectedStudent.fullName,
          content: obsText.trim(),
          metadata,
          eventDate: obsDate,
        })
      }
      // Reset and close
      setObsModal(null)
      setObsStudentSearch(''); setObsStudentResults([]); setObsSelectedStudent(null)
      setObsText(''); setObsCategory('GENERAL'); setObsDate(new Date().toISOString().slice(0, 10))
      loadBoard(activeBoard.id)
    } catch (err: any) {
      console.error('Error saving observation:', err)
    } finally {
      setSavingObs(false)
    }
  }

  // ─── Save/Update project task ───
  const handleSaveTask = async () => {
    if (!taskModal || !taskForm.title.trim() || !activeBoard) return
    setSavingTask(true)
    try {
      const meta = { priority: taskForm.priority, checklist: taskForm.checklist }
      if (taskModal.item) {
        // Update existing task
        await teacherWorkspaceApi.updateItem(taskModal.item.id, {
          title: taskForm.title.trim(),
          content: taskForm.description.trim() || undefined,
          dueDate: taskForm.dueDate || undefined,
          metadata: { ...((taskModal.item.metadata || {}) as any), ...meta },
        })
      } else {
        // Create new task
        await teacherWorkspaceApi.createItem({
          boardId: activeBoard.id,
          columnId: taskModal.columnId,
          title: taskForm.title.trim(),
          content: taskForm.description.trim() || undefined,
          dueDate: taskForm.dueDate || undefined,
          metadata: meta,
        })
      }
      setTaskModal(null)
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', checklist: [] })
      loadBoard(activeBoard.id)
    } catch (err: any) {
      console.error('Error saving task:', err)
    } finally {
      setSavingTask(false)
    }
  }

  const defaultCreateForm = { type: 'KANBAN', title: '', description: '', scopeType: 'GROUP', groupId: '', gradeId: '', groupIds: [] as string[], template: 'DEFAULT', seatingRows: '6', seatingColumns: '6', goalAmount: '', concept: '', allowPartial: false, roles: ['Monitor', 'Líder', 'Secretario', 'Tesorero', 'Vigía ambiental'], autoPopulate: false }

  const isSeatingBoard = (board: WorkspaceBoard | null) => board?.type === 'KANBAN' && ((board.metadata || {}) as any)?.template === 'CLASSROOM_SEATING'
  const getBoardLabel = (board: WorkspaceBoard) => {
    if (board.type === 'KANBAN' && ((board.metadata || {}) as any)?.template === 'CLASSROOM_SEATING') return 'Organizador de salón'
    return BOARD_TYPES[board.type]?.label || 'Tablero'
  }

  // ─── Create board ───
  const handleCreateBoard = async () => {
    if (!createForm.title.trim()) return
    setCreating(true)
    try {
      const isSeatingTemplate = createForm.type === 'KANBAN' && createForm.template === 'CLASSROOM_SEATING'
      const isStructured = ['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(createForm.type) || isSeatingTemplate

      // Build metadata based on board type
      let metadata: any = undefined
      if (isSeatingTemplate) {
        metadata = {
          template: 'CLASSROOM_SEATING',
          seating: {
            rows: Math.max(1, Number(createForm.seatingRows) || 6),
            columns: Math.max(1, Number(createForm.seatingColumns) || 6),
            boardPosition: 'BOTTOM',
            numberingMode: 'COLUMN_MAJOR_LEFT',
            seats: [],
          },
        }
      } else if (createForm.type === 'MICRO_COLLECT') {
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

      // Auto-populate only if checkbox is checked
      if (isStructured && createForm.autoPopulate && res.data?.id) {
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
      const datePayload: any = {}
      if (newItemDate) {
        if (activeBoard.type === 'CLASS_LOG') {
          datePayload.eventDate = newItemDate
        } else {
          datePayload.dueDate = newItemDate
        }
      }
      const res = await teacherWorkspaceApi.createItem({
        boardId: activeBoard.id,
        columnId,
        title: newItemTitle.trim(),
        ...datePayload,
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
      setNewItemDate('')
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

  // ─── Update item date inline ───
  const handleUpdateItemDate = async (itemId: string, dateValue: string) => {
    if (!activeBoard) return
    try {
      const field = activeBoard.type === 'CLASS_LOG' ? 'eventDate' : 'dueDate'
      await teacherWorkspaceApi.updateItem(itemId, { [field]: dateValue || null })
      setActiveBoard(prev => {
        if (!prev) return prev
        const cols = prev.columns?.map(c => ({
          ...c,
          items: c.items.map(i => i.id === itemId ? { ...i, [field]: dateValue || null } : i),
        }))
        return { ...prev, columns: cols }
      })
    } catch (err) { console.error(err) }
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
    <div className="h-full flex flex-col max-w-workspace mx-auto w-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!showCalendar && (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 xl:hidden"
                title={sidebarCollapsed ? 'Mostrar panel' : 'Ocultar panel'}
              >
                {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>
            )}
            <div>
              <h1 className="text-h1-lg font-bold text-slate-900 tracking-tight">Mi Espacio</h1>
              <p className="text-body-sm text-slate-400 mt-1">Espacio privado de trabajo del docente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WButton
              variant={showCalendar ? 'primary' : 'secondary'}
              onClick={() => setShowCalendar(!showCalendar)}
              icon={<Calendar className="w-4 h-4" />}
              className={showCalendar ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
            >
              {showCalendar ? 'Tableros' : 'Calendario'}
            </WButton>
            <WButton onClick={() => setShowCreateModal(true)} icon={<Plus className="w-4 h-4" />}>
              Nuevo Tablero
            </WButton>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-body-sm flex items-center gap-2 min-h-btn">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ═══════ CALENDAR VIEW ═══════ */}
        {showCalendar ? (
          <CalendarView
            calMonth={calMonth}
            calEvents={calEvents}
            loadingCal={loadingCal}
            calSelectedDay={calSelectedDay}
            onMonthChange={setCalMonth}
            onSelectDay={setCalSelectedDay}
            onGoToBoard={(boardId) => { setShowCalendar(false); loadBoard(boardId) }}
          />
        ) : (
        <>
          {/* ═══════ Sidebar ═══════ */}
          <WorkspaceSidebar
            boards={boards}
            activeBoardId={activeBoard?.id}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onSelectBoard={loadBoard}
            onCreateBoard={() => setShowCreateModal(true)}
            onArchiveBoard={handleArchiveBoard}
            onDeleteBoard={handleDeleteBoard}
          />

          {/* ═══════ Main: Board Content ═══════ */}
          <div className="flex-1 overflow-x-auto bg-slate-50/80">
            {loadingBoard ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : !activeBoard ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <LayoutGrid className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 text-h3">Selecciona o crea un tablero</p>
                  <p className="text-slate-400 text-body-sm mt-1">Tu espacio privado de organización</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Board header */}
                <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-100 flex items-center gap-4">
                  <span className="text-2xl">{BOARD_TYPES[activeBoard.type]?.icon || '📋'}</span>
                  <div className="flex-1">
                    <h2 className="text-h2 font-bold text-slate-900 tracking-tight">{activeBoard.title}</h2>
                    {activeBoard.description ? (
                      <p className="text-body-sm text-slate-400 mt-0.5">{activeBoard.description}</p>
                    ) : (
                      <p className="text-body-sm text-slate-400 mt-0.5">{getBoardLabel(activeBoard)}</p>
                    )}
                  </div>
                  {!['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(activeBoard.type) && !isSeatingBoard(activeBoard) && (
                    <WButton variant="secondary" size="sm" onClick={handleAddColumn} icon={<Plus className="w-4 h-4" />}>
                      Columna
                    </WButton>
                  )}
                </div>

              {/* ═══════ Board Type Views ═══════ */}
              {activeBoard.type === 'MICRO_COLLECT' ? (
                <MicroCollectView
                  board={activeBoard}
                  boardSummary={boardSummary}
                  showAddStudent={showAddStudent}
                  studentSearch={studentSearch}
                  studentResults={studentResults}
                  addingStudent={addingStudent}
                  onToggleAddStudent={(show) => {
                    setShowAddStudent(show)
                    if (!show) { setStudentSearch(''); setStudentResults([]) }
                    else handleStudentSearchChange('')
                  }}
                  onStudentSearchChange={handleStudentSearchChange}
                  onAddStudent={handleAddStudent}
                  onPayClick={(item, meta, amountPaid) => {
                    openEditPaymentModal(item, meta, amountPaid)
                  }}
                  onUndoPay={async (item, meta) => {
                    await teacherWorkspaceApi.updateItem(item.id, { metadata: { ...meta, amountPaid: 0, status: 'PENDING' } })
                    loadBoard(activeBoard.id)
                    loadBoardSummary(activeBoard.id)
                  }}
                />

              ) : isSeatingBoard(activeBoard) ? (
                <ClassroomSeatingView
                  board={activeBoard}
                  boardSummary={boardSummary}
                  onReloadBoard={() => loadBoard(activeBoard.id)}
                  onReloadSummary={() => loadBoardSummary(activeBoard.id)}
                />

              ) : activeBoard.type === 'CLASSROOM_ROLES' ? (
                <ClassroomRolesView
                  board={activeBoard}
                  editingRoles={editingRoles}
                  onToggleEditRoles={() => setEditingRoles(!editingRoles)}
                  onAssignRole={(role) => { setAssignRoleModal(role); setRoleStudentSearch(''); handleRoleStudentSearchChange('') }}
                  onReloadBoard={() => loadBoard(activeBoard.id)}
                  onReloadSummary={() => loadBoardSummary(activeBoard.id)}
                />

              ) : activeBoard.type === 'STUDENT_NOTES' ? (
                <StudentNotesView
                  board={activeBoard}
                  onAddObservation={openNewObservationModal}
                  onEditObservation={openEditObservationModal}
                  onReloadBoard={() => loadBoard(activeBoard.id)}
                />

              ) : activeBoard.type === 'PROJECT' ? (
                <ProjectBoardView
                  board={activeBoard}
                  dragItem={dragItem}
                  dragOverColumn={dragOverColumn}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onAddTask={(columnId) => {
                    setTaskModal({ columnId })
                    setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', checklist: [] })
                  }}
                  onEditTask={(columnId, item) => {
                    const m = (item.metadata || {}) as any
                    setTaskModal({ columnId: item.columnId || columnId, item })
                    setTaskForm({
                      title: item.title, description: item.content || '',
                      priority: m.priority || 'MEDIUM', dueDate: item.dueDate?.slice(0, 10) || '',
                      checklist: m.checklist || [],
                    })
                  }}
                  onDeleteColumn={handleDeleteColumn}
                  onDeleteItem={handleDeleteItem}
                  onAddColumn={handleAddColumn}
                />

              ) : (
                <GenericKanbanView
                  board={activeBoard}
                  dragItem={dragItem}
                  dragOverColumn={dragOverColumn}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  editingItemId={editingItemId}
                  editingItemTitle={editingItemTitle}
                  onStartEditTitle={(id, title) => { setEditingItemId(id); setEditingItemTitle(title) }}
                  onEditTitleChange={setEditingItemTitle}
                  onSaveTitle={handleUpdateItemTitle}
                  onCancelEdit={() => setEditingItemId(null)}
                  onStartEditDate={(id) => setEditingItemId(`date-${id}`)}
                  onDateChange={(id, val) => handleUpdateItemDate(id, val)}
                  onClearDate={(id) => { handleUpdateItemDate(id, ''); setEditingItemId(null) }}
                  onToggleStatus={handleToggleStatus}
                  onDeleteItem={handleDeleteItem}
                  onDeleteColumn={handleDeleteColumn}
                  onAddColumn={handleAddColumn}
                  addingToColumn={addingToColumn}
                  newItemTitle={newItemTitle}
                  newItemDate={newItemDate}
                  newItemRef={newItemRef}
                  onStartAddItem={(colId) => { setAddingToColumn(colId); setNewItemTitle(''); setNewItemDate('') }}
                  onNewItemTitleChange={setNewItemTitle}
                  onNewItemDateChange={setNewItemDate}
                  onConfirmAddItem={handleAddItem}
                  onCancelAddItem={() => setAddingToColumn(null)}
                />
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* ═══════ Create Board Modal ═══════ */}
      <CreateBoardModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        form={createForm}
        onFormChange={setCreateForm}
        scopeOptions={scopeOptions}
        creating={creating}
        onSubmit={handleCreateBoard}
      />

      {/* ═══════ Payment Modal ═══════ */}
      <PaymentModal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title={payModal?.title || ''}
        currentAmount={payModal?.currentAmount || 0}
        perStudent={Number((activeBoard?.metadata as any)?.goalAmount) || 0}
        payAmount={payAmount}
        onPayAmountChange={setPayAmount}
        onPayFull={() => {
          const perStudent = Number((activeBoard?.metadata as any)?.goalAmount) || 0
          if (perStudent > 0) handlePayStudent(perStudent)
          else handlePayStudent()
        }}
        onPayCustom={() => handlePayStudent()}
      />

      {/* ═══════ Assign Role Modal ═══════ */}
      <AssignRoleModal
        open={!!assignRoleModal}
        roleName={assignRoleModal}
        onClose={() => setAssignRoleModal(null)}
        searchQuery={roleStudentSearch}
        onSearchChange={handleRoleStudentSearchChange}
        results={roleStudentResults}
        addingStudent={addingStudent}
        onAssign={handleAssignRole}
      />

      {/* ═══════ Observation Modal ═══════ */}
      <ObservationModal
        open={!!obsModal}
        onClose={() => setObsModal(null)}
        columnTitle={obsModal?.columnTitle || ''}
        selectedStudent={obsSelectedStudent}
        studentSearch={obsStudentSearch}
        studentResults={obsStudentResults}
        onStudentSearchChange={handleObsStudentSearch}
        onSelectStudent={(s) => setObsSelectedStudent(s)}
        onClearStudent={() => setObsSelectedStudent(null)}
        category={obsCategory}
        onCategoryChange={setObsCategory}
        date={obsDate}
        onDateChange={setObsDate}
        text={obsText}
        onTextChange={setObsText}
        saving={savingObs}
        onSave={handleSaveObservation}
      />

      {/* ═══════ Task Modal ═══════ */}
      <TaskModal
        open={!!taskModal}
        onClose={() => setTaskModal(null)}
        isEditing={!!taskModal?.item}
        form={taskForm}
        onFormChange={setTaskForm}
        saving={savingTask}
        onSave={handleSaveTask}
      />
    </div>
  )
}
