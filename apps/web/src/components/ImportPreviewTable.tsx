import { CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export interface PreviewRow {
  [key: string]: any
}

export interface PreviewError {
  row: number
  field?: string
  message: string
}

export interface ImportPreviewResult {
  success: boolean
  totalRows: number
  validRows: number
  data: PreviewRow[]
  errors: PreviewError[]
}

interface ColumnDef {
  header: string
  key: string
}

interface ImportPreviewTableProps {
  result: ImportPreviewResult
  columns: ColumnDef[]
  entityLabel?: string
  /** Max rows to show before collapse (default 10) */
  maxVisible?: number
}

/**
 * Muestra un resumen visual del archivo Excel antes de confirmar la importación.
 * - Encabezado con conteos (total / válidas / errores)
 * - Lista de errores colapsable
 * - Tabla con filas válidas + filas con error resaltadas en rojo
 */
export default function ImportPreviewTable({
  result,
  columns,
  entityLabel = 'registros',
  maxVisible = 10,
}: ImportPreviewTableProps) {
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)

  const errorRowNums = new Set(result.errors.map(e => e.row))
  const visibleErrors = showAllErrors ? result.errors : result.errors.slice(0, 5)
  const visibleRows = showAllRows ? result.data : result.data.slice(0, maxVisible)

  const hasErrors = result.errors.length > 0
  const hasData = result.data.length > 0

  return (
    <div className="space-y-4">
      {/* ── Resumen ── */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${result.validRows > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        {result.validRows > 0
          ? <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
          : <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">
            {result.validRows > 0
              ? `${result.validRows} ${entityLabel} listos para importar`
              : `No hay ${entityLabel} válidos`}
          </p>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {result.totalRows} filas en el archivo
            </span>
            {result.validRows > 0 && (
              <span className="flex items-center gap-1 text-green-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {result.validRows} válidas
              </span>
            )}
            {hasErrors && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <XCircle className="w-3.5 h-3.5" />
                {result.errors.length} con error
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Lista de errores colapsable ── */}
      {hasErrors && (
        <div className="rounded-xl border border-red-200 overflow-hidden">
          <div className="bg-red-50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Errores a corregir ({result.errors.length})
            </span>
            {result.errors.length > 5 && (
              <button
                onClick={() => setShowAllErrors(!showAllErrors)}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                {showAllErrors ? <><ChevronUp className="w-3.5 h-3.5" />Ver menos</> : <><ChevronDown className="w-3.5 h-3.5" />Ver todos ({result.errors.length})</>}
              </button>
            )}
          </div>
          <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
            {visibleErrors.map((err, i) => (
              <div key={i} className="px-4 py-2 bg-white flex items-start gap-2 text-sm">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>
                  <span className="font-medium text-slate-700">Fila {err.row}</span>
                  {err.field && <span className="text-slate-500"> · {err.field}</span>}
                  <span className="text-red-700"> — {err.message}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabla de vista previa ── */}
      {hasData && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              Vista previa de datos
            </span>
            {result.data.length > maxVisible && (
              <button
                onClick={() => setShowAllRows(!showAllRows)}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                {showAllRows
                  ? <><ChevronUp className="w-3.5 h-3.5" />Mostrar menos</>
                  : <><ChevronDown className="w-3.5 h-3.5" />Ver todas ({result.data.length} filas)</>}
              </button>
            )}
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-10">#</th>
                  {columns.map(col => (
                    <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {col.header}
                    </th>
                  ))}
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row, i) => {
                  const rowNum = i + 2
                  const hasRowError = errorRowNums.has(rowNum)
                  return (
                    <tr key={i} className={hasRowError ? 'bg-red-50' : 'bg-white hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-xs text-slate-400">{rowNum}</td>
                      {columns.map(col => (
                        <td key={col.key} className={`px-3 py-2 ${hasRowError ? 'text-red-700' : 'text-slate-700'}`}>
                          {row[col.key] ?? <span className="text-slate-300 italic">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {hasRowError
                          ? <XCircle className="w-4 h-4 text-red-400" />
                          : <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
