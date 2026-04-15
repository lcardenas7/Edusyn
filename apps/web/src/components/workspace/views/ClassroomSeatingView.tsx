import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, Lock, Printer, RotateCcw, Search, Save, Users, X } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'
import { WorkspaceBoard } from '../types'
import { WBadge, WButton, WSummaryCard, WInput } from '../ui'

interface ClassroomSeatingViewProps {
  board: WorkspaceBoard
  boardSummary: any
  onReloadBoard: () => void
  onReloadSummary: () => void
}

type SeatingSeat = {
  id: string
  row: number
  col: number
  number: number
  studentRecordId: string | null
  studentName: string | null
  workSide: 'LEFT' | 'RIGHT'
  blocked: boolean
}

function getSeatNumber(row: number, col: number, rows: number, columns: number, rowSizes?: number[]) {
  const sizes = Array.isArray(rowSizes) && rowSizes.length === rows
    ? rowSizes
    : Array.from({ length: rows }, () => columns)

  let offset = 0
  for (let r = row + 1; r < rows; r++) {
    offset += Math.max(1, Number(sizes[r]) || columns)
  }

  return offset + col + 1
}

function normalizeSeating(board: WorkspaceBoard) {
  const seating = ((board.metadata || {}) as any)?.seating || {}
  const rows = Math.max(1, Number(seating.rows) || 6)
  const columns = Math.max(1, Number(seating.columns) || 6)
  const rowSizes = Array.isArray(seating.rowSizes) && seating.rowSizes.length === rows
    ? seating.rowSizes.map((value: any) => Math.max(1, Number(value) || columns))
    : Array.from({ length: rows }, () => columns)
  const seatsByPosition = new Map<string, SeatingSeat>()

  if (Array.isArray(seating.seats)) {
    for (const seat of seating.seats) {
      if (typeof seat?.row === 'number' && typeof seat?.col === 'number') {
        seatsByPosition.set(`${seat.row}:${seat.col}`, {
          id: seat.id || `seat-${seat.row}-${seat.col}`,
          row: seat.row,
          col: seat.col,
          number: typeof seat.number === 'number' ? seat.number : getSeatNumber(seat.row, seat.col, rows, columns, rowSizes),
          studentRecordId: seat.studentRecordId || null,
          studentName: seat.studentName || null,
          workSide: seat.workSide === 'LEFT' ? 'LEFT' : 'RIGHT',
          blocked: !!seat.blocked,
        })
      }
    }
  }

  const seats: SeatingSeat[] = []
  for (let row = 0; row < rows; row++) {
    const rowLength = Math.max(1, Number(rowSizes[row]) || columns)
    for (let col = 0; col < rowLength; col++) {
      const existing = seatsByPosition.get(`${row}:${col}`)
      seats.push(existing || {
        id: `seat-${row}-${col}`,
        row,
        col,
        number: getSeatNumber(row, col, rows, columns, rowSizes),
        studentRecordId: null,
        studentName: null,
        workSide: 'RIGHT',
        blocked: false,
      })
    }
  }

  return {
    rows,
    columns,
    rowSizes,
    boardPosition: seating.boardPosition || 'BOTTOM',
    numberingMode: seating.numberingMode || 'COLUMN_MAJOR_LEFT',
    seats,
  }
}

function buildSeatingMetadata(board: WorkspaceBoard, seats: SeatingSeat[], rows: number, columns: number) {
  const baseMeta = (board.metadata || {}) as any
  const rowSizes = Array.from({ length: rows }, (_, rowIndex) => {
    const count = seats.filter(seat => seat.row === rowIndex).length
    return Math.max(1, count || columns)
  })
  return {
    ...baseMeta,
    template: 'CLASSROOM_SEATING',
    seating: {
      rows,
      columns,
      rowSizes,
      boardPosition: 'BOTTOM',
      numberingMode: 'COLUMN_MAJOR_LEFT',
      seats: seats.map((seat) => ({
        id: seat.id,
        row: seat.row,
        col: seat.col,
        number: seat.number,
        studentRecordId: seat.studentRecordId,
        studentName: seat.studentName,
        workSide: seat.workSide,
        blocked: seat.blocked,
      })),
    },
  }
}

export default function ClassroomSeatingView({ board, boardSummary, onReloadBoard, onReloadSummary }: ClassroomSeatingViewProps) {
  const seating = useMemo(() => normalizeSeating(board), [board])
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [dragSeatId, setDragSeatId] = useState<string | null>(null)
  const [layoutRows, setLayoutRows] = useState(String(seating.rows))
  const [layoutColumns, setLayoutColumns] = useState(String(seating.columns))
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<{ studentRecordId: string; userId?: string; fullName: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLayoutRows(String(seating.rows))
    setLayoutColumns(String(seating.columns))
  }, [seating.rows, seating.columns])

  useEffect(() => {
    if (!selectedSeatId && seating.seats.length) {
      setSelectedSeatId(seating.seats.find(seat => !seat.blocked) ? seating.seats.find(seat => !seat.blocked)!.id : seating.seats[0].id)
    }
  }, [selectedSeatId, seating.seats])

  const selectedSeat = seating.seats.find(seat => seat.id === selectedSeatId) || null
  const seatCount = seating.seats.length
  const occupiedCount = seating.seats.filter(seat => seat.studentRecordId && !seat.blocked).length
  const blockedCount = seating.seats.filter(seat => seat.blocked).length
  const emptyCount = Math.max(0, seatCount - occupiedCount - blockedCount)

  const updateBoardMetadata = async (nextSeats: SeatingSeat[], nextRows = seating.rows, nextColumns = seating.columns) => {
    setSaving(true)
    try {
      await teacherWorkspaceApi.updateBoard(board.id, {
        metadata: buildSeatingMetadata(board, nextSeats, nextRows, nextColumns),
      })
      await onReloadBoard()
      await onReloadSummary()
    } finally {
      setSaving(false)
    }
  }

  const updateSeat = async (seatId: string, updater: (seat: SeatingSeat) => SeatingSeat) => {
    const nextSeats = seating.seats.map(seat => (seat.id === seatId ? updater(seat) : seat))
    await updateBoardMetadata(nextSeats)
  }

  const handleMoveSeatStudent = async (sourceSeatId: string, targetSeatId: string) => {
    if (sourceSeatId === targetSeatId) return

    const sourceSeat = seating.seats.find(seat => seat.id === sourceSeatId)
    const targetSeat = seating.seats.find(seat => seat.id === targetSeatId)

    if (!sourceSeat || !targetSeat) return
    if (sourceSeat.blocked || targetSeat.blocked) return
    if (!sourceSeat.studentRecordId) return

    const nextSeats = seating.seats.map(seat => {
      if (seat.id === sourceSeatId) {
        return {
          ...seat,
          studentRecordId: targetSeat.studentRecordId,
          studentName: targetSeat.studentName,
        }
      }
      if (seat.id === targetSeatId) {
        return {
          ...seat,
          studentRecordId: sourceSeat.studentRecordId,
          studentName: sourceSeat.studentName,
        }
      }
      return seat
    })

    await updateBoardMetadata(nextSeats)
    setSelectedSeatId(targetSeatId)
  }

  const handleSeatDragStart = (e: React.DragEvent<HTMLButtonElement>, seatId: string) => {
    setDragSeatId(seatId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', seatId)
  }

  const handleSeatDragEnd = () => {
    setDragSeatId(null)
  }

  const handleSearchStudents = async (q: string) => {
    setStudentSearch(q)
    if (!q.trim()) {
      setStudentResults([])
      return
    }
    setSearching(true)
    try {
      const res = await teacherWorkspaceApi.searchStudents(board.id, q)
      setStudentResults(res.data || [])
    } catch {
      setStudentResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleAssignStudent = async (studentRecordId: string, fullName: string) => {
    if (!selectedSeat) return
    const nextSeats = seating.seats.map(seat => {
      const base = { ...seat }
      if (base.studentRecordId === studentRecordId) {
        base.studentRecordId = null
        base.studentName = null
      }
      if (base.id === selectedSeat.id) {
        base.studentRecordId = studentRecordId
        base.studentName = fullName
        base.blocked = false
      }
      return base
    })
    await updateBoardMetadata(nextSeats)
    setStudentSearch('')
    setStudentResults([])
  }

  const handleAutoFill = async () => {
    await teacherWorkspaceApi.populateBoard(board.id)
    await onReloadBoard()
    await onReloadSummary()
  }

  const handleExpandRows = async () => {
    setLayoutRows(String(Math.max(1, Number(layoutRows) || seating.rows) + 1))
  }

  const handleExpandColumns = async () => {
    setLayoutColumns(String(Math.max(1, Number(layoutColumns) || seating.columns) + 1))
  }

  const handleCompactLayout = async () => {
    const usedSeats = seating.seats.filter(seat => seat.studentRecordId || seat.blocked)
    if (!usedSeats.length) return

    const targetCount = usedSeats.length
    const nextRows = Math.max(1, seating.rows)
    const basePerRow = Math.floor(targetCount / nextRows)
    const remainder = targetCount % nextRows
    const rowSizes = Array.from({ length: nextRows }, (_, rowIndex) => basePerRow + (rowIndex >= nextRows - remainder ? 1 : 0))
      .map(size => Math.max(1, size))
    const nextColumns = Math.max(...rowSizes)
    const orderedSeats = [...usedSeats].sort((a, b) => a.number - b.number)

    const compactSeats: SeatingSeat[] = orderedSeats.map((source, index) => {
      let remaining = index
      let row = nextRows - 1
      while (row >= 0) {
        const rowLength = rowSizes[row]
        if (remaining < rowLength) break
        remaining -= rowLength
        row -= 1
      }
      const col = remaining
      return {
        ...source,
        id: source.id || `seat-${row}-${col}`,
        row,
        col,
        number: getSeatNumber(row, col, nextRows, nextColumns, rowSizes),
      }
    })

    setLayoutRows(String(nextRows))
    setLayoutColumns(String(nextColumns))
    await updateBoardMetadata(compactSeats, nextRows, nextColumns)
    setSelectedSeatId(null)
  }

  const handlePrintSeating = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1400,height=900')
    if (!printWindow) return

    const rowSizes = seating.rowSizes || Array.from({ length: seating.rows }, () => seating.columns)
    const summary = boardSummary || {
      occupancyPercentage: seatCount > 0 ? Math.round((occupiedCount / seatCount) * 100) : 0,
      occupiedSeats: occupiedCount,
      vacantSeats: emptyCount,
      blockedSeats: blockedCount,
      leftWorkSideCount: seating.seats.filter(seat => seat.studentRecordId && seat.workSide === 'LEFT').length,
      rightWorkSideCount: seating.seats.filter(seat => seat.studentRecordId && seat.workSide !== 'LEFT').length,
    }

    const seatRowsHtml = Array.from({ length: seating.rows })
      .map((_, rowIndex) => {
        const rowLength = Math.max(1, Number(rowSizes[rowIndex]) || seating.columns)
        const rowSeats = Array.from({ length: rowLength })
          .map((_, colIndex) => {
            const seat = seating.seats.find(s => s.row === rowIndex && s.col === colIndex)
            if (!seat) return ''
            return `
              <div style="
                border: 1px solid ${seat.blocked ? '#cbd5e1' : '#dbeafe'};
                border-radius: 14px;
                padding: 12px;
                min-height: 104px;
                background: ${seat.blocked ? '#f1f5f9' : seat.studentRecordId ? '#ecfdf5' : '#ffffff'};
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
                display: flex;
                flex-direction: column;
                justify-content: space-between;
              ">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                  <span style="font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:0.08em;">#${seat.number}</span>
                  <span style="font-size:10px;font-weight:700;padding:4px 8px;border-radius:999px;background:${seat.workSide === 'LEFT' ? '#fef3c7' : '#dbeafe'};color:${seat.workSide === 'LEFT' ? '#b45309' : '#1d4ed8'};">
                    ${seat.workSide === 'LEFT' ? 'Izq.' : 'Der.'}
                  </span>
                </div>
                <div style="margin-top:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;">
                  <div style="width:48px;height:48px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 1px 2px rgba(15,23,42,0.08);">🪑</div>
                  <div style="font-size:11px;font-weight:600;line-height:1.2;color:${seat.blocked ? '#cbd5e1' : seat.studentRecordId ? '#334155' : '#94a3b8'};max-width:100%;">
                    ${seat.blocked ? 'Bloqueada' : seat.studentName || 'Vacía'}
                  </div>
                  <div style="font-size:10px;color:${seat.blocked ? '#94a3b8' : seat.studentRecordId ? '#059669' : '#94a3b8'};line-height:1.2;">
                    ${seat.blocked ? 'Puesto no disponible' : seat.studentRecordId ? 'Estudiante asignado' : 'Lista para asignar'}
                  </div>
                </div>
              </div>
            `
          })
          .join('')

        return `<div style="display:grid;grid-template-columns:repeat(${rowLength}, minmax(0, 1fr));gap:10px;">${rowSeats}</div>`
      })
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>${board.title} - Plano del salón</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Inter, Arial, sans-serif;
              background: #f8fafc;
              color: #0f172a;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page {
              padding: 18px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin-bottom: 16px;
            }
            .title {
              font-size: 22px;
              font-weight: 800;
              margin: 0 0 4px 0;
            }
            .subtitle {
              margin: 0;
              color: #64748b;
              font-size: 13px;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
              margin-bottom: 16px;
            }
            .card {
              background: #fff;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px 14px;
            }
            .card-label {
              color: #64748b;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: .08em;
              text-transform: uppercase;
              margin-bottom: 6px;
            }
            .card-value {
              font-size: 24px;
              font-weight: 800;
              color: #0f172a;
            }
            .layout {
              display: grid;
              grid-template-columns: 1fr;
              gap: 12px;
            }
            .grid {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .board {
              margin-top: 12px;
              border: 2px solid #d97706;
              border-radius: 14px;
              background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%);
              padding: 14px;
              text-align: center;
              font-weight: 800;
              color: #92400e;
              letter-spacing: .16em;
              font-size: 12px;
            }
            .legend {
              display: flex;
              gap: 14px;
              flex-wrap: wrap;
              margin-top: 12px;
              color: #475569;
              font-size: 12px;
            }
            .legend span { display: inline-flex; align-items: center; gap: 6px; }
            .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
            .dot.free { background: #ffffff; border: 1px solid #cbd5e1; }
            .dot.assigned { background: #dcfce7; border: 1px solid #86efac; }
            .dot.blocked { background: #e2e8f0; border: 1px solid #cbd5e1; }
            .footer {
              margin-top: 16px;
              font-size: 10px;
              color: #94a3b8;
              text-align: right;
            }
            @media print {
              .page { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div>
                <h1 class="title">${board.title}</h1>
                <p class="subtitle">Plano del salón · El pizarrón siempre va abajo · Numeración desde la izquierda</p>
              </div>
              <div style="text-align:right; font-size: 12px; color: #64748b;">
                ${board.group?.grade?.name || ''} ${board.group?.name || ''}<br />
                ${new Date().toLocaleString('es-CO')}
              </div>
            </div>

            <div class="summary">
              <div class="card"><div class="card-label">Total sillas</div><div class="card-value">${seatCount}</div></div>
              <div class="card"><div class="card-label">Asignadas</div><div class="card-value">${summary.occupiedSeats || 0}</div></div>
              <div class="card"><div class="card-label">Vacías</div><div class="card-value">${summary.vacantSeats || 0}</div></div>
              <div class="card"><div class="card-label">Bloqueadas</div><div class="card-value">${summary.blockedSeats || 0}</div></div>
            </div>

            <div class="layout">
              <div class="grid">
                ${seatRowsHtml}
              </div>
              <div class="board">PIZARRÓN — FRENTE DEL SALÓN</div>
            </div>

            <div class="legend">
              <span><i class="dot free"></i> Puesto libre</span>
              <span><i class="dot assigned"></i> Estudiante asignado</span>
              <span><i class="dot blocked"></i> Puesto bloqueado</span>
              <span>Izq.: ${summary.leftWorkSideCount || 0}</span>
              <span>Der.: ${summary.rightWorkSideCount || 0}</span>
              <span>Cobertura: ${summary.occupancyPercentage || 0}%</span>
            </div>

            <div class="footer">Generado por Edusyn — ${new Date().toLocaleString('es-CO')}</div>
          </div>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleTrimEmptyEdges = async () => {
    const occupied = seating.seats.filter(seat => seat.studentRecordId || seat.blocked)
    if (occupied.length === 0) return

    const usedRows = occupied.map(seat => seat.row)
    const usedCols = occupied.map(seat => seat.col)
    const minRow = Math.min(...usedRows)
    const maxRow = Math.max(...usedRows)
    const minCol = Math.min(...usedCols)
    const maxCol = Math.max(...usedCols)
    const nextRows = maxRow - minRow + 1
    const nextColumns = maxCol - minCol + 1

    const nextSeats: SeatingSeat[] = []
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const source = seating.seats.find(seat => seat.row === row && seat.col === col)
        if (source) {
          nextSeats.push({
            ...source,
            row: row - minRow,
            col: col - minCol,
          })
        }
      }
    }

    const renumberedSeats = nextSeats.map((seat) => ({
      ...seat,
      number: getSeatNumber(seat.row, seat.col, nextRows, nextColumns),
    }))

    await updateBoardMetadata(renumberedSeats, nextRows, nextColumns)
    setSelectedSeatId(null)
  }

  const applyLayoutSize = async () => {
    const nextRows = Math.max(1, Number(layoutRows) || seating.rows)
    const nextColumns = Math.max(1, Number(layoutColumns) || seating.columns)

    const occupiedOutsideBounds = seating.seats.filter(seat => (seat.studentRecordId || seat.blocked) && (seat.row >= nextRows || seat.col >= nextColumns))
    if (occupiedOutsideBounds.length > 0) {
      const ok = window.confirm('Hay puestos ocupados o bloqueados fuera del nuevo tamaño. Si continúas, se conservarán solo los puestos dentro del nuevo rango. ¿Deseas continuar?')
      if (!ok) return
    }

    const nextSeats: SeatingSeat[] = []
    for (let row = 0; row < nextRows; row++) {
      for (let col = 0; col < nextColumns; col++) {
        const existing = seating.seats.find(seat => seat.row === row && seat.col === col)
        nextSeats.push(existing || {
          id: `seat-${row}-${col}`,
          row,
          col,
          number: getSeatNumber(row, col, nextRows, nextColumns),
          studentRecordId: null,
          studentName: null,
          workSide: 'RIGHT',
          blocked: false,
        })
      }
    }

    const renumberedSeats = nextSeats.map((seat) => ({
      ...seat,
      number: getSeatNumber(seat.row, seat.col, nextRows, nextColumns),
    }))

    await updateBoardMetadata(renumberedSeats, nextRows, nextColumns)
    setSelectedSeatId(null)
  }

  return (
    <div className="flex-1 flex flex-col gap-5 p-5 overflow-y-auto bg-slate-50/60">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <WSummaryCard label="Total sillas" value={String(seatCount)} icon={<Users className="w-4 h-4 text-slate-400" />} />
        <WSummaryCard label="Asignadas" value={String(occupiedCount)} icon={<Save className="w-4 h-4 text-green-500" />} valueColor="text-green-600" />
        <WSummaryCard label="Vacías" value={String(emptyCount)} icon={<RotateCcw className="w-4 h-4 text-amber-500" />} valueColor="text-amber-600" />
        <WSummaryCard label="Bloqueadas" value={String(blockedCount)} icon={<Lock className="w-4 h-4 text-slate-400" />} />
      </div>

      {boardSummary && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 text-body-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-800">Cobertura del salón:</span> {boardSummary.occupancyPercentage || 0}% · {' '}
          {boardSummary.occupiedSeats || 0}/{boardSummary.totalSeats || seatCount} puestos ocupados
          <span className="mx-2 text-slate-300">•</span>
          Izq.: {boardSummary.leftWorkSideCount || 0}
          <span className="mx-2 text-slate-300">•</span>
          Der.: {boardSummary.rightWorkSideCount || 0}
          <span className="mx-2 text-slate-300">•</span>
          Bloqueadas: {boardSummary.blockedSeats || 0}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex flex-wrap items-end gap-3">
        <WInput label="Filas" type="number" min={1} value={layoutRows} onChange={(e) => setLayoutRows(e.target.value)} />
        <WInput label="Columnas" type="number" min={1} value={layoutColumns} onChange={(e) => setLayoutColumns(e.target.value)} />
        <WButton variant="secondary" onClick={applyLayoutSize} disabled={saving}>Aplicar tamaño</WButton>
        <WButton variant="secondary" onClick={handleExpandRows} disabled={saving}>+ Fila</WButton>
        <WButton variant="secondary" onClick={handleExpandColumns} disabled={saving}>+ Columna</WButton>
        <WButton variant="secondary" onClick={handleCompactLayout} disabled={saving}>Compactar</WButton>
        <WButton variant="secondary" onClick={handleTrimEmptyEdges} disabled={saving}>Quitar vacíos</WButton>
        <WButton onClick={handleAutoFill} disabled={saving}>{saving ? 'Guardando...' : 'Autoubicar'}</WButton>
        <WButton variant="secondary" onClick={handlePrintSeating} icon={<Printer className="w-4 h-4" />}>
          Imprimir / Exportar
        </WButton>
        <div className="ml-auto text-badge text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          El pizarrón siempre queda abajo y las sillas se enumeran desde la izquierda.
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px] items-start">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="space-y-3">
            {Array.from({ length: seating.rows }).map((_, rowIndex) => {
              const rowLength = Math.max(1, Number(seating.rowSizes?.[rowIndex]) || seating.columns)
              return (
              <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${rowLength}, minmax(0, 1fr))` }}>
                {Array.from({ length: rowLength }).map((_, colIndex) => {
                  const seat = seating.seats.find(s => s.row === rowIndex && s.col === colIndex)
                  if (!seat) return null
                  const isActive = selectedSeatId === seat.id
                  const isDraggingSeat = dragSeatId === seat.id
                  const hasStudent = !!seat.studentRecordId
                  return (
                    <button
                      key={seat.id}
                      draggable={hasStudent && !seat.blocked}
                      onDragStart={(e) => handleSeatDragStart(e, seat.id)}
                      onDragEnd={handleSeatDragEnd}
                      onDragOver={(e) => {
                        if (!seat.blocked) e.preventDefault()
                      }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        const sourceSeatId = e.dataTransfer.getData('text/plain') || dragSeatId
                        if (sourceSeatId) {
                          await handleMoveSeatStudent(sourceSeatId, seat.id)
                        }
                        setDragSeatId(null)
                      }}
                      onClick={() => setSelectedSeatId(seat.id)}
                      className={`relative rounded-2xl border p-3 text-left min-h-[112px] transition-all duration-150 overflow-hidden ${
                        seat.blocked
                          ? 'bg-slate-50 border-dashed border-slate-300 text-slate-300'
                          : isDraggingSeat
                            ? 'bg-blue-100 border-blue-500 shadow-md opacity-80'
                          : isActive
                            ? 'bg-blue-50 border-blue-400 shadow-md ring-1 ring-blue-100'
                            : hasStudent
                              ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400">#{seat.number}</p>
                        <WBadge variant={seat.workSide === 'LEFT' ? 'warning' : 'info'} className="scale-90 origin-right">
                          {seat.workSide === 'LEFT' ? 'Izq.' : 'Der.'}
                        </WBadge>
                      </div>
                      <div className="mt-2 flex flex-col items-center justify-center gap-2">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-2xl shadow-sm">
                          🪑
                        </div>
                        <p className={`text-center text-[11px] font-medium leading-tight max-w-[92%] ${seat.blocked ? 'text-slate-300' : hasStudent ? 'text-slate-700' : 'text-slate-400'}`}>
                          {seat.blocked ? 'Bloqueada' : hasStudent ? seat.studentName : 'Vacía'}
                        </p>
                      </div>
                      <div className="mt-2 text-[10px] text-center text-slate-400 leading-tight">
                        {hasStudent && !seat.blocked ? 'Arrastra para mover' : seat.blocked ? 'Puesto no disponible' : 'Lista para asignar'}
                      </div>
                    </button>
                  )
                })}
              </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-amber-50/70 p-3 text-center text-sm font-semibold tracking-[0.18em] text-slate-600">
            PIZARRÓN — FRENTE DEL SALÓN
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4 sticky top-4">
          <div>
            <p className="text-body-sm font-semibold text-slate-800">Puesto seleccionado</p>
            {selectedSeat ? (
              <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm font-bold text-slate-900">#{selectedSeat.number}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => updateSeat(selectedSeat.id, seat => ({ ...seat, workSide: seat.workSide === 'LEFT' ? 'RIGHT' : 'LEFT' }))}
                      className="px-3 py-1.5 text-badge rounded-lg bg-white border border-slate-200 hover:border-blue-300 flex items-center gap-1.5"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Lado
                    </button>
                    <button
                      onClick={async () => updateSeat(selectedSeat.id, seat => ({ ...seat, blocked: !seat.blocked, studentRecordId: seat.blocked ? seat.studentRecordId : null, studentName: seat.blocked ? seat.studentName : null }))}
                      className="px-3 py-1.5 text-badge rounded-lg bg-white border border-slate-200 hover:border-red-300 flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" /> {selectedSeat.blocked ? 'Liberar' : 'Bloquear'}
                    </button>
                  </div>
                </div>
                <p className="text-body-sm text-slate-600">
                  {selectedSeat.blocked ? 'Este puesto está bloqueado.' : selectedSeat.studentName || 'Puesto libre.'}
                </p>
                {selectedSeat.studentName && (
                  <button
                    onClick={async () => updateSeat(selectedSeat.id, seat => ({ ...seat, studentRecordId: null, studentName: null }))}
                    className="text-body-sm text-red-500 hover:underline"
                  >
                    Quitar estudiante
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-body-sm text-slate-400">Selecciona una silla del salón.</p>
            )}
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-body-sm text-blue-800">
            Puedes mover estudiantes arrastrando una silla ocupada sobre otra silla.
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={studentSearch}
                onChange={(e) => handleSearchStudents(e.target.value)}
                placeholder="Buscar estudiante..."
                className="flex-1 border-none outline-none bg-transparent text-body-sm"
              />
              {searching && <span className="text-badge text-slate-400">...</span>}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {studentResults.map(student => (
                <button
                  key={student.studentRecordId}
                  onClick={() => handleAssignStudent(student.studentRecordId, student.fullName)}
                  disabled={!selectedSeat || selectedSeat.blocked}
                  className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="text-body-sm text-slate-700">{student.fullName}</span>
                  <span className="text-badge text-blue-600">Asignar</span>
                </button>
              ))}
              {studentSearch && !searching && studentResults.length === 0 && (
                <div className="px-3 py-4 text-center text-body-sm text-slate-400">
                  No hay estudiantes disponibles.
                </div>
              )}
              {!studentSearch && (
                <div className="px-3 py-4 text-center text-body-sm text-slate-400">
                  Busca un estudiante para asignarlo al puesto.
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setStudentSearch('')}
            className="text-body-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <X className="w-4 h-4" /> Limpiar búsqueda
          </button>
        </div>
      </div>
    </div>
  )
}
