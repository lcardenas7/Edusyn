import { useState, useMemo, useCallback, ReactNode } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

/**
 * Hook reutilizable para ordenamiento dinámico de tablas en reportes.
 *
 * Uso:
 *   const { sortColumn, sortDirection, handleSort, sortData } = useSortable<MiFila>()
 *   const filasOrdenadas = sortData(data)
 *
 *   <SortableHeader column="name" label="Estudiante" sort={{sortColumn, sortDirection, handleSort}} />
 */
export interface SortState {
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
  handleSort: (column: string) => void
}

export function useSortable<T extends Record<string, any>>(initialColumn: string | null = null) {
  const [sortColumn, setSortColumn] = useState<string | null>(initialColumn)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }, [sortColumn])

  const sortData = useCallback((data: T[]): T[] => {
    if (!sortColumn) return data
    return [...data].sort((a, b) => {
      let aVal = a[sortColumn]
      let bVal = b[sortColumn]
      // Nulls/undefined al final
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      // Strings: orden local español (tildes, mayúsculas)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'es', { sensitivity: 'base' })
        return sortDirection === 'asc' ? cmp : -cmp
      }
      // Boolean
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        const cmp = (aVal === bVal) ? 0 : aVal ? 1 : -1
        return sortDirection === 'asc' ? cmp : -cmp
      }
      // Números
      const aNum = Number(aVal) || 0
      const bNum = Number(bVal) || 0
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    })
  }, [sortColumn, sortDirection])

  const sortState: SortState = useMemo(() => ({
    sortColumn, sortDirection, handleSort,
  }), [sortColumn, sortDirection, handleSort])

  return { sortColumn, sortDirection, handleSort, sortData, sortState }
}

/**
 * Encabezado <th> clickeable con indicador visual de dirección.
 *
 * Props:
 *  - column: nombre de la propiedad a ordenar
 *  - label: texto visible
 *  - align: 'left' (default) | 'center' | 'right'
 *  - sort: estado proveniente de useSortable().sortState
 *  - className: clases CSS adicionales
 */
interface SortableHeaderProps {
  column: string
  label: ReactNode
  align?: 'left' | 'center' | 'right'
  sort: SortState
  className?: string
  sticky?: boolean
}

export function SortableHeader({ column, label, align = 'left', sort, className = '', sticky = false }: SortableHeaderProps) {
  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  const justifyClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : ''
  const base = sticky ? 'sticky left-0 bg-slate-50 z-10' : ''
  return (
    <th
      className={`${base} ${alignClass} cursor-pointer hover:bg-slate-100 select-none transition-colors ${className}`}
      onClick={() => sort.handleSort(column)}
      scope="col"
    >
      <div className={`flex items-center gap-1 ${justifyClass}`}>
        <span>{label}</span>
        {sort.sortColumn === column ? (
          sort.sortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
        ) : (
          <span className="w-3 h-3 opacity-30 text-[10px] leading-none">↕</span>
        )}
      </div>
    </th>
  )
}
