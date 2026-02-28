import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { BOARD_TYPE_COLORS, BOARD_TYPE_LABELS } from '../types'
import { WBadge } from '../ui'

interface CalendarViewProps {
  calMonth: Date
  calEvents: any[]
  loadingCal: boolean
  calSelectedDay: string | null
  onMonthChange: (month: Date) => void
  onSelectDay: (dateStr: string | null) => void
  onGoToBoard: (boardId: string) => void
}

export default function CalendarView({
  calMonth,
  calEvents,
  loadingCal,
  calSelectedDay,
  onMonthChange,
  onSelectDay,
  onGoToBoard,
}: CalendarViewProps) {
  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const monthName = calMonth.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const today = new Date().toISOString().slice(0, 10)

  // Group events by date
  const eventsByDate: Record<string, any[]> = {}
  for (const ev of calEvents) {
    const d = ev.date ? new Date(ev.date).toISOString().slice(0, 10) : null
    if (d) {
      if (!eventsByDate[d]) eventsByDate[d] = []
      eventsByDate[d].push(ev)
    }
  }

  // Build calendar grid cells
  const cells: { day: number; dateStr: string }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, dateStr })
  }

  // Events for selected day
  const selectedDayEvents = calSelectedDay ? (eventsByDate[calSelectedDay] || []) : []

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-workspace mx-auto">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => onMonthChange(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors min-h-btn"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-center">
            <h2 className="text-h2 font-bold text-slate-900 capitalize">{monthName}</h2>
            <p className="text-body-sm text-slate-400 mt-0.5">{calEvents.length} eventos este mes</p>
          </div>
          <button
            onClick={() => onMonthChange(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors min-h-btn"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {loadingCal && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}

        {/* Legend — only types with events this month */}
        {(() => {
          const activeTypes = new Set(calEvents.map(e => e.boardType))
          const legendItems = Object.entries(BOARD_TYPE_LABELS).filter(([key]) => activeTypes.has(key))
          return legendItems.length > 0 ? (
            <div className="flex flex-wrap gap-3 mb-3">
              {legendItems.map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-body-sm text-slate-500">
                  <div className={`w-2.5 h-2.5 rounded-full ${BOARD_TYPE_COLORS[key]}`} />
                  {label}
                </div>
              ))}
            </div>
          ) : !loadingCal ? (
            <p className="text-body-sm text-slate-400 mb-3">Sin eventos este mes — agrega fechas a tus items con el ícono de calendario</p>
          ) : null
        })()}

        <div className="flex gap-4">
          {/* Calendar grid */}
          <div className="flex-1">
            <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                  <div key={d} className="px-2 py-2.5 text-center text-body-sm font-semibold text-slate-500">{d}</div>
                ))}
              </div>
              {/* Calendar cells */}
              <div className="grid grid-cols-7">
                {/* Empty cells for offset */}
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/50" />
                ))}
                {cells.map(({ day, dateStr }) => {
                  const dayEvents = eventsByDate[dateStr] || []
                  const isToday = dateStr === today
                  const isSelected = dateStr === calSelectedDay
                  return (
                    <div
                      key={day}
                      onClick={() => onSelectDay(isSelected ? null : dateStr)}
                      className={`min-h-[80px] border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' :
                        isToday ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-body-sm font-medium px-1 py-0.5 rounded ${
                          isToday ? 'bg-blue-600 text-white' : 'text-slate-600'
                        }`}>{day}</span>
                        {dayEvents.length > 0 && (
                          <span className="text-badge text-slate-400 font-medium">{dayEvents.length}</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${BOARD_TYPE_COLORS[ev.boardType] || 'bg-slate-400'}`} />
                            <span className="text-badge text-slate-600 truncate leading-tight">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-badge text-slate-400 pl-2.5">+{dayEvents.length - 3} más</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Day detail panel */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-card border border-slate-200 sticky top-4">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-body-sm font-semibold text-slate-800">
                  {calSelectedDay
                    ? new Date(calSelectedDay + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
                    : 'Selecciona un día'}
                </h3>
              </div>
              <div className="p-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {!calSelectedDay && (
                  <p className="text-body-sm text-slate-400 text-center py-8">Haz clic en un día para ver sus eventos</p>
                )}
                {calSelectedDay && selectedDayEvents.length === 0 && (
                  <p className="text-body-sm text-slate-400 text-center py-8">Sin eventos este día</p>
                )}
                {selectedDayEvents.map((ev: any) => (
                  <div key={ev.id} className="mb-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${BOARD_TYPE_COLORS[ev.boardType] || 'bg-slate-400'}`} />
                      <span className="text-badge font-medium text-slate-400 uppercase">
                        {BOARD_TYPE_LABELS[ev.boardType] || ev.boardType}
                      </span>
                    </div>
                    <p className="text-body-sm font-medium text-slate-800">{ev.title}</p>
                    <p className="text-body-sm text-slate-500 mt-0.5">{ev.boardTitle}</p>
                    {ev.status && (
                      <WBadge
                        variant={ev.status === 'DONE' ? 'success' : ev.status === 'IN_PROGRESS' ? 'warning' : 'default'}
                        className="mt-1"
                      >
                        {ev.status === 'DONE' ? 'Completado' : ev.status === 'IN_PROGRESS' ? 'En progreso' : ev.status}
                      </WBadge>
                    )}
                    <button
                      onClick={() => onGoToBoard(ev.boardId)}
                      className="mt-2 text-body-sm text-blue-600 hover:underline"
                    >
                      Ir al tablero →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
